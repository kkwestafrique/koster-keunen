import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    // sessionStorage instead of the default localStorage — an XSS attack
    // could still grab the token while the tab is open, but it can't
    // persist across browser restarts the way localStorage can. This
    // downgrades the risk from "permanent account takeover" to "temporary,
    // session-only access" — a real, meaningful improvement even though
    // it's not a complete elimination of the risk category. The tradeoff
    // is that users must re-login when they close and reopen the browser.
    storage: typeof window !== 'undefined' ? window.sessionStorage : undefined,
  },
});

export const MEDIA_BUCKET = 'media';

export function getPublicMediaUrl(path) {
  if (!path) return null;
  const { data } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export async function uploadMediaFile(file, folder, supplyChainId) {
  const fileExt = file.name.split('.').pop();
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;
  // Path is folder/{supply_chain_id}/filename — the storage RLS policies
  // check that middle segment against the caller's own supply chain, so
  // one tenant can never overwrite or delete another tenant's files even
  // though the bucket itself is public-read (needed for logos/exports to
  // be viewable via a plain URL).
  const filePath = `${folder}/${supplyChainId}/${fileName}`;
  const { error } = await supabase.storage.from(MEDIA_BUCKET).upload(filePath, file);
  if (error) throw error;
  return getPublicMediaUrl(filePath);
}
