// =============================================================================
// database.types.ts
// TypeScript interfaces generated from the PostgreSQL schema.
// In production, run: `supabase gen types typescript --project-id <ref> > lib/types/database.types.ts`
// These types are used throughout the app for type-safe Supabase queries.
// =============================================================================

// ---------------------------------------------------------------------------
// ENUM TYPES
// ---------------------------------------------------------------------------

export type UserRole = 'student' | 'vendor' | 'admin';

export type VerificationStatus =
  | 'unverified'
  | 'pending_email'
  | 'pending_review'
  | 'verified'
  | 'rejected'
  | 'expired';

export type VerificationMethod = 'edu_email' | 'id_upload' | 'admin_override';

export type OfferStatus = 'draft' | 'active' | 'paused' | 'expired' | 'depleted';

export type DiscountType = 'percentage' | 'fixed_amount' | 'buy_x_get_y' | 'free_item';

export type OfferCategory =
  | 'food_drink'
  | 'groceries'
  | 'tech'
  | 'fashion'
  | 'health_beauty'
  | 'entertainment'
  | 'transport'
  | 'books_stationery'
  | 'fitness'
  | 'other';

export type RedemptionStatus = 'claimed' | 'confirmed' | 'expired' | 'cancelled';

export type VendorPlan = 'free' | 'starter' | 'growth';

// ---------------------------------------------------------------------------
// TABLE INTERFACES (mirror the SQL schema)
// ---------------------------------------------------------------------------

export interface Institution {
  id: string;
  name: string;
  short_name: string | null;
  abbreviation: string | null;
  country: string;
  state: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  email_domains: string[];           // e.g., ['umich.edu', 'student.umich.edu']
  logo_url: string | null;
  website_url: string | null;
  estimated_student_count: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;                        // Matches auth.users.id
  role: UserRole;
  first_name: string | null;
  last_name: string | null;
  display_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
  country: string;
  is_active: boolean;
  last_seen_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface StudentProfile {
  id: string;
  user_id: string;
  institution_id: string | null;
  institution_name_manual: string | null;
  student_email: string | null;
  student_id_number: string | null;
  graduation_year: number | null;
  major: string | null;
  verification_status: VerificationStatus;
  verification_method: VerificationMethod | null;
  verification_document_url: string | null;
  verification_notes: string | null;
  verified_at: string | null;
  verified_by: string | null;
  verification_expires_at: string | null;
  total_savings_usd: number;
  total_redemptions: number;
  total_offers_saved: number;
  created_at: string;
  updated_at: string;
}

export interface VendorProfile {
  id: string;
  user_id: string;
  business_name: string;
  business_type: string | null;
  description: string | null;
  logo_url: string | null;
  cover_image_url: string | null;
  website_url: string | null;
  business_phone: string | null;
  business_email: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string;
  state: string | null;
  postal_code: string | null;
  country: string;
  latitude: number | null;
  longitude: number | null;
  is_verified: boolean;
  verification_document_url: string | null;
  verified_at: string | null;
  plan_tier: VendorPlan;
  plan_started_at: string | null;
  plan_expires_at: string | null;
  total_active_offers: number;
  total_lifetime_redemptions: number;
  total_lifetime_views: number;
  created_at: string;
  updated_at: string;
}

export interface Offer {
  id: string;
  vendor_id: string;
  title: string;
  description: string | null;
  discount_label: string;
  terms_and_conditions: string | null;
  image_url: string | null;
  tags: string[] | null;
  category: OfferCategory;
  discount_type: DiscountType;
  discount_value: number | null;
  original_price: number | null;
  min_purchase_amount: number | null;
  max_uses_per_student: number;
  max_total_redemptions: number | null;
  target_institution_ids: string[] | null;
  status: OfferStatus;
  starts_at: string;
  expires_at: string | null;
  view_count: number;
  redemption_count: number;
  save_count: number;
  created_at: string;
  updated_at: string;
}

export interface OfferView {
  id: string;
  offer_id: string;
  student_id: string | null;
  vendor_id: string;
  source: string | null;
  viewed_at: string;
}

export interface Redemption {
  id: string;
  offer_id: string;
  student_id: string;
  vendor_id: string;
  redemption_code: string;
  qr_code_payload: string | null;
  status: RedemptionStatus;
  claimed_at: string;
  confirmed_at: string | null;
  expires_at: string;
  cancelled_at: string | null;
  confirmed_by_vendor_user_id: string | null;
  discount_value_applied: number | null;
  estimated_transaction_value: number | null;
  student_institution_id: string | null;
  student_institution_name: string | null;
  student_graduation_year: number | null;
  vendor_city: string | null;
  vendor_latitude: number | null;
  vendor_longitude: number | null;
  // Generated/computed columns (read-only)
  claimed_date: string;
  claimed_hour: number;
  claimed_day_of_week: number;
  claimed_week: number;
  claimed_month: number;
  claimed_year: number;
  time_to_confirm_seconds: number | null;
  device_type: string | null;
  redemption_source: string | null;
  offer_category: OfferCategory | null;
  created_at: string;
}

export interface SavedOffer {
  id: string;
  student_id: string;
  offer_id: string;
  saved_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  body: string | null;
  type: string;
  related_entity_type: string | null;
  related_entity_id: string | null;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
}

// ---------------------------------------------------------------------------
// ENRICHED / JOIN TYPES (used in UI components)
// ---------------------------------------------------------------------------

/** Offer with vendor info joined — used in student offer cards */
export interface OfferWithVendor extends Offer {
  vendor: Pick<VendorProfile, 'id' | 'business_name' | 'logo_url' | 'city' | 'address_line1'>;
}

/** Redemption with offer + vendor + institution joined — used in student voucher list */
export interface RedemptionWithDetails extends Redemption {
  offer: Pick<Offer, 'id' | 'title' | 'discount_label' | 'image_url' | 'category'>;
  vendor: Pick<VendorProfile, 'id' | 'business_name' | 'logo_url' | 'address_line1' | 'city'>;
}

/** Student profile with auth profile merged — used throughout student dashboard */
export interface StudentUser {
  profile: Profile;
  studentProfile: StudentProfile;
  institution: Institution | null;
}

/** Vendor profile with auth profile merged — used throughout vendor dashboard */
export interface VendorUser {
  profile: Profile;
  vendorProfile: VendorProfile;
}

// ---------------------------------------------------------------------------
// API REQUEST / RESPONSE TYPES
// ---------------------------------------------------------------------------

export interface ClaimOfferRequest {
  offer_id: string;
  device_type?: 'mobile' | 'tablet' | 'desktop';
}

export interface ClaimOfferResponse {
  success: boolean;
  redemption_id: string;
  redemption_code: string;        // e.g., "STUD-X7K2-M3P9"
  qr_code_data_url: string;       // base64 PNG for display
  expires_at: string;             // ISO timestamp — show countdown to student
  offer: Pick<Offer, 'id' | 'title' | 'discount_label' | 'terms_and_conditions'>;
  vendor: Pick<VendorProfile, 'business_name' | 'address_line1' | 'city'>;
}

export interface ConfirmRedemptionRequest {
  redemption_code: string;        // Vendor enters this after scanning QR
}

export interface ConfirmRedemptionResponse {
  success: boolean;
  redemption_id: string;
  student_display_name: string;   // e.g., "Emmanuel A." — show on vendor screen
  offer_title: string;
  discount_label: string;
  confirmed_at: string;
  message: string;                // e.g., "Voucher accepted! ✓"
}

export interface VerifyEduEmailRequest {
  email: string;
}

export interface VerifyEduEmailResponse {
  is_valid_edu_email: boolean;
  institution: Pick<Institution, 'id' | 'name' | 'short_name' | 'logo_url'> | null;
  message: string;
}

// ---------------------------------------------------------------------------
// SUPABASE DATABASE TYPE (used with createClient<Database>())
// ---------------------------------------------------------------------------

export type Database = {
  public: {
    Tables: {
      institutions:    { Row: Institution;    Insert: Partial<Institution>;    Update: Partial<Institution>    };
      profiles:        { Row: Profile;        Insert: Partial<Profile>;        Update: Partial<Profile>        };
      student_profiles:{ Row: StudentProfile; Insert: Partial<StudentProfile>; Update: Partial<StudentProfile> };
      vendor_profiles: { Row: VendorProfile;  Insert: Partial<VendorProfile>;  Update: Partial<VendorProfile>  };
      offers:          { Row: Offer;          Insert: Partial<Offer>;          Update: Partial<Offer>          };
      offer_views:     { Row: OfferView;      Insert: Partial<OfferView>;      Update: Partial<OfferView>      };
      redemptions:     { Row: Redemption;     Insert: Partial<Redemption>;     Update: Partial<Redemption>     };
      saved_offers:    { Row: SavedOffer;     Insert: Partial<SavedOffer>;     Update: Partial<SavedOffer>     };
      notifications:   { Row: Notification;  Insert: Partial<Notification>;   Update: Partial<Notification>   };
    };
    Views: {
      v_vendor_performance_summary:   { Row: Record<string, unknown> };
      v_redemptions_by_day_of_week:   { Row: Record<string, unknown> };
      v_redemptions_by_hour:          { Row: Record<string, unknown> };
      v_monthly_redemption_trend:     { Row: Record<string, unknown> };
      v_redemptions_by_institution:   { Row: Record<string, unknown> };
    };
    Enums: {
      user_role:            UserRole;
      verification_status:  VerificationStatus;
      verification_method:  VerificationMethod;
      offer_status:         OfferStatus;
      discount_type:        DiscountType;
      offer_category:       OfferCategory;
      redemption_status:    RedemptionStatus;
      vendor_plan:          VendorPlan;
    };
  };
};
