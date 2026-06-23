// Supabase Edge Function: admin-manage-staff
// Lets the Admin delete a staff login or change their email,
// using the service role key (never exposed to the browser).
//
// Called from the app with: { action: "delete" | "update_email", userId, newEmail? }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(SUPABASE_URL, SERVICE_KEY);

Deno.serve(async (req) => {
  try {
    const { action, userId, newEmail, requesterId } = await req.json();

    if (!userId || !action) {
      return new Response(JSON.stringify({ error: "Missing userId or action" }), { status: 400 });
    }

    // Confirm the requester is an admin before allowing this
    if (requesterId) {
      const { data: requesterProfile } = await admin.from("profiles").select("role").eq("id", requesterId).single();
      if (!requesterProfile || requesterProfile.role !== "admin") {
        return new Response(JSON.stringify({ error: "Only Admins can manage staff accounts" }), { status: 403 });
      }
    }

    if (action === "delete") {
      const { error } = await admin.auth.admin.deleteUser(userId);
      if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400 });
      // profiles row cleanup (in case no cascade delete trigger exists)
      await admin.from("profiles").delete().eq("id", userId);
      return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });
    }

    if (action === "update_email") {
      if (!newEmail) return new Response(JSON.stringify({ error: "Missing newEmail" }), { status: 400 });
      const { error } = await admin.auth.admin.updateUserById(userId, { email: newEmail, email_confirm: true });
      if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400 });
      await admin.from("profiles").update({ email: newEmail }).eq("id", userId);
      return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400 });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});
