import { forwardRef, useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import {
  AlertCircle,
  ArrowUpRight,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  GraduationCap,
  IndianRupee,
  LogIn,
  LogOut,
  MessageCircle,
  Phone,
  Send,
  ShieldCheck,
  Sparkles,
  Upload,
  UserCog,
  UserSquare2,
  Users,
  WalletCards,
  type LucideIcon,
} from "lucide-react";
import { format } from "date-fns";
import jsPDF from "jspdf";
import { motion } from "framer-motion";
import * as XLSX from "xlsx";

import { supabase } from "@/integrations/supabase/client";
import type { Database, Json } from "@/integrations/supabase/types";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  attendanceLabels,
  attendanceStatuses,
  buildAttendanceMessage,
  buildWhatsAppUrl,
  openWhatsApp,
  buildDailyReportMessage,
  buildResultMessage,
  classOptions,
  defaultMessageTemplates,
  formatPercent,
  languageLabels,
  languageOptions,
  sendModeLabels,
  sendModeOptions,
  statusTone,
  todayDate,
  type AttendanceStatus,
  type MessageLanguage,
  type MessageTemplates,
  type NotificationSendMode,
} from "@/lib/attendance";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

type SchoolClass = Database["public"]["Tables"]["school_classes"]["Row"];
type Student = Database["public"]["Tables"]["students"]["Row"];
type AttendanceRecord = Database["public"]["Tables"]["attendance_records"]["Row"];
type AttendanceAnalytics = Database["public"]["Views"]["attendance_analytics"]["Row"];
type NotificationEvent = Database["public"]["Tables"]["notification_events"]["Row"];
type MessageTemplateRow = Database["public"]["Tables"]["message_templates"]["Row"];
type ResultUpload = Database["public"]["Tables"]["result_uploads"]["Row"];
type ExcelImport = Database["public"]["Tables"]["excel_imports"]["Row"];
type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type SalaryPayroll = Database["public"]["Tables"]["salary_payroll"]["Row"] & { profiles?: Pick<Profile, "full_name" | "phone" | "user_id"> | null };
type StaffRole = Database["public"]["Enums"]["app_role"];
type PayrollStatus = Database["public"]["Enums"]["payroll_status"];

type StudentWithAnalytics = Student & {
  analytics?: AttendanceAnalytics | null;
};

type AuthMode = "sign_in" | "sign_up";
type ActivePanel = "teacher" | "admin";

type DailySummary = {
  present: number;
  absent: number;
  leave: number;
  holiday: number;
  total: number;
};

type StudentImportRow = {
  full_name: string;
  roll_number: string;
  parent_name: string;
  parent_phone: string;
  whatsapp_phone: string;
  class_name: string;
  preferred_language: MessageLanguage;
  admission_number: string;
  notes: string;
};

type AttendanceImportRow = {
  full_name: string;
  roll_number: string;
  status: AttendanceStatus;
  attendance_date: string;
  notes: string;
};

const MotionCard = motion(Card);

const toneStyles: Record<string, string> = {
  success: "border-success/30 bg-success-soft text-success",
  danger: "border-danger/30 bg-danger-soft text-danger",
  warning: "border-warning/30 bg-warning-soft text-warning",
  muted: "border-border/80 bg-muted text-muted-foreground",
};

const roleLabels: Record<StaffRole, string> = {
  admin: "Admin",
  moderator: "Teacher",
  user: "Staff",
};

const payrollStatusLabels: Record<PayrollStatus, string> = {
  draft: "Draft",
  paid: "Paid",
  hold: "On hold",
};

const payrollTone: Record<PayrollStatus, string> = {
  draft: "warning",
  paid: "success",
  hold: "danger",
};

const formatCurrency = (value?: number | null) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value ?? 0);

const currentMonthStart = () => `${new Date().toISOString().slice(0, 7)}-01`;

const mergeMessageTemplates = (saved?: Partial<Record<MessageLanguage, Partial<Record<AttendanceStatus, string>>>>): MessageTemplates => ({
  english: { ...defaultMessageTemplates.english, ...(saved?.english ?? {}) },
  hindi: { ...defaultMessageTemplates.hindi, ...(saved?.hindi ?? {}) },
});

const templatesFromRows = (rows: MessageTemplateRow[] = []) => {
  const saved: Partial<Record<MessageLanguage, Partial<Record<AttendanceStatus, string>>>> = {};
  rows.forEach((row) => {
    saved[row.message_language] = {
      ...(saved[row.message_language] ?? {}),
      [row.attendance_status]: row.template_body,
    };
  });
  return mergeMessageTemplates(saved);
};

const statCards = [
  { key: "students", title: "Students in class", hint: "Live class roster count", icon: Users },
  { key: "attendance", title: "Average attendance", hint: "Across filtered students", icon: CheckCircle2 },
  { key: "risk", title: "Below 75%", hint: "Needs attention", icon: AlertCircle },
  { key: "messages", title: "Messages logged", hint: "Parent and staff queues", icon: Send },
] as const;

const normalizeHeader = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

const normalizePhone = (value: unknown) => String(value ?? "").replace(/[^0-9+]/g, "").trim();

const toMessageLanguage = (value: unknown): MessageLanguage => {
  const raw = String(value ?? "").trim().toLowerCase();
  return raw === "hindi" ? "hindi" : "english";
};

const toAttendanceStatus = (value: unknown): AttendanceStatus => {
  const raw = String(value ?? "").trim().toLowerCase();
  return attendanceStatuses.includes(raw as AttendanceStatus) ? (raw as AttendanceStatus) : "present";
};

const formatDateInput = (value: unknown, fallback: string) => {
  if (!value) return fallback;
  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed) {
      return `${parsed.y}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`;
    }
  }

  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? fallback : date.toISOString().slice(0, 10);
};

const deriveDailySummary = (rows: AttendanceRecord[]): DailySummary =>
  rows.reduce(
    (acc, row) => {
      acc[row.status] += 1;
      acc.total += 1;
      return acc;
    },
    { present: 0, absent: 0, leave: 0, holiday: 0, total: 0 },
  );

const parseWorkbookRows = async (file: File) => {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheetNames = workbook.SheetNames.length ? workbook.SheetNames : ["Sheet1"];
  const rows: Record<string, unknown>[] = [];
  for (const name of sheetNames) {
    const ws = workbook.Sheets[name];
    if (!ws) continue;
    const sheetRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });
    // Inject sheet name as class fallback so multi-sheet workbooks (Class 9, 10, 11, 12) split correctly
    for (const r of sheetRows) {
      const hasClass = Object.keys(r).some((k) => normalizeHeader(k) === "class_name" || normalizeHeader(k) === "class");
      if (!hasClass) {
        (r as Record<string, unknown>).class_name = name;
      }
      rows.push(r);
    }
  }
  return { rows, sheetName: sheetNames.join(", ") };
};

const mapStudentRows = (rows: Record<string, unknown>[], selectedClassName: string): StudentImportRow[] =>
  rows
    .map((row) => {
      const normalized = Object.fromEntries(Object.entries(row).map(([key, value]) => [normalizeHeader(key), value]));
      return {
        full_name: String(normalized.full_name || normalized.student_name || normalized.name || "").trim(),
        roll_number: String(normalized.roll_number || normalized.roll || "").trim(),
        parent_name: String(normalized.parent_name || normalized.guardian_name || "").trim(),
        parent_phone: normalizePhone(normalized.parent_phone || normalized.phone || normalized.guardian_phone),
        whatsapp_phone: normalizePhone(normalized.whatsapp_phone || normalized.parent_whatsapp || normalized.parent_phone || normalized.phone),
        class_name: String(normalized.class_name || normalized.class || selectedClassName).trim() || selectedClassName,
        preferred_language: toMessageLanguage(normalized.preferred_language || normalized.language),
        admission_number: String(normalized.admission_number || normalized.admission_no || "").trim(),
        notes: String(normalized.notes || "").trim(),
      };
    })
    .filter((row) => row.full_name && row.roll_number && row.parent_phone);

const mapAttendanceRows = (rows: Record<string, unknown>[], fallbackDate: string): AttendanceImportRow[] =>
  rows
    .map((row) => {
      const normalized = Object.fromEntries(Object.entries(row).map(([key, value]) => [normalizeHeader(key), value]));
      return {
        full_name: String(normalized.full_name || normalized.student_name || normalized.name || "").trim(),
        roll_number: String(normalized.roll_number || normalized.roll || "").trim(),
        status: toAttendanceStatus(normalized.status || normalized.attendance_status),
        attendance_date: formatDateInput(normalized.attendance_date || normalized.date, fallbackDate),
        notes: String(normalized.notes || "").trim(),
      };
    })
    .filter((row) => row.full_name && row.roll_number);

const StatCard = forwardRef<HTMLDivElement, { title: string; value: string; hint: string; icon: LucideIcon }>(({ title, value, hint, icon: Icon }, ref) => (
  <motion.div ref={ref} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} whileHover={{ y: -3 }}>
    <Card className="h-full border-border/60 bg-card/90 shadow-[var(--shadow-soft)] backdrop-blur-sm transition-shadow hover:shadow-[var(--shadow-elevated)]">
      <CardContent className="flex items-start justify-between gap-3 p-4 sm:p-5">
        <div className="min-w-0 space-y-1.5">
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">{title}</p>
          <p className="text-2xl font-semibold text-foreground sm:text-3xl">{value}</p>
          <p className="text-xs text-muted-foreground sm:text-sm">{hint}</p>
        </div>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/80 text-accent-foreground shadow-[var(--shadow-soft)] sm:h-11 sm:w-11">
          <Icon className="h-5 w-5" />
        </div>
      </CardContent>
    </Card>
  </motion.div>
));
StatCard.displayName = "StatCard";

export const AttendanceDashboard = () => {
  const { toast } = useToast();
  const studentFileInputRef = useRef<HTMLInputElement | null>(null);
  const attendanceFileInputRef = useRef<HTMLInputElement | null>(null);
  const resultFileInputRef = useRef<HTMLInputElement | null>(null);

  const [sessionLoading, setSessionLoading] = useState(true);
  const [authMode, setAuthMode] = useState<AuthMode>("sign_in");
  const [authPassword, setAuthPassword] = useState("");
  const [authFullName, setAuthFullName] = useState("");
  const [authPhone, setAuthPhone] = useState("");
  const [isSubmittingAuth, setIsSubmittingAuth] = useState(false);

  // Convert a phone number to a deterministic synthetic email used for Supabase auth
  const phoneToEmail = (phone: string) => {
    const digits = phone.replace(/[^0-9]/g, "");
    return `${digits}@staff.school.local`;
  };

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<StaffRole[]>([]);
  const [activePanel, setActivePanel] = useState<ActivePanel>("teacher");
  const [staffProfiles, setStaffProfiles] = useState<Profile[]>([]);

  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [students, setStudents] = useState<StudentWithAnalytics[]>([]);
  const [analytics, setAnalytics] = useState<AttendanceAnalytics[]>([]);
  const [notifications, setNotifications] = useState<NotificationEvent[]>([]);
  const [imports, setImports] = useState<ExcelImport[]>([]);
  const [results, setResults] = useState<ResultUpload[]>([]);
  const [payroll, setPayroll] = useState<SalaryPayroll[]>([]);
  const [dailyRecords, setDailyRecords] = useState<AttendanceRecord[]>([]);

  const [loading, setLoading] = useState(false);
  const [savingStudentId, setSavingStudentId] = useState<string | null>(null);
  const [selectedClassName, setSelectedClassName] = useState<(typeof classOptions)[number]>("9");
  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedDate, setSelectedDate] = useState(todayDate());
  const [search, setSearch] = useState("");
  const [sendMode, setSendMode] = useState<NotificationSendMode>("auto");
  const [messageLanguage, setMessageLanguage] = useState<MessageLanguage>("english");
  const [sheetLink, setSheetLink] = useState("");
  const [examName, setExamName] = useState("Terminal Exam");
  const [staffReportPhone, setStaffReportPhone] = useState("");
  const [payrollStaffId, setPayrollStaffId] = useState("");
  const [payrollMonth, setPayrollMonth] = useState(currentMonthStart());
  const [baseSalary, setBaseSalary] = useState("");
  const [allowances, setAllowances] = useState("");
  const [deductions, setDeductions] = useState("");
  const [payrollStatus, setPayrollStatus] = useState<PayrollStatus>("draft");
  const [payrollNotes, setPayrollNotes] = useState("");

  const [messageTemplates, setMessageTemplates] = useState<MessageTemplates>(() => {
    if (typeof window === "undefined") return mergeMessageTemplates();
    try {
      const saved = window.localStorage.getItem("attendance.messageTemplates");
      if (saved) return mergeMessageTemplates(JSON.parse(saved));
    } catch {
      // ignore
    }
    return mergeMessageTemplates();
  });
  const [templateEditStatus, setTemplateEditStatus] = useState<AttendanceStatus>("absent");
  const [templateSaveState, setTemplateSaveState] = useState<"saved" | "saving" | "error">("saved");
  const templateSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    try {
      window.localStorage.setItem("attendance.messageTemplates", JSON.stringify(messageTemplates));
    } catch {
      // ignore
    }
  }, [messageTemplates]);

  useEffect(
    () => () => {
      if (templateSaveTimerRef.current) clearTimeout(templateSaveTimerRef.current);
    },
    [],
  );

  const [attendanceDrafts, setAttendanceDrafts] = useState<Record<string, AttendanceStatus>>({});
  const [whatsappQueue, setWhatsappQueue] = useState<Array<{ phone: string; message: string; name: string }>>([]);
  const [studentImportPreview, setStudentImportPreview] = useState<StudentImportRow[]>([]);
  const [attendanceImportPreview, setAttendanceImportPreview] = useState<AttendanceImportRow[]>([]);
  const [lastImportSheetName, setLastImportSheetName] = useState("");

  const [importingStudentFile, setImportingStudentFile] = useState(false);
  const [importingAttendanceFile, setImportingAttendanceFile] = useState(false);
  const [uploadingResult, setUploadingResult] = useState(false);
  const [sendingDailyReport, setSendingDailyReport] = useState(false);
  const [savingPayroll, setSavingPayroll] = useState(false);

  const isAdmin = roles.includes("admin");
  const selectedClass = useMemo(
    () => classes.find((item) => item.id === selectedClassId) ?? classes.find((item) => item.class_name === selectedClassName),
    [classes, selectedClassId, selectedClassName],
  );

  const classLabel = useMemo(
    () => `Class ${selectedClass?.class_name ?? selectedClassName}${selectedClass?.section ? `-${selectedClass.section}` : ""}`,
    [selectedClass, selectedClassName],
  );

  const filteredStudents = useMemo(
    () =>
      students.filter((student) => {
        const inClass = selectedClassId ? student.class_id === selectedClassId : true;
        const matches = `${student.full_name} ${student.roll_number} ${student.parent_name ?? ""}`
          .toLowerCase()
          .includes(search.toLowerCase());
        return inClass && matches;
      }),
    [search, selectedClassId, students],
  );

  const riskStudents = useMemo(
    () => analytics.filter((item) => item.class_id === selectedClassId && item.below_75_percent),
    [analytics, selectedClassId],
  );

  const dailySummary = useMemo(() => deriveDailySummary(dailyRecords), [dailyRecords]);

  const payrollOverview = useMemo(() => {
    const monthItems = payroll.filter((item) => item.payroll_month?.slice(0, 7) === payrollMonth.slice(0, 7));
    return {
      total: monthItems.reduce((sum, item) => sum + (item.net_salary ?? 0), 0),
      paid: monthItems.filter((item) => item.status === "paid").length,
      pending: monthItems.filter((item) => item.status !== "paid").length,
    };
  }, [payroll, payrollMonth]);

  const overview = useMemo(() => {
    const avgAttendance = filteredStudents.length
      ? filteredStudents.reduce((sum, student) => sum + (student.analytics?.attendance_percentage ?? 0), 0) / filteredStudents.length
      : 0;
    return {
      students: String(filteredStudents.length),
      attendance: formatPercent(avgAttendance),
      risk: String(riskStudents.length),
      messages: String(notifications.filter((item) => item.delivery_status === "sent").length),
    };
  }, [filteredStudents, notifications, riskStudents]);

  const fetchDailyRecords = async (classId: string, date: string) => {
    const { data, error } = await supabase.from("attendance_records").select("*").eq("class_id", classId).eq("attendance_date", date);
    if (!error) {
      setDailyRecords(data ?? []);
    }
  };

  const loadDashboard = async (userId: string) => {
    setLoading(true);
    await supabase.rpc("ensure_staff_profile", {
      _full_name: authFullName || null,
      _phone: authPhone || null,
    });

    const [profileRes, rolesRes, staffProfilesRes, templatesRes, classesRes, studentsRes, analyticsRes, notificationsRes, importsRes, resultsRes, payrollRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("user_id", userId).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", userId),
      supabase.from("profiles").select("*").order("full_name"),
      supabase.from("message_templates").select("*").eq("user_id", userId),
      supabase.from("school_classes").select("*").order("class_name"),
      supabase.from("students").select("*").order("roll_number"),
      supabase.from("attendance_analytics").select("*"),
      supabase.from("notification_events").select("*").order("created_at", { ascending: false }).limit(12),
      supabase.from("excel_imports").select("*").order("created_at", { ascending: false }).limit(12),
      supabase.from("result_uploads").select("*").order("created_at", { ascending: false }).limit(12),
      supabase.from("salary_payroll").select("*, profiles(full_name, phone, user_id)").order("payroll_month", { ascending: false }).limit(24),
    ]);

    const errors = [profileRes.error, rolesRes.error, staffProfilesRes.error, templatesRes.error, classesRes.error, studentsRes.error, analyticsRes.error, notificationsRes.error, importsRes.error, resultsRes.error, payrollRes.error].filter(Boolean);
    if (errors.length) {
      toast({ title: "Could not load dashboard", description: errors[0]?.message ?? "Please try again.", variant: "destructive" });
      setLoading(false);
      return;
    }

    const analyticsMap = new Map((analyticsRes.data ?? []).map((row) => [row.student_id, row]));
    setProfile(profileRes.data ?? null);
    setRoles((rolesRes.data ?? []).map((item) => item.role));
    setStaffProfiles(staffProfilesRes.data ?? []);
    setMessageTemplates(templatesFromRows(templatesRes.data ?? []));
    setClasses(classesRes.data ?? []);
    setStudents((studentsRes.data ?? []).map((student) => ({ ...student, analytics: analyticsMap.get(student.id) ?? null })));
    setAnalytics(analyticsRes.data ?? []);
    setNotifications(notificationsRes.data ?? []);
    setImports(importsRes.data ?? []);
    setResults(resultsRes.data ?? []);
    setPayroll((payrollRes.data ?? []) as SalaryPayroll[]);
    setLoading(false);
  };

  useEffect(() => {
    const init = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      setCurrentUserId(session?.user?.id ?? null);
      setSessionLoading(false);
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setCurrentUserId(session?.user?.id ?? null);
      setSessionLoading(false);
    });

    void init();
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!currentUserId) {
      setProfile(null);
      setRoles([]);
      setStaffProfiles([]);
      setClasses([]);
      setStudents([]);
      setAnalytics([]);
      setNotifications([]);
      setImports([]);
      setResults([]);
      setPayroll([]);
      setDailyRecords([]);
      return;
    }

    void loadDashboard(currentUserId);
  }, [currentUserId]);

  useEffect(() => {
    const matchingClass = classes.find((item) => item.class_name === selectedClassName);
    if (matchingClass && matchingClass.id !== selectedClassId) {
      setSelectedClassId(matchingClass.id);
    }
  }, [classes, selectedClassId, selectedClassName]);

  useEffect(() => {
    if (!selectedClassId) return;
    void fetchDailyRecords(selectedClassId, selectedDate);
  }, [selectedClassId, selectedDate]);

  useEffect(() => {
    if (!selectedClassId) return;
    const nextDrafts: Record<string, AttendanceStatus> = {};
    students
      .filter((student) => student.class_id === selectedClassId)
      .forEach((student) => {
        nextDrafts[student.id] = attendanceDrafts[student.id] ?? "present";
      });
    setAttendanceDrafts((current) => ({ ...current, ...nextDrafts }));
  }, [selectedClassId, students]);

  useEffect(() => {
    setActivePanel(isAdmin ? "admin" : "teacher");
  }, [isAdmin]);

  useEffect(() => {
    if (!payrollStaffId && staffProfiles.length) {
      setPayrollStaffId(staffProfiles[0].id);
    }
  }, [payrollStaffId, staffProfiles]);

  const refreshAll = async () => {
    if (!currentUserId) return;
    await loadDashboard(currentUserId);
    if (selectedClassId) {
      await fetchDailyRecords(selectedClassId, selectedDate);
    }
  };

  const persistMessageTemplate = (language: MessageLanguage, status: AttendanceStatus, templateBody: string, immediate = false) => {
    if (templateSaveTimerRef.current) clearTimeout(templateSaveTimerRef.current);
    if (!currentUserId) return;

    const saveTemplate = async () => {
      setTemplateSaveState("saving");
      const { error } = await supabase.from("message_templates").upsert(
        {
          user_id: currentUserId,
          message_language: language,
          attendance_status: status,
          template_body: templateBody,
        },
        { onConflict: "user_id,message_language,attendance_status" },
      );
      setTemplateSaveState(error ? "error" : "saved");
      if (error) {
        toast({ title: "Template not saved", description: error.message, variant: "destructive" });
      }
    };

    if (immediate) {
      void saveTemplate();
      return;
    }

    setTemplateSaveState("saving");
    templateSaveTimerRef.current = setTimeout(() => void saveTemplate(), 600);
  };

  const updateMessageTemplate = (templateBody: string) => {
    setMessageTemplates((prev) => ({
      ...prev,
      [messageLanguage]: {
        ...prev[messageLanguage],
        [templateEditStatus]: templateBody,
      },
    }));
    persistMessageTemplate(messageLanguage, templateEditStatus, templateBody);
  };

  const resetMessageTemplate = () => {
    const defaultBody = defaultMessageTemplates[messageLanguage][templateEditStatus];
    setMessageTemplates((prev) => ({
      ...prev,
      [messageLanguage]: {
        ...prev[messageLanguage],
        [templateEditStatus]: defaultBody,
      },
    }));
    persistMessageTemplate(messageLanguage, templateEditStatus, defaultBody, true);
  };

  const handleAuthSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmittingAuth(true);

    try {
      const phoneDigits = authPhone.replace(/[^0-9]/g, "");
      if (!phoneDigits || phoneDigits.length < 7) {
        throw new Error("Please enter a valid phone number (at least 7 digits).");
      }
      const syntheticEmail = phoneToEmail(authPhone);

      if (authMode === "sign_up") {
        const { error } = await supabase.auth.signUp({
          email: syntheticEmail,
          password: authPassword,
          options: {
            emailRedirectTo: window.location.origin,
            data: {
              full_name: authFullName,
              phone: authPhone,
            },
          },
        });
        if (error) throw error;
        const { error: signInError } = await supabase.auth.signInWithPassword({ email: syntheticEmail, password: authPassword });
        if (signInError) throw signInError;
        await supabase.rpc("ensure_staff_profile", { _full_name: authFullName, _phone: authPhone });
        toast({ title: "Staff account created", description: "You are signed in now. Admin panel opens automatically for Admin accounts." });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: syntheticEmail, password: authPassword });
        if (error) throw error;
        await supabase.rpc("ensure_staff_profile", { _full_name: null, _phone: authPhone });
        toast({ title: "Signed in", description: "Welcome back. Your panel is loading." });
      }
    } catch (error) {
      toast({
        title: authMode === "sign_up" ? "Could not create account" : "Could not sign in",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmittingAuth(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast({ title: "Signed out", description: "Staff session closed." });
  };

  const markAttendance = async (student: StudentWithAnalytics) => {
    if (!selectedClassId) return;
    const status = attendanceDrafts[student.id] ?? "present";
    const message = buildAttendanceMessage({
      studentName: student.full_name,
      parentName: student.parent_name,
      classLabel,
      date: format(new Date(selectedDate), "dd MMM yyyy"),
      status,
      language: messageLanguage,
      template: messageTemplates[messageLanguage][status],
    });

    setSavingStudentId(student.id);
    const { data: record, error: attendanceError } = await supabase
      .from("attendance_records")
      .upsert(
        {
          student_id: student.id,
          class_id: selectedClassId,
          attendance_date: selectedDate,
          status,
          notes: sendMode === "manual" ? "Pending manual review" : null,
        },
        { onConflict: "student_id,attendance_date" },
      )
      .select()
      .single();

    if (attendanceError || !record) {
      toast({ title: "Attendance not saved", description: attendanceError?.message ?? "Please try again.", variant: "destructive" });
      setSavingStudentId(null);
      return;
    }

    const { error: notificationError } = await supabase.from("notification_events").insert({
      student_id: student.id,
      attendance_record_id: record.id,
      class_id: selectedClassId,
      report_date: selectedDate,
      notification_type: "attendance",
      send_mode: sendMode,
      message_language: messageLanguage,
      recipient_phone: student.whatsapp_phone || student.parent_phone,
      message_body: message,
      delivery_status: sendMode === "auto" ? "sent" : "pending",
      sent_at: sendMode === "auto" ? new Date().toISOString() : null,
      provider_response: sendMode === "auto" ? { mode: "demo" } : { mode: "manual_review" },
      summary: {},
    });

    if (notificationError) {
      toast({ title: "Saved attendance, but queue failed", description: notificationError.message, variant: "destructive" });
    } else {
      toast({ title: `${attendanceLabels[status]} marked`, description: `${student.full_name} updated successfully.` });
    }

    await refreshAll();
    setSavingStudentId(null);
  };

  const saveAllAttendance = async () => {
    if (!selectedClassId || !filteredStudents.length) return;
    setSavingStudentId("__bulk__");
    let success = 0;
    let failed = 0;
    for (const student of filteredStudents) {
      const status = attendanceDrafts[student.id] ?? "present";
      const message = buildAttendanceMessage({
        studentName: student.full_name,
        parentName: student.parent_name,
        classLabel,
        date: format(new Date(selectedDate), "dd MMM yyyy"),
        status,
        language: messageLanguage,
        template: messageTemplates[messageLanguage][status],
      });
      const { data: record, error } = await supabase
        .from("attendance_records")
        .upsert(
          {
            student_id: student.id,
            class_id: selectedClassId,
            attendance_date: selectedDate,
            status,
            notes: sendMode === "manual" ? "Pending manual review" : null,
          },
          { onConflict: "student_id,attendance_date" },
        )
        .select()
        .single();
      if (error || !record) {
        failed += 1;
        continue;
      }
      await supabase.from("notification_events").insert({
        student_id: student.id,
        attendance_record_id: record.id,
        class_id: selectedClassId,
        report_date: selectedDate,
        notification_type: "attendance",
        send_mode: sendMode,
        message_language: messageLanguage,
        recipient_phone: student.whatsapp_phone || student.parent_phone,
        message_body: message,
        delivery_status: sendMode === "auto" ? "sent" : "pending",
        sent_at: sendMode === "auto" ? new Date().toISOString() : null,
        provider_response: sendMode === "auto" ? { mode: "demo" } : { mode: "manual_review" },
        summary: {},
      });
      success += 1;
    }
    setSavingStudentId(null);
    toast({
      title: `Bulk save complete`,
      description: `${success} marked, ${failed} failed for ${classLabel}.`,
      variant: failed ? "destructive" : "default",
    });
    await refreshAll();
  };

  const sendBulkWhatsApp = (filterStatus?: AttendanceStatus) => {
    if (!filteredStudents.length) return;
    const targets = filteredStudents.filter((student) => {
      const status = attendanceDrafts[student.id] ?? "present";
      return filterStatus ? status === filterStatus : true;
    });
    if (!targets.length) {
      toast({ title: "No students to message", description: "Mark attendance first or pick a different status.", variant: "destructive" });
      return;
    }
    const queue: Array<{ phone: string; message: string; name: string }> = [];
    let skipped = 0;
    targets.forEach((student) => {
      const status = attendanceDrafts[student.id] ?? "present";
      const message = buildAttendanceMessage({
        studentName: student.full_name,
        parentName: student.parent_name,
        classLabel,
        date: format(new Date(selectedDate), "dd MMM yyyy"),
        status,
        language: messageLanguage,
        template: messageTemplates[messageLanguage][status],
      });
      const raw = (student.whatsapp_phone || student.parent_phone || "").replace(/[^\d]/g, "");
      if (!raw) {
        skipped += 1;
        return;
      }
      const phone = raw.length === 10 ? `91${raw}` : raw;
      queue.push({ phone, message, name: student.full_name });
    });
    if (!queue.length) {
      toast({ title: "No phone numbers", description: "Add parent/WhatsApp numbers for these students.", variant: "destructive" });
      return;
    }
    // Open the first one inside this user gesture so the browser allows it.
    const [first, ...rest] = queue;
    openWhatsApp(first.phone, first.message);
    setWhatsappQueue(rest);
    toast({
      title: `Opening WhatsApp for ${queue.length} parent${queue.length === 1 ? "" : "s"}`,
      description: rest.length
        ? `Opened 1 of ${queue.length}. Click "Send next" for each remaining message.${skipped ? ` ${skipped} skipped (no phone).` : ""}`
        : skipped
          ? `${skipped} skipped (no phone).`
          : "Done.",
    });
  };

  const sendNextInQueue = () => {
    if (!whatsappQueue.length) return;
    const [next, ...rest] = whatsappQueue;
    openWhatsApp(next.phone, next.message);
    setWhatsappQueue(rest);
  };

  const clearWhatsappQueue = () => setWhatsappQueue([]);

  const sendAttendanceWhatsApp = (student: StudentWithAnalytics) => {
    const status = attendanceDrafts[student.id] ?? "present";
    const message = buildAttendanceMessage({
      studentName: student.full_name,
      parentName: student.parent_name,
      classLabel,
      date: format(new Date(selectedDate), "dd MMM yyyy"),
      status,
      language: messageLanguage,
      template: messageTemplates[messageLanguage][status],
    });
    const raw = (student.whatsapp_phone || student.parent_phone || "").replace(/[^\d]/g, "");
    if (!raw) {
      toast({ title: "No WhatsApp number", description: "Add a parent or WhatsApp phone for this student first.", variant: "destructive" });
      return;
    }
    const phone = raw.length === 10 ? `91${raw}` : raw;
    openWhatsApp(phone, message);
  };

  const uploadImportFile = async (file: File, sourceName: string, summary: Json, rowsImported: number) => {
    if (!selectedClassId) return;
    const path = `${selectedClassId}/${Date.now()}-${file.name.replace(/\s+/g, "-")}`;

    const { error: uploadError } = await supabase.storage.from("attendance-imports").upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type || "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    if (uploadError) throw uploadError;

    const { error: importError } = await supabase.from("excel_imports").insert({
      class_id: selectedClassId,
      source_name: sourceName,
      source_type: "excel_upload",
      storage_path: path,
      worksheet_name: lastImportSheetName || null,
      status: "completed",
      rows_imported: rowsImported,
      summary,
    });

    if (importError) throw importError;
  };

  const resolveOrCreateClass = async (className: string): Promise<SchoolClass | null> => {
    const cleaned = className.replace(/^class\s*/i, "").trim();
    if (!cleaned) return null;
    const existing = classes.find((c) => c.class_name.toLowerCase() === cleaned.toLowerCase());
    if (existing) return existing;
    const academicYear = new Date().getFullYear().toString();
    const { data, error } = await supabase
      .from("school_classes")
      .insert({ class_name: cleaned, academic_year: academicYear })
      .select()
      .single();
    if (error || !data) return null;
    setClasses((prev) => [...prev, data]);
    return data;
  };

  const handleStudentExcelUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !selectedClassId || !selectedClass) return;

    setImportingStudentFile(true);
    try {
      const { rows, sheetName } = await parseWorkbookRows(file);
      setLastImportSheetName(sheetName);
      const parsedRows = mapStudentRows(rows, selectedClass.class_name);
      setStudentImportPreview(parsedRows.slice(0, 6));

      // Build a roll->student map across ALL classes so we can move/update by roll
      const byRoll = new Map(students.map((student) => [`${student.class_id}::${student.roll_number.toLowerCase()}`, student]));
      const classCache = new Map<string, string>(); // class_name(lower) -> class_id
      classes.forEach((c) => classCache.set(c.class_name.toLowerCase(), c.id));

      const classCounts: Record<string, number> = {};

      for (const row of parsedRows) {
        // Resolve which class this row belongs to (from sheet's class column, falling back to selected)
        const rawClassName = (row.class_name || selectedClass.class_name).replace(/^class\s*/i, "").trim();
        let classId = classCache.get(rawClassName.toLowerCase());
        if (!classId) {
          const created = await resolveOrCreateClass(rawClassName);
          if (created) {
            classId = created.id;
            classCache.set(created.class_name.toLowerCase(), created.id);
          }
        }
        if (!classId) continue;

        classCounts[rawClassName] = (classCounts[rawClassName] ?? 0) + 1;

        const existing = byRoll.get(`${classId}::${row.roll_number.toLowerCase()}`);
        const payload = {
          class_id: classId,
          full_name: row.full_name,
          roll_number: row.roll_number,
          parent_name: row.parent_name || null,
          parent_phone: row.parent_phone,
          whatsapp_phone: row.whatsapp_phone || row.parent_phone,
          preferred_language: row.preferred_language,
          admission_number: row.admission_number || null,
          notes: row.notes || null,
          is_active: true,
        };

        if (existing) {
          const { error } = await supabase.from("students").update(payload).eq("id", existing.id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from("students").insert(payload);
          if (error) throw error;
        }
      }

      const breakdown = Object.entries(classCounts).map(([k, v]) => `Class ${k}: ${v}`).join(" · ");
      if (breakdown) {
        toast({ title: "Multi-class import", description: breakdown });
      }

      await uploadImportFile(file, `${file.name} · Student master`, { type: "student_master", sheetName, parsedRows: parsedRows.length }, parsedRows.length);
      toast({ title: "Student data imported", description: `${parsedRows.length} student rows processed from Excel.` });
      await refreshAll();
    } catch (error) {
      toast({ title: "Student import failed", description: error instanceof Error ? error.message : "Please check the sheet format.", variant: "destructive" });
    } finally {
      event.target.value = "";
      setImportingStudentFile(false);
    }
  };

  const handleAttendanceExcelUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !selectedClassId) return;

    setImportingAttendanceFile(true);
    try {
      const { rows, sheetName } = await parseWorkbookRows(file);
      setLastImportSheetName(sheetName);
      const parsedRows = mapAttendanceRows(rows, selectedDate);
      setAttendanceImportPreview(parsedRows.slice(0, 6));

      const roster = students.filter((student) => student.class_id === selectedClassId);
      const matchByRoll = new Map(roster.map((student) => [student.roll_number.toLowerCase(), student]));

      for (const row of parsedRows) {
        const student = matchByRoll.get(row.roll_number.toLowerCase());
        if (!student) continue;

        const { error } = await supabase.from("attendance_records").upsert(
          {
            student_id: student.id,
            class_id: selectedClassId,
            attendance_date: row.attendance_date,
            status: row.status,
            notes: row.notes || null,
          },
          { onConflict: "student_id,attendance_date" },
        );

        if (error) throw error;
      }

      await uploadImportFile(file, `${file.name} · Attendance`, { type: "attendance", sheetName, parsedRows: parsedRows.length }, parsedRows.length);
      toast({ title: "Attendance imported", description: `${parsedRows.length} attendance rows synced from Excel.` });
      await refreshAll();
    } catch (error) {
      toast({ title: "Attendance import failed", description: error instanceof Error ? error.message : "Please check the sheet format.", variant: "destructive" });
    } finally {
      event.target.value = "";
      setImportingAttendanceFile(false);
    }
  };

  const handleExportTodayAttendance = async () => {
    try {
      const { data, error } = await supabase
        .from("attendance_records")
        .select("*")
        .eq("attendance_date", selectedDate);
      if (error) throw error;

      const records = data ?? [];
      if (!records.length) {
        toast({ title: "No attendance found", description: `No attendance records exist for ${selectedDate}.`, variant: "destructive" });
        return;
      }

      const studentMap = new Map(students.map((s) => [s.id, s]));
      const classMap = new Map(classes.map((c) => [c.id, c]));

      const allRows = records.map((rec) => {
        const stu = studentMap.get(rec.student_id);
        const cls = classMap.get(rec.class_id);
        return {
          Class: cls ? `Class ${cls.class_name}${cls.section ? `-${cls.section}` : ""}` : "—",
          Roll: stu?.roll_number ?? "",
          Student: stu?.full_name ?? "",
          Parent: stu?.parent_name ?? "",
          Phone: stu?.whatsapp_phone || stu?.parent_phone || "",
          Status: attendanceLabels[rec.status],
          Date: rec.attendance_date,
          Notes: rec.notes ?? "",
        };
      });

      const wb = XLSX.utils.book_new();

      // Summary sheet
      const summaryByClass: Record<string, { Present: number; Absent: number; Leave: number; Holiday: number; Total: number }> = {};
      records.forEach((rec) => {
        const cls = classMap.get(rec.class_id);
        const key = cls ? `Class ${cls.class_name}${cls.section ? `-${cls.section}` : ""}` : "Unknown";
        if (!summaryByClass[key]) summaryByClass[key] = { Present: 0, Absent: 0, Leave: 0, Holiday: 0, Total: 0 };
        summaryByClass[key][attendanceLabels[rec.status] as "Present" | "Absent" | "Leave" | "Holiday"] += 1;
        summaryByClass[key].Total += 1;
      });
      const summaryRows = Object.entries(summaryByClass).map(([Class, v]) => ({ Class, ...v }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryRows), "Summary");

      // All records sheet
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(allRows), "All Records");

      // One sheet per class
      const grouped: Record<string, typeof allRows> = {};
      allRows.forEach((row) => {
        if (!grouped[row.Class]) grouped[row.Class] = [];
        grouped[row.Class].push(row);
      });
      Object.entries(grouped).forEach(([cls, rows]) => {
        const safe = cls.replace(/[\\/:*?[\]]/g, "_").slice(0, 31);
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), safe);
      });

      XLSX.writeFile(wb, `attendance_${selectedDate}.xlsx`);
      toast({ title: "Excel exported", description: `${records.length} attendance records exported for ${selectedDate}.` });
    } catch (error) {
      toast({ title: "Export failed", description: error instanceof Error ? error.message : "Could not export attendance.", variant: "destructive" });
    }
  };

  const handleGoogleSheetLink = async () => {
    if (!sheetLink.trim() || !selectedClassId) return;
    const { error } = await supabase.from("excel_imports").insert({
      class_id: selectedClassId,
      source_name: sheetLink,
      source_type: "google_sheet",
      spreadsheet_id: sheetLink,
      status: "pending",
      summary: { note: "Sheet link saved for future live sync." },
    });

    if (error) {
      toast({ title: "Could not save Google Sheet", description: error.message, variant: "destructive" });
      return;
    }

    setSheetLink("");
    toast({ title: "Google Sheet saved", description: "The link is now stored in the backend." });
    await refreshAll();
  };

  const handleResultUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !selectedClassId) return;

    setUploadingResult(true);
    try {
      const path = `${selectedClassId}/${Date.now()}-${file.name.replace(/\s+/g, "-")}`;
      const { error: uploadError } = await supabase.storage.from("student-results").upload(path, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type || "application/pdf",
      });
      if (uploadError) throw uploadError;

      const classStudents = students.filter((student) => student.class_id === selectedClassId);
      const payload = classStudents.map((student) => ({
        class_id: selectedClassId,
        student_id: student.id,
        exam_name: examName,
        storage_path: path,
        send_to_parent: true,
      }));

      const { data, error: resultError } = await supabase.from("result_uploads").insert(payload).select();
      if (resultError) throw resultError;

      if (data?.length) {
        const notificationPayload = data
          .map((result) => {
            const student = classStudents.find((item) => item.id === result.student_id);
            if (!student) return null;
            return {
              student_id: student.id,
              result_upload_id: result.id,
              class_id: selectedClassId,
              report_date: selectedDate,
              notification_type: "result" as const,
              send_mode: sendMode,
              message_language: messageLanguage,
              recipient_phone: student.whatsapp_phone || student.parent_phone,
              message_body: buildResultMessage({
                studentName: student.full_name,
                parentName: student.parent_name,
                examName,
                classLabel,
                language: messageLanguage,
              }),
              delivery_status: sendMode === "auto" ? ("sent" as const) : ("pending" as const),
              sent_at: sendMode === "auto" ? new Date().toISOString() : null,
              provider_response: sendMode === "auto" ? ({ mode: "demo" } as Json) : ({ mode: "manual_review" } as Json),
              summary: {},
            };
          })
          .filter(Boolean);

        if (notificationPayload.length) {
          const { error: notificationError } = await supabase.from("notification_events").insert(notificationPayload as Database["public"]["Tables"]["notification_events"]["Insert"][]);
          if (notificationError) throw notificationError;
        }
      }

      toast({ title: "Results uploaded", description: "PDF stored and parent notifications prepared." });
      await refreshAll();
    } catch (error) {
      toast({ title: "Result upload failed", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" });
    } finally {
      event.target.value = "";
      setUploadingResult(false);
    }
  };

  const handleDailyReportSend = async () => {
    if (!selectedClassId) return;
    const recipient = staffReportPhone.trim() || profile?.phone || "";
    if (!recipient) {
      toast({ title: "Staff WhatsApp number required", description: "Add a staff phone number before sending the daily report.", variant: "destructive" });
      return;
    }

    setSendingDailyReport(true);
    try {
      const message = buildDailyReportMessage({
        classLabel,
        date: format(new Date(selectedDate), "dd MMM yyyy"),
        present: dailySummary.present,
        absent: dailySummary.absent,
        leave: dailySummary.leave,
        holiday: dailySummary.holiday,
        total: dailySummary.total,
        language: messageLanguage,
      });

      const { error } = await supabase.from("notification_events").insert({
        class_id: selectedClassId,
        report_date: selectedDate,
        notification_type: "daily_report",
        send_mode: sendMode,
        message_language: messageLanguage,
        recipient_phone: recipient,
        message_body: message,
        delivery_status: sendMode === "auto" ? "sent" : "pending",
        sent_at: sendMode === "auto" ? new Date().toISOString() : null,
        provider_response: sendMode === "auto" ? { mode: "demo", channel: "staff_whatsapp" } : { mode: "manual_review" },
        summary: dailySummary,
      });

      if (error) throw error;
      toast({ title: "Daily report prepared", description: "Staff summary has been added to the message queue." });
      await refreshAll();
    } catch (error) {
      toast({ title: "Daily report failed", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" });
    } finally {
      setSendingDailyReport(false);
    }
  };

  const handlePayrollSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isAdmin || !payrollStaffId) return;

    setSavingPayroll(true);
    try {
      const { error } = await supabase.from("salary_payroll").upsert(
        {
          staff_profile_id: payrollStaffId,
          payroll_month: payrollMonth,
          base_salary: Number(baseSalary || 0),
          allowances: Number(allowances || 0),
          deductions: Number(deductions || 0),
          status: payrollStatus,
          paid_on: payrollStatus === "paid" ? todayDate() : null,
          notes: payrollNotes || null,
          created_by: currentUserId,
        },
        { onConflict: "staff_profile_id,payroll_month" },
      );

      if (error) throw error;
      toast({ title: "Salary record saved", description: "Payroll is updated for the selected staff member." });
      setBaseSalary("");
      setAllowances("");
      setDeductions("");
      setPayrollNotes("");
      setPayrollStatus("draft");
      await refreshAll();
    } catch (error) {
      toast({ title: "Salary not saved", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" });
    } finally {
      setSavingPayroll(false);
    }
  };

  const buildPayslipDoc = (item: SalaryPayroll) => {
    const staffName = item.profiles?.full_name || "Staff member";
    const doc = new jsPDF();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.text("Salary Payslip", 20, 24);
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text(`Staff: ${staffName}`, 20, 42);
    doc.text(`Phone: ${item.profiles?.phone || "-"}`, 20, 50);
    doc.text(`Month: ${format(new Date(item.payroll_month), "MMMM yyyy")}`, 20, 58);
    doc.text(`Status: ${payrollStatusLabels[item.status]}`, 20, 66);
    doc.line(20, 76, 190, 76);
    doc.text(`Base salary: ${formatCurrency(item.base_salary)}`, 24, 90);
    doc.text(`Allowances: ${formatCurrency(item.allowances)}`, 24, 102);
    doc.text(`Deductions: ${formatCurrency(item.deductions)}`, 24, 114);
    doc.setFont("helvetica", "bold");
    doc.text(`Net salary: ${formatCurrency(item.net_salary)}`, 24, 130);
    doc.setFont("helvetica", "normal");
    doc.text(`Paid on: ${item.paid_on ? format(new Date(item.paid_on), "dd MMM yyyy") : "Pending"}`, 24, 144);
    if (item.notes) doc.text(`Notes: ${item.notes}`, 24, 158, { maxWidth: 160 });
    const fileName = `payslip-${staffName.replace(/\s+/g, "-").toLowerCase()}-${item.payroll_month.slice(0, 7)}.pdf`;
    return { doc, fileName, staffName };
  };

  const downloadPayslip = (item: SalaryPayroll) => {
    const { doc, fileName } = buildPayslipDoc(item);
    doc.save(fileName);
  };

  const buildPayslipMessage = (item: SalaryPayroll) => {
    const staffName = item.profiles?.full_name || "Staff member";
    const monthLabel = format(new Date(item.payroll_month), "MMMM yyyy");
    return [
      `Hello ${staffName},`,
      ``,
      `Here is your salary payslip for ${monthLabel}.`,
      `Status: ${payrollStatusLabels[item.status]}`,
      `Base: ${formatCurrency(item.base_salary)} | Allowances: ${formatCurrency(item.allowances)} | Deductions: ${formatCurrency(item.deductions)}`,
      `Net salary: ${formatCurrency(item.net_salary)}`,
      item.paid_on ? `Paid on: ${format(new Date(item.paid_on), "dd MMM yyyy")}` : `Payment status: Pending`,
      ``,
      `The PDF payslip has been downloaded — please attach it from your device when forwarding.`,
    ].join("\n");
  };

  const sharePayslipWhatsApp = (item: SalaryPayroll) => {
    const { doc, fileName } = buildPayslipDoc(item);
    doc.save(fileName);
    const phoneRaw = (item.profiles?.phone || "").replace(/[^\d]/g, "");
    if (!phoneRaw) {
      toast({ title: "No phone on file", description: "Add a phone number to this staff profile to share via WhatsApp.", variant: "destructive" });
      return;
    }
    const phone = phoneRaw.length === 10 ? `91${phoneRaw}` : phoneRaw;
    openWhatsApp(phone, buildPayslipMessage(item));
    toast({ title: "Payslip ready", description: "PDF downloaded — attach it inside WhatsApp to send to the staff member." });
  };

  const sharePayslipEmail = (item: SalaryPayroll) => {
    const { doc, fileName } = buildPayslipDoc(item);
    doc.save(fileName);
    const email = window.prompt(`Enter email address to send the payslip to ${item.profiles?.full_name || "staff member"}:`, "");
    if (!email) return;
    const subject = `Salary Payslip — ${format(new Date(item.payroll_month), "MMMM yyyy")}`;
    const url = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(buildPayslipMessage(item))}`;
    window.location.href = url;
    toast({ title: "Payslip ready", description: "PDF downloaded — attach it in your email client before sending." });
  };

  const editPayrollEntry = (item: SalaryPayroll) => {
    setPayrollStaffId(item.staff_profile_id);
    setPayrollMonth(item.payroll_month);
    setBaseSalary(String(item.base_salary ?? ""));
    setAllowances(String(item.allowances ?? ""));
    setDeductions(String(item.deductions ?? ""));
    setPayrollStatus(item.status);
    setPayrollNotes(item.notes ?? "");
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
    toast({ title: "Editing payslip", description: "Update the values and save to overwrite this record." });
  };


  if (sessionLoading) {
    return <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">Loading attendance control center…</div>;
  }

  if (!currentUserId) {
    return (
      <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
        <div className="pointer-events-none absolute inset-0 bg-hero-gradient opacity-90" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,hsl(var(--primary-glow)/0.26),transparent_30%),radial-gradient(circle_at_bottom_right,hsl(var(--secondary)/0.22),transparent_28%)]" />
        <main className="relative mx-auto flex min-h-screen max-w-6xl items-center px-4 py-10 sm:px-6 lg:px-8">
          <section className="grid w-full gap-6 lg:grid-cols-[1.15fr,0.85fr]">
            <motion.div initial={{ opacity: 0, x: -24 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.45 }} className="space-y-6">
              <Badge className="rounded-full border-border/70 bg-background/70 px-4 py-1.5 text-foreground">✨ Smart Attendance</Badge>
              <div className="space-y-4">
                <h1 className="font-display text-4xl leading-tight sm:text-5xl lg:text-6xl">A delightful command center for teachers, admins, and parents.</h1>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  ["Excel-ready", "Student master + attendance import"],
                  ["Panel control", "Teacher and admin by role"],
                  ["Daily summary", "Staff WhatsApp queue + dashboard totals"],
                ].map(([title, note], index) => (
                  <motion.div key={title} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.08 + 0.15 }} className="rounded-2xl border border-border/70 bg-background/65 p-4 shadow-[var(--shadow-soft)] backdrop-blur-sm">
                    <p className="text-sm font-semibold text-foreground">{title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{note}</p>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            <MotionCard initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="border-border/70 bg-panel/90 shadow-[var(--shadow-elevated)]">
              <CardHeader>
                <CardTitle className="font-display text-3xl">
                  {authMode === "sign_in" ? "Sign in" : "Create your account"}
                </CardTitle>
                <CardDescription>
                  Phone number + password. The <strong>first account</strong> becomes the <strong>Admin</strong>; later sign-ups are <strong>Teachers</strong>.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Tabs value={authMode} onValueChange={(value) => setAuthMode(value as AuthMode)} className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="sign_in">
                      <LogIn className="h-4 w-4" /> Sign in
                    </TabsTrigger>
                    <TabsTrigger value="sign_up">
                      <ShieldCheck className="h-4 w-4" /> Create account
                    </TabsTrigger>
                  </TabsList>
                </Tabs>

                <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 text-xs text-muted-foreground">
                  <p className="font-medium text-foreground">
                    {authMode === "sign_up"
                      ? "👑 Setting up the school for the first time? Create the Admin account here — it's the very first signup."
                      : "Already registered? Sign in with your phone & password. New here? Switch to Create account."}
                  </p>
                </div>

                <form className="space-y-4" onSubmit={handleAuthSubmit}>
                  {authMode === "sign_up" && (
                    <div className="space-y-2">
                      <Label htmlFor="fullName">Full name</Label>
                      <Input id="fullName" value={authFullName} onChange={(e) => setAuthFullName(e.target.value)} className="bg-background/70" required />
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone number</Label>
                    <Input
                      id="phone"
                      type="tel"
                      inputMode="tel"
                      placeholder="e.g. 9876543210"
                      value={authPhone}
                      onChange={(e) => setAuthPhone(e.target.value)}
                      className="bg-background/70"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input id="password" type="password" value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} className="bg-background/70" required minLength={6} />
                  </div>
                  <Button type="submit" size="lg" className="w-full">
                    {authMode === "sign_in" ? <LogIn className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
                    {isSubmittingAuth ? "Please wait..." : authMode === "sign_in" ? "Sign in" : "Create account"}
                  </Button>
                </form>
              </CardContent>
            </MotionCard>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0 bg-hero-gradient opacity-90" />
      <motion.div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,hsl(var(--primary-glow)/0.24),transparent_32%),radial-gradient(circle_at_bottom_right,hsl(var(--secondary)/0.18),transparent_30%)]"
        animate={{ opacity: [0.75, 1, 0.75] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      />

      {whatsappQueue.length > 0 && (
        <div className="fixed bottom-4 right-4 z-50 w-[min(92vw,360px)] rounded-xl border border-border/70 bg-panel/95 p-4 shadow-[var(--shadow-elevated)] backdrop-blur">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-foreground">WhatsApp queue</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {whatsappQueue.length} message{whatsappQueue.length === 1 ? "" : "s"} pending. Next: <span className="font-medium text-foreground">{whatsappQueue[0]?.name}</span>
              </p>
            </div>
            <Button size="sm" variant="ghost" onClick={clearWhatsappQueue} className="h-7 px-2 text-xs">
              Clear
            </Button>
          </div>
          <Button size="sm" className="mt-3 w-full gap-2" onClick={sendNextInQueue}>
            <Send className="h-4 w-4" />
            Send next ({whatsappQueue.length} left)
          </Button>
          <p className="mt-2 text-[11px] leading-snug text-muted-foreground">
            Browsers only allow opening WhatsApp on a click. Tap the button for each remaining parent.
          </p>
        </div>
      )}

      <main className="relative mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">

        <section className="grid gap-4 lg:grid-cols-[1.2fr,0.8fr]">
          <MotionCard initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="overflow-hidden border-border/60 bg-panel/90 shadow-[var(--shadow-elevated)]">
            <CardHeader className="space-y-6 pb-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-3">
                  <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-muted/80 px-3 py-1 text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">
                    <GraduationCap className="h-3.5 w-3.5" />
                    Attendance Command Center
                  </div>
                  <div className="space-y-2">
                    <CardDescription className="max-w-2xl text-base leading-7 text-muted-foreground">
                      Signed in as {profile?.full_name || "Staff"} · {roles.map((role) => roleLabels[role]).join(", ") || "Teacher"}
                    </CardDescription>
                  </div>
                </div>

                <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:gap-3">
                  {isAdmin && (
                    <Tabs value={activePanel} onValueChange={(value) => setActivePanel(value as ActivePanel)} className="flex-1 sm:flex-none">
                      <TabsList className="grid w-full grid-cols-2 rounded-2xl border border-border/70 bg-background/70 p-1.5 sm:w-auto sm:inline-flex">
                        <TabsTrigger value="teacher" className="rounded-xl px-3 py-2 text-xs sm:px-4 sm:text-sm"><UserSquare2 className="mr-1.5 h-4 w-4" />Teacher</TabsTrigger>
                        <TabsTrigger value="admin" className="rounded-xl px-3 py-2 text-xs sm:px-4 sm:text-sm"><ShieldCheck className="mr-1.5 h-4 w-4" />Admin</TabsTrigger>
                      </TabsList>
                    </Tabs>
                  )}
                  <Button variant="outline" size="sm" onClick={() => void handleLogout()} className="sm:size-default">
                    <LogOut className="h-4 w-4" />
                    Logout
                  </Button>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-2xl border border-border/70 bg-background/65 p-4 shadow-[var(--shadow-soft)]">
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Class</p>
                  <div className="mt-2">
                    <Select value={selectedClassName} onValueChange={(value) => setSelectedClassName(value as (typeof classOptions)[number])}>
                      <SelectTrigger className="border-border/70 bg-muted/60"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {classOptions.map((item) => (
                          <SelectItem key={item} value={item}>Class {item}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="rounded-2xl border border-border/70 bg-background/65 p-4 shadow-[var(--shadow-soft)]">
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Date</p>
                  <Input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="mt-2 border-border/70 bg-muted/60" />
                </div>
                <div className="rounded-2xl border border-border/70 bg-background/65 p-4 shadow-[var(--shadow-soft)]">
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Message mode</p>
                  <div className="mt-2">
                    <Select value={sendMode} onValueChange={(value) => setSendMode(value as NotificationSendMode)}>
                      <SelectTrigger className="border-border/70 bg-muted/60"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {sendModeOptions.map((item) => (
                          <SelectItem key={item} value={item}>{sendModeLabels[item]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="rounded-2xl border border-border/70 bg-background/65 p-4 shadow-[var(--shadow-soft)]">
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Language</p>
                  <div className="mt-2">
                    <Select value={messageLanguage} onValueChange={(value) => setMessageLanguage(value as MessageLanguage)}>
                      <SelectTrigger className="border-border/70 bg-muted/60"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {languageOptions.map((item) => (
                          <SelectItem key={item} value={item}>{languageLabels[item]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </CardHeader>
          </MotionCard>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
            {statCards.map(({ key, title, hint, icon }) => (
              <StatCard key={key} title={title} hint={hint} icon={icon} value={overview[key]} />
            ))}
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.4fr,0.6fr]">
          <div className="space-y-6">
            <Tabs defaultValue="attendance" className="space-y-6">
              <TabsList className="flex h-auto w-full justify-start gap-1.5 overflow-x-auto rounded-2xl border border-border/70 bg-panel/80 p-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <TabsTrigger value="attendance" className="shrink-0 rounded-xl px-3 py-2 text-xs sm:px-4 sm:py-2.5 sm:text-sm">Attendance</TabsTrigger>
                <TabsTrigger value="imports" className="shrink-0 rounded-xl px-3 py-2 text-xs sm:px-4 sm:py-2.5 sm:text-sm">Excel & Sheets</TabsTrigger>
                <TabsTrigger value="results" className="shrink-0 rounded-xl px-3 py-2 text-xs sm:px-4 sm:py-2.5 sm:text-sm">Results</TabsTrigger>
                {isAdmin && <TabsTrigger value="salary" className="shrink-0 rounded-xl px-3 py-2 text-xs sm:px-4 sm:py-2.5 sm:text-sm">Salary</TabsTrigger>}
                <TabsTrigger value="analytics" className="shrink-0 rounded-xl px-3 py-2 text-xs sm:px-4 sm:py-2.5 sm:text-sm">Analytics</TabsTrigger>
              </TabsList>

              <TabsContent value="attendance" className="grid gap-6 xl:grid-cols-[1.35fr,0.95fr]">
                <Card className="border-border/70 bg-panel/88 shadow-[var(--shadow-soft)]">
                  <CardHeader className="gap-4 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <CardTitle className="font-display text-2xl">Teacher panel</CardTitle>
                      <CardDescription>Mark present, absent, leave, or holiday — then save all and send WhatsApp to every parent in one click.</CardDescription>
                    </div>
                    <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by student, roll, or parent" className="max-w-sm border-border/70 bg-background/75" />
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border/70 bg-background/60 p-3">
                      <Button size="sm" onClick={() => void saveAllAttendance()} disabled={savingStudentId === "__bulk__" || !filteredStudents.length}>
                        <Send className="h-4 w-4" />
                        {savingStudentId === "__bulk__" ? "Saving all..." : `Save all (${filteredStudents.length})`}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => sendBulkWhatsApp()} disabled={!filteredStudents.length}>
                        <MessageCircle className="h-4 w-4" />
                        Send WhatsApp to all
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => void handleExportTodayAttendance()}>
                        <Download className="h-4 w-4" />
                        Export today's attendance
                      </Button>
                      <div className="ml-auto flex flex-wrap gap-1.5">
                        {attendanceStatuses.map((status) => (
                          <Button
                            key={status}
                            size="sm"
                            variant="ghost"
                            className="h-8 rounded-full border border-border/60 px-3 text-xs"
                            onClick={() => sendBulkWhatsApp(status)}
                          >
                            <MessageCircle className="h-3.5 w-3.5" />
                            Only {attendanceLabels[status].toLowerCase()}
                          </Button>
                        ))}
                      </div>
                    </div>
                    {loading ? (
                      <div className="rounded-2xl border border-dashed border-border/70 bg-background/40 p-6 text-sm text-muted-foreground">Loading roster…</div>
                    ) : filteredStudents.length ? (
                      filteredStudents.map((student, index) => {
                        const currentStatus = attendanceDrafts[student.id] ?? "present";
                        const attendancePercent = student.analytics?.attendance_percentage ?? 0;
                        return (
                          <motion.div
                            key={student.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.03 }}
                            className="rounded-2xl border border-border/70 bg-background/75 p-3 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[var(--shadow-soft)] sm:p-4"
                          >
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <h3 className="truncate text-base font-semibold text-foreground sm:text-lg">{student.full_name}</h3>
                                <p className="truncate text-xs text-muted-foreground sm:text-sm">Roll {student.roll_number} · {student.parent_name || "Parent pending"}</p>
                              </div>
                              <div className="flex items-center gap-1.5 rounded-full border border-border/70 bg-muted/70 px-2.5 py-1 text-[11px] text-muted-foreground sm:text-xs">
                                <Phone className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                                <span className="truncate max-w-[110px] sm:max-w-none">{student.whatsapp_phone || student.parent_phone}</span>
                              </div>
                            </div>

                            <div className="mt-3 space-y-1.5">
                              <div className="flex items-center justify-between text-xs sm:text-sm">
                                <span className="text-muted-foreground">Attendance</span>
                                <span className={cn("font-medium", attendancePercent < 75 ? "text-danger" : "text-success")}>{formatPercent(attendancePercent)}</span>
                              </div>
                              <Progress value={attendancePercent} className="h-2 bg-muted" />
                            </div>

                            <div className="mt-3 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                              {attendanceStatuses.map((status) => (
                                <button
                                  key={status}
                                  type="button"
                                  onClick={() => setAttendanceDrafts((current) => ({ ...current, [student.id]: status }))}
                                  className={cn(
                                    "rounded-xl border px-2 py-2 text-center text-xs font-medium transition-all duration-200 sm:text-sm",
                                    currentStatus === status
                                      ? "border-primary bg-primary/15 text-foreground shadow-[var(--shadow-soft)]"
                                      : "border-border/70 bg-muted/55 text-muted-foreground hover:border-primary/40 hover:bg-background/80",
                                  )}
                                >
                                  {attendanceLabels[status]}
                                </button>
                              ))}
                            </div>

                            <div className="mt-3 flex flex-wrap gap-2">
                              <Button
                                size="sm"
                                className="flex-1 min-w-[120px]"
                                onClick={() => void markAttendance(student)}
                                disabled={savingStudentId === student.id}
                              >
                                <Send className="h-4 w-4" />
                                {savingStudentId === student.id ? "Saving..." : "Save & queue"}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="flex-1 min-w-[120px]"
                                onClick={() => sendAttendanceWhatsApp(student)}
                              >
                                <MessageCircle className="h-4 w-4" />
                                WhatsApp
                              </Button>
                            </div>
                          </motion.div>
                        );
                      })
                    ) : (
                      <div className="rounded-2xl border border-dashed border-border/70 bg-background/40 p-6 text-sm text-muted-foreground">
                        <p className="font-medium text-foreground">No students in {classLabel} yet.</p>
                        <p className="mt-1">Switch to the <span className="font-medium">Excel & Sheets</span> tab and import the roster for this class. Each class keeps its own students, attendance, and messages.</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="border-border/70 bg-panel/88 shadow-[var(--shadow-soft)]">
                  <CardHeader>
                    <CardTitle className="font-display text-2xl">Daily summary</CardTitle>
                    <CardDescription>Instant class totals for present, absent, leave, and holiday.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        ["Present", dailySummary.present, "success"],
                        ["Absent", dailySummary.absent, "danger"],
                        ["Leave", dailySummary.leave, "warning"],
                        ["Holiday", dailySummary.holiday, "muted"],
                      ].map(([label, value, tone]) => (
                        <div key={label} className={cn("rounded-2xl border p-4", toneStyles[tone as string])}>
                          <p className="text-xs uppercase tracking-[0.16em]">{label}</p>
                          <p className="mt-2 text-2xl font-semibold">{value}</p>
                        </div>
                      ))}
                    </div>
                    <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium">Total students marked</p>
                          <p className="text-sm text-muted-foreground">{classLabel} · {format(new Date(selectedDate), "dd MMM yyyy")}</p>
                        </div>
                        <span className="text-3xl font-semibold">{dailySummary.total}</span>
                      </div>
                    </div>
                    <div className="space-y-2 rounded-2xl border border-border/70 bg-background/70 p-4">
                      <Label htmlFor="staffReportPhone">Staff WhatsApp number</Label>
                      <Input id="staffReportPhone" value={staffReportPhone} onChange={(e) => setStaffReportPhone(e.target.value)} placeholder={profile?.phone || "+91..."} className="bg-background/80" />
                      <Button className="w-full" onClick={() => void handleDailyReportSend()} disabled={sendingDailyReport || activePanel !== "admin"}>
                        <MessageCircle className="h-4 w-4" />
                        {sendingDailyReport ? "Preparing report..." : activePanel === "admin" ? "Send daily report to staff" : "Admin panel required"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-border/70 bg-panel/88 shadow-[var(--shadow-soft)] xl:col-span-2">
                  <CardHeader className="gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <CardTitle className="font-display text-2xl">Parent message template</CardTitle>
                      <CardDescription>
                        Edit the WhatsApp message that goes to parents. Use placeholders <code className="rounded bg-muted px-1">{"{parent}"}</code>, <code className="rounded bg-muted px-1">{"{student}"}</code>, <code className="rounded bg-muted px-1">{"{class}"}</code>, <code className="rounded bg-muted px-1">{"{date}"}</code>, <code className="rounded bg-muted px-1">{"{status}"}</code>, <code className="rounded bg-muted px-1">{"{emoji}"}</code>. Changes are saved automatically for admins and teachers.
                      </CardDescription>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Select value={templateEditStatus} onValueChange={(value) => setTemplateEditStatus(value as AttendanceStatus)}>
                        <SelectTrigger className="w-[140px] border-border/70 bg-muted/60"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {attendanceStatuses.map((status) => (
                            <SelectItem key={status} value={status}>{attendanceLabels[status]}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setMessageTemplates((prev) => ({
                            ...prev,
                            [messageLanguage]: {
                              ...prev[messageLanguage],
                              [templateEditStatus]: defaultMessageTemplates[messageLanguage][templateEditStatus],
                            },
                          }))
                        }
                      >
                        Reset to default
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="grid gap-4 lg:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Template ({languageLabels[messageLanguage]} · {attendanceLabels[templateEditStatus]})</Label>
                      <Textarea
                        rows={10}
                        value={messageTemplates[messageLanguage][templateEditStatus]}
                        onChange={(e) =>
                          setMessageTemplates((prev) => ({
                            ...prev,
                            [messageLanguage]: {
                              ...prev[messageLanguage],
                              [templateEditStatus]: e.target.value,
                            },
                          }))
                        }
                        className="font-mono text-sm"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Live preview</Label>
                      <div className="whitespace-pre-wrap rounded-2xl border border-border/70 bg-background/70 p-4 text-sm leading-relaxed">
                        {buildAttendanceMessage({
                          studentName: filteredStudents[0]?.full_name ?? "Riya Sharma",
                          parentName: filteredStudents[0]?.parent_name ?? "Parent",
                          classLabel,
                          date: format(new Date(selectedDate), "dd MMM yyyy"),
                          status: templateEditStatus,
                          language: messageLanguage,
                          template: messageTemplates[messageLanguage][templateEditStatus],
                        })}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="imports" className="grid gap-6 xl:grid-cols-[1fr,1fr]">
                <Card className="border-border/70 bg-panel/88 shadow-[var(--shadow-soft)]">
                  <CardHeader>
                    <CardTitle className="font-display text-2xl">Student master Excel</CardTitle>
                    <CardDescription>Upload student, parent, phone, roll number, language, and class data.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <label className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-primary/35 bg-primary/8 px-6 py-10 text-center transition-all duration-300 hover:border-primary/60 hover:bg-primary/12">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-background/90 shadow-[var(--shadow-soft)]"><FileSpreadsheet className="h-5 w-5 text-primary" /></div>
                      <div className="space-y-1">
                        <p className="text-base font-medium">Upload student Excel</p>
                        <p className="text-sm text-muted-foreground">Recommended columns: full_name, roll_number, parent_name, parent_phone, whatsapp_phone, class_name</p>
                      </div>
                      <input ref={studentFileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => void handleStudentExcelUpload(e)} />
                    </label>
                    <p className="text-sm text-muted-foreground">{importingStudentFile ? "Reading and syncing student sheet..." : "This upload updates existing students by roll number and adds new ones."}</p>
                    {studentImportPreview.length > 0 && (
                      <div className="space-y-2 rounded-2xl border border-border/70 bg-background/70 p-4">
                        <p className="text-sm font-medium">Preview from {lastImportSheetName}</p>
                        {studentImportPreview.map((row) => (
                          <div key={`${row.roll_number}-${row.full_name}`} className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
                            <span>{row.full_name}</span>
                            <span>Roll {row.roll_number}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="border-border/70 bg-panel/88 shadow-[var(--shadow-soft)]">
                  <CardHeader>
                    <CardTitle className="font-display text-2xl">Attendance Excel</CardTitle>
                    <CardDescription>Upload a daily attendance sheet and sync statuses into the selected class.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <label className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-secondary/55 bg-secondary/30 px-6 py-10 text-center transition-all duration-300 hover:border-secondary hover:bg-secondary/40">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-background/90 shadow-[var(--shadow-soft)]"><Upload className="h-5 w-5 text-primary" /></div>
                      <div className="space-y-1">
                        <p className="text-base font-medium">Upload attendance Excel</p>
                        <p className="text-sm text-muted-foreground">Recommended columns: full_name, roll_number, status, attendance_date, notes</p>
                      </div>
                      <input ref={attendanceFileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => void handleAttendanceExcelUpload(e)} />
                    </label>
                    <p className="text-sm text-muted-foreground">{importingAttendanceFile ? "Reading and syncing attendance sheet..." : "Imported rows update the daily register and the analytics refresh automatically."}</p>
                    {attendanceImportPreview.length > 0 && (
                      <div className="space-y-2 rounded-2xl border border-border/70 bg-background/70 p-4">
                        <p className="text-sm font-medium">Attendance preview</p>
                        {attendanceImportPreview.map((row) => (
                          <div key={`${row.roll_number}-${row.attendance_date}`} className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
                            <span>{row.full_name}</span>
                            <span>{attendanceLabels[row.status]}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="border-border/70 bg-panel/88 shadow-[var(--shadow-soft)] xl:col-span-2">
                  <CardHeader>
                    <CardTitle className="font-display text-2xl">Google Sheet link + import history</CardTitle>
                    <CardDescription>Keep sheet references and review recent import activity.</CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-6 lg:grid-cols-[0.8fr,1.2fr]">
                    <div className="space-y-3">
                      <Input value={sheetLink} onChange={(e) => setSheetLink(e.target.value)} placeholder="Paste Google Sheet link" className="bg-background/75" />
                      <Button onClick={() => void handleGoogleSheetLink()}>
                        <ArrowUpRight className="h-4 w-4" />
                        Save Google Sheet link
                      </Button>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      {imports.length ? (
                        imports.map((item) => (
                          <div key={item.id} className="rounded-2xl border border-border/70 bg-background/70 p-4">
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-sm font-medium text-foreground">{item.source_type === "excel_upload" ? "Excel upload" : "Google Sheet"}</span>
                              <span className={cn("rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]", item.status === "completed" ? toneStyles.success : toneStyles.warning)}>{item.status}</span>
                            </div>
                            <p className="mt-3 text-sm text-muted-foreground">{item.source_name}</p>
                            <p className="mt-2 text-xs text-muted-foreground">Rows imported: {item.rows_imported}</p>
                          </div>
                        ))
                      ) : (
                        <div className="rounded-2xl border border-dashed border-border/70 bg-background/40 p-6 text-sm text-muted-foreground md:col-span-2">No import activity yet.</div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="results" className="grid gap-6 xl:grid-cols-[0.95fr,1.05fr]">
                <Card className="border-border/70 bg-panel/88 shadow-[var(--shadow-soft)]">
                  <CardHeader>
                    <CardTitle className="font-display text-2xl">Upload result PDF</CardTitle>
                    <CardDescription>Store the file once and prepare notification rows for all students in the class.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="examName">Exam name</Label>
                      <Input id="examName" value={examName} onChange={(e) => setExamName(e.target.value)} className="border-border/70 bg-background/75" />
                    </div>
                    <label className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-secondary/55 bg-secondary/30 px-6 py-10 text-center transition-all duration-300 hover:border-secondary hover:bg-secondary/40">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-background/90 shadow-[var(--shadow-soft)]"><Upload className="h-5 w-5 text-primary" /></div>
                      <div className="space-y-1">
                        <p className="text-base font-medium">Upload result PDF</p>
                        <p className="text-sm text-muted-foreground">One PDF can be linked to all students in the selected class.</p>
                      </div>
                      <input ref={resultFileInputRef} type="file" accept="application/pdf" className="hidden" onChange={(e) => void handleResultUpload(e)} />
                    </label>
                    <p className="text-sm text-muted-foreground">{uploadingResult ? "Uploading result and preparing messages..." : "Result delivery is queued immediately using the selected message mode."}</p>
                  </CardContent>
                </Card>

                <Card className="border-border/70 bg-panel/88 shadow-[var(--shadow-soft)]">
                  <CardHeader>
                    <CardTitle className="font-display text-2xl">Result distribution log</CardTitle>
                    <CardDescription>Review uploaded result files and prepared sends.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {results.length ? (
                      results.map((result) => (
                        <div key={result.id} className="rounded-2xl border border-border/70 bg-background/70 p-4">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="text-sm font-medium text-foreground">{result.exam_name}</p>
                              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Stored result record</p>
                            </div>
                            <span className={cn("rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]", result.send_to_parent ? toneStyles.success : toneStyles.muted)}>{result.send_to_parent ? "send ready" : "stored"}</span>
                          </div>
                          <p className="mt-3 text-sm text-muted-foreground">Stored file: {result.storage_path}</p>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-2xl border border-dashed border-border/70 bg-background/40 p-6 text-sm text-muted-foreground">Result uploads will appear here.</div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {isAdmin && <TabsContent value="salary" className="grid gap-6 xl:grid-cols-[0.9fr,1.1fr]">
                <Card className="border-border/70 bg-panel/88 shadow-[var(--shadow-soft)]">
                  <CardHeader>
                    <CardTitle className="font-display text-2xl">Salary distribution</CardTitle>
                    <CardDescription>{isAdmin ? "Create monthly payroll and download staff payslips." : "Your salary records and payslips appear here."}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
                        <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Month total</p>
                        <p className="mt-2 text-xl font-semibold text-foreground">{formatCurrency(payrollOverview.total)}</p>
                      </div>
                      <div className="rounded-2xl border border-success/30 bg-success-soft p-4 text-success">
                        <p className="text-xs uppercase tracking-[0.16em]">Paid</p>
                        <p className="mt-2 text-xl font-semibold">{payrollOverview.paid}</p>
                      </div>
                      <div className="rounded-2xl border border-warning/30 bg-warning-soft p-4 text-warning">
                        <p className="text-xs uppercase tracking-[0.16em]">Pending</p>
                        <p className="mt-2 text-xl font-semibold">{payrollOverview.pending}</p>
                      </div>
                    </div>

                    {isAdmin ? (
                      <form className="space-y-3 rounded-2xl border border-border/70 bg-background/70 p-4" onSubmit={handlePayrollSubmit}>
                        <div className="space-y-2">
                          <Label htmlFor="payrollStaff">Staff member</Label>
                          <Select value={payrollStaffId} onValueChange={setPayrollStaffId}>
                            <SelectTrigger id="payrollStaff" className="bg-background/80"><SelectValue placeholder="Choose staff" /></SelectTrigger>
                            <SelectContent>
                              {staffProfiles.map((staff) => (
                                <SelectItem key={staff.id} value={staff.id}>{staff.full_name || staff.phone || "Staff account"}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="space-y-2">
                            <Label htmlFor="payrollMonth">Payroll month</Label>
                            <Input id="payrollMonth" type="month" value={payrollMonth.slice(0, 7)} onChange={(e) => setPayrollMonth(`${e.target.value}-01`)} className="bg-background/80" />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="payrollStatus">Status</Label>
                            <Select value={payrollStatus} onValueChange={(value) => setPayrollStatus(value as PayrollStatus)}>
                              <SelectTrigger id="payrollStatus" className="bg-background/80"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {Object.entries(payrollStatusLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-3">
                          <Input type="number" min="0" step="1" value={baseSalary} onChange={(e) => setBaseSalary(e.target.value)} placeholder="Base salary" className="bg-background/80" required />
                          <Input type="number" min="0" step="1" value={allowances} onChange={(e) => setAllowances(e.target.value)} placeholder="Allowances" className="bg-background/80" />
                          <Input type="number" min="0" step="1" value={deductions} onChange={(e) => setDeductions(e.target.value)} placeholder="Deductions" className="bg-background/80" />
                        </div>
                        <Input value={payrollNotes} onChange={(e) => setPayrollNotes(e.target.value)} placeholder="Notes, bonus, advance, or payment reference" className="bg-background/80" />
                        <Button type="submit" className="w-full" disabled={savingPayroll || !payrollStaffId}>
                          <IndianRupee className="h-4 w-4" />
                          {savingPayroll ? "Saving salary..." : "Save salary record"}
                        </Button>
                      </form>
                    ) : (
                      <div className="rounded-2xl border border-border/70 bg-background/70 p-4 text-sm text-muted-foreground">Only Admin can create or edit salary records. Staff can download their own payslips.</div>
                    )}
                  </CardContent>
                </Card>

                <Card className="border-border/70 bg-panel/88 shadow-[var(--shadow-soft)]">
                  <CardHeader>
                    <CardTitle className="font-display text-2xl">Payroll ledger</CardTitle>
                    <CardDescription>Monthly salary status with one-click payslip PDF.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {payroll.length ? (
                      payroll.map((item) => (
                        <motion.div key={item.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-border/70 bg-background/70 p-4">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="text-base font-semibold text-foreground">{item.profiles?.full_name || "Staff member"}</p>
                              <p className="text-sm text-muted-foreground">{format(new Date(item.payroll_month), "MMMM yyyy")} · {item.profiles?.phone || "Phone pending"}</p>
                            </div>
                            <span className={cn("rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]", toneStyles[payrollTone[item.status]])}>{payrollStatusLabels[item.status]}</span>
                          </div>
                          <div className="mt-4 grid gap-2 text-sm sm:grid-cols-4">
                            <span className="text-muted-foreground">Base {formatCurrency(item.base_salary)}</span>
                            <span className="text-muted-foreground">Allow {formatCurrency(item.allowances)}</span>
                            <span className="text-muted-foreground">Deduct {formatCurrency(item.deductions)}</span>
                            <span className="font-semibold text-foreground">Net {formatCurrency(item.net_salary)}</span>
                          </div>
                          <div className="mt-4 flex flex-wrap gap-2">
                            <Button variant="outline" size="sm" onClick={() => downloadPayslip(item)}>
                              <Download className="h-4 w-4" />
                              Download
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => editPayrollEntry(item)}>
                              <UserCog className="h-4 w-4" />
                              Edit
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => sharePayslipWhatsApp(item)}>
                              <MessageCircle className="h-4 w-4" />
                              WhatsApp
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => sharePayslipEmail(item)}>
                              <Send className="h-4 w-4" />
                              Email
                            </Button>
                          </div>
                        </motion.div>
                      ))
                    ) : (
                      <div className="rounded-2xl border border-dashed border-border/70 bg-background/40 p-6 text-sm text-muted-foreground">Salary records will appear here after Admin saves payroll.</div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>}

              <TabsContent value="analytics" className="grid gap-6 xl:grid-cols-[1.05fr,0.95fr]">
                <Card className="border-border/70 bg-panel/88 shadow-[var(--shadow-soft)]">
                  <CardHeader>
                    <CardTitle className="font-display text-2xl">Attendance risk monitor</CardTitle>
                    <CardDescription>Students below 75% attendance are highlighted here for faster follow-up.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {riskStudents.length ? (
                      riskStudents.map((student) => (
                        <div key={student.student_id} className="rounded-2xl border border-danger/25 bg-danger-soft p-4">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="text-base font-semibold text-danger">{student.full_name}</p>
                              <p className="text-sm text-danger/80">Roll {student.roll_number} · Class {student.class_name}{student.section ? `-${student.section}` : ""}</p>
                            </div>
                            <span className="rounded-full border border-danger/25 bg-background/70 px-3 py-1 text-sm font-semibold text-danger">{formatPercent(student.attendance_percentage)}</span>
                          </div>
                          <div className="mt-3 space-y-2">
                            <Progress value={student.attendance_percentage ?? 0} className="h-2.5 bg-background/70" />
                            <div className="grid grid-cols-3 gap-2 text-xs text-danger/80">
                              <span>Present: {student.present_days}</span>
                              <span>Absent: {student.absent_days}</span>
                              <span>Leave: {student.leave_days}</span>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-2xl border border-dashed border-border/70 bg-background/40 p-6 text-sm text-muted-foreground">No students are currently below the 75% threshold.</div>
                    )}
                  </CardContent>
                </Card>

                <Card className="border-border/70 bg-panel/88 shadow-[var(--shadow-soft)]">
                  <CardHeader>
                    <CardTitle className="font-display text-2xl">{activePanel === "admin" ? "Admin panel" : "Teacher panel"}</CardTitle>
                    <CardDescription>{activePanel === "admin" ? "Admin-only operational control and summary messaging." : "Teacher-focused workflow and live roster control."}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {(activePanel === "admin"
                      ? [
                          "Admin login unlocks the extra control panel toggle.",
                          "Daily report summary can be sent to staff WhatsApp from this panel.",
                          "All recent imports, result uploads, and queue activity stay visible.",
                          "Teacher accounts can still handle day-to-day attendance and result uploads.",
                        ]
                      : [
                          "Teacher login is focused on quick attendance saving.",
                          "Excel student data and attendance imports remain available.",
                          "Result uploads keep parent communication ready.",
                          "Shortage analytics remain visible for class follow-up.",
                        ]).map((note) => (
                      <div key={note} className="flex items-start gap-3 rounded-2xl border border-border/70 bg-background/70 p-4 text-sm text-muted-foreground">
                        <div className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-accent/70 text-accent-foreground"><Sparkles className="h-3.5 w-3.5" /></div>
                        <p>{note}</p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          <div className="space-y-6">
            <Card className="border-border/70 bg-panel/88 shadow-[var(--shadow-soft)]">
              <CardHeader>
                <CardTitle className="font-display text-2xl">Staff identity</CardTitle>
                <CardDescription>Access changes automatically based on the logged-in role.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-base font-semibold">{profile?.full_name || "Staff user"}</p>
                      <p className="text-sm text-muted-foreground">{profile?.phone || "Logged-in staff account"}</p>
                    </div>
                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-accent/75 text-accent-foreground"><UserCog className="h-5 w-5" /></div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {roles.length ? roles.map((role) => <Badge key={role} variant="secondary">{roleLabels[role]}</Badge>) : <Badge variant="secondary">Teacher</Badge>}
                  </div>
                </div>
                <div className="rounded-2xl border border-border/70 bg-background/70 p-4 text-sm text-muted-foreground">
                  {isAdmin ? "This account can switch between teacher and admin panels." : "This account uses the teacher panel. The first registered account becomes admin automatically."}
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/70 bg-panel/88 shadow-[var(--shadow-soft)]">
              <CardHeader>
                <CardTitle className="font-display text-2xl">Recent message queue</CardTitle>
                <CardDescription>Parent and staff daily report messages appear here.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {notifications.length ? (
                  notifications.map((item) => (
                    <div key={item.id} className="rounded-2xl border border-border/70 bg-background/70 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-foreground">{item.recipient_phone}</p>
                          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{item.notification_type} · {item.send_mode}</p>
                        </div>
                        <span className={cn("rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]", item.delivery_status === "sent" ? toneStyles.success : item.delivery_status === "pending" ? toneStyles.warning : toneStyles.muted)}>{item.delivery_status}</span>
                      </div>
                      <p className="mt-3 text-sm leading-6 text-muted-foreground">{item.message_body}</p>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-border/70 bg-background/40 p-6 text-sm text-muted-foreground">Queued messages will appear after attendance, results, or daily reports are saved.</div>
                )}
              </CardContent>
            </Card>
          </div>
        </section>
      </main>
      <footer className="border-t border-primary/30 bg-gradient-to-r from-background via-primary/10 to-background py-6 mt-10">
        <p className="text-center text-base md:text-lg font-display font-extrabold tracking-wide">
          <span className="text-gray-800">
            © {new Date().getFullYear()} All copyrights reserved by
          </span>{" "}
          <span className="bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 bg-clip-text text-transparent drop-shadow-[0_1px_8px_rgba(251,191,36,0.45)]">
            Analytical Visionary
          </span>{" "}
          <span className="text-gray-800">
            with lots of love
          </span>
        </p>
      </footer>
    </div>
  );
};
