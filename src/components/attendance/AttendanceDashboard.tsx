import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowUpRight,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  FileSpreadsheet,
  GraduationCap,
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
} from "lucide-react";
import { format } from "date-fns";
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
  buildDailyReportMessage,
  buildResultMessage,
  classOptions,
  formatPercent,
  languageLabels,
  languageOptions,
  sendModeLabels,
  sendModeOptions,
  statusTone,
  todayDate,
  type AttendanceStatus,
  type MessageLanguage,
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

type SchoolClass = Database["public"]["Tables"]["school_classes"]["Row"];
type Student = Database["public"]["Tables"]["students"]["Row"];
type AttendanceAnalytics = Database["public"]["Views"]["attendance_analytics"]["Row"];
type NotificationEvent = Database["public"]["Tables"]["notification_events"]["Row"];
type ResultUpload = Database["public"]["Tables"]["result_uploads"]["Row"];
type ExcelImport = Database["public"]["Tables"]["excel_imports"]["Row"];
type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type UserRole = Database["public"]["Tables"]["user_roles"]["Row"];
type StaffRole = Database["public"]["Enums"]["app_role"];
type NotificationType = Database["public"]["Enums"]["notification_type"];
type ImportSourceType = Database["public"]["Enums"]["import_source_type"];

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

type ImportPreviewRow = {
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

const StatCard = ({
  title,
  value,
  hint,
  icon: Icon,
}: {
  title: string;
  value: string;
  hint: string;
  icon: typeof Users;
}) => (
  <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
    <Card className="border-border/70 bg-card/80 backdrop-blur-sm">
      <CardContent className="flex items-start justify-between p-5">
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">{title}</p>
          <p className="text-3xl font-semibold text-foreground">{value}</p>
          <p className="text-sm text-muted-foreground">{hint}</p>
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-accent/70 text-accent-foreground shadow-[var(--shadow-soft)]">
          <Icon className="h-5 w-5" />
        </div>
      </CardContent>
    </Card>
  </motion.div>
);

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

const panelMeta: Record<ActivePanel, { label: string; icon: typeof ShieldCheck; note: string }> = {
  admin: {
    label: "Admin panel",
    icon: ShieldCheck,
    note: "Manage staff visibility, imports, analytics, and daily reporting controls.",
  },
  teacher: {
    label: "Teacher panel",
    icon: UserSquare2,
    note: "Mark attendance quickly, upload results, and trigger daily class summaries.",
  },
};

const readWorkbookRows = async (file: File) => {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
  return { rows, sheetName };
};

const normalizeHeader = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

const normalizePhone = (value: unknown) => String(value ?? "").replace(/[^\d+]/g, "").trim();

const toMessageLanguage = (value: unknown): MessageLanguage => {
  const raw = String(value ?? "").trim().toLowerCase();
  return raw === "hindi" ? "hindi" : "english";
};

const toAttendanceStatus = (value: unknown): AttendanceStatus | null => {
  const raw = String(value ?? "").trim().toLowerCase();
  if (attendanceStatuses.includes(raw as AttendanceStatus)) {
    return raw as AttendanceStatus;
  }
  return null;
};

const normalizeDateInput = (value: unknown, fallback: string) => {
  if (!value) return fallback;
  if (typeof value === "number") {
    const date = XLSX.SSF.parse_date_code(value);
    if (date) {
      return `${date.y}-${String(date.m).padStart(2, "0")}-${String(date.d).padStart(2, "0")}`;
    }
  }

  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) return fallback;
  return parsed.toISOString().slice(0, 10);
};

const mapStudentImportRows = (rows: Record<string, unknown>[], selectedClassName: string): ImportPreviewRow[] => {
  return rows
    .map((row) => {
      const normalized = Object.fromEntries(Object.entries(row).map(([key, value]) => [normalizeHeader(key), value]));
      const full_name = String(normalized.full_name || normalized.student_name || normalized.name || "").trim();
      const roll_number = String(normalized.roll_number || normalized.roll || "").trim();
      const parent_name = String(normalized.parent_name || normalized.guardian_name || "").trim();
      const parent_phone = normalizePhone(normalized.parent_phone || normalized.phone || normalized.guardian_phone);
      const whatsapp_phone = normalizePhone(normalized.whatsapp_phone || normalized.parent_whatsapp || parent_phone);
      const class_name = String(normalized.class_name || normalized.class || selectedClassName).trim() || selectedClassName;
      const admission_number = String(normalized.admission_number || normalized.admission_no || "").trim();
      const notes = String(normalized.notes || "").trim();
      return {
        full_name,
        roll_number,
        parent_name,
        parent_phone,
        whatsapp_phone,
        class_name,
        preferred_language: toMessageLanguage(normalized.preferred_language || normalized.language),
        admission_number,
        notes,
      };
    })
    .filter((row) => row.full_name && row.roll_number && row.parent_phone);
};

const mapAttendanceImportRows = (rows: Record<string, unknown>[], selectedDate: string): AttendanceImportRow[] => {
  return rows
    .map((row) => {
      const normalized = Object.fromEntries(Object.entries(row).map(([key, value]) => [normalizeHeader(key), value]));
      const status = toAttendanceStatus(normalized.status || normalized.attendance_status);
      return {
        full_name: String(normalized.full_name || normalized.student_name || normalized.name || "").trim(),
        roll_number: String(normalized.roll_number || normalized.roll || "").trim(),
        status: status ?? "present",
        attendance_date: normalizeDateInput(normalized.attendance_date || normalized.date, selectedDate),
        notes: String(normalized.notes || "").trim(),
      };
    })
    .filter((row) => row.full_name && row.roll_number);
};

const emptyDailySummary = (): DailySummary => ({ present: 0, absent: 0, leave: 0, holiday: 0, total: 0 });

const deriveDailySummary = (records: Database["public"]["Tables"]["attendance_records"]["Row"][]) => {
  return records.reduce<DailySummary>((acc, item) => {
    acc[item.status] += 1;
    acc.total += 1;
    return acc;
  }, emptyDailySummary());
};

export const AttendanceDashboard = () => {
  const { toast } = useToast();
  const studentFileInputRef = useRef<HTMLInputElement | null>(null);
  const attendanceFileInputRef = useRef<HTMLInputElement | null>(null);
  const resultFileInputRef = useRef<HTMLInputElement | null>(null);

  const [sessionLoading, setSessionLoading] = useState(true);
  const [isSubmittingAuth, setIsSubmittingAuth] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>("sign_in");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authFullName, setAuthFullName] = useState("");
  const [authPhone, setAuthPhone] = useState("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [staffProfile, setStaffProfile] = useState<Profile | null>(null);
  const [staffRoles, setStaffRoles] = useState<StaffRole[]>([]);
  const [activePanel, setActivePanel] = useState<ActivePanel>("teacher");

  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [students, setStudents] = useState<StudentWithAnalytics[]>([]);
  const [analytics, setAnalytics] = useState<AttendanceAnalytics[]>([]);
  const [notifications, setNotifications] = useState<NotificationEvent[]>([]);
  const [imports, setImports] = useState<ExcelImport[]>([]);
  const [results, setResults] = useState<ResultUpload[]>([]);
  const [dailyRecords, setDailyRecords] = useState<Database["public"]["Tables"]["attendance_records"]["Row"][]>([]);

  const [loading, setLoading] = useState(true);
  const [savingStudentId, setSavingStudentId] = useState<string | null>(null);
  const [selectedClassName, setSelectedClassName] = useState<(typeof classOptions)[number]>("9");
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState(todayDate());
  const [search, setSearch] = useState("");
  const [sendMode, setSendMode] = useState<NotificationSendMode>("auto");
  const [messageLanguage, setMessageLanguage] = useState<MessageLanguage>("english");
  const [sheetLink, setSheetLink] = useState("");
  const [examName, setExamName] = useState("Terminal Exam");
  const [staffReportPhone, setStaffReportPhone] = useState("");

  const [importingStudentFile, setImportingStudentFile] = useState(false);
  const [importingAttendanceFile, setImportingAttendanceFile] = useState(false);
  const [uploadingResult, setUploadingResult] = useState(false);
  const [sendingDailyReport, setSendingDailyReport] = useState(false);

  const [attendanceDrafts, setAttendanceDrafts] = useState<Record<string, AttendanceStatus>>({});
  const [studentImportPreview, setStudentImportPreview] = useState<ImportPreviewRow[]>([]);
  const [attendanceImportPreview, setAttendanceImportPreview] = useState<AttendanceImportRow[]>([]);
  const [lastImportSheetName, setLastImportSheetName] = useState("");

  const isAdmin = staffRoles.includes("admin");
  const canManageStaff = isAdmin;
  const canAccessAdmin = isAdmin;

  const selectedClass = useMemo(
    () => classes.find((item) => item.id === selectedClassId) ?? classes.find((item) => item.class_name === selectedClassName),
    [classes, selectedClassId, selectedClassName],
  );

  const classLabel = useMemo(() => {
    return `Class ${selectedClass?.class_name ?? selectedClassName}${selectedClass?.section ? `-${selectedClass.section}` : ""}`;
  }, [selectedClass, selectedClassName]);

  const filteredStudents = useMemo(() => {
    return students.filter((student) => {
      const classMatch = selectedClassId ? student.class_id === selectedClassId : true;
      const textMatch = `${student.full_name} ${student.roll_number} ${student.parent_name ?? ""}`
        .toLowerCase()
        .includes(search.toLowerCase());
      return classMatch && textMatch;
    });
  }, [search, selectedClassId, students]);

  const riskStudents = useMemo(() => {
    return analytics
      .filter((item) => item.class_id === selectedClassId && item.below_75_percent)
      .sort((a, b) => (a.attendance_percentage ?? 0) - (b.attendance_percentage ?? 0));
  }, [analytics, selectedClassId]);

  const dailySummary = useMemo(() => deriveDailySummary(dailyRecords), [dailyRecords]);

  const summary = useMemo(() => {
    const total = filteredStudents.length;
    const atRisk = riskStudents.length;
    const sentCount = notifications.filter((item) => item.delivery_status === "sent").length;
    const avgAttendance = filteredStudents.length
      ? filteredStudents.reduce((acc, student) => acc + (student.analytics?.attendance_percentage ?? 0), 0) / filteredStudents.length
      : 0;

    return { total, atRisk, sentCount, avgAttendance };
  }, [filteredStudents, notifications, riskStudents]);

  useEffect(() => {
    const bootstrapAuth = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const userId = session?.user?.id ?? null;
      setCurrentUserId(userId);
      setSessionLoading(false);
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setCurrentUserId(session?.user?.id ?? null);
      setSessionLoading(false);
    });

    void bootstrapAuth();

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!currentUserId) {
      setStaffProfile(null);
      setStaffRoles([]);
      setClasses([]);
      setStudents([]);
      setAnalytics([]);
      setNotifications([]);
      setImports([]);
      setResults([]);
      setDailyRecords([]);
      setLoading(false);
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

    const relevantStudents = students.filter((student) => student.class_id === selectedClassId);
    setAttendanceDrafts((current) => {
      const next = { ...current };
      for (const student of relevantStudents) {
        if (!next[student.id]) {
          next[student.id] = "present";
        }
      }
      return next;
    });
  }, [selectedClassId, students]);

  useEffect(() => {
    if (canAccessAdmin) {
      setActivePanel((current) => current);
    } else {
      setActivePanel("teacher");
    }
  }, [canAccessAdmin]);

  const loadDashboard = async (userId: string) => {
    setLoading(true);

    const [profileRes, rolesRes, classesRes, studentsRes, analyticsRes, notificationsRes, importsRes, resultsRes, dailyRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("user_id", userId).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", userId),
      supabase.from("school_classes").select("*").order("class_name"),
      supabase.from("students").select("*").order("roll_number"),
      supabase.from("attendance_analytics").select("*"),
      supabase.from("notification_events").select("*").order("created_at", { ascending: false }).limit(12),
      supabase.from("excel_imports").select("*").order("created_at", { ascending: false }).limit(12),
      supabase.from("result_uploads").select("*").order("created_at", { ascending: false }).limit(12),
      supabase
        .from("attendance_records")
        .select("*")
        .eq("class_id", selectedClassId || "00000000-0000-0000-0000-000000000000")
        .eq("attendance_date", selectedDate),
    ]);

    const errors = [profileRes.error, rolesRes.error, classesRes.error, studentsRes.error, analyticsRes.error, notificationsRes.error, importsRes.error, resultsRes.error, dailyRes.error].filter(Boolean);

    if (errors.length) {
      toast({
        title: "Could not load dashboard",
        description: errors[0]?.message ?? "Please try again.",
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    const analyticsMap = new Map((analyticsRes.data ?? []).map((row) => [row.student_id, row]));
    const studentRows = (studentsRes.data ?? []).map((student) => ({ ...student, analytics: analyticsMap.get(student.id) ?? null }));
    const roles = (rolesRes.data ?? []).map((row) => row.role);

    setStaffProfile(profileRes.data ?? null);
    setStaffRoles(roles.length ? roles : ["moderator"]);
    setClasses(classesRes.data ?? []);
    setStudents(studentRows);
    setAnalytics(analyticsRes.data ?? []);
    setNotifications(notificationsRes.data ?? []);
    setImports(importsRes.data ?? []);
    setResults(resultsRes.data ?? []);
    setDailyRecords(dailyRes.data ?? []);
    setLoading(false);
  };

  const refreshDailyRecords = async (classId: string, date: string) => {
    if (!currentUserId) return;
    const { data, error } = await supabase.from("attendance_records").select("*").eq("class_id", classId).eq("attendance_date", date);
    if (!error) {
      setDailyRecords(data ?? []);
    }
  };

  const handleAuthSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmittingAuth(true);

    try {
      if (authMode === "sign_up") {
        const { error } = await supabase.auth.signUp({
          email: authEmail,
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

        toast({
          title: "Staff account created",
          description: "Check the email inbox to verify the account before signing in.",
        });
        setAuthMode("sign_in");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: authEmail,
          password: authPassword,
        });

        if (error) throw error;

        toast({ title: "Signed in", description: "Welcome back to the attendance control center." });
      }
    } catch (error) {
      toast({
        title: authMode === "sign_up" ? "Could not create staff account" : "Could not sign in",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmittingAuth(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast({ title: "Signed out", description: "Staff session closed successfully." });
  };
  const filteredStudents = useMemo(() => {
    return students.filter((student) => {
      const classMatch = selectedClassId ? student.class_id === selectedClassId : true;
      const textMatch = `${student.full_name} ${student.roll_number} ${student.parent_name ?? ""}`
        .toLowerCase()
        .includes(search.toLowerCase());
      return classMatch && textMatch;
    });
  }, [search, selectedClassId, students]);

  const riskStudents = useMemo(() => {
    return analytics
      .filter((item) => item.class_id === selectedClassId && item.below_75_percent)
      .sort((a, b) => (a.attendance_percentage ?? 0) - (b.attendance_percentage ?? 0));
  }, [analytics, selectedClassId]);

  const summary = useMemo(() => {
    const total = filteredStudents.length;
    const atRisk = riskStudents.length;
    const sentCount = notifications.filter((item) => item.delivery_status === "sent").length;
    const avgAttendance = filteredStudents.length
      ? filteredStudents.reduce((acc, student) => acc + (student.analytics?.attendance_percentage ?? 0), 0) / filteredStudents.length
      : 0;

    return { total, atRisk, sentCount, avgAttendance };
  }, [filteredStudents, notifications, riskStudents]);

  const markAttendance = async (student: StudentWithAnalytics) => {
    if (!selectedClassId) return;

    const status = attendanceDrafts[student.id] ?? "present";
    const classLabel = `Class ${selectedClass?.class_name ?? ""}${selectedClass?.section ? `-${selectedClass.section}` : ""}`;
    const message = buildAttendanceMessage({
      studentName: student.full_name,
      parentName: student.parent_name,
      classLabel,
      date: format(new Date(selectedDate), "dd MMM yyyy"),
      status,
      language: messageLanguage,
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
      toast({
        title: "Attendance not saved",
        description: attendanceError?.message ?? "Try again after signing in as staff.",
        variant: "destructive",
      });
      setSavingStudentId(null);
      return;
    }

    const statusForNotification = sendMode === "auto" ? "sent" : "pending";
    const providerResponse =
      sendMode === "auto"
        ? { mode: "demo", note: "Twilio/WhatsApp connector not linked yet" }
        : { mode: "manual_review" };

    const { error: notificationError } = await supabase.from("notification_events").insert({
      student_id: student.id,
      attendance_record_id: record.id,
      notification_type: "attendance",
      send_mode: sendMode,
      message_language: messageLanguage,
      recipient_phone: student.whatsapp_phone || student.parent_phone,
      message_body: message,
      delivery_status: statusForNotification,
      sent_at: sendMode === "auto" ? new Date().toISOString() : null,
      provider_response: providerResponse,
    });

    if (notificationError) {
      toast({
        title: "Attendance saved, message queue failed",
        description: notificationError.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: `${attendanceLabels[status]} marked for ${student.full_name}`,
        description: sendMode === "auto" ? "Parent notification added to auto-send queue." : "Parent message saved for review.",
      });
    }

    await loadDashboard();
    setSavingStudentId(null);
  };

  const handleImportUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !selectedClassId) return;

    setImportingFile(true);
    const ext = file.name.split(".").pop() ?? "xlsx";
    const path = `${selectedClassId}/${Date.now()}-${file.name.replace(/\s+/g, "-")}`;

    const { error: uploadError } = await supabase.storage.from("attendance-imports").upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type || `application/${ext}`,
    });

    if (uploadError) {
      toast({ title: "Import upload failed", description: uploadError.message, variant: "destructive" });
      setImportingFile(false);
      return;
    }

    const { error: dbError } = await supabase.from("excel_imports").insert({
      class_id: selectedClassId,
      source_name: file.name,
      source_type: "excel_upload",
      storage_path: path,
      status: "completed",
      rows_imported: 0,
      summary: { note: "File uploaded. Parser/backend sync can be added next." },
    });

    if (dbError) {
      toast({ title: "Import logged with error", description: dbError.message, variant: "destructive" });
    } else {
      toast({ title: "Excel uploaded", description: "The file is stored and ready for import processing." });
      await loadDashboard();
    }

    event.target.value = "";
    setImportingFile(false);
  };

  const handleGoogleSheetLink = async () => {
    if (!sheetLink.trim() || !selectedClassId) return;

    const { error } = await supabase.from("excel_imports").insert({
      class_id: selectedClassId,
      source_name: sheetLink,
      source_type: "google_sheet",
      spreadsheet_id: sheetLink,
      status: "pending",
      summary: { note: "Sheet link saved. Live sync connector can be linked next." },
    });

    if (error) {
      toast({ title: "Sheet link not saved", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: "Google Sheet link saved", description: "Connector-based sync can be added in the next step." });
    setSheetLink("");
    await loadDashboard();
  };

  const handleResultUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !selectedClassId) return;

    setUploadingResult(true);
    const path = `${selectedClassId}/${Date.now()}-${file.name.replace(/\s+/g, "-")}`;

    const { error: uploadError } = await supabase.storage.from("student-results").upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type || "application/pdf",
    });

    if (uploadError) {
      toast({ title: "Result upload failed", description: uploadError.message, variant: "destructive" });
      setUploadingResult(false);
      return;
    }

    const classStudents = students.filter((student) => student.class_id === selectedClassId);
    const resultRows = classStudents.map((student) => ({
      class_id: selectedClassId,
      student_id: student.id,
      exam_name: examName,
      storage_path: path,
      send_to_parent: true,
    }));

    const { data: insertedResults, error: insertError } = await supabase.from("result_uploads").insert(resultRows).select();

    if (insertError) {
      toast({ title: "Result metadata failed", description: insertError.message, variant: "destructive" });
      setUploadingResult(false);
      return;
    }

    if (insertedResults?.length) {
      const notificationsPayload = insertedResults.map((row) => {
        const student = classStudents.find((entry) => entry.id === row.student_id);
        return {
          student_id: row.student_id,
          result_upload_id: row.id,
          notification_type: "result" as const,
          send_mode: sendMode,
          message_language: messageLanguage,
          recipient_phone: student?.whatsapp_phone || student?.parent_phone || "",
          message_body: buildResultMessage({
            studentName: student?.full_name ?? "Student",
            parentName: student?.parent_name,
            examName,
            classLabel: `Class ${selectedClass?.class_name ?? ""}${selectedClass?.section ? `-${selectedClass.section}` : ""}`,
            language: messageLanguage,
          }),
          delivery_status: sendMode === "auto" ? ("sent" as const) : ("pending" as const),
          sent_at: sendMode === "auto" ? new Date().toISOString() : null,
          provider_response: sendMode === "auto" ? { mode: "demo", note: "Connector required for live WhatsApp" } : { mode: "manual_review" },
        };
      }).filter((item) => item.recipient_phone);

      if (notificationsPayload.length) {
        await supabase.from("notification_events").insert(notificationsPayload);
      }
    }

    toast({ title: "Results uploaded", description: "Result PDFs were stored and parent notifications were prepared." });
    event.target.value = "";
    setUploadingResult(false);
    await loadDashboard();
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0 bg-hero-gradient opacity-90" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,hsl(var(--primary-glow)/0.22),transparent_34%),radial-gradient(circle_at_bottom_right,hsl(var(--secondary)/0.18),transparent_28%)]" />

      <main className="relative mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <section className="grid gap-4 lg:grid-cols-[1.25fr,0.75fr]">
          <Card className="overflow-hidden border-border/60 bg-panel/90 shadow-[var(--shadow-elevated)]">
            <CardHeader className="space-y-6 pb-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-3">
                  <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-muted/80 px-3 py-1 text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">
                    <GraduationCap className="h-3.5 w-3.5" />
                    Attendance Automation Hub
                  </div>
                  <div className="space-y-2">
                    <CardTitle className="max-w-2xl font-display text-4xl leading-tight text-foreground sm:text-5xl">
                      Class-wise attendance, parent alerts, results, and shortage analytics.
                    </CardTitle>
                    <CardDescription className="max-w-2xl text-base leading-7 text-muted-foreground">
                      Built for Classes 9–12 with Excel uploads, Google Sheet links, WhatsApp-ready parent messaging, and instant below-75% attendance visibility.
                    </CardDescription>
                  </div>
                </div>

                <div className="rounded-2xl border border-border/70 bg-background/70 p-3 shadow-[var(--shadow-soft)] backdrop-blur-sm">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Class</p>
                      <Select value={selectedClassName} onValueChange={(value) => setSelectedClassName(value as (typeof classOptions)[number])}>
                        <SelectTrigger className="border-border/70 bg-muted/60">
                          <SelectValue placeholder="Select class" />
                        </SelectTrigger>
                        <SelectContent>
                          {classOptions.map((className) => (
                            <SelectItem key={className} value={className}>
                              Class {className}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Date</p>
                      <Input type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} className="border-border/70 bg-muted/60" />
                    </div>
                    <div className="space-y-2">
                      <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Parent message</p>
                      <Select value={sendMode} onValueChange={(value) => setSendMode(value as NotificationSendMode)}>
                        <SelectTrigger className="border-border/70 bg-muted/60">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {sendModeOptions.map((mode) => (
                            <SelectItem key={mode} value={mode}>
                              {sendModeLabels[mode]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Language</p>
                      <Select value={messageLanguage} onValueChange={(value) => setMessageLanguage(value as MessageLanguage)}>
                        <SelectTrigger className="border-border/70 bg-muted/60">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {languageOptions.map((language) => (
                            <SelectItem key={language} value={language}>
                              {languageLabels[language]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="flex items-center gap-3 rounded-2xl border border-border/70 bg-background/60 px-4 py-3 shadow-[var(--shadow-soft)]">
                  <CalendarDays className="h-4 w-4 text-primary" />
                  <div>
                    <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Today</p>
                    <p className="text-sm font-medium text-foreground">{format(new Date(selectedDate), "dd MMM yyyy")}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-2xl border border-border/70 bg-background/60 px-4 py-3 shadow-[var(--shadow-soft)]">
                  <MessageCircle className="h-4 w-4 text-primary" />
                  <div>
                    <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Messaging mode</p>
                    <p className="text-sm font-medium text-foreground">{sendModeLabels[sendMode]}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-2xl border border-border/70 bg-background/60 px-4 py-3 shadow-[var(--shadow-soft)]">
                  <BarChart3 className="h-4 w-4 text-primary" />
                  <div>
                    <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Risk threshold</p>
                    <p className="text-sm font-medium text-foreground">Below 75% attendance</p>
                  </div>
                </div>
              </div>
            </CardHeader>
          </Card>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
            <StatCard title="Students in class" value={String(summary.total)} hint="Filtered by selected class" icon={Users} />
            <StatCard title="Average attendance" value={formatPercent(summary.avgAttendance)} hint="Across selected students" icon={CheckCircle2} />
            <StatCard title="Below 75%" value={String(summary.atRisk)} hint="Needs parent/staff attention" icon={AlertCircle} />
            <StatCard title="Messages logged" value={String(summary.sentCount)} hint="Auto/manual queues combined" icon={Send} />
          </div>
        </section>

        <Tabs defaultValue="attendance" className="space-y-6">
          <TabsList className="h-auto w-full justify-start gap-2 rounded-2xl border border-border/70 bg-panel/80 p-2">
            <TabsTrigger value="attendance" className="rounded-xl px-4 py-2.5 data-[state=active]:bg-background data-[state=active]:shadow-[var(--shadow-soft)]">Attendance</TabsTrigger>
            <TabsTrigger value="imports" className="rounded-xl px-4 py-2.5 data-[state=active]:bg-background data-[state=active]:shadow-[var(--shadow-soft)]">Excel & Sheets</TabsTrigger>
            <TabsTrigger value="results" className="rounded-xl px-4 py-2.5 data-[state=active]:bg-background data-[state=active]:shadow-[var(--shadow-soft)]">Results</TabsTrigger>
            <TabsTrigger value="analytics" className="rounded-xl px-4 py-2.5 data-[state=active]:bg-background data-[state=active]:shadow-[var(--shadow-soft)]">Analytics</TabsTrigger>
          </TabsList>

          <TabsContent value="attendance" className="grid gap-6 xl:grid-cols-[1.45fr,0.85fr]">
            <Card className="border-border/70 bg-panel/88 shadow-[var(--shadow-soft)]">
              <CardHeader className="gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <CardTitle className="font-display text-2xl">Mark attendance</CardTitle>
                  <CardDescription>Switch between classes 9, 10, 11, and 12, then save status and parent notification in one flow.</CardDescription>
                </div>
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search by student, roll no, or parent"
                  className="max-w-sm border-border/70 bg-background/75"
                />
              </CardHeader>
              <CardContent className="space-y-3">
                {loading ? (
                  <div className="rounded-2xl border border-dashed border-border/70 bg-background/40 p-6 text-sm text-muted-foreground">Loading class roster…</div>
                ) : filteredStudents.length ? (
                  filteredStudents.map((student) => {
                    const currentStatus = attendanceDrafts[student.id] ?? "present";
                    const attendancePercent = student.analytics?.attendance_percentage ?? 0;
                    return (
                      <div
                        key={student.id}
                        className="group grid gap-4 rounded-2xl border border-border/70 bg-background/75 p-4 transition-transform duration-300 hover:-translate-y-0.5 hover:shadow-[var(--shadow-soft)] lg:grid-cols-[1.2fr,0.9fr,auto]"
                      >
                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <h3 className="text-lg font-semibold text-foreground">{student.full_name}</h3>
                              <p className="text-sm text-muted-foreground">Roll {student.roll_number} · {student.parent_name || "Parent name pending"}</p>
                            </div>
                            <div className="flex items-center gap-2 rounded-full border border-border/70 bg-muted/70 px-3 py-1 text-xs text-muted-foreground">
                              <Phone className="h-3.5 w-3.5" />
                              {student.whatsapp_phone || student.parent_phone}
                            </div>
                          </div>
                          <div className="space-y-2">
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">Attendance strength</span>
                              <span className={cn("font-medium", attendancePercent < 75 ? "text-danger" : "text-success")}>{formatPercent(attendancePercent)}</span>
                            </div>
                            <Progress value={attendancePercent} className="h-2.5 bg-muted" />
                          </div>
                        </div>

                        <div className="grid gap-2 sm:grid-cols-2">
                          {attendanceStatuses.map((status) => (
                            <button
                              key={status}
                              type="button"
                              onClick={() => setAttendanceDrafts((current) => ({ ...current, [student.id]: status }))}
                              className={cn(
                                "rounded-2xl border px-4 py-3 text-left transition-all duration-300",
                                currentStatus === status
                                  ? "border-primary bg-primary/12 text-foreground shadow-[var(--shadow-soft)]"
                                  : "border-border/70 bg-muted/55 text-muted-foreground hover:border-primary/30 hover:bg-background/80",
                              )}
                            >
                              <div className="flex items-center justify-between gap-3">
                                <span className="font-medium">{attendanceLabels[status]}</span>
                                <span className={cn("rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]", toneStyles[statusTone[status]])}>
                                  {status}
                                </span>
                              </div>
                            </button>
                          ))}
                        </div>

                        <div className="flex items-center justify-end">
                          <Button size="lg" onClick={() => void markAttendance(student)} disabled={savingStudentId === student.id}>
                            <Send className="h-4 w-4" />
                            {savingStudentId === student.id ? "Saving..." : "Save"}
                          </Button>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="rounded-2xl border border-dashed border-border/70 bg-background/40 p-6 text-sm text-muted-foreground">
                    No students are available yet for this class. Upload Excel data or add students through the backend tables.
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-border/70 bg-panel/88 shadow-[var(--shadow-soft)]">
              <CardHeader>
                <CardTitle className="font-display text-2xl">Recent parent messages</CardTitle>
                <CardDescription>Auto-send writes a sent demo event now; connect Twilio/WhatsApp later for live delivery.</CardDescription>
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
                        <span className={cn("rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]", item.delivery_status === "sent" ? toneStyles.success : item.delivery_status === "pending" ? toneStyles.warning : toneStyles.muted)}>
                          {item.delivery_status}
                        </span>
                      </div>
                      <p className="mt-3 text-sm leading-6 text-muted-foreground">{item.message_body}</p>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-border/70 bg-background/40 p-6 text-sm text-muted-foreground">
                    Message history will appear here after you save attendance or upload results.
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="imports" className="grid gap-6 xl:grid-cols-[1.05fr,0.95fr]">
            <Card className="border-border/70 bg-panel/88 shadow-[var(--shadow-soft)]">
              <CardHeader>
                <CardTitle className="font-display text-2xl">Excel upload</CardTitle>
                <CardDescription>Store the class sheet in the backend so it can be processed into the attendance roster.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <label className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-primary/35 bg-primary/8 px-6 py-10 text-center transition-all duration-300 hover:border-primary/60 hover:bg-primary/12">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-background/90 shadow-[var(--shadow-soft)]">
                    <FileSpreadsheet className="h-5 w-5 text-primary" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-base font-medium text-foreground">Upload class Excel</p>
                    <p className="text-sm text-muted-foreground">Supports .xlsx or .xls for roster/attendance imports</p>
                  </div>
                  <input type="file" accept=".xlsx,.xls" className="hidden" onChange={(event) => void handleImportUpload(event)} />
                </label>
                <p className="text-sm text-muted-foreground">{importingFile ? "Uploading file…" : "The first version stores the file and logs the import task for processing."}</p>
              </CardContent>
            </Card>

            <Card className="border-border/70 bg-panel/88 shadow-[var(--shadow-soft)]">
              <CardHeader>
                <CardTitle className="font-display text-2xl">Google Sheet link</CardTitle>
                <CardDescription>Save a sheet URL now; live sync can be connected next with the Sheets connector.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input
                  placeholder="Paste Google Sheet link"
                  value={sheetLink}
                  onChange={(event) => setSheetLink(event.target.value)}
                  className="border-border/70 bg-background/75"
                />
                <Button onClick={() => void handleGoogleSheetLink()}>
                  <ArrowUpRight className="h-4 w-4" />
                  Save sheet link
                </Button>
              </CardContent>
            </Card>

            <Card className="border-border/70 bg-panel/88 shadow-[var(--shadow-soft)] xl:col-span-2">
              <CardHeader>
                <CardTitle className="font-display text-2xl">Import activity</CardTitle>
                <CardDescription>Track uploaded Excel files and saved Google Sheet references by class.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {imports.length ? (
                  imports.map((item) => (
                    <div key={item.id} className="rounded-2xl border border-border/70 bg-background/70 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm font-medium text-foreground">{item.source_type === "excel_upload" ? "Excel upload" : "Google Sheet"}</span>
                        <span className={cn("rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]", item.status === "completed" ? toneStyles.success : toneStyles.warning)}>
                          {item.status}
                        </span>
                      </div>
                      <p className="mt-3 text-sm text-muted-foreground">{item.source_name}</p>
                      <p className="mt-2 text-xs text-muted-foreground">Rows imported: {item.rows_imported}</p>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-border/70 bg-background/40 p-6 text-sm text-muted-foreground xl:col-span-3">
                    No import jobs yet.
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="results" className="grid gap-6 xl:grid-cols-[0.95fr,1.05fr]">
            <Card className="border-border/70 bg-panel/88 shadow-[var(--shadow-soft)]">
              <CardHeader>
                <CardTitle className="font-display text-2xl">Upload result PDF</CardTitle>
                <CardDescription>Upload a class result sheet and prepare parent notifications instantly.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Exam name</p>
                  <Input value={examName} onChange={(event) => setExamName(event.target.value)} className="border-border/70 bg-background/75" />
                </div>
                <label className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-secondary/55 bg-secondary/30 px-6 py-10 text-center transition-all duration-300 hover:border-secondary hover:bg-secondary/40">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-background/90 shadow-[var(--shadow-soft)]">
                    <Upload className="h-5 w-5 text-primary" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-base font-medium text-foreground">Upload result PDF</p>
                    <p className="text-sm text-muted-foreground">One PDF can be linked to all students in the selected class.</p>
                  </div>
                  <input type="file" accept="application/pdf" className="hidden" onChange={(event) => void handleResultUpload(event)} />
                </label>
                <p className="text-sm text-muted-foreground">{uploadingResult ? "Uploading result and preparing messages…" : "Parents receive a queue entry immediately; live WhatsApp sending can be activated once the connector is linked."}</p>
              </CardContent>
            </Card>

            <Card className="border-border/70 bg-panel/88 shadow-[var(--shadow-soft)]">
              <CardHeader>
                <CardTitle className="font-display text-2xl">Result distribution log</CardTitle>
                <CardDescription>See which classes have uploaded result files and pending parent sends.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {results.length ? (
                  results.map((result) => (
                    <div key={result.id} className="rounded-2xl border border-border/70 bg-background/70 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-foreground">{result.exam_name}</p>
                          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Class result record</p>
                        </div>
                        <span className={cn("rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]", result.send_to_parent ? toneStyles.success : toneStyles.muted)}>
                          {result.send_to_parent ? "send ready" : "stored"}
                        </span>
                      </div>
                      <p className="mt-3 text-sm text-muted-foreground">Stored file: {result.storage_path}</p>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-border/70 bg-background/40 p-6 text-sm text-muted-foreground">
                    Result uploads will appear here.
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="analytics" className="grid gap-6 xl:grid-cols-[1.05fr,0.95fr]">
            <Card className="border-border/70 bg-panel/88 shadow-[var(--shadow-soft)]">
              <CardHeader>
                <CardTitle className="font-display text-2xl">Attendance risk monitor</CardTitle>
                <CardDescription>Students below 75% attendance are grouped here for intervention and parent follow-up.</CardDescription>
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
                        <span className="rounded-full border border-danger/25 bg-background/70 px-3 py-1 text-sm font-semibold text-danger">
                          {formatPercent(student.attendance_percentage)}
                        </span>
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
                  <div className="rounded-2xl border border-dashed border-border/70 bg-background/40 p-6 text-sm text-muted-foreground">
                    No students are below the 75% threshold in the selected class yet.
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-border/70 bg-panel/88 shadow-[var(--shadow-soft)]">
              <CardHeader>
                <CardTitle className="font-display text-2xl">Operational notes</CardTitle>
                <CardDescription>What is live in this first version and what is ready for the next iteration.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  "Class selection for 9, 10, 11, and 12 is live.",
                  "Attendance status save is live in the backend.",
                  "Parent messages are generated in English and Hindi.",
                  "Excel/result files are stored securely in the backend.",
                  "Live WhatsApp delivery needs the Twilio connector to be linked.",
                  "Google Sheet live sync is ready for connector wiring next.",
                ].map((note) => (
                  <div key={note} className="flex items-start gap-3 rounded-2xl border border-border/70 bg-background/70 p-4 text-sm text-muted-foreground">
                    <div className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-accent/70 text-accent-foreground">
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    </div>
                    <p>{note}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};
