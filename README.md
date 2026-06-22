# Riverside ATS — Complete Setup Guide (Cloud Edition)

This version has real logins for your 15 staff, a permanent cloud database,
CV photo/file uploads, and works on mobile. Follow these steps in order —
none of them require coding knowledge.

─────────────────────────────────────────────────────────────────
## PART 1 — Create your free database (Supabase)
─────────────────────────────────────────────────────────────────

1. Go to https://supabase.com and click "Start your project"
2. Sign up with your email (free, no credit card needed)
3. Click "New Project"
   - Name: Riverside ATS
   - Database password: choose a strong password and SAVE IT somewhere safe
   - Region: choose one close to Pakistan/Saudi (e.g. Singapore or Mumbai)
4. Wait about 2 minutes while it sets up

─────────────────────────────────────────────────────────────────
## PART 2 — Set up the database tables
─────────────────────────────────────────────────────────────────

1. In your Supabase project, click "SQL Editor" in the left sidebar
2. Click "New query"
3. Open the file `sql/schema.sql` from this package
4. Copy ALL of its contents and paste into the SQL editor
5. Click "RUN" (bottom right)
6. You should see "Success. No rows returned" — that means it worked

─────────────────────────────────────────────────────────────────
## PART 3 — Create storage for photos and CVs
─────────────────────────────────────────────────────────────────

1. In Supabase, click "Storage" in the left sidebar
2. Click "New bucket"
   - Name: `photos`
   - Toggle "Public bucket" to ON
   - Click Create
3. Click "New bucket" again
   - Name: `cvs`
   - Toggle "Public bucket" to ON
   - Click Create

─────────────────────────────────────────────────────────────────
## PART 4 — Connect the app to your database
─────────────────────────────────────────────────────────────────

1. In Supabase, click "Settings" (gear icon) → "API"
2. You'll see two values you need:
   - "Project URL" (looks like https://abcdefgh.supabase.co)
   - "anon public" key (a long string of letters/numbers)
3. In this project folder, find the file `.env.example`
4. Make a copy of it and rename the copy to exactly: `.env`
5. Open `.env` and paste in your two values:

   REACT_APP_SUPABASE_URL=https://abcdefgh.supabase.co
   REACT_APP_SUPABASE_ANON_KEY=your-long-key-here

6. Save the file

─────────────────────────────────────────────────────────────────
## PART 5 — Run the app on your computer
─────────────────────────────────────────────────────────────────

1. Make sure Node.js is installed (https://nodejs.org — download LTS version)
2. Open Terminal / Command Prompt in this project folder
3. Run:
   npm install
4. Then run:
   npm start
5. The app opens at http://localhost:3000
6. Click "New Staff Account" and create your own Admin account first

─────────────────────────────────────────────────────────────────
## PART 6 — Make yourself Admin
─────────────────────────────────────────────────────────────────

By default every new signup becomes "Staff". To make yourself Admin:

1. Go back to Supabase → click "Table Editor" in the sidebar
2. Click the "profiles" table
3. Find your row (matches your email/name)
4. Click on the "role" cell and change it from "staff" to "admin"
5. Press Enter to save
6. Refresh the ATS app in your browser — you'll now see "Staff Access"
   in the sidebar and can manage everyone else's roles from there

─────────────────────────────────────────────────────────────────
## PART 7 — Add your 15 staff members
─────────────────────────────────────────────────────────────────

Two options:

**Option A (recommended):** Send them the app link (once hosted, see Part 9)
and have each person sign up themselves via "New Staff Account". Then you
go to Staff Access page and set each person's role (Admin/Manager/Staff)
and, for Managers, tick which clients they're allowed to see.

**Option B:** You create all 15 accounts yourself by signing up with their
emails one by one through the same "New Staff Account" form.

─────────────────────────────────────────────────────────────────
## PART 8 — Understanding the roles
─────────────────────────────────────────────────────────────────

- **Admin** (you, Umer): sees everything, can delete candidates/jobs,
  manages staff roles and access
- **Manager**: sees only the clients assigned to them (e.g. a manager
  handling only Nestle won't see Al Rajhi data). Can add/edit but not delete.
- **Staff**: data entry — can add candidates, update stages, fill in
  process fields. Cannot delete anything, sees all clients by default
  (you can restrict this the same way as Managers if needed by editing
  their assigned_clients in the Staff Access page — currently the UI
  exposes this for managers; let me know if you want it for staff too)

─────────────────────────────────────────────────────────────────
## PART 9 — Put it online permanently (so everyone can access it
##           from anywhere, including mobile)
─────────────────────────────────────────────────────────────────

The easiest free option is Vercel:

1. Go to https://vercel.com and sign up (free)
2. Click "Add New" → "Project"
3. You'll need to upload this project to GitHub first:
   a. Go to https://github.com and create a free account
   b. Create a "New repository", name it "riverside-ats"
   c. Follow GitHub's instructions to upload this folder to it
      (or ask me and I'll walk you through the exact commands)
4. Back in Vercel, import that GitHub repository
5. Before deploying, click "Environment Variables" and add:
   - REACT_APP_SUPABASE_URL = (your value from Part 4)
   - REACT_APP_SUPABASE_ANON_KEY = (your value from Part 4)
6. Click Deploy
7. After ~2 minutes you'll get a permanent link like:
   https://riverside-ats.vercel.app
8. Share this link with all 15 staff — works on phone, tablet, laptop

─────────────────────────────────────────────────────────────────
## DAILY USE — How the workflow works
─────────────────────────────────────────────────────────────────

1. **CV Databank** — every new candidate who walks in or sends a CV goes
   here first, regardless of whether you have a matching job order yet.
   Upload their photo and CV file here. This is your master pool.

2. **When a job order/demand arrives** from a client (Nestle, Al Rajhi,
   etc.) — create it under "Job Orders"

3. **Assign candidates** — go back to CV Databank, find matching
   candidates, and use the "Assign to job…" dropdown next to their row.
   This moves them into the active pipeline for that specific client.

4. **Track progress** — go to "Pipeline" to see candidates grouped by
   client and by stage (Offer Letter → Contract → Visa processing →
   Medical → Trade Test → Passport submission → Stamping → BEOE →
   Flight → Deployed)

5. **Generate reports** — go to "Status Reports", pick the client,
   and export to Excel (3 separate sheets: summary, full detail, and
   a clean client-ready table) or generate a WhatsApp update message.

─────────────────────────────────────────────────────────────────
## NEED HELP?
─────────────────────────────────────────────────────────────────

If anything in Parts 1-9 doesn't work as expected, copy the exact error
message and bring it back to this conversation — I'll fix it immediately.
