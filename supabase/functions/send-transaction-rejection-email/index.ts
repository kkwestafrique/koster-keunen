// Supabase Edge Function: send-transaction-rejection-email
//
// Closes a real gap found while reviewing reject_transaction_with_reversal():
// that function already writes a `notifications` row when a receiving actor
// rejects an incoming shipment, but nothing ever emailed the supplying actor
// -- they'd only find out by noticing the in-app bell icon. This function
// sends that email. It does not replace the notifications row; it's fired
// alongside it by a DB trigger (see migration
// 2026_transaction_reject_email_notification.sql) the moment that row is
// inserted, for `type = 'transaction_rejected'` only.
//
// Auth model -- deliberately different from invite-team-member:
// invite-team-member is called directly by an authenticated Admin's browser
// session, so it verifies a real user JWT. This function is called ONLY by
// a Postgres trigger via pg_net, which has no user session to present --
// there is no browser tab open, no JWT, nothing to verify_jwt against. So
// verify_jwt is disabled for this function at deploy time, and instead it
// checks a shared secret the trigger sends in the Authorization header,
// generated once and stored in Supabase Vault (never in this repo, never in
// a migration file as plaintext). Any request without the correct secret is
// rejected before touching the database or sending anything -- this is the
// only thing standing between this function and being a public
// "email anyone anything" endpoint, so it is checked first, unconditionally.
//
// Fails safe in every direction: a missing/misconfigured RESEND_API_KEY,
// zero recipients found, or a Resend API error all return a normal 200 with
// the problem described in the response body -- this function must never
// cause the pg_net trigger to retry-storm, and it must never be the reason
// a legitimate rejection (stock reversal, in-app notification) fails or
// rolls back. The database write already succeeded before this function is
// even called; email delivery is best-effort on top of that, not a
// precondition for it.

import { createClient } from 'jsr:@supabase/supabase-js@2';

const KKWA_BLUE = '#0f48aa';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*' } });
  }

  const internalSecret = (Deno.env.get('TRANSACTION_EMAIL_TRIGGER_SECRET') || '').trim();
  const authHeader = (req.headers.get('Authorization') || '').trim();
  if (!internalSecret || authHeader !== `Bearer ${internalSecret}`) {
    return new Response(JSON.stringify({ error: 'Not authorized' }), { status: 401 });
  }

  let notificationId;
  try {
    ({ notification_id: notificationId } = await req.json());
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400 });
  }
  if (!notificationId) {
    return new Response(JSON.stringify({ error: 'notification_id is required' }), { status: 400 });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const resendApiKey = Deno.env.get('RESEND_API_KEY');
  // onboarding@resend.dev works immediately with no domain verification --
  // fine for getting this live and testable today. Swap EMAIL_FROM_ADDRESS
  // to a verified miskkwa.com address once that domain is set up in Resend.
  const fromAddress = Deno.env.get('EMAIL_FROM_ADDRESS') || 'KKWA MIS <onboarding@resend.dev>';
  const appOrigin = Deno.env.get('APP_ORIGIN') || 'https://miskkwa.com';

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

  const { data: notification, error: notificationError } = await supabaseAdmin
    .from('notifications')
    .select('id, type, title, message, link, actor_id, created_at')
    .eq('id', notificationId)
    .single();

  if (notificationError || !notification) {
    // Nothing to send. Not the caller's fault in the normal flow (the
    // trigger always passes a real, just-inserted id), so 200 rather than
    // an error that would encourage a retry-storm from pg_net.
    return new Response(JSON.stringify({ skipped: true, reason: 'Notification not found' }), { status: 200 });
  }
  if (notification.type !== 'transaction_rejected') {
    // Defensive: the DB trigger already filters to this type, but this
    // function should never assume that filter can't change or widen later.
    return new Response(JSON.stringify({ skipped: true, reason: 'Not a rejection notification' }), { status: 200 });
  }

  const { data: actor } = await supabaseAdmin
    .from('actors')
    .select('contact_name')
    .eq('id', notification.actor_id)
    .single();

  const { data: recipients, error: recipientsError } = await supabaseAdmin
    .from('team_members')
    .select('name, email')
    .eq('actor_id', notification.actor_id)
    .eq('status', 'Active')
    .in('role', ['Admin', 'Member'])
    .not('email', 'is', null);

  if (recipientsError) {
    return new Response(JSON.stringify({ error: `Failed to look up recipients: ${recipientsError.message}` }), { status: 200 });
  }
  if (!recipients || recipients.length === 0) {
    return new Response(JSON.stringify({ skipped: true, reason: 'No active Admin/Member recipients for this actor' }), { status: 200 });
  }
  if (!resendApiKey) {
    return new Response(JSON.stringify({ skipped: true, reason: 'RESEND_API_KEY not configured' }), { status: 200 });
  }

  const linkUrl = notification.link
    ? (notification.link.startsWith('http') ? notification.link : `${appOrigin}${notification.link}`)
    : `${appOrigin}/transactions`;

  const html = buildEmailHtml({
    actorName: actor?.contact_name || 'your team',
    title: notification.title,
    message: notification.message,
    linkUrl,
  });

  const results = [];
  for (const recipient of recipients) {
    try {
      const resp = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: fromAddress,
          to: recipient.email,
          subject: notification.title || 'Your shipment was rejected',
          html: html.replace('{{RECIPIENT_NAME}}', recipient.name || 'there'),
        }),
      });
      const body = await resp.json().catch(() => ({}));
      results.push({ email: recipient.email, ok: resp.ok, status: resp.status, id: body?.id });
    } catch (err) {
      results.push({ email: recipient.email, ok: false, error: err.message });
    }
  }

  return new Response(JSON.stringify({ sent: results }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});

function buildEmailHtml({ actorName, title, message, linkUrl }) {
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background-color:#eef1f6;font-family:Arial,Helvetica,sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#eef1f6;padding:32px 0;">
      <tr>
        <td align="center">
          <table width="560" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;">
            <tr>
              <td style="padding:32px 40px 0 40px;">
                <div style="color:${KKWA_BLUE};font-size:20px;font-weight:bold;">Koster Keunen</div>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 40px 0 40px;">
                <p style="color:${KKWA_BLUE};font-size:18px;font-weight:bold;margin:0 0 16px 0;">Hi {{RECIPIENT_NAME}},</p>
                <p style="color:${KKWA_BLUE};font-size:16px;line-height:1.5;margin:0 0 24px 0;">
                  ${escapeHtml(title || 'Your shipment was rejected')} by ${escapeHtml(actorName)}.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:0 40px;">
                <div style="background-color:#f4f6fa;border-radius:6px;padding:20px 24px;color:#333;font-size:14px;line-height:1.6;">
                  ${escapeHtml(message || '')}
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 40px;">
                <a href="${linkUrl}" style="display:block;text-align:center;background-color:${KKWA_BLUE};color:#ffffff;text-decoration:none;font-size:15px;font-weight:bold;padding:14px 0;border-radius:6px;">
                  View transaction
                </a>
              </td>
            </tr>
            <tr>
              <td style="padding:0 40px 32px 40px;">
                <p style="color:#8a94a6;font-size:12px;line-height:1.5;margin:16px 0 0 0;">
                  This is a system-generated email. Please do not reply to this address.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
