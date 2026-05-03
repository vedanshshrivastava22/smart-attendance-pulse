export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      attendance_records: {
        Row: {
          attendance_date: string
          class_id: string
          created_at: string
          id: string
          marked_at: string
          marked_by: string | null
          notes: string | null
          status: Database["public"]["Enums"]["attendance_status"]
          student_id: string
          updated_at: string
        }
        Insert: {
          attendance_date: string
          class_id: string
          created_at?: string
          id?: string
          marked_at?: string
          marked_by?: string | null
          notes?: string | null
          status: Database["public"]["Enums"]["attendance_status"]
          student_id: string
          updated_at?: string
        }
        Update: {
          attendance_date?: string
          class_id?: string
          created_at?: string
          id?: string
          marked_at?: string
          marked_by?: string | null
          notes?: string | null
          status?: Database["public"]["Enums"]["attendance_status"]
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_records_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "attendance_analytics"
            referencedColumns: ["class_id"]
          },
          {
            foreignKeyName: "attendance_records_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "school_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "attendance_analytics"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "attendance_records_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      excel_imports: {
        Row: {
          class_id: string | null
          created_at: string
          id: string
          rows_imported: number
          source_name: string
          source_type: Database["public"]["Enums"]["import_source_type"]
          spreadsheet_id: string | null
          status: Database["public"]["Enums"]["import_status"]
          storage_path: string | null
          summary: Json
          updated_at: string
          worksheet_name: string | null
        }
        Insert: {
          class_id?: string | null
          created_at?: string
          id?: string
          rows_imported?: number
          source_name: string
          source_type: Database["public"]["Enums"]["import_source_type"]
          spreadsheet_id?: string | null
          status?: Database["public"]["Enums"]["import_status"]
          storage_path?: string | null
          summary?: Json
          updated_at?: string
          worksheet_name?: string | null
        }
        Update: {
          class_id?: string | null
          created_at?: string
          id?: string
          rows_imported?: number
          source_name?: string
          source_type?: Database["public"]["Enums"]["import_source_type"]
          spreadsheet_id?: string | null
          status?: Database["public"]["Enums"]["import_status"]
          storage_path?: string | null
          summary?: Json
          updated_at?: string
          worksheet_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "excel_imports_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "attendance_analytics"
            referencedColumns: ["class_id"]
          },
          {
            foreignKeyName: "excel_imports_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "school_classes"
            referencedColumns: ["id"]
          },
        ]
      }
      message_templates: {
        Row: {
          attendance_status: Database["public"]["Enums"]["attendance_status"]
          created_at: string
          id: string
          message_language: Database["public"]["Enums"]["message_language"]
          template_body: string
          updated_at: string
          user_id: string
        }
        Insert: {
          attendance_status: Database["public"]["Enums"]["attendance_status"]
          created_at?: string
          id?: string
          message_language: Database["public"]["Enums"]["message_language"]
          template_body: string
          updated_at?: string
          user_id: string
        }
        Update: {
          attendance_status?: Database["public"]["Enums"]["attendance_status"]
          created_at?: string
          id?: string
          message_language?: Database["public"]["Enums"]["message_language"]
          template_body?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notification_events: {
        Row: {
          attendance_record_id: string | null
          class_id: string | null
          created_at: string
          delivery_status: Database["public"]["Enums"]["notification_delivery_status"]
          id: string
          message_body: string | null
          message_language: Database["public"]["Enums"]["message_language"]
          notification_type: Database["public"]["Enums"]["notification_type"]
          provider_message_id: string | null
          provider_response: Json
          recipient_phone: string
          report_date: string | null
          result_upload_id: string | null
          send_mode: Database["public"]["Enums"]["notification_send_mode"]
          sent_at: string | null
          student_id: string | null
          summary: Json
          updated_at: string
        }
        Insert: {
          attendance_record_id?: string | null
          class_id?: string | null
          created_at?: string
          delivery_status?: Database["public"]["Enums"]["notification_delivery_status"]
          id?: string
          message_body?: string | null
          message_language?: Database["public"]["Enums"]["message_language"]
          notification_type: Database["public"]["Enums"]["notification_type"]
          provider_message_id?: string | null
          provider_response?: Json
          recipient_phone: string
          report_date?: string | null
          result_upload_id?: string | null
          send_mode?: Database["public"]["Enums"]["notification_send_mode"]
          sent_at?: string | null
          student_id?: string | null
          summary?: Json
          updated_at?: string
        }
        Update: {
          attendance_record_id?: string | null
          class_id?: string | null
          created_at?: string
          delivery_status?: Database["public"]["Enums"]["notification_delivery_status"]
          id?: string
          message_body?: string | null
          message_language?: Database["public"]["Enums"]["message_language"]
          notification_type?: Database["public"]["Enums"]["notification_type"]
          provider_message_id?: string | null
          provider_response?: Json
          recipient_phone?: string
          report_date?: string | null
          result_upload_id?: string | null
          send_mode?: Database["public"]["Enums"]["notification_send_mode"]
          sent_at?: string | null
          student_id?: string | null
          summary?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_events_attendance_record_id_fkey"
            columns: ["attendance_record_id"]
            isOneToOne: false
            referencedRelation: "attendance_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_events_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "attendance_analytics"
            referencedColumns: ["class_id"]
          },
          {
            foreignKeyName: "notification_events_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "school_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_events_result_upload_id_fkey"
            columns: ["result_upload_id"]
            isOneToOne: false
            referencedRelation: "result_uploads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_events_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "attendance_analytics"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "notification_events_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      payslip_settings: {
        Row: {
          address_line: string | null
          created_at: string
          footer_note: string | null
          header_note: string | null
          header_title: string
          id: string
          logo_url: string | null
          organization_name: string
          show_esi: boolean
          show_pf: boolean
          signatory_name: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          address_line?: string | null
          created_at?: string
          footer_note?: string | null
          header_note?: string | null
          header_title?: string
          id?: string
          logo_url?: string | null
          organization_name?: string
          show_esi?: boolean
          show_pf?: boolean
          signatory_name?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          address_line?: string | null
          created_at?: string
          footer_note?: string | null
          header_note?: string | null
          header_title?: string
          id?: string
          logo_url?: string | null
          organization_name?: string
          show_esi?: boolean
          show_pf?: boolean
          signatory_name?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
          is_active: boolean
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id?: string
          is_active?: boolean
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
          is_active?: boolean
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      result_uploads: {
        Row: {
          class_id: string
          created_at: string
          exam_name: string
          file_type: Database["public"]["Enums"]["result_file_type"]
          id: string
          send_to_parent: boolean
          sent_at: string | null
          storage_path: string
          student_id: string | null
          updated_at: string
          uploaded_at: string
        }
        Insert: {
          class_id: string
          created_at?: string
          exam_name: string
          file_type?: Database["public"]["Enums"]["result_file_type"]
          id?: string
          send_to_parent?: boolean
          sent_at?: string | null
          storage_path: string
          student_id?: string | null
          updated_at?: string
          uploaded_at?: string
        }
        Update: {
          class_id?: string
          created_at?: string
          exam_name?: string
          file_type?: Database["public"]["Enums"]["result_file_type"]
          id?: string
          send_to_parent?: boolean
          sent_at?: string | null
          storage_path?: string
          student_id?: string | null
          updated_at?: string
          uploaded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "result_uploads_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "attendance_analytics"
            referencedColumns: ["class_id"]
          },
          {
            foreignKeyName: "result_uploads_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "school_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "result_uploads_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "attendance_analytics"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "result_uploads_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      salary_payroll: {
        Row: {
          allowances: number
          base_salary: number
          created_at: string
          created_by: string | null
          deductions: number
          esi: number
          id: string
          net_salary: number | null
          notes: string | null
          paid_on: string | null
          payroll_month: string
          pf: number
          staff_profile_id: string
          status: Database["public"]["Enums"]["payroll_status"]
          updated_at: string
        }
        Insert: {
          allowances?: number
          base_salary?: number
          created_at?: string
          created_by?: string | null
          deductions?: number
          esi?: number
          id?: string
          net_salary?: number | null
          notes?: string | null
          paid_on?: string | null
          payroll_month: string
          pf?: number
          staff_profile_id: string
          status?: Database["public"]["Enums"]["payroll_status"]
          updated_at?: string
        }
        Update: {
          allowances?: number
          base_salary?: number
          created_at?: string
          created_by?: string | null
          deductions?: number
          esi?: number
          id?: string
          net_salary?: number | null
          notes?: string | null
          paid_on?: string | null
          payroll_month?: string
          pf?: number
          staff_profile_id?: string
          status?: Database["public"]["Enums"]["payroll_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "salary_payroll_staff_profile_id_fkey"
            columns: ["staff_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      school_classes: {
        Row: {
          academic_year: string
          class_name: string
          created_at: string
          id: string
          section: string | null
          updated_at: string
        }
        Insert: {
          academic_year: string
          class_name: string
          created_at?: string
          id?: string
          section?: string | null
          updated_at?: string
        }
        Update: {
          academic_year?: string
          class_name?: string
          created_at?: string
          id?: string
          section?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      students: {
        Row: {
          admission_number: string | null
          class_id: string
          created_at: string
          full_name: string
          id: string
          is_active: boolean
          notes: string | null
          parent_name: string | null
          parent_phone: string
          preferred_language: Database["public"]["Enums"]["message_language"]
          roll_number: string
          updated_at: string
          whatsapp_phone: string | null
        }
        Insert: {
          admission_number?: string | null
          class_id: string
          created_at?: string
          full_name: string
          id?: string
          is_active?: boolean
          notes?: string | null
          parent_name?: string | null
          parent_phone: string
          preferred_language?: Database["public"]["Enums"]["message_language"]
          roll_number: string
          updated_at?: string
          whatsapp_phone?: string | null
        }
        Update: {
          admission_number?: string | null
          class_id?: string
          created_at?: string
          full_name?: string
          id?: string
          is_active?: boolean
          notes?: string | null
          parent_name?: string | null
          parent_phone?: string
          preferred_language?: Database["public"]["Enums"]["message_language"]
          roll_number?: string
          updated_at?: string
          whatsapp_phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "students_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "attendance_analytics"
            referencedColumns: ["class_id"]
          },
          {
            foreignKeyName: "students_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "school_classes"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      attendance_analytics: {
        Row: {
          absent_days: number | null
          attendance_percentage: number | null
          below_75_percent: boolean | null
          class_id: string | null
          class_name: string | null
          full_name: string | null
          leave_days: number | null
          present_days: number | null
          roll_number: string | null
          section: string | null
          student_id: string | null
          working_days: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      can_manage_school_data: { Args: { _user_id: string }; Returns: boolean }
      ensure_staff_profile: {
        Args: { _full_name?: string; _phone?: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      attendance_status: "present" | "absent" | "leave" | "holiday"
      import_source_type: "excel_upload" | "google_sheet"
      import_status: "pending" | "processing" | "completed" | "failed"
      message_language: "english" | "hindi"
      notification_delivery_status: "pending" | "sent" | "failed" | "skipped"
      notification_send_mode: "auto" | "manual"
      notification_type: "attendance" | "result" | "daily_report"
      payroll_status: "draft" | "paid" | "hold"
      result_file_type: "pdf"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "moderator", "user"],
      attendance_status: ["present", "absent", "leave", "holiday"],
      import_source_type: ["excel_upload", "google_sheet"],
      import_status: ["pending", "processing", "completed", "failed"],
      message_language: ["english", "hindi"],
      notification_delivery_status: ["pending", "sent", "failed", "skipped"],
      notification_send_mode: ["auto", "manual"],
      notification_type: ["attendance", "result", "daily_report"],
      payroll_status: ["draft", "paid", "hold"],
      result_file_type: ["pdf"],
    },
  },
} as const
