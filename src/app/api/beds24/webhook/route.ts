import { NextResponse } from "next/server";
import { safeEqual } from "@/lib/sign";
import { importBeds24BookingById } from "@/lib/sync";
import { rateLimit, clientIp } from "@/lib/ratelimit";

/**
 * Beds24 booking webhook. URL: https://<site>/api/beds24/webhook?key=<BEDS24_WEBHOOK_SECRET>
 * The payload is never trusted: we only take the booking id and re-read it from the Beds24 API.
 */
export async function POST(req: Request) {
  const key = new URL(req.url).searchParams.get("key") ?? "";
  const secret = process.env.BEDS24_WEBHOOK_SECRET ?? "";
  if (!secret || !safeEqual(key, secret)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!(await rateLimit("beds24-webhook", clientIp(req.headers), 300, 60))) {
    return NextResponse.json({ error: "rate" }, { status: 429 });
  }

  let id: number | undefined;
  try {
    const body = (await req.json()) as { booking?: { id?: number }; id?: number; bookId?: number };
    id = Number(body?.booking?.id ?? body?.id ?? body?.bookId);
  } catch {
    /* ignore */
  }
  if (!id || !Number.isFinite(id)) return NextResponse.json({ ok: true, skipped: "no_id" });

  try {
    const result = await importBeds24BookingById(id);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    console.error("webhook import failed", e);
    return NextResponse.json({ error: "import_failed" }, { status: 500 });
  }
}
