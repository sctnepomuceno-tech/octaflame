// Hand-authored to match supabase/migrations exactly.
// Regenerate with `supabase gen types typescript` once a live project exists,
// but keep the shape in sync with the migrations either way.

export type Role = "management" | "dsp" | "warehouse" | "office" | "viewer";
export type SettingDataType = "string" | "number" | "boolean" | "json";
export type ProductUnitType = "canister" | "crate" | "set";
export type InvitationStatus = "pending" | "accepted" | "expired" | "revoked";
export type CustomerType = "HH" | "RTL" | "WS";
export type CustomerStatus = "prospect" | "newly_acquired" | "active" | "dormant" | "inactive";
export type PaymentStatus = "paid" | "partial" | "unpaid";
export type PeriodStatus = "open" | "closed";

export interface Database {
  public: {
    Tables: {
      settings: {
        Row: {
          id: string;
          key: string;
          value: string;
          data_type: SettingDataType;
          label: string;
          description: string | null;
          updated_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["settings"]["Row"]> & {
          key: string;
          value: string;
          data_type: SettingDataType;
          label: string;
        };
        Update: Partial<Database["public"]["Tables"]["settings"]["Row"]>;
        Relationships: [];
      };
      dsps: {
        Row: {
          id: string;
          name: string;
          code: string;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["dsps"]["Row"]> & {
          name: string;
          code: string;
        };
        Update: Partial<Database["public"]["Tables"]["dsps"]["Row"]>;
        Relationships: [];
      };
      municipalities: {
        Row: {
          id: string;
          name: string;
          dsp_id: string | null;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["municipalities"]["Row"]> & {
          name: string;
        };
        Update: Partial<Database["public"]["Tables"]["municipalities"]["Row"]>;
        Relationships: [];
      };
      barangays: {
        Row: {
          id: string;
          municipality_id: string;
          name: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["barangays"]["Row"]> & {
          municipality_id: string;
          name: string;
        };
        Update: Partial<Database["public"]["Tables"]["barangays"]["Row"]>;
        Relationships: [];
      };
      products: {
        Row: {
          id: string;
          code: string;
          name: string;
          unit_price: number;
          unit_type: ProductUnitType;
          canisters_included: number;
          includes_stove: boolean;
          stove_count: number;
          sort_order: number;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["products"]["Row"]> & {
          code: string;
          name: string;
          unit_price: number;
          unit_type: ProductUnitType;
        };
        Update: Partial<Database["public"]["Tables"]["products"]["Row"]>;
        Relationships: [];
      };
      price_history: {
        Row: {
          id: string;
          product_id: string;
          unit_price: number;
          effective_from: string;
          effective_to: string | null;
          changed_by: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["price_history"]["Row"]> & {
          product_id: string;
          unit_price: number;
        };
        Update: Partial<Database["public"]["Tables"]["price_history"]["Row"]>;
        Relationships: [];
      };
      kpi_targets: {
        Row: {
          id: string;
          year: number;
          dsp_id: string | null;
          accounts_target: number;
          volume_target_mt: number;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["kpi_targets"]["Row"]> & {
          year: number;
          accounts_target: number;
          volume_target_mt: number;
        };
        Update: Partial<Database["public"]["Tables"]["kpi_targets"]["Row"]>;
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          full_name: string;
          email: string;
          phone: string | null;
          role: Role;
          dsp_id: string | null;
          permissions: string[];
          active: boolean;
          must_change_password: boolean;
          invited_by: string | null;
          deactivated_at: string | null;
          deactivated_by: string | null;
          last_login_at: string | null;
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["profiles"]["Row"]> & {
          id: string;
          full_name: string;
          email: string;
          role: Role;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Row"]>;
        Relationships: [];
      };
      user_invitations: {
        Row: {
          id: string;
          email: string;
          full_name: string;
          role: Role;
          dsp_id: string | null;
          permissions: string[];
          invited_by: string;
          status: InvitationStatus;
          expires_at: string;
          accepted_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["user_invitations"]["Row"]> & {
          email: string;
          full_name: string;
          role: Role;
          invited_by: string;
        };
        Update: Partial<Database["public"]["Tables"]["user_invitations"]["Row"]>;
        Relationships: [];
      };
      audit_log: {
        Row: {
          id: string;
          user_id: string | null;
          action: string;
          table_name: string;
          record_id: string | null;
          previous_value: Record<string, unknown> | null;
          new_value: Record<string, unknown> | null;
          ip_address: string | null;
          user_agent: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["audit_log"]["Row"]> & {
          action: string;
          table_name: string;
        };
        Update: Partial<Database["public"]["Tables"]["audit_log"]["Row"]>;
        Relationships: [];
      };
      customers: {
        Row: {
          id: string;
          business_name: string | null;
          owner_name: string | null;
          contact_number: string | null;
          customer_type: CustomerType;
          municipality_id: string;
          barangay: string | null;
          address: string | null;
          landmark: string | null;
          latitude: number | null;
          longitude: number | null;
          dsp_id: string | null;
          status: CustomerStatus;
          notes: string | null;
          first_purchase_date: string | null;
          latest_purchase_date: string | null;
          total_transactions: number;
          lifetime_canisters: number;
          lifetime_volume_kg: number;
          lifetime_amount: number;
          average_purchase_amount: number;
          is_repeat_customer: boolean;
          created_by: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["customers"]["Row"]> & {
          customer_type: CustomerType;
          municipality_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["customers"]["Row"]>;
        Relationships: [];
      };
      sales: {
        Row: {
          id: string;
          sale_date: string;
          deployment_date: string | null;
          customer_id: string;
          customer_type: CustomerType;
          municipality_id: string;
          dsp_id: string;
          total_amount: number;
          total_canisters: number;
          total_crates: number;
          total_volume_kg: number;
          total_volume_mt: number;
          is_repeat_purchase: boolean;
          payment_status: PaymentStatus;
          amount_paid: number;
          empties_expected: number;
          empties_collected: number;
          empties_variance: number;
          crates_returned_by_customer: number;
          client_ref: string;
          synced_at: string;
          receipt_no: string;
          notes: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["sales"]["Row"]> & {
          customer_id: string;
          customer_type: CustomerType;
          municipality_id: string;
          dsp_id: string;
          client_ref: string;
        };
        Update: Partial<Database["public"]["Tables"]["sales"]["Row"]>;
        Relationships: [];
      };
      sale_items: {
        Row: {
          id: string;
          sale_id: string;
          product_id: string;
          qty_crates: number;
          qty_canisters: number;
          qty_sets: number;
          unit_price: number;
          line_total: number;
          line_canisters: number;
          line_volume_kg: number;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["sale_items"]["Row"]> & {
          sale_id: string;
          product_id: string;
          unit_price: number;
        };
        Update: Partial<Database["public"]["Tables"]["sale_items"]["Row"]>;
        Relationships: [];
      };
      accounting_periods: {
        Row: {
          id: string;
          year: number;
          month: number;
          status: PeriodStatus;
          closed_by: string | null;
          closed_at: string | null;
          reopened_by: string | null;
          reopened_at: string | null;
          reopen_reason: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["accounting_periods"]["Row"]> & {
          year: number;
          month: number;
        };
        Update: Partial<Database["public"]["Tables"]["accounting_periods"]["Row"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      company_kpi_progress: {
        Args: { p_year?: number };
        Returns: {
          year: number;
          accounts_target: number;
          volume_target_mt: number;
          total_accounts: number;
          total_volume_kg: number;
          total_volume_mt: number;
        }[];
      };
      find_similar_customers: {
        Args: { p_name: string; p_municipality_id: string; p_threshold?: number };
        Returns: {
          id: string;
          business_name: string | null;
          owner_name: string | null;
          similarity: number;
        }[];
      };
      create_sale: {
        Args: {
          p_client_ref: string;
          p_customer_id: string;
          p_sale_date: string;
          p_deployment_date: string | null;
          p_payment_status: string;
          p_amount_paid: number;
          p_empties_collected: number;
          p_crates_returned_by_customer: number;
          p_notes: string | null;
          p_items: {
            product_id: string;
            qty_crates?: number;
            qty_canisters?: number;
            qty_sets?: number;
            notes?: string;
          }[];
        };
        Returns: { sale_id: string; was_duplicate: boolean }[];
      };
      find_recent_similar_sales: {
        Args: { p_customer_id: string; p_total_amount: number; p_minutes?: number };
        Returns: { id: string; receipt_no: string; created_at: string }[];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
