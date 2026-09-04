import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';

// Gap 3: there was no page for a logged-in person to view or manage their
// own account at all -- "My Profile" in the TopBar just navigated to the
// COMPANY profile instead. Also fixes a small, adjacent, genuinely dead
// column found while building this: user_accounts.language_preference
// existed in the schema but was never read or written by any code
// anywhere -- the TopBar's language switcher only ever called
// i18n.changeLanguage() for the current session, never persisted a
// choice. This is the first real UI surface for that column.
export function useUpdateMyProfile() {
  return useMutation({
    mutationFn: async ({ id, username, language_preference }) => {
      const { error } = await supabase
        .from('user_accounts')
        .update({ username, language_preference })
        .eq('id', id);
      if (error) throw error;
    },
  });
}

// Marks the onboarding tour as seen, closing UF1: no onboarding
// guidance existed anywhere for a new organization's first real login.
// A dedicated mutation rather than reusing useUpdateMyProfile above,
// which requires username/language_preference every call -- this needs
// to fire on its own, from wherever the tour ends or gets dismissed.
export function useMarkOnboardingSeen() {
  return useMutation({
    mutationFn: async (userId) => {
      const { error } = await supabase
        .from('user_accounts')
        .update({ has_seen_onboarding: true })
        .eq('id', userId);
      if (error) throw error;
    },
  });
}

// Uses Supabase Auth's own updateUser -- works for an already-logged-in
// person changing their own password directly, no email/reset-link flow
// needed (that flow already exists separately for forgot-password).
export function useChangePassword() {
  return useMutation({
    mutationFn: async (newPassword) => {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
    },
  });
}
