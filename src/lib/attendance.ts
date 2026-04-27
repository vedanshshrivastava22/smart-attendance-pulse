import type { Database } from "@/integrations/supabase/types";

export const attendanceStatuses = ["present", "absent", "leave", "holiday"] as const;
export const classOptions = ["9", "10", "11", "12"] as const;
export const languageOptions = ["english", "hindi"] as const;
export const sendModeOptions = ["auto", "manual"] as const;

export type AttendanceStatus = Database["public"]["Enums"]["attendance_status"];
export type MessageLanguage = Database["public"]["Enums"]["message_language"];
export type NotificationSendMode = Database["public"]["Enums"]["notification_send_mode"];

export const attendanceLabels: Record<AttendanceStatus, string> = {
  present: "Present",
  absent: "Absent",
  leave: "Leave",
  holiday: "Holiday",
};

export const languageLabels: Record<MessageLanguage, string> = {
  english: "English",
  hindi: "Hindi",
};

export const sendModeLabels: Record<NotificationSendMode, string> = {
  auto: "Auto send",
  manual: "Review first",
};

export const statusTone: Record<AttendanceStatus, string> = {
  present: "success",
  absent: "danger",
  leave: "warning",
  holiday: "muted",
};

export const statusEmoji: Record<AttendanceStatus, string> = {
  present: "✅",
  absent: "❌",
  leave: "📝",
  holiday: "🏖️",
};

export const hindiStatusLabels: Record<AttendanceStatus, string> = {
  present: "उपस्थित",
  absent: "अनुपस्थित",
  leave: "अवकाश पर",
  holiday: "अवकाश दिवस",
};

// Default editable templates. Placeholders: {parent}, {student}, {class}, {date}, {status}, {emoji}
export const defaultMessageTemplates: Record<MessageLanguage, Record<AttendanceStatus, string>> = {
  english: {
    present:
      "Hello {parent},\n\n{emoji} Attendance update for *{student}* ({class}) on {date}: *{status}*\n\nThank you for ensuring regular attendance. 🙏\n\n— School Attendance System",
    absent:
      "Hello {parent},\n\n{emoji} Attendance update for *{student}* ({class}) on {date}: *{status}*\n\nPlease share the reason for absence with the class teacher.\n\n— School Attendance System",
    leave:
      "Hello {parent},\n\n{emoji} Attendance update for *{student}* ({class}) on {date}: *{status}*\n\nMarked as approved leave.\n\n— School Attendance System",
    holiday:
      "Hello {parent},\n\n{emoji} Attendance update for *{student}* ({class}) on {date}: *{status}*\n\nSchool is closed today.\n\n— School Attendance System",
  },
  hindi: {
    present:
      "नमस्ते {parent} जी,\n\n{emoji} {student} ({class}) की {date} की उपस्थिति: *{status}*\n\nनियमित उपस्थिति के लिए धन्यवाद। 🙏\n\n— विद्यालय उपस्थिति प्रणाली",
    absent:
      "नमस्ते {parent} जी,\n\n{emoji} {student} ({class}) की {date} की उपस्थिति: *{status}*\n\nकृपया अनुपस्थिति का कारण कक्षा शिक्षक को सूचित करें।\n\n— विद्यालय उपस्थिति प्रणाली",
    leave:
      "नमस्ते {parent} जी,\n\n{emoji} {student} ({class}) की {date} की उपस्थिति: *{status}*\n\nस्वीकृत अवकाश के रूप में दर्ज किया गया है।\n\n— विद्यालय उपस्थिति प्रणाली",
    holiday:
      "नमस्ते {parent} जी,\n\n{emoji} {student} ({class}) की {date} की उपस्थिति: *{status}*\n\nआज विद्यालय अवकाश है।\n\n— विद्यालय उपस्थिति प्रणाली",
  },
};

export type MessageTemplates = typeof defaultMessageTemplates;

export const buildAttendanceMessage = ({
  studentName,
  parentName,
  classLabel,
  date,
  status,
  language,
  template,
}: {
  studentName: string;
  parentName?: string | null;
  classLabel: string;
  date: string;
  status: AttendanceStatus;
  language: MessageLanguage;
  template?: string;
}) => {
  const guardian = parentName?.trim() || (language === "hindi" ? "अभिभावक" : "Parent");
  const tmpl = template ?? defaultMessageTemplates[language][status];
  const statusLabel = language === "hindi" ? hindiStatusLabels[status] : attendanceLabels[status];
  return tmpl
    .replace(/\{parent\}/g, guardian)
    .replace(/\{student\}/g, studentName)
    .replace(/\{class\}/g, classLabel)
    .replace(/\{date\}/g, date)
    .replace(/\{status\}/g, statusLabel)
    .replace(/\{emoji\}/g, statusEmoji[status]);
};

export const buildResultMessage = ({
  studentName,
  parentName,
  examName,
  classLabel,
  language,
}: {
  studentName: string;
  parentName?: string | null;
  examName: string;
  classLabel: string;
  language: MessageLanguage;
}) => {
  const guardian = parentName?.trim() || "Parent";

  if (language === "hindi") {
    return `नमस्ते ${guardian}, ${studentName} (${classLabel}) का ${examName} परिणाम अपलोड कर दिया गया है और साझा करने के लिए तैयार है।`;
  }

  return `Hello ${guardian}, the ${examName} result for ${studentName} (${classLabel}) has been uploaded and is ready to share.`;
};

export const buildDailyReportMessage = ({
  classLabel,
  date,
  present,
  absent,
  leave,
  holiday,
  total,
  language,
}: {
  classLabel: string;
  date: string;
  present: number;
  absent: number;
  leave: number;
  holiday: number;
  total: number;
  language: MessageLanguage;
}) => {
  if (language === "hindi") {
    return `${date} के लिए ${classLabel} की दैनिक उपस्थिति रिपोर्ट: कुल ${total} छात्र, उपस्थित ${present}, अनुपस्थित ${absent}, अवकाश ${leave}, अवकाश दिवस ${holiday}।`;
  }

  return `Daily attendance report for ${classLabel} on ${date}: total ${total} students, present ${present}, absent ${absent}, leave ${leave}, holiday ${holiday}.`;
};

export const formatPercent = (value?: number | null) => `${Math.round(value ?? 0)}%`;

export const todayDate = () => new Date().toISOString().slice(0, 10);
