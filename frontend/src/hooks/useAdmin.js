// Real database access for the Admin panel, extracted out of
// pages/admin/AdminPanel.jsx -- pages in this project shouldn't talk to
// Supabase directly; that belongs in a dedicated hook file, matching
// every other page's own convention. Kept as one small file (not a
// whole feature-module directory) since there's no real computation
// here to separate out -- both are plain list queries.

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';

export function useAllTeamMembers() {
  return useQuery({
    queryKey: ['admin', 'all-team-members'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('team_members')
        .select('id, name, email, role, status, created_at, actors(traceability_code, contact_name)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useAllVillages() {
  return useQuery({
    queryKey: ['admin', 'all-villages'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('villages')
        .select('id, name, country, state_region, lga_municipality')
        .order('country', { ascending: true });
      if (error) throw error;
      return data;
    },
  });
}
