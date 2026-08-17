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
      inventory_items: {
        Row: {
          id: string;
          name: string;
          category: "crate" | "canister" | "stove" | "other";
          unit: string;
          reorder_level: number;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["inventory_items"]["Row"]> & {
          name: string;
          category: "crate" | "canister" | "stove" | "other";
        };
        Update: Partial<Database["public"]["Tables"]["inventory_items"]["Row"]>;
        Relationships: [];
      };
      dsp_stock_movements: {
        Row: {
          id: string;
          dsp_id: string;
          item_id: string;
          quantity: number;
          direction: "in" | "out";
          movement_type: "issued" | "sold" | "returned_to_warehouse" | "transfer_in" | "transfer_out" | "damaged" | "adjustment";
          movement_date: string;
          reference_table: string | null;
          reference_id: string | null;
          reason: string | null;
          notes: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["dsp_stock_movements"]["Row"]> & {
          dsp_id: string;
          item_id: string;
          quantity: number;
          direction: "in" | "out";
          movement_type: "issued" | "sold" | "returned_to_warehouse" | "transfer_in" | "transfer_out" | "damaged" | "adjustment";
        };
        Update: Partial<Database["public"]["Tables"]["dsp_stock_movements"]["Row"]>;
        Relationships: [];
      };
      stock_issuances: {
        Row: {
          id: string;
          issuance_no: string;
          dsp_id: string;
          issued_by: string | null;
          issue_date: string;
          status: "pending" | "acknowledged" | "disputed";
          acknowledged_by: string | null;
          acknowledged_at: string | null;
          dispute_reason: string | null;
          notes: string | null;
          truck_report_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["stock_issuances"]["Row"]> & { dsp_id: string };
        Update: Partial<Database["public"]["Tables"]["stock_issuances"]["Row"]>;
        Relationships: [];
      };
      stock_issuance_items: {
        Row: {
          id: string;
          issuance_id: string;
          item_id: string;
          quantity_issued: number;
          quantity_received: number | null;
          variance: number;
          notes: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["stock_issuance_items"]["Row"]> & {
          issuance_id: string;
          item_id: string;
          quantity_issued: number;
        };
        Update: Partial<Database["public"]["Tables"]["stock_issuance_items"]["Row"]>;
        Relationships: [];
      };
      empties_movements: {
        Row: {
          id: string;
          item_type: "canister_shell" | "crate";
          quantity: number;
          holder_type: "customer" | "dsp" | "warehouse";
          holder_id: string;
          direction: "in" | "out";
          movement_type: "collected_from_customer" | "owed_by_customer" | "returned_by_customer" | "dsp_to_warehouse" | "warehouse_to_plant" | "lost" | "damaged" | "adjustment";
          movement_date: string;
          reference_table: string | null;
          reference_id: string | null;
          reason: string | null;
          notes: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["empties_movements"]["Row"]> & {
          item_type: "canister_shell" | "crate";
          quantity: number;
          holder_type: "customer" | "dsp" | "warehouse";
          holder_id: string;
          direction: "in" | "out";
          movement_type: "collected_from_customer" | "owed_by_customer" | "returned_by_customer" | "dsp_to_warehouse" | "warehouse_to_plant" | "lost" | "damaged" | "adjustment";
        };
        Update: Partial<Database["public"]["Tables"]["empties_movements"]["Row"]>;
        Relationships: [];
      };
      stock_counts: {
        Row: {
          id: string;
          scope: "dsp" | "warehouse";
          scope_id: string;
          count_date: string;
          counted_by: string | null;
          status: "draft" | "submitted" | "approved";
          approved_by: string | null;
          approved_at: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["stock_counts"]["Row"]> & {
          scope: "dsp" | "warehouse";
          scope_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["stock_counts"]["Row"]>;
        Relationships: [];
      };
      stock_count_items: {
        Row: {
          id: string;
          count_id: string;
          item_id: string;
          system_quantity: number;
          counted_quantity: number | null;
          variance: number;
          reason: string | null;
          notes: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["stock_count_items"]["Row"]> & {
          count_id: string;
          item_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["stock_count_items"]["Row"]>;
        Relationships: [];
      };
      sale_returns: {
        Row: {
          id: string;
          sale_id: string;
          sale_item_id: string;
          product_id: string;
          quantity: number;
          return_type: "damaged" | "leaking" | "wrong_item" | "customer_return" | "expired";
          restockable: boolean;
          refund_amount: number;
          return_date: string;
          notes: string | null;
          created_by: string | null;
          approved_by: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["sale_returns"]["Row"]> & {
          sale_id: string;
          sale_item_id: string;
          product_id: string;
          quantity: number;
          return_type: "damaged" | "leaking" | "wrong_item" | "customer_return" | "expired";
        };
        Update: Partial<Database["public"]["Tables"]["sale_returns"]["Row"]>;
        Relationships: [];
      };
      stock_movements: {
        Row: {
          id: string;
          item_id: string;
          movement_type: "in" | "out" | "transfer" | "adjustment" | "return";
          quantity: number;
          direction: "in" | "out";
          movement_date: string;
          source: string | null;
          destination_dsp_id: string | null;
          destination_municipality_id: string | null;
          truck_report_id: string | null;
          reference_no: string | null;
          reason: string | null;
          remarks: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["stock_movements"]["Row"]> & {
          item_id: string;
          movement_type: "in" | "out" | "transfer" | "adjustment" | "return";
          quantity: number;
          direction: "in" | "out";
        };
        Update: Partial<Database["public"]["Tables"]["stock_movements"]["Row"]>;
        Relationships: [];
      };
      truck_reports: {
        Row: {
          id: string;
          report_date: string;
          truck_plate: string | null;
          driver_name: string | null;
          helper_name: string | null;
          dsp_id: string | null;
          destination_municipality_ids: string[];
          crates_out: number;
          crates_returned: number;
          empty_crates_collected: number;
          stoves_out: number;
          stoves_returned: number;
          fuel_cost: number;
          odometer_start: number | null;
          odometer_end: number | null;
          remarks: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["truck_reports"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["truck_reports"]["Row"]>;
        Relationships: [];
      };
      collateral_items: {
        Row: {
          id: string;
          name: string;
          category: string | null;
          unit: string;
          reorder_level: number;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["collateral_items"]["Row"]> & { name: string };
        Update: Partial<Database["public"]["Tables"]["collateral_items"]["Row"]>;
        Relationships: [];
      };
      collateral_movements: {
        Row: {
          id: string;
          item_id: string;
          movement_type: "in" | "out" | "adjustment" | "return";
          quantity: number;
          direction: "in" | "out";
          movement_date: string;
          assigned_to_dsp_id: string | null;
          assigned_to_municipality_id: string | null;
          assigned_to_customer_id: string | null;
          received_by: string | null;
          reference_no: string | null;
          reason: string | null;
          remarks: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["collateral_movements"]["Row"]> & {
          item_id: string;
          movement_type: "in" | "out" | "adjustment" | "return";
          quantity: number;
          direction: "in" | "out";
        };
        Update: Partial<Database["public"]["Tables"]["collateral_movements"]["Row"]>;
        Relationships: [];
      };
      task_types: {
        Row: {
          id: string;
          name: string;
          color: string;
          sort_order: number;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["task_types"]["Row"]> & { name: string };
        Update: Partial<Database["public"]["Tables"]["task_types"]["Row"]>;
        Relationships: [];
      };
      tasks: {
        Row: {
          id: string;
          title: string;
          description: string | null;
          task_type_id: string | null;
          assigned_to: string;
          assigned_by: string;
          customer_id: string | null;
          municipality_id: string | null;
          dsp_id: string | null;
          sale_id: string | null;
          due_date: string | null;
          due_time: string | null;
          priority: "low" | "medium" | "high" | "urgent";
          status: "pending" | "in_progress" | "completed" | "cancelled";
          tags: string[];
          completed_at: string | null;
          completion_notes: string | null;
          cancelled_reason: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["tasks"]["Row"]> & {
          title: string;
          assigned_to: string;
          assigned_by: string;
        };
        Update: Partial<Database["public"]["Tables"]["tasks"]["Row"]>;
        Relationships: [];
      };
      activity_log: {
        Row: {
          id: string;
          customer_id: string;
          activity_type: "customer_created" | "sale" | "task_created" | "task_completed" | "collateral_delivered" | "status_changed" | "note";
          activity_date: string;
          title: string;
          description: string | null;
          metadata: Record<string, unknown> | null;
          reference_table: string | null;
          reference_id: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["activity_log"]["Row"]> & {
          customer_id: string;
          activity_type: "customer_created" | "sale" | "task_created" | "task_completed" | "collateral_delivered" | "status_changed" | "note";
          title: string;
        };
        Update: Partial<Database["public"]["Tables"]["activity_log"]["Row"]>;
        Relationships: [];
      };
    };
    Views: {
      dsp_stock_balance: {
        Row: { dsp_id: string; item_id: string; balance: number };
        Relationships: [];
      };
      customer_empties_balance: {
        Row: { customer_id: string; item_type: "canister_shell" | "crate"; balance: number };
        Relationships: [];
      };
      dsp_empties_balance: {
        Row: { dsp_id: string; item_type: "canister_shell" | "crate"; balance: number };
        Relationships: [];
      };
      warehouse_empties_balance: {
        Row: { warehouse_id: string; item_type: "canister_shell" | "crate"; balance: number };
        Relationships: [];
      };
      dsp_stock_reconciliation: {
        Row: {
          dsp_id: string;
          item_id: string;
          ledger_balance: number;
          last_physical_count: number | null;
          last_count_date: string | null;
          variance: number | null;
        };
        Relationships: [];
      };
      warehouse_stock_balance: {
        Row: { item_id: string; balance: number };
        Relationships: [];
      };
      collateral_balance: {
        Row: { item_id: string; balance: number };
        Relationships: [];
      };
      collateral_dsp_allocation: {
        Row: { dsp_id: string; item_id: string; year: number; quantity: number };
        Relationships: [];
      };
    };
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
      create_stock_issuance: {
        Args: {
          p_dsp_id: string;
          p_issue_date: string;
          p_notes: string | null;
          p_items: { item_id: string; quantity_issued: number; notes?: string }[];
        };
        Returns: string;
      };
      acknowledge_stock_issuance: {
        Args: {
          p_issuance_id: string;
          p_received: { item_id: string; quantity_received: number }[];
          p_dispute_reason?: string | null;
        };
        Returns: undefined;
      };
      record_empties_collection: {
        Args: {
          p_customer_id: string;
          p_item_type: "canister_shell" | "crate";
          p_quantity: number;
          p_notes?: string | null;
        };
        Returns: undefined;
      };
      start_stock_count: {
        Args: { p_scope: "dsp" | "warehouse"; p_scope_id: string; p_notes?: string | null };
        Returns: string;
      };
      submit_stock_count: {
        Args: {
          p_count_id: string;
          p_items: { item_id: string; counted_quantity: number; reason?: string; notes?: string }[];
        };
        Returns: undefined;
      };
      approve_stock_count: {
        Args: { p_count_id: string };
        Returns: undefined;
      };
      create_sale_return: {
        Args: {
          p_sale_item_id: string;
          p_quantity: number;
          p_return_type: "damaged" | "leaking" | "wrong_item" | "customer_return" | "expired";
          p_restockable: boolean;
          p_refund_amount: number;
          p_return_date: string;
          p_notes: string | null;
        };
        Returns: string;
      };
      record_warehouse_stock_in: {
        Args: {
          p_item_id: string;
          p_quantity: number;
          p_source: string | null;
          p_reference_no: string | null;
          p_remarks: string | null;
        };
        Returns: undefined;
      };
      record_warehouse_adjustment: {
        Args: {
          p_item_id: string;
          p_quantity: number;
          p_direction: "in" | "out";
          p_reason: string;
          p_remarks: string | null;
        };
        Returns: undefined;
      };
      dsp_to_warehouse_transfer: {
        Args: {
          p_dsp_id: string;
          p_item_type: "canister_shell" | "crate";
          p_quantity: number;
          p_notes?: string | null;
        };
        Returns: undefined;
      };
      warehouse_to_plant_transfer: {
        Args: { p_item_type: "canister_shell" | "crate"; p_quantity: number; p_notes?: string | null };
        Returns: undefined;
      };
      period_close_precheck: {
        Args: { p_year: number; p_month: number };
        Returns: { check_name: string; item_count: number; description: string }[];
      };
      close_accounting_period: {
        Args: { p_year: number; p_month: number };
        Returns: undefined;
      };
      reopen_accounting_period: {
        Args: { p_year: number; p_month: number; p_reason: string };
        Returns: undefined;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
