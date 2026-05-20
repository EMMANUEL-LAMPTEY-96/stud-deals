export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
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
          country?: string | null
          created_at?: string | null
          email_domains?: string[] | null
          estimated_student_count?: number | null
          id?: string | null
          is_active?: boolean | null
          latitude?: number | null
          logo_url?: string | null
          longitude?: number | null
          name?: string | null
          short_name?: string | null
          state?: string | null
          updated_at?: string | null
          website_url?: string | null
        }
        Update: {
          abbreviation?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          email_domains?: string[] | null
          estimated_student_count?: number | null
          id?: string | null
          is_active?: boolean | null
          latitude?: number | null
          logo_url?: string | null
          longitude?: number | null
          name?: string | null
          short_name?: string | null
          state?: string | null
          updated_at?: string | null
          website_url?: string | null
        }
        Relationships: []
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
          created_at?: string | null
          id?: string | null
          is_read?: boolean | null
          read_at?: string | null
          related_entity_id?: string | null
          related_entity_type?: string | null
          title?: string | null
          type?: string | null
          user_id?: string | null
        }
        Update: {
          body?: string | null
          created_at?: string | null
          id?: string | null
          is_read?: boolean | null
          read_at?: string | null
          related_entity_id?: string | null
          related_entity_type?: string | null
          title?: string | null
          type?: string | null
          user_id?: string | null
        }
        Relationships: []
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
          id?: string | null
          offer_id?: string | null
          source?: string | null
          student_id?: string | null
          vendor_id?: string | null
          viewed_at?: string | null
        }
        Update: {
          id?: string | null
          offer_id?: string | null
          source?: string | null
          student_id?: string | null
          vendor_id?: string | null
          viewed_at?: string | null
        }
        Relationships: []
      }
      offers: {
        Row: {
          category: string
          created_at: string
          description: string | null
          discount_label: string
          discount_type: string
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
          status: string
          tags: string[] | null
          target_institution_ids: string[] | null
          terms_and_conditions: string | null
          title: string
          updated_at: string
          vendor_id: string
          view_count: number
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          discount_label?: string | null
          discount_type?: string | null
          discount_value?: number | null
          expires_at?: string | null
          id?: string | null
          image_url?: string | null
          max_total_redemptions?: number | null
          max_uses_per_student?: number | null
          min_purchase_amount?: number | null
          original_price?: number | null
          redemption_count?: number | null
          save_count?: number | null
          starts_at?: string | null
          status?: string | null
          tags?: string[] | null
          target_institution_ids?: string[] | null
          terms_and_conditions?: string | null
          title?: string | null
          updated_at?: string | null
          vendor_id?: string | null
          view_count?: number | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          discount_label?: string | null
          discount_type?: string | null
          discount_value?: number | null
          expires_at?: string | null
          id?: string | null
          image_url?: string | null
          max_total_redemptions?: number | null
          max_uses_per_student?: number | null
          min_purchase_amount?: number | null
          original_price?: number | null
          redemption_count?: number | null
          save_count?: number | null
          starts_at?: string | null
          status?: string | null
          tags?: string[] | null
          target_institution_ids?: string[] | null
          terms_and_conditions?: string | null
          title?: string | null
          updated_at?: string | null
          vendor_id?: string | null
          view_count?: number | null
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
          role: string
          state: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          display_name?: string | null
          first_name?: string | null
          id?: string | null
          is_active?: boolean | null
          last_name?: string | null
          last_seen_at?: string | null
          phone?: string | null
          role?: string | null
          state?: string | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          display_name?: string | null
          first_name?: string | null
          id?: string | null
          is_active?: boolean | null
          last_name?: string | null
          last_seen_at?: string | null
          phone?: string | null
          role?: string | null
          state?: string | null
          updated_at?: string | null
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
          offer_category: string | null
          offer_id: string
          qr_code_payload: string | null
          redemption_code: string
          redemption_source: string | null
          status: string
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
          claimed_at?: string | null
          claimed_date?: string | null
          claimed_day_of_week?: number | null
          claimed_hour?: number | null
          claimed_month?: number | null
          claimed_week?: number | null
          claimed_year?: number | null
          confirmed_at?: string | null
          confirmed_by_vendor_user_id?: string | null
          created_at?: string | null
          device_type?: string | null
          discount_value_applied?: number | null
          estimated_transaction_value?: number | null
          expires_at?: string | null
          id?: string | null
          offer_category?: string | null
          offer_id?: string | null
          qr_code_payload?: string | null
          redemption_code?: string | null
          redemption_source?: string | null
          status?: string | null
          student_graduation_year?: number | null
          student_id?: string | null
          student_institution_id?: string | null
          student_institution_name?: string | null
          time_to_confirm_seconds?: number | null
          vendor_city?: string | null
          vendor_id?: string | null
          vendor_latitude?: number | null
          vendor_longitude?: number | null
        }
        Update: {
          cancelled_at?: string | null
          claimed_at?: string | null
          claimed_date?: string | null
          claimed_day_of_week?: number | null
          claimed_hour?: number | null
          claimed_month?: number | null
          claimed_week?: number | null
          claimed_year?: number | null
          confirmed_at?: string | null
          confirmed_by_vendor_user_id?: string | null
          created_at?: string | null
          device_type?: string | null
          discount_value_applied?: number | null
          estimated_transaction_value?: number | null
          expires_at?: string | null
          id?: string | null
          offer_category?: string | null
          offer_id?: string | null
          qr_code_payload?: string | null
          redemption_code?: string | null
          redemption_source?: string | null
          status?: string | null
          student_graduation_year?: number | null
          student_id?: string | null
          student_institution_id?: string | null
          student_institution_name?: string | null
          time_to_confirm_seconds?: number | null
          vendor_city?: string | null
          vendor_id?: string | null
          vendor_latitude?: number | null
          vendor_longitude?: number | null
        }
        Relationships: []
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
          created_at?: string | null
          id?: string | null
          referred_id?: string | null
          referrer_id?: string | null
          reward_granted_at?: string | null
          reward_offer_id?: string | null
          reward_vendor_id?: string | null
          status?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string | null
          referred_id?: string | null
          referrer_id?: string | null
          reward_granted_at?: string | null
          reward_offer_id?: string | null
          reward_vendor_id?: string | null
          status?: string | null
        }
        Relationships: []
      }
      saved_offers: {
        Row: {
          id: string
          offer_id: string
          saved_at: string
          student_id: string
        }
        Insert: {
          id?: string | null
          offer_id?: string | null
          saved_at?: string | null
          student_id?: string | null
        }
        Update: {
          id?: string | null
          offer_id?: string | null
          saved_at?: string | null
          student_id?: string | null
        }
        Relationships: []
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
          consent_updated_at: string | null
          share_with_vendors: boolean
          total_savings_usd: number
          updated_at: string
          user_id: string
          verification_document_url: string | null
          verification_expires_at: string | null
          verification_method: string | null
          verification_notes: string | null
          verification_status: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          birthday_bonus_claimed_year?: number | null
          created_at?: string | null
          date_of_birth?: string | null
          graduation_year?: number | null
          id?: string | null
          institution_id?: string | null
          institution_name_manual?: string | null
          major?: string | null
          referral_code?: string | null
          referred_by_id?: string | null
          student_email?: string | null
          student_id_number?: string | null
          consent_updated_at?: string | null
          share_with_vendors?: boolean | null
          total_offers_saved?: number | null
          total_redemptions?: number | null
          total_savings_usd?: number | null
          updated_at?: string | null
          user_id?: string | null
          verification_document_url?: string | null
          verification_expires_at?: string | null
          verification_method?: string | null
          verification_notes?: string | null
          verification_status?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          birthday_bonus_claimed_year?: number | null
          consent_updated_at?: string | null
          created_at?: string | null
          date_of_birth?: string | null
          graduation_year?: number | null
          id?: string | null
          institution_id?: string | null
          institution_name_manual?: string | null
          major?: string | null
          referral_code?: string | null
          referred_by_id?: string | null
          share_with_vendors?: boolean | null
          student_email?: string | null
          student_id_number?: string | null
          total_offers_saved?: number | null
          total_redemptions?: number | null
          total_savings_usd?: number | null
          updated_at?: string | null
          user_id?: string | null
          verification_document_url?: string | null
          verification_expires_at?: string | null
          verification_method?: string | null
          verification_notes?: string | null
          verification_status?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: []
      }
      vendor_profiles: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          business_email: string | null
          business_hours: string | null
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
          plan_tier: string
          rejection_notes: string | null
          postal_code: string | null
          staff_pins: string | null
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
          business_hours?: string | null
          business_name?: string | null
          business_phone?: string | null
          business_type?: string | null
          city?: string | null
          country?: string | null
          cover_image_url?: string | null
          created_at?: string | null
          description?: string | null
          gallery_photos?: string[] | null
          id?: string | null
          is_verified?: boolean | null
          latitude?: number | null
          logo_url?: string | null
          longitude?: number | null
          plan_expires_at?: string | null
          plan_started_at?: string | null
          plan_status?: string | null
          plan_tier?: string | null
          postal_code?: string | null
          rejection_notes?: string | null
          staff_pins?: string | null
          state?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          total_active_offers?: number | null
          total_lifetime_redemptions?: number | null
          total_lifetime_views?: number | null
          trial_ends_at?: string | null
          updated_at?: string | null
          user_id?: string | null
          verification_document_url?: string | null
          verified_at?: string | null
          website_url?: string | null
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          business_email?: string | null
          business_hours?: string | null
          business_name?: string | null
          business_phone?: string | null
          business_type?: string | null
          city?: string | null
          country?: string | null
          cover_image_url?: string | null
          created_at?: string | null
          description?: string | null
          gallery_photos?: string[] | null
          id?: string | null
          is_verified?: boolean | null
          latitude?: number | null
          logo_url?: string | null
          longitude?: number | null
          plan_expires_at?: string | null
          plan_started_at?: string | null
          plan_status?: string | null
          plan_tier?: string | null
          postal_code?: string | null
          rejection_notes?: string | null
          staff_pins?: string | null
          state?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          total_active_offers?: number | null
          total_lifetime_redemptions?: number | null
          total_lifetime_views?: number | null
          trial_ends_at?: string | null
          updated_at?: string | null
          user_id?: string | null
          verification_document_url?: string | null
          verified_at?: string | null
          website_url?: string | null
        }
        Relationships: []
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
          created_at?: string | null
          id?: string | null
          is_visible?: boolean | null
          rating?: number | null
          student_id?: string | null
          title?: string | null
          vendor_id?: string | null
          vendor_replied_at?: string | null
          vendor_reply?: string | null
        }
        Update: {
          body?: string | null
          created_at?: string | null
          id?: string | null
          is_visible?: boolean | null
          rating?: number | null
          student_id?: string | null
          title?: string | null
          vendor_id?: string | null
          vendor_replied_at?: string | null
          vendor_reply?: string | null
        }
        Relationships: []
      }
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
          action?: string | null
          admin_id?: string | null
          created_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string | null
          metadata?: Json | null
        }
        Update: {
          action?: string | null
          admin_id?: string | null
          created_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string | null
          metadata?: Json | null
        }
        Relationships: []
      }
      platform_config: {
        Row: {
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          key?: string | null
          updated_at?: string | null
          updated_by?: string | null
          value?: Json | null
        }
        Update: {
          key?: string | null
          updated_at?: string | null
          updated_by?: string | null
          value?: Json | null
        }
        Relationships: []
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
          plan_tier: string | null
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
    Functions: {}
    Enums: {}
    CompositeTypes: {}
  }
}

// Convenience type helpers
export type Tables<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Row"]
export type TablesInsert<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Insert"]
export type TablesUpdate<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Update"]
export type Enums<T extends keyof Database["public"]["Enums"]> = Database["public"]["Enums"][T]

// =============================================================================
// Convenience row aliases — map to the generated Database table row types.
// These are the types imported throughout the app for Supabase query results.
// =============================================================================

export type Profile        = Tables<'profiles'>
export type StudentProfile = Tables<'student_profiles'>
export type VendorProfile  = Tables<'vendor_profiles'>
export type Offer          = Tables<'offers'>
export type Redemption     = Tables<'redemptions'>
export type Institution    = Tables<'institutions'>

// =============================================================================
// Domain string-union types — narrower than `string` for offer/discount fields.
// =============================================================================

export type OfferCategory =
  | 'food_drink'
  | 'groceries'
  | 'tech'
  | 'books_stationery'
  | 'fitness'
  | 'fashion'
  | 'entertainment'
  | 'health_beauty'
  | 'transport'
  | 'services'
  | 'other'

export type DiscountType =
  | 'percentage'
  | 'fixed_amount'
  | 'buy_x_get_y'
  | 'free_item'
  | 'loyalty_stamp'

export type VerificationStatus =
  | 'unverified'
  | 'pending_email'
  | 'pending_review'
  | 'verified'
  | 'rejected'
  | 'expired'

export type VerificationMethod = 'edu_email' | 'id_upload'

// =============================================================================
// Extended offer type that includes the joined vendor_profiles row.
// Used by the student browse feed and OfferCard component.
// =============================================================================

export type OfferWithVendor = Offer & {
  vendor: {
    id: string
    business_name: string
    logo_url: string | null
    city: string | null
    address_line1: string | null
    latitude: number | null
    longitude: number | null
  }
}

// =============================================================================
// API request / response shapes for typed route handlers.
// =============================================================================

export type ClaimOfferRequest = {
  offer_id: string
  device_type?: 'mobile' | 'tablet' | 'desktop'
}

export type ConfirmRedemptionRequest = {
  redemption_code: string
}

export type ConfirmRedemptionResponse = {
  success: boolean
  student_name: string | null
  offer_title: string
  discount_label: string
}

export type VerifyEduEmailRequest = {
  email: string
}

export type VerifyEduEmailResponse = {
  success: boolean
  method: VerificationMethod | null
  message: string
  institution?: string | null
}

// Response shape returned by POST /api/redemptions/claim
export type ClaimOfferResponse = {
  success: boolean
  redemption_id: string
  redemption_code: string
  expires_at: string
  qr_code_data_url: string | null
  offer: {
    id: string
    title: string
    discount_label: string
    terms_and_conditions: string | null
  }
  vendor: {
    business_name: string
    address_line1: string | null
    city: string | null
  }
}