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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      allergies: {
        Row: {
          created_at: string
          id: string
          reaction: string | null
          severity: string | null
          substance: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          reaction?: string | null
          severity?: string | null
          substance: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          reaction?: string | null
          severity?: string | null
          substance?: string
          user_id?: string
        }
        Relationships: []
      }
      caregiver_links: {
        Row: {
          alert_on_missed: boolean
          can_view: boolean
          caregiver_email: string
          caregiver_id: string | null
          created_at: string
          id: string
          patient_id: string
          status: string
        }
        Insert: {
          alert_on_missed?: boolean
          can_view?: boolean
          caregiver_email: string
          caregiver_id?: string | null
          created_at?: string
          id?: string
          patient_id: string
          status?: string
        }
        Update: {
          alert_on_missed?: boolean
          can_view?: boolean
          caregiver_email?: string
          caregiver_id?: string | null
          created_at?: string
          id?: string
          patient_id?: string
          status?: string
        }
        Relationships: []
      }
      dose_events: {
        Row: {
          acted_at: string
          id: string
          medication_id: string
          note: string | null
          scheduled_at: string
          snooze_until: string | null
          status: Database["public"]["Enums"]["dose_status"]
          user_id: string
        }
        Insert: {
          acted_at?: string
          id?: string
          medication_id: string
          note?: string | null
          scheduled_at: string
          snooze_until?: string | null
          status: Database["public"]["Enums"]["dose_status"]
          user_id: string
        }
        Update: {
          acted_at?: string
          id?: string
          medication_id?: string
          note?: string | null
          scheduled_at?: string
          snooze_until?: string | null
          status?: Database["public"]["Enums"]["dose_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dose_events_medication_id_fkey"
            columns: ["medication_id"]
            isOneToOne: false
            referencedRelation: "medications"
            referencedColumns: ["id"]
          },
        ]
      }
      medications: {
        Row: {
          archived: boolean
          brand: string | null
          created_at: string
          days_of_week: number[]
          dosage: string
          dosage_form: string | null
          doses_per_time: number
          end_date: string | null
          food_instruction: string | null
          frequency: string
          id: string
          instructions: string | null
          name: string
          prescriber_notes: string | null
          quantity_remaining: number | null
          refill_threshold: number | null
          start_date: string
          times: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          archived?: boolean
          brand?: string | null
          created_at?: string
          days_of_week?: number[]
          dosage: string
          dosage_form?: string | null
          doses_per_time?: number
          end_date?: string | null
          food_instruction?: string | null
          frequency?: string
          id?: string
          instructions?: string | null
          name: string
          prescriber_notes?: string | null
          quantity_remaining?: number | null
          refill_threshold?: number | null
          start_date?: string
          times?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          archived?: boolean
          brand?: string | null
          created_at?: string
          days_of_week?: number[]
          dosage?: string
          dosage_form?: string | null
          doses_per_time?: number
          end_date?: string | null
          food_instruction?: string | null
          frequency?: string
          id?: string
          instructions?: string | null
          name?: string
          prescriber_notes?: string | null
          quantity_remaining?: number | null
          refill_threshold?: number | null
          start_date?: string
          times?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          browser_notifications: boolean
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          quiet_end: string | null
          quiet_start: string | null
          snooze_minutes: number
          timezone: string
          updated_at: string
        }
        Insert: {
          browser_notifications?: boolean
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          quiet_end?: string | null
          quiet_start?: string | null
          snooze_minutes?: number
          timezone?: string
          updated_at?: string
        }
        Update: {
          browser_notifications?: boolean
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          quiet_end?: string | null
          quiet_start?: string | null
          snooze_minutes?: number
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      refills: {
        Row: {
          created_at: string
          id: string
          medication_id: string
          quantity_added: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          medication_id: string
          quantity_added: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          medication_id?: string
          quantity_added?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "refills_medication_id_fkey"
            columns: ["medication_id"]
            isOneToOne: false
            referencedRelation: "medications"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_caregiver_of: { Args: { _patient: string }; Returns: boolean }
      respond_caregiver_invite: {
        Args: { _accept: boolean; _link: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "patient" | "caregiver"
      dose_status: "taken" | "skipped" | "missed" | "snoozed"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["patient", "caregiver"],
      dose_status: ["taken", "skipped", "missed", "snoozed"],
    },
  },
} as const
