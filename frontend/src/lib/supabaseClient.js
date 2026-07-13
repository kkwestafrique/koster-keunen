import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
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
