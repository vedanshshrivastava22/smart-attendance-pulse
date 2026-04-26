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

export const buildAttendanceMessage = ({
  studentName,
  parentName,
  classLabel,
  date,
  status,
  language,
}: {
  studentName: string;
  parentName?: string | null;
  classLabel: string;
  date: string;
  status: AttendanceStatus;
  language: MessageLanguage;
}) => {
  const guardian = parentName?.trim() || "Parent";

  const statusEmoji: Record<AttendanceStatus, string> = {
    present: "✅",
    absent: "❌",
    leave: "📝",
    holiday: "🏖️",
  };

  if (language === "hindi") {
    const hindiStatus: Record<AttendanceStatus, string> = {
      present: "उपस्थित",
      absent: "अनुपस्थित",
      leave: "अवकाश पर",
      holiday: "अवकाश दिवस",
    };
    const hindiAction: Record<AttendanceStatus, string> = {
      present: "नियमित उपस्थिति के लिए धन्यवाद। 🙏",
      absent: "कृपया अनुपस्थिति का कारण कक्षा शिक्षक को सूचित करें।",
      leave: "स्वीकृत अवकाश के रूप में दर्ज किया गया है।",
      holiday: "आज विद्यालय अवकाश है।",
    };
    return [
      `नमस्ते ${guardian} जी,`,
      ``,
      `${statusEmoji[status]} ${studentName} (${classLabel}) की ${date} की उपस्थिति: *${hindiStatus[status]}*`,
      ``,
      hindiAction[status],
      ``,
      `— विद्यालय उपस्थिति प्रणाली`,
    ].join("\n");
  }

  const englishAction: Record<AttendanceStatus, string> = {
    present: "Thank you for ensuring regular attendance. 🙏",
    absent: "Please share the reason for absence with the class teacher.",
    leave: "Marked as approved leave.",
    holiday: "School is closed today.",
  };

  return [
    `Hello ${guardian},`,
    ``,
    `${statusEmoji[status]} Attendance update for *${studentName}* (${classLabel}) on ${date}: *${attendanceLabels[status]}*`,
    ``,
    englishAction[status],
    ``,
    `— School Attendance System`,
  ].join("\n");
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
