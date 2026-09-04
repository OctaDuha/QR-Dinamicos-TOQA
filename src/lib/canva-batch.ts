import type { SupabaseClient } from "@supabase/supabase-js";

export type BatchProgress = { total: number; done: number; failed: number };

export async function countItems(
  supabase: SupabaseClient,
  batchId: number,
): Promise<BatchProgress> {
  const countBy = async (status?: string) => {
    let query = supabase
      .from("canva_batch_items")
      .select("id", { count: "exact", head: true })
      .eq("batch_id", batchId);
    if (status) query = query.eq("status", status);
    const { count } = await query;
    return count ?? 0;
  };

  const [total, done, failed] = await Promise.all([countBy(), countBy("done"), countBy("error")]);
  return { total, done, failed };
}
