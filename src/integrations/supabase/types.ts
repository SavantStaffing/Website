export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      organizations: {
        Row: {
          created_at: string;
          description: string | null;
          id: string;
          industry: string | null;
          naics_code: string | null;
          name: string;
          point_of_contact_id: string | null;
          website: string | null;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          id?: string;
          industry?: string | null;
          naics_code?: string | null;
          name: string;
          point_of_contact_id?: string | null;
          website?: string | null;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          id?: string;
          industry?: string | null;
          naics_code?: string | null;
          name?: string;
          point_of_contact_id?: string | null;
          website?: string | null;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          created_at: string;
          email: string | null;
          email_notifications: boolean;
          id: string;
          org_permission: string;
          organization_id: string | null;
          phone: string | null;
          updated_at: string;
          username: string | null;
        };
        Insert: {
          created_at?: string;
          email?: string | null;
          email_notifications?: boolean;
          id: string;
          org_permission?: string;
          organization_id?: string | null;
          phone?: string | null;
          updated_at?: string;
          username?: string | null;
        };
        Update: {
          created_at?: string;
          email?: string | null;
          email_notifications?: boolean;
          id?: string;
          org_permission?: string;
          organization_id?: string | null;
          phone?: string | null;
          updated_at?: string;
          username?: string | null;
        };
        Relationships: [];
      };
      user_roles: {
        Row: {
          created_at: string;
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
      jobs: {
        Row: {
          apply_url: string | null;
          company_name: string | null;
          created_at: string;
          department: string | null;
          description: string | null;
          employer_badges: string[];
          employment_type: string | null;
          external_id: string | null;
          fingerprint: string | null;
          first_seen_at: string;
          ghost_override: boolean;
          ghost_reasons: string[];
          ghost_score: number;
          id: string;
          industry: string | null;
          last_seen_at: string;
          location: string | null;
          naics_code: string | null;
          organization_id: string | null;
          posted_at: string | null;
          posted_by: string | null;
          remote: boolean;
          scout_company_id: string | null;
          seniority: string | null;
          source: string;
          status: string;
          title: string;
          type: string | null;
          updated_at: string;
        };
        Insert: {
          apply_url?: string | null;
          company_name?: string | null;
          created_at?: string;
          department?: string | null;
          description?: string | null;
          employer_badges?: string[];
          employment_type?: string | null;
          external_id?: string | null;
          fingerprint?: string | null;
          first_seen_at?: string;
          ghost_override?: boolean;
          ghost_reasons?: string[];
          ghost_score?: number;
          id?: string;
          industry?: string | null;
          last_seen_at?: string;
          location?: string | null;
          naics_code?: string | null;
          organization_id?: string | null;
          posted_at?: string | null;
          posted_by?: string | null;
          remote?: boolean;
          scout_company_id?: string | null;
          seniority?: string | null;
          source?: string;
          status?: string;
          title: string;
          type?: string | null;
          updated_at?: string;
        };
        Update: {
          apply_url?: string | null;
          company_name?: string | null;
          created_at?: string;
          department?: string | null;
          description?: string | null;
          employer_badges?: string[];
          employment_type?: string | null;
          external_id?: string | null;
          fingerprint?: string | null;
          first_seen_at?: string;
          ghost_override?: boolean;
          ghost_reasons?: string[];
          ghost_score?: number;
          id?: string;
          industry?: string | null;
          last_seen_at?: string;
          location?: string | null;
          naics_code?: string | null;
          organization_id?: string | null;
          posted_at?: string | null;
          posted_by?: string | null;
          remote?: boolean;
          scout_company_id?: string | null;
          seniority?: string | null;
          source?: string;
          status?: string;
          title?: string;
          type?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      job_applications: {
        Row: {
          applicant_id: string;
          created_at: string;
          id: string;
          job_id: string;
          status: string;
        };
        Insert: {
          applicant_id: string;
          created_at?: string;
          id?: string;
          job_id: string;
          status?: string;
        };
        Update: {
          applicant_id?: string;
          created_at?: string;
          id?: string;
          job_id?: string;
          status?: string;
        };
        Relationships: [];
      };
      saved_jobs: {
        Row: {
          created_at: string;
          id: string;
          job_id: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          job_id: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          job_id?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      scout_companies: {
        Row: {
          added_by: string | null;
          ats: string | null;
          ats_token: string | null;
          careers_url: string | null;
          created_at: string;
          enabled: boolean;
          id: string;
          industry: string | null;
          last_error: string | null;
          last_pass_rate: number | null;
          last_rating: string | null;
          last_scanned_at: string | null;
          last_status: string | null;
          naics_code: string | null;
          name: string;
          rating_name: string | null;
          rating_override: string | null;
          updated_at: string;
        };
        Insert: {
          added_by?: string | null;
          ats?: string | null;
          ats_token?: string | null;
          careers_url?: string | null;
          created_at?: string;
          enabled?: boolean;
          id?: string;
          industry?: string | null;
          last_error?: string | null;
          last_pass_rate?: number | null;
          last_rating?: string | null;
          last_scanned_at?: string | null;
          last_status?: string | null;
          naics_code?: string | null;
          name: string;
          rating_name?: string | null;
          rating_override?: string | null;
          updated_at?: string;
        };
        Update: {
          added_by?: string | null;
          ats?: string | null;
          ats_token?: string | null;
          careers_url?: string | null;
          created_at?: string;
          enabled?: boolean;
          id?: string;
          industry?: string | null;
          last_error?: string | null;
          last_pass_rate?: number | null;
          last_rating?: string | null;
          last_scanned_at?: string | null;
          last_status?: string | null;
          naics_code?: string | null;
          name?: string;
          rating_name?: string | null;
          rating_override?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      scout_settings: {
        Row: {
          as_you_sow_min_score: number;
          audit_threshold: number;
          board_queries: Json;
          enabled_boards: string[];
          ghost_threshold: number;
          id: number;
          just_capital_max_rank: number;
          ratings_enabled: boolean;
          ratings_mode: string;
          updated_at: string;
        };
        Insert: {
          as_you_sow_min_score?: number;
          audit_threshold?: number;
          board_queries?: Json;
          enabled_boards?: string[];
          ghost_threshold?: number;
          id?: number;
          just_capital_max_rank?: number;
          ratings_enabled?: boolean;
          ratings_mode?: string;
          updated_at?: string;
        };
        Update: {
          as_you_sow_min_score?: number;
          audit_threshold?: number;
          board_queries?: Json;
          enabled_boards?: string[];
          ghost_threshold?: number;
          id?: number;
          just_capital_max_rank?: number;
          ratings_enabled?: boolean;
          ratings_mode?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      service_requests: {
        Row: {
          assigned_coach_id: string | null;
          availability: string | null;
          contact_method: string;
          created_at: string;
          goals: string;
          id: string;
          phone: string | null;
          program: string | null;
          service: string;
          status: string;
          talent_id: string;
          updated_at: string;
        };
        Insert: {
          assigned_coach_id?: string | null;
          availability?: string | null;
          contact_method?: string;
          created_at?: string;
          goals: string;
          id?: string;
          phone?: string | null;
          program?: string | null;
          service: string;
          status?: string;
          talent_id: string;
          updated_at?: string;
        };
        Update: {
          assigned_coach_id?: string | null;
          availability?: string | null;
          contact_method?: string;
          created_at?: string;
          goals?: string;
          id?: string;
          phone?: string | null;
          program?: string | null;
          service?: string;
          status?: string;
          talent_id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      company_ratings: {
        Row: {
          company_name: string;
          id: string;
          imported_at: string;
          normalized_name: string;
          rank: number | null;
          score: number | null;
          source: string;
          year: number | null;
        };
        Insert: {
          company_name: string;
          id?: string;
          imported_at?: string;
          normalized_name: string;
          rank?: number | null;
          score?: number | null;
          source: string;
          year?: number | null;
        };
        Update: {
          company_name?: string;
          id?: string;
          imported_at?: string;
          normalized_name?: string;
          rank?: number | null;
          score?: number | null;
          source?: string;
          year?: number | null;
        };
        Relationships: [];
      };
      scout_runs: {
        Row: {
          companies_scanned: number;
          error: string | null;
          finished_at: string | null;
          id: string;
          jobs_closed: number;
          jobs_flagged: number;
          jobs_found: number;
          jobs_inserted: number;
          jobs_rejected: number;
          jobs_updated: number;
          started_at: string;
          status: string;
          trigger: string;
          triggered_by: string | null;
        };
        Insert: {
          companies_scanned?: number;
          error?: string | null;
          finished_at?: string | null;
          id?: string;
          jobs_closed?: number;
          jobs_flagged?: number;
          jobs_found?: number;
          jobs_inserted?: number;
          jobs_rejected?: number;
          jobs_updated?: number;
          started_at?: string;
          status?: string;
          trigger: string;
          triggered_by?: string | null;
        };
        Update: {
          companies_scanned?: number;
          error?: string | null;
          finished_at?: string | null;
          id?: string;
          jobs_closed?: number;
          jobs_flagged?: number;
          jobs_found?: number;
          jobs_inserted?: number;
          jobs_rejected?: number;
          jobs_updated?: number;
          started_at?: string;
          status?: string;
          trigger?: string;
          triggered_by?: string | null;
        };
        Relationships: [];
      };
      scout_source_metrics: {
        Row: {
          avg_response_ms: number | null;
          created_at: string;
          field_fill_rates: Json;
          id: string;
          jobs_ingested: number;
          p95_response_ms: number | null;
          proxy: string | null;
          rate_limited: number;
          requests: number;
          run_id: string;
          schema_failures: number;
          source: string;
          status_counts: Json;
          successes: number;
        };
        Insert: {
          avg_response_ms?: number | null;
          created_at?: string;
          field_fill_rates?: Json;
          id?: string;
          jobs_ingested?: number;
          p95_response_ms?: number | null;
          proxy?: string | null;
          rate_limited?: number;
          requests?: number;
          run_id: string;
          schema_failures?: number;
          source: string;
          status_counts?: Json;
          successes?: number;
        };
        Update: {
          avg_response_ms?: number | null;
          created_at?: string;
          field_fill_rates?: Json;
          id?: string;
          jobs_ingested?: number;
          p95_response_ms?: number | null;
          proxy?: string | null;
          rate_limited?: number;
          requests?: number;
          run_id?: string;
          schema_failures?: number;
          source?: string;
          status_counts?: Json;
          successes?: number;
        };
        Relationships: [];
      };
      talent_profiles: {
        Row: {
          current_company: string | null;
          current_title: string | null;
          earliest_start: string | null;
          first_name: string | null;
          github_url: string | null;
          headline: string | null;
          last_name: string | null;
          linkedin_url: string | null;
          location: string | null;
          needs_sponsorship: boolean | null;
          portfolio_url: string | null;
          resume_text: string | null;
          salary_expectation: string | null;
          skills: string[];
          updated_at: string;
          user_id: string;
          visible_to_recruiters: boolean;
          work_authorized: boolean | null;
        };
        Insert: {
          current_company?: string | null;
          current_title?: string | null;
          earliest_start?: string | null;
          first_name?: string | null;
          github_url?: string | null;
          headline?: string | null;
          last_name?: string | null;
          linkedin_url?: string | null;
          location?: string | null;
          needs_sponsorship?: boolean | null;
          portfolio_url?: string | null;
          resume_text?: string | null;
          salary_expectation?: string | null;
          skills?: string[];
          updated_at?: string;
          user_id: string;
          visible_to_recruiters?: boolean;
          work_authorized?: boolean | null;
        };
        Update: {
          current_company?: string | null;
          current_title?: string | null;
          earliest_start?: string | null;
          first_name?: string | null;
          github_url?: string | null;
          headline?: string | null;
          last_name?: string | null;
          linkedin_url?: string | null;
          location?: string | null;
          needs_sponsorship?: boolean | null;
          portfolio_url?: string | null;
          resume_text?: string | null;
          salary_expectation?: string | null;
          skills?: string[];
          updated_at?: string;
          user_id?: string;
          visible_to_recruiters?: boolean;
          work_authorized?: boolean | null;
        };
        Relationships: [];
      };
      talent_preferences: {
        Row: {
          employment_types: string[];
          industries: string[];
          locations: string[];
          naics_codes: string[];
          positions: string[];
          posted_within_days: number;
          remote_ok: boolean;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          employment_types?: string[];
          industries?: string[];
          locations?: string[];
          naics_codes?: string[];
          positions?: string[];
          posted_within_days?: number;
          remote_ok?: boolean;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          employment_types?: string[];
          industries?: string[];
          locations?: string[];
          naics_codes?: string[];
          positions?: string[];
          posted_within_days?: number;
          remote_ok?: boolean;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      saved_answers: {
        Row: {
          answer: string;
          id: string;
          question_key: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          answer: string;
          id?: string;
          question_key: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          answer?: string;
          id?: string;
          question_key?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      autofill_plans: {
        Row: {
          ats: string | null;
          created_at: string;
          fill_plan: Json | null;
          id: string;
          job_id: string | null;
          job_url: string;
          status: string;
          user_id: string;
        };
        Insert: {
          ats?: string | null;
          created_at?: string;
          fill_plan?: Json | null;
          id?: string;
          job_id?: string | null;
          job_url: string;
          status?: string;
          user_id: string;
        };
        Update: {
          ats?: string | null;
          created_at?: string;
          fill_plan?: Json | null;
          id?: string;
          job_id?: string | null;
          job_url?: string;
          status?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      saved_talent: {
        Row: {
          created_at: string;
          id: string;
          note: string | null;
          recruiter_id: string;
          talent_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          note?: string | null;
          recruiter_id: string;
          talent_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          note?: string | null;
          recruiter_id?: string;
          talent_id?: string;
        };
        Relationships: [];
      };
      application_requests: {
        Row: {
          created_at: string;
          id: string;
          job_id: string;
          message: string | null;
          recruiter_id: string;
          responded_at: string | null;
          status: string;
          talent_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          job_id: string;
          message?: string | null;
          recruiter_id: string;
          responded_at?: string | null;
          status?: string;
          talent_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          job_id?: string;
          message?: string | null;
          recruiter_id?: string;
          responded_at?: string | null;
          status?: string;
          talent_id?: string;
        };
        Relationships: [];
      };
      notifications: {
        Row: {
          body: string | null;
          created_at: string;
          id: string;
          kind: string;
          link: string | null;
          read_at: string | null;
          title: string;
          user_id: string;
        };
        Insert: {
          body?: string | null;
          created_at?: string;
          id?: string;
          kind: string;
          link?: string | null;
          read_at?: string | null;
          title: string;
          user_id: string;
        };
        Update: {
          body?: string | null;
          created_at?: string;
          id?: string;
          kind?: string;
          link?: string | null;
          read_at?: string | null;
          title?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      contact_messages: {
        Row: {
          company: string | null;
          created_at: string;
          email: string;
          handled: boolean;
          id: string;
          message: string;
          name: string;
          topic: string | null;
        };
        Insert: {
          company?: string | null;
          created_at?: string;
          email: string;
          handled?: boolean;
          id?: string;
          message: string;
          name: string;
          topic?: string | null;
        };
        Update: {
          company?: string | null;
          created_at?: string;
          email?: string;
          handled?: boolean;
          id?: string;
          message?: string;
          name?: string;
          topic?: string | null;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
      own_organization_id: {
        Args: {
          _user_id: string;
        };
        Returns: string;
      };
      own_org_permission: {
        Args: {
          _user_id: string;
        };
        Returns: string;
      };
      set_org_permission: {
        Args: {
          _permission: string;
          _target: string;
        };
        Returns: undefined;
      };
    };
    Enums: {
      app_role: "admin" | "talent" | "recruiter" | "career_coach";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "talent", "recruiter", "career_coach"],
    },
  },
} as const;
