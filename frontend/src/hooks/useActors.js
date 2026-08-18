import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';

export function useActors({ page = 1, pageSize = 5, search = '', actorType = '', country = '', status = '', connectedOnly = false, currentActorId = null } = {}) {
  const { supplyChainId } = useAuth();
  return useQuery({
    queryKey: ['actors', { page, pageSize, search, actorType, country, status, connectedOnly, currentActorId, supplyChainId }],
    queryFn: async () => {
      // The real, unbypassable restriction for Member/Field Officer is now
      // the actors_select RLS policy (backend/migrations/
      // 2026_actors_connection_scoped_rls.sql) -- this client-side
      // filtering can't be relied on for security, since RLS already
      // returns the correct restricted set regardless of what's requested
      // here. What THIS layer is actually for: RLS deliberately still
      // allows seeing your own current actor (Company Profile needs that
      // for a single-record fetch), so it can't distinguish "list view"
      // from "my own profile" -- this filters the current actor OUT of
      // the LIST specifically, since your own company is not a
      // "connection", it's yourself. Flows that legitimately need to
      // browse EVERY actor (Add Connection, the Contract wizard's
      // supplier picker, Send's destination picker) use the separate
      // useActorDirectory() hook, which bypasses this restriction
      // entirely via the browse_actor_directory() RPC -- unaffected by
      // any of this.
      let connectedIds = null;
      if (connectedOnly && currentActorId) {
        const { data: conns, error: connErr } = await supabase
          .from('connections')
          .select('actor_from_id, actor_to_id')
          .eq('status', 'Active')
          .or(`actor_from_id.eq.${currentActorId},actor_to_id.eq.${currentActorId}`);
        if (connErr) throw connErr;
        connectedIds = (conns || [])
          .map((c) => (c.actor_from_id === currentActorId ? c.actor_to_id : c.actor_from_id))
          // Never include the current actor itself -- it is not a
          // "connection", it's yourself.
          .filter((id) => id !== currentActorId);
      }

      let query = supabase
        .from('actors')
        .select('*', { count: 'exact' })
        .eq('supply_chain_id', supplyChainId)
        .order('created_at', { ascending: false });

      if (connectedIds !== null) {
        query = connectedIds.length > 0 ? query.in('id', connectedIds) : query.eq('id', '00000000-0000-0000-0000-000000000000');
      }
      if (search) {
        query = query.or(
          `traceability_code.ilike.%${search}%,contact_name.ilike.%${search}%`
        );
      }
      if (actorType) query = query.eq('actor_type', actorType);
      if (country) query = query.eq('country', country);
      if (status) query = query.eq('status', status);

      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;
      if (error) throw error;
      return { rows: data, total: count };
    },
    enabled: !!supplyChainId,
    staleTime: 30_000,
  });
}

export function useActor(id) {
  return useQuery({
    queryKey: ['actor', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('actors').select('*').eq('id', id).single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });
}

// For the actor SWITCHER specifically -- only the actors this person is
// actually an approved team member of (list_my_actors() RPC), not every
// actor in the company. Different from useAllActorsLite, which is used
// for things like "pick a destination actor to send stock to" and
// deliberately shows everyone.
export function useMyActors() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['my-actors', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('list_my_actors');
      if (error) throw error;
      return data;
    },
    enabled: !!user,
    staleTime: 30_000,
  });
}

// Shared "is the actor I'm currently acting as Disabled" state — used by
// Sidebar (banner + switcher visibility) and every Create/Edit/Delete
// entry point across the app so the read-only lockout is enforced
// consistently at the UI level, not just relied on via RLS at submit time.
export function useActingActor() {
  const { profile } = useAuth();
  const { data: myActors = [], isLoading } = useMyActors();
  const currentActor = myActors.find((a) => a.actor_id === profile?.current_actor_id);
  return {
    myActors,
    currentActor,
    isReadOnly: currentActor?.status === 'Disabled',
    isLoading,
  };
}

// Full company directory (bypasses the connections-scoped actors_select
// RLS via the browse_actor_directory() RPC) -- for the 3 flows that must
// legitimately browse EVERY actor regardless of connection status: Add
// Connection's two actor pickers, the Contract wizard's supplier picker,
// and Send's destination picker. You can't create a connection with
// someone you're not yet connected to, so these can't use useActors/
// useAllActorsLite, which are now scoped to actors you already have a
// relationship with.
export function useActorDirectory() {
  const { supplyChainId } = useAuth();
  return useQuery({
    queryKey: ['actor-directory', supplyChainId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('browse_actor_directory');
      if (error) throw error;
      return data;
    },
    enabled: !!supplyChainId,
    staleTime: 30_000,
  });
}

export function useAllActorsLite() {
  const { supplyChainId } = useAuth();
  return useQuery({
    queryKey: ['actors-lite', supplyChainId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('actors')
        .select('id, traceability_code, contact_name, actor_type, logo_url, country, standards')
        .eq('supply_chain_id', supplyChainId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!supplyChainId,
    staleTime: 30_000,
  });
}

export function useCreateActor() {
  const { supplyChainId } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload) => {
      const { data, error } = await supabase
        .from('actors')
        .insert([{ ...payload, supply_chain_id: supplyChainId }])
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['actors'] });
      queryClient.invalidateQueries({ queryKey: ['actors-lite'] });
    },
  });
}

export function useActorTypeCounts({ country = '' } = {}) {
  const { supplyChainId } = useAuth();
  return useQuery({
    queryKey: ['actor-type-counts', supplyChainId, country],
    queryFn: async () => {
      let query = supabase.from('actors').select('actor_type').eq('supply_chain_id', supplyChainId);
      if (country) query = query.eq('country', country);
      const { data, error } = await query;
      if (error) throw error;
      const counts = { Buyer: 0, 'Local Partner': 0, Aggregator: 0, 'Producer Organisation': 0 };
      data.forEach((row) => {
        counts[row.actor_type] = (counts[row.actor_type] || 0) + 1;
      });
      return { total: data.length, byType: counts };
    },
    enabled: !!supplyChainId,
    staleTime: 30_000,
  });
}

export function useUpdateActor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }) => {
      const { data, error } = await supabase
        .from('actors')
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['actors'] });
      queryClient.invalidateQueries({ queryKey: ['actor', data.id] });
    },
  });
}
