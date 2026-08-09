import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';

// Cross-company sharing (permission_grants), person-to-person: a specific
// user in another supply chain gets conditional access into the
// grantor's own supply chain data, for one module (actors/beekeepers/
// contracts/transactions/stocks) at one tier (View/Edit/Manage).
//
// All four RPCs already exist, are SECURITY DEFINER, and re-implement the
// same access rules permission_grants' own RLS enforces by hand (since
// SECURITY DEFINER bypasses RLS) — built and verified directly against the
// live database earlier this session. This file only wraps them for
// React Query; it does not duplicate any of that access logic.

const MODULES = ['actors', 'beekeepers', 'contracts', 'transactions', 'stocks'];
const PERMISSION_LEVELS = ['View', 'Edit', 'Manage'];

export { MODULES, PERMISSION_LEVELS };

// "Shared by me" — everything the current person has granted to others.
export function useMyGrants() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['my-grants', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('list_my_grants');
      if (error) throw error;
      return data;
    },
    enabled: !!user,
    staleTime: 30_000,
  });
}

// "Shared with me" — everything others have granted to the current person.
export function useGrantsReceived() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['grants-received', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('list_grants_received');
      if (error) throw error;
      return data;
    },
    enabled: !!user,
    staleTime: 30_000,
  });
}

export function useCreateGrant() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ granteeEmail, module, permissionLevel }) => {
      const { data, error } = await supabase.rpc('create_grant', {
        p_grantee_email: granteeEmail,
        p_module: module,
        p_permission_level: permissionLevel,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['my-grants'] }),
  });
}

export function useRevokeGrant() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (grantId) => {
      const { error } = await supabase.rpc('revoke_grant', { p_grant_id: grantId });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['my-grants'] }),
  });
}
