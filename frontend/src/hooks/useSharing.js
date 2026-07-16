import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';

// "Sharing & Permissions" — thin wrappers around the already-built/tested
// Supabase RPC functions. No tables are queried directly here; the RPCs
// handle all scoping (grantor supply chain, role checks) server-side.

export function useMyGrants() {
  return useQuery({
    queryKey: ['my-grants'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('list_my_grants');
      if (error) throw new Error(error.message);
      return data || [];
    },
    staleTime: 30_000,
  });
}

export function useGrantsReceived() {
  return useQuery({
    queryKey: ['grants-received'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('list_grants_received');
      if (error) throw new Error(error.message);
      return data || [];
    },
    staleTime: 30_000,
  });
}

export function useCreateGrant() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ email, module, level }) => {
      const { data, error } = await supabase.rpc('create_grant', {
        p_grantee_email: email,
        p_module: module,
        p_permission_level: level,
      });
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['my-grants'] }),
  });
}

export function useRevokeGrant() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (grantId) => {
      const { data, error } = await supabase.rpc('revoke_grant', { p_grant_id: grantId });
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['my-grants'] }),
  });
}
