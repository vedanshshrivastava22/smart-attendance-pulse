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

  if (language === "hindi") {
    const hindiStatus: Record<AttendanceStatus, string> = {
      present: "उपस्थित",
      absent: "अनुपस्थित",
      leave: "अवकाश",
      holiday: "अवकाश दिवस",
    };

    return `नमस्ते ${guardian}, ${date} को ${classLabel} के छात्र ${studentName} की उपस्थिति स्थिति ${hindiStatus[status]} दर्ज की गई है।`;
  }

  return `Hello ${guardian}, attendance for ${studentName} (${classLabel}) on ${date} has been marked as ${attendanceLabels[status]}.`;
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

export const formatPercent = (value?: number | null) => `${Math.round(value ?? 0)}%`;

export const todayDate = () => new Date().toISOString().slice(0, 10);
