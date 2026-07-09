import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import DetailField from '@/components/common/DetailField';
import StatusBadge from '@/components/common/StatusBadge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Pencil } from 'lucide-react';
import { useActor, useUpdateActor } from '@/hooks/useActors';
import { useBeekeepers } from '@/hooks/useBeekeepers';
import { useConnections } from '@/hooks/useConnections';
import { useToast } from '@/hooks/use-toast';

export default function ActorDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: actor, isLoading } = useActor(id);
  const updateActor = useUpdateActor();
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(null);

  const { data: beekeepers } = useBeekeepers({ page: 1 });
  const { data: connections } = useConnections({ page: 1 });

  const linkedBeekeepers = (beekeepers?.rows || []).filter((b) => b.actor_id === id);
  const linkedConnections = (connections?.rows || []).filter(
    (c) => c.actor_from_id === id || c.actor_to_id === id
  );

  const startEdit = () => {
    setForm({ ...actor });
    setEditing(true);
  };

  const handleSave = async () => {
    try {
      await updateActor.mutateAsync({ id, ...form });
      toast({ title: 'Actor updated' });
      setEditing(false);
    } catch (err) {
      toast({ title: 'Update failed', description: err.message, variant: 'destructive' });
    }
  };

  if (isLoading || !actor) {
    return (
      <AppLayout title="Actor Detail">
        <p className="text-[#7089b4]">Loading...</p>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Actor Detail">
      <button
        data-testid="back-button"
        onClick={() => navigate(-1)}
        className="flex items-center gap-1 text-sm text-[#7089b4] mb-4 hover:text-[#0f48aa]"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      <div className="bg-[#ebf6ff] border border-[#cfd8e6] rounded-[5px] p-6 mb-6" data-testid="actor-detail-card">
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-md bg-white border border-[#cfd8e6] flex items-center justify-center overflow-hidden">
              {actor.logo_url ? (
                <img src={actor.logo_url} alt="logo" className="h-full w-full object-cover" data-testid="actor-logo" />
              ) : (
                <span className="text-[#0f48aa] font-black text-xl">{actor.contact_name?.[0]}</span>
              )}
            </div>
            <div>
              <h2 className="text-xl font-black text-[#032b71]" data-testid="actor-detail-name">{actor.contact_name}</h2>
              <p className="text-sm text-[#7089b4]" data-testid="actor-detail-code">{actor.traceability_code}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge status={actor.status} />
            {!editing ? (
              <Button
                data-testid="actor-edit-button"
                variant="outline"
                onClick={startEdit}
                className="border-[#0f48aa] text-[#0f48aa] bg-white hover:bg-[#f5f5f5]"
              >
                <Pencil className="h-4 w-4 mr-1" /> Edit
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button variant="outline" className="border-[#0f48aa] text-[#0f48aa]" onClick={() => setEditing(false)}>Cancel</Button>
                <Button data-testid="actor-save-button" className="bg-[#0f48aa] text-white" onClick={handleSave}>Save</Button>
              </div>
            )}
          </div>
        </div>

        <div className="mb-6">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-[#7089b4]">Profile Completeness</span>
            <span className="text-xs text-[#032b71] font-medium">{actor.profile_completeness ?? 0}%</span>
          </div>
          <Progress
            value={actor.profile_completeness ?? 0}
            data-testid="actor-profile-progress"
            className="bg-[#c5cae9] [&>div]:bg-[#0f48aa]"
          />
        </div>

        {!editing ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
            <DetailField label="Actor Type" value={actor.actor_type} testId="actor-field-type" />
            <DetailField label="Country" value={actor.country} testId="actor-field-country" />
            <DetailField label="State / Region" value={actor.state_region} testId="actor-field-state" />
            <DetailField label="LGA / Municipality" value={actor.lga_municipality} testId="actor-field-lga" />
            <DetailField label="Village" value={actor.village} testId="actor-field-village" />
            <DetailField label="Charter Signed" value={actor.charter_signed ? 'Yes' : 'No'} testId="actor-field-charter" />
            <DetailField label="Contact Email" value={actor.contact_email} testId="actor-field-email" />
            <DetailField label="Contact Phone" value={actor.contact_phone} testId="actor-field-phone" />
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {['country', 'state_region', 'lga_municipality', 'village', 'contact_email', 'contact_phone'].map((key) => (
              <div key={key} className="flex flex-col gap-1.5">
                <Label className="text-[#7089b4] capitalize">{key.replace(/_/g, ' ')}</Label>
                <Input
                  data-testid={`actor-edit-${key}`}
                  value={form?.[key] || ''}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      <Tabs defaultValue="beekeepers">
        <TabsList className="bg-transparent border border-[#cfd8e6] p-0 rounded-[5px]">
          <TabsTrigger
            value="beekeepers"
            data-testid="actor-tab-beekeepers"
            className="data-[state=active]:bg-[#0f48aa] data-[state=active]:text-white text-[#032b71]"
          >
            Beekeepers ({linkedBeekeepers.length})
          </TabsTrigger>
          <TabsTrigger
            value="connections"
            data-testid="actor-tab-connections"
            className="data-[state=active]:bg-[#0f48aa] data-[state=active]:text-white text-[#032b71]"
          >
            Connections ({linkedConnections.length})
          </TabsTrigger>
        </TabsList>
        <TabsContent value="beekeepers" className="bg-white border border-[#cfd8e6] rounded-[5px] p-4">
          {linkedBeekeepers.length === 0 ? (
            <p className="text-sm text-[#7089b4]">No linked beekeepers.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {linkedBeekeepers.map((b) => (
                <li key={b.id} className="text-sm text-[#032b71]" data-testid={`actor-linked-beekeeper-${b.id}`}>
                  {b.full_name} — {b.traceability_code}
                </li>
              ))}
            </ul>
          )}
        </TabsContent>
        <TabsContent value="connections" className="bg-white border border-[#cfd8e6] rounded-[5px] p-4">
          {linkedConnections.length === 0 ? (
            <p className="text-sm text-[#7089b4]">No connections.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {linkedConnections.map((c) => (
                <li key={c.id} className="text-sm text-[#032b71]" data-testid={`actor-linked-connection-${c.id}`}>
                  {c.connection_type} — {c.year} <StatusBadge status={c.status} />
                </li>
              ))}
            </ul>
          )}
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
}
