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
  public: {
    Tables: {
      addresses: {
        Row: {
          city: string | null
          country: string | null
          created_at: string
          id: string
          is_default: boolean | null
          label: string | null
          line1: string
          line2: string | null
          phone: string | null
          postal: string | null
          recipient: string
          region: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          city?: string | null
          country?: string | null
          created_at?: string
          id?: string
          is_default?: boolean | null
          label?: string | null
          line1: string
          line2?: string | null
          phone?: string | null
          postal?: string | null
          recipient: string
          region?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          city?: string | null
          country?: string | null
          created_at?: string
          id?: string
          is_default?: boolean | null
          label?: string | null
          line1?: string
          line2?: string | null
          phone?: string | null
          postal?: string | null
          recipient?: string
          region?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      cart_items: {
        Row: {
          created_at: string
          id: string
          product_id: string
          qty: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          qty?: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          qty?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cart_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string
          icon: string | null
          id: string
          name: string
          slug: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          icon?: string | null
          id?: string
          name: string
          slug: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          icon?: string | null
          id?: string
          name?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      conversations: {
        Row: {
          buyer_id: string
          created_at: string
          id: string
          last_message: string | null
          last_message_at: string | null
          supplier_id: string
        }
        Insert: {
          buyer_id: string
          created_at?: string
          id?: string
          last_message?: string | null
          last_message_at?: string | null
          supplier_id: string
        }
        Update: {
          buyer_id?: string
          created_at?: string
          id?: string
          last_message?: string | null
          last_message_at?: string | null
          supplier_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      coupon_redemptions: {
        Row: {
          amount: number
          buyer_id: string
          coupon_id: string
          created_at: string
          id: string
          order_id: string
        }
        Insert: {
          amount: number
          buyer_id: string
          coupon_id: string
          created_at?: string
          id?: string
          order_id: string
        }
        Update: {
          amount?: number
          buyer_id?: string
          coupon_id?: string
          created_at?: string
          id?: string
          order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "coupon_redemptions_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
        ]
      }
      coupons: {
        Row: {
          active: boolean
          code: string
          created_at: string
          discount_type: string
          discount_value: number
          expires_at: string | null
          id: string
          max_uses: number | null
          min_subtotal: number
          supplier_id: string
          updated_at: string
          uses_count: number
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          discount_type: string
          discount_value: number
          expires_at?: string | null
          id?: string
          max_uses?: number | null
          min_subtotal?: number
          supplier_id: string
          updated_at?: string
          uses_count?: number
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          discount_type?: string
          discount_value?: number
          expires_at?: string | null
          id?: string
          max_uses?: number | null
          min_subtotal?: number
          supplier_id?: string
          updated_at?: string
          uses_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "coupons_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      followers: {
        Row: {
          created_at: string
          id: string
          supplier_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          supplier_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          supplier_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "followers_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      live_messages: {
        Row: {
          body: string
          created_at: string
          id: string
          stream_id: string
          user_id: string
          username: string | null
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          stream_id: string
          user_id: string
          username?: string | null
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          stream_id?: string
          user_id?: string
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "live_messages_stream_id_fkey"
            columns: ["stream_id"]
            isOneToOne: false
            referencedRelation: "live_streams"
            referencedColumns: ["id"]
          },
        ]
      }
      live_reactions: {
        Row: {
          created_at: string
          id: string
          kind: string
          stream_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind?: string
          stream_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          stream_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_reactions_stream_id_fkey"
            columns: ["stream_id"]
            isOneToOne: false
            referencedRelation: "live_streams"
            referencedColumns: ["id"]
          },
        ]
      }
      live_streams: {
        Row: {
          cover: string | null
          ended_at: string | null
          id: string
          pinned_product_id: string | null
          started_at: string
          status: Database["public"]["Enums"]["live_status"]
          supplier_id: string
          title: string
          viewer_count: number
        }
        Insert: {
          cover?: string | null
          ended_at?: string | null
          id?: string
          pinned_product_id?: string | null
          started_at?: string
          status?: Database["public"]["Enums"]["live_status"]
          supplier_id: string
          title: string
          viewer_count?: number
        }
        Update: {
          cover?: string | null
          ended_at?: string | null
          id?: string
          pinned_product_id?: string | null
          started_at?: string
          status?: Database["public"]["Enums"]["live_status"]
          supplier_id?: string
          title?: string
          viewer_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "live_streams_pinned_product_id_fkey"
            columns: ["pinned_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_streams_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          body: string
          conversation_id: string
          created_at: string
          id: string
          sender_id: string
        }
        Insert: {
          body: string
          conversation_id: string
          created_at?: string
          id?: string
          sender_id: string
        }
        Update: {
          body?: string
          conversation_id?: string
          created_at?: string
          id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          created_at: string
          email_new_product_followed: boolean
          email_onboarding: boolean
          email_orders: boolean
          email_rfq: boolean
          email_weekly_digest: boolean
          email_welcome: boolean
          id: string
          inapp_followed_supplier_live: boolean
          inapp_followed_supplier_new_product: boolean
          inapp_messages: boolean
          inapp_orders: boolean
          inapp_rfq: boolean
          inapp_wishlist_price_drop: boolean
          inapp_wishlist_restock: boolean
          push_followed_supplier_live: boolean
          push_followed_supplier_new_product: boolean
          push_messages: boolean
          push_orders: boolean
          push_rfq: boolean
          push_wishlist_price_drop: boolean
          push_wishlist_restock: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email_new_product_followed?: boolean
          email_onboarding?: boolean
          email_orders?: boolean
          email_rfq?: boolean
          email_weekly_digest?: boolean
          email_welcome?: boolean
          id?: string
          inapp_followed_supplier_live?: boolean
          inapp_followed_supplier_new_product?: boolean
          inapp_messages?: boolean
          inapp_orders?: boolean
          inapp_rfq?: boolean
          inapp_wishlist_price_drop?: boolean
          inapp_wishlist_restock?: boolean
          push_followed_supplier_live?: boolean
          push_followed_supplier_new_product?: boolean
          push_messages?: boolean
          push_orders?: boolean
          push_rfq?: boolean
          push_wishlist_price_drop?: boolean
          push_wishlist_restock?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email_new_product_followed?: boolean
          email_onboarding?: boolean
          email_orders?: boolean
          email_rfq?: boolean
          email_weekly_digest?: boolean
          email_welcome?: boolean
          id?: string
          inapp_followed_supplier_live?: boolean
          inapp_followed_supplier_new_product?: boolean
          inapp_messages?: boolean
          inapp_orders?: boolean
          inapp_rfq?: boolean
          inapp_wishlist_price_drop?: boolean
          inapp_wishlist_restock?: boolean
          push_followed_supplier_live?: boolean
          push_followed_supplier_new_product?: boolean
          push_messages?: boolean
          push_orders?: boolean
          push_rfq?: boolean
          push_wishlist_price_drop?: boolean
          push_wishlist_restock?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          link: string | null
          read: boolean
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read?: boolean
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read?: boolean
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      order_items: {
        Row: {
          id: string
          image: string | null
          order_id: string
          product_id: string
          qty: number
          title: string | null
          unit_price: number
        }
        Insert: {
          id?: string
          image?: string | null
          order_id: string
          product_id: string
          qty: number
          title?: string | null
          unit_price: number
        }
        Update: {
          id?: string
          image?: string | null
          order_id?: string
          product_id?: string
          qty?: number
          title?: string | null
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          address_id: string | null
          buyer_id: string
          coupon_code: string | null
          created_at: string
          discount: number
          eta: string | null
          id: string
          ref_code: string | null
          ship_to: string | null
          shipping: number
          status: Database["public"]["Enums"]["order_status"]
          subtotal: number
          supplier_id: string
          total: number
          tracking: string | null
          updated_at: string
        }
        Insert: {
          address_id?: string | null
          buyer_id: string
          coupon_code?: string | null
          created_at?: string
          discount?: number
          eta?: string | null
          id?: string
          ref_code?: string | null
          ship_to?: string | null
          shipping?: number
          status?: Database["public"]["Enums"]["order_status"]
          subtotal?: number
          supplier_id: string
          total?: number
          tracking?: string | null
          updated_at?: string
        }
        Update: {
          address_id?: string | null
          buyer_id?: string
          coupon_code?: string | null
          created_at?: string
          discount?: number
          eta?: string | null
          id?: string
          ref_code?: string | null
          ship_to?: string | null
          shipping?: number
          status?: Database["public"]["Enums"]["order_status"]
          subtotal?: number
          supplier_id?: string
          total?: number
          tracking?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_methods: {
        Row: {
          brand: string
          created_at: string
          exp_month: number | null
          exp_year: number | null
          holder: string | null
          id: string
          is_default: boolean | null
          last4: string
          user_id: string
        }
        Insert: {
          brand: string
          created_at?: string
          exp_month?: number | null
          exp_year?: number | null
          holder?: string | null
          id?: string
          is_default?: boolean | null
          last4: string
          user_id: string
        }
        Update: {
          brand?: string
          created_at?: string
          exp_month?: number | null
          exp_year?: number | null
          holder?: string | null
          id?: string
          is_default?: boolean | null
          last4?: string
          user_id?: string
        }
        Relationships: []
      }
      product_tier_prices: {
        Row: {
          id: string
          min_qty: number
          price: number
          product_id: string
        }
        Insert: {
          id?: string
          min_qty: number
          price: number
          product_id: string
        }
        Update: {
          id?: string
          min_qty?: number
          price?: number
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_tier_prices_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_variants: {
        Row: {
          group_name: string
          id: string
          image: string | null
          option_name: string
          product_id: string
          sort_order: number | null
        }
        Insert: {
          group_name: string
          id?: string
          image?: string | null
          option_name: string
          product_id: string
          sort_order?: number | null
        }
        Update: {
          group_name?: string
          id?: string
          image?: string | null
          option_name?: string
          product_id?: string
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          active: boolean | null
          badge: string | null
          category_slug: string | null
          created_at: string
          deal_ends_at: string | null
          description: string | null
          free_shipping: boolean | null
          gallery: string[] | null
          has_reel: boolean | null
          id: string
          image: string | null
          lead_time: string | null
          moq: number | null
          original_price: number | null
          price: number
          rating: number | null
          reel_url: string | null
          review_count: number | null
          ship_from: string | null
          sold: number | null
          specs: Json | null
          supplier_id: string
          title: string
          unit: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean | null
          badge?: string | null
          category_slug?: string | null
          created_at?: string
          deal_ends_at?: string | null
          description?: string | null
          free_shipping?: boolean | null
          gallery?: string[] | null
          has_reel?: boolean | null
          id?: string
          image?: string | null
          lead_time?: string | null
          moq?: number | null
          original_price?: number | null
          price?: number
          rating?: number | null
          reel_url?: string | null
          review_count?: number | null
          ship_from?: string | null
          sold?: number | null
          specs?: Json | null
          supplier_id: string
          title: string
          unit?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean | null
          badge?: string | null
          category_slug?: string | null
          created_at?: string
          deal_ends_at?: string | null
          description?: string | null
          free_shipping?: boolean | null
          gallery?: string[] | null
          has_reel?: boolean | null
          id?: string
          image?: string | null
          lead_time?: string | null
          moq?: number | null
          original_price?: number | null
          price?: number
          rating?: number | null
          reel_url?: string | null
          review_count?: number | null
          ship_from?: string | null
          sold?: number | null
          specs?: Json | null
          supplier_id?: string
          title?: string
          unit?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          address: string | null
          avatar_url: string | null
          contact: string | null
          created_at: string
          display_name: string | null
          id: string
          interests: string[]
          phone: string | null
          profile_completed: boolean
          updated_at: string
          user_id: string
          username: string | null
        }
        Insert: {
          address?: string | null
          avatar_url?: string | null
          contact?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          interests?: string[]
          phone?: string | null
          profile_completed?: boolean
          updated_at?: string
          user_id: string
          username?: string | null
        }
        Update: {
          address?: string | null
          avatar_url?: string | null
          contact?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          interests?: string[]
          phone?: string | null
          profile_completed?: boolean
          updated_at?: string
          user_id?: string
          username?: string | null
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          last_used_at: string
          p256dh: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          last_used_at?: string
          p256dh: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          last_used_at?: string
          p256dh?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      quotes: {
        Row: {
          created_at: string
          id: string
          lead_time: string | null
          moq: number | null
          notes: string | null
          price_per_unit: number
          rfq_id: string
          supplier_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          lead_time?: string | null
          moq?: number | null
          notes?: string | null
          price_per_unit: number
          rfq_id: string
          supplier_id: string
        }
        Update: {
          created_at?: string
          id?: string
          lead_time?: string | null
          moq?: number | null
          notes?: string | null
          price_per_unit?: number
          rfq_id?: string
          supplier_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quotes_rfq_id_fkey"
            columns: ["rfq_id"]
            isOneToOne: false
            referencedRelation: "rfqs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          country: string | null
          created_at: string
          id: string
          product_id: string
          rating: number
          text: string | null
          user_id: string
          variant: string | null
        }
        Insert: {
          country?: string | null
          created_at?: string
          id?: string
          product_id: string
          rating: number
          text?: string | null
          user_id: string
          variant?: string | null
        }
        Update: {
          country?: string | null
          created_at?: string
          id?: string
          product_id?: string
          rating?: number
          text?: string | null
          user_id?: string
          variant?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reviews_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      rfqs: {
        Row: {
          buyer_id: string
          category: string | null
          created_at: string
          details: string | null
          id: string
          qty: number
          ship_to: string | null
          status: Database["public"]["Enums"]["rfq_status"]
          target_price: number | null
          title: string
          unit: string | null
          updated_at: string
        }
        Insert: {
          buyer_id: string
          category?: string | null
          created_at?: string
          details?: string | null
          id?: string
          qty?: number
          ship_to?: string | null
          status?: Database["public"]["Enums"]["rfq_status"]
          target_price?: number | null
          title: string
          unit?: string | null
          updated_at?: string
        }
        Update: {
          buyer_id?: string
          category?: string | null
          created_at?: string
          details?: string | null
          id?: string
          qty?: number
          ship_to?: string | null
          status?: Database["public"]["Enums"]["rfq_status"]
          target_price?: number | null
          title?: string
          unit?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      suppliers: {
        Row: {
          about: string | null
          banner: string | null
          country: string | null
          country_code: string | null
          created_at: string
          gold: boolean | null
          id: string
          latitude: number | null
          location_address: string | null
          logo: string | null
          longitude: number | null
          mirror_of: string | null
          name: string
          on_time_delivery: number | null
          owner_id: string
          rating: number | null
          response_rate: number | null
          response_time: string | null
          slug: string | null
          trade_assurance: boolean | null
          updated_at: string
          verified: boolean | null
          years_active: number | null
        }
        Insert: {
          about?: string | null
          banner?: string | null
          country?: string | null
          country_code?: string | null
          created_at?: string
          gold?: boolean | null
          id?: string
          latitude?: number | null
          location_address?: string | null
          logo?: string | null
          longitude?: number | null
          mirror_of?: string | null
          name: string
          on_time_delivery?: number | null
          owner_id: string
          rating?: number | null
          response_rate?: number | null
          response_time?: string | null
          slug?: string | null
          trade_assurance?: boolean | null
          updated_at?: string
          verified?: boolean | null
          years_active?: number | null
        }
        Update: {
          about?: string | null
          banner?: string | null
          country?: string | null
          country_code?: string | null
          created_at?: string
          gold?: boolean | null
          id?: string
          latitude?: number | null
          location_address?: string | null
          logo?: string | null
          longitude?: number | null
          mirror_of?: string | null
          name?: string
          on_time_delivery?: number | null
          owner_id?: string
          rating?: number | null
          response_rate?: number | null
          response_time?: string | null
          slug?: string | null
          trade_assurance?: boolean | null
          updated_at?: string
          verified?: boolean | null
          years_active?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_mirror_of_fkey"
            columns: ["mirror_of"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      weekly_digest_log: {
        Row: {
          id: string
          product_count: number
          sent_at: string
          user_id: string
          week_start: string
        }
        Insert: {
          id?: string
          product_count?: number
          sent_at?: string
          user_id: string
          week_start: string
        }
        Update: {
          id?: string
          product_count?: number
          sent_at?: string
          user_id?: string
          week_start?: string
        }
        Relationships: []
      }
      wishlist_items: {
        Row: {
          created_at: string
          id: string
          product_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wishlist_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      resolve_master_supplier: {
        Args: { _supplier_id: string }
        Returns: string
      }
    }
    Enums: {
      app_role: "supplier" | "buyer"
      live_status: "scheduled" | "live" | "ended"
      order_status:
        | "placed"
        | "processing"
        | "shipped"
        | "delivered"
        | "cancelled"
      rfq_status: "open" | "closed"
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
    Enums: {
      app_role: ["supplier", "buyer"],
      live_status: ["scheduled", "live", "ended"],
      order_status: [
        "placed",
        "processing",
        "shipped",
        "delivered",
        "cancelled",
      ],
      rfq_status: ["open", "closed"],
    },
  },
} as const
