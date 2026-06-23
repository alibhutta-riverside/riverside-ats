# Riverside CRM / Sales Follow-Up Module

Built to sit inside your existing Riverside ATS (same Supabase project, same Vercel deploy). It adds: client database (past/present/potential), full contact history per client, automatic daily reminders to the right team member, and bulk campaign emails — all mobile-first.

## What's in this package

```
sql/01_schema.sql              → run this in Supabase SQL editor first
sql/02_seed_team.sql           → template to add your 6 team members
edge-functions/daily-reminders → the automation engine (runs once a day)
src/crm/
  supabaseClient.js
  CrmDashboard.jsx              → home screen: alerts + today's follow-ups + stats
  ClientList.jsx                → searchable/filterable client list
  ClientDetail.jsx              → client profile + full history + log-new-contact form
  CampaignManager.jsx           → bulk email campaigns
```

## Setup steps

### 1. Database
In your Supabase project → SQL Editor → run `01_schema.sql`. This creates `clients`, `interactions`, `campaigns`, `campaign_recipients`, `alerts`, `team_members`, all with RLS enabled.

### 2. Add your team
Have each of the 6 people (you, Umer, Muhammad, Maria, Salman, Amna) sign up once via Supabase Auth (same login screen as the ATS). Then copy their `auth.users.id` values into `02_seed_team.sql` and run it. This is what makes "alert all of us" and "who's assigned to this client" work.

### 3. Email sending — Resend setup (~15 min)
You said you want auto-sent reminder emails, so you need an email service. I used **Resend** because it's the simplest to wire into Supabase Edge Functions:
1. Create a free account at resend.com
2. Verify your domain (riversideenterprises.com or whatever you send from) — adds a few DNS records
3. Generate an API key
4. In Supabase → Project Settings → Edge Functions → add secrets:
   - `RESEND_API_KEY`
   - `REMINDER_FROM_EMAIL` (e.g. alerts@riversideenterprises.com)
5. Deploy the function: `supabase functions deploy daily-reminders`
6. Schedule it to run daily at, say, 7am Lahore time using Supabase's built-in Cron (Database → Cron Jobs), calling the function URL.

Once this is live: every morning, anyone with a follow-up due or overdue gets an email + an in-app alert automatically. Scheduled campaigns also go out automatically at their scheduled time.

### 4. Calendar integration (mobile + laptop)
True two-way sync with Google/Outlook calendar needs OAuth and a bit more backend work than fits here — happy to build that as a phase 2 if you want it. For now, the fastest practical win:
- Every interaction with a `next_followup_date` can generate a `.ics` calendar file link (one line of code using the `ics` npm package) that the team member taps to add to their phone's calendar app directly from the Client Detail screen.
- This gets you "shows up on my phone calendar" without needing Google API approval/OAuth review, which can take time.
- If you want native Google Calendar sync later (auto-create + auto-update events), that's a follow-up build — it needs a Google Cloud OAuth app.

### 5. Frontend
Drop the `src/crm/` folder into your existing ATS React project. Add three routes/tabs in your nav: Dashboard, Clients, Campaigns. Each screen is already mobile-first (bottom padding for thumb reach, large tap targets, WhatsApp/Call/Email one-tap links).

## How this maps to what you asked for

- **"Alert all of us"** → `alerts` table + daily email, scoped per assigned team member.
- **"Send reminder emails for opportunities, revival campaigns, informational content"** → `campaigns` table, 4 types, segment by client_type/sector.
- **"Who's dealing with this client, what happened, feedback, next contact date"** → `interactions` table, fully visible on Client Detail with full history.
- **"Mobile friendly"** → every screen built mobile-first (this was the explicit design constraint throughout).
- **Umer & Muhammad in Saudi doing in-person visits** → `in_person_visit` is a logged interaction type just like calls/emails/WhatsApp, same history, same reminders.

## Suggested additions worth considering

1. **Lead scoring** — the `rating` field (1-5) on clients is there; you could use it to auto-prioritize the dashboard (show high-rating potential clients first).
2. **Duplicate detection** — when Amna or Salman add a new lead, a quick check against existing `clients.company_name`/`email` avoids double-entry from two people working the same prospect.
3. **WhatsApp Business API** — right now WhatsApp follow-ups open the chat app (`wa.me` links) for a human to send. If volume grows, WhatsApp Business API (via Twilio or Meta directly) could automate template messages too — bigger lift, can scope later.
4. **Weekly digest for you (CEO)** — a Monday-morning rollup email summarizing: new leads added, follow-ups completed vs missed per person, campaigns sent. Easy add-on to the same Edge Function.
5. **Client document attachments** — CVs, contracts, or rate cards tied to a client record, stored in Supabase Storage.

Want me to build the `.ics` calendar-link feature, the weekly digest, or the duplicate-detection check next? Any one of those is a quick follow-up.
