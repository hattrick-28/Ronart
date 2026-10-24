import "server-only";
import { createAdminClient } from "./supabase/admin";

export type Settings = {
  hold_minutes: number;
  full_payment_discount_pct: number;
  free_cancellation_days: number;
  phone_confirm_hours: number;
  max_active_bookings_per_contact: number;
  check_in_time: string;
  check_out_time: string;
};

export const DEFAULT_SETTINGS: Settings = {
  hold_minutes: 15,
  full_payment_discount_pct: 5,
  free_cancellation_days: 3,
  phone_confirm_hours: 24,
  max_active_bookings_per_contact: 3,
  check_in_time: "16:00",
  check_out_time: "10:00",
};

export async function getSettings(): Promise<Settings> {
  if (process.env.DEMO_DATA === "1") return DEFAULT_SETTINGS;
  try {
    const { data, error } = await createAdminClient().from("settings").select("key,value");
    if (error) throw error;
    const out = { ...DEFAULT_SETTINGS } as Record<string, unknown>;
    for (const row of data ?? []) out[row.key] = row.value;
    return out as Settings;
  } catch (e) {
    console.error("settings load failed, using defaults", e);
    return DEFAULT_SETTINGS;
  }
}
