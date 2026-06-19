/**
 * Minimal hand-rolled Database types.
 * Regenerate with `supabase gen types typescript` once the CLI is linked.
 */
export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "12";
  };
  public: {
    Tables: {
      clusters: {
        Row: { name: string };
        Insert: { name: string };
        Update: { name?: string };
        Relationships: [];
      };
      countries: {
        Row: { code: string; name: string };
        Insert: { code: string; name: string };
        Update: { code?: string; name?: string };
        Relationships: [];
      };
      competency_levels: {
        Row: { label: string; numeric_value: number; description: string | null };
        Insert: { label: string; numeric_value: number; description?: string | null };
        Update: { label?: string; numeric_value?: number; description?: string | null };
        Relationships: [];
      };
      gap_codes: {
        Row: { code: string; dimension: string; description: string | null };
        Insert: { code: string; dimension: string; description?: string | null };
        Update: { code?: string; dimension?: string; description?: string | null };
        Relationships: [];
      };
      training_modes: {
        Row: { name: string };
        Insert: { name: string };
        Update: { name?: string };
        Relationships: [];
      };
      courses: {
        Row: {
          id: string;
          title: string;
          develops: string | null;
          cluster_fit: string[];
          link: string | null;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          develops?: string | null;
          cluster_fit?: string[];
          link?: string | null;
          active?: boolean;
        };
        Update: Partial<Database["public"]["Tables"]["courses"]["Insert"]>;
        Relationships: [];
      };
      course_rules: {
        Row: {
          cluster: string;
          gap_code: string;
          course_id: string;
          training_mode: string;
        };
        Insert: Database["public"]["Tables"]["course_rules"]["Row"];
        Update: Partial<Database["public"]["Tables"]["course_rules"]["Row"]>;
        Relationships: [];
      };
      roles: {
        Row: {
          title: string;
          cluster: string;
          kpi_linked: string | null;
          required_level: string;
          notes: string | null;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          title: string;
          cluster: string;
          kpi_linked?: string | null;
          required_level: string;
          notes?: string | null;
          active?: boolean;
        };
        Update: Partial<Database["public"]["Tables"]["roles"]["Insert"]>;
        Relationships: [];
      };
      document_sources: {
        Row: {
          id: string;
          file_name: string;
          source_type: "job_descriptions" | "role_competencies_kpis" | "workflow" | "appraisal_form" | "other";
          source_version: string | null;
          metadata: Record<string, unknown>;
          imported_at: string;
        };
        Insert: {
          id?: string;
          file_name: string;
          source_type: "job_descriptions" | "role_competencies_kpis" | "workflow" | "appraisal_form" | "other";
          source_version?: string | null;
          metadata?: Record<string, unknown>;
          imported_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["document_sources"]["Insert"]>;
        Relationships: [];
      };
      job_profiles: {
        Row: {
          title: string;
          department: string;
          reports_to: string | null;
          role_purpose: string | null;
          responsibilities: string[];
          authority: string[];
          qualifications: Record<string, unknown>;
          grade_band: string | null;
          salary_range: string | null;
          geographic_scope: string | null;
          active: boolean;
          source_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          title: string;
          department: string;
          reports_to?: string | null;
          role_purpose?: string | null;
          responsibilities?: string[];
          authority?: string[];
          qualifications?: Record<string, unknown>;
          grade_band?: string | null;
          salary_range?: string | null;
          geographic_scope?: string | null;
          active?: boolean;
          source_id?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["job_profiles"]["Insert"]>;
        Relationships: [];
      };
      competencies: {
        Row: {
          id: string;
          name: string;
          category: string;
          description: string | null;
          behavioral_indicators: string | null;
          source_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          category?: string;
          description?: string | null;
          behavioral_indicators?: string | null;
          source_id?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["competencies"]["Insert"]>;
        Relationships: [];
      };
      role_competencies: {
        Row: {
          role_title: string;
          competency_id: string;
          category: string;
          required_level: string | null;
          weight: number;
          applicable: boolean;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          role_title: string;
          competency_id: string;
          category?: string;
          required_level?: string | null;
          weight?: number;
          applicable?: boolean;
          sort_order?: number;
        };
        Update: Partial<Database["public"]["Tables"]["role_competencies"]["Insert"]>;
        Relationships: [];
      };
      role_kpi_templates: {
        Row: {
          id: string;
          role_title: string;
          department: string;
          title: string;
          measure: string | null;
          target: string | null;
          review_frequency: string | null;
          default_weight: number;
          active: boolean;
          source_id: string | null;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          role_title: string;
          department: string;
          title: string;
          measure?: string | null;
          target?: string | null;
          review_frequency?: string | null;
          default_weight?: number;
          active?: boolean;
          source_id?: string | null;
          sort_order?: number;
        };
        Update: Partial<Database["public"]["Tables"]["role_kpi_templates"]["Insert"]>;
        Relationships: [];
      };
      employees: {
        Row: {
          employee_id: string;
          full_name: string;
          job_title: string;
          department?: string | null;
          country_code: string | null;
          manager_name: string | null;
          email: string | null;
          user_id: string | null;
          active: boolean;
          grade: string | null;
          grade_band: string | null;
          grade_type: string | null;
          joining_date: string | null;
          manager_position: string | null;
          inactive_reason: string | null;
          inactive_at: string | null;
          last_import_batch_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          employee_id: string;
          full_name: string;
          job_title: string;
          department?: string | null;
          country_code?: string | null;
          manager_name?: string | null;
          email?: string | null;
          user_id?: string | null;
          active?: boolean;
          grade?: string | null;
          grade_band?: string | null;
          grade_type?: string | null;
          joining_date?: string | null;
          manager_position?: string | null;
          inactive_reason?: string | null;
          inactive_at?: string | null;
          last_import_batch_id?: string | null;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["employees"]["Insert"]>;
        Relationships: [];
      };
      employee_import_batches: {
        Row: {
          id: string;
          file_name: string;
          source_name: string;
          mode: "preview_confirmed" | "direct";
          total_rows: number;
          new_count: number;
          updated_count: number;
          deactivated_count: number;
          skipped_count: number;
          errors: unknown[];
          created_by: string | null;
          created_at: string;
          applied_at: string | null;
        };
        Insert: {
          id?: string;
          file_name: string;
          source_name?: string;
          mode?: "preview_confirmed" | "direct";
          total_rows?: number;
          new_count?: number;
          updated_count?: number;
          deactivated_count?: number;
          skipped_count?: number;
          errors?: unknown[];
          created_by?: string | null;
          applied_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["employee_import_batches"]["Insert"]>;
        Relationships: [];
      };
      appraisals: {
        Row: {
          id: string;
          employee_id: string;
          appraisal_date: string;
          required_level: string;
          knowledge: string;
          skill: string;
          behaviour: string;
          desire: string;
          attitude: string;
          training_start: string | null;
          target_completion: string | null;
          actual_completion: string | null;
          status: "Not Started" | "In Progress" | "Completed" | "Cancelled";
          reassessment_avg: number | null;
          evidence_url: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
          created_by: string | null;
        };
        Insert: Omit<
          Database["public"]["Tables"]["appraisals"]["Row"],
          "id" | "created_at" | "updated_at" | "created_by"
        > & { id?: string; created_by?: string | null };
        Update: Partial<Database["public"]["Tables"]["appraisals"]["Insert"]>;
        Relationships: [];
      };
      rollout_tasks: {
        Row: {
          id: string;
          phase: number;
          phase_name: string;
          action: string;
          responsible: string | null;
          target_date: string | null;
          tool_notes: string | null;
          status: "Not Started" | "In Progress" | "Completed" | "Blocked";
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["rollout_tasks"]["Row"],
          "id" | "created_at" | "updated_at"
        > & { id?: string };
        Update: Partial<Database["public"]["Tables"]["rollout_tasks"]["Insert"]>;
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          role: "admin" | "manager" | "employee" | "executive";
          employee_id: string | null;
          manager_id: string | null;
          department_id: string | null;
          job_title: string | null;
          country_code: string | null;
          cluster: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          role?: "admin" | "manager" | "employee" | "executive";
          employee_id?: string | null;
          manager_id?: string | null;
          department_id?: string | null;
          job_title?: string | null;
          country_code?: string | null;
          cluster?: string | null;
          is_active?: boolean;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
        Relationships: [];
      };
      audit_log: {
        Row: {
          id: number;
          at: string;
          actor: string | null;
          actor_email: string | null;
          table_name: string;
          row_pk: string | null;
          action: "INSERT" | "UPDATE" | "DELETE";
          before: unknown;
          after: unknown;
        };
        Insert: {
          id?: number;
          at?: string;
          actor?: string | null;
          actor_email?: string | null;
          table_name: string;
          row_pk?: string | null;
          action: "INSERT" | "UPDATE" | "DELETE";
          before?: unknown;
          after?: unknown;
        };
        Update: never;
        Relationships: [];
      };
      employee_courses: {
        Row: {
          id: string;
          employee_id: string;
          course_id: string;
          status: "Enrolled" | "In Progress" | "Completed" | "Dropped";
          enrolled_at: string;
          started_at: string | null;
          completed_at: string | null;
          score: number | null;
          certificate_url: string | null;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          employee_id: string;
          course_id: string;
          status?: "Enrolled" | "In Progress" | "Completed" | "Dropped";
          enrolled_at?: string;
          started_at?: string | null;
          completed_at?: string | null;
          score?: number | null;
          certificate_url?: string | null;
          notes?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["employee_courses"]["Insert"]>;
        Relationships: [];
      };
      training_survey_responses: {
        Row: {
          id: string;
          user_id: string;
          employee_id: string | null;
          full_name: string;
          job_title: string;
          department: string;
          role_level: string;
          email: string;
          manager_name: string | null;
          learn_departments: string[];
          learn_topics: string | null;
          urgency: string | null;
          preferred_format: string | null;
          learning_hours: string | null;
          teach_departments: string[];
          teach_topics: string | null;
          confidence: string | null;
          teaching_hours: string | null;
          recommended_trainers: string | null;
          comments: string | null;
          status: "submitted" | "reviewed" | "actioned" | "archived";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          employee_id?: string | null;
          full_name: string;
          job_title: string;
          department: string;
          role_level: string;
          email: string;
          manager_name?: string | null;
          learn_departments?: string[];
          learn_topics?: string | null;
          urgency?: string | null;
          preferred_format?: string | null;
          learning_hours?: string | null;
          teach_departments?: string[];
          teach_topics?: string | null;
          confidence?: string | null;
          teaching_hours?: string | null;
          recommended_trainers?: string | null;
          comments?: string | null;
          status?: "submitted" | "reviewed" | "actioned" | "archived";
        };
        Update: Partial<Database["public"]["Tables"]["training_survey_responses"]["Insert"]>;
        Relationships: [];
      };
      departments: {
        Row: {
          id: string;
          name: string;
          parent_id: string | null;
          head_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          parent_id?: string | null;
          head_id?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["departments"]["Insert"]>;
        Relationships: [];
      };
      appraisal_cycles: {
        Row: {
          id: string;
          name: string;
          type: "annual" | "bi_annual" | "quarterly" | "probation";
          start_date: string;
          end_date: string;
          objective_deadline: string | null;
          self_assessment_deadline: string | null;
          manager_assessment_deadline: string | null;
          calibration_deadline: string | null;
          status: "draft" | "objective_setting" | "assessment" | "calibration" | "review" | "closed";
          scoring_rubric: Record<string, number>;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          type?: "annual" | "bi_annual" | "quarterly" | "probation";
          start_date: string;
          end_date: string;
          objective_deadline?: string | null;
          self_assessment_deadline?: string | null;
          manager_assessment_deadline?: string | null;
          calibration_deadline?: string | null;
          status?: "draft" | "objective_setting" | "assessment" | "calibration" | "review" | "closed";
          scoring_rubric?: Record<string, number>;
          created_by?: string | null;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["appraisal_cycles"]["Insert"]>;
        Relationships: [];
      };
      org_kpis: {
        Row: {
          id: string;
          cycle_id: string;
          title: string;
          description: string | null;
          level: "organization" | "department" | "team";
          department_id: string | null;
          weight: number;
          target_value: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          cycle_id: string;
          title: string;
          description?: string | null;
          level: "organization" | "department" | "team";
          department_id?: string | null;
          weight?: number;
          target_value?: string | null;
          created_by?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["org_kpis"]["Insert"]>;
        Relationships: [];
      };
      cycle_objectives: {
        Row: {
          id: string;
          cycle_id: string;
          employee_id: string;
          kpi_id: string | null;
          title: string;
          description: string | null;
          success_criteria: string | null;
          weight: number;
          status: "draft" | "submitted" | "revision_requested" | "approved" | "rejected";
          approved_by: string | null;
          approved_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          cycle_id: string;
          employee_id: string;
          kpi_id?: string | null;
          title: string;
          description?: string | null;
          success_criteria?: string | null;
          weight?: number;
          status?: "draft" | "submitted" | "revision_requested" | "approved" | "rejected";
          approved_by?: string | null;
          approved_at?: string | null;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["cycle_objectives"]["Insert"]>;
        Relationships: [];
      };
      objective_comments: {
        Row: {
          id: string;
          objective_id: string;
          author_id: string;
          body: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          objective_id: string;
          author_id: string;
          body: string;
        };
        Update: Partial<Database["public"]["Tables"]["objective_comments"]["Insert"]>;
        Relationships: [];
      };
      performance_appraisals: {
        Row: {
          id: string;
          employee_id: string;
          manager_id: string | null;
          department: string | null;
          business_unit: string | null;
          location: string | null;
          appraisal_period: string | null;
          appraisal_type: "Annual" | "Mid-Year" | "Probation" | "Exit" | null;
          document_ref: string | null;
          cycle_id: string | null;
          goals: unknown;
          core_competencies: unknown;
          leadership: unknown;
          leadership_applicable: boolean;
          values_culture: unknown;
          feedback_n1: unknown;
          feedback_n2: unknown;
          development_plan: unknown;
          next_period_goals: unknown;
          score_a_n1: number | null;
          score_a_n2: number | null;
          score_b_n1: number | null;
          score_b_n2: number | null;
          score_c_n1: number | null;
          score_c_n2: number | null;
          score_d_n1: number | null;
          score_d_n2: number | null;
          total_weighted_score: number | null;
          final_rating: number | null;
          calibrated_rating: number | null;
          calibration_rationale: string | null;
          overall_label: string | null;
          recommended_action: string | null;
          employee_comments: string | null;
          employee_signed_at: string | null;
          manager_signed_at: string | null;
          hr_signed_at: string | null;
          hr_representative: string | null;
          status: "Draft" | "N1 Complete" | "N2 Complete" | "Final" | "Archived";
          created_at: string;
          updated_at: string;
          created_by: string | null;
        };
        Insert: {
          id?: string;
          employee_id: string;
          manager_id?: string | null;
          department?: string | null;
          business_unit?: string | null;
          location?: string | null;
          appraisal_period?: string | null;
          appraisal_type?: "Annual" | "Mid-Year" | "Probation" | "Exit" | null;
          document_ref?: string | null;
          cycle_id?: string | null;
          goals?: unknown;
          core_competencies?: unknown;
          leadership?: unknown;
          leadership_applicable?: boolean;
          values_culture?: unknown;
          feedback_n1?: unknown;
          feedback_n2?: unknown;
          development_plan?: unknown;
          next_period_goals?: unknown;
          score_a_n1?: number | null;
          score_a_n2?: number | null;
          score_b_n1?: number | null;
          score_b_n2?: number | null;
          score_c_n1?: number | null;
          score_c_n2?: number | null;
          score_d_n1?: number | null;
          score_d_n2?: number | null;
          total_weighted_score?: number | null;
          final_rating?: number | null;
          calibrated_rating?: number | null;
          calibration_rationale?: string | null;
          overall_label?: string | null;
          recommended_action?: string | null;
          employee_comments?: string | null;
          employee_signed_at?: string | null;
          manager_signed_at?: string | null;
          hr_signed_at?: string | null;
          hr_representative?: string | null;
          status?: "Draft" | "N1 Complete" | "N2 Complete" | "Final" | "Archived";
          updated_at?: string;
          created_by?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["performance_appraisals"]["Insert"]>;
        Relationships: [];
      };
      skill_gaps: {
        Row: {
          id: string;
          appraisal_id: string | null;
          employee_id: string;
          role_title: string | null;
          competency_name: string;
          section: string;
          required_rating: number;
          actual_rating: number | null;
          gap: number | null;
          severity: "low" | "medium" | "high" | null;
          recommended_action: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          appraisal_id?: string | null;
          employee_id: string;
          role_title?: string | null;
          competency_name: string;
          section: string;
          required_rating?: number;
          actual_rating?: number | null;
          gap?: number | null;
          severity?: "low" | "medium" | "high" | null;
          recommended_action?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["skill_gaps"]["Insert"]>;
        Relationships: [];
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          type: string;
          title: string;
          body: string | null;
          link: string | null;
          read: boolean;
          metadata: Record<string, unknown>;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          type: string;
          title: string;
          body?: string | null;
          link?: string | null;
          read?: boolean;
          metadata?: Record<string, unknown>;
        };
        Update: Partial<Database["public"]["Tables"]["notifications"]["Insert"]>;
        Relationships: [];
      };
      firebase_messaging_tokens: {
        Row: {
          id: string;
          user_id: string;
          token: string;
          user_agent: string | null;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          token: string;
          user_agent?: string | null;
          active?: boolean;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["firebase_messaging_tokens"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: {
      appraisal_full: {
        Row: {
          id: string;
          employee_id: string;
          appraisal_date: string;
          required_level: string;
          knowledge: string;
          skill: string;
          behaviour: string;
          desire: string;
          attitude: string;
          training_start: string | null;
          target_completion: string | null;
          actual_completion: string | null;
          status: string;
          reassessment_avg: number | null;
          evidence_url: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
          created_by: string | null;
          k_num: number;
          s_num: number;
          b_num: number;
          d_num: number;
          a_num: number;
          required_numeric: number;
          current_avg: number;
          gap: number;
          dominant_gap_code: "K" | "S" | "B" | "D" | "A";
          priority: "HIGH" | "MEDIUM" | "LOW";
          overdue_days: number | null;
          full_name: string;
          job_title: string;
          country_code: string | null;
          manager_name: string | null;
          cluster: string;
          kpi_linked: string | null;
          recommended_course_id: string | null;
          recommended_course: string | null;
          training_mode: string | null;
          overdue: boolean;
        };
        Relationships: [];
      };
    };
    Functions: Record<string, never>;
    Enums: {
      app_role: "admin" | "manager" | "employee" | "executive";
    };
    CompositeTypes: Record<string, never>;
  };
};
