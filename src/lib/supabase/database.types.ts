// Hand-authored to match supabase/migrations exactly.
// Regenerate with `supabase gen types typescript` once a live project exists,
// but keep the shape in sync with the migrations either way.

export type Role = "management" | "dsp" | "warehouse" | "office" | "viewer";
export type SettingDataType = "string" | "number" | "boolean" | "json";
export type ProductUnitType = "canister" | "crate" | "set";
export type InvitationStatus = "pending" | "accepted" | "expired" | "revoked";

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
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
