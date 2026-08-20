// Supabase Edge Function: invite-team-member
//
// Creates a REAL login for an invited team member, OR -- new in this
// version -- adds an EXISTING account to a second actor's team, but only
// when that invite is for the Admin role. Only Admin can belong to more
// than one actor; Member/Field Officer are locked to exactly one (also
// enforced at the database level by a trigger on team_members, so this
// check here is a friendlier duplicate of that real enforcement, not the
// only place it's protected).
//
// Flow:
//   1. Verify the caller (via their own JWT) is an Admin on the actor's
//      supply chain.
//   2. Rate limit: this function uses the service-role key to send real
//      emails and create real auth accounts, which bypasses Supabase's
//      normal public-signup rate limits entirely. Before doing any real
//      work, check how many invite attempts this caller has made in the
//      last hour and reject with 429 if over the limit.
//   3. Check whether the invited email already has an account:
//      - If yes AND role is Admin: add a new team_members row for the
//        existing user_id on this new actor. No new auth user, no new
//        user_accounts row (one already exists).
//      - If yes AND role is Member/Field Officer: reject with a clear
//        message -- they already belong elsewhere and can't join a
//        second actor except as Admin.
//      - If no: proceed exactly as before -- send a real Supabase Auth
//        invite email (creates the auth.users row), then create
//        user_accounts, then create team_members.
//
// The invited person (new-account case) clicks the emailed link, lands on
// /set-up-password (redirectTo, provided by the caller since it knows its
// own origin), which establishes a Supabase session from the invite token
// and lets them set a password. That page flips team_members.status from
// 'Pending' to 'Active'.

import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const VALID_ROLES = ['Admin', 'Member', 'Field Officer'];

// 20 invites per caller per rolling hour. Generous enough for a real team
// onboarding a batch of people at once, tight enough that a compromised or
// malicious Admin account can't use this to flood inboxes or enumerate
// which emails have accounts via repeated calls.
const RATE_LIMIT_MAX_ATTEMPTS = 20;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

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
    if (!VALID_ROLES.includes(role)) {
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

    const supabaseAsCaller = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

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

    // Rate limit check -- counts this caller's attempts in the rolling
    // window, using the service-role client since invite_attempts has no
    // RLS policies granting access to anyone else.
    const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();
    const { count: recentAttempts, error: rateLimitError } = await supabaseAdmin
      .from('invite_attempts')
      .select('id', { count: 'exact', head: true })
      .eq('caller_id', userData.user.id)
      .gte('created_at', windowStart);
    if (rateLimitError) {
      // Fail closed on a rate-limit check we can't verify -- refusing an
      // invite is a much smaller cost than silently disabling the limit.
      return new Response(JSON.stringify({ error: 'Could not verify request rate. Please try again shortly.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if ((recentAttempts ?? 0) >= RATE_LIMIT_MAX_ATTEMPTS) {
      return new Response(JSON.stringify({
        error: `You've sent too many invites in the last hour. Please wait a while before sending more.`,
      }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    // Record this attempt before doing any real work, so a request that
    // fails partway through still counts toward the caller's limit.
    await supabaseAdmin.from('invite_attempts').insert({ caller_id: userData.user.id });

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

    // Detect whether this email already belongs to an existing account.
    const { data: existingUserId, error: lookupError } = await supabaseAdmin.rpc('get_user_id_by_email', { p_email: email });
    if (lookupError) {
      return new Response(JSON.stringify({ error: `Failed to check existing accounts: ${lookupError.message}` }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (existingUserId) {
      // Existing account: only Admin can be added to a second actor.
      if (role !== 'Admin') {
        return new Response(JSON.stringify({
          error: `${email} already has an account on another actor. Only Admins can belong to more than one actor -- either invite them as Admin, or remove them from their current actor first.`,
        }), {
          status: 409,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: teamMember, error: teamMemberError } = await supabaseAdmin
        .from('team_members')
        .insert({ actor_id: actorId, name, email, role, status: 'Active', user_id: existingUserId })
        .select()
        .single();
      if (teamMemberError) {
        return new Response(JSON.stringify({ error: `Failed to add existing account to this actor: ${teamMemberError.message}` }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ success: true, team_member: teamMember, user_id: existingUserId, addedExistingAccount: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // No existing account -- proceed with a real new invite.
    const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      redirectTo: redirectTo || undefined,
      data: { full_name: name },
    });
    if (inviteError) {
      const alreadyExists = /already been registered|already exists|already registered/i.test(inviteError.message || '');
      return new Response(JSON.stringify({
        error: alreadyExists
          ? `${email} has already been invited. Ask them to check their inbox, or use "Forgot password" if they need a new link.`
          : inviteError.message,
      }), {
        status: alreadyExists ? 409 : 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const newUserId = inviteData.user.id;

    const { error: accountError } = await supabaseAdmin.from('user_accounts').insert({
      id: newUserId,
      username: name,
      role,
      supply_chain_id: callerAccount.supply_chain_id,
      current_actor_id: actorId,
    });
    if (accountError) {
      await supabaseAdmin.auth.admin.deleteUser(newUserId);
      return new Response(JSON.stringify({ error: `Failed to create account: ${accountError.message}` }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: teamMember, error: teamMemberError } = await supabaseAdmin
      .from('team_members')
      .insert({ actor_id: actorId, name, email, role, status: 'Pending', user_id: newUserId })
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
