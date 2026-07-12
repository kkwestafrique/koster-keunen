import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';

// Team members belong to an actor (organisation). Table: team_members
// (id, actor_id, name, email, role, status, created_at).
export function useTeamMembers(actorId) {
  return useQuery({
    queryKey: ['team_members', actorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('team_members')
        .select('*')
        .eq('actor_id', actorId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!actorId,
    staleTime: 30_000,
  });
}

// Invites a team member with a REAL login — calls the invite-team-member
// edge function (which holds the service-role key needed to create an
// auth.users account) rather than inserting into team_members directly.
// The function itself creates the team_members row too, so a successful
// call here fully replaces what a direct insert used to do.
export function useInviteTeamMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ actorId, name, email, role }) => {
      const { data, error } = await supabase.functions.invoke('invite-team-member', {
        body: {
          name,
          email,
          role,
          actorId,
          redirectTo: `${window.location.origin}/set-up-password`,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data.team_member;
    },
    onSuccess: (_, { actorId }) => queryClient.invalidateQueries({ queryKey: ['team_members', actorId] }),
  });
}

export function useUpdateTeamMemberRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, actorId, role }) => {
      const { data, error } = await supabase
        .from('team_members')
        .update({ role })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, { actorId }) => queryClient.invalidateQueries({ queryKey: ['team_members', actorId] }),
  });
}

export function useRemoveTeamMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }) => {
      const { error } = await supabase.from('team_members').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_, { actorId }) => queryClient.invalidateQueries({ queryKey: ['team_members', actorId] }),
  });
}
