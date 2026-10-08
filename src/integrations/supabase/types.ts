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
      chat_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          role: string
          session_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          role: string
          session_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          role?: string
          session_id?: string
          user_id?: string
        }
        Relationships: []
      }
      contact_messages: {
        Row: {
          created_at: string | null
          email: string
          id: string
          ip_address: string | null
          message: string
          name: string
          phone: string | null
          status: string | null
          subject: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          id?: string
          ip_address?: string | null
          message: string
          name: string
          phone?: string | null
          status?: string | null
          subject: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
          ip_address?: string | null
          message?: string
          name?: string
          phone?: string | null
          status?: string | null
          subject?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      credit_transactions: {
        Row: {
          amount: number
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          order_id: string | null
          transaction_type: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          order_id?: string | null
          transaction_type: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          order_id?: string | null
          transaction_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_transactions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_logs: {
        Row: {
          action: string
          created_at: string | null
          details: Json | null
          employee_id: string
          entity_id: string | null
          entity_type: string
          id: string
        }
        Insert: {
          action: string
          created_at?: string | null
          details?: Json | null
          employee_id: string
          entity_id?: string | null
          entity_type: string
          id?: string
        }
        Update: {
          action?: string
          created_at?: string | null
          details?: Json | null
          employee_id?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
        }
        Relationships: []
      }
      fms_audit_log: {
        Row: {
          action: string
          entity_id: string | null
          entity_type: string
          id: string
          ip_address: string | null
          new_values: Json | null
          old_values: Json | null
          timestamp: string | null
          user_id: string
        }
        Insert: {
          action: string
          entity_id?: string | null
          entity_type: string
          id?: string
          ip_address?: string | null
          new_values?: Json | null
          old_values?: Json | null
          timestamp?: string | null
          user_id: string
        }
        Update: {
          action?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip_address?: string | null
          new_values?: Json | null
          old_values?: Json | null
          timestamp?: string | null
          user_id?: string
        }
        Relationships: []
      }
      fms_bom: {
        Row: {
          created_at: string | null
          created_by: string
          effective_date: string
          finished_good_id: string
          id: string
          max_soaking_days: number | null
          min_soaking_days: number | null
          obsolete_reason: string | null
          organoleptic_parameters: Json | null
          parent_finished_good_id: string | null
          processing_steps: Json | null
          status: string
          updated_at: string | null
          version_number: number
        }
        Insert: {
          created_at?: string | null
          created_by: string
          effective_date: string
          finished_good_id: string
          id?: string
          max_soaking_days?: number | null
          min_soaking_days?: number | null
          obsolete_reason?: string | null
          organoleptic_parameters?: Json | null
          parent_finished_good_id?: string | null
          processing_steps?: Json | null
          status?: string
          updated_at?: string | null
          version_number?: number
        }
        Update: {
          created_at?: string | null
          created_by?: string
          effective_date?: string
          finished_good_id?: string
          id?: string
          max_soaking_days?: number | null
          min_soaking_days?: number | null
          obsolete_reason?: string | null
          organoleptic_parameters?: Json | null
          parent_finished_good_id?: string | null
          processing_steps?: Json | null
          status?: string
          updated_at?: string | null
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "fms_bom_finished_good_id_fkey"
            columns: ["finished_good_id"]
            isOneToOne: false
            referencedRelation: "fms_stock_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fms_bom_parent_finished_good_id_fkey"
            columns: ["parent_finished_good_id"]
            isOneToOne: false
            referencedRelation: "fms_stock_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      fms_bom_components: {
        Row: {
          bom_id: string
          created_at: string | null
          id: string
          material_stock_code_id: string
          quantity_per_batch: number
        }
        Insert: {
          bom_id: string
          created_at?: string | null
          id?: string
          material_stock_code_id: string
          quantity_per_batch: number
        }
        Update: {
          bom_id?: string
          created_at?: string | null
          id?: string
          material_stock_code_id?: string
          quantity_per_batch?: number
        }
        Relationships: [
          {
            foreignKeyName: "fms_bom_components_bom_id_fkey"
            columns: ["bom_id"]
            isOneToOne: false
            referencedRelation: "fms_bom"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fms_bom_components_material_stock_code_id_fkey"
            columns: ["material_stock_code_id"]
            isOneToOne: false
            referencedRelation: "fms_stock_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      fms_contract_signatures: {
        Row: {
          created_at: string | null
          document_id: string | null
          employee_id: string
          expires_at: string
          id: string
          sent_at: string | null
          signature_data: string | null
          signature_method: string | null
          signed_at: string | null
          signer_employee_id: string | null
          signer_ip: string | null
          signer_name: string | null
          status: string
          token: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          document_id?: string | null
          employee_id: string
          expires_at: string
          id?: string
          sent_at?: string | null
          signature_data?: string | null
          signature_method?: string | null
          signed_at?: string | null
          signer_employee_id?: string | null
          signer_ip?: string | null
          signer_name?: string | null
          status?: string
          token: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          document_id?: string | null
          employee_id?: string
          expires_at?: string
          id?: string
          sent_at?: string | null
          signature_data?: string | null
          signature_method?: string | null
          signed_at?: string | null
          signer_employee_id?: string | null
          signer_ip?: string | null
          signer_name?: string | null
          status?: string
          token?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fms_contract_signatures_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "fms_hr_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fms_contract_signatures_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "fms_hr_employees"
            referencedColumns: ["id"]
          },
        ]
      }
      fms_dispatch: {
        Row: {
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string | null
          customer_id: string | null
          customer_name: string
          dispatch_date: string | null
          dispatched_by: string
          id: string
          invoice_number: string
          status: string
        }
        Insert: {
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string | null
          customer_id?: string | null
          customer_name: string
          dispatch_date?: string | null
          dispatched_by: string
          id?: string
          invoice_number: string
          status?: string
        }
        Update: {
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string | null
          customer_id?: string | null
          customer_name?: string
          dispatch_date?: string | null
          dispatched_by?: string
          id?: string
          invoice_number?: string
          status?: string
        }
        Relationships: []
      }
      fms_dispatch_invoices: {
        Row: {
          created_at: string | null
          customer_name: string | null
          dispatch_id: string
          file_name: string | null
          file_path: string | null
          id: string
          invoice_number: string
        }
        Insert: {
          created_at?: string | null
          customer_name?: string | null
          dispatch_id: string
          file_name?: string | null
          file_path?: string | null
          id?: string
          invoice_number: string
        }
        Update: {
          created_at?: string | null
          customer_name?: string | null
          dispatch_id?: string
          file_name?: string | null
          file_path?: string | null
          id?: string
          invoice_number?: string
        }
        Relationships: [
          {
            foreignKeyName: "fms_dispatch_invoices_dispatch_id_fkey"
            columns: ["dispatch_id"]
            isOneToOne: false
            referencedRelation: "fms_dispatch"
            referencedColumns: ["id"]
          },
        ]
      }
      fms_dispatch_items: {
        Row: {
          batch_id: string
          created_at: string | null
          dispatch_id: string
          id: string
          quantity: number
          quantity_required: number
          quantity_scanned: number
          scanned_at: string | null
          scanned_by: string | null
        }
        Insert: {
          batch_id: string
          created_at?: string | null
          dispatch_id: string
          id?: string
          quantity: number
          quantity_required?: number
          quantity_scanned?: number
          scanned_at?: string | null
          scanned_by?: string | null
        }
        Update: {
          batch_id?: string
          created_at?: string | null
          dispatch_id?: string
          id?: string
          quantity?: number
          quantity_required?: number
          quantity_scanned?: number
          scanned_at?: string | null
          scanned_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fms_dispatch_items_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "fms_production_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fms_dispatch_items_dispatch_id_fkey"
            columns: ["dispatch_id"]
            isOneToOne: false
            referencedRelation: "fms_dispatch"
            referencedColumns: ["id"]
          },
        ]
      }
      fms_dispatch_requirements: {
        Row: {
          created_at: string | null
          description: string | null
          dispatch_id: string
          id: string
          invoice_number: string | null
          quantity_required: number
          quantity_scanned: number
          scanned_at: string | null
          scanned_by: string | null
          stock_code: string
          stock_code_id: string
          uom: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          dispatch_id: string
          id?: string
          invoice_number?: string | null
          quantity_required: number
          quantity_scanned?: number
          scanned_at?: string | null
          scanned_by?: string | null
          stock_code: string
          stock_code_id: string
          uom?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          dispatch_id?: string
          id?: string
          invoice_number?: string | null
          quantity_required?: number
          quantity_scanned?: number
          scanned_at?: string | null
          scanned_by?: string | null
          stock_code?: string
          stock_code_id?: string
          uom?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fms_dispatch_requirements_dispatch_id_fkey"
            columns: ["dispatch_id"]
            isOneToOne: false
            referencedRelation: "fms_dispatch"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fms_dispatch_requirements_stock_code_id_fkey"
            columns: ["stock_code_id"]
            isOneToOne: false
            referencedRelation: "fms_stock_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      fms_hr_attendance: {
        Row: {
          attendance_date: string
          created_at: string | null
          employee_id: string
          hours_worked: number | null
          id: string
          notes: string | null
          status: string | null
          time_in: string | null
          time_out: string | null
        }
        Insert: {
          attendance_date: string
          created_at?: string | null
          employee_id: string
          hours_worked?: number | null
          id?: string
          notes?: string | null
          status?: string | null
          time_in?: string | null
          time_out?: string | null
        }
        Update: {
          attendance_date?: string
          created_at?: string | null
          employee_id?: string
          hours_worked?: number | null
          id?: string
          notes?: string | null
          status?: string | null
          time_in?: string | null
          time_out?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fms_hr_attendance_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "fms_hr_employees"
            referencedColumns: ["id"]
          },
        ]
      }
      fms_hr_documents: {
        Row: {
          created_at: string | null
          document_name: string
          document_type: string
          employee_id: string
          file_path: string
          file_size: number | null
          id: string
          mime_type: string | null
          uploaded_by: string
        }
        Insert: {
          created_at?: string | null
          document_name: string
          document_type: string
          employee_id: string
          file_path: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          uploaded_by: string
        }
        Update: {
          created_at?: string | null
          document_name?: string
          document_type?: string
          employee_id?: string
          file_path?: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "fms_hr_documents_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "fms_hr_employees"
            referencedColumns: ["id"]
          },
        ]
      }
      fms_hr_employees: {
        Row: {
          address: string | null
          bank_account_number: string | null
          bank_name: string | null
          contract_signed: boolean | null
          contract_signed_date: string | null
          created_at: string | null
          date_of_birth: string | null
          department: string | null
          email: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          employee_number: string | null
          employment_type: string | null
          first_name: string
          id: string
          id_number: string | null
          job_title: string | null
          last_name: string
          leave_pin: string | null
          leave_pin_hash: string | null
          phone: string | null
          signed_contract_url: string | null
          start_date: string | null
          status: string | null
          supervisor: string | null
          system_role: string | null
          termination_date: string | null
          termination_reason: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          bank_account_number?: string | null
          bank_name?: string | null
          contract_signed?: boolean | null
          contract_signed_date?: string | null
          created_at?: string | null
          date_of_birth?: string | null
          department?: string | null
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          employee_number?: string | null
          employment_type?: string | null
          first_name: string
          id?: string
          id_number?: string | null
          job_title?: string | null
          last_name: string
          leave_pin?: string | null
          leave_pin_hash?: string | null
          phone?: string | null
          signed_contract_url?: string | null
          start_date?: string | null
          status?: string | null
          supervisor?: string | null
          system_role?: string | null
          termination_date?: string | null
          termination_reason?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          bank_account_number?: string | null
          bank_name?: string | null
          contract_signed?: boolean | null
          contract_signed_date?: string | null
          created_at?: string | null
          date_of_birth?: string | null
          department?: string | null
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          employee_number?: string | null
          employment_type?: string | null
          first_name?: string
          id?: string
          id_number?: string | null
          job_title?: string | null
          last_name?: string
          leave_pin?: string | null
          leave_pin_hash?: string | null
          phone?: string | null
          signed_contract_url?: string | null
          start_date?: string | null
          status?: string | null
          supervisor?: string | null
          system_role?: string | null
          termination_date?: string | null
          termination_reason?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      fms_hr_leave: {
        Row: {
          created_at: string | null
          created_by: string
          days_requested: number
          employee_id: string
          end_date: string
          id: string
          leave_type: string
          reason: string | null
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          start_date: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by: string
          days_requested: number
          employee_id: string
          end_date: string
          id?: string
          leave_type: string
          reason?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          start_date: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string
          days_requested?: number
          employee_id?: string
          end_date?: string
          id?: string
          leave_type?: string
          reason?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          start_date?: string
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fms_hr_leave_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "fms_hr_employees"
            referencedColumns: ["id"]
          },
        ]
      }
      fms_hr_warnings: {
        Row: {
          acknowledged_at: string | null
          booking_token: string | null
          created_at: string
          details: string | null
          employee_id: string
          id: string
          issued_at: string
          issued_by: string
          meeting_date: string | null
          meeting_end_time: string | null
          meeting_message: string | null
          meeting_postponed_to: string | null
          meeting_requested: boolean
          meeting_resolved_at: string | null
          meeting_start_time: string | null
          meeting_status: string | null
          meeting_type: string | null
          reason: string
          signature: string
          status: string
          updated_at: string
          warning_type: string
        }
        Insert: {
          acknowledged_at?: string | null
          booking_token?: string | null
          created_at?: string
          details?: string | null
          employee_id: string
          id?: string
          issued_at?: string
          issued_by: string
          meeting_date?: string | null
          meeting_end_time?: string | null
          meeting_message?: string | null
          meeting_postponed_to?: string | null
          meeting_requested?: boolean
          meeting_resolved_at?: string | null
          meeting_start_time?: string | null
          meeting_status?: string | null
          meeting_type?: string | null
          reason: string
          signature: string
          status?: string
          updated_at?: string
          warning_type: string
        }
        Update: {
          acknowledged_at?: string | null
          booking_token?: string | null
          created_at?: string
          details?: string | null
          employee_id?: string
          id?: string
          issued_at?: string
          issued_by?: string
          meeting_date?: string | null
          meeting_end_time?: string | null
          meeting_message?: string | null
          meeting_postponed_to?: string | null
          meeting_requested?: boolean
          meeting_resolved_at?: string | null
          meeting_start_time?: string | null
          meeting_status?: string | null
          meeting_type?: string | null
          reason?: string
          signature?: string
          status?: string
          updated_at?: string
          warning_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "fms_hr_warnings_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "fms_hr_employees"
            referencedColumns: ["id"]
          },
        ]
      }
      fms_leave_requests: {
        Row: {
          created_at: string
          employee_email: string | null
          employee_id: string
          employee_name: string
          employee_number: string | null
          end_date: string
          hr_comment: string | null
          id: string
          leave_type: string
          reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          start_date: string
          status: string
          total_days: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          employee_email?: string | null
          employee_id: string
          employee_name: string
          employee_number?: string | null
          end_date: string
          hr_comment?: string | null
          id?: string
          leave_type: string
          reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          start_date: string
          status?: string
          total_days: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          employee_email?: string | null
          employee_id?: string
          employee_name?: string
          employee_number?: string | null
          end_date?: string
          hr_comment?: string | null
          id?: string
          leave_type?: string
          reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          start_date?: string
          status?: string
          total_days?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fms_leave_requests_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "fms_hr_employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fms_leave_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "fms_users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      fms_materials_used: {
        Row: {
          batch_id: string
          created_at: string | null
          id: string
          quantity_used: number
          receiving_record_id: string
        }
        Insert: {
          batch_id: string
          created_at?: string | null
          id?: string
          quantity_used: number
          receiving_record_id: string
        }
        Update: {
          batch_id?: string
          created_at?: string | null
          id?: string
          quantity_used?: number
          receiving_record_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fms_materials_used_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "fms_production_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fms_materials_used_receiving_record_id_fkey"
            columns: ["receiving_record_id"]
            isOneToOne: false
            referencedRelation: "fms_receiving"
            referencedColumns: ["id"]
          },
        ]
      }
      fms_notes: {
        Row: {
          created_at: string
          id: string
          text: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          text: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          text?: string
          user_id?: string
        }
        Relationships: []
      }
      fms_notifications: {
        Row: {
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          is_read: boolean
          message: string
          notification_type: string
          read_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          is_read?: boolean
          message: string
          notification_type?: string
          read_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          is_read?: boolean
          message?: string
          notification_type?: string
          read_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      fms_pickle_runs: {
        Row: {
          batch_id: string | null
          completed_at: string | null
          created_at: string | null
          created_by: string | null
          finished_good_id: string
          id: string
          notes: string | null
          planned_total_qty: number
          run_number: string
          started_at: string | null
          status: string
          unit_of_measure: string
          updated_at: string | null
        }
        Insert: {
          batch_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          finished_good_id: string
          id?: string
          notes?: string | null
          planned_total_qty: number
          run_number?: string
          started_at?: string | null
          status?: string
          unit_of_measure?: string
          updated_at?: string | null
        }
        Update: {
          batch_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          finished_good_id?: string
          id?: string
          notes?: string | null
          planned_total_qty?: number
          run_number?: string
          started_at?: string | null
          status?: string
          unit_of_measure?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fms_pickle_runs_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "fms_production_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fms_pickle_runs_finished_good_id_fkey"
            columns: ["finished_good_id"]
            isOneToOne: false
            referencedRelation: "fms_stock_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      fms_pickle_stage_ingredients: {
        Row: {
          created_at: string | null
          id: string
          internal_lot_number: string | null
          material_stock_code_id: string
          measured_at: string | null
          measured_qty: number | null
          operator_id: string | null
          receiving_record_id: string | null
          required_qty: number
          source_stage_id: string | null
          source_type: string
          stage_id: string
          status: string
          unit_of_measure: string
          variance: number | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          internal_lot_number?: string | null
          material_stock_code_id: string
          measured_at?: string | null
          measured_qty?: number | null
          operator_id?: string | null
          receiving_record_id?: string | null
          required_qty?: number
          source_stage_id?: string | null
          source_type?: string
          stage_id: string
          status?: string
          unit_of_measure?: string
          variance?: number | null
        }
        Update: {
          created_at?: string | null
          id?: string
          internal_lot_number?: string | null
          material_stock_code_id?: string
          measured_at?: string | null
          measured_qty?: number | null
          operator_id?: string | null
          receiving_record_id?: string | null
          required_qty?: number
          source_stage_id?: string | null
          source_type?: string
          stage_id?: string
          status?: string
          unit_of_measure?: string
          variance?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fms_pickle_stage_ingredients_material_stock_code_id_fkey"
            columns: ["material_stock_code_id"]
            isOneToOne: false
            referencedRelation: "fms_stock_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fms_pickle_stage_ingredients_receiving_record_id_fkey"
            columns: ["receiving_record_id"]
            isOneToOne: false
            referencedRelation: "fms_receiving"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fms_pickle_stage_ingredients_source_stage_id_fkey"
            columns: ["source_stage_id"]
            isOneToOne: false
            referencedRelation: "fms_pickle_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fms_pickle_stage_ingredients_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "fms_pickle_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      fms_pickle_stages: {
        Row: {
          actual_ready_date: string | null
          completed_at: string | null
          completed_quantity: number | null
          container_id: string | null
          created_at: string | null
          elapsed_days: number | null
          id: string
          is_root: boolean
          is_soaking: boolean
          max_ready_at: string | null
          max_ready_date: string | null
          min_ready_at: string | null
          min_ready_date: string | null
          operator_id: string | null
          output_lot_id: string | null
          parent_stage_id: string | null
          process_instructions: string | null
          required_qty: number
          run_id: string
          soaking_start_at: string | null
          stage_order: number
          started_at: string | null
          status: string
          stock_code_id: string
          unit_of_measure: string
          verified: boolean
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          actual_ready_date?: string | null
          completed_at?: string | null
          completed_quantity?: number | null
          container_id?: string | null
          created_at?: string | null
          elapsed_days?: number | null
          id?: string
          is_root?: boolean
          is_soaking?: boolean
          max_ready_at?: string | null
          max_ready_date?: string | null
          min_ready_at?: string | null
          min_ready_date?: string | null
          operator_id?: string | null
          output_lot_id?: string | null
          parent_stage_id?: string | null
          process_instructions?: string | null
          required_qty?: number
          run_id: string
          soaking_start_at?: string | null
          stage_order?: number
          started_at?: string | null
          status?: string
          stock_code_id: string
          unit_of_measure?: string
          verified?: boolean
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          actual_ready_date?: string | null
          completed_at?: string | null
          completed_quantity?: number | null
          container_id?: string | null
          created_at?: string | null
          elapsed_days?: number | null
          id?: string
          is_root?: boolean
          is_soaking?: boolean
          max_ready_at?: string | null
          max_ready_date?: string | null
          min_ready_at?: string | null
          min_ready_date?: string | null
          operator_id?: string | null
          output_lot_id?: string | null
          parent_stage_id?: string | null
          process_instructions?: string | null
          required_qty?: number
          run_id?: string
          soaking_start_at?: string | null
          stage_order?: number
          started_at?: string | null
          status?: string
          stock_code_id?: string
          unit_of_measure?: string
          verified?: boolean
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fms_pickle_stages_output_lot_id_fkey"
            columns: ["output_lot_id"]
            isOneToOne: false
            referencedRelation: "fms_receiving"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fms_pickle_stages_parent_stage_id_fkey"
            columns: ["parent_stage_id"]
            isOneToOne: false
            referencedRelation: "fms_pickle_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fms_pickle_stages_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "fms_pickle_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fms_pickle_stages_stock_code_id_fkey"
            columns: ["stock_code_id"]
            isOneToOne: false
            referencedRelation: "fms_stock_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      fms_print_queue: {
        Row: {
          batch_id: string
          copies: number | null
          created_at: string
          document_type: string
          error_message: string | null
          id: string
          printed_at: string | null
          status: string
        }
        Insert: {
          batch_id: string
          copies?: number | null
          created_at?: string
          document_type?: string
          error_message?: string | null
          id?: string
          printed_at?: string | null
          status?: string
        }
        Update: {
          batch_id?: string
          copies?: number | null
          created_at?: string
          document_type?: string
          error_message?: string | null
          id?: string
          printed_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "fms_print_queue_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "fms_production_batches"
            referencedColumns: ["id"]
          },
        ]
      }
      fms_production_batches: {
        Row: {
          actual_quantity_produced: number | null
          batch_number: string
          best_before_date: string | null
          bom_id: string
          closed_at: string | null
          created_at: string | null
          final_quality_checks: Json | null
          finished_good_id: string
          id: string
          info_checker_name: string | null
          operator_id: string
          planned_batch_size: number
          planned_production_date: string
          pre_weigh_approved: boolean | null
          pre_weigh_approved_at: string | null
          pre_weigh_approved_by: string | null
          pre_weigh_materials: Json | null
          processing_steps: Json | null
          product_size: number | null
          production_end: string | null
          production_instructions: string | null
          production_start: string | null
          quality_checker_name: string | null
          quality_checks: Json | null
          retention_sample_taken: boolean | null
          scrap_waste: number | null
          status: string
          steps_checker_name: string | null
          sticker_copies: number
          supervisor_id: string | null
          waste_notes: string | null
        }
        Insert: {
          actual_quantity_produced?: number | null
          batch_number?: string
          best_before_date?: string | null
          bom_id: string
          closed_at?: string | null
          created_at?: string | null
          final_quality_checks?: Json | null
          finished_good_id: string
          id?: string
          info_checker_name?: string | null
          operator_id: string
          planned_batch_size: number
          planned_production_date: string
          pre_weigh_approved?: boolean | null
          pre_weigh_approved_at?: string | null
          pre_weigh_approved_by?: string | null
          pre_weigh_materials?: Json | null
          processing_steps?: Json | null
          product_size?: number | null
          production_end?: string | null
          production_instructions?: string | null
          production_start?: string | null
          quality_checker_name?: string | null
          quality_checks?: Json | null
          retention_sample_taken?: boolean | null
          scrap_waste?: number | null
          status?: string
          steps_checker_name?: string | null
          sticker_copies?: number
          supervisor_id?: string | null
          waste_notes?: string | null
        }
        Update: {
          actual_quantity_produced?: number | null
          batch_number?: string
          best_before_date?: string | null
          bom_id?: string
          closed_at?: string | null
          created_at?: string | null
          final_quality_checks?: Json | null
          finished_good_id?: string
          id?: string
          info_checker_name?: string | null
          operator_id?: string
          planned_batch_size?: number
          planned_production_date?: string
          pre_weigh_approved?: boolean | null
          pre_weigh_approved_at?: string | null
          pre_weigh_approved_by?: string | null
          pre_weigh_materials?: Json | null
          processing_steps?: Json | null
          product_size?: number | null
          production_end?: string | null
          production_instructions?: string | null
          production_start?: string | null
          quality_checker_name?: string | null
          quality_checks?: Json | null
          retention_sample_taken?: boolean | null
          scrap_waste?: number | null
          status?: string
          steps_checker_name?: string | null
          sticker_copies?: number
          supervisor_id?: string | null
          waste_notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fms_production_batches_bom_id_fkey"
            columns: ["bom_id"]
            isOneToOne: false
            referencedRelation: "fms_bom"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fms_production_batches_finished_good_id_fkey"
            columns: ["finished_good_id"]
            isOneToOne: false
            referencedRelation: "fms_stock_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      fms_receiving: {
        Row: {
          cost_price_per_kg: number | null
          created_at: string | null
          delivery_note_number: string | null
          expiry_date: string | null
          id: string
          internal_lot_number: string
          manufacturing_date: string | null
          quality_checks: Json
          quantity_received: number
          received_at: string | null
          received_by: string
          rejection_reason: string | null
          status: string
          stock_code_id: string
          supplier_batch_number: string | null
          supplier_id: string | null
        }
        Insert: {
          cost_price_per_kg?: number | null
          created_at?: string | null
          delivery_note_number?: string | null
          expiry_date?: string | null
          id?: string
          internal_lot_number: string
          manufacturing_date?: string | null
          quality_checks?: Json
          quantity_received: number
          received_at?: string | null
          received_by: string
          rejection_reason?: string | null
          status?: string
          stock_code_id: string
          supplier_batch_number?: string | null
          supplier_id?: string | null
        }
        Update: {
          cost_price_per_kg?: number | null
          created_at?: string | null
          delivery_note_number?: string | null
          expiry_date?: string | null
          id?: string
          internal_lot_number?: string
          manufacturing_date?: string | null
          quality_checks?: Json
          quantity_received?: number
          received_at?: string | null
          received_by?: string
          rejection_reason?: string | null
          status?: string
          stock_code_id?: string
          supplier_batch_number?: string | null
          supplier_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fms_receiving_stock_code_id_fkey"
            columns: ["stock_code_id"]
            isOneToOne: false
            referencedRelation: "fms_stock_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fms_receiving_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "fms_suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      fms_settings: {
        Row: {
          description: string | null
          id: string
          setting_key: string
          setting_value: Json
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          description?: string | null
          id?: string
          setting_key: string
          setting_value: Json
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          description?: string | null
          id?: string
          setting_key?: string
          setting_value?: Json
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      fms_stock_codes: {
        Row: {
          allergen_types: string[] | null
          approved_supplier_ids: string[] | null
          created_at: string | null
          custom_allergens: string[] | null
          description: string
          has_allergens: boolean | null
          id: string
          item_type: string
          status: string
          stock_code: string
          storage_condition: string
          unit_of_measure: string
          updated_at: string | null
        }
        Insert: {
          allergen_types?: string[] | null
          approved_supplier_ids?: string[] | null
          created_at?: string | null
          custom_allergens?: string[] | null
          description: string
          has_allergens?: boolean | null
          id?: string
          item_type: string
          status?: string
          stock_code: string
          storage_condition: string
          unit_of_measure: string
          updated_at?: string | null
        }
        Update: {
          allergen_types?: string[] | null
          approved_supplier_ids?: string[] | null
          created_at?: string | null
          custom_allergens?: string[] | null
          description?: string
          has_allergens?: boolean | null
          id?: string
          item_type?: string
          status?: string
          stock_code?: string
          storage_condition?: string
          unit_of_measure?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      fms_stock_levels: {
        Row: {
          id: string
          low_stock_threshold: number
          quantity_on_hand: number
          reserved_quantity: number
          stock_code_id: string
          updated_at: string | null
        }
        Insert: {
          id?: string
          low_stock_threshold?: number
          quantity_on_hand?: number
          reserved_quantity?: number
          stock_code_id: string
          updated_at?: string | null
        }
        Update: {
          id?: string
          low_stock_threshold?: number
          quantity_on_hand?: number
          reserved_quantity?: number
          stock_code_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fms_stock_levels_stock_code_id_fkey"
            columns: ["stock_code_id"]
            isOneToOne: true
            referencedRelation: "fms_stock_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      fms_stock_movements: {
        Row: {
          batch_id: string | null
          batch_number: string | null
          created_at: string | null
          created_by: string | null
          id: string
          movement_type: string
          notes: string | null
          quantity_change: number
          reference_id: string | null
          stock_code_id: string
        }
        Insert: {
          batch_id?: string | null
          batch_number?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          movement_type: string
          notes?: string | null
          quantity_change: number
          reference_id?: string | null
          stock_code_id: string
        }
        Update: {
          batch_id?: string | null
          batch_number?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          movement_type?: string
          notes?: string | null
          quantity_change?: number
          reference_id?: string | null
          stock_code_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fms_stock_movements_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "fms_production_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fms_stock_movements_stock_code_id_fkey"
            columns: ["stock_code_id"]
            isOneToOne: false
            referencedRelation: "fms_stock_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      fms_stock_order_items: {
        Row: {
          created_at: string
          id: string
          manager_notes: string | null
          order_id: string
          quantity_ordered: number
          quantity_received: number
          status: string
          stock_code_id: string
          uom: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          manager_notes?: string | null
          order_id: string
          quantity_ordered?: number
          quantity_received?: number
          status?: string
          stock_code_id: string
          uom: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          manager_notes?: string | null
          order_id?: string
          quantity_ordered?: number
          quantity_received?: number
          status?: string
          stock_code_id?: string
          uom?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fms_stock_order_items_order_fk"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "fms_stock_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      fms_stock_orders: {
        Row: {
          checked_at: string | null
          checked_by: string | null
          created_at: string
          created_by: string | null
          id: string
          invoice_file_path: string | null
          invoice_number: string | null
          notes: string | null
          order_date: string
          po_number: string
          status: string
          supplier_id: string
          updated_at: string
        }
        Insert: {
          checked_at?: string | null
          checked_by?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          invoice_file_path?: string | null
          invoice_number?: string | null
          notes?: string | null
          order_date?: string
          po_number: string
          status?: string
          supplier_id: string
          updated_at?: string
        }
        Update: {
          checked_at?: string | null
          checked_by?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          invoice_file_path?: string | null
          invoice_number?: string | null
          notes?: string | null
          order_date?: string
          po_number?: string
          status?: string
          supplier_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      fms_stock_reservations: {
        Row: {
          batch_id: string
          batch_number: string
          consumed_at: string | null
          consumed_by: string | null
          created_at: string | null
          id: string
          internal_lot_number: string | null
          quantity_reserved: number
          receiving_record_id: string | null
          released_at: string | null
          released_by: string | null
          reserved_at: string | null
          reserved_by: string | null
          status: string
          stock_code_id: string
        }
        Insert: {
          batch_id: string
          batch_number: string
          consumed_at?: string | null
          consumed_by?: string | null
          created_at?: string | null
          id?: string
          internal_lot_number?: string | null
          quantity_reserved: number
          receiving_record_id?: string | null
          released_at?: string | null
          released_by?: string | null
          reserved_at?: string | null
          reserved_by?: string | null
          status?: string
          stock_code_id: string
        }
        Update: {
          batch_id?: string
          batch_number?: string
          consumed_at?: string | null
          consumed_by?: string | null
          created_at?: string | null
          id?: string
          internal_lot_number?: string | null
          quantity_reserved?: number
          receiving_record_id?: string | null
          released_at?: string | null
          released_by?: string | null
          reserved_at?: string | null
          reserved_by?: string | null
          status?: string
          stock_code_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fms_stock_reservations_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "fms_production_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fms_stock_reservations_receiving_record_id_fkey"
            columns: ["receiving_record_id"]
            isOneToOne: false
            referencedRelation: "fms_receiving"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fms_stock_reservations_stock_code_id_fkey"
            columns: ["stock_code_id"]
            isOneToOne: false
            referencedRelation: "fms_stock_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      fms_supplier_material_prices: {
        Row: {
          cost_price_per_kg: number
          created_at: string
          currency: string
          id: string
          notes: string | null
          stock_code_id: string
          supplier_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          cost_price_per_kg?: number
          created_at?: string
          currency?: string
          id?: string
          notes?: string | null
          stock_code_id: string
          supplier_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          cost_price_per_kg?: number
          created_at?: string
          currency?: string
          id?: string
          notes?: string | null
          stock_code_id?: string
          supplier_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fms_supplier_material_prices_stock_code_id_fkey"
            columns: ["stock_code_id"]
            isOneToOne: false
            referencedRelation: "fms_stock_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fms_supplier_material_prices_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "fms_suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      fms_supplier_order_emails: {
        Row: {
          created_at: string
          emailed_at: string
          emailed_by: string | null
          id: string
          notes: string | null
          quantity: number
          received_at: string | null
          status: string
          stock_code_id: string
          supplier_id: string
        }
        Insert: {
          created_at?: string
          emailed_at?: string
          emailed_by?: string | null
          id?: string
          notes?: string | null
          quantity: number
          received_at?: string | null
          status?: string
          stock_code_id: string
          supplier_id: string
        }
        Update: {
          created_at?: string
          emailed_at?: string
          emailed_by?: string | null
          id?: string
          notes?: string | null
          quantity?: number
          received_at?: string | null
          status?: string
          stock_code_id?: string
          supplier_id?: string
        }
        Relationships: []
      }
      fms_suppliers: {
        Row: {
          address: string | null
          code: string
          contact_name: string | null
          created_at: string | null
          email: string | null
          id: string
          is_approved: boolean | null
          name: string
          phone: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          code: string
          contact_name?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          is_approved?: boolean | null
          name: string
          phone?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          code?: string
          contact_name?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          is_approved?: boolean | null
          name?: string
          phone?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      fms_user_invitations: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          id: string
          invited_by: string | null
          name: string
          role: Database["public"]["Enums"]["fms_role"]
          status: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          id?: string
          invited_by?: string | null
          name: string
          role?: Database["public"]["Enums"]["fms_role"]
          status?: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          id?: string
          invited_by?: string | null
          name?: string
          role?: Database["public"]["Enums"]["fms_role"]
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      fms_users: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          role: Database["public"]["Enums"]["fms_role"]
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          role?: Database["public"]["Enums"]["fms_role"]
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          role?: Database["public"]["Enums"]["fms_role"]
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      forum_categories: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          name: string
          slug: string
          sort_order: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          slug: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          slug?: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      forum_posts: {
        Row: {
          content: string
          created_at: string | null
          id: string
          is_solution: boolean | null
          topic_id: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          is_solution?: boolean | null
          topic_id: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          is_solution?: boolean | null
          topic_id?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "forum_posts_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "forum_topics"
            referencedColumns: ["id"]
          },
        ]
      }
      forum_topics: {
        Row: {
          category_id: string
          content: string
          created_at: string | null
          id: string
          is_locked: boolean | null
          is_pinned: boolean | null
          slug: string
          title: string
          updated_at: string | null
          user_id: string | null
          views_count: number | null
        }
        Insert: {
          category_id: string
          content: string
          created_at?: string | null
          id?: string
          is_locked?: boolean | null
          is_pinned?: boolean | null
          slug: string
          title: string
          updated_at?: string | null
          user_id?: string | null
          views_count?: number | null
        }
        Update: {
          category_id?: string
          content?: string
          created_at?: string | null
          id?: string
          is_locked?: boolean | null
          is_pinned?: boolean | null
          slug?: string
          title?: string
          updated_at?: string | null
          user_id?: string | null
          views_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "forum_topics_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "forum_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      image_metadata: {
        Row: {
          alt_text: string | null
          bucket: string
          created_at: string
          created_by: string | null
          description: string | null
          file_size: number | null
          forum_post_id: string | null
          height: number | null
          id: string
          mime_type: string | null
          object_key: string
          product_id: string | null
          updated_at: string
          width: number | null
        }
        Insert: {
          alt_text?: string | null
          bucket: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          file_size?: number | null
          forum_post_id?: string | null
          height?: number | null
          id?: string
          mime_type?: string | null
          object_key: string
          product_id?: string | null
          updated_at?: string
          width?: number | null
        }
        Update: {
          alt_text?: string | null
          bucket?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          file_size?: number | null
          forum_post_id?: string | null
          height?: number | null
          id?: string
          mime_type?: string | null
          object_key?: string
          product_id?: string | null
          updated_at?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "image_metadata_forum_post_id_fkey"
            columns: ["forum_post_id"]
            isOneToOne: false
            referencedRelation: "forum_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "image_metadata_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          created_at: string
          customer_address: Json | null
          customer_email: string | null
          customer_name: string
          customer_phone: string | null
          id: string
          invoice_date: string
          invoice_number: string
          line_items: Json
          order_id: string
          payment_reference: string | null
          seller_address: string
          seller_email: string | null
          seller_name: string
          seller_phone: string | null
          seller_vat_number: string
          subtotal_excl_vat: number
          total_incl_vat: number
          total_vat: number
          updated_at: string
          user_id: string | null
          vat_rate: number
        }
        Insert: {
          created_at?: string
          customer_address?: Json | null
          customer_email?: string | null
          customer_name: string
          customer_phone?: string | null
          id?: string
          invoice_date?: string
          invoice_number: string
          line_items?: Json
          order_id: string
          payment_reference?: string | null
          seller_address?: string
          seller_email?: string | null
          seller_name?: string
          seller_phone?: string | null
          seller_vat_number?: string
          subtotal_excl_vat: number
          total_incl_vat: number
          total_vat: number
          updated_at?: string
          user_id?: string | null
          vat_rate?: number
        }
        Update: {
          created_at?: string
          customer_address?: Json | null
          customer_email?: string | null
          customer_name?: string
          customer_phone?: string | null
          id?: string
          invoice_date?: string
          invoice_number?: string
          line_items?: Json
          order_id?: string
          payment_reference?: string | null
          seller_address?: string
          seller_email?: string | null
          seller_name?: string
          seller_phone?: string | null
          seller_vat_number?: string
          subtotal_excl_vat?: number
          total_incl_vat?: number
          total_vat?: number
          updated_at?: string
          user_id?: string | null
          vat_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoices_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      newsletter_subscribers: {
        Row: {
          email: string
          id: string
          is_active: boolean | null
          subscribed_at: string | null
        }
        Insert: {
          email: string
          id?: string
          is_active?: boolean | null
          subscribed_at?: string | null
        }
        Update: {
          email?: string
          id?: string
          is_active?: boolean | null
          subscribed_at?: string | null
        }
        Relationships: []
      }
      order_history: {
        Row: {
          created_at: string
          id: string
          order_id: string
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          order_id: string
          status: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_history_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string | null
          id: string
          order_id: string
          price: number
          product_id: string
          quantity: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          order_id: string
          price: number
          product_id: string
          quantity: number
        }
        Update: {
          created_at?: string | null
          id?: string
          order_id?: string
          price?: number
          product_id?: string
          quantity?: number
        }
        Relationships: []
      }
      orders: {
        Row: {
          courier: string | null
          courier_cost: number | null
          courier_markup: number | null
          courier_waybill: string | null
          created_at: string | null
          credits_used: number | null
          id: string
          items: Json | null
          shipment_creation_error: string | null
          shipment_creation_started_at: string | null
          shipping_address: Json | null
          shipping_cost: number
          status: string | null
          subtotal: number
          tax: number
          thank_you_sent_at: string | null
          total: number
          tracking_token: string | null
          user_id: string | null
          voucher_code: string | null
          voucher_discount: number
        }
        Insert: {
          courier?: string | null
          courier_cost?: number | null
          courier_markup?: number | null
          courier_waybill?: string | null
          created_at?: string | null
          credits_used?: number | null
          id?: string
          items?: Json | null
          shipment_creation_error?: string | null
          shipment_creation_started_at?: string | null
          shipping_address?: Json | null
          shipping_cost: number
          status?: string | null
          subtotal: number
          tax: number
          thank_you_sent_at?: string | null
          total: number
          tracking_token?: string | null
          user_id?: string | null
          voucher_code?: string | null
          voucher_discount?: number
        }
        Update: {
          courier?: string | null
          courier_cost?: number | null
          courier_markup?: number | null
          courier_waybill?: string | null
          created_at?: string | null
          credits_used?: number | null
          id?: string
          items?: Json | null
          shipment_creation_error?: string | null
          shipment_creation_started_at?: string | null
          shipping_address?: Json | null
          shipping_cost?: number
          status?: string | null
          subtotal?: number
          tax?: number
          thank_you_sent_at?: string | null
          total?: number
          tracking_token?: string | null
          user_id?: string | null
          voucher_code?: string | null
          voucher_discount?: number
        }
        Relationships: []
      }
      pickup_locations: {
        Row: {
          active: boolean | null
          address: string
          city: string
          created_at: string | null
          id: string
          name: string
          phone: string | null
        }
        Insert: {
          active?: boolean | null
          address: string
          city: string
          created_at?: string | null
          id?: string
          name: string
          phone?: string | null
        }
        Update: {
          active?: boolean | null
          address?: string
          city?: string
          created_at?: string | null
          id?: string
          name?: string
          phone?: string | null
        }
        Relationships: []
      }
      product_likes: {
        Row: {
          created_at: string | null
          id: string
          product_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          product_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          product_id?: string
          user_id?: string
        }
        Relationships: []
      }
      product_reviews: {
        Row: {
          created_at: string
          id: string
          order_id: string | null
          product_id: string
          rating: number
          review_text: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          order_id?: string | null
          product_id: string
          rating: number
          review_text?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string | null
          product_id?: string
          rating?: number
          review_text?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_reviews_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_reviews_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          brand: string
          category: string
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          images: string[] | null
          in_stock: boolean | null
          name: string
          original_price: number | null
          price: number
          updated_at: string | null
          variants: Json | null
          weight: string | null
        }
        Insert: {
          brand: string
          category: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          images?: string[] | null
          in_stock?: boolean | null
          name: string
          original_price?: number | null
          price: number
          updated_at?: string | null
          variants?: Json | null
          weight?: string | null
        }
        Update: {
          brand?: string
          category?: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          images?: string[] | null
          in_stock?: boolean | null
          name?: string
          original_price?: number | null
          price?: number
          updated_at?: string | null
          variants?: Json | null
          weight?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          birthday: string | null
          birthday_opt_in: boolean | null
          created_at: string | null
          department: string | null
          email: string | null
          full_name: string | null
          id: string
          job_title: string | null
          phone: string | null
          sc_rating_excluded: boolean
          updated_at: string | null
        }
        Insert: {
          birthday?: string | null
          birthday_opt_in?: boolean | null
          created_at?: string | null
          department?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          job_title?: string | null
          phone?: string | null
          sc_rating_excluded?: boolean
          updated_at?: string | null
        }
        Update: {
          birthday?: string | null
          birthday_opt_in?: boolean | null
          created_at?: string | null
          department?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          job_title?: string | null
          phone?: string | null
          sc_rating_excluded?: boolean
          updated_at?: string | null
        }
        Relationships: []
      }
      recently_viewed: {
        Row: {
          id: string
          product_id: string
          user_id: string
          viewed_at: string | null
        }
        Insert: {
          id?: string
          product_id: string
          user_id: string
          viewed_at?: string | null
        }
        Update: {
          id?: string
          product_id?: string
          user_id?: string
          viewed_at?: string | null
        }
        Relationships: []
      }
      recipes: {
        Row: {
          category: string
          cook_time: number | null
          created_at: string | null
          created_by: string | null
          description: string | null
          difficulty: string | null
          id: string
          image_url: string | null
          ingredients: Json
          instructions: Json
          prep_time: number | null
          servings: number | null
          slug: string
          title: string
          updated_at: string | null
        }
        Insert: {
          category: string
          cook_time?: number | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          difficulty?: string | null
          id?: string
          image_url?: string | null
          ingredients?: Json
          instructions?: Json
          prep_time?: number | null
          servings?: number | null
          slug: string
          title: string
          updated_at?: string | null
        }
        Update: {
          category?: string
          cook_time?: number | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          difficulty?: string | null
          id?: string
          image_url?: string | null
          ingredients?: Json
          instructions?: Json
          prep_time?: number | null
          servings?: number | null
          slug?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      sc_assessment_periods: {
        Row: {
          created_at: string
          end_date: string
          financial_year: number
          id: string
          period_name: string
          period_number: number
          start_date: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          end_date: string
          financial_year: number
          id?: string
          period_name: string
          period_number?: number
          start_date: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          end_date?: string
          financial_year?: number
          id?: string
          period_name?: string
          period_number?: number
          start_date?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      sc_audit_log: {
        Row: {
          action: string
          created_at: string
          entity_id: string | null
          entity_type: string
          field_name: string | null
          id: string
          new_value: string | null
          old_value: string | null
          user_email: string | null
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          entity_id?: string | null
          entity_type: string
          field_name?: string | null
          id?: string
          new_value?: string | null
          old_value?: string | null
          user_email?: string | null
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          field_name?: string | null
          id?: string
          new_value?: string | null
          old_value?: string | null
          user_email?: string | null
          user_id?: string
        }
        Relationships: []
      }
      sc_employee_template_objectives: {
        Row: {
          created_at: string
          description: string | null
          id: string
          key_contributors: string | null
          name: string
          sort_order: number
          template_id: string
          weight_percent: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          key_contributors?: string | null
          name: string
          sort_order?: number
          template_id: string
          weight_percent?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          key_contributors?: string | null
          name?: string
          sort_order?: number
          template_id?: string
          weight_percent?: number
        }
        Relationships: [
          {
            foreignKeyName: "sc_employee_template_objectives_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "sc_employee_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      sc_employee_templates: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          decline_reason: string | null
          employee_id: string
          id: string
          manager_revision_note: string | null
          period_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          submitted_at: string | null
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          decline_reason?: string | null
          employee_id: string
          id?: string
          manager_revision_note?: string | null
          period_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_at?: string | null
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          decline_reason?: string | null
          employee_id?: string
          id?: string
          manager_revision_note?: string | null
          period_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sc_employee_templates_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "sc_assessment_periods"
            referencedColumns: ["id"]
          },
        ]
      }
      sc_notifications: {
        Row: {
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          is_hidden: boolean
          is_read: boolean
          is_starred: boolean
          message: string
          notification_type: string
          period_id: string | null
          read_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          is_hidden?: boolean
          is_read?: boolean
          is_starred?: boolean
          message: string
          notification_type?: string
          period_id?: string | null
          read_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          is_hidden?: boolean
          is_read?: boolean
          is_starred?: boolean
          message?: string
          notification_type?: string
          period_id?: string | null
          read_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      sc_objectives: {
        Row: {
          comments_evidence: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          key_contributors: string | null
          manager_notes: string | null
          name: string
          objectives_agreed: string | null
          score: number | null
          scorecard_id: string
          sort_order: number
          updated_at: string
          weight_percent: number
        }
        Insert: {
          comments_evidence?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          key_contributors?: string | null
          manager_notes?: string | null
          name: string
          objectives_agreed?: string | null
          score?: number | null
          scorecard_id: string
          sort_order?: number
          updated_at?: string
          weight_percent?: number
        }
        Update: {
          comments_evidence?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          key_contributors?: string | null
          manager_notes?: string | null
          name?: string
          objectives_agreed?: string | null
          score?: number | null
          scorecard_id?: string
          sort_order?: number
          updated_at?: string
          weight_percent?: number
        }
        Relationships: [
          {
            foreignKeyName: "sc_objectives_scorecard_id_fkey"
            columns: ["scorecard_id"]
            isOneToOne: false
            referencedRelation: "sc_scorecards"
            referencedColumns: ["id"]
          },
        ]
      }
      sc_peer_assignments: {
        Row: {
          assigned_by: string
          assigned_rater_id: string
          completed: boolean
          created_at: string
          employee_id: string
          id: string
          period_id: string
          rater_type: string
          updated_at: string
        }
        Insert: {
          assigned_by: string
          assigned_rater_id: string
          completed?: boolean
          created_at?: string
          employee_id: string
          id?: string
          period_id: string
          rater_type?: string
          updated_at?: string
        }
        Update: {
          assigned_by?: string
          assigned_rater_id?: string
          completed?: boolean
          created_at?: string
          employee_id?: string
          id?: string
          period_id?: string
          rater_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sc_peer_assignments_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "sc_assessment_periods"
            referencedColumns: ["id"]
          },
        ]
      }
      sc_scorecards: {
        Row: {
          assessment_period_id: string
          created_at: string
          created_by: string | null
          employee_id: string
          id: string
          status: string
          updated_at: string
        }
        Insert: {
          assessment_period_id: string
          created_at?: string
          created_by?: string | null
          employee_id: string
          id?: string
          status?: string
          updated_at?: string
        }
        Update: {
          assessment_period_id?: string
          created_at?: string
          created_by?: string | null
          employee_id?: string
          id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sc_scorecards_assessment_period_id_fkey"
            columns: ["assessment_period_id"]
            isOneToOne: false
            referencedRelation: "sc_assessment_periods"
            referencedColumns: ["id"]
          },
        ]
      }
      sc_value_definitions: {
        Row: {
          assessment_period_id: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          manager_notes: string | null
          name: string
          sort_order: number
          updated_at: string
          weight_percent: number
        }
        Insert: {
          assessment_period_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          manager_notes?: string | null
          name: string
          sort_order?: number
          updated_at?: string
          weight_percent?: number
        }
        Update: {
          assessment_period_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          manager_notes?: string | null
          name?: string
          sort_order?: number
          updated_at?: string
          weight_percent?: number
        }
        Relationships: [
          {
            foreignKeyName: "sc_value_definitions_assessment_period_id_fkey"
            columns: ["assessment_period_id"]
            isOneToOne: false
            referencedRelation: "sc_assessment_periods"
            referencedColumns: ["id"]
          },
        ]
      }
      sc_value_ratings: {
        Row: {
          comments_evidence: string | null
          created_at: string
          id: string
          key_contributors: string | null
          rater_id: string
          score: number
          scorecard_id: string
          value_definition_id: string
        }
        Insert: {
          comments_evidence?: string | null
          created_at?: string
          id?: string
          key_contributors?: string | null
          rater_id: string
          score: number
          scorecard_id: string
          value_definition_id: string
        }
        Update: {
          comments_evidence?: string | null
          created_at?: string
          id?: string
          key_contributors?: string | null
          rater_id?: string
          score?: number
          scorecard_id?: string
          value_definition_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sc_value_ratings_scorecard_id_fkey"
            columns: ["scorecard_id"]
            isOneToOne: false
            referencedRelation: "sc_scorecards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sc_value_ratings_value_definition_id_fkey"
            columns: ["value_definition_id"]
            isOneToOne: false
            referencedRelation: "sc_value_definitions"
            referencedColumns: ["id"]
          },
        ]
      }
      sensitive_data_access_log: {
        Row: {
          action: string
          created_at: string
          id: string
          ip_address: string | null
          query_context: string | null
          record_count: number | null
          table_name: string
          user_email: string | null
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          ip_address?: string | null
          query_context?: string | null
          record_count?: number | null
          table_name: string
          user_email?: string | null
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          ip_address?: string | null
          query_context?: string | null
          record_count?: number | null
          table_name?: string
          user_email?: string | null
          user_id?: string
        }
        Relationships: []
      }
      stockist_applications: {
        Row: {
          address: string
          business_name: string
          contact_person: string
          created_at: string | null
          email: string
          id: string
          ip_address: string | null
          message: string | null
          phone: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          address: string
          business_name: string
          contact_person: string
          created_at?: string | null
          email: string
          id?: string
          ip_address?: string | null
          message?: string | null
          phone: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string
          business_name?: string
          contact_person?: string
          created_at?: string | null
          email?: string
          id?: string
          ip_address?: string | null
          message?: string | null
          phone?: string
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      test_hr: {
        Row: {
          id: string | null
        }
        Insert: {
          id?: string | null
        }
        Update: {
          id?: string | null
        }
        Relationships: []
      }
      user_credits: {
        Row: {
          balance: number
          created_at: string | null
          credit_pin: string | null
          id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          balance?: number
          created_at?: string | null
          credit_pin?: string | null
          id?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          balance?: number
          created_at?: string | null
          credit_pin?: string | null
          id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      voucher_codes: {
        Row: {
          amount: number
          code: string
          created_at: string
          id: string
          is_active: boolean
          minimum_order_total: number
          redeemed_at: string | null
          redeemed_order_id: string | null
          reserved_at: string | null
          reserved_order_id: string | null
        }
        Insert: {
          amount: number
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          minimum_order_total?: number
          redeemed_at?: string | null
          redeemed_order_id?: string | null
          reserved_at?: string | null
          reserved_order_id?: string | null
        }
        Update: {
          amount?: number
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          minimum_order_total?: number
          redeemed_at?: string | null
          redeemed_order_id?: string | null
          reserved_at?: string | null
          reserved_order_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      product_ratings: {
        Row: {
          average_rating: number | null
          product_id: string | null
          review_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "product_reviews_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      sc_value_ratings_anonymous: {
        Row: {
          average_score: number | null
          rating_count: number | null
          scorecard_id: string | null
          value_definition_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sc_value_ratings_scorecard_id_fkey"
            columns: ["scorecard_id"]
            isOneToOne: false
            referencedRelation: "sc_scorecards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sc_value_ratings_value_definition_id_fkey"
            columns: ["value_definition_id"]
            isOneToOne: false
            referencedRelation: "sc_value_definitions"
            referencedColumns: ["id"]
          },
        ]
      }
      user_credits_safe: {
        Row: {
          balance: number | null
          created_at: string | null
          id: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          balance?: number | null
          created_at?: string | null
          id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          balance?: number | null
          created_at?: string | null
          id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      add_employee_role: { Args: { user_email: string }; Returns: undefined }
      add_user_role: {
        Args: {
          role_to_add: Database["public"]["Enums"]["app_role"]
          user_email: string
        }
        Returns: undefined
      }
      fms_apply_stock_movement: {
        Args: {
          p_batch_id?: string
          p_batch_number?: string
          p_created_by?: string
          p_movement_type: string
          p_notes?: string
          p_quantity_change: number
          p_reference_id?: string
          p_stock_code_id: string
        }
        Returns: number
      }
      fms_consume_batch_reservations: {
        Args: {
          p_batch_id: string
          p_batch_number: string
          p_created_by?: string
        }
        Returns: {
          is_low: boolean
          new_quantity_on_hand: number
          stock_code_id: string
        }[]
      }
      fms_delete_receiving_confirmation: {
        Args: { p_receiving_id: string }
        Returns: Json
      }
      fms_fifo_allocate_lots: {
        Args: { p_quantity_required: number; p_stock_code_id: string }
        Returns: {
          expiry_date: string
          internal_lot_number: string
          quantity_available: number
          quantity_to_use: number
          received_at: string
          receiving_record_id: string
        }[]
      }
      fms_generate_lot_number: { Args: never; Returns: string }
      fms_has_access: { Args: { _user_id: string }; Returns: boolean }
      fms_has_role: {
        Args: {
          _role: Database["public"]["Enums"]["fms_role"]
          _user_id: string
        }
        Returns: boolean
      }
      fms_is_delete_admin: { Args: { _user_id: string }; Returns: boolean }
      fms_is_qa_viewer: { Args: { _user_id: string }; Returns: boolean }
      fms_pickle_run_number: { Args: never; Returns: string }
      fms_release_batch_reservations: {
        Args: {
          p_batch_id: string
          p_batch_number: string
          p_created_by?: string
        }
        Returns: {
          net_stock_after: number
          quantity_released: number
          stock_code_id: string
        }[]
      }
      fms_reserve_batch_stock: {
        Args: {
          p_batch_id: string
          p_batch_number: string
          p_created_by?: string
          p_reservations: Json
        }
        Returns: {
          net_stock_after: number
          quantity_reserved: number
          stock_code_id: string
        }[]
      }
      get_value_feedback_anonymous: {
        Args: { p_scorecard_id: string }
        Returns: {
          comment: string
          note_type: string
          value_definition_id: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      remove_user_completely: {
        Args: { user_id_to_modify: string }
        Returns: undefined
      }
      remove_user_role: {
        Args: {
          role_to_remove: Database["public"]["Enums"]["app_role"]
          user_id_to_modify: string
        }
        Returns: undefined
      }
      sc_is_admin: { Args: { _user_id: string }; Returns: boolean }
      sc_is_manager_or_admin: { Args: { _user_id: string }; Returns: boolean }
      set_credit_pin: { Args: { p_new_pin: string }; Returns: undefined }
      verify_credit_pin: { Args: { p_pin: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "employee" | "customer" | "manager" | "hr"
      fms_role:
        | "system_admin"
        | "production_supervisor"
        | "production_operator"
        | "stores_operator"
        | "dispatch_user"
        | "qa_viewer"
        | "hr_user"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      app_role: ["admin", "employee", "customer", "manager", "hr"],
      fms_role: [
        "system_admin",
        "production_supervisor",
        "production_operator",
        "stores_operator",
        "dispatch_user",
        "qa_viewer",
        "hr_user",
      ],
    },
  },
} as const
