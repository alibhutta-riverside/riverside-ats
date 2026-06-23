// Supabase Edge Function: daily-reminders
// Runs once a day (schedule via Supabase Cron / pg_cron, see README).
// 1. Finds interactions whose next_followup_date is today or overdue.
// 2. Creates an in-app alert for the assigned team member.
// 3. Sends them an internal email reminder via Resend.
// 4. Sends any scheduled campaigns whose scheduled_at has arrived.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const FROM_EMAIL = Deno.env.get("REMINDER_FROM_EMAIL") ?? "alerts@riversideenterprises.com";

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

async function sendEmail(to: string, subject: string, html: string) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: FROM_EMAIL, to, subject, html }),
  });
  if (!res.ok) {
    console.error("Resend error:", await res.text());
  }
  return res.ok;
}

Deno.serve(async (_req) => {
  const today = new Date().toISOString().slice(0, 10);
  const results = { followups_processed: 0, campaigns_sent: 0, errors: [] as string[] };

  // ---------- 1. Follow-ups due today or overdue ----------
  const { data: dueInteractions, error: dueErr } = await supabase
    .from("interactions")
    .select("id, next_followup_date, next_followup_notes, client_id, team_member_id, clients(company_name, contact_person), team_members(full_name, email)")
    .lte("next_followup_date", today)
    .not("next_followup_date", "is", null);

  if (dueErr) results.errors.push(dueErr.message);

  for (const item of dueInteractions ?? []) {
    const client = item.clients as any;
    const member = item.team_members as any;
    const isOverdue = item.next_followup_date < today;

    // Create in-app alert
    await supabase.from("alerts").insert({
      team_member_id: item.team_member_id,
      client_id: item.client_id,
      alert_type: isOverdue ? "followup_overdue" : "followup_due",
      message: `${isOverdue ? "OVERDUE" : "Due today"}: follow up with ${client?.company_name ?? "client"} (${client?.contact_person ?? ""}). ${item.next_followup_notes ?? ""}`,
    });

    // Email the assigned team member (not the client)
    if (member?.email) {
      await sendEmail(
        member.email,
        `${isOverdue ? "[OVERDUE] " : ""}Follow-up reminder: ${client?.company_name ?? "Client"}`,
        `<p>Hi ${member.full_name},</p>
         <p>You have a follow-up ${isOverdue ? "<b>overdue</b>" : "due today"} with <b>${client?.company_name}</b> (${client?.contact_person ?? "N/A"}).</p>
         <p>Notes: ${item.next_followup_notes ?? "—"}</p>
         <p>Please log the outcome in the CRM once contacted.</p>`
      );
    }
    results.followups_processed++;
  }

  // ---------- 2. Scheduled campaigns ready to go out ----------
  const { data: campaigns, error: campErr } = await supabase
    .from("campaigns")
    .select("*")
    .eq("status", "scheduled")
    .lte("scheduled_at", new Date().toISOString());

  if (campErr) results.errors.push(campErr.message);

  for (const campaign of campaigns ?? []) {
    let clientQuery = supabase.from("clients").select("id, email, company_name, contact_person");
    if (campaign.target_client_type !== "all") {
      clientQuery = clientQuery.eq("client_type", campaign.target_client_type);
    }
    if (campaign.target_sector) {
      clientQuery = clientQuery.eq("sector", campaign.target_sector);
    }
    const { data: targets } = await clientQuery;

    for (const client of targets ?? []) {
      if (!client.email) continue;
      const personalizedHtml = (campaign.body_html ?? "")
        .replaceAll("{{contact_person}}", client.contact_person ?? "")
        .replaceAll("{{company_name}}", client.company_name ?? "");

      const sent = await sendEmail(client.email, campaign.subject ?? "Riverside Enterprises", personalizedHtml);

      await supabase.from("campaign_recipients").upsert({
        campaign_id: campaign.id,
        client_id: client.id,
        status: sent ? "sent" : "failed",
        sent_at: new Date().toISOString(),
      });
    }

    await supabase.from("campaigns").update({ status: "sent" }).eq("id", campaign.id);
    results.campaigns_sent++;
  }

  return new Response(JSON.stringify(results), {
    headers: { "Content-Type": "application/json" },
  });
});
