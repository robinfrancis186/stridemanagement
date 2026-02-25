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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      committee_decisions: {
        Row: {
          conditions: string | null
          created_at: string
          decided_by: string
          decision: string
          id: string
          requirement_id: string
          revision_instructions: string | null
        }
        Insert: {
          conditions?: string | null
          created_at?: string
          decided_by: string
          decision: string
          id?: string
          requirement_id: string
          revision_instructions?: string | null
        }
        Update: {
          conditions?: string | null
          created_at?: string
          decided_by?: string
          decision?: string
          id?: string
          requirement_id?: string
          revision_instructions?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "committee_decisions_requirement_id_fkey"
            columns: ["requirement_id"]
            isOneToOne: false
            referencedRelation: "requirements"
            referencedColumns: ["id"]
          },
        ]
      }
      committee_reviews: {
        Row: {
          conditions: string | null
          cost_effectiveness_score: number | null
          created_at: string
          doe_results_score: number | null
          feedback_text: string | null
          id: string
          recommendation: string | null
          requirement_id: string
          reviewer_id: string
          safety_score: number | null
          technical_feasibility_score: number | null
          user_need_score: number | null
          weighted_total: number | null
        }
        Insert: {
          conditions?: string | null
          cost_effectiveness_score?: number | null
          created_at?: string
          doe_results_score?: number | null
          feedback_text?: string | null
          id?: string
          recommendation?: string | null
          requirement_id: string
          reviewer_id: string
          safety_score?: number | null
          technical_feasibility_score?: number | null
          user_need_score?: number | null
          weighted_total?: number | null
        }
        Update: {
          conditions?: string | null
          cost_effectiveness_score?: number | null
          created_at?: string
          doe_results_score?: number | null
          feedback_text?: string | null
          id?: string
          recommendation?: string | null
          requirement_id?: string
          reviewer_id?: string
          safety_score?: number | null
          technical_feasibility_score?: number | null
          user_need_score?: number | null
          weighted_total?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "committee_reviews_requirement_id_fkey"
            columns: ["requirement_id"]
            isOneToOne: false
            referencedRelation: "requirements"
            referencedColumns: ["id"]
          },
        ]
      }
      doe_records: {
        Row: {
          baseline_data: Json | null
          beneficiary_feedback: string | null
          beneficiary_profiles: Json | null
          created_at: string
          created_by: string | null
          id: string
          improvement_metrics: Json | null
          post_test_data: Json | null
          pre_test_data: Json | null
          requirement_id: string
          results_summary: string | null
          sample_size: number | null
          statistical_analysis: Json | null
          testing_protocol: string | null
          updated_at: string
        }
        Insert: {
          baseline_data?: Json | null
          beneficiary_feedback?: string | null
          beneficiary_profiles?: Json | null
          created_at?: string
          created_by?: string | null
          id?: string
          improvement_metrics?: Json | null
          post_test_data?: Json | null
          pre_test_data?: Json | null
          requirement_id: string
          results_summary?: string | null
          sample_size?: number | null
          statistical_analysis?: Json | null
          testing_protocol?: string | null
          updated_at?: string
        }
        Update: {
          baseline_data?: Json | null
          beneficiary_feedback?: string | null
          beneficiary_profiles?: Json | null
          created_at?: string
          created_by?: string | null
          id?: string
          improvement_metrics?: Json | null
          post_test_data?: Json | null
          pre_test_data?: Json | null
          requirement_id?: string
          results_summary?: string | null
          sample_size?: number | null
          statistical_analysis?: Json | null
          testing_protocol?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "doe_records_requirement_id_fkey"
            columns: ["requirement_id"]
            isOneToOne: false
            referencedRelation: "requirements"
            referencedColumns: ["id"]
          },
        ]
      }
      phase_feedbacks: {
        Row: {
          blockers_resolved: string[] | null
          created_at: string
          from_state: string
          id: string
          key_decisions: string[] | null
          phase_notes: string | null
          phase_specific_data: Json | null
          requirement_id: string
          submitted_by: string | null
          to_state: string
        }
        Insert: {
          blockers_resolved?: string[] | null
          created_at?: string
          from_state: string
          id?: string
          key_decisions?: string[] | null
          phase_notes?: string | null
          phase_specific_data?: Json | null
          requirement_id: string
          submitted_by?: string | null
          to_state: string
        }
        Update: {
          blockers_resolved?: string[] | null
          created_at?: string
          from_state?: string
          id?: string
          key_decisions?: string[] | null
          phase_notes?: string | null
          phase_specific_data?: Json | null
          requirement_id?: string
          submitted_by?: string | null
          to_state?: string
        }
        Relationships: [
          {
            foreignKeyName: "phase_feedbacks_requirement_id_fkey"
            columns: ["requirement_id"]
            isOneToOne: false
            referencedRelation: "requirements"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      requirements: {
        Row: {
          created_at: string
          created_by: string | null
          current_state: string
          description: string | null
          disability_types: string[] | null
          gap_flags: string[] | null
          id: string
          market_price: number | null
          path_assignment: string | null
          priority: string
          revision_number: number
          source_type: string
          stride_target_price: number | null
          tech_level: string
          therapy_domains: string[] | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          current_state?: string
          description?: string | null
          disability_types?: string[] | null
          gap_flags?: string[] | null
          id?: string
          market_price?: number | null
          path_assignment?: string | null
          priority?: string
          revision_number?: number
          source_type: string
          stride_target_price?: number | null
          tech_level?: string
          therapy_domains?: string[] | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          current_state?: string
          description?: string | null
          disability_types?: string[] | null
          gap_flags?: string[] | null
          id?: string
          market_price?: number | null
          path_assignment?: string | null
          priority?: string
          revision_number?: number
          source_type?: string
          stride_target_price?: number | null
          tech_level?: string
          therapy_domains?: string[] | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      state_transitions: {
        Row: {
          created_at: string
          from_state: string
          id: string
          notes: string | null
          requirement_id: string
          to_state: string
          transitioned_by: string | null
        }
        Insert: {
          created_at?: string
          from_state: string
          id?: string
          notes?: string | null
          requirement_id: string
          to_state: string
          transitioned_by?: string | null
        }
        Update: {
          created_at?: string
          from_state?: string
          id?: string
          notes?: string | null
          requirement_id?: string
          to_state?: string
          transitioned_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "state_transitions_requirement_id_fkey"
            columns: ["requirement_id"]
            isOneToOne: false
            referencedRelation: "requirements"
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "coe_admin" | "leadership_viewer"
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
      app_role: ["coe_admin", "leadership_viewer"],
    },
  },
} as const
