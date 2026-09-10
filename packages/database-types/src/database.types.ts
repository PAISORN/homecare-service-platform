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
      appointments: {
        Row: {
          access_instructions: string | null
          address_line: string
          building: string | null
          created_at: string
          floor: string | null
          id: string
          latitude: number | null
          location_label: string
          longitude: number | null
          scheduled_date: string
          service_job_id: string
          service_location_id: string
          status: Database["public"]["Enums"]["appointment_status"]
          time_window: string
          unit: string | null
          updated_at: string
        }
        Insert: {
          access_instructions?: string | null
          address_line: string
          building?: string | null
          created_at?: string
          floor?: string | null
          id?: string
          latitude?: number | null
          location_label: string
          longitude?: number | null
          scheduled_date: string
          service_job_id: string
          service_location_id: string
          status?: Database["public"]["Enums"]["appointment_status"]
          time_window: string
          unit?: string | null
          updated_at?: string
        }
        Update: {
          access_instructions?: string | null
          address_line?: string
          building?: string | null
          created_at?: string
          floor?: string | null
          id?: string
          latitude?: number | null
          location_label?: string
          longitude?: number | null
          scheduled_date?: string
          service_job_id?: string
          service_location_id?: string
          status?: Database["public"]["Enums"]["appointment_status"]
          time_window?: string
          unit?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_service_job_id_fkey"
            columns: ["service_job_id"]
            isOneToOne: true
            referencedRelation: "service_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_service_location_id_fkey"
            columns: ["service_location_id"]
            isOneToOne: false
            referencedRelation: "service_locations"
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
      chat_messages: {
        Row: {
          body: string
          chat_room_id: string
          client_message_id: string
          created_at: string
          id: string
          sender_user_id: string
        }
        Insert: {
          body: string
          chat_room_id: string
          client_message_id: string
          created_at?: string
          id?: string
          sender_user_id: string
        }
        Update: {
          body?: string
          chat_room_id?: string
          client_message_id?: string
          created_at?: string
          id?: string
          sender_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_chat_room_id_fkey"
            columns: ["chat_room_id"]
            isOneToOne: false
            referencedRelation: "chat_rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_sender_user_id_fkey"
            columns: ["sender_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_room_memberships: {
        Row: {
          chat_room_id: string
          created_at: string
          member_role: string
          user_id: string
        }
        Insert: {
          chat_room_id: string
          created_at?: string
          member_role: string
          user_id: string
        }
        Update: {
          chat_room_id?: string
          created_at?: string
          member_role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_room_memberships_chat_room_id_fkey"
            columns: ["chat_room_id"]
            isOneToOne: false
            referencedRelation: "chat_rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_room_memberships_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_rooms: {
        Row: {
          created_at: string
          id: string
          service_job_id: string
          topic: string
        }
        Insert: {
          created_at?: string
          id?: string
          service_job_id: string
          topic: string
        }
        Update: {
          created_at?: string
          id?: string
          service_job_id?: string
          topic?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_rooms_service_job_id_fkey"
            columns: ["service_job_id"]
            isOneToOne: true
            referencedRelation: "service_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      job_status_events: {
        Row: {
          actor_user_id: string | null
          created_at: string
          from_status: Database["public"]["Enums"]["service_job_status"] | null
          id: string
          reason: string | null
          service_job_id: string
          to_status: Database["public"]["Enums"]["service_job_status"]
        }
        Insert: {
          actor_user_id?: string | null
          created_at?: string
          from_status?: Database["public"]["Enums"]["service_job_status"] | null
          id?: string
          reason?: string | null
          service_job_id: string
          to_status: Database["public"]["Enums"]["service_job_status"]
        }
        Update: {
          actor_user_id?: string | null
          created_at?: string
          from_status?: Database["public"]["Enums"]["service_job_status"] | null
          id?: string
          reason?: string | null
          service_job_id?: string
          to_status?: Database["public"]["Enums"]["service_job_status"]
        }
        Relationships: [
          {
            foreignKeyName: "job_status_events_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_status_events_service_job_id_fkey"
            columns: ["service_job_id"]
            isOneToOne: false
            referencedRelation: "service_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      job_travel_locations: {
        Row: {
          accuracy_meters: number | null
          captured_at: string
          latitude: number
          longitude: number
          service_job_id: string
          technician_id: string
          updated_at: string
        }
        Insert: {
          accuracy_meters?: number | null
          captured_at: string
          latitude: number
          longitude: number
          service_job_id: string
          technician_id: string
          updated_at?: string
        }
        Update: {
          accuracy_meters?: number | null
          captured_at?: string
          latitude?: number
          longitude?: number
          service_job_id?: string
          technician_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_travel_locations_service_job_id_fkey"
            columns: ["service_job_id"]
            isOneToOne: true
            referencedRelation: "service_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_travel_locations_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "technician_profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      notifications: {
        Row: {
          actor_user_id: string
          attempt_count: number
          body: string
          created_at: string
          data: Json
          deep_link: string
          delivery_status: Database["public"]["Enums"]["notification_delivery_status"]
          event_key: string
          id: string
          last_attempt_at: string | null
          last_error: string | null
          next_attempt_at: string
          provider_response: Json | null
          read_at: string | null
          recipient_user_id: string
          service_job_id: string
          source_record_id: string
          submitted_at: string | null
          title: string
        }
        Insert: {
          actor_user_id: string
          attempt_count?: number
          body: string
          created_at?: string
          data?: Json
          deep_link: string
          delivery_status?: Database["public"]["Enums"]["notification_delivery_status"]
          event_key: string
          id?: string
          last_attempt_at?: string | null
          last_error?: string | null
          next_attempt_at?: string
          provider_response?: Json | null
          read_at?: string | null
          recipient_user_id: string
          service_job_id: string
          source_record_id: string
          submitted_at?: string | null
          title: string
        }
        Update: {
          actor_user_id?: string
          attempt_count?: number
          body?: string
          created_at?: string
          data?: Json
          deep_link?: string
          delivery_status?: Database["public"]["Enums"]["notification_delivery_status"]
          event_key?: string
          id?: string
          last_attempt_at?: string | null
          last_error?: string | null
          next_attempt_at?: string
          provider_response?: Json | null
          read_at?: string | null
          recipient_user_id?: string
          service_job_id?: string
          source_record_id?: string
          submitted_at?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_recipient_user_id_fkey"
            columns: ["recipient_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_service_job_id_fkey"
            columns: ["service_job_id"]
            isOneToOne: false
            referencedRelation: "service_jobs"
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
      push_devices: {
        Row: {
          created_at: string
          enabled: boolean
          expo_push_token: string
          id: string
          installation_id: string
          last_registered_at: string
          platform: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          expo_push_token: string
          id?: string
          installation_id: string
          last_registered_at?: string
          platform: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          expo_push_token?: string
          id?: string
          installation_id?: string
          last_registered_at?: string
          platform?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_devices_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      quotations: {
        Row: {
          created_at: string
          currency: string
          id: string
          labor_amount: number
          scope_description: string
          service_request_id: string
          status: Database["public"]["Enums"]["quotation_status"]
          submitted_at: string
          technician_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency?: string
          id?: string
          labor_amount: number
          scope_description: string
          service_request_id: string
          status?: Database["public"]["Enums"]["quotation_status"]
          submitted_at?: string
          technician_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency?: string
          id?: string
          labor_amount?: number
          scope_description?: string
          service_request_id?: string
          status?: Database["public"]["Enums"]["quotation_status"]
          submitted_at?: string
          technician_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quotations_service_request_id_fkey"
            columns: ["service_request_id"]
            isOneToOne: false
            referencedRelation: "service_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotations_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "technician_profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      request_attachments: {
        Row: {
          created_at: string
          customer_id: string
          id: string
          mime_type: string
          service_request_id: string
          size_bytes: number
          storage_path: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          id?: string
          mime_type: string
          service_request_id: string
          size_bytes: number
          storage_path: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          id?: string
          mime_type?: string
          service_request_id?: string
          size_bytes?: number
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "request_attachments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "request_attachments_service_request_id_fkey"
            columns: ["service_request_id"]
            isOneToOne: false
            referencedRelation: "service_requests"
            referencedColumns: ["id"]
          },
        ]
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
      service_job_acceptances: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          currency: string
          customer_id: string
          help_reason: string | null
          help_requested_at: string | null
          payment_mode: string
          review_deadline_at: string
          review_started_at: string
          service_job_id: string
          status: Database["public"]["Enums"]["service_job_acceptance_status"]
          technician_id: string
          total_amount_snapshot: number
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          currency: string
          customer_id: string
          help_reason?: string | null
          help_requested_at?: string | null
          payment_mode: string
          review_deadline_at: string
          review_started_at: string
          service_job_id: string
          status?: Database["public"]["Enums"]["service_job_acceptance_status"]
          technician_id: string
          total_amount_snapshot: number
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          currency?: string
          customer_id?: string
          help_reason?: string | null
          help_requested_at?: string | null
          payment_mode?: string
          review_deadline_at?: string
          review_started_at?: string
          service_job_id?: string
          status?: Database["public"]["Enums"]["service_job_acceptance_status"]
          technician_id?: string
          total_amount_snapshot?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_job_acceptances_accepted_by_fkey"
            columns: ["accepted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_job_acceptances_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_job_acceptances_service_job_id_fkey"
            columns: ["service_job_id"]
            isOneToOne: true
            referencedRelation: "service_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_job_acceptances_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      service_job_additional_work_requests: {
        Row: {
          created_at: string
          currency: string
          evidence_id: string
          id: string
          labor_amount: number
          materials_amount: number
          reason: string
          responded_at: string | null
          responded_by: string | null
          scope_description: string
          service_job_id: string
          status: Database["public"]["Enums"]["additional_work_request_status"]
          technician_id: string
        }
        Insert: {
          created_at?: string
          currency: string
          evidence_id: string
          id?: string
          labor_amount?: number
          materials_amount?: number
          reason: string
          responded_at?: string | null
          responded_by?: string | null
          scope_description: string
          service_job_id: string
          status?: Database["public"]["Enums"]["additional_work_request_status"]
          technician_id: string
        }
        Update: {
          created_at?: string
          currency?: string
          evidence_id?: string
          id?: string
          labor_amount?: number
          materials_amount?: number
          reason?: string
          responded_at?: string | null
          responded_by?: string | null
          scope_description?: string
          service_job_id?: string
          status?: Database["public"]["Enums"]["additional_work_request_status"]
          technician_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_job_additional_work_requests_evidence_id_fkey"
            columns: ["evidence_id"]
            isOneToOne: true
            referencedRelation: "service_job_evidence"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_job_additional_work_requests_responded_by_fkey"
            columns: ["responded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_job_additional_work_requests_service_job_id_fkey"
            columns: ["service_job_id"]
            isOneToOne: false
            referencedRelation: "service_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_job_additional_work_requests_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "technician_profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      service_job_evidence: {
        Row: {
          created_at: string
          created_by: string
          evidence_type: Database["public"]["Enums"]["service_job_evidence_type"]
          id: string
          mime_type: string
          service_job_id: string
          size_bytes: number
          storage_path: string
        }
        Insert: {
          created_at?: string
          created_by: string
          evidence_type: Database["public"]["Enums"]["service_job_evidence_type"]
          id?: string
          mime_type: string
          service_job_id: string
          size_bytes: number
          storage_path: string
        }
        Update: {
          created_at?: string
          created_by?: string
          evidence_type?: Database["public"]["Enums"]["service_job_evidence_type"]
          id?: string
          mime_type?: string
          service_job_id?: string
          size_bytes?: number
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_job_evidence_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_job_evidence_service_job_id_fkey"
            columns: ["service_job_id"]
            isOneToOne: false
            referencedRelation: "service_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      service_job_pins: {
        Row: {
          consumed_at: string | null
          created_at: string
          created_by: string
          expires_at: string
          failed_attempts: number
          id: string
          invalidated_at: string | null
          pin_hash: string
          purpose: Database["public"]["Enums"]["service_job_pin_purpose"]
          service_job_id: string
        }
        Insert: {
          consumed_at?: string | null
          created_at?: string
          created_by: string
          expires_at: string
          failed_attempts?: number
          id?: string
          invalidated_at?: string | null
          pin_hash: string
          purpose: Database["public"]["Enums"]["service_job_pin_purpose"]
          service_job_id: string
        }
        Update: {
          consumed_at?: string | null
          created_at?: string
          created_by?: string
          expires_at?: string
          failed_attempts?: number
          id?: string
          invalidated_at?: string | null
          pin_hash?: string
          purpose?: Database["public"]["Enums"]["service_job_pin_purpose"]
          service_job_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_job_pins_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_job_pins_service_job_id_fkey"
            columns: ["service_job_id"]
            isOneToOne: false
            referencedRelation: "service_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      service_jobs: {
        Row: {
          agreement_revision: number
          commission_amount: number | null
          created_at: string
          currency: string
          customer_id: string
          id: string
          job_number: string
          labor_amount: number
          labor_commission_rate: number
          materials_amount: number
          price_model: Database["public"]["Enums"]["price_model"]
          scope_description: string
          service_category_id: string
          service_item_id: string | null
          service_request_id: string
          status: Database["public"]["Enums"]["service_job_status"]
          technician_id: string
          technician_net_labor_amount: number | null
          total_amount: number | null
          updated_at: string
          warranty_days: number | null
        }
        Insert: {
          agreement_revision: number
          commission_amount?: number | null
          created_at?: string
          currency: string
          customer_id: string
          id?: string
          job_number: string
          labor_amount: number
          labor_commission_rate: number
          materials_amount?: number
          price_model: Database["public"]["Enums"]["price_model"]
          scope_description: string
          service_category_id: string
          service_item_id?: string | null
          service_request_id: string
          status?: Database["public"]["Enums"]["service_job_status"]
          technician_id: string
          technician_net_labor_amount?: number | null
          total_amount?: number | null
          updated_at?: string
          warranty_days?: number | null
        }
        Update: {
          agreement_revision?: number
          commission_amount?: number | null
          created_at?: string
          currency?: string
          customer_id?: string
          id?: string
          job_number?: string
          labor_amount?: number
          labor_commission_rate?: number
          materials_amount?: number
          price_model?: Database["public"]["Enums"]["price_model"]
          scope_description?: string
          service_category_id?: string
          service_item_id?: string | null
          service_request_id?: string
          status?: Database["public"]["Enums"]["service_job_status"]
          technician_id?: string
          technician_net_labor_amount?: number | null
          total_amount?: number | null
          updated_at?: string
          warranty_days?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "service_jobs_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_jobs_service_category_id_fkey"
            columns: ["service_category_id"]
            isOneToOne: false
            referencedRelation: "service_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_jobs_service_item_id_fkey"
            columns: ["service_item_id"]
            isOneToOne: false
            referencedRelation: "service_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_jobs_service_request_id_fkey"
            columns: ["service_request_id"]
            isOneToOne: true
            referencedRelation: "service_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_jobs_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "technician_profiles"
            referencedColumns: ["user_id"]
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
      service_request_agreements: {
        Row: {
          appointment_date: string | null
          appointment_time_window: string | null
          created_at: string
          currency: string
          customer_confirmed_revision: number | null
          customer_id: string
          fully_confirmed_at: string | null
          labor_amount: number
          revision: number
          scope_description: string
          service_request_id: string
          technician_confirmed_revision: number | null
          technician_id: string
          updated_at: string
          updated_by: string
        }
        Insert: {
          appointment_date?: string | null
          appointment_time_window?: string | null
          created_at?: string
          currency: string
          customer_confirmed_revision?: number | null
          customer_id: string
          fully_confirmed_at?: string | null
          labor_amount: number
          revision?: number
          scope_description: string
          service_request_id: string
          technician_confirmed_revision?: number | null
          technician_id: string
          updated_at?: string
          updated_by: string
        }
        Update: {
          appointment_date?: string | null
          appointment_time_window?: string | null
          created_at?: string
          currency?: string
          customer_confirmed_revision?: number | null
          customer_id?: string
          fully_confirmed_at?: string | null
          labor_amount?: number
          revision?: number
          scope_description?: string
          service_request_id?: string
          technician_confirmed_revision?: number | null
          technician_id?: string
          updated_at?: string
          updated_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_request_agreements_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_request_agreements_service_request_id_fkey"
            columns: ["service_request_id"]
            isOneToOne: true
            referencedRelation: "service_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_request_agreements_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "technician_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "service_request_agreements_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      service_request_selections: {
        Row: {
          agreed_labor_amount: number
          currency: string
          customer_id: string
          price_model: Database["public"]["Enums"]["price_model"]
          quotation_id: string | null
          selected_at: string
          service_request_id: string
          technician_id: string
          technician_interest_id: string
        }
        Insert: {
          agreed_labor_amount: number
          currency?: string
          customer_id: string
          price_model: Database["public"]["Enums"]["price_model"]
          quotation_id?: string | null
          selected_at?: string
          service_request_id: string
          technician_id: string
          technician_interest_id: string
        }
        Update: {
          agreed_labor_amount?: number
          currency?: string
          customer_id?: string
          price_model?: Database["public"]["Enums"]["price_model"]
          quotation_id?: string | null
          selected_at?: string
          service_request_id?: string
          technician_id?: string
          technician_interest_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_request_selections_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_request_selections_quotation_id_fkey"
            columns: ["quotation_id"]
            isOneToOne: true
            referencedRelation: "quotations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_request_selections_service_request_id_fkey"
            columns: ["service_request_id"]
            isOneToOne: true
            referencedRelation: "service_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_request_selections_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "technician_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "service_request_selections_technician_interest_id_fkey"
            columns: ["technician_interest_id"]
            isOneToOne: true
            referencedRelation: "technician_interests"
            referencedColumns: ["id"]
          },
        ]
      }
      service_requests: {
        Row: {
          created_at: string
          customer_id: string
          entry_point: Database["public"]["Enums"]["request_entry_point"]
          id: string
          intake_answers: Json
          preferred_date: string | null
          preferred_time_window: string | null
          problem_description: string
          quantity: number
          safety_answers: Json
          safety_status: Database["public"]["Enums"]["request_safety_status"]
          safety_stop_code: string | null
          service_category_id: string
          service_item_id: string | null
          service_location_id: string
          status: Database["public"]["Enums"]["service_request_status"]
          submitted_at: string | null
          updated_at: string
          urgency: Database["public"]["Enums"]["request_urgency"]
        }
        Insert: {
          created_at?: string
          customer_id: string
          entry_point: Database["public"]["Enums"]["request_entry_point"]
          id?: string
          intake_answers?: Json
          preferred_date?: string | null
          preferred_time_window?: string | null
          problem_description: string
          quantity?: number
          safety_answers?: Json
          safety_status?: Database["public"]["Enums"]["request_safety_status"]
          safety_stop_code?: string | null
          service_category_id: string
          service_item_id?: string | null
          service_location_id: string
          status?: Database["public"]["Enums"]["service_request_status"]
          submitted_at?: string | null
          updated_at?: string
          urgency?: Database["public"]["Enums"]["request_urgency"]
        }
        Update: {
          created_at?: string
          customer_id?: string
          entry_point?: Database["public"]["Enums"]["request_entry_point"]
          id?: string
          intake_answers?: Json
          preferred_date?: string | null
          preferred_time_window?: string | null
          problem_description?: string
          quantity?: number
          safety_answers?: Json
          safety_status?: Database["public"]["Enums"]["request_safety_status"]
          safety_stop_code?: string | null
          service_category_id?: string
          service_item_id?: string | null
          service_location_id?: string
          status?: Database["public"]["Enums"]["service_request_status"]
          submitted_at?: string | null
          updated_at?: string
          urgency?: Database["public"]["Enums"]["request_urgency"]
        }
        Relationships: [
          {
            foreignKeyName: "service_requests_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_requests_service_category_id_fkey"
            columns: ["service_category_id"]
            isOneToOne: false
            referencedRelation: "service_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_requests_service_item_id_fkey"
            columns: ["service_item_id"]
            isOneToOne: false
            referencedRelation: "service_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_requests_service_location_id_fkey"
            columns: ["service_location_id"]
            isOneToOne: false
            referencedRelation: "service_locations"
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
      technician_interests: {
        Row: {
          created_at: string
          id: string
          service_request_id: string
          status: Database["public"]["Enums"]["technician_interest_status"]
          technician_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          service_request_id: string
          status?: Database["public"]["Enums"]["technician_interest_status"]
          technician_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          service_request_id?: string
          status?: Database["public"]["Enums"]["technician_interest_status"]
          technician_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "technician_interests_service_request_id_fkey"
            columns: ["service_request_id"]
            isOneToOne: false
            referencedRelation: "service_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "technician_interests_technician_id_fkey"
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
      cancel_service_request: {
        Args: { p_request_id: string }
        Returns: {
          created_at: string
          customer_id: string
          entry_point: Database["public"]["Enums"]["request_entry_point"]
          id: string
          intake_answers: Json
          preferred_date: string | null
          preferred_time_window: string | null
          problem_description: string
          quantity: number
          safety_answers: Json
          safety_status: Database["public"]["Enums"]["request_safety_status"]
          safety_stop_code: string | null
          service_category_id: string
          service_item_id: string | null
          service_location_id: string
          status: Database["public"]["Enums"]["service_request_status"]
          submitted_at: string | null
          updated_at: string
          urgency: Database["public"]["Enums"]["request_urgency"]
        }
        SetofOptions: {
          from: "*"
          to: "service_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      cancel_service_request_draft: {
        Args: { p_request_id: string }
        Returns: {
          created_at: string
          customer_id: string
          entry_point: Database["public"]["Enums"]["request_entry_point"]
          id: string
          intake_answers: Json
          preferred_date: string | null
          preferred_time_window: string | null
          problem_description: string
          quantity: number
          safety_answers: Json
          safety_status: Database["public"]["Enums"]["request_safety_status"]
          safety_stop_code: string | null
          service_category_id: string
          service_item_id: string | null
          service_location_id: string
          status: Database["public"]["Enums"]["service_request_status"]
          submitted_at: string | null
          updated_at: string
          urgency: Database["public"]["Enums"]["request_urgency"]
        }
        SetofOptions: {
          from: "*"
          to: "service_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      claim_job_notifications_for_actor: {
        Args: { p_actor_id: string; p_limit?: number }
        Returns: {
          actor_user_id: string
          attempt_count: number
          body: string
          created_at: string
          data: Json
          deep_link: string
          delivery_status: Database["public"]["Enums"]["notification_delivery_status"]
          event_key: string
          id: string
          last_attempt_at: string | null
          last_error: string | null
          next_attempt_at: string
          provider_response: Json | null
          read_at: string | null
          recipient_user_id: string
          service_job_id: string
          source_record_id: string
          submitted_at: string | null
          title: string
        }[]
        SetofOptions: {
          from: "*"
          to: "notifications"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      confirm_service_job_acceptance: {
        Args: { p_job_id: string }
        Returns: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          currency: string
          customer_id: string
          help_reason: string | null
          help_requested_at: string | null
          payment_mode: string
          review_deadline_at: string
          review_started_at: string
          service_job_id: string
          status: Database["public"]["Enums"]["service_job_acceptance_status"]
          technician_id: string
          total_amount_snapshot: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "service_job_acceptances"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      confirm_service_request_agreement: {
        Args: { p_request_id: string }
        Returns: {
          appointment_date: string | null
          appointment_time_window: string | null
          created_at: string
          currency: string
          customer_confirmed_revision: number | null
          customer_id: string
          fully_confirmed_at: string | null
          labor_amount: number
          revision: number
          scope_description: string
          service_request_id: string
          technician_confirmed_revision: number | null
          technician_id: string
          updated_at: string
          updated_by: string
        }
        SetofOptions: {
          from: "*"
          to: "service_request_agreements"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_service_job_additional_work_request: {
        Args: {
          p_evidence_id: string
          p_job_id: string
          p_labor_amount: number
          p_materials_amount: number
          p_reason: string
          p_scope_description: string
        }
        Returns: {
          created_at: string
          currency: string
          evidence_id: string
          id: string
          labor_amount: number
          materials_amount: number
          reason: string
          responded_at: string | null
          responded_by: string | null
          scope_description: string
          service_job_id: string
          status: Database["public"]["Enums"]["additional_work_request_status"]
          technician_id: string
        }
        SetofOptions: {
          from: "*"
          to: "service_job_additional_work_requests"
          isOneToOne: true
          isSetofReturn: false
        }
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
      delete_request_attachment: {
        Args: { p_attachment_id: string }
        Returns: string
      }
      delete_service_location: {
        Args: { p_location_id: string }
        Returns: string
      }
      delete_unuploaded_service_job_evidence: {
        Args: { p_evidence_id: string }
        Returns: undefined
      }
      disable_push_device: {
        Args: { p_installation_id: string }
        Returns: boolean
      }
      express_technician_interest: {
        Args: { p_request_id: string }
        Returns: {
          created_at: string
          id: string
          service_request_id: string
          status: Database["public"]["Enums"]["technician_interest_status"]
          technician_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "technician_interests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_service_job: {
        Args: { p_job_id: string }
        Returns: {
          access_instructions: string
          actor_role: string
          address_line: string
          appointment_date: string
          appointment_time_window: string
          building: string
          category_name_th: string
          commission_amount: number
          created_at: string
          currency: string
          customer_display_name: string
          floor: string
          item_name_th: string
          job_id: string
          job_number: string
          job_status: Database["public"]["Enums"]["service_job_status"]
          labor_amount: number
          labor_commission_rate: number
          location_label: string
          materials_amount: number
          scope_description: string
          service_request_id: string
          technician_display_name: string
          technician_net_labor_amount: number
          total_amount: number
          unit: string
          updated_at: string
          warranty_days: number
        }[]
      }
      get_service_job_acceptance: {
        Args: { p_job_id: string }
        Returns: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          currency: string
          customer_id: string
          help_reason: string | null
          help_requested_at: string | null
          payment_mode: string
          review_deadline_at: string
          review_started_at: string
          service_job_id: string
          status: Database["public"]["Enums"]["service_job_acceptance_status"]
          technician_id: string
          total_amount_snapshot: number
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "service_job_acceptances"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_service_job_for_request: {
        Args: { p_request_id: string }
        Returns: {
          actor_role: string
          address_line: string
          appointment_date: string
          appointment_time_window: string
          building: string
          commission_amount: number
          created_at: string
          currency: string
          customer_display_name: string
          floor: string
          job_id: string
          job_number: string
          job_status: Database["public"]["Enums"]["service_job_status"]
          labor_amount: number
          labor_commission_rate: number
          location_label: string
          materials_amount: number
          scope_description: string
          technician_display_name: string
          technician_net_labor_amount: number
          total_amount: number
          unit: string
          warranty_days: number
        }[]
      }
      get_service_job_travel_progress: {
        Args: { p_job_id: string }
        Returns: {
          accuracy_meters: number
          captured_at: string
          destination_ready: boolean
          estimated_minutes: number
          is_stale: boolean
          job_status: Database["public"]["Enums"]["service_job_status"]
          latitude: number
          longitude: number
          refresh_interval_seconds: number
          sharing_active: boolean
          straight_line_distance_km: number
        }[]
      }
      get_service_request_agreement: {
        Args: { p_request_id: string }
        Returns: {
          actor_role: string
          address_line: string
          appointment_date: string
          appointment_time_window: string
          building: string
          category_name_th: string
          currency: string
          customer_confirmed: boolean
          customer_display_name: string
          floor: string
          fully_confirmed_at: string
          item_name_th: string
          labor_amount: number
          location_label: string
          problem_description: string
          quantity: number
          request_id: string
          revision: number
          scope_description: string
          technician_confirmed: boolean
          technician_display_name: string
          unit: string
          updated_at: string
        }[]
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
      issue_service_job_pin: {
        Args: {
          p_job_id: string
          p_purpose: Database["public"]["Enums"]["service_job_pin_purpose"]
        }
        Returns: string
      }
      list_customer_request_shortlist: {
        Args: { p_request_id: string }
        Returns: {
          catalog_labor_amount: number
          currency: string
          display_name: string
          interest_created_at: string
          is_selected: boolean
          price_model: Database["public"]["Enums"]["price_model"]
          quotation_id: string
          quotation_labor_amount: number
          quotation_scope_description: string
          quotation_submitted_at: string
          request_id: string
          request_status: Database["public"]["Enums"]["service_request_status"]
          shortlist_rank: number
          technician_bio: string
          technician_id: string
          years_experience: number
        }[]
      }
      list_matching_service_requests: {
        Args: never
        Returns: {
          category_name_th: string
          interest_status: Database["public"]["Enums"]["technician_interest_status"]
          item_name_th: string
          preferred_date: string
          preferred_time_window: string
          price_model: Database["public"]["Enums"]["price_model"]
          quantity: number
          quotation_labor_amount: number
          quotation_scope_description: string
          quotation_status: Database["public"]["Enums"]["quotation_status"]
          quotation_submitted_at: string
          request_id: string
          submitted_at: string
          urgency: Database["public"]["Enums"]["request_urgency"]
        }[]
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
      list_service_job_status_events: {
        Args: { p_job_id: string }
        Returns: {
          actor_display_name: string
          created_at: string
          event_id: string
          from_status: Database["public"]["Enums"]["service_job_status"]
          reason: string
          to_status: Database["public"]["Enums"]["service_job_status"]
        }[]
      }
      list_service_jobs: {
        Args: never
        Returns: {
          actor_role: string
          appointment_date: string
          appointment_time_window: string
          category_name_th: string
          counterpart_display_name: string
          currency: string
          item_name_th: string
          job_id: string
          job_number: string
          job_status: Database["public"]["Enums"]["service_job_status"]
          location_label: string
          service_request_id: string
          total_amount: number
          updated_at: string
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
      list_technician_selected_requests: {
        Args: never
        Returns: {
          appointment_date: string
          appointment_time_window: string
          category_name_th: string
          customer_confirmed: boolean
          customer_display_name: string
          fully_confirmed_at: string
          item_name_th: string
          request_id: string
          technician_confirmed: boolean
          updated_at: string
        }[]
      }
      mark_notification_read: {
        Args: { p_notification_id: string }
        Returns: boolean
      }
      process_due_service_job_acceptances: {
        Args: { p_limit?: number }
        Returns: number
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
      propose_service_request_appointment: {
        Args: {
          p_appointment_date: string
          p_appointment_time_window: string
          p_request_id: string
        }
        Returns: {
          appointment_date: string | null
          appointment_time_window: string | null
          created_at: string
          currency: string
          customer_confirmed_revision: number | null
          customer_id: string
          fully_confirmed_at: string | null
          labor_amount: number
          revision: number
          scope_description: string
          service_request_id: string
          technician_confirmed_revision: number | null
          technician_id: string
          updated_at: string
          updated_by: string
        }
        SetofOptions: {
          from: "*"
          to: "service_request_agreements"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      publish_service_job_travel_location: {
        Args: {
          p_accuracy_meters: number
          p_captured_at: string
          p_job_id: string
          p_latitude: number
          p_longitude: number
        }
        Returns: undefined
      }
      register_push_device: {
        Args: {
          p_expo_push_token: string
          p_installation_id: string
          p_platform: string
        }
        Returns: string
      }
      register_request_attachment: {
        Args: {
          p_mime_type: string
          p_service_request_id: string
          p_size_bytes: number
          p_storage_path: string
        }
        Returns: {
          created_at: string
          customer_id: string
          id: string
          mime_type: string
          service_request_id: string
          size_bytes: number
          storage_path: string
        }
        SetofOptions: {
          from: "*"
          to: "request_attachments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      register_service_job_evidence: {
        Args: {
          p_evidence_type: Database["public"]["Enums"]["service_job_evidence_type"]
          p_job_id: string
          p_mime_type: string
          p_size_bytes: number
          p_storage_path: string
        }
        Returns: {
          created_at: string
          created_by: string
          evidence_type: Database["public"]["Enums"]["service_job_evidence_type"]
          id: string
          mime_type: string
          service_job_id: string
          size_bytes: number
          storage_path: string
        }
        SetofOptions: {
          from: "*"
          to: "service_job_evidence"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      request_service_job_acceptance_help: {
        Args: { p_job_id: string; p_reason: string }
        Returns: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          currency: string
          customer_id: string
          help_reason: string | null
          help_requested_at: string | null
          payment_mode: string
          review_deadline_at: string
          review_started_at: string
          service_job_id: string
          status: Database["public"]["Enums"]["service_job_acceptance_status"]
          technician_id: string
          total_amount_snapshot: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "service_job_acceptances"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      respond_to_service_job_additional_work: {
        Args: { p_approve: boolean; p_request_id: string }
        Returns: {
          created_at: string
          currency: string
          evidence_id: string
          id: string
          labor_amount: number
          materials_amount: number
          reason: string
          responded_at: string | null
          responded_by: string | null
          scope_description: string
          service_job_id: string
          status: Database["public"]["Enums"]["additional_work_request_status"]
          technician_id: string
        }
        SetofOptions: {
          from: "*"
          to: "service_job_additional_work_requests"
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
      save_service_request_draft: {
        Args: {
          p_entry_point: Database["public"]["Enums"]["request_entry_point"]
          p_intake_answers: Json
          p_preferred_date: string
          p_preferred_time_window: string
          p_problem_description: string
          p_quantity: number
          p_request_id?: string
          p_safety_answers: Json
          p_service_category_id: string
          p_service_item_id: string
          p_service_location_id: string
          p_urgency: Database["public"]["Enums"]["request_urgency"]
        }
        Returns: {
          created_at: string
          customer_id: string
          entry_point: Database["public"]["Enums"]["request_entry_point"]
          id: string
          intake_answers: Json
          preferred_date: string | null
          preferred_time_window: string | null
          problem_description: string
          quantity: number
          safety_answers: Json
          safety_status: Database["public"]["Enums"]["request_safety_status"]
          safety_stop_code: string | null
          service_category_id: string
          service_item_id: string | null
          service_location_id: string
          status: Database["public"]["Enums"]["service_request_status"]
          submitted_at: string | null
          updated_at: string
          urgency: Database["public"]["Enums"]["request_urgency"]
        }
        SetofOptions: {
          from: "*"
          to: "service_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      select_technician_for_request: {
        Args: { p_request_id: string; p_technician_id: string }
        Returns: {
          agreed_labor_amount: number
          currency: string
          customer_id: string
          price_model: Database["public"]["Enums"]["price_model"]
          quotation_id: string | null
          selected_at: string
          service_request_id: string
          technician_id: string
          technician_interest_id: string
        }
        SetofOptions: {
          from: "*"
          to: "service_request_selections"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      send_service_job_message: {
        Args: { p_body: string; p_client_message_id: string; p_job_id: string }
        Returns: {
          body: string
          chat_room_id: string
          client_message_id: string
          created_at: string
          id: string
          sender_user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "chat_messages"
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
      stop_service_job_travel_sharing: {
        Args: { p_job_id: string }
        Returns: undefined
      }
      submit_service_request: {
        Args: { p_request_id: string }
        Returns: {
          created_at: string
          customer_id: string
          entry_point: Database["public"]["Enums"]["request_entry_point"]
          id: string
          intake_answers: Json
          preferred_date: string | null
          preferred_time_window: string | null
          problem_description: string
          quantity: number
          safety_answers: Json
          safety_status: Database["public"]["Enums"]["request_safety_status"]
          safety_stop_code: string | null
          service_category_id: string
          service_item_id: string | null
          service_location_id: string
          status: Database["public"]["Enums"]["service_request_status"]
          submitted_at: string | null
          updated_at: string
          urgency: Database["public"]["Enums"]["request_urgency"]
        }
        SetofOptions: {
          from: "*"
          to: "service_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      submit_technician_profile: {
        Args: never
        Returns: Database["public"]["Enums"]["technician_verification_status"]
      }
      submit_technician_quotation: {
        Args: {
          p_labor_amount: number
          p_request_id: string
          p_scope_description: string
        }
        Returns: {
          created_at: string
          currency: string
          id: string
          labor_amount: number
          scope_description: string
          service_request_id: string
          status: Database["public"]["Enums"]["quotation_status"]
          submitted_at: string
          technician_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "quotations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      transition_service_job: {
        Args: {
          p_expected_status: Database["public"]["Enums"]["service_job_status"]
          p_job_id: string
          p_new_status: Database["public"]["Enums"]["service_job_status"]
          p_reason?: string
        }
        Returns: {
          agreement_revision: number
          commission_amount: number | null
          created_at: string
          currency: string
          customer_id: string
          id: string
          job_number: string
          labor_amount: number
          labor_commission_rate: number
          materials_amount: number
          price_model: Database["public"]["Enums"]["price_model"]
          scope_description: string
          service_category_id: string
          service_item_id: string | null
          service_request_id: string
          status: Database["public"]["Enums"]["service_job_status"]
          technician_id: string
          technician_net_labor_amount: number | null
          total_amount: number | null
          updated_at: string
          warranty_days: number | null
        }
        SetofOptions: {
          from: "*"
          to: "service_jobs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_service_location_coordinates: {
        Args: { p_latitude: number; p_location_id: string; p_longitude: number }
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
      verify_service_job_pin: {
        Args: {
          p_job_id: string
          p_pin: string
          p_purpose: Database["public"]["Enums"]["service_job_pin_purpose"]
        }
        Returns: Json
      }
      withdraw_technician_interest: {
        Args: { p_request_id: string }
        Returns: {
          created_at: string
          id: string
          service_request_id: string
          status: Database["public"]["Enums"]["technician_interest_status"]
          technician_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "technician_interests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      account_role: "customer" | "technician" | "administrator"
      account_status: "active" | "deactivated"
      additional_work_request_status: "pending" | "approved" | "rejected"
      admin_permission:
        | "technician_review"
        | "role_management"
        | "catalog_management"
        | "audit_view"
      appointment_status: "scheduled" | "cancelled"
      catalog_status: "draft" | "pilot" | "active" | "inactive"
      document_review_status: "pending" | "approved" | "rejected"
      notification_delivery_status:
        | "pending"
        | "processing"
        | "submitted"
        | "failed"
        | "skipped"
      price_model: "fixed" | "evidence_quote" | "onsite_inspection"
      quotation_status: "submitted" | "withdrawn" | "accepted" | "declined"
      request_entry_point: "service_catalog" | "symptom"
      request_safety_status: "clear" | "stopped"
      request_urgency: "flexible" | "within_3_days" | "as_soon_as_possible"
      service_job_acceptance_status:
        | "pending"
        | "help_requested"
        | "customer_accepted"
        | "automatic_accepted"
      service_job_evidence_type:
        | "before"
        | "during"
        | "after"
        | "additional_work"
      service_job_pin_purpose: "start" | "completion"
      service_job_status:
        | "scheduled"
        | "technician_en_route"
        | "technician_arrived"
        | "in_progress"
        | "awaiting_additional_work_approval"
        | "awaiting_acceptance"
        | "completed"
        | "cancelled"
      service_request_status:
        | "draft"
        | "cancelled"
        | "matching"
        | "technician_selected"
      technician_document_type:
        | "national_id"
        | "selfie"
        | "professional_certificate"
        | "criminal_record"
        | "other"
      technician_interest_status: "active" | "withdrawn"
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
      additional_work_request_status: ["pending", "approved", "rejected"],
      admin_permission: [
        "technician_review",
        "role_management",
        "catalog_management",
        "audit_view",
      ],
      appointment_status: ["scheduled", "cancelled"],
      catalog_status: ["draft", "pilot", "active", "inactive"],
      document_review_status: ["pending", "approved", "rejected"],
      notification_delivery_status: [
        "pending",
        "processing",
        "submitted",
        "failed",
        "skipped",
      ],
      price_model: ["fixed", "evidence_quote", "onsite_inspection"],
      quotation_status: ["submitted", "withdrawn", "accepted", "declined"],
      request_entry_point: ["service_catalog", "symptom"],
      request_safety_status: ["clear", "stopped"],
      request_urgency: ["flexible", "within_3_days", "as_soon_as_possible"],
      service_job_acceptance_status: [
        "pending",
        "help_requested",
        "customer_accepted",
        "automatic_accepted",
      ],
      service_job_evidence_type: [
        "before",
        "during",
        "after",
        "additional_work",
      ],
      service_job_pin_purpose: ["start", "completion"],
      service_job_status: [
        "scheduled",
        "technician_en_route",
        "technician_arrived",
        "in_progress",
        "awaiting_additional_work_approval",
        "awaiting_acceptance",
        "completed",
        "cancelled",
      ],
      service_request_status: [
        "draft",
        "cancelled",
        "matching",
        "technician_selected",
      ],
      technician_document_type: [
        "national_id",
        "selfie",
        "professional_certificate",
        "criminal_record",
        "other",
      ],
      technician_interest_status: ["active", "withdrawn"],
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
