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
      admin_audit_log: {
        Row: {
          action: string
          admin_id: string
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          metadata: Json
        }
        Insert: {
          action: string
          admin_id: string
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          metadata?: Json
        }
        Update: {
          action?: string
          admin_id?: string
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          metadata?: Json
        }
        Relationships: [
          {
            foreignKeyName: "admin_audit_log_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      flash_deals: {
        Row: {
          created_at: string
          description: string | null
          discount_text: string
          ends_at: string
          id: string
          is_active: boolean
          max_redemptions: number
          radius_km: number
          redeemed_count: number
          starts_at: string
          target_cities: string[] | null
          title: string
          vendor_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          discount_text: string
          ends_at: string
          id?: string
          is_active?: boolean
          max_redemptions?: number
          radius_km?: number
          redeemed_count?: number
          starts_at?: string
          target_cities?: string[] | null
          title: string
          vendor_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          discount_text?: string
          ends_at?: string
          id?: string
          is_active?: boolean
          max_redemptions?: number
          radius_km?: number
          redeemed_count?: number
          starts_at?: string
          target_cities?: string[] | null
          title?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "flash_deals_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendor_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      institutions: {
        Row: {
          abbreviation: string | null
          city: string | null
          country: string
          created_at: string
          email_domains: string[]
          estimated_student_count: number | null
          id: string
          is_active: boolean
          latitude: number | null
          logo_url: string | null
          longitude: number | null
          name: string
          short_name: string | null
          state: string | null
          updated_at: string
          website_url: string | null
        }
        Insert: {
          abbreviation?: string | null
          city?: string | null
          country?: string
          created_at?: string
          email_domains: string[]
          estimated_student_count?: number | null
          id?: string
          is_active?: boolean
          latitude?: number | null
          logo_url?: string | null
          longitude?: number | null
          name: string
          short_name?: string | null
          state?: string | null
          updated_at?: string
          website_url?: string | null
        }
        Update: {
          abbreviation?: string | null
          city?: string | null
          country?: string
          created_at?: string
          email_domains?: string[]
          estimated_student_count?: number | null
          id?: string
          is_active?: boolean
          latitude?: number | null
          logo_url?: string | null
          longitude?: number | null
          name?: string
          short_name?: string | null
          state?: string | null
          updated_at?: string
          website_url?: string | null
        }
        Relationships: []
      }
      loyalty_cards: {
        Row: {
          completed_cycles: number
          created_at: string
          current_stamps: number
          id: string
          last_stamp_at: string | null
          offer_id: string | null
          student_id: string
          total_stamps: number
          updated_at: string
          vendor_id: string
        }
        Insert: {
          completed_cycles?: number
          created_at?: string
          current_stamps?: number
          id?: string
          last_stamp_at?: string | null
          offer_id?: string | null
          student_id: string
          total_stamps?: number
          updated_at?: string
          vendor_id: string
        }
        Update: {
          completed_cycles?: number
          created_at?: string
          current_stamps?: number
          id?: string
          last_stamp_at?: string | null
          offer_id?: string | null
          student_id?: string
          total_stamps?: number
          updated_at?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_cards_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_cards_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_cards_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendor_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          is_read: boolean
          read_at: string | null
          related_entity_id: string | null
          related_entity_type: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          read_at?: string | null
          related_entity_id?: string | null
          related_entity_type?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          read_at?: string | null
          related_entity_id?: string | null
          related_entity_type?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      offer_views: {
        Row: {
          id: string
          offer_id: string
          source: string | null
          student_id: string | null
          vendor_id: string
          viewed_at: string
        }
        Insert: {
          id?: string
          offer_id: string
          source?: string | null
          student_id?: string | null
          vendor_id: string
          viewed_at?: string
        }
        Update: {
          id?: string
          offer_id?: string
          source?: string | null
          student_id?: string | null
          vendor_id?: string
          viewed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "offer_views_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offer_views_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offer_views_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendor_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      offers: {
        Row: {
          category: Database["public"]["Enums"]["offer_category"]
          created_at: string
          description: string | null
          discount_label: string
          discount_type: Database["public"]["Enums"]["discount_type"]
          discount_value: number | null
          expires_at: string | null
          id: string
          image_url: string | null
          max_total_redemptions: number | null
          max_uses_per_student: number
          min_purchase_amount: number | null
          original_price: number | null
          redemption_count: number
          save_count: number
          starts_at: string
          status: Database["public"]["Enums"]["offer_status"]
          tags: string[] | null
          target_institution_ids: string[] | null
          terms_and_conditions: string | null
          title: string
          updated_at: string
          vendor_id: string
          view_count: number
        }
        Insert: {
          category: Database["public"]["Enums"]["offer_category"]
          created_at?: string
          description?: string | null
          discount_label: string
          discount_type: Database["public"]["Enums"]["discount_type"]
          discount_value?: number | null
          expires_at?: string | null
          id?: string
          image_url?: string | null
          max_total_redemptions?: number | null
          max_uses_per_student?: number
          min_purchase_amount?: number | null
          original_price?: number | null
          redemption_count?: number
          save_count?: number
          starts_at?: string
          status?: Database["public"]["Enums"]["offer_status"]
          tags?: string[] | null
          target_institution_ids?: string[] | null
          terms_and_conditions?: string | null
          title: string
          updated_at?: string
          vendor_id: string
          view_count?: number
        }
        Update: {
          category?: Database["public"]["Enums"]["offer_category"]
          created_at?: string
          description?: string | null
          discount_label?: string
          discount_type?: Database["public"]["Enums"]["discount_type"]
          discount_value?: number | null
          expires_at?: string | null
          id?: string
          image_url?: string | null
          max_total_redemptions?: number | null
          max_uses_per_student?: number
          min_purchase_amount?: number | null
          original_price?: number | null
          redemption_count?: number
          save_count?: number
          starts_at?: string
          status?: Database["public"]["Enums"]["offer_status"]
          tags?: string[] | null
          target_institution_ids?: string[] | null
          terms_and_conditions?: string | null
          title?: string
          updated_at?: string
          vendor_id?: string
          view_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "offers_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendor_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_config: {
        Row: {
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Update: {
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          city: string | null
          country: string | null
          created_at: string
          display_name: string | null
          first_name: string | null
          id: string
          is_active: boolean
          last_name: string | null
          last_seen_at: string | null
          phone: string | null
          role: Database["public"]["Enums"]["user_role"]
          state: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          display_name?: string | null
          first_name?: string | null
          id: string
          is_active?: boolean
          last_name?: string | null
          last_seen_at?: string | null
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          state?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          display_name?: string | null
          first_name?: string | null
          id?: string
          is_active?: boolean
          last_name?: string | null
          last_seen_at?: string | null
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          state?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      redemptions: {
        Row: {
          cancelled_at: string | null
          claimed_at: string
          claimed_date: string | null
          claimed_day_of_week: number | null
          claimed_hour: number | null
          claimed_month: number | null
          claimed_week: number | null
          claimed_year: number | null
          confirmed_at: string | null
          confirmed_by_vendor_user_id: string | null
          created_at: string
          device_type: string | null
          discount_value_applied: number | null
          estimated_transaction_value: number | null
          expires_at: string
          id: string
          offer_category: Database["public"]["Enums"]["offer_category"] | null
          offer_id: string
          qr_code_payload: string | null
          redemption_code: string
          redemption_source: string | null
          status: Database["public"]["Enums"]["redemption_status"]
          student_graduation_year: number | null
          student_id: string
          student_institution_id: string | null
          student_institution_name: string | null
          time_to_confirm_seconds: number | null
          vendor_city: string | null
          vendor_id: string
          vendor_latitude: number | null
          vendor_longitude: number | null
        }
        Insert: {
          cancelled_at?: string | null
          claimed_at?: string
          claimed_date?: string | null
          claimed_day_of_week?: number | null
          claimed_hour?: number | null
          claimed_month?: number | null
          claimed_week?: number | null
          claimed_year?: number | null
          confirmed_at?: string | null
          confirmed_by_vendor_user_id?: string | null
          created_at?: string
          device_type?: string | null
          discount_value_applied?: number | null
          estimated_transaction_value?: number | null
          expires_at: string
          id?: string
          offer_category?: Database["public"]["Enums"]["offer_category"] | null
          offer_id: string
          qr_code_payload?: string | null
          redemption_code: string
          redemption_source?: string | null
          status?: Database["public"]["Enums"]["redemption_status"]
          student_graduation_year?: number | null
          student_id: string
          student_institution_id?: string | null
          student_institution_name?: string | null
          time_to_confirm_seconds?: number | null
          vendor_city?: string | null
          vendor_id: string
          vendor_latitude?: number | null
          vendor_longitude?: number | null
        }
        Update: {
          cancelled_at?: string | null
          claimed_at?: string
          claimed_date?: string | null
          claimed_day_of_week?: number | null
          claimed_hour?: number | null
          claimed_month?: number | null
          claimed_week?: number | null
          claimed_year?: number | null
          confirmed_at?: string | null
          confirmed_by_vendor_user_id?: string | null
          created_at?: string
          device_type?: string | null
          discount_value_applied?: number | null
          estimated_transaction_value?: number | null
          expires_at?: string
          id?: string
          offer_category?: Database["public"]["Enums"]["offer_category"] | null
          offer_id?: string
          qr_code_payload?: string | null
          redemption_code?: string
          redemption_source?: string | null
          status?: Database["public"]["Enums"]["redemption_status"]
          student_graduation_year?: number | null
          student_id?: string
          student_institution_id?: string | null
          student_institution_name?: string | null
          time_to_confirm_seconds?: number | null
          vendor_city?: string | null
          vendor_id?: string
          vendor_latitude?: number | null
          vendor_longitude?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "redemptions_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "redemptions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "redemptions_student_institution_id_fkey"
            columns: ["student_institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "redemptions_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendor_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      referrals: {
        Row: {
          created_at: string
          id: string
          referred_id: string
          referrer_id: string
          reward_granted_at: string | null
          reward_offer_id: string | null
          reward_vendor_id: string | null
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          referred_id: string
          referrer_id: string
          reward_granted_at?: string | null
          reward_offer_id?: string | null
          reward_vendor_id?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          referred_id?: string
          referrer_id?: string
          reward_granted_at?: string | null
          reward_offer_id?: string | null
          reward_vendor_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "referrals_referred_id_fkey"
            columns: ["referred_id"]
            isOneToOne: false
            referencedRelation: "student_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referrals_referrer_id_fkey"
            columns: ["referrer_id"]
            isOneToOne: false
            referencedRelation: "student_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referrals_reward_offer_id_fkey"
            columns: ["reward_offer_id"]
            isOneToOne: false
            referencedRelation: "offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referrals_reward_vendor_id_fkey"
            columns: ["reward_vendor_id"]
            isOneToOne: false
            referencedRelation: "vendor_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_offers: {
        Row: {
          id: string
          offer_id: string
          saved_at: string
          student_id: string
        }
        Insert: {
          id?: string
          offer_id: string
          saved_at?: string
          student_id: string
        }
        Update: {
          id?: string
          offer_id?: string
          saved_at?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_offers_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_offers_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      student_profiles: {
        Row: {
          birthday_bonus_claimed_year: number | null
          created_at: string
          date_of_birth: string | null
          graduation_year: number | null
          id: string
          institution_id: string | null
          institution_name_manual: string | null
          major: string | null
          referral_code: string | null
          referred_by_id: string | null
          student_email: string | null
          student_id_number: string | null
          total_offers_saved: number
          total_redemptions: number
          total_savings_usd: number
          updated_at: string
          user_id: string
          verification_document_url: string | null
          verification_expires_at: string | null
          verification_method: Database["public"]["Enums"]["verification_method"] | null
          verification_notes: string | null
          verification_status: Database["public"]["Enums"]["verification_status"]
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          birthday_bonus_claimed_year?: number | null
          created_at?: string
          date_of_birth?: string | null
          graduation_year?: number | null
          id?: string
          institution_id?: string | null
          institution_name_manual?: string | null
          major?: string | null
          referral_code?: string | null
          referred_by_id?: string | null
          student_email?: string | null
          student_id_number?: string | null
          total_offers_saved?: number
          total_redemptions?: number
          total_savings_usd?: number
          updated_at?: string
          user_id: string
          verification_document_url?: string | null
          verification_expires_at?: string | null
          verification_method?: Database["public"]["Enums"]["verification_method"] | null
          verification_notes?: string | null
          verification_status?: Database["public"]["Enums"]["verification_status"]
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          birthday_bonus_claimed_year?: number | null
          created_at?: string
          date_of_birth?: string | null
          graduation_year?: number | null
          id?: string
          institution_id?: string | null
          institution_name_manual?: string | null
          major?: string | null
          referral_code?: string | null
          referred_by_id?: string | null
          student_email?: string | null
          student_id_number?: string | null
          total_offers_saved?: number
          total_redemptions?: number
          total_savings_usd?: number
          updated_at?: string
          user_id?: string
          verification_document_url?: string | null
          verification_expires_at?: string | null
          verification_method?: Database["public"]["Enums"]["verification_method"] | null
          verification_notes?: string | null
          verification_status?: Database["public"]["Enums"]["verification_status"]
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "student_profiles_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_profiles_referred_by_id_fkey"
            columns: ["referred_by_id"]
            isOneToOne: false
            referencedRelation: "student_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_profiles_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_profiles: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          business_email: string | null
          business_hours: Json | null
          business_name: string
          business_phone: string | null
          business_type: string | null
          city: string
          country: string
          cover_image_url: string | null
          created_at: string
          description: string | null
          gallery_photos: string[] | null
          id: string
          is_verified: boolean
          latitude: number | null
          logo_url: string | null
          longitude: number | null
          plan_expires_at: string | null
          plan_started_at: string | null
          plan_status: string
          plan_tier: Database["public"]["Enums"]["vendor_plan"]
          postal_code: string | null
          rejection_notes: string | null
          slug: string | null
          staff_pins: Json | null
          state: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          total_active_offers: number
          total_lifetime_redemptions: number
          total_lifetime_views: number
          trial_ends_at: string | null
          updated_at: string
          user_id: string
          verification_document_url: string | null
          verified_at: string | null
          website_url: string | null
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          business_email?: string | null
          business_hours?: Json | null
          business_name: string
          business_phone?: string | null
          business_type?: string | null
          city: string
          country?: string
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          gallery_photos?: string[] | null
          id?: string
          is_verified?: boolean
          latitude?: number | null
          logo_url?: string | null
          longitude?: number | null
          plan_expires_at?: string | null
          plan_started_at?: string | null
          plan_status?: string
          plan_tier?: Database["public"]["Enums"]["vendor_plan"]
          postal_code?: string | null
          rejection_notes?: string | null
          slug?: string | null
          staff_pins?: Json | null
          state?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          total_active_offers?: number
          total_lifetime_redemptions?: number
          total_lifetime_views?: number
          trial_ends_at?: string | null
          updated_at?: string
          user_id: string
          verification_document_url?: string | null
          verified_at?: string | null
          website_url?: string | null
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          business_email?: string | null
          business_hours?: Json | null
          business_name?: string
          business_phone?: string | null
          business_type?: string | null
          city?: string
          country?: string
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          gallery_photos?: string[] | null
          id?: string
          is_verified?: boolean
          latitude?: number | null
          logo_url?: string | null
          longitude?: number | null
          plan_expires_at?: string | null
          plan_started_at?: string | null
          plan_status?: string
          plan_tier?: Database["public"]["Enums"]["vendor_plan"]
          postal_code?: string | null
          rejection_notes?: string | null
          slug?: string | null
          staff_pins?: Json | null
          state?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          total_active_offers?: number
          total_lifetime_redemptions?: number
          total_lifetime_views?: number
          trial_ends_at?: string | null
          updated_at?: string
          user_id?: string
          verification_document_url?: string | null
          verified_at?: string | null
          website_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vendor_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_reviews: {
        Row: {
          body: string | null
          created_at: string
          id: string
          is_visible: boolean
          rating: number
          student_id: string
          title: string | null
          vendor_id: string
          vendor_replied_at: string | null
          vendor_reply: string | null
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          is_visible?: boolean
          rating: number
          student_id: string
          title?: string | null
          vendor_id: string
          vendor_replied_at?: string | null
          vendor_reply?: string | null
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          is_visible?: boolean
          rating?: number
          student_id?: string
          title?: string | null
          vendor_id?: string
          vendor_replied_at?: string | null
          vendor_reply?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vendor_reviews_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_reviews_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendor_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      v_monthly_redemption_trend: {
        Row: {
          claimed_month: number | null
          claimed_year: number | null
          month_start: string | null
          total_claimed: number | null
          total_confirmed: number | null
          total_discounts_usd: number | null
          total_revenue_est_usd: number | null
          unique_students: number | null
          vendor_id: string | null
        }
        Relationships: []
      }
      v_redemptions_by_day_of_week: {
        Row: {
          claimed_day_of_week: number | null
          day_name: string | null
          total_claimed: number | null
          total_confirmed: number | null
          vendor_id: string | null
        }
        Relationships: []
      }
      v_redemptions_by_hour: {
        Row: {
          claimed_hour: number | null
          total_claimed: number | null
          total_confirmed: number | null
          vendor_id: string | null
        }
        Relationships: []
      }
      v_redemptions_by_institution: {
        Row: {
          student_institution_id: string | null
          student_institution_name: string | null
          total_claimed: number | null
          total_confirmed: number | null
          unique_students: number | null
          vendor_id: string | null
        }
        Relationships: []
      }
      v_vendor_performance_summary: {
        Row: {
          business_name: string | null
          city: string | null
          overall_conversion_rate_pct: number | null
          plan_tier: Database["public"]["Enums"]["vendor_plan"] | null
          total_discounts_given_usd: number | null
          total_estimated_revenue_driven_usd: number | null
          total_offers: number | null
          total_redemptions: number | null
          total_views: number | null
          vendor_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      expire_stale_redemptions: { Args: never; Returns: number }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      unaccent: { Args: { "": string }; Returns: string }
    }
    Enums: {
      discount_type: "percentage" | "fixed_amount" | "buy_x_get_y" | "free_item"
      offer_category:
        | "food_drink"
        | "groceries"
        | "tech"
        | "fashion"
        | "health_beauty"
        | "entertainment"
        | "transport"
        | "books_stationery"
        | "fitness"
        | "other"
      offer_status: "draft" | "active" | "paused" | "expired" | "depleted"
      redemption_status: "claimed" | "confirmed" | "expired" | "cancelled"
      user_role: "student" | "vendor" | "admin"
      vendor_plan: "free" | "starter" | "growth" | "pro"
      verification_method: "edu_email" | "id_upload" | "admin_override"
      verification_status:
        | "unverified"
        | "pending_email"
        | "pending_review"
        | "verified"
        | "rejected"
        | "expired"
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
      discount_type: ["percentage", "fixed_amount", "buy_x_get_y", "free_item"],
      offer_category: [
        "food_drink", "groceries", "tech", "fashion", "health_beauty",
        "entertainment", "transport", "books_stationery", "fitness", "other",
      ],
      offer_status: ["draft", "active", "paused", "expired", "depleted"],
      redemption_status: ["claimed", "confirmed", "expired", "cancelled"],
      user_role: ["student", "vendor", "admin"],
      vendor_plan: ["free", "starter", "growth", "pro"],
      verification_method: ["edu_email", "id_upload", "admin_override"],
      verification_status: [
        "unverified", "pending_email", "pending_review",
        "verified", "rejected", "expired",
      ],
    },
  },
} as const

// =============================================================================
// App-level convenience types — not generated, maintained manually
// =============================================================================

type DBTables = Database['public']['Tables']
type DBEnums  = Database['public']['Enums']

// Row shortcuts
export type Profile        = DBTables['profiles']['Row']
export type StudentProfile = DBTables['student_profiles']['Row']
export type VendorProfile  = DBTables['vendor_profiles']['Row']
export type Offer          = DBTables['offers']['Row']
export type Redemption     = DBTables['redemptions']['Row']
export type Notification   = DBTables['notifications']['Row']
export type SavedOffer     = DBTables['saved_offers']['Row']
export type VendorReview   = DBTables['vendor_reviews']['Row']

// Enum shortcuts
export type OfferCategory      = DBEnums['offer_category']
export type OfferStatus        = DBEnums['offer_status']
export type RedemptionStatus   = DBEnums['redemption_status']
export type UserRole           = DBEnums['user_role']
export type VendorPlanEnum     = DBEnums['vendor_plan']
export type VerificationStatus = DBEnums['verification_status']
export type VerificationMethod = DBEnums['verification_method']

// Offer with nested vendor (used on student dashboard / offer cards)
export interface OfferWithVendor extends Offer {
  vendor: {
    id: string
    business_name: string
    logo_url: string | null
    city: string
    address_line1: string | null
    latitude: number | null
    longitude: number | null
  }
}

// API response shape returned by POST /api/redemptions/claim
export interface ClaimOfferResponse {
  redemption_id:        string
  redemption_code:      string
  qr_code_data_url:     string | null
  expires_at:           string
  offer_title:          string
  discount_label:       string
  vendor_name:          string
  vendor_address:       string
  terms_and_conditions: string | null
}
