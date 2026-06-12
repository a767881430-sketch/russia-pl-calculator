import { corsHeaders } from "../_shared/cors.ts";
import { createAdminClient } from "../_shared/admin.ts";

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const admin = createAdminClient();
    const authHeader = request.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const jwt = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await admin.auth.getUser(jwt);
    if (userError || !userData.user) {
      return new Response(JSON.stringify({ error: "Invalid user session" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await request.json();
    const workspaceId = String(body.workspaceId || "");
    const email = String(body.email || "").trim().toLowerCase();
    const role = String(body.role || "reader");
    const invitedBy = userData.user.id;

    const { data: membership, error: membershipError } = await admin
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", workspaceId)
      .eq("user_id", invitedBy)
      .single();

    if (membershipError || membership?.role !== "admin") {
      return new Response(JSON.stringify({ error: "Only workspace admins can invite members" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: invitedUser, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
      data: {
        workspace_id: workspaceId,
        invited_role: role,
      },
    });

    if (inviteError) {
      return new Response(JSON.stringify({ error: inviteError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (invitedUser.user?.id) {
      await admin.from("workspace_members").upsert({
        workspace_id: workspaceId,
        user_id: invitedUser.user.id,
        role,
        invited_email: email,
        status: "invited",
      }, { onConflict: "workspace_id,user_id" });
    }

    return new Response(JSON.stringify({ ok: true, invitedUserId: invitedUser.user?.id || null }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message || "Invite failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
