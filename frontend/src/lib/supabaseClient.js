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

// Mirrors the media bucket's server-side allowed_mime_types and
// file_size_limit (Supabase Dashboard > Storage > media > Configuration).
// The server is the real enforcement — a request with a disallowed type or
// an oversized file is rejected by the Storage API itself, not just by this
// check. This client-side copy exists only to fail fast with a plain-language
// message instead of making the person wait for the upload to run and then
// see a raw storage error.
export const MEDIA_ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
  'text/csv',
];
export const MEDIA_MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024; // 15 MB
export const MEDIA_ACCEPT_ATTR = '.jpg,.jpeg,.png,.webp,.gif,.pdf,.csv';

export function getPublicMediaUrl(path) {
  if (!path) return null;
  const { data } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export async function uploadMediaFile(file, folder, supplyChainId) {
  if (!MEDIA_ALLOWED_MIME_TYPES.includes(file.type)) {
    throw new Error('That file type isn\'t supported. Please upload an image (JPG, PNG, WEBP, GIF), a PDF, or a CSV file.');
  }
  if (file.size > MEDIA_MAX_FILE_SIZE_BYTES) {
    throw new Error('That file is too large. Please upload a file under 15 MB.');
  }

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
