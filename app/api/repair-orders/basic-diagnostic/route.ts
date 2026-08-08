import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/auth/owner";

const DESCRIPTION = "Basic diagnostic";

function refreshRepairOrder(id: string) {
  revalidatePath("/admin/repair-orders");
  revalidatePath(`/admin/repair-orders/${id}`);
  revalidatePath("/tech");
  revalidatePath(`/tech/repair-orders/${id}`);
}

async function getState(repairOrderId: string) {
  const { supabase } = await requireOwner();
  const { data: ro, error: roError } = await supabase
    .from("repair_orders")
    .select("id,labor_rate,original_complaint")
    .eq("id", repairOrderId)
    .maybeSingle();

  if (roError || !ro) return null;

  const { data: jobs } = await supabase
    .from("ro_jobs")
    .select("id,line_number")
    .eq("repair_order_id", repairOrderId)
    .order("line_number");

  const jobIds = (jobs || []).map((job) => job.id);
  let added = false;

  if (jobIds.length) {
    const { data: existing } = await supabase
      .from("ro_items")
      .select("id")
      .in("ro_job_id", jobIds)
      .eq("item_type", "labor")
      .eq("description", DESCRIPTION)
      .limit(1)
      .maybeSingle();
    added = Boolean(existing);
  }

  return {
    supabase,
    ro,
    jobs: jobs || [],
    added,
    rate: Number(ro.labor_rate ?? 100),
  };
}

export async function GET(request: NextRequest) {
  const repairOrderId = request.nextUrl.searchParams.get("repairOrderId")?.trim();
  if (!repairOrderId) return NextResponse.json({ error: "Missing repair order." }, { status: 400 });

  const state = await getState(repairOrderId);
  if (!state) return NextResponse.json({ error: "Repair order not found." }, { status: 404 });

  return NextResponse.json({ rate: state.rate, added: state.added });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const repairOrderId = String(body?.repairOrderId || "").trim();
  if (!repairOrderId) return NextResponse.json({ error: "Missing repair order." }, { status: 400 });

  const state = await getState(repairOrderId);
  if (!state) return NextResponse.json({ error: "Repair order not found." }, { status: 404 });
  if (state.added) return NextResponse.json({ rate: state.rate, added: true });

  let jobId = state.jobs[0]?.id as string | undefined;
  if (!jobId) {
    const { data: job, error: jobError } = await state.supabase
      .from("ro_jobs")
      .insert({
        repair_order_id: repairOrderId,
        line_number: 1,
        title: "Diagnostic",
        customer_concern: state.ro.original_complaint || "",
        sort_order: 1,
      })
      .select("id")
      .single();

    if (jobError || !job) {
      console.error("basic diagnostic line creation failed", jobError?.message);
      return NextResponse.json({ error: "Could not create diagnostic line." }, { status: 500 });
    }
    jobId = job.id;
  }

  const { error } = await state.supabase.from("ro_items").insert({
    ro_job_id: jobId,
    item_type: "labor",
    description: DESCRIPTION,
    quantity: 1,
    unit_price: state.rate,
    taxable: true,
  });

  if (error) {
    console.error("basic diagnostic charge creation failed", error.message);
    return NextResponse.json({ error: "Could not add diagnostic charge." }, { status: 500 });
  }

  refreshRepairOrder(repairOrderId);
  return NextResponse.json({ rate: state.rate, added: true });
}
