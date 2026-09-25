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
// Resolves a real gap from the 2026-09-12 security audit (Finding 5):
// exports and attachments used to live in the public 'media' bucket
// alongside logos, permanently exposed to anyone with the URL. Only
// actor logos belong in the public bucket now -- everything else
// (exports, transaction/contract attachments) goes here, and is only
// ever reachable through a short-lived signed URL generated at the
// moment someone actually clicks to view/download it.
export const PRIVATE_MEDIA_BUCKET = 'private-media';
// Folders that hold logos -- the only content still meant to be
// public. Everything else uploaded through uploadMediaFile is treated
// as private by default, so a new folder added later is private
// unless explicitly listed here -- the safer default for anything
// that might contain real business data.
const PUBLIC_FOLDERS = ['actors'];

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
// Real gap found via a security-prompt audit pass: the storage filename
// used to be built from file.name.split('.').pop() -- the raw suffix
// after the last dot in whatever name the browser reports, unsanitized.
// A crafted File object (e.g. name: "x.csv/../../y") would carry that
// straight into the storage path string. The MIME-type check above
// happens on file.type, which is somewhat independently controllable
// from file.name, so it didn't fully cover this. Deriving the extension
// from the already-validated MIME type instead of the filename removes
// the gap entirely -- the client-supplied filename never reaches the
// storage path at all now, so there's nothing left to sanitize.
const MIME_TO_EXTENSION = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'application/pdf': 'pdf',
  'text/csv': 'csv',
};

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

  const fileExt = MIME_TO_EXTENSION[file.type];
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;
  // Path is folder/{supply_chain_id}/filename for every other folder --
  // the storage RLS policies check that middle segment against the
  // caller's own supply chain, so one tenant can never overwrite or
  // delete another tenant's files even though the logos bucket itself
  // is public-read.
  //
  // exports is the one real exception: a report export can contain
  // tenant-wide data an Admin generated but a Field Officer or Member
  // would never normally see through the UI (both are scoped to their
  // own actor everywhere else in this app). Adding the uploader's own
  // user id as a real path segment (folder/{supply_chain_id}/{user_id}/
  // filename) lets the storage RLS policy check ownership directly,
  // without depending on the separate `exports` metadata table (which,
  // checked directly, isn't actually being kept populated).
  const { data: { user } } = await supabase.auth.getUser();
  const filePath = folder === 'exports'
    ? `${folder}/${supplyChainId}/${user?.id}/${fileName}`
    : `${folder}/${supplyChainId}/${fileName}`;
  const isPublic = PUBLIC_FOLDERS.includes(folder);
  const bucket = isPublic ? MEDIA_BUCKET : PRIVATE_MEDIA_BUCKET;
  const { error } = await supabase.storage.from(bucket).upload(filePath, file);
  if (error) throw error;
  // Public content (logos) still returns a real, permanent URL, same as
  // before. Private content returns just the path -- the caller stores
  // this, and must call getSignedMediaUrl(path) to get an actual,
  // time-limited link at the moment someone needs to view/download it.
  return isPublic ? getPublicMediaUrl(filePath) : filePath;
}

// Generates a fresh, short-lived signed URL for a private-bucket path —
// call this at the moment someone actually clicks to view/download a
// file, not before. Defaults to 1 hour, long enough for a real person
// to click through and download without the link outliving its purpose.
export async function getSignedMediaUrl(path, expirySeconds = 3600) {
  if (!path) return null;
  const { data, error } = await supabase.storage.from(PRIVATE_MEDIA_BUCKET).createSignedUrl(path, expirySeconds);
  if (error) throw error;
  return data.signedUrl;
}
