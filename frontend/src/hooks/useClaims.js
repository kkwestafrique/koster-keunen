import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';

// Gap 12: standards ("claims") were just flags -- anyone who could edit a
// beekeeper could add "Organic" and nothing checked it. These wrap the
// real verification workflow: submit -> Pending -> Verified/Rejected,
// with the standards array only ever updated by a successful
// verify_claim() call from here on.

// Claims for one specific entity (shown on a beekeeper/actor profile).
export function useClaimsForEntity(entityType, entityId) {
  return useQuery({
    queryKey: ['claims', entityType, entityId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('claims')
        .select('*')
        .eq('entity_type', entityType)
        .eq('entity_id', entityId)
        .order('submitted_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!entityType && !!entityId,
  });
}

// The verification queue -- everything awaiting review across the whole
// supply chain. This is the page a verifier actually works from.
export function usePendingClaims() {
  const { supplyChainId } = useAuth();
  return useQuery({
    queryKey: ['pending-claims', supplyChainId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('claims')
        .select('*')
        .eq('supply_chain_id', supplyChainId)
        .eq('status', 'Pending')
        .order('submitted_at', { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!supplyChainId,
  });
}

export function useSubmitClaim() {
  const { supplyChainId } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ entityType, entityId, standard, evidenceNote }) => {
      // status/submitted_by/submitted_at are all forced server-side by a
      // trigger regardless of what's sent here -- a claim can never be
      // inserted pre-verified.
      const { error } = await supabase.from('claims').insert({
        supply_chain_id: supplyChainId,
        entity_type: entityType,
        entity_id: entityId,
        standard,
        evidence_note: evidenceNote || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['claims'] });
      queryClient.invalidateQueries({ queryKey: ['pending-claims'] });
    },
  });
}

export function useVerifyClaim() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (claimId) => {
      const { error } = await supabase.rpc('verify_claim', { p_claim_id: claimId });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['claims'] });
      queryClient.invalidateQueries({ queryKey: ['pending-claims'] });
      queryClient.invalidateQueries({ queryKey: ['beekeepers'] });
      queryClient.invalidateQueries({ queryKey: ['beekeeper'] });
      queryClient.invalidateQueries({ queryKey: ['actors'] });
    },
  });
}

export function useRejectClaim() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ claimId, reason }) => {
      const { error } = await supabase.rpc('reject_claim', { p_claim_id: claimId, p_reason: reason || null });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['claims'] });
      queryClient.invalidateQueries({ queryKey: ['pending-claims'] });
    },
  });
}

// Fourth entity in the deliberately scoped-down Delete rollout (after
// villages, connections, exports). Confirmed zero foreign keys reference
// claims, safe to delete. Deliberately distinct from Reject (a real
// decision that the claim's content doesn't meet the standard, keeps the
// row as a Rejected historical record): Delete means the submission
// itself was a mistake and should never have existed. Only ever exposed
// from the Verification Queue, which already only shows Pending claims --
// naturally scoped away from ever deleting an already-verified claim,
// whose side effect (updating the entity's standards array via
// verify_claim()) wouldn't be undone by deleting the claim row itself.
export function useDeleteClaim() {
  const { supplyChainId } = useAuth();
  const queryClient = useQueryClient();
  const pendingKey = ['pending-claims', supplyChainId];
  return useMutation({
    mutationFn: async (claimId) => {
      const { error } = await supabase.from('claims').delete().eq('id', claimId);
      if (error) throw error;
    },
    // Real, genuine cache-level optimistic delete on pending-claims --
    // the exact list actually being viewed during this action, and a
    // simple, non-paginated flat list, same safe shape as exports.
    // claims (the separate per-entity history view, not visible during
    // this action) stays a normal, pessimistic background
    // reconciliation via onSettled below -- no optimistic update
    // needed for a view nobody's looking at right now.
    onMutate: async (claimId) => {
      await queryClient.cancelQueries({ queryKey: pendingKey });
      const previous = queryClient.getQueryData(pendingKey);
      queryClient.setQueryData(pendingKey, (old) => (old || []).filter((c) => c.id !== claimId));
      return { previous };
    },
    onError: (err, claimId, context) => {
      if (context?.previous) queryClient.setQueryData(pendingKey, context.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['claims'] });
      queryClient.invalidateQueries({ queryKey: pendingKey });
    },
  });
}
