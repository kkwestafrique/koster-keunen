import React from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useActors } from '@/hooks/useActors';
import { useBeekeepers } from '@/hooks/useBeekeepers';
import { useVillages } from '@/hooks/useVillages';
import { useConnections } from '@/hooks/useConnections';
import { Users, UserRound, MapPin, Link2 } from 'lucide-react';

function StatCard({ icon: Icon, label, value, testId }) {
  return (
    <div
      data-testid={testId}
      className="bg-white border border-[#cfd8e6] rounded-[5px] p-5 flex items-center gap-4"
    >
      <div className="h-11 w-11 rounded-md bg-[#ebf6ff] flex items-center justify-center">
        <Icon className="h-5 w-5 text-[#0f48aa]" />
      </div>
      <div>
        <p className="text-xs text-[#7089b4]">{label}</p>
        <p className="text-2xl font-black text-[#032b71]">{value ?? '—'}</p>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { profile } = useAuth();
  const { data: actors } = useActors({ page: 1 });
  const { data: beekeepers } = useBeekeepers({ page: 1 });
  const { data: villages } = useVillages({ page: 1 });
  const { data: connections } = useConnections({ page: 1 });

  return (
    <AppLayout title="Dashboard">
      <p className="text-sm text-[#7089b4] mb-6" data-testid="dashboard-welcome">
        Welcome back, {profile?.username || 'there'}.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Users} label="Total Actors" value={actors?.total} testId="stat-actors" />
        <StatCard
          icon={UserRound}
          label="Total Beekeepers"
          value={beekeepers?.total}
          testId="stat-beekeepers"
        />
        <StatCard icon={MapPin} label="Villages" value={villages?.total} testId="stat-villages" />
        <StatCard
          icon={Link2}
          label="Connections"
          value={connections?.total}
          testId="stat-connections"
        />
      </div>
    </AppLayout>
  );
}
