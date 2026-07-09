import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import DetailField from '@/components/common/DetailField';
import StatusBadge from '@/components/common/StatusBadge';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Pencil } from 'lucide-react';
import { useBeekeeper } from '@/hooks/useBeekeepers';

export default function BeekeeperDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: bk, isLoading } = useBeekeeper(id);

  if (isLoading || !bk) {
    return (
      <AppLayout title="Beekeeper Detail">
        <p className="text-[#7089b4]">Loading...</p>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Beekeeper Detail">
      <button
        data-testid="back-button"
        onClick={() => navigate(-1)}
        className="flex items-center gap-1 text-sm text-[#7089b4] mb-4 hover:text-[#0f48aa]"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      <div className="bg-[#ebf6ff] border border-[#cfd8e6] rounded-[5px] p-6" data-testid="beekeeper-detail-card">
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-md bg-white border border-[#cfd8e6] flex items-center justify-center">
              <span className="text-[#0f48aa] font-black text-xl">{bk.full_name?.[0]}</span>
            </div>
            <div>
              <h2 className="text-xl font-black text-[#032b71]" data-testid="beekeeper-detail-name">{bk.full_name}</h2>
              <p className="text-sm text-[#7089b4]" data-testid="beekeeper-detail-code">{bk.traceability_code}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge status={bk.status} />
            <Button variant="outline" disabled className="border-[#0f48aa] text-[#0f48aa] bg-white">
              <Pencil className="h-4 w-4 mr-1" /> Edit
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
          <DetailField label="Gender" value={bk.gender} testId="bk-field-gender" />
          <DetailField label="Village" value={bk.villages?.name} testId="bk-field-village" />
          <DetailField label="Organisation" value={bk.actors?.contact_name} testId="bk-field-actor" />
          <DetailField label="Traditional Single Hives" value={bk.hives_traditional_single} testId="bk-field-hts" />
          <DetailField label="Traditional Double Hives" value={bk.hives_traditional_double} testId="bk-field-htd" />
          <DetailField label="Modern Hives" value={bk.hives_modern} testId="bk-field-modern" />
          <DetailField label="Other Hives" value={bk.hives_other} testId="bk-field-other" />
          <DetailField label="Total Hives" value={bk.total_hives} testId="bk-field-total" />
          <DetailField label="Active Years" value={bk.active_years} testId="bk-field-years" />
        </div>
      </div>
    </AppLayout>
  );
}
