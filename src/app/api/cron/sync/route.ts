import { NextResponse } from "next/server";
import { safeEqual } from "@/lib/sign";
import { processSyncQueue, pullRecentChanges } from "@/lib/sync";
import { runRetention } from "@/lib/retention";

/** Runs every few minutes: expires unpaid holds, pushes pending changes, pulls missed channel bookings. */
export async function GET(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  const secret = process.env.CRON_SECRET ?? "";
  if (!secret || !safeEqual(auth, `Bearer ${secret}`)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const pushed = await processSyncQueue();
  let pulled: unknown[] = [];
  try {
    pulled = await pullRecentChanges(30);
  } catch (e) {
    console.error("pull failed", e);
  }
  let retention: unknown = null;
  if (new Date().getUTCMinutes() === 7) {
    try {
      retention = await runRetention();
    } catch (e) {
      console.error("retention failed", e);
    }
  }
  return NextResponse.json({ pushed, pulled: pulled.length, retention });
}
