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
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      finance_accounts: {
        Row: {
          account_type: string
          archived_at: string | null
          created_at: string
          credit_limit: number | null
          currency: string
          custom_type_name: string | null
          id: string
          include_in_net_worth: boolean
          institution: string | null
          name: string
          opening_balance: number
          opening_balance_date: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_type: string
          archived_at?: string | null
          created_at?: string
          credit_limit?: number | null
          currency?: string
          custom_type_name?: string | null
          id?: string
          include_in_net_worth?: boolean
          institution?: string | null
          name: string
          opening_balance?: number
          opening_balance_date?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_type?: string
          archived_at?: string | null
          created_at?: string
          credit_limit?: number | null
          currency?: string
          custom_type_name?: string | null
          id?: string
          include_in_net_worth?: boolean
          institution?: string | null
          name?: string
          opening_balance?: number
          opening_balance_date?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "finance_accounts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_budget_categories: {
        Row: {
          amount: number
          budget_id: string
          category_id: string
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          budget_id: string
          category_id: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          budget_id?: string
          category_id?: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "finance_budget_categories_budget_owner_fk"
            columns: ["budget_id", "user_id"]
            isOneToOne: false
            referencedRelation: "finance_budgets"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "finance_budget_categories_category_owner_fk"
            columns: ["category_id", "user_id"]
            isOneToOne: false
            referencedRelation: "finance_categories"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "finance_budget_categories_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_budgets: {
        Row: {
          budget_month: string
          created_at: string
          currency: string
          id: string
          notes: string | null
          overall_limit: number
          updated_at: string
          user_id: string
        }
        Insert: {
          budget_month: string
          created_at?: string
          currency?: string
          id?: string
          notes?: string | null
          overall_limit: number
          updated_at?: string
          user_id: string
        }
        Update: {
          budget_month?: string
          created_at?: string
          currency?: string
          id?: string
          notes?: string | null
          overall_limit?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "finance_budgets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_categories: {
        Row: {
          archived_at: string | null
          category_type: string
          created_at: string
          default_key: string | null
          display_color: string | null
          icon: string | null
          id: string
          is_default: boolean
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          archived_at?: string | null
          category_type: string
          created_at?: string
          default_key?: string | null
          display_color?: string | null
          icon?: string | null
          id?: string
          is_default?: boolean
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          archived_at?: string | null
          category_type?: string
          created_at?: string
          default_key?: string | null
          display_color?: string | null
          icon?: string | null
          id?: string
          is_default?: boolean
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "finance_categories_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_transactions: {
        Row: {
          account_id: string
          amount: number
          category_id: string | null
          created_at: string
          description: string | null
          id: string
          kind: string
          merchant: string | null
          notes: string | null
          recurring_bill_id: string | null
          recurring_income_id: string | null
          status: string
          transaction_date: string
          transfer_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id: string
          amount: number
          category_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          kind: string
          merchant?: string | null
          notes?: string | null
          recurring_bill_id?: string | null
          recurring_income_id?: string | null
          status?: string
          transaction_date: string
          transfer_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string
          amount?: number
          category_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          kind?: string
          merchant?: string | null
          notes?: string | null
          recurring_bill_id?: string | null
          recurring_income_id?: string | null
          status?: string
          transaction_date?: string
          transfer_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "finance_transactions_account_owner_fk"
            columns: ["account_id", "user_id"]
            isOneToOne: false
            referencedRelation: "finance_account_balances"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "finance_transactions_account_owner_fk"
            columns: ["account_id", "user_id"]
            isOneToOne: false
            referencedRelation: "finance_accounts"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "finance_transactions_bill_owner_fk"
            columns: ["recurring_bill_id", "user_id"]
            isOneToOne: false
            referencedRelation: "recurring_bills"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "finance_transactions_category_owner_fk"
            columns: ["category_id", "user_id"]
            isOneToOne: false
            referencedRelation: "finance_categories"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "finance_transactions_income_owner_fk"
            columns: ["recurring_income_id", "user_id"]
            isOneToOne: false
            referencedRelation: "recurring_income"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "finance_transactions_transfer_owner_fk"
            columns: ["transfer_id", "user_id"]
            isOneToOne: false
            referencedRelation: "finance_transfers"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "finance_transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_transfers: {
        Row: {
          amount: number
          created_at: string
          currency: string
          description: string | null
          destination_account_id: string
          id: string
          notes: string | null
          source_account_id: string
          transfer_date: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency: string
          description?: string | null
          destination_account_id: string
          id?: string
          notes?: string | null
          source_account_id: string
          transfer_date: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          description?: string | null
          destination_account_id?: string
          id?: string
          notes?: string | null
          source_account_id?: string
          transfer_date?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "finance_transfers_destination_owner_fk"
            columns: ["destination_account_id", "user_id"]
            isOneToOne: false
            referencedRelation: "finance_account_balances"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "finance_transfers_destination_owner_fk"
            columns: ["destination_account_id", "user_id"]
            isOneToOne: false
            referencedRelation: "finance_accounts"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "finance_transfers_source_owner_fk"
            columns: ["source_account_id", "user_id"]
            isOneToOne: false
            referencedRelation: "finance_account_balances"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "finance_transfers_source_owner_fk"
            columns: ["source_account_id", "user_id"]
            isOneToOne: false
            referencedRelation: "finance_accounts"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "finance_transfers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          currency: string
          display_name: string | null
          id: string
          timezone: string
          updated_at: string
          week_starts_on: number
        }
        Insert: {
          created_at?: string
          currency?: string
          display_name?: string | null
          id: string
          timezone?: string
          updated_at?: string
          week_starts_on?: number
        }
        Update: {
          created_at?: string
          currency?: string
          display_name?: string | null
          id?: string
          timezone?: string
          updated_at?: string
          week_starts_on?: number
        }
        Relationships: []
      }
      recurring_bills: {
        Row: {
          account_id: string
          anchor_date: string
          autopay: boolean
          category_id: string
          created_at: string
          currency: string
          expected_amount: number
          frequency: string
          id: string
          is_active: boolean
          name: string
          next_due_date: string
          reminder_days: number
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id: string
          anchor_date: string
          autopay?: boolean
          category_id: string
          created_at?: string
          currency?: string
          expected_amount: number
          frequency: string
          id?: string
          is_active?: boolean
          name: string
          next_due_date: string
          reminder_days?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string
          anchor_date?: string
          autopay?: boolean
          category_id?: string
          created_at?: string
          currency?: string
          expected_amount?: number
          frequency?: string
          id?: string
          is_active?: boolean
          name?: string
          next_due_date?: string
          reminder_days?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_bills_account_owner_fk"
            columns: ["account_id", "user_id"]
            isOneToOne: false
            referencedRelation: "finance_account_balances"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "recurring_bills_account_owner_fk"
            columns: ["account_id", "user_id"]
            isOneToOne: false
            referencedRelation: "finance_accounts"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "recurring_bills_category_owner_fk"
            columns: ["category_id", "user_id"]
            isOneToOne: false
            referencedRelation: "finance_categories"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "recurring_bills_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      recurring_income: {
        Row: {
          anchor_date: string
          category_id: string | null
          created_at: string
          currency: string
          destination_account_id: string
          expected_amount: number
          frequency: string
          id: string
          is_active: boolean
          name: string
          next_payday: string
          reminder_days: number
          updated_at: string
          user_id: string
        }
        Insert: {
          anchor_date: string
          category_id?: string | null
          created_at?: string
          currency?: string
          destination_account_id: string
          expected_amount: number
          frequency: string
          id?: string
          is_active?: boolean
          name: string
          next_payday: string
          reminder_days?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          anchor_date?: string
          category_id?: string | null
          created_at?: string
          currency?: string
          destination_account_id?: string
          expected_amount?: number
          frequency?: string
          id?: string
          is_active?: boolean
          name?: string
          next_payday?: string
          reminder_days?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_income_account_owner_fk"
            columns: ["destination_account_id", "user_id"]
            isOneToOne: false
            referencedRelation: "finance_account_balances"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "recurring_income_account_owner_fk"
            columns: ["destination_account_id", "user_id"]
            isOneToOne: false
            referencedRelation: "finance_accounts"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "recurring_income_category_owner_fk"
            columns: ["category_id", "user_id"]
            isOneToOne: false
            referencedRelation: "finance_categories"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "recurring_income_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      finance_account_balances: {
        Row: {
          account_type: string | null
          archived_at: string | null
          currency: string | null
          current_balance: number | null
          id: string | null
          include_in_net_worth: boolean | null
          name: string | null
          opening_balance: number | null
          opening_balance_date: string | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "finance_accounts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      create_finance_transfer: {
        Args: {
          destination_account: string
          occurred_on: string
          source_account: string
          transfer_amount: number
          transfer_description?: string
          transfer_notes?: string
        }
        Returns: string
      }
      save_monthly_finance_budget: {
        Args: {
          budget_currency: string
          budget_month: string
          budget_notes?: string
          category_limits?: Json
          overall_amount: number
        }
        Returns: string
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
