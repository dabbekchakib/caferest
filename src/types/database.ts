export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type Datetime = string;

export interface Database {
  public: {
    Tables: {
      establishments: {
        Row: {
          id: string;
          name: string;
          legal_name: string | null;
          description: string | null;
          address: string | null;
          city: string | null;
          postal_code: string | null;
          country: string | null;
          phone: string | null;
          email: string | null;
          website: string | null;
          tax_identifier: string | null;
          registration_number: string | null;
          logo_url: string | null;
          favicon_url: string | null;
          receipt_header: string | null;
          receipt_footer: string | null;
          is_active: boolean;
          created_at: Datetime;
          updated_at: Datetime;
        };
        Insert: {
          id?: string;
          name: string;
          legal_name?: string | null;
          description?: string | null;
          address?: string | null;
          city?: string | null;
          postal_code?: string | null;
          country?: string | null;
          phone?: string | null;
          email?: string | null;
          website?: string | null;
          tax_identifier?: string | null;
          registration_number?: string | null;
          logo_url?: string | null;
          favicon_url?: string | null;
          receipt_header?: string | null;
          receipt_footer?: string | null;
          is_active?: boolean;
          created_at?: Datetime;
          updated_at?: Datetime;
        };
        Update: Partial<
          Database["public"]["Tables"]["establishments"]["Insert"]
        >;
        Relationships: [];
      };
      establishment_members: {
        Row: {
          user_id: string;
          establishment_id: string;
          is_active: boolean;
          created_at: Datetime;
        };
        Insert: {
          user_id: string;
          establishment_id: string;
          is_active?: boolean;
          created_at?: Datetime;
        };
        Update: Partial<
          Database["public"]["Tables"]["establishment_members"]["Insert"]
        >;
        Relationships: [];
      };
      settings: {
        Row: {
          id: string;
          establishment_id: string;
          key: string;
          value: string | null;
          type: SettingType;
          group_name: SettingGroup;
          description: string | null;
          is_public: boolean;
          created_at: Datetime;
          updated_at: Datetime;
        };
        Insert: {
          id?: string;
          establishment_id: string;
          key: string;
          value?: string | null;
          type?: SettingType;
          group_name?: SettingGroup;
          description?: string | null;
          is_public?: boolean;
          created_at?: Datetime;
          updated_at?: Datetime;
        };
        Update: Partial<Database["public"]["Tables"]["settings"]["Insert"]>;
        Relationships: [];
      };
      locales: {
        Row: {
          code: string;
          name: string;
          native_name: string;
          rtl: boolean;
          is_active: boolean;
          sort_order: number;
          created_at: Datetime;
          updated_at: Datetime;
        };
        Insert: {
          code: string;
          name: string;
          native_name: string;
          rtl?: boolean;
          is_active?: boolean;
          sort_order?: number;
          created_at?: Datetime;
          updated_at?: Datetime;
        };
        Update: Partial<Database["public"]["Tables"]["locales"]["Insert"]>;
        Relationships: [];
      };
      units: {
        Row: {
          id: string;
          establishment_id: string | null;
          name: string;
          symbol: string;
          category: UnitCategory;
          type: UnitType;
          slug: string | null;
          description: string | null;
          precision: number;
          is_base: boolean;
          is_system: boolean;
          is_active: boolean;
          created_at: Datetime;
          updated_at: Datetime;
        };
        Insert: {
          id?: string;
          establishment_id?: string | null;
          name: string;
          symbol: string;
          category?: UnitCategory;
          type?: UnitType;
          slug?: string | null;
          description?: string | null;
          precision?: number;
          is_base?: boolean;
          is_system?: boolean;
          is_active?: boolean;
          created_at?: Datetime;
          updated_at?: Datetime;
        };
        Update: Partial<Database["public"]["Tables"]["units"]["Insert"]>;
        Relationships: [];
      };
      unit_conversions: {
        Row: {
          id: string;
          establishment_id: string | null;
          from_unit_id: string;
          to_unit_id: string;
          factor: number;
          offset_value: number;
          is_system: boolean;
          is_active: boolean;
          created_at: Datetime;
          updated_at: Datetime;
        };
        Insert: {
          id?: string;
          establishment_id?: string | null;
          from_unit_id: string;
          to_unit_id: string;
          factor?: number;
          offset_value?: number;
          is_system?: boolean;
          is_active?: boolean;
          created_at?: Datetime;
          updated_at?: Datetime;
        };
        Update: Partial<
          Database["public"]["Tables"]["unit_conversions"]["Insert"]
        >;
        Relationships: [];
      };
      categories: {
        Row: {
          id: string;
          establishment_id: string;
          parent_id: string | null;
          name: string;
          slug: string;
          description: string | null;
          image_url: string | null;
          icon: string | null;
          color: string | null;
          sort_order: number;
          is_active: boolean;
          is_system: boolean;
          created_at: Datetime;
          updated_at: Datetime;
        };
        Insert: {
          id?: string;
          establishment_id: string;
          parent_id?: string | null;
          name: string;
          slug: string;
          description?: string | null;
          image_url?: string | null;
          icon?: string | null;
          color?: string | null;
          sort_order?: number;
          is_active?: boolean;
          is_system?: boolean;
          created_at?: Datetime;
          updated_at?: Datetime;
        };
        Update: Partial<Database["public"]["Tables"]["categories"]["Insert"]>;
        Relationships: [];
      };
      category_translations: {
        Row: {
          id: string;
          category_id: string;
          locale: string;
          name: string;
          description: string | null;
          created_at: Datetime;
          updated_at: Datetime;
        };
        Insert: {
          id?: string;
          category_id: string;
          locale: string;
          name: string;
          description?: string | null;
          created_at?: Datetime;
          updated_at?: Datetime;
        };
        Update: Partial<
          Database["public"]["Tables"]["category_translations"]["Insert"]
        >;
        Relationships: [];
      };
      taxes: {
        Row: {
          id: string;
          establishment_id: string;
          name: string;
          code: string;
          rate: number;
          is_default: boolean;
          is_active: boolean;
          created_at: Datetime;
          updated_at: Datetime;
        };
        Insert: {
          id?: string;
          establishment_id: string;
          name: string;
          code: string;
          rate?: number;
          is_default?: boolean;
          is_active?: boolean;
          created_at?: Datetime;
          updated_at?: Datetime;
        };
        Update: Partial<Database["public"]["Tables"]["taxes"]["Insert"]>;
        Relationships: [];
      };
      products: {
        Row: {
          id: string;
          establishment_id: string;
          category_id: string | null;
          name: string;
          slug: string;
          short_description: string | null;
          description: string | null;
          sku: string | null;
          barcode: string | null;
          product_type: ProductType;
          unit_id: string | null;
          tax_id: string | null;
          price: number;
          cost: number;
          image_url: string | null;
          sort_order: number;
          is_active: boolean;
          is_available: boolean;
          is_featured: boolean;
          is_pos_enabled: boolean;
          is_stock_tracked: boolean;
          is_system: boolean;
          created_at: Datetime;
          updated_at: Datetime;
        };
        Insert: {
          id?: string;
          establishment_id: string;
          category_id?: string | null;
          name: string;
          slug: string;
          short_description?: string | null;
          description?: string | null;
          sku?: string | null;
          barcode?: string | null;
          product_type?: ProductType;
          unit_id?: string | null;
          tax_id?: string | null;
          price?: number;
          cost?: number;
          image_url?: string | null;
          sort_order?: number;
          is_active?: boolean;
          is_available?: boolean;
          is_featured?: boolean;
          is_pos_enabled?: boolean;
          is_stock_tracked?: boolean;
          is_system?: boolean;
          created_at?: Datetime;
          updated_at?: Datetime;
        };
        Update: Partial<Database["public"]["Tables"]["products"]["Insert"]>;
        Relationships: [];
      };
      product_translations: {
        Row: {
          id: string;
          product_id: string;
          locale: string;
          name: string;
          short_description: string | null;
          description: string | null;
          created_at: Datetime;
          updated_at: Datetime;
        };
        Insert: {
          id?: string;
          product_id: string;
          locale: string;
          name: string;
          short_description?: string | null;
          description?: string | null;
          created_at?: Datetime;
          updated_at?: Datetime;
        };
        Update: Partial<Database["public"]["Tables"]["product_translations"]["Insert"]>;
        Relationships: [];
      };
      ingredients: {
        Row: {
          id: string;
          establishment_id: string;
          category_id: string | null;
          name: string;
          slug: string;
          sku: string | null;
          barcode: string | null;
          description: string | null;
          ingredient_type: IngredientType;
          base_unit_id: string | null;
          purchase_unit_id: string | null;
          purchase_quantity: number;
          purchase_cost: number;
          waste_percentage: number;
          image_url: string | null;
          minimum_stock: number;
          maximum_stock: number | null;
          reorder_point: number;
          is_stock_tracked: boolean;
          is_active: boolean;
          is_system: boolean;
          sort_order: number;
          created_at: Datetime;
          updated_at: Datetime;
        };
        Insert: {
          id?: string;
          establishment_id: string;
          category_id?: string | null;
          name: string;
          slug: string;
          sku?: string | null;
          barcode?: string | null;
          description?: string | null;
          ingredient_type?: IngredientType;
          base_unit_id?: string | null;
          purchase_unit_id?: string | null;
          purchase_quantity?: number;
          purchase_cost?: number;
          waste_percentage?: number;
          image_url?: string | null;
          minimum_stock?: number;
          maximum_stock?: number | null;
          reorder_point?: number;
          is_stock_tracked?: boolean;
          is_active?: boolean;
          is_system?: boolean;
          sort_order?: number;
          created_at?: Datetime;
          updated_at?: Datetime;
        };
        Update: Partial<Database["public"]["Tables"]["ingredients"]["Insert"]>;
        Relationships: [];
      };
      ingredient_translations: {
        Row: {
          id: string;
          ingredient_id: string;
          locale: string;
          name: string;
          description: string | null;
          created_at: Datetime;
          updated_at: Datetime;
        };
        Insert: {
          id?: string;
          ingredient_id: string;
          locale: string;
          name: string;
          description?: string | null;
          created_at?: Datetime;
          updated_at?: Datetime;
        };
        Update: Partial<Database["public"]["Tables"]["ingredient_translations"]["Insert"]>;
        Relationships: [];
      };
      recipes: {
        Row: {
          id: string;
          establishment_id: string;
          product_id: string;
          name: string;
          description: string | null;
          yield_type: YieldType;
          default_yield: number;
          yield_unit_id: string | null;
          preparation_time: number | null;
          is_active: boolean;
          version: number;
          status: RecipeStatus;
          is_default: boolean;
          notes: string | null;
          is_system: boolean;
          sort_order: number;
          created_by: string | null;
          updated_by: string | null;
          created_at: Datetime;
          updated_at: Datetime;
        };
        Insert: {
          id?: string;
          establishment_id: string;
          product_id: string;
          name: string;
          description?: string | null;
          yield_type?: YieldType;
          default_yield?: number;
          yield_unit_id?: string | null;
          preparation_time?: number | null;
          is_active?: boolean;
          version?: number;
          status?: RecipeStatus;
          is_default?: boolean;
          notes?: string | null;
          is_system?: boolean;
          sort_order?: number;
          created_by?: string | null;
          updated_by?: string | null;
          created_at?: Datetime;
          updated_at?: Datetime;
        };
        Update: Partial<Database["public"]["Tables"]["recipes"]["Insert"]>;
        Relationships: [];
      };
      recipe_items: {
        Row: {
          id: string;
          recipe_id: string;
          ingredient_id: string | null;
          sub_recipe_id: string | null;
          quantity: number;
          unit_id: string | null;
          waste_percentage: number;
          notes: string | null;
          sort_order: number;
          created_at: Datetime;
          updated_at: Datetime;
        };
        Insert: {
          id?: string;
          recipe_id: string;
          ingredient_id?: string | null;
          sub_recipe_id?: string | null;
          quantity?: number;
          unit_id?: string | null;
          waste_percentage?: number;
          notes?: string | null;
          sort_order?: number;
          created_at?: Datetime;
          updated_at?: Datetime;
        };
        Update: Partial<Database["public"]["Tables"]["recipe_items"]["Insert"]>;
        Relationships: [];
      };
      recipe_translations: {
        Row: {
          id: string;
          recipe_id: string;
          locale: string;
          name: string;
          description: string | null;
          notes: string | null;
          created_at: Datetime;
          updated_at: Datetime;
        };
        Insert: {
          id?: string;
          recipe_id: string;
          locale: string;
          name: string;
          description?: string | null;
          notes?: string | null;
          created_at?: Datetime;
          updated_at?: Datetime;
        };
        Update: Partial<
          Database["public"]["Tables"]["recipe_translations"]["Insert"]
        >;
        Relationships: [];
      };
      recipe_yields: {
        Row: {
          id: string;
          recipe_id: string;
          yield_type: string;
          input_quantity: number | null;
          input_unit_id: string | null;
          output_quantity: number | null;
          output_unit_id: string | null;
          minimum_yield: number | null;
          standard_yield: number | null;
          maximum_yield: number | null;
          yield_percentage: number | null;
          notes: string | null;
          is_active: boolean;
          created_by: string | null;
          updated_by: string | null;
          created_at: Datetime;
          updated_at: Datetime;
        };
        Insert: {
          id?: string;
          recipe_id: string;
          yield_type?: string;
          input_quantity?: number | null;
          input_unit_id?: string | null;
          output_quantity?: number | null;
          output_unit_id?: string | null;
          minimum_yield?: number | null;
          standard_yield?: number | null;
          maximum_yield?: number | null;
          yield_percentage?: number | null;
          notes?: string | null;
          is_active?: boolean;
          created_by?: string | null;
          updated_by?: string | null;
          created_at?: Datetime;
          updated_at?: Datetime;
        };
        Update: Partial<
          Database["public"]["Tables"]["recipe_yields"]["Insert"]
        >;
        Relationships: [];
      };
      suppliers: {
        Row: {
          id: string;
          establishment_id: string;
          name: string;
          code: string | null;
          contact_name: string | null;
          phone: string | null;
          email: string | null;
          address: string | null;
          tax_identifier: string | null;
          notes: string | null;
          is_active: boolean;
          legal_name: string | null;
          registration_number: string | null;
          mobile: string | null;
          website: string | null;
          address_line_1: string | null;
          address_line_2: string | null;
          postal_code: string | null;
          city: string | null;
          state: string | null;
          country: string | null;
          contact_person: string | null;
          contact_email: string | null;
          contact_phone: string | null;
          payment_terms: string | null;
          default_payment_method_id: string | null;
          delivery_lead_time_days: number | null;
          minimum_order_amount: number | null;
          is_preferred: boolean;
          created_by: string | null;
          updated_by: string | null;
          created_at: Datetime;
          updated_at: Datetime;
        };
        Insert: {
          id?: string;
          establishment_id: string;
          name: string;
          code?: string | null;
          contact_name?: string | null;
          phone?: string | null;
          email?: string | null;
          address?: string | null;
          tax_identifier?: string | null;
          notes?: string | null;
          is_active?: boolean;
          legal_name?: string | null;
          registration_number?: string | null;
          mobile?: string | null;
          website?: string | null;
          address_line_1?: string | null;
          address_line_2?: string | null;
          postal_code?: string | null;
          city?: string | null;
          state?: string | null;
          country?: string | null;
          contact_person?: string | null;
          contact_email?: string | null;
          contact_phone?: string | null;
          payment_terms?: string | null;
          default_payment_method_id?: string | null;
          delivery_lead_time_days?: number | null;
          minimum_order_amount?: number | null;
          is_preferred?: boolean;
          created_by?: string | null;
          updated_by?: string | null;
          created_at?: Datetime;
          updated_at?: Datetime;
        };
        Update: Partial<Database["public"]["Tables"]["suppliers"]["Insert"]>;
        Relationships: [];
      };
      supplier_contacts: {
        Row: {
          id: string;
          supplier_id: string;
          first_name: string | null;
          last_name: string | null;
          job_title: string | null;
          email: string | null;
          phone: string | null;
          mobile: string | null;
          is_primary: boolean;
          is_active: boolean;
          created_by: string | null;
          updated_by: string | null;
          created_at: Datetime;
          updated_at: Datetime;
        };
        Insert: {
          id?: string;
          supplier_id: string;
          first_name?: string | null;
          last_name?: string | null;
          job_title?: string | null;
          email?: string | null;
          phone?: string | null;
          mobile?: string | null;
          is_primary?: boolean;
          is_active?: boolean;
          created_by?: string | null;
          updated_by?: string | null;
          created_at?: Datetime;
          updated_at?: Datetime;
        };
        Update: Partial<
          Database["public"]["Tables"]["supplier_contacts"]["Insert"]
        >;
        Relationships: [];
      };
      ingredient_suppliers: {
        Row: {
          id: string;
          establishment_id: string;
          ingredient_id: string;
          supplier_id: string;
          supplier_sku: string | null;
          supplier_barcode: string | null;
          purchase_unit_id: string | null;
          purchase_quantity: number;
          purchase_price: number;
          currency_code: string;
          minimum_order_quantity: number | null;
          lead_time_days: number | null;
          is_preferred: boolean;
          is_active: boolean;
          valid_from: Datetime;
          valid_until: Datetime | null;
          notes: string | null;
          created_by: string | null;
          updated_by: string | null;
          created_at: Datetime;
          updated_at: Datetime;
        };
        Insert: {
          id?: string;
          establishment_id: string;
          ingredient_id: string;
          supplier_id: string;
          supplier_sku?: string | null;
          supplier_barcode?: string | null;
          purchase_unit_id?: string | null;
          purchase_quantity?: number;
          purchase_price?: number;
          currency_code?: string;
          minimum_order_quantity?: number | null;
          lead_time_days?: number | null;
          is_preferred?: boolean;
          is_active?: boolean;
          valid_from?: Datetime;
          valid_until?: Datetime | null;
          notes?: string | null;
          created_by?: string | null;
          updated_by?: string | null;
          created_at?: Datetime;
          updated_at?: Datetime;
        };
        Update: Partial<
          Database["public"]["Tables"]["ingredient_suppliers"]["Insert"]
        >;
        Relationships: [];
      };
      supplier_price_history: {
        Row: {
          id: string;
          establishment_id: string;
          ingredient_supplier_id: string;
          purchase_price: number;
          currency_code: string;
          purchase_unit_id: string | null;
          purchase_quantity: number;
          valid_from: Datetime;
          valid_until: Datetime | null;
          source: string | null;
          notes: string | null;
          created_by: string | null;
          created_at: Datetime;
        };
        Insert: {
          id?: string;
          establishment_id: string;
          ingredient_supplier_id: string;
          purchase_price: number;
          currency_code: string;
          purchase_unit_id?: string | null;
          purchase_quantity?: number;
          valid_from?: Datetime;
          valid_until?: Datetime | null;
          source?: string | null;
          notes?: string | null;
          created_by?: string | null;
          created_at?: Datetime;
        };
        Update: Partial<
          Database["public"]["Tables"]["supplier_price_history"]["Insert"]
        >;
        Relationships: [];
      };
      purchase_orders: {
        Row: {
          id: string;
          establishment_id: string;
          supplier_id: string | null;
          order_number: string;
          status: PurchaseOrderStatus;
          order_date: Datetime;
          expected_delivery_date: Datetime | null;
          currency_code: string;
          subtotal: number;
          discount_amount: number;
          tax_amount: number;
          shipping_amount: number;
          other_charges: number;
          total: number;
          notes: string | null;
          internal_notes: string | null;
          supplier_notes: string | null;
          shipping_address: string | null;
          billing_address: string | null;
          approved_by: string | null;
          approved_at: Datetime | null;
          sent_at: Datetime | null;
          cancelled_at: Datetime | null;
          closed_at: Datetime | null;
          cancellation_reason: string | null;
          created_by: string | null;
          updated_by: string | null;
          created_at: Datetime;
          updated_at: Datetime;
        };
        Insert: {
          id?: string;
          establishment_id: string;
          supplier_id?: string | null;
          order_number: string;
          status?: PurchaseOrderStatus;
          order_date?: Datetime;
          expected_delivery_date?: Datetime | null;
          currency_code?: string;
          subtotal?: number;
          discount_amount?: number;
          tax_amount?: number;
          shipping_amount?: number;
          other_charges?: number;
          total?: number;
          notes?: string | null;
          internal_notes?: string | null;
          supplier_notes?: string | null;
          shipping_address?: string | null;
          billing_address?: string | null;
          approved_by?: string | null;
          approved_at?: Datetime | null;
          sent_at?: Datetime | null;
          cancelled_at?: Datetime | null;
          closed_at?: Datetime | null;
          cancellation_reason?: string | null;
          created_by?: string | null;
          updated_by?: string | null;
          created_at?: Datetime;
          updated_at?: Datetime;
        };
        Update: Partial<
          Database["public"]["Tables"]["purchase_orders"]["Insert"]
        >;
        Relationships: [];
      };
      purchase_order_items: {
        Row: {
          id: string;
          purchase_order_id: string;
          ingredient_id: string | null;
          ingredient_supplier_id: string | null;
          description: string | null;
          supplier_sku: string | null;
          quantity: number;
          purchase_unit_id: string | null;
          unit_price: number;
          discount_type: string;
          discount_value: number;
          discount_amount: number;
          tax_id: string | null;
          tax_rate: number;
          tax_amount: number;
          subtotal: number;
          total: number;
          received_quantity: number;
          remaining_quantity: number;
          notes: string | null;
          sort_order: number;
          created_at: Datetime;
          updated_at: Datetime;
        };
        Insert: {
          id?: string;
          purchase_order_id: string;
          ingredient_id?: string | null;
          ingredient_supplier_id?: string | null;
          description?: string | null;
          supplier_sku?: string | null;
          quantity?: number;
          purchase_unit_id?: string | null;
          unit_price?: number;
          discount_type?: string;
          discount_value?: number;
          discount_amount?: number;
          tax_id?: string | null;
          tax_rate?: number;
          tax_amount?: number;
          subtotal?: number;
          total?: number;
          received_quantity?: number;
          remaining_quantity?: number;
          notes?: string | null;
          sort_order?: number;
          created_at?: Datetime;
          updated_at?: Datetime;
        };
        Update: Partial<
          Database["public"]["Tables"]["purchase_order_items"]["Insert"]
        >;
        Relationships: [];
      };
      purchase_order_status_history: {
        Row: {
          id: string;
          purchase_order_id: string;
          from_status: string | null;
          to_status: string;
          reason: string | null;
          changed_by: string | null;
          created_at: Datetime;
        };
        Insert: {
          id?: string;
          purchase_order_id: string;
          from_status?: string | null;
          to_status: string;
          reason?: string | null;
          changed_by?: string | null;
          created_at?: Datetime;
        };
        Update: Partial<
          Database["public"]["Tables"]["purchase_order_status_history"]["Insert"]
        >;
        Relationships: [];
      };
      inventory_locations: {
        Row: {
          id: string;
          establishment_id: string;
          name: string;
          code: string;
          type: InventoryLocationType;
          is_active: boolean;
          created_at: Datetime;
          updated_at: Datetime;
        };
        Insert: {
          id?: string;
          establishment_id: string;
          name: string;
          code: string;
          type?: InventoryLocationType;
          is_active?: boolean;
          created_at?: Datetime;
          updated_at?: Datetime;
        };
        Update: Partial<
          Database["public"]["Tables"]["inventory_locations"]["Insert"]
        >;
        Relationships: [];
      };
      stock_items: {
        Row: {
          id: string;
          establishment_id: string;
          ingredient_id: string;
          location_id: string;
          quantity: number;
          reserved_quantity: number;
          average_cost: number;
          last_cost: number | null;
          created_at: Datetime;
          updated_at: Datetime;
        };
        Insert: {
          id?: string;
          establishment_id: string;
          ingredient_id: string;
          location_id: string;
          quantity?: number;
          reserved_quantity?: number;
          average_cost?: number;
          last_cost?: number | null;
          created_at?: Datetime;
          updated_at?: Datetime;
        };
        Update: Partial<Database["public"]["Tables"]["stock_items"]["Insert"]>;
        Relationships: [];
      };
      stock_movements: {
        Row: {
          id: string;
          establishment_id: string;
          ingredient_id: string;
          location_id: string | null;
          movement_type: StockMovementType;
          direction: StockMovementDirection;
          quantity: number;
          base_quantity: number | null;
          base_unit_id: string | null;
          unit_id: string | null;
          unit_cost: number;
          total_cost: number;
          reference_type: string | null;
          reference_id: string | null;
          goods_receipt_id: string | null;
          goods_receipt_item_id: string | null;
          lot_number: string | null;
          batch_number: string | null;
          expiry_date: string | null;
          reason: string | null;
          created_by: string | null;
          created_at: Datetime;
        };
        Insert: {
          id?: string;
          establishment_id: string;
          ingredient_id: string;
          location_id?: string | null;
          movement_type: StockMovementType;
          direction?: StockMovementDirection;
          quantity: number;
          base_quantity?: number | null;
          base_unit_id?: string | null;
          unit_id?: string | null;
          unit_cost?: number;
          total_cost?: number;
          reference_type?: string | null;
          reference_id?: string | null;
          goods_receipt_id?: string | null;
          goods_receipt_item_id?: string | null;
          lot_number?: string | null;
          batch_number?: string | null;
          expiry_date?: string | null;
          reason?: string | null;
          created_by?: string | null;
          created_at?: Datetime;
        };
        Update: Partial<
          Database["public"]["Tables"]["stock_movements"]["Insert"]
        >;
        Relationships: [];
      };
      goods_receipts: {
        Row: {
          id: string;
          establishment_id: string;
          purchase_order_id: string;
          receipt_number: string;
          receipt_date: Datetime;
          supplier_id: string;
          inventory_location_id: string | null;
          status: GoodsReceiptStatus;
          delivery_note_number: string | null;
          supplier_invoice_number: string | null;
          subtotal: number;
          discount_amount: number;
          tax_amount: number;
          total_amount: number;
          notes: string | null;
          internal_notes: string | null;
          received_by: string | null;
          validated_by: string | null;
          validated_at: Datetime | null;
          cancelled_by: string | null;
          cancelled_at: Datetime | null;
          cancellation_reason: string | null;
          created_by: string | null;
          updated_by: string | null;
          created_at: Datetime;
          updated_at: Datetime;
        };
        Insert: {
          id?: string;
          establishment_id: string;
          purchase_order_id: string;
          receipt_number: string;
          receipt_date?: Datetime;
          supplier_id: string;
          inventory_location_id?: string | null;
          status?: GoodsReceiptStatus;
          delivery_note_number?: string | null;
          supplier_invoice_number?: string | null;
          subtotal?: number;
          discount_amount?: number;
          tax_amount?: number;
          total_amount?: number;
          notes?: string | null;
          internal_notes?: string | null;
          received_by?: string | null;
          validated_by?: string | null;
          validated_at?: Datetime | null;
          cancelled_by?: string | null;
          cancelled_at?: Datetime | null;
          cancellation_reason?: string | null;
          created_by?: string | null;
          updated_by?: string | null;
          created_at?: Datetime;
          updated_at?: Datetime;
        };
        Update: Partial<
          Database["public"]["Tables"]["goods_receipts"]["Insert"]
        >;
        Relationships: [];
      };
      goods_receipt_items: {
        Row: {
          id: string;
          goods_receipt_id: string;
          purchase_order_item_id: string;
          ingredient_id: string;
          description: string | null;
          supplier_sku: string | null;
          ordered_quantity: number;
          previously_received_quantity: number;
          received_quantity: number;
          accepted_quantity: number;
          rejected_quantity: number;
          purchase_unit_id: string | null;
          stock_unit_id: string | null;
          conversion_factor: number;
          unit_price: number;
          discount_amount: number;
          tax_rate: number;
          tax_amount: number;
          subtotal: number;
          total_amount: number;
          lot_number: string | null;
          batch_number: string | null;
          expiry_date: string | null;
          notes: string | null;
          sort_order: number;
          created_at: Datetime;
          updated_at: Datetime;
        };
        Insert: {
          id?: string;
          goods_receipt_id: string;
          purchase_order_item_id: string;
          ingredient_id: string;
          description?: string | null;
          supplier_sku?: string | null;
          ordered_quantity: number;
          previously_received_quantity?: number;
          received_quantity?: number;
          accepted_quantity?: number;
          rejected_quantity?: number;
          purchase_unit_id?: string | null;
          stock_unit_id?: string | null;
          conversion_factor?: number;
          unit_price?: number;
          discount_amount?: number;
          tax_rate?: number;
          tax_amount?: number;
          subtotal?: number;
          total_amount?: number;
          lot_number?: string | null;
          batch_number?: string | null;
          expiry_date?: string | null;
          notes?: string | null;
          sort_order?: number;
          created_at?: Datetime;
          updated_at?: Datetime;
        };
        Update: Partial<
          Database["public"]["Tables"]["goods_receipt_items"]["Insert"]
        >;
        Relationships: [];
      };
      goods_receipt_status_history: {
        Row: {
          id: string;
          establishment_id: string;
          goods_receipt_id: string;
          from_status: string | null;
          to_status: string;
          reason: string | null;
          changed_by: string | null;
          created_at: Datetime;
        };
        Insert: {
          id?: string;
          establishment_id: string;
          goods_receipt_id: string;
          from_status?: string | null;
          to_status: string;
          reason?: string | null;
          changed_by?: string | null;
          created_at?: Datetime;
        };
        Update: Partial<
          Database["public"]["Tables"]["goods_receipt_status_history"]["Insert"]
        >;
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          full_name: string | null;
          phone: string | null;
          avatar_url: string | null;
          preferred_locale: string;
          is_active: boolean;
          created_at: Datetime;
          updated_at: Datetime;
        };
        Insert: {
          id: string;
          full_name?: string | null;
          phone?: string | null;
          avatar_url?: string | null;
          preferred_locale?: string;
          is_active?: boolean;
          created_at?: Datetime;
          updated_at?: Datetime;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
        Relationships: [];
      };
      roles: {
        Row: {
          id: string;
          name: string;
          code: string;
          slug: string | null;
          description: string | null;
          is_system: boolean;
          is_active: boolean;
          level: number;
          establishment_id: string | null;
          created_at: Datetime;
          updated_at: Datetime;
        };
        Insert: {
          id?: string;
          name: string;
          code: string;
          slug?: string | null;
          description?: string | null;
          is_system?: boolean;
          is_active?: boolean;
          level?: number;
          establishment_id?: string | null;
          created_at?: Datetime;
          updated_at?: Datetime;
        };
        Update: Partial<Database["public"]["Tables"]["roles"]["Insert"]>;
        Relationships: [];
      };
      user_roles: {
        Row: {
          user_id: string;
          role_id: string;
          establishment_id: string;
          created_by: string | null;
          created_at: Datetime;
        };
        Insert: {
          user_id: string;
          role_id: string;
          establishment_id: string;
          created_by?: string | null;
          created_at?: Datetime;
        };
        Update: Partial<Database["public"]["Tables"]["user_roles"]["Insert"]>;
        Relationships: [];
      };
      permissions: {
        Row: {
          id: string;
          name: string;
          slug: string;
          module: string;
          description: string | null;
          created_at: Datetime;
          updated_at: Datetime;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          module: string;
          description?: string | null;
          created_at?: Datetime;
          updated_at?: Datetime;
        };
        Update: Partial<Database["public"]["Tables"]["permissions"]["Insert"]>;
        Relationships: [];
      };
      role_permissions: {
        Row: {
          id: string;
          role_id: string;
          permission_id: string;
          created_at: Datetime;
        };
        Insert: {
          id?: string;
          role_id: string;
          permission_id: string;
          created_at?: Datetime;
        };
        Update: Partial<
          Database["public"]["Tables"]["role_permissions"]["Insert"]
        >;
        Relationships: [];
      };
      dining_areas: {
        Row: {
          id: string;
          establishment_id: string;
          name: string;
          sort_order: number;
          is_active: boolean;
          created_at: Datetime;
          updated_at: Datetime;
        };
        Insert: {
          id?: string;
          establishment_id: string;
          name: string;
          sort_order?: number;
          is_active?: boolean;
          created_at?: Datetime;
          updated_at?: Datetime;
        };
        Update: Partial<Database["public"]["Tables"]["dining_areas"]["Insert"]>;
        Relationships: [];
      };
      tables: {
        Row: {
          id: string;
          establishment_id: string;
          area_id: string | null;
          name: string;
          code: string | null;
          capacity: number;
          position_x: number | null;
          position_y: number | null;
          status: TableStatus;
          is_active: boolean;
          created_at: Datetime;
          updated_at: Datetime;
        };
        Insert: {
          id?: string;
          establishment_id: string;
          area_id?: string | null;
          name: string;
          code?: string | null;
          capacity?: number;
          position_x?: number | null;
          position_y?: number | null;
          status?: TableStatus;
          is_active?: boolean;
          created_at?: Datetime;
          updated_at?: Datetime;
        };
        Update: Partial<Database["public"]["Tables"]["tables"]["Insert"]>;
        Relationships: [];
      };
      customers: {
        Row: {
          id: string;
          establishment_id: string;
          first_name: string;
          last_name: string | null;
          phone: string | null;
          email: string | null;
          address: string | null;
          notes: string | null;
          loyalty_points: number;
          is_active: boolean;
          created_at: Datetime;
          updated_at: Datetime;
        };
        Insert: {
          id?: string;
          establishment_id: string;
          first_name: string;
          last_name?: string | null;
          phone?: string | null;
          email?: string | null;
          address?: string | null;
          notes?: string | null;
          loyalty_points?: number;
          is_active?: boolean;
          created_at?: Datetime;
          updated_at?: Datetime;
        };
        Update: Partial<Database["public"]["Tables"]["customers"]["Insert"]>;
        Relationships: [];
      };
      orders: {
        Row: {
          id: string;
          establishment_id: string;
          order_number: string;
          customer_id: string | null;
          table_id: string | null;
          user_id: string | null;
          status: OrderStatus;
          order_type: OrderType;
          subtotal: number;
          discount_amount: number;
          tax_amount: number;
          total: number;
          notes: string | null;
          created_at: Datetime;
          updated_at: Datetime;
        };
        Insert: {
          id?: string;
          establishment_id: string;
          order_number: string;
          customer_id?: string | null;
          table_id?: string | null;
          user_id?: string | null;
          status?: OrderStatus;
          order_type?: OrderType;
          subtotal?: number;
          discount_amount?: number;
          tax_amount?: number;
          total?: number;
          notes?: string | null;
          created_at?: Datetime;
          updated_at?: Datetime;
        };
        Update: Partial<Database["public"]["Tables"]["orders"]["Insert"]>;
        Relationships: [];
      };
      order_items: {
        Row: {
          id: string;
          order_id: string;
          product_id: string | null;
          quantity: number;
          unit_price: number;
          discount_amount: number;
          tax_amount: number;
          total: number;
          notes: string | null;
          created_at: Datetime;
          updated_at: Datetime;
        };
        Insert: {
          id?: string;
          order_id: string;
          product_id?: string | null;
          quantity?: number;
          unit_price?: number;
          discount_amount?: number;
          tax_amount?: number;
          total?: number;
          notes?: string | null;
          created_at?: Datetime;
          updated_at?: Datetime;
        };
        Update: Partial<Database["public"]["Tables"]["order_items"]["Insert"]>;
        Relationships: [];
      };
      payment_methods: {
        Row: {
          id: string;
          establishment_id: string;
          name: string;
          code: string;
          type: PaymentMethodType;
          is_active: boolean;
          created_at: Datetime;
          updated_at: Datetime;
        };
        Insert: {
          id?: string;
          establishment_id: string;
          name: string;
          code: string;
          type?: PaymentMethodType;
          is_active?: boolean;
          created_at?: Datetime;
          updated_at?: Datetime;
        };
        Update: Partial<
          Database["public"]["Tables"]["payment_methods"]["Insert"]
        >;
        Relationships: [];
      };
      payments: {
        Row: {
          id: string;
          order_id: string;
          payment_method_id: string | null;
          amount: number;
          reference: string | null;
          status: PaymentStatus;
          paid_at: Datetime | null;
          created_by: string | null;
          created_at: Datetime;
          updated_at: Datetime;
        };
        Insert: {
          id?: string;
          order_id: string;
          payment_method_id?: string | null;
          amount: number;
          reference?: string | null;
          status?: PaymentStatus;
          paid_at?: Datetime | null;
          created_by?: string | null;
          created_at?: Datetime;
          updated_at?: Datetime;
        };
        Update: Partial<Database["public"]["Tables"]["payments"]["Insert"]>;
        Relationships: [];
      };
      cash_registers: {
        Row: {
          id: string;
          establishment_id: string;
          name: string;
          code: string;
          is_active: boolean;
          created_at: Datetime;
          updated_at: Datetime;
        };
        Insert: {
          id?: string;
          establishment_id: string;
          name: string;
          code: string;
          is_active?: boolean;
          created_at?: Datetime;
          updated_at?: Datetime;
        };
        Update: Partial<
          Database["public"]["Tables"]["cash_registers"]["Insert"]
        >;
        Relationships: [];
      };
      cash_sessions: {
        Row: {
          id: string;
          cash_register_id: string;
          user_id: string | null;
          opened_at: Datetime;
          opening_amount: number;
          closed_at: Datetime | null;
          closing_amount: number | null;
          expected_amount: number | null;
          difference: number | null;
          status: CashSessionStatus;
          created_at: Datetime;
          updated_at: Datetime;
        };
        Insert: {
          id?: string;
          cash_register_id: string;
          user_id?: string | null;
          opened_at?: Datetime;
          opening_amount?: number;
          closed_at?: Datetime | null;
          closing_amount?: number | null;
          expected_amount?: number | null;
          difference?: number | null;
          status?: CashSessionStatus;
          created_at?: Datetime;
          updated_at?: Datetime;
        };
        Update: Partial<
          Database["public"]["Tables"]["cash_sessions"]["Insert"]
        >;
        Relationships: [];
      };
      expenses: {
        Row: {
          id: string;
          establishment_id: string;
          category: string | null;
          description: string;
          amount: number;
          tax_amount: number;
          expense_date: Datetime;
          payment_method_id: string | null;
          supplier_id: string | null;
          notes: string | null;
          created_by: string | null;
          created_at: Datetime;
          updated_at: Datetime;
        };
        Insert: {
          id?: string;
          establishment_id: string;
          category?: string | null;
          description: string;
          amount?: number;
          tax_amount?: number;
          expense_date?: Datetime;
          payment_method_id?: string | null;
          supplier_id?: string | null;
          notes?: string | null;
          created_by?: string | null;
          created_at?: Datetime;
          updated_at?: Datetime;
        };
        Update: Partial<Database["public"]["Tables"]["expenses"]["Insert"]>;
        Relationships: [];
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          establishment_id: string | null;
          type: string;
          title: string;
          message: string | null;
          data: Json | null;
          read_at: Datetime | null;
          created_at: Datetime;
        };
        Insert: {
          id?: string;
          user_id: string;
          establishment_id?: string | null;
          type?: string;
          title: string;
          message?: string | null;
          data?: Json | null;
          read_at?: Datetime | null;
          created_at?: Datetime;
        };
        Update: Partial<
          Database["public"]["Tables"]["notifications"]["Insert"]
        >;
        Relationships: [];
      };
      audit_logs: {
        Row: {
          id: string;
          establishment_id: string | null;
          user_id: string | null;
          action: string;
          entity_type: string | null;
          entity_id: string | null;
          old_values: Json | null;
          new_values: Json | null;
          ip_address: string | null;
          user_agent: string | null;
          created_at: Datetime;
        };
        Insert: {
          id?: string;
          establishment_id?: string | null;
          user_id?: string | null;
          action: string;
          entity_type?: string | null;
          entity_id?: string | null;
          old_values?: Json | null;
          new_values?: Json | null;
          ip_address?: string | null;
          user_agent?: string | null;
          created_at?: Datetime;
        };
        Update: Partial<Database["public"]["Tables"]["audit_logs"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      is_establishment_member: {
        Args: { est_id: string };
        Returns: boolean;
      };
      has_role: {
        Args: { est_id: string; role_code: string };
        Returns: boolean;
      };
      is_super_admin: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      belongs_to_establishment: {
        Args: { est_id: string };
        Returns: boolean;
      };
      get_setting: {
        Args: { p_key: string };
        Returns: string | null;
      };
      get_establishment_settings: {
        Args: { p_establishment_id: string };
        Returns: Json;
      };
      has_permission: {
        Args: { p_est_id: string; p_slug: string };
        Returns: boolean;
      };
      has_permission_anywhere: {
        Args: { p_slug: string };
        Returns: boolean;
      };
      user_has_permission: {
        Args: { p_user_id: string; p_est_id: string; p_slug: string };
        Returns: boolean;
      };
      user_has_permission_anywhere: {
        Args: { p_user_id: string; p_slug: string };
        Returns: boolean;
      };
      user_get_permissions: {
        Args: { p_user_id: string; p_est_id: string };
        Returns: string[];
      };
      user_get_role_codes: {
        Args: { p_user_id: string; p_est_id: string };
        Returns: string[];
      };
      user_get_max_level: {
        Args: { p_user_id: string; p_est_id: string };
        Returns: number;
      };
      user_count_active_admins: {
        Args: { p_est_id: string; p_exclude_user_id: string };
        Returns: number;
      };
      user_is_establishment_member: {
        Args: { p_user_id: string; p_est_id: string };
        Returns: boolean;
      };
      user_is_profile_active: {
        Args: { p_user_id: string };
        Returns: boolean;
      };
      user_is_super_admin_by_id: {
        Args: { p_user_id: string };
        Returns: boolean;
      };
      current_profile_is_active: {
        Args: Record<string, never>;
        Returns: boolean;
      };
    };
  };
}

export type SettingType =
  | "string"
  | "integer"
  | "decimal"
  | "boolean"
  | "json"
  | "color"
  | "url"
  | "text";

export type SettingGroup =
  | "general"
  | "branding"
  | "localization"
  | "currency"
  | "tax"
  | "pos"
  | "inventory"
  | "purchasing"
  | "recipes"
  | "printing"
  | "notifications"
  | "security"
  | "customers"
  | "kitchen"
  | "system";

export type UnitCategory =
  "weight" | "volume" | "quantity" | "length" | "packaging" | "portion";

export type UnitType =
  | "mass"
  | "volume"
  | "count"
  | "service"
  | "custom";

export type ProductType = "product" | "composite" | "service";
export type IngredientType =
  | "raw_material"
  | "semi_finished"
  | "packaged"
  | "consumable"
  | "other";
export type YieldType = "exact_consumption" | "batch_yield" | "range_yield";
export type RecipeStatus = "draft" | "active" | "inactive" | "archived";

export type PurchaseOrderStatus =
  | "draft"
  | "pending_approval"
  | "approved"
  | "sent"
  | "partially_received"
  | "fully_received"
  | "cancelled"
  | "closed";

export type InventoryLocationType = "storage" | "bar" | "kitchen" | "reserve";

export type StockMovementType =
  | "purchase"
  | "sale_consumption"
  | "transfer_in"
  | "transfer_out"
  | "adjustment_in"
  | "adjustment_out"
  | "waste"
  | "return"
  | "opening";

export type StockMovementDirection = "in" | "out";

export type GoodsReceiptStatus =
  | "draft"
  | "pending_validation"
  | "validated"
  | "cancelled";

export type TableStatus =
  "available" | "occupied" | "reserved" | "cleaning" | "blocked";

export type OrderStatus =
  | "draft"
  | "pending"
  | "confirmed"
  | "preparing"
  | "ready"
  | "served"
  | "completed"
  | "cancelled";

export type OrderType = "dine_in" | "takeaway" | "delivery";

export type PaymentMethodType = "cash" | "card" | "bank_transfer" | "other";
export type PaymentStatus = "pending" | "completed" | "failed" | "refunded";
export type CashSessionStatus = "open" | "closed" | "reconciled";
