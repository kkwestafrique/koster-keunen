// Supabase Edge Function: export-full-database
//
// Vibe-coding-checklist gap closed: "One click. Whole database. Export
// everything as SQL or Excel, anytime. Your backup, and finance's
// spreadsheet." Before this, the Reports/Exports feature only ever
// produced scoped exports (one report type, filtered) -- never a full
// dump of everything.
//
// Real auth model, not the interactive-user JWT the rest of the app
// uses: this deliberately runs on the SERVICE ROLE internally, because
// a genuine whole-database export has to read across every actor --
// that's the entire point of it, and it's exactly what normal RLS is
// there to prevent for a regular session. verify_jwt stays true (this
// IS called by a real logged-in person, unlike the trigger-only
// functions elsewhere in this project) -- but the gate that actually
// matters is checked explicitly below: the caller's own
// user_accounts.is_system_admin, a new, narrow, manually-granted flag
// (see migration add_system_admin_flag) distinct from the existing
// per-actor Admin role. An actor's own Admin is not the same thing as
// a KKWA system admin, and this function must never treat them as
// interchangeable -- that would be exactly the actor-isolation
// violation this whole project has been built to prevent.
//
// Returns clean JSON, not a finished .xlsx or .sql file -- the frontend
// already has the real xlsx library loaded client-side (used throughout
// bulk upload), so building both file formats happens there. Keeps this
// function's only job "read everything, prove the caller is allowed to",
// not file-format generation.
//
// Real bug found and fixed during live review: this function originally
// shipped with no CORS headers at all, on any response path. It worked
// fine when tested directly (via net.http_post, which isn't subject to
// browser CORS), but every real call from the actual deployed app --
// which runs on a different origin than the Supabase project itself --
// was silently blocked by the browser's own CORS preflight check before
// this function's code ever ran. The browser reported it as "Failed to
// send a request to the Edge Function", which gave no hint the function
// itself was healthy and reachable; only the browser console's CORS
// policy message showed the real cause. Every response path below,
// including the error ones (401/403/500), needs these headers -- a
// browser blocks reading an error response's body just as readily as a
// success one if the headers are missing.

import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const TABLES = [
  'actors', 'beekeepers', 'contracts', 'transactions', 'stocks',
  'connections', 'team_members', 'villages', 'regions',
  'exchange_rates', 'claims', 'notifications', 'bulk_uploads', 'exports',
];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const authHeader = req.headers.get('Authorization') || '';
  const jwt = authHeader.replace('Bearer ', '');
  if (!jwt) {
    return new Response(JSON.stringify({ error: 'Not authorized' }), { status: 401, headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(jwt);
  if (userError || !userData?.user) {
    return new Response(JSON.stringify({ error: 'Not authorized' }), { status: 401, headers: corsHeaders });
  }

  const { data: account, error: accountError } = await supabaseAdmin
    .from('user_accounts')
    .select('is_system_admin')
    .eq('id', userData.user.id)
    .single();
  if (accountError || !account?.is_system_admin) {
    return new Response(JSON.stringify({ error: 'Not authorized: system admin only' }), { status: 403, headers: corsHeaders });
  }

  const result = {};
  for (const table of TABLES) {
    const { data, error } = await supabaseAdmin.from(table).select('*');
    if (error) {
      return new Response(JSON.stringify({ error: `Failed to read ${table}: ${error.message}` }), { status: 500, headers: corsHeaders });
    }
    result[table] = data || [];
  }

  return new Response(JSON.stringify({ exported_at: new Date().toISOString(), tables: result }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
