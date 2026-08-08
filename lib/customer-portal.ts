import { createClient } from "@supabase/supabase-js";

export type CustomerPortalItem = {
  id: string;
  item_type: string;
  description: string;
  part_number: string | null;
  part_condition: string | null;
  quantity: number;
  unit_price: number;
  taxable: boolean;
  extended: number;
};

export type CustomerPortalJob = {
  id: string;
  line_number: number;
  title: string;
  customer_concern: string;
  technician_findings: string | null;
  recommended_action: string | null;
  correction_performed: string | null;
  authorization_status: string;
  authorized_at: string | null;
  deferred_reason: string | null;
  amount: number;
  items: CustomerPortalItem[];
};

export type CustomerPortalPayload = {
  portal: {
    token: string;
    expires_at: string | null;
    created_at: string;
  };
  repair_order: {
    id: string;
    ro_number: string;
    status: string;
    original_complaint: string;
    opened_at: string;
    promised_at: string | null;
    completed_at: string | null;
    odometer_in: number | null;
    odometer_out: number | null;
    tax_rate: number;
    shop_supplies_amount: number;
    discount_amount: number;
  };
  customer: {
    full_name: string;
    phone: string;
    email: string | null;
    company_name: string | null;
  };
  vehicle: {
    year: number | null;
    make: string;
    model: string;
    vin: string | null;
    mileage: number | null;
    license_plate: string | null;
    unit_number: string | null;
  };
  jobs: CustomerPortalJob[];
  estimate: null | {
    id: string;
    estimate_number: string;
    version: number;
    status: string;
    subtotal: number;
    tax_amount: number;
    total: number;
    valid_until: string | null;
    customer_note: string | null;
    sent_at: string | null;
    authorized_at: string | null;
    created_at: string;
  };
  invoice: null | {
    id: string;
    invoice_number: string;
    status: string;
    subtotal: number;
    tax_amount: number;
    total: number;
    amount_paid: number;
    balance_due: number;
    issued_at: string | null;
    due_at: string | null;
    payment_provider: string | null;
    hosted_payment_url: string | null;
    customer_note: string | null;
  };
  payments: Array<{
    amount: number;
    method: string;
    status: string;
    provider: string | null;
    received_at: string;
  }>;
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isPortalToken(value: string) {
  return uuidPattern.test(value);
}

export function createPublicSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

export async function loadCustomerPortal(token: string): Promise<CustomerPortalPayload | null> {
  if (!isPortalToken(token)) return null;
  const supabase = createPublicSupabaseClient();
  if (!supabase) return null;

  const { data, error } = await supabase.rpc("get_customer_portal", { p_token: token });
  if (error || !data) {
    if (error) console.error("customer portal load failed", error.message);
    return null;
  }

  return data as CustomerPortalPayload;
}

export function money(value: number | null | undefined) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Number(value || 0));
}

export function titleCase(value: string | null | undefined) {
  return String(value || "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
