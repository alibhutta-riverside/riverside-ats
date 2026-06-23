// Supabase Edge Function: admin-manage-staff
// Lets the Admin create, delete, or edit a staff login,
// using the service role key (never exposed to the browser).
// Accounts created here are auto-confirmed, so there's no
// "Email not confirmed" issue on first login.
//
// Called from the app with:
//   { action: "create", email, password, fullName, requesterId }
//   { action: "delete", userId, requesterId }
//   { action: "update_email", userId, newEmail, requesterId }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(SUPABASE_URL, SERVICE_KEY);

Deno.serve(async (req) => {
  try {
    const body = await req.json();
    const { action, requesterId } = body;

    if (!action) {
      return new Response(JSON.stringify({ error: "Missing action" }), { status: 400 });
    }

    // Confirm the requester is an admin before allowing any of this
    if (requesterId) {
      const { data: requesterProfile } = await admin.from("profiles").select("role").eq("id", requesterId).single();
      if (!requesterProfile || requesterProfile.role !== "admin") {
        return new Response(JSON.stringify({ error: "Only Admins can manage staff accounts" }), { status: 403 });
      }
    }

    if (action === "create") {
      const { email, password, fullName } = body;
      if (!email || !password || !fullName) {
        return new Response(JSON.stringify({ error: "Missing email, password, or fullName" }), { status: 400 });
      }
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true, // auto-confirmed, no verification email needed
        user_metadata: { full_name: fullName },
      });
      if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400 });

      await admin.from("profiles").update({ full_name: fullName, role: "staff" }).eq("id", data.user.id);
      return new Response(JSON.stringify({ success: true, userId: data.user.id }), { headers: { "Content-Type": "application/json" } });
    }

    if (action === "delete") {
      const { userId } = body;
      if (!userId) return new Response(JSON.stringify({ error: "Missing userId" }), { status: 400 });
      const { error } = await admin.auth.admin.deleteUser(userId);
      if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400 });
      await admin.from("profiles").delete().eq("id", userId);
      return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });
    }

    if (action === "update_email") {
      const { userId, newEmail } = body;
      if (!userId || !newEmail) return new Response(JSON.stringify({ error: "Missing userId or newEmail" }), { status: 400 });
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
