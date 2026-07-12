// Supabase Edge Function: invite-team-member
//
// Creates a REAL login for an invited team member — the client-side
// `team_members` insert alone can't do this, because creating an
// auth.users account requires the service-role key, which must never be
// exposed to the browser. This function holds that key server-side only.
//
// Flow:
//   1. Verify the caller (via their own JWT) is an Admin on the actor's
//      supply chain — mirrors what RLS would enforce, done manually here
//      because this function uses the service-role client for the
//      privileged parts (auth.admin, and writing user_accounts, which the
//      caller has no direct RLS-permitted access to for other people).
//   2. Send a real Supabase Auth invite email (creates the auth.users row).
//   3. Create the matching user_accounts row (login identity + role +
//      supply chain + starting actor).
//   4. Create the team_members row (the existing contact-list entry).
//
// The invited person clicks the emailed link, lands on /set-up-password
// (redirectTo, provided by the caller since it knows its own origin),
// which establishes a Supabase session from the invite token and lets
// them set a password via supabase.auth.updateUser({ password }).

import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// team_members.role (Admin/Member/Field Officer) uses a different
// vocabulary than user_accounts.role (Admin/Manager/Viewer) — this is the
// same mapping decision the rest of the app would need to make.
const TEAM_ROLE_TO_ACCOUNT_ROLE = {
  Admin: 'Admin',
  'Field Officer': 'Manager',
  Member: 'Viewer',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { name, email, role, actorId, redirectTo } = await req.json();

    if (!name || !email || !role || !actorId) {
      return new Response(JSON.stringify({ error: 'name, email, role, and actorId are all required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!TEAM_ROLE_TO_ACCOUNT_ROLE[role]) {
      return new Response(JSON.stringify({ error: `Invalid role: ${role}` }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    // Acts as the calling user (their own JWT, RLS fully applies) — used
    // only to establish who's calling and to confirm the target actor is
    // really in their supply chain, exactly like the browser client would
    // already be restricted to.
    const supabaseAsCaller = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Bypasses RLS entirely — needed for auth.admin and for writing
    // user_accounts/team_members on behalf of someone who isn't the
    // caller. Never exposed to the browser.
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const { data: userData, error: userError } = await supabaseAsCaller.auth.getUser();
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: 'Not authenticated' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: callerAccount, error: callerError } = await supabaseAsCaller
      .from('user_accounts')
      .select('role, supply_chain_id')
      .eq('id', userData.user.id)
      .single();
    if (callerError || !callerAccount) {
      return new Response(JSON.stringify({ error: 'Could not resolve caller account' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (callerAccount.role !== 'Admin') {
      return new Response(JSON.stringify({ error: 'Only Admins can invite team members' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // RLS (actors_scoped) means this only returns a row if the actor is
    // really in the caller's supply chain — a stranger's actor id here
    // would just come back empty.
    const { data: actor, error: actorError } = await supabaseAsCaller
      .from('actors')
      .select('id, supply_chain_id')
      .eq('id', actorId)
      .single();
    if (actorError || !actor) {
      return new Response(JSON.stringify({ error: 'Actor not found in your supply chain' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      redirectTo: redirectTo || undefined,
      data: { full_name: name },
    });
    if (inviteError) {
      return new Response(JSON.stringify({ error: inviteError.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const newUserId = inviteData.user.id;

    const { error: accountError } = await supabaseAdmin.from('user_accounts').insert({
      id: newUserId,
      username: name,
      role: TEAM_ROLE_TO_ACCOUNT_ROLE[role],
      supply_chain_id: callerAccount.supply_chain_id,
      current_actor_id: actorId,
    });
    if (accountError) {
      // Roll back the auth user so a failed invite doesn't leave a
      // dangling login with no app-side record.
      await supabaseAdmin.auth.admin.deleteUser(newUserId);
      return new Response(JSON.stringify({ error: `Failed to create account: ${accountError.message}` }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: teamMember, error: teamMemberError } = await supabaseAdmin
      .from('team_members')
      .insert({ actor_id: actorId, name, email, role, status: 'Invited' })
      .select()
      .single();
    if (teamMemberError) {
      return new Response(JSON.stringify({ error: `Account created but team_members row failed: ${teamMemberError.message}` }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true, team_member: teamMember, user_id: newUserId }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message || 'Unexpected error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
