import ExcelJS from "exceljs";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { CHANNEL_LABEL, METHOD_LABEL, STATUS_LABEL } from "@/lib/labels";
import { todayISO } from "@/lib/format";

/** Owner-only Excel export of one month: bookings (by arrival date) and payments received. */
export async function GET(req: Request) {
  await requireStaff({ owner: true });
  const m = new URL(req.url).searchParams.get("month") ?? "";
  const month = /^\d{4}-\d{2}$/.test(m) ? m : todayISO().slice(0, 7);
  const [y, mo] = month.split("-").map(Number);
  const start = `${month}-01`;
  const end = new Date(Date.UTC(y, mo, 1)).toISOString().slice(0, 10);
  const supabase = await createClient();

  const [{ data: bookings }, { data: payments }, { data: staff }] = await Promise.all([
    supabase.from("bookings")
      .select("ref, status, channel, check_in, check_out, adults, children, total_amount, paid_amount, payment_option, created_at, units(name), guests(full_name, phone, email, country)")
      .gte("check_in", start).lt("check_in", end).order("check_in"),
    supabase.from("payments")
      .select("amount, method, status, created_at, note, received_by, bookings(ref, units(name), guests(full_name))")
      .eq("status", "succeeded").gte("created_at", `${start}T00:00:00+02:00`).lt("created_at", `${end}T00:00:00+02:00`).order("created_at"),
    supabase.from("staff").select("user_id, full_name"),
  ]);

  const wb = new ExcelJS.Workbook();
  wb.creator = "Ronart";
  wb.created = new Date();
  const header = (ws: ExcelJS.Worksheet) => {
    const r = ws.getRow(1);
    r.font = { bold: true, color: { argb: "FFFBF9F4" } };
    r.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF22362B" } };
    ws.views = [{ state: "frozen", ySplit: 1 }];
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: ws.columnCount } };
  };
  const nights = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);

  const wsB = wb.addWorksheet("Rezervimet");
  wsB.columns = [
    { header: "Nr.", key: "ref", width: 13 }, { header: "Njësia", key: "unit", width: 16 }, { header: "Mysafiri", key: "guest", width: 24 },
    { header: "Telefoni", key: "phone", width: 18 }, { header: "Email", key: "email", width: 26 }, { header: "Shteti", key: "country", width: 8 },
    { header: "Ardhja", key: "in", width: 12 }, { header: "Largimi", key: "out", width: 12 }, { header: "Netë", key: "nights", width: 7 },
    { header: "Persona", key: "people", width: 8 }, { header: "Kanali", key: "channel", width: 14 }, { header: "Statusi", key: "status", width: 14 },
    { header: "Gjithsej (€)", key: "total", width: 12 }, { header: "Paguar (€)", key: "paid", width: 12 }, { header: "Mbetur (€)", key: "due", width: 12 },
  ];
  for (const b of bookings ?? []) {
    const g = b.guests as unknown as { full_name: string; phone: string | null; email: string | null; country: string | null } | null;
    const u = b.units as unknown as { name: string } | null;
    wsB.addRow({
      ref: b.ref, unit: u?.name, guest: g?.full_name, phone: g?.phone, email: g?.email, country: g?.country,
      in: new Date(b.check_in), out: new Date(b.check_out), nights: nights(b.check_in, b.check_out), people: b.adults + b.children,
      channel: CHANNEL_LABEL[b.channel], status: STATUS_LABEL[b.status],
      total: Number(b.total_amount), paid: Number(b.paid_amount), due: Math.max(0, Number(b.total_amount) - Number(b.paid_amount)),
    });
  }
  header(wsB);
  ["in", "out"].forEach((k) => (wsB.getColumn(k).numFmt = "dd.mm.yyyy"));
  ["total", "paid", "due"].forEach((k) => (wsB.getColumn(k).numFmt = "#,##0.00"));

  const wsP = wb.addWorksheet("Pagesat");
  wsP.columns = [
    { header: "Data", key: "date", width: 18 }, { header: "Rezervimi", key: "ref", width: 13 }, { header: "Njësia", key: "unit", width: 16 },
    { header: "Mysafiri", key: "guest", width: 24 }, { header: "Mënyra", key: "method", width: 20 }, { header: "Shuma (€)", key: "amount", width: 12 },
    { header: "Pranuar nga", key: "staff", width: 18 }, { header: "Shënim", key: "note", width: 28 },
  ];
  for (const p of payments ?? []) {
    const b = p.bookings as unknown as { ref: string; units: { name: string } | null; guests: { full_name: string } | null } | null;
    wsP.addRow({
      date: new Date(p.created_at), ref: b?.ref, unit: b?.units?.name, guest: b?.guests?.full_name, method: METHOD_LABEL[p.method],
      amount: Number(p.amount), staff: staff?.find((s) => s.user_id === p.received_by)?.full_name ?? (p.method === "card_online" ? "Online" : ""), note: p.note,
    });
  }
  header(wsP);
  wsP.getColumn("date").numFmt = "dd.mm.yyyy hh:mm";
  wsP.getColumn("amount").numFmt = "#,##0.00";

  const wsS = wb.addWorksheet("Përmbledhje");
  wsS.columns = [{ header: "Kanali", key: "k", width: 18 }, { header: "Rezervime", key: "n", width: 12 }, { header: "Vlera (€)", key: "v", width: 14 }];
  const active = (bookings ?? []).filter((b) => ["confirmed", "checked_in", "checked_out"].includes(b.status));
  const byCh = new Map<string, { n: number; v: number }>();
  for (const b of active) { const c = byCh.get(b.channel) ?? { n: 0, v: 0 }; c.n++; c.v += Number(b.total_amount); byCh.set(b.channel, c); }
  for (const [k, v] of byCh) wsS.addRow({ k: CHANNEL_LABEL[k], n: v.n, v: v.v });
  wsS.addRow({});
  const methods = new Map<string, number>();
  for (const p of payments ?? []) methods.set(p.method, (methods.get(p.method) ?? 0) + Number(p.amount));
  wsS.addRow({ k: "Pagesat e marra" }).font = { bold: true };
  for (const [k, v] of methods) wsS.addRow({ k: METHOD_LABEL[k], v });
  header(wsS);
  wsS.getColumn("v").numFmt = "#,##0.00";

  const buf = await wb.xlsx.writeBuffer();
  return new Response(buf as ArrayBuffer, {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="ronart-${month}.xlsx"`,
      "cache-control": "no-store",
    },
  });
}
