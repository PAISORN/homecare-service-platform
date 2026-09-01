export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      account_roles: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          role: Database["public"]["Enums"]["account_role"]
          user_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          role: Database["public"]["Enums"]["account_role"]
          user_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          role?: Database["public"]["Enums"]["account_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_roles_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_permissions: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          permission: Database["public"]["Enums"]["admin_permission"]
          user_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          permission: Database["public"]["Enums"]["admin_permission"]
          user_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          permission?: Database["public"]["Enums"]["admin_permission"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_permissions_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_permissions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_user_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          metadata: Json
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          metadata?: Json
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          metadata?: Json
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          account_status: Database["public"]["Enums"]["account_status"]
          avatar_path: string | null
          created_at: string
          deactivated_at: string | null
          display_name: string
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          account_status?: Database["public"]["Enums"]["account_status"]
          avatar_path?: string | null
          created_at?: string
          deactivated_at?: string | null
          display_name: string
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          account_status?: Database["public"]["Enums"]["account_status"]
          avatar_path?: string | null
          created_at?: string
          deactivated_at?: string | null
          display_name?: string
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      service_categories: {
        Row: {
          code: string
          created_at: string
          description_th: string | null
          id: string
          name_th: string
          sort_order: number
          status: Database["public"]["Enums"]["catalog_status"]
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description_th?: string | null
          id?: string
          name_th: string
          sort_order?: number
          status?: Database["public"]["Enums"]["catalog_status"]
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description_th?: string | null
          id?: string
          name_th?: string
          sort_order?: number
          status?: Database["public"]["Enums"]["catalog_status"]
          updated_at?: string
        }
        Relationships: []
      }
      service_items: {
        Row: {
          approved_by: string | null
          base_labor_price: number | null
          code: string
          created_at: string
          currency: string
          description_th: string | null
          effective_from: string | null
          effective_until: string | null
          id: string
          intake_schema: Json
          name_th: string
          price_model: Database["public"]["Enums"]["price_model"]
          pricing_config: Json
          service_category_id: string
          status: Database["public"]["Enums"]["catalog_status"]
          updated_at: string
          warranty_days: number | null
        }
        Insert: {
          approved_by?: string | null
          base_labor_price?: number | null
          code: string
          created_at?: string
          currency?: string
          description_th?: string | null
          effective_from?: string | null
          effective_until?: string | null
          id?: string
          intake_schema?: Json
          name_th: string
          price_model: Database["public"]["Enums"]["price_model"]
          pricing_config?: Json
          service_category_id: string
          status?: Database["public"]["Enums"]["catalog_status"]
          updated_at?: string
          warranty_days?: number | null
        }
        Update: {
          approved_by?: string | null
          base_labor_price?: number | null
          code?: string
          created_at?: string
          currency?: string
          description_th?: string | null
          effective_from?: string | null
          effective_until?: string | null
          id?: string
          intake_schema?: Json
          name_th?: string
          price_model?: Database["public"]["Enums"]["price_model"]
          pricing_config?: Json
          service_category_id?: string
          status?: Database["public"]["Enums"]["catalog_status"]
          updated_at?: string
          warranty_days?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "service_items_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_items_service_category_id_fkey"
            columns: ["service_category_id"]
            isOneToOne: false
            referencedRelation: "service_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      service_locations: {
        Row: {
          access_instructions: string | null
          address_line: string
          building: string | null
          created_at: string
          customer_id: string
          floor: string | null
          id: string
          is_default: boolean
          label: string
          latitude: number | null
          longitude: number | null
          unit: string | null
          updated_at: string
        }
        Insert: {
          access_instructions?: string | null
          address_line: string
          building?: string | null
          created_at?: string
          customer_id: string
          floor?: string | null
          id?: string
          is_default?: boolean
          label: string
          latitude?: number | null
          longitude?: number | null
          unit?: string | null
          updated_at?: string
        }
        Update: {
          access_instructions?: string | null
          address_line?: string
          building?: string | null
          created_at?: string
          customer_id?: string
          floor?: string | null
          id?: string
          is_default?: boolean
          label?: string
          latitude?: number | null
          longitude?: number | null
          unit?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_locations_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      technician_documents: {
        Row: {
          created_at: string
          document_type: Database["public"]["Enums"]["technician_document_type"]
          id: string
          rejection_reason: string | null
          review_status: Database["public"]["Enums"]["document_review_status"]
          reviewed_at: string | null
          reviewed_by: string | null
          storage_path: string
          submitted_at: string
          technician_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          document_type: Database["public"]["Enums"]["technician_document_type"]
          id?: string
          rejection_reason?: string | null
          review_status?: Database["public"]["Enums"]["document_review_status"]
          reviewed_at?: string | null
          reviewed_by?: string | null
          storage_path: string
          submitted_at?: string
          technician_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          document_type?: Database["public"]["Enums"]["technician_document_type"]
          id?: string
          rejection_reason?: string | null
          review_status?: Database["public"]["Enums"]["document_review_status"]
          reviewed_at?: string | null
          reviewed_by?: string | null
          storage_path?: string
          submitted_at?: string
          technician_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "technician_documents_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "technician_documents_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "technician_profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      technician_profiles: {
        Row: {
          bio: string | null
          created_at: string
          kyc_notice_acknowledged_at: string | null
          kyc_notice_version: string | null
          rejection_reason: string | null
          submitted_at: string | null
          updated_at: string
          user_id: string
          verification_status: Database["public"]["Enums"]["technician_verification_status"]
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          bio?: string | null
          created_at?: string
          kyc_notice_acknowledged_at?: string | null
          kyc_notice_version?: string | null
          rejection_reason?: string | null
          submitted_at?: string | null
          updated_at?: string
          user_id: string
          verification_status?: Database["public"]["Enums"]["technician_verification_status"]
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          bio?: string | null
          created_at?: string
          kyc_notice_acknowledged_at?: string | null
          kyc_notice_version?: string | null
          rejection_reason?: string | null
          submitted_at?: string | null
          updated_at?: string
          user_id?: string
          verification_status?: Database["public"]["Enums"]["technician_verification_status"]
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "technician_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "technician_profiles_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      technician_skills: {
        Row: {
          created_at: string
          is_active: boolean
          service_category_id: string
          technician_id: string
          updated_at: string
          years_experience: number | null
        }
        Insert: {
          created_at?: string
          is_active?: boolean
          service_category_id: string
          technician_id: string
          updated_at?: string
          years_experience?: number | null
        }
        Update: {
          created_at?: string
          is_active?: boolean
          service_category_id?: string
          technician_id?: string
          updated_at?: string
          years_experience?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "technician_skills_service_category_id_fkey"
            columns: ["service_category_id"]
            isOneToOne: false
            referencedRelation: "service_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "technician_skills_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "technician_profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      acknowledge_technician_kyc_notice: {
        Args: never
        Returns: {
          bio: string | null
          created_at: string
          kyc_notice_acknowledged_at: string | null
          kyc_notice_version: string | null
          rejection_reason: string | null
          submitted_at: string | null
          updated_at: string
          user_id: string
          verification_status: Database["public"]["Enums"]["technician_verification_status"]
          verified_at: string | null
          verified_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "technician_profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      bootstrap_technician_application: {
        Args: never
        Returns: {
          bio: string | null
          created_at: string
          kyc_notice_acknowledged_at: string | null
          kyc_notice_version: string | null
          rejection_reason: string | null
          submitted_at: string | null
          updated_at: string
          user_id: string
          verification_status: Database["public"]["Enums"]["technician_verification_status"]
          verified_at: string | null
          verified_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "technician_profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      can_delete_technician_document_file: {
        Args: { p_storage_path: string }
        Returns: boolean
      }
      deactivate_own_account: {
        Args: never
        Returns: Database["public"]["Enums"]["account_status"]
      }
      decide_technician_profile: {
        Args: {
          p_decision: Database["public"]["Enums"]["technician_verification_status"]
          p_reason?: string
          p_technician_id: string
        }
        Returns: {
          bio: string | null
          created_at: string
          kyc_notice_acknowledged_at: string | null
          kyc_notice_version: string | null
          rejection_reason: string | null
          submitted_at: string | null
          updated_at: string
          user_id: string
          verification_status: Database["public"]["Enums"]["technician_verification_status"]
          verified_at: string | null
          verified_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "technician_profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      delete_service_location: {
        Args: { p_location_id: string }
        Returns: string
      }
      get_technician_review_application: {
        Args: { p_technician_id: string }
        Returns: {
          bio: string
          display_name: string
          kyc_notice_acknowledged_at: string
          kyc_notice_version: string
          submitted_at: string
          technician_id: string
          verification_status: Database["public"]["Enums"]["technician_verification_status"]
        }[]
      }
      has_account_role: {
        Args: { required_role: Database["public"]["Enums"]["account_role"] }
        Returns: boolean
      }
      has_required_technician_documents: {
        Args: { p_technician_id: string }
        Returns: boolean
      }
      list_pending_technician_applications: {
        Args: never
        Returns: {
          bio: string
          display_name: string
          document_count: number
          pending_document_count: number
          reviewed_document_count: number
          submitted_at: string
          technician_id: string
        }[]
      }
      list_public_technicians: {
        Args: never
        Returns: {
          avatar_path: string
          bio: string
          display_name: string
          technician_id: string
          verified_at: string
        }[]
      }
      list_technician_review_documents: {
        Args: { p_technician_id: string }
        Returns: {
          document_id: string
          document_type: Database["public"]["Enums"]["technician_document_type"]
          rejection_reason: string
          review_status: Database["public"]["Enums"]["document_review_status"]
          reviewed_at: string
          storage_path: string
          submitted_at: string
        }[]
      }
      list_technician_review_history: {
        Args: { p_technician_id: string }
        Returns: {
          action: string
          created_at: string
          decision: string
          entity_type: string
          event_id: string
          reason: string
        }[]
      }
      promote_required_technician_document: {
        Args: {
          p_current_document_id: string
          p_document_type: Database["public"]["Enums"]["technician_document_type"]
          p_staged_document_id: string
        }
        Returns: {
          created_at: string
          document_type: Database["public"]["Enums"]["technician_document_type"]
          id: string
          rejection_reason: string | null
          review_status: Database["public"]["Enums"]["document_review_status"]
          reviewed_at: string | null
          reviewed_by: string | null
          storage_path: string
          submitted_at: string
          technician_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "technician_documents"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      review_technician_document: {
        Args: {
          p_decision: Database["public"]["Enums"]["document_review_status"]
          p_document_id: string
          p_reason?: string
        }
        Returns: {
          created_at: string
          document_type: Database["public"]["Enums"]["technician_document_type"]
          id: string
          rejection_reason: string | null
          review_status: Database["public"]["Enums"]["document_review_status"]
          reviewed_at: string | null
          reviewed_by: string | null
          storage_path: string
          submitted_at: string
          technician_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "technician_documents"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      save_service_location: {
        Args: {
          p_access_instructions?: string
          p_address_line: string
          p_building?: string
          p_floor?: string
          p_is_default?: boolean
          p_label: string
          p_location_id?: string
          p_unit?: string
        }
        Returns: {
          access_instructions: string | null
          address_line: string
          building: string | null
          created_at: string
          customer_id: string
          floor: string | null
          id: string
          is_default: boolean
          label: string
          latitude: number | null
          longitude: number | null
          unit: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "service_locations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_default_service_location: {
        Args: { p_location_id: string }
        Returns: {
          access_instructions: string | null
          address_line: string
          building: string | null
          created_at: string
          customer_id: string
          floor: string | null
          id: string
          is_default: boolean
          label: string
          latitude: number | null
          longitude: number | null
          unit: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "service_locations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      submit_technician_profile: {
        Args: never
        Returns: Database["public"]["Enums"]["technician_verification_status"]
      }
    }
    Enums: {
      account_role: "customer" | "technician" | "administrator"
      account_status: "active" | "deactivated"
      admin_permission:
        | "technician_review"
        | "role_management"
        | "catalog_management"
        | "audit_view"
      catalog_status: "draft" | "pilot" | "active" | "inactive"
      document_review_status: "pending" | "approved" | "rejected"
      price_model: "fixed" | "evidence_quote" | "onsite_inspection"
      technician_document_type:
        | "national_id"
        | "selfie"
        | "professional_certificate"
        | "criminal_record"
        | "other"
      technician_verification_status:
        | "draft"
        | "pending_review"
        | "verified"
        | "rejected"
        | "suspended"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      account_role: ["customer", "technician", "administrator"],
      account_status: ["active", "deactivated"],
      admin_permission: [
        "technician_review",
        "role_management",
        "catalog_management",
        "audit_view",
      ],
      catalog_status: ["draft", "pilot", "active", "inactive"],
      document_review_status: ["pending", "approved", "rejected"],
      price_model: ["fixed", "evidence_quote", "onsite_inspection"],
      technician_document_type: [
        "national_id",
        "selfie",
        "professional_certificate",
        "criminal_record",
        "other",
      ],
      technician_verification_status: [
        "draft",
        "pending_review",
        "verified",
        "rejected",
        "suspended",
      ],
    },
  },
} as const

