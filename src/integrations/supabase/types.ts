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
      _push_test_state: {
        Row: {
          burst_started_at: string
          id: number
        }
        Insert: {
          burst_started_at?: string
          id?: number
        }
        Update: {
          burst_started_at?: string
          id?: number
        }
        Relationships: []
      }
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
      car_rental_bookings: {
        Row: {
          created_at: string
          cross_border: boolean
          cross_border_destination: string | null
          currency: string
          delivery_requested: boolean
          dropoff_location: string | null
          estimated_total: number | null
          expected_km: number | null
          id: string
          license_years: number | null
          notes: string | null
          pickup_at: string
          pickup_location: string | null
          rental_id: string
          renter_age: number | null
          renter_email: string | null
          renter_id: string
          renter_name: string | null
          renter_phone: string | null
          return_at: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          cross_border?: boolean
          cross_border_destination?: string | null
          currency?: string
          delivery_requested?: boolean
          dropoff_location?: string | null
          estimated_total?: number | null
          expected_km?: number | null
          id?: string
          license_years?: number | null
          notes?: string | null
          pickup_at: string
          pickup_location?: string | null
          rental_id: string
          renter_age?: number | null
          renter_email?: string | null
          renter_id: string
          renter_name?: string | null
          renter_phone?: string | null
          return_at: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          cross_border?: boolean
          cross_border_destination?: string | null
          currency?: string
          delivery_requested?: boolean
          dropoff_location?: string | null
          estimated_total?: number | null
          expected_km?: number | null
          id?: string
          license_years?: number | null
          notes?: string | null
          pickup_at?: string
          pickup_location?: string | null
          rental_id?: string
          renter_age?: number | null
          renter_email?: string | null
          renter_id?: string
          renter_name?: string | null
          renter_phone?: string | null
          return_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      car_rentals: {
        Row: {
          ac: boolean
          active: boolean
          address: string | null
          advance_booking_hours: number
          body_type: string | null
          cancellation_fee: number | null
          cancellation_policy: string
          city: string | null
          cleaning_fee: number | null
          contact_email: string | null
          contact_phone: string | null
          contact_whatsapp: string | null
          country: string | null
          cover: string | null
          created_at: string
          cross_border_allowed: boolean
          cross_border_countries: string[]
          cross_border_fee: number | null
          currency: string
          custom_penalties: Json
          custom_rules: string[]
          damage_excess: number | null
          delivery_available: boolean
          delivery_fee: number | null
          deposit: number
          description: string | null
          doors: number | null
          extra_km_fee: number | null
          featured: boolean
          features: string[]
          free_km_per_day: number
          fuel: string
          fuel_policy: string
          gallery: string[]
          id: string
          insurance_included: boolean
          insurance_options: Json
          insurance_provider: string | null
          international_license_ok: boolean
          lat: number | null
          late_return_fee_per_hour: number | null
          lng: number | null
          luggage: number | null
          make: string | null
          max_age: number | null
          max_rental_days: number | null
          min_age: number
          min_license_years: number
          min_rental_days: number
          model: string | null
          owner_user_id: string
          pet_penalty: number | null
          pets_allowed: boolean
          pickup_locations: string[]
          price_per_day: number
          price_per_month: number | null
          price_per_week: number | null
          rating: number
          required_documents: string[]
          seats: number
          smoking_allowed: boolean
          smoking_penalty: number | null
          supplier_id: string | null
          title: string
          transmission: string
          trips_completed: number
          unlimited_km: boolean
          updated_at: string
          vehicle_class: string
          verified: boolean
          views: number
          weekend_surcharge_pct: number | null
          year: number | null
          young_driver_age_threshold: number | null
          young_driver_fee: number | null
        }
        Insert: {
          ac?: boolean
          active?: boolean
          address?: string | null
          advance_booking_hours?: number
          body_type?: string | null
          cancellation_fee?: number | null
          cancellation_policy?: string
          city?: string | null
          cleaning_fee?: number | null
          contact_email?: string | null
          contact_phone?: string | null
          contact_whatsapp?: string | null
          country?: string | null
          cover?: string | null
          created_at?: string
          cross_border_allowed?: boolean
          cross_border_countries?: string[]
          cross_border_fee?: number | null
          currency?: string
          custom_penalties?: Json
          custom_rules?: string[]
          damage_excess?: number | null
          delivery_available?: boolean
          delivery_fee?: number | null
          deposit?: number
          description?: string | null
          doors?: number | null
          extra_km_fee?: number | null
          featured?: boolean
          features?: string[]
          free_km_per_day?: number
          fuel?: string
          fuel_policy?: string
          gallery?: string[]
          id?: string
          insurance_included?: boolean
          insurance_options?: Json
          insurance_provider?: string | null
          international_license_ok?: boolean
          lat?: number | null
          late_return_fee_per_hour?: number | null
          lng?: number | null
          luggage?: number | null
          make?: string | null
          max_age?: number | null
          max_rental_days?: number | null
          min_age?: number
          min_license_years?: number
          min_rental_days?: number
          model?: string | null
          owner_user_id: string
          pet_penalty?: number | null
          pets_allowed?: boolean
          pickup_locations?: string[]
          price_per_day: number
          price_per_month?: number | null
          price_per_week?: number | null
          rating?: number
          required_documents?: string[]
          seats?: number
          smoking_allowed?: boolean
          smoking_penalty?: number | null
          supplier_id?: string | null
          title: string
          transmission?: string
          trips_completed?: number
          unlimited_km?: boolean
          updated_at?: string
          vehicle_class?: string
          verified?: boolean
          views?: number
          weekend_surcharge_pct?: number | null
          year?: number | null
          young_driver_age_threshold?: number | null
          young_driver_fee?: number | null
        }
        Update: {
          ac?: boolean
          active?: boolean
          address?: string | null
          advance_booking_hours?: number
          body_type?: string | null
          cancellation_fee?: number | null
          cancellation_policy?: string
          city?: string | null
          cleaning_fee?: number | null
          contact_email?: string | null
          contact_phone?: string | null
          contact_whatsapp?: string | null
          country?: string | null
          cover?: string | null
          created_at?: string
          cross_border_allowed?: boolean
          cross_border_countries?: string[]
          cross_border_fee?: number | null
          currency?: string
          custom_penalties?: Json
          custom_rules?: string[]
          damage_excess?: number | null
          delivery_available?: boolean
          delivery_fee?: number | null
          deposit?: number
          description?: string | null
          doors?: number | null
          extra_km_fee?: number | null
          featured?: boolean
          features?: string[]
          free_km_per_day?: number
          fuel?: string
          fuel_policy?: string
          gallery?: string[]
          id?: string
          insurance_included?: boolean
          insurance_options?: Json
          insurance_provider?: string | null
          international_license_ok?: boolean
          lat?: number | null
          late_return_fee_per_hour?: number | null
          lng?: number | null
          luggage?: number | null
          make?: string | null
          max_age?: number | null
          max_rental_days?: number | null
          min_age?: number
          min_license_years?: number
          min_rental_days?: number
          model?: string | null
          owner_user_id?: string
          pet_penalty?: number | null
          pets_allowed?: boolean
          pickup_locations?: string[]
          price_per_day?: number
          price_per_month?: number | null
          price_per_week?: number | null
          rating?: number
          required_documents?: string[]
          seats?: number
          smoking_allowed?: boolean
          smoking_penalty?: number | null
          supplier_id?: string | null
          title?: string
          transmission?: string
          trips_completed?: number
          unlimited_km?: boolean
          updated_at?: string
          vehicle_class?: string
          verified?: boolean
          views?: number
          weekend_surcharge_pct?: number | null
          year?: number | null
          young_driver_age_threshold?: number | null
          young_driver_fee?: number | null
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
      driver_locations: {
        Row: {
          display_name: string | null
          heading: number
          lat: number
          lng: number
          online: boolean
          rating: number
          updated_at: string
          user_id: string
          vehicle_class: string
          vehicle_label: string | null
        }
        Insert: {
          display_name?: string | null
          heading?: number
          lat: number
          lng: number
          online?: boolean
          rating?: number
          updated_at?: string
          user_id: string
          vehicle_class?: string
          vehicle_label?: string | null
        }
        Update: {
          display_name?: string | null
          heading?: number
          lat?: number
          lng?: number
          online?: boolean
          rating?: number
          updated_at?: string
          user_id?: string
          vehicle_class?: string
          vehicle_label?: string | null
        }
        Relationships: []
      }
      driver_profiles: {
        Row: {
          active: boolean
          bio: string | null
          city: string | null
          country: string | null
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          license_photo: string | null
          phone: string | null
          plate_photo: string | null
          rating: number
          selfie_photo: string | null
          trips: number
          updated_at: string
          user_id: string
          vehicle_class: string
          vehicle_color: string | null
          vehicle_make: string | null
          vehicle_model: string | null
          vehicle_photo: string | null
          vehicle_plate: string
          vehicle_year: number | null
          whatsapp: string | null
        }
        Insert: {
          active?: boolean
          bio?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          license_photo?: string | null
          phone?: string | null
          plate_photo?: string | null
          rating?: number
          selfie_photo?: string | null
          trips?: number
          updated_at?: string
          user_id: string
          vehicle_class?: string
          vehicle_color?: string | null
          vehicle_make?: string | null
          vehicle_model?: string | null
          vehicle_photo?: string | null
          vehicle_plate: string
          vehicle_year?: number | null
          whatsapp?: string | null
        }
        Update: {
          active?: boolean
          bio?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          license_photo?: string | null
          phone?: string | null
          plate_photo?: string | null
          rating?: number
          selfie_photo?: string | null
          trips?: number
          updated_at?: string
          user_id?: string
          vehicle_class?: string
          vehicle_color?: string | null
          vehicle_make?: string | null
          vehicle_model?: string | null
          vehicle_photo?: string | null
          vehicle_plate?: string
          vehicle_year?: number | null
          whatsapp?: string | null
        }
        Relationships: []
      }
      finance_applications: {
        Row: {
          amount_requested: number | null
          applicant_email: string | null
          applicant_id: string
          applicant_name: string | null
          applicant_phone: string | null
          created_at: string
          employment_status: string | null
          id: string
          monthly_income: number | null
          notes: string | null
          product_id: string
          purpose: string | null
          status: string
          term_months: number | null
          updated_at: string
        }
        Insert: {
          amount_requested?: number | null
          applicant_email?: string | null
          applicant_id: string
          applicant_name?: string | null
          applicant_phone?: string | null
          created_at?: string
          employment_status?: string | null
          id?: string
          monthly_income?: number | null
          notes?: string | null
          product_id: string
          purpose?: string | null
          status?: string
          term_months?: number | null
          updated_at?: string
        }
        Update: {
          amount_requested?: number | null
          applicant_email?: string | null
          applicant_id?: string
          applicant_name?: string | null
          applicant_phone?: string | null
          created_at?: string
          employment_status?: string | null
          id?: string
          monthly_income?: number | null
          notes?: string | null
          product_id?: string
          purpose?: string | null
          status?: string
          term_months?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      finance_products: {
        Row: {
          active: boolean
          city: string | null
          contact_phone: string | null
          contact_whatsapp: string | null
          country: string | null
          cover: string | null
          created_at: string
          currency: string
          description: string | null
          featured: boolean
          features: string[]
          gallery: string[]
          id: string
          interest_rate: number | null
          kind: string
          max_amount: number | null
          min_amount: number | null
          owner_user_id: string
          provider_name: string | null
          requirements: string[]
          supplier_id: string | null
          term_months: number | null
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          city?: string | null
          contact_phone?: string | null
          contact_whatsapp?: string | null
          country?: string | null
          cover?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          featured?: boolean
          features?: string[]
          gallery?: string[]
          id?: string
          interest_rate?: number | null
          kind: string
          max_amount?: number | null
          min_amount?: number | null
          owner_user_id: string
          provider_name?: string | null
          requirements?: string[]
          supplier_id?: string | null
          term_months?: number | null
          title: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          city?: string | null
          contact_phone?: string | null
          contact_whatsapp?: string | null
          country?: string | null
          cover?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          featured?: boolean
          features?: string[]
          gallery?: string[]
          id?: string
          interest_rate?: number | null
          kind?: string
          max_amount?: number | null
          min_amount?: number | null
          owner_user_id?: string
          provider_name?: string | null
          requirements?: string[]
          supplier_id?: string | null
          term_months?: number | null
          title?: string
          updated_at?: string
        }
        Relationships: []
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
      industrial_listings: {
        Row: {
          active: boolean
          capacity: string | null
          category: string
          certifications: string[]
          country: string | null
          cover: string | null
          created_at: string
          currency: string
          description: string | null
          gallery: string[]
          id: string
          lead_time: string | null
          moq: number | null
          price: number | null
          ship_from: string | null
          slug: string | null
          spec: Json
          subcategory: string | null
          supplier_id: string | null
          title: string
          unit: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          capacity?: string | null
          category?: string
          certifications?: string[]
          country?: string | null
          cover?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          gallery?: string[]
          id?: string
          lead_time?: string | null
          moq?: number | null
          price?: number | null
          ship_from?: string | null
          slug?: string | null
          spec?: Json
          subcategory?: string | null
          supplier_id?: string | null
          title: string
          unit?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          capacity?: string | null
          category?: string
          certifications?: string[]
          country?: string | null
          cover?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          gallery?: string[]
          id?: string
          lead_time?: string | null
          moq?: number | null
          price?: number | null
          ship_from?: string | null
          slug?: string | null
          spec?: Json
          subcategory?: string | null
          supplier_id?: string | null
          title?: string
          unit?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "industrial_listings_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      inspection_reports: {
        Row: {
          cover_url: string | null
          created_at: string
          document_url: string | null
          id: string
          inspector: string | null
          report_date: string | null
          summary: string | null
          supplier_id: string
          title: string
          updated_at: string
          verified: boolean
        }
        Insert: {
          cover_url?: string | null
          created_at?: string
          document_url?: string | null
          id?: string
          inspector?: string | null
          report_date?: string | null
          summary?: string | null
          supplier_id: string
          title: string
          updated_at?: string
          verified?: boolean
        }
        Update: {
          cover_url?: string | null
          created_at?: string
          document_url?: string | null
          id?: string
          inspector?: string | null
          report_date?: string | null
          summary?: string | null
          supplier_id?: string
          title?: string
          updated_at?: string
          verified?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "inspection_reports_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      job_applications: {
        Row: {
          applicant_email: string | null
          applicant_id: string
          applicant_name: string | null
          applicant_phone: string | null
          cover_letter: string | null
          created_at: string
          cv_link: string | null
          cv_url: string | null
          employer_notes: string | null
          expected_salary: number | null
          id: string
          job_id: string
          status: string
          updated_at: string
        }
        Insert: {
          applicant_email?: string | null
          applicant_id: string
          applicant_name?: string | null
          applicant_phone?: string | null
          cover_letter?: string | null
          created_at?: string
          cv_link?: string | null
          cv_url?: string | null
          employer_notes?: string | null
          expected_salary?: number | null
          id?: string
          job_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          applicant_email?: string | null
          applicant_id?: string
          applicant_name?: string | null
          applicant_phone?: string | null
          cover_letter?: string | null
          created_at?: string
          cv_link?: string | null
          cv_url?: string | null
          employer_notes?: string | null
          expected_salary?: number | null
          id?: string
          job_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_applications_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "job_postings"
            referencedColumns: ["id"]
          },
        ]
      }
      job_companies: {
        Row: {
          about: string | null
          active: boolean
          city: string | null
          country: string | null
          cover_url: string | null
          created_at: string
          email: string | null
          followers_count: number
          id: string
          industry: string | null
          logo_url: string | null
          name: string
          owner_user_id: string
          phone: string | null
          size: string | null
          supplier_id: string | null
          tagline: string | null
          updated_at: string
          verified: boolean
          website: string | null
          whatsapp: string | null
        }
        Insert: {
          about?: string | null
          active?: boolean
          city?: string | null
          country?: string | null
          cover_url?: string | null
          created_at?: string
          email?: string | null
          followers_count?: number
          id?: string
          industry?: string | null
          logo_url?: string | null
          name: string
          owner_user_id: string
          phone?: string | null
          size?: string | null
          supplier_id?: string | null
          tagline?: string | null
          updated_at?: string
          verified?: boolean
          website?: string | null
          whatsapp?: string | null
        }
        Update: {
          about?: string | null
          active?: boolean
          city?: string | null
          country?: string | null
          cover_url?: string | null
          created_at?: string
          email?: string | null
          followers_count?: number
          id?: string
          industry?: string | null
          logo_url?: string | null
          name?: string
          owner_user_id?: string
          phone?: string | null
          size?: string | null
          supplier_id?: string | null
          tagline?: string | null
          updated_at?: string
          verified?: boolean
          website?: string | null
          whatsapp?: string | null
        }
        Relationships: []
      }
      job_connections: {
        Row: {
          created_at: string
          id: string
          message: string | null
          recipient_id: string
          requester_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          message?: string | null
          recipient_id: string
          requester_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string | null
          recipient_id?: string
          requester_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      job_post_comments: {
        Row: {
          body: string
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_post_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "job_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      job_post_likes: {
        Row: {
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_post_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "job_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      job_postings: {
        Row: {
          applicants_count: number
          apply_email: string | null
          apply_mode: string
          apply_url: string | null
          benefits: string[]
          category: string
          city: string | null
          company_id: string
          country: string | null
          created_at: string
          description: string | null
          employment_type: string
          experience_level: string
          expires_at: string | null
          featured: boolean
          id: string
          posted_by: string
          salary_currency: string
          salary_max: number | null
          salary_min: number | null
          salary_period: string
          show_salary: boolean
          skills_required: string[]
          status: string
          title: string
          updated_at: string
          views: number
          workplace_type: string
        }
        Insert: {
          applicants_count?: number
          apply_email?: string | null
          apply_mode?: string
          apply_url?: string | null
          benefits?: string[]
          category?: string
          city?: string | null
          company_id: string
          country?: string | null
          created_at?: string
          description?: string | null
          employment_type?: string
          experience_level?: string
          expires_at?: string | null
          featured?: boolean
          id?: string
          posted_by: string
          salary_currency?: string
          salary_max?: number | null
          salary_min?: number | null
          salary_period?: string
          show_salary?: boolean
          skills_required?: string[]
          status?: string
          title: string
          updated_at?: string
          views?: number
          workplace_type?: string
        }
        Update: {
          applicants_count?: number
          apply_email?: string | null
          apply_mode?: string
          apply_url?: string | null
          benefits?: string[]
          category?: string
          city?: string | null
          company_id?: string
          country?: string | null
          created_at?: string
          description?: string | null
          employment_type?: string
          experience_level?: string
          expires_at?: string | null
          featured?: boolean
          id?: string
          posted_by?: string
          salary_currency?: string
          salary_max?: number | null
          salary_min?: number | null
          salary_period?: string
          show_salary?: boolean
          skills_required?: string[]
          status?: string
          title?: string
          updated_at?: string
          views?: number
          workplace_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_postings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "job_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      job_posts: {
        Row: {
          author_id: string
          body: string
          comments_count: number
          created_at: string
          id: string
          likes_count: number
          link_url: string | null
          media: string[]
          updated_at: string
          visibility: string
        }
        Insert: {
          author_id: string
          body: string
          comments_count?: number
          created_at?: string
          id?: string
          likes_count?: number
          link_url?: string | null
          media?: string[]
          updated_at?: string
          visibility?: string
        }
        Update: {
          author_id?: string
          body?: string
          comments_count?: number
          created_at?: string
          id?: string
          likes_count?: number
          link_url?: string | null
          media?: string[]
          updated_at?: string
          visibility?: string
        }
        Relationships: []
      }
      job_saves: {
        Row: {
          created_at: string
          id: string
          job_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          job_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          job_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_saves_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "job_postings"
            referencedColumns: ["id"]
          },
        ]
      }
      job_seeker_education: {
        Row: {
          created_at: string
          degree: string | null
          description: string | null
          end_year: number | null
          field_of_study: string | null
          id: string
          school: string
          sort_order: number
          start_year: number | null
          user_id: string
        }
        Insert: {
          created_at?: string
          degree?: string | null
          description?: string | null
          end_year?: number | null
          field_of_study?: string | null
          id?: string
          school: string
          sort_order?: number
          start_year?: number | null
          user_id: string
        }
        Update: {
          created_at?: string
          degree?: string | null
          description?: string | null
          end_year?: number | null
          field_of_study?: string | null
          id?: string
          school?: string
          sort_order?: number
          start_year?: number | null
          user_id?: string
        }
        Relationships: []
      }
      job_seeker_experiences: {
        Row: {
          company: string
          created_at: string
          description: string | null
          employment_type: string | null
          end_date: string | null
          id: string
          is_current: boolean
          location: string | null
          sort_order: number
          start_date: string | null
          title: string
          user_id: string
        }
        Insert: {
          company: string
          created_at?: string
          description?: string | null
          employment_type?: string | null
          end_date?: string | null
          id?: string
          is_current?: boolean
          location?: string | null
          sort_order?: number
          start_date?: string | null
          title: string
          user_id: string
        }
        Update: {
          company?: string
          created_at?: string
          description?: string | null
          employment_type?: string | null
          end_date?: string | null
          id?: string
          is_current?: boolean
          location?: string | null
          sort_order?: number
          start_date?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      job_seeker_profiles: {
        Row: {
          about: string | null
          avatar_url: string | null
          cover_url: string | null
          created_at: string
          current_company: string | null
          current_title: string | null
          cv_link: string | null
          cv_url: string | null
          email: string | null
          expected_salary: number | null
          expected_salary_currency: string
          expected_salary_period: string
          headline: string | null
          id: string
          languages: string[]
          linkedin_url: string | null
          location_city: string | null
          location_country: string | null
          open_to_remote: boolean
          open_to_work: boolean
          phone: string | null
          skills: string[]
          updated_at: string
          user_id: string
          visibility: string
          website: string | null
          whatsapp: string | null
          years_experience: number | null
        }
        Insert: {
          about?: string | null
          avatar_url?: string | null
          cover_url?: string | null
          created_at?: string
          current_company?: string | null
          current_title?: string | null
          cv_link?: string | null
          cv_url?: string | null
          email?: string | null
          expected_salary?: number | null
          expected_salary_currency?: string
          expected_salary_period?: string
          headline?: string | null
          id?: string
          languages?: string[]
          linkedin_url?: string | null
          location_city?: string | null
          location_country?: string | null
          open_to_remote?: boolean
          open_to_work?: boolean
          phone?: string | null
          skills?: string[]
          updated_at?: string
          user_id: string
          visibility?: string
          website?: string | null
          whatsapp?: string | null
          years_experience?: number | null
        }
        Update: {
          about?: string | null
          avatar_url?: string | null
          cover_url?: string | null
          created_at?: string
          current_company?: string | null
          current_title?: string | null
          cv_link?: string | null
          cv_url?: string | null
          email?: string | null
          expected_salary?: number | null
          expected_salary_currency?: string
          expected_salary_period?: string
          headline?: string | null
          id?: string
          languages?: string[]
          linkedin_url?: string | null
          location_city?: string | null
          location_country?: string | null
          open_to_remote?: boolean
          open_to_work?: boolean
          phone?: string | null
          skills?: string[]
          updated_at?: string
          user_id?: string
          visibility?: string
          website?: string | null
          whatsapp?: string | null
          years_experience?: number | null
        }
        Relationships: []
      }
      job_skill_endorsements: {
        Row: {
          created_at: string
          endorsee_id: string
          endorser_id: string
          id: string
          skill: string
        }
        Insert: {
          created_at?: string
          endorsee_id: string
          endorser_id: string
          id?: string
          skill: string
        }
        Update: {
          created_at?: string
          endorsee_id?: string
          endorser_id?: string
          id?: string
          skill?: string
        }
        Relationships: []
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
      logistics_bids: {
        Row: {
          created_at: string
          currency: string
          driver_avatar: string | null
          driver_id: string
          driver_name: string | null
          driver_rating: number
          eta_minutes: number
          fare: number
          id: string
          message: string | null
          request_id: string
          status: string
          vehicle_label: string | null
          vehicle_plate: string | null
        }
        Insert: {
          created_at?: string
          currency?: string
          driver_avatar?: string | null
          driver_id: string
          driver_name?: string | null
          driver_rating?: number
          eta_minutes?: number
          fare: number
          id?: string
          message?: string | null
          request_id: string
          status?: string
          vehicle_label?: string | null
          vehicle_plate?: string | null
        }
        Update: {
          created_at?: string
          currency?: string
          driver_avatar?: string | null
          driver_id?: string
          driver_name?: string | null
          driver_rating?: number
          eta_minutes?: number
          fare?: number
          id?: string
          message?: string | null
          request_id?: string
          status?: string
          vehicle_label?: string | null
          vehicle_plate?: string | null
        }
        Relationships: []
      }
      logistics_requests: {
        Row: {
          assigned_driver_id: string | null
          budget: number | null
          buyer_id: string
          created_at: string
          currency: string
          description: string | null
          distance_km: number | null
          dropoff_address: string
          dropoff_lat: number | null
          dropoff_lng: number | null
          gallery: string[]
          id: string
          package_kind: string | null
          pickup_address: string
          pickup_at: string | null
          pickup_lat: number | null
          pickup_lng: number | null
          status: string
          title: string
          updated_at: string
          vehicle_type: string
          weight_kg: number | null
        }
        Insert: {
          assigned_driver_id?: string | null
          budget?: number | null
          buyer_id: string
          created_at?: string
          currency?: string
          description?: string | null
          distance_km?: number | null
          dropoff_address: string
          dropoff_lat?: number | null
          dropoff_lng?: number | null
          gallery?: string[]
          id?: string
          package_kind?: string | null
          pickup_address: string
          pickup_at?: string | null
          pickup_lat?: number | null
          pickup_lng?: number | null
          status?: string
          title: string
          updated_at?: string
          vehicle_type?: string
          weight_kg?: number | null
        }
        Update: {
          assigned_driver_id?: string | null
          budget?: number | null
          buyer_id?: string
          created_at?: string
          currency?: string
          description?: string | null
          distance_km?: number | null
          dropoff_address?: string
          dropoff_lat?: number | null
          dropoff_lng?: number | null
          gallery?: string[]
          id?: string
          package_kind?: string | null
          pickup_address?: string
          pickup_at?: string | null
          pickup_lat?: number | null
          pickup_lng?: number | null
          status?: string
          title?: string
          updated_at?: string
          vehicle_type?: string
          weight_kg?: number | null
        }
        Relationships: []
      }
      messages: {
        Row: {
          attachment: Json | null
          body: string
          conversation_id: string
          created_at: string
          forwarded: boolean
          id: string
          reactions: Json
          reply_to_id: string | null
          sender_id: string
        }
        Insert: {
          attachment?: Json | null
          body: string
          conversation_id: string
          created_at?: string
          forwarded?: boolean
          id?: string
          reactions?: Json
          reply_to_id?: string | null
          sender_id: string
        }
        Update: {
          attachment?: Json | null
          body?: string
          conversation_id?: string
          created_at?: string
          forwarded?: boolean
          id?: string
          reactions?: Json
          reply_to_id?: string | null
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
          {
            foreignKeyName: "messages_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      news_articles: {
        Row: {
          author: string | null
          body: string | null
          category: string
          cover: string | null
          created_at: string
          dek: string | null
          featured: boolean
          id: string
          published_at: string
          read_minutes: number
          slug: string
          source: string | null
          source_url: string | null
          tags: string[]
          title: string
          updated_at: string
          views: number
        }
        Insert: {
          author?: string | null
          body?: string | null
          category?: string
          cover?: string | null
          created_at?: string
          dek?: string | null
          featured?: boolean
          id?: string
          published_at?: string
          read_minutes?: number
          slug: string
          source?: string | null
          source_url?: string | null
          tags?: string[]
          title: string
          updated_at?: string
          views?: number
        }
        Update: {
          author?: string | null
          body?: string | null
          category?: string
          cover?: string | null
          created_at?: string
          dek?: string | null
          featured?: boolean
          id?: string
          published_at?: string
          read_minutes?: number
          slug?: string
          source?: string | null
          source_url?: string | null
          tags?: string[]
          title?: string
          updated_at?: string
          views?: number
        }
        Relationships: []
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
          dispute_opened_at: string | null
          dispute_reason: string | null
          escrow_amount: number
          escrow_released_at: string | null
          escrow_status: string
          eta: string | null
          id: string
          payment_method: string | null
          payment_reference: string | null
          payment_status: string
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
          dispute_opened_at?: string | null
          dispute_reason?: string | null
          escrow_amount?: number
          escrow_released_at?: string | null
          escrow_status?: string
          eta?: string | null
          id?: string
          payment_method?: string | null
          payment_reference?: string | null
          payment_status?: string
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
          dispute_opened_at?: string | null
          dispute_reason?: string | null
          escrow_amount?: number
          escrow_released_at?: string | null
          escrow_status?: string
          eta?: string | null
          id?: string
          payment_method?: string | null
          payment_reference?: string | null
          payment_status?: string
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
      payment_status_history: {
        Row: {
          amount: number | null
          created_at: string
          currency: string
          details: Json
          gateway_reference: string | null
          id: string
          merchant_reference: string
          provider: string
          purpose: string
          status: string
          user_id: string
        }
        Insert: {
          amount?: number | null
          created_at?: string
          currency?: string
          details?: Json
          gateway_reference?: string | null
          id?: string
          merchant_reference: string
          provider: string
          purpose: string
          status: string
          user_id: string
        }
        Update: {
          amount?: number | null
          created_at?: string
          currency?: string
          details?: Json
          gateway_reference?: string | null
          id?: string
          merchant_reference?: string
          provider?: string
          purpose?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      product_inquiries: {
        Row: {
          buyer_id: string
          created_at: string
          id: string
          message: string | null
          product_id: string
          supplier_id: string
        }
        Insert: {
          buyer_id: string
          created_at?: string
          id?: string
          message?: string | null
          product_id: string
          supplier_id: string
        }
        Update: {
          buyer_id?: string
          created_at?: string
          id?: string
          message?: string | null
          product_id?: string
          supplier_id?: string
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
          lead_time_days: number | null
          moq: number | null
          original_price: number | null
          price: number
          rating: number | null
          ready_to_ship: boolean
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
          lead_time_days?: number | null
          moq?: number | null
          original_price?: number | null
          price?: number
          rating?: number | null
          ready_to_ship?: boolean
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
          lead_time_days?: number | null
          moq?: number | null
          original_price?: number | null
          price?: number
          rating?: number | null
          ready_to_ship?: boolean
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
      properties: {
        Row: {
          active: boolean
          address: string | null
          amenities: string[]
          area_sqm: number | null
          available_from: string | null
          baths: number | null
          bedrooms: number | null
          city: string | null
          contact_phone: string | null
          contact_whatsapp: string | null
          country: string | null
          cover: string | null
          created_at: string
          currency: string
          description: string | null
          featured: boolean
          furnished: boolean
          gallery: string[]
          id: string
          lat: number | null
          listing_type: string
          lng: number | null
          owner_user_id: string
          price: number
          price_period: string | null
          property_kind: string
          supplier_id: string | null
          title: string
          updated_at: string
          views: number
          virtual_tour_url: string | null
        }
        Insert: {
          active?: boolean
          address?: string | null
          amenities?: string[]
          area_sqm?: number | null
          available_from?: string | null
          baths?: number | null
          bedrooms?: number | null
          city?: string | null
          contact_phone?: string | null
          contact_whatsapp?: string | null
          country?: string | null
          cover?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          featured?: boolean
          furnished?: boolean
          gallery?: string[]
          id?: string
          lat?: number | null
          listing_type?: string
          lng?: number | null
          owner_user_id: string
          price: number
          price_period?: string | null
          property_kind?: string
          supplier_id?: string | null
          title: string
          updated_at?: string
          views?: number
          virtual_tour_url?: string | null
        }
        Update: {
          active?: boolean
          address?: string | null
          amenities?: string[]
          area_sqm?: number | null
          available_from?: string | null
          baths?: number | null
          bedrooms?: number | null
          city?: string | null
          contact_phone?: string | null
          contact_whatsapp?: string | null
          country?: string | null
          cover?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          featured?: boolean
          furnished?: boolean
          gallery?: string[]
          id?: string
          lat?: number | null
          listing_type?: string
          lng?: number | null
          owner_user_id?: string
          price?: number
          price_period?: string | null
          property_kind?: string
          supplier_id?: string | null
          title?: string
          updated_at?: string
          views?: number
          virtual_tour_url?: string | null
        }
        Relationships: []
      }
      property_inquiries: {
        Row: {
          created_at: string
          id: string
          inquirer_email: string | null
          inquirer_id: string
          inquirer_name: string | null
          inquirer_phone: string | null
          message: string | null
          preferred_date: string | null
          property_id: string
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          inquirer_email?: string | null
          inquirer_id: string
          inquirer_name?: string | null
          inquirer_phone?: string | null
          message?: string | null
          preferred_date?: string | null
          property_id: string
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          inquirer_email?: string | null
          inquirer_id?: string
          inquirer_name?: string | null
          inquirer_phone?: string | null
          message?: string | null
          preferred_date?: string | null
          property_id?: string
          status?: string
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
      quote_messages: {
        Row: {
          body: string | null
          created_at: string
          id: string
          proposed_lead_time: string | null
          proposed_moq: number | null
          proposed_packaging: string | null
          proposed_price: number | null
          quote_id: string
          sender_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          proposed_lead_time?: string | null
          proposed_moq?: number | null
          proposed_packaging?: string | null
          proposed_price?: number | null
          quote_id: string
          sender_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          proposed_lead_time?: string | null
          proposed_moq?: number | null
          proposed_packaging?: string | null
          proposed_price?: number | null
          quote_id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quote_messages_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quotes: {
        Row: {
          created_at: string
          currency: string | null
          id: string
          lead_time: string | null
          moq: number | null
          notes: string | null
          packaging: string | null
          price_per_unit: number
          rfq_id: string
          status: string
          supplier_id: string
          valid_until: string | null
        }
        Insert: {
          created_at?: string
          currency?: string | null
          id?: string
          lead_time?: string | null
          moq?: number | null
          notes?: string | null
          packaging?: string | null
          price_per_unit: number
          rfq_id: string
          status?: string
          supplier_id: string
          valid_until?: string | null
        }
        Update: {
          created_at?: string
          currency?: string | null
          id?: string
          lead_time?: string | null
          moq?: number | null
          notes?: string | null
          packaging?: string | null
          price_per_unit?: number
          rfq_id?: string
          status?: string
          supplier_id?: string
          valid_until?: string | null
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
          attachments: string[]
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
          attachments?: string[]
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
          attachments?: string[]
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
      ride_messages: {
        Row: {
          body: string
          created_at: string
          id: string
          ride_id: string
          sender_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          ride_id: string
          sender_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          ride_id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ride_messages_ride_id_fkey"
            columns: ["ride_id"]
            isOneToOne: false
            referencedRelation: "rides"
            referencedColumns: ["id"]
          },
        ]
      }
      ride_offers: {
        Row: {
          created_at: string
          driver_avatar: string | null
          driver_id: string
          driver_lat: number | null
          driver_lng: number | null
          driver_name: string | null
          driver_rating: number
          driver_trips: number
          eta_minutes: number
          fare: number
          id: string
          ride_id: string
          status: string
          vehicle_label: string | null
          vehicle_plate: string | null
        }
        Insert: {
          created_at?: string
          driver_avatar?: string | null
          driver_id: string
          driver_lat?: number | null
          driver_lng?: number | null
          driver_name?: string | null
          driver_rating?: number
          driver_trips?: number
          eta_minutes?: number
          fare: number
          id?: string
          ride_id: string
          status?: string
          vehicle_label?: string | null
          vehicle_plate?: string | null
        }
        Update: {
          created_at?: string
          driver_avatar?: string | null
          driver_id?: string
          driver_lat?: number | null
          driver_lng?: number | null
          driver_name?: string | null
          driver_rating?: number
          driver_trips?: number
          eta_minutes?: number
          fare?: number
          id?: string
          ride_id?: string
          status?: string
          vehicle_label?: string | null
          vehicle_plate?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ride_offers_ride_id_fkey"
            columns: ["ride_id"]
            isOneToOne: false
            referencedRelation: "rides"
            referencedColumns: ["id"]
          },
        ]
      }
      ride_ratings: {
        Row: {
          comment: string | null
          created_at: string
          direction: string
          id: string
          ratee_id: string
          rater_id: string
          ride_id: string
          stars: number
        }
        Insert: {
          comment?: string | null
          created_at?: string
          direction: string
          id?: string
          ratee_id: string
          rater_id: string
          ride_id: string
          stars: number
        }
        Update: {
          comment?: string | null
          created_at?: string
          direction?: string
          id?: string
          ratee_id?: string
          rater_id?: string
          ride_id?: string
          stars?: number
        }
        Relationships: [
          {
            foreignKeyName: "ride_ratings_ride_id_fkey"
            columns: ["ride_id"]
            isOneToOne: false
            referencedRelation: "rides"
            referencedColumns: ["id"]
          },
        ]
      }
      rides: {
        Row: {
          accepted_at: string | null
          completed_at: string | null
          created_at: string
          currency: string
          distance_km: number
          driver_id: string | null
          driver_lat: number | null
          driver_lng: number | null
          driver_rating: number | null
          dropoff_address: string
          dropoff_lat: number
          dropoff_lng: number
          final_fare: number | null
          id: string
          notes: string | null
          pickup_address: string
          pickup_lat: number
          pickup_lng: number
          rider_id: string
          rider_lat: number | null
          rider_lng: number | null
          rider_offer: number
          rider_rating: number | null
          started_at: string | null
          status: string
          updated_at: string
          vehicle_class: string
        }
        Insert: {
          accepted_at?: string | null
          completed_at?: string | null
          created_at?: string
          currency?: string
          distance_km?: number
          driver_id?: string | null
          driver_lat?: number | null
          driver_lng?: number | null
          driver_rating?: number | null
          dropoff_address: string
          dropoff_lat: number
          dropoff_lng: number
          final_fare?: number | null
          id?: string
          notes?: string | null
          pickup_address: string
          pickup_lat: number
          pickup_lng: number
          rider_id: string
          rider_lat?: number | null
          rider_lng?: number | null
          rider_offer: number
          rider_rating?: number | null
          started_at?: string | null
          status?: string
          updated_at?: string
          vehicle_class?: string
        }
        Update: {
          accepted_at?: string | null
          completed_at?: string | null
          created_at?: string
          currency?: string
          distance_km?: number
          driver_id?: string | null
          driver_lat?: number | null
          driver_lng?: number | null
          driver_rating?: number | null
          dropoff_address?: string
          dropoff_lat?: number
          dropoff_lng?: number
          final_fare?: number | null
          id?: string
          notes?: string | null
          pickup_address?: string
          pickup_lat?: number
          pickup_lng?: number
          rider_id?: string
          rider_lat?: number | null
          rider_lng?: number | null
          rider_offer?: number
          rider_rating?: number | null
          started_at?: string | null
          status?: string
          updated_at?: string
          vehicle_class?: string
        }
        Relationships: []
      }
      service_bids: {
        Row: {
          created_at: string
          currency: string
          eta_days: number | null
          id: string
          message: string | null
          price: number
          provider_avatar: string | null
          provider_name: string | null
          provider_user_id: string
          request_id: string
          status: string
        }
        Insert: {
          created_at?: string
          currency?: string
          eta_days?: number | null
          id?: string
          message?: string | null
          price: number
          provider_avatar?: string | null
          provider_name?: string | null
          provider_user_id: string
          request_id: string
          status?: string
        }
        Update: {
          created_at?: string
          currency?: string
          eta_days?: number | null
          id?: string
          message?: string | null
          price?: number
          provider_avatar?: string | null
          provider_name?: string | null
          provider_user_id?: string
          request_id?: string
          status?: string
        }
        Relationships: []
      }
      service_providers: {
        Row: {
          active: boolean
          bio: string | null
          category: string
          city: string | null
          country: string | null
          cover: string | null
          created_at: string
          currency: string
          display_name: string
          email: string | null
          gallery: string[]
          hourly_rate: number | null
          id: string
          jobs_completed: number
          phone: string | null
          rating: number
          service_area: string | null
          skills: string[]
          subcategory: string | null
          updated_at: string
          user_id: string
          verified: boolean
          whatsapp: string | null
        }
        Insert: {
          active?: boolean
          bio?: string | null
          category: string
          city?: string | null
          country?: string | null
          cover?: string | null
          created_at?: string
          currency?: string
          display_name: string
          email?: string | null
          gallery?: string[]
          hourly_rate?: number | null
          id?: string
          jobs_completed?: number
          phone?: string | null
          rating?: number
          service_area?: string | null
          skills?: string[]
          subcategory?: string | null
          updated_at?: string
          user_id: string
          verified?: boolean
          whatsapp?: string | null
        }
        Update: {
          active?: boolean
          bio?: string | null
          category?: string
          city?: string | null
          country?: string | null
          cover?: string | null
          created_at?: string
          currency?: string
          display_name?: string
          email?: string | null
          gallery?: string[]
          hourly_rate?: number | null
          id?: string
          jobs_completed?: number
          phone?: string | null
          rating?: number
          service_area?: string | null
          skills?: string[]
          subcategory?: string | null
          updated_at?: string
          user_id?: string
          verified?: boolean
          whatsapp?: string | null
        }
        Relationships: []
      }
      service_requests: {
        Row: {
          address: string | null
          assigned_provider_id: string | null
          budget: number | null
          buyer_id: string
          category: string
          city: string | null
          country: string | null
          created_at: string
          currency: string
          deadline: string | null
          description: string | null
          gallery: string[]
          id: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          assigned_provider_id?: string | null
          budget?: number | null
          buyer_id: string
          category: string
          city?: string | null
          country?: string | null
          created_at?: string
          currency?: string
          deadline?: string | null
          description?: string | null
          gallery?: string[]
          id?: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          assigned_provider_id?: string | null
          budget?: number | null
          buyer_id?: string
          category?: string
          city?: string | null
          country?: string | null
          created_at?: string
          currency?: string
          deadline?: string | null
          description?: string | null
          gallery?: string[]
          id?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      stay_bookings: {
        Row: {
          check_in: string
          check_out: string
          cleaning_fee: number
          created_at: string
          currency: string
          guest_id: string
          guests: number
          id: string
          nightly_rate: number
          nights: number
          notes: string | null
          service_fee: number
          status: string
          stay_id: string
          total: number
          updated_at: string
        }
        Insert: {
          check_in: string
          check_out: string
          cleaning_fee?: number
          created_at?: string
          currency?: string
          guest_id: string
          guests?: number
          id?: string
          nightly_rate?: number
          nights?: number
          notes?: string | null
          service_fee?: number
          status?: string
          stay_id: string
          total?: number
          updated_at?: string
        }
        Update: {
          check_in?: string
          check_out?: string
          cleaning_fee?: number
          created_at?: string
          currency?: string
          guest_id?: string
          guests?: number
          id?: string
          nightly_rate?: number
          nights?: number
          notes?: string | null
          service_fee?: number
          status?: string
          stay_id?: string
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stay_bookings_stay_id_fkey"
            columns: ["stay_id"]
            isOneToOne: false
            referencedRelation: "stays"
            referencedColumns: ["id"]
          },
        ]
      }
      stays: {
        Row: {
          active: boolean
          amenities: string[]
          baths: number
          bedrooms: number
          beds: number
          city: string | null
          country: string | null
          country_code: string | null
          cover: string | null
          created_at: string
          currency: string
          description: string | null
          gallery: string[]
          guests: number
          id: string
          kind: string
          price_per_night: number
          rating: number
          review_count: number
          slug: string | null
          superhost: boolean
          supplier_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          amenities?: string[]
          baths?: number
          bedrooms?: number
          beds?: number
          city?: string | null
          country?: string | null
          country_code?: string | null
          cover?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          gallery?: string[]
          guests?: number
          id?: string
          kind?: string
          price_per_night?: number
          rating?: number
          review_count?: number
          slug?: string | null
          superhost?: boolean
          supplier_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          amenities?: string[]
          baths?: number
          bedrooms?: number
          beds?: number
          city?: string | null
          country?: string | null
          country_code?: string | null
          cover?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          gallery?: string[]
          guests?: number
          id?: string
          kind?: string
          price_per_night?: number
          rating?: number
          review_count?: number
          slug?: string | null
          superhost?: boolean
          supplier_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stays_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_certifications: {
        Row: {
          created_at: string
          document_url: string | null
          expires_at: string | null
          id: string
          issued_at: string | null
          issuer: string | null
          sort_order: number
          supplier_id: string
          title: string
          updated_at: string
          verified: boolean
        }
        Insert: {
          created_at?: string
          document_url?: string | null
          expires_at?: string | null
          id?: string
          issued_at?: string | null
          issuer?: string | null
          sort_order?: number
          supplier_id: string
          title: string
          updated_at?: string
          verified?: boolean
        }
        Update: {
          created_at?: string
          document_url?: string | null
          expires_at?: string | null
          id?: string
          issued_at?: string | null
          issuer?: string | null
          sort_order?: number
          supplier_id?: string
          title?: string
          updated_at?: string
          verified?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "supplier_certifications_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          about: string | null
          banner: string | null
          business_type: string | null
          categories: string[]
          country: string | null
          country_code: string | null
          created_at: string
          email: string | null
          export_countries: string[]
          gold: boolean | null
          id: string
          latitude: number | null
          location_address: string | null
          logo: string | null
          longitude: number | null
          mirror_of: string | null
          name: string
          on_time_delivery: number | null
          onboarding_completed_at: string | null
          owner_id: string
          phone: string | null
          rating: number | null
          response_rate: number | null
          response_time: string | null
          slug: string | null
          trade_assurance: boolean | null
          trade_type: string
          updated_at: string
          verified: boolean | null
          website: string | null
          years_active: number | null
        }
        Insert: {
          about?: string | null
          banner?: string | null
          business_type?: string | null
          categories?: string[]
          country?: string | null
          country_code?: string | null
          created_at?: string
          email?: string | null
          export_countries?: string[]
          gold?: boolean | null
          id?: string
          latitude?: number | null
          location_address?: string | null
          logo?: string | null
          longitude?: number | null
          mirror_of?: string | null
          name: string
          on_time_delivery?: number | null
          onboarding_completed_at?: string | null
          owner_id: string
          phone?: string | null
          rating?: number | null
          response_rate?: number | null
          response_time?: string | null
          slug?: string | null
          trade_assurance?: boolean | null
          trade_type?: string
          updated_at?: string
          verified?: boolean | null
          website?: string | null
          years_active?: number | null
        }
        Update: {
          about?: string | null
          banner?: string | null
          business_type?: string | null
          categories?: string[]
          country?: string | null
          country_code?: string | null
          created_at?: string
          email?: string | null
          export_countries?: string[]
          gold?: boolean | null
          id?: string
          latitude?: number | null
          location_address?: string | null
          logo?: string | null
          longitude?: number | null
          mirror_of?: string | null
          name?: string
          on_time_delivery?: number | null
          onboarding_completed_at?: string | null
          owner_id?: string
          phone?: string | null
          rating?: number | null
          response_rate?: number | null
          response_time?: string | null
          slug?: string | null
          trade_assurance?: boolean | null
          trade_type?: string
          updated_at?: string
          verified?: boolean | null
          website?: string | null
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
      user_verifications: {
        Row: {
          created_at: string
          id: string
          id_card_url: string
          notes: string | null
          proof_residency_url: string
          reviewed_at: string | null
          reviewer_id: string | null
          status: Database["public"]["Enums"]["verification_status"]
          submitted_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          id_card_url: string
          notes?: string | null
          proof_residency_url: string
          reviewed_at?: string | null
          reviewer_id?: string | null
          status?: Database["public"]["Enums"]["verification_status"]
          submitted_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          id_card_url?: string
          notes?: string | null
          proof_residency_url?: string
          reviewed_at?: string | null
          reviewer_id?: string | null
          status?: Database["public"]["Enums"]["verification_status"]
          submitted_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      vehicle_inquiries: {
        Row: {
          buyer_id: string
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          down_payment: number | null
          estimated_monthly: number | null
          id: string
          kind: string
          loan_term_months: number | null
          message: string | null
          preferred_date: string | null
          status: string
          updated_at: string
          vehicle_id: string
        }
        Insert: {
          buyer_id: string
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          down_payment?: number | null
          estimated_monthly?: number | null
          id?: string
          kind?: string
          loan_term_months?: number | null
          message?: string | null
          preferred_date?: string | null
          status?: string
          updated_at?: string
          vehicle_id: string
        }
        Update: {
          buyer_id?: string
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          down_payment?: number | null
          estimated_monthly?: number | null
          id?: string
          kind?: string
          loan_term_months?: number | null
          message?: string | null
          preferred_date?: string | null
          status?: string
          updated_at?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_inquiries_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_saves: {
        Row: {
          created_at: string
          id: string
          user_id: string
          vehicle_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          user_id: string
          vehicle_id: string
        }
        Update: {
          created_at?: string
          id?: string
          user_id?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_saves_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicles: {
        Row: {
          active: boolean
          badge: string | null
          body_type: string | null
          city: string | null
          condition: string
          country: string | null
          cover: string | null
          created_at: string
          currency: string
          description: string | null
          drivetrain: string | null
          features: string[]
          fuel: string | null
          gallery: string[]
          id: string
          kind: string
          make: string | null
          mileage_km: number | null
          model: string | null
          original_price: number | null
          power_hp: number | null
          price: number
          slug: string | null
          supplier_id: string | null
          title: string
          transmission: string | null
          updated_at: string
          year: number | null
        }
        Insert: {
          active?: boolean
          badge?: string | null
          body_type?: string | null
          city?: string | null
          condition?: string
          country?: string | null
          cover?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          drivetrain?: string | null
          features?: string[]
          fuel?: string | null
          gallery?: string[]
          id?: string
          kind?: string
          make?: string | null
          mileage_km?: number | null
          model?: string | null
          original_price?: number | null
          power_hp?: number | null
          price?: number
          slug?: string | null
          supplier_id?: string | null
          title: string
          transmission?: string | null
          updated_at?: string
          year?: number | null
        }
        Update: {
          active?: boolean
          badge?: string | null
          body_type?: string | null
          city?: string | null
          condition?: string
          country?: string | null
          cover?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          drivetrain?: string | null
          features?: string[]
          fuel?: string | null
          gallery?: string[]
          id?: string
          kind?: string
          make?: string | null
          mileage_km?: number | null
          model?: string | null
          original_price?: number | null
          power_hp?: number | null
          price?: number
          slug?: string | null
          supplier_id?: string | null
          title?: string
          transmission?: string | null
          updated_at?: string
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicles_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      wallet_transactions: {
        Row: {
          amount: number
          balance_after: number
          created_at: string
          description: string | null
          id: string
          kind: string
          reference: string | null
          user_id: string
        }
        Insert: {
          amount: number
          balance_after?: number
          created_at?: string
          description?: string | null
          id?: string
          kind: string
          reference?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          balance_after?: number
          created_at?: string
          description?: string | null
          id?: string
          kind?: string
          reference?: string | null
          user_id?: string
        }
        Relationships: []
      }
      wallets: {
        Row: {
          balance: number
          created_at: string
          currency: string
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          created_at?: string
          currency?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          created_at?: string
          currency?: string
          updated_at?: string
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
      _push_burst_tick: { Args: never; Returns: undefined }
      _send_test_push: { Args: { _label: string }; Returns: undefined }
      apply_wallet_transaction: {
        Args: {
          _amount: number
          _description?: string
          _kind: string
          _reference?: string
          _user_id: string
        }
        Returns: {
          amount: number
          balance_after: number
          created_at: string
          description: string | null
          id: string
          kind: string
          reference: string | null
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "wallet_transactions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_cod_verified: { Args: { _user_id: string }; Returns: boolean }
      pay_order_with_wallet: {
        Args: { _order_id: string }
        Returns: {
          amount: number
          balance_after: number
          created_at: string
          description: string | null
          id: string
          kind: string
          reference: string | null
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "wallet_transactions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      pending_rides_for_driver: {
        Args: { _lat: number; _lng: number; _radius_km?: number }
        Returns: {
          accepted_at: string | null
          completed_at: string | null
          created_at: string
          currency: string
          distance_km: number
          driver_id: string | null
          driver_lat: number | null
          driver_lng: number | null
          driver_rating: number | null
          dropoff_address: string
          dropoff_lat: number
          dropoff_lng: number
          final_fare: number | null
          id: string
          notes: string | null
          pickup_address: string
          pickup_lat: number
          pickup_lng: number
          rider_id: string
          rider_lat: number | null
          rider_lng: number | null
          rider_offer: number
          rider_rating: number | null
          started_at: string | null
          status: string
          updated_at: string
          vehicle_class: string
        }[]
        SetofOptions: {
          from: "*"
          to: "rides"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      resolve_master_supplier: {
        Args: { _supplier_id: string }
        Returns: string
      }
    }
    Enums: {
      app_role: "supplier" | "buyer" | "admin"
      live_status: "scheduled" | "live" | "ended"
      order_status:
        | "awaiting_payment"
        | "placed"
        | "processing"
        | "shipped"
        | "delivered"
        | "cancelled"
      rfq_status: "open" | "closed"
      verification_status: "pending" | "approved" | "rejected"
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
      app_role: ["supplier", "buyer", "admin"],
      live_status: ["scheduled", "live", "ended"],
      order_status: [
        "awaiting_payment",
        "placed",
        "processing",
        "shipped",
        "delivered",
        "cancelled",
      ],
      rfq_status: ["open", "closed"],
      verification_status: ["pending", "approved", "rejected"],
    },
  },
} as const
