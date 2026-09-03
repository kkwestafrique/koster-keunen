import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import DetailField from '@/components/common/DetailField';
import RequiredLabel from '@/components/common/RequiredLabel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { ChevronDown, ChevronUp, Pencil } from 'lucide-react';
import { COMMITMENT_OF_BEEKEEPER, HIVE_SPREAD_CROPS } from '@/data/regions';
import { useUpdateBeekeeper, useBeekeeperYearlyRecords } from '@/hooks/useBeekeepers';
import { usePermissions } from '@/hooks/usePermissions';
import { useToast } from '@/hooks/use-toast';
import { getFriendlyErrorMessage } from '@/lib/errorMessages';

const CURRENT_YEAR = new Date().getFullYear();

// "Overview" tab: current-year stats + inline edit (Commitment of
// beekeeper*, hive counts, hive spread per crop), plus the expandable
// "Previous year details" history table kept in sync by the DB trigger.
//
// Extracted from BeekeeperDetail.jsx (Gap 23, Low) — see HeaderCard.jsx
// for the full extraction rationale. Pure extraction, no logic changed.
export default function OverviewTab({ bk }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { canEdit } = usePermissions();
  const updateBeekeeper = useUpdateBeekeeper();
  const { data: yearlyRecords = [] } = useBeekeeperYearlyRecords(bk.id);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [expandedYear, setExpandedYear] = useState(null);

  const current = yearlyRecords.find((r) => r.year === CURRENT_YEAR) || yearlyRecords[0];
  const history = yearlyRecords.filter((r) => r.year !== current?.year);

  const startEdit = () => {
    setForm({
      commitment: bk.commitment || [],
      hives_traditional_single: bk.hives_traditional_single || 0,
      hives_traditional_double: bk.hives_traditional_double || 0,
      hives_modern: bk.hives_modern || 0,
      hives_other: bk.hives_other || 0,
      hive_cashew: bk.hive_cashew || 0,
      hive_mango: bk.hive_mango || 0,
      hive_shea: bk.hive_shea || 0,
      hive_forest: bk.hive_forest || 0,
      hive_other_forage: bk.hive_other_forage || 0,
    });
    setEditing(true);
  };

  const set = (key) => (val) => setForm((f) => ({ ...f, [key]: val }));
  const toggleCommitment = (c) => setForm((f) => ({
    ...f,
    commitment: f.commitment.includes(c) ? f.commitment.filter((x) => x !== c) : [...f.commitment, c],
  }));

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateBeekeeper.mutateAsync({
        id: bk.id,
        commitment: form.commitment,
        hives_traditional_single: Number(form.hives_traditional_single),
        hives_traditional_double: Number(form.hives_traditional_double),
        hives_modern: Number(form.hives_modern),
        hives_other: Number(form.hives_other),
        hive_cashew: Number(form.hive_cashew),
        hive_mango: Number(form.hive_mango),
        hive_shea: Number(form.hive_shea),
        hive_forest: Number(form.hive_forest),
        hive_other_forage: Number(form.hive_other_forage),
      });
      toast({ title: t('companyProfile.saved') });
      setEditing(false);
    } catch (err) {
      toast({ title: t('companyProfile.saveFailed'), description: getFriendlyErrorMessage(err), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
    return (
      <div className="flex flex-col gap-4" data-testid="bk-overview-edit">
        <div className="flex flex-col gap-1.5">
          <RequiredLabel required spaced={false}>{t('forms.commitmentOfBeekeeper')}</RequiredLabel>
          <div className="flex gap-6">
            {COMMITMENT_OF_BEEKEEPER.map((c) => (
              <label key={c} className="flex items-center gap-2 text-sm text-[#032b71] cursor-pointer">
                <Checkbox data-testid={`bk-overview-edit-commitment-${c}`} checked={form.commitment.includes(c)} onCheckedChange={() => toggleCommitment(c)} /> {c}
              </label>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <RequiredLabel required spaced={false}>{t('forms.totalHivesInstalled')}</RequiredLabel>
          <div className="grid grid-cols-4 gap-3">
            <Input type="number" min="0" data-testid="bk-overview-edit-hts" value={form.hives_traditional_single} onChange={(e) => set('hives_traditional_single')(e.target.value)} />
            <Input type="number" min="0" data-testid="bk-overview-edit-htd" value={form.hives_traditional_double} onChange={(e) => set('hives_traditional_double')(e.target.value)} />
            <Input type="number" min="0" data-testid="bk-overview-edit-modern" value={form.hives_modern} onChange={(e) => set('hives_modern')(e.target.value)} />
            <Input type="number" min="0" data-testid="bk-overview-edit-other" value={form.hives_other} onChange={(e) => set('hives_other')(e.target.value)} />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <RequiredLabel required spaced={false}>{t('forms.hiveSpreadPerCrop')}</RequiredLabel>
          <div className="grid grid-cols-5 gap-3">
            {HIVE_SPREAD_CROPS.map((crop) => {
              const key = `hive_${crop.toLowerCase().replace(' ', '_')}`;
              return <Input key={crop} type="number" min="0" data-testid={`bk-overview-edit-crop-${crop}`} value={form[key] ?? 0} onChange={(e) => set(key)(e.target.value)} />;
            })}
          </div>
        </div>

        {/* Same live-totals fix as the Add Beekeeper wizard -- the
            underlying database rule (these two totals must match, or
            the crop total must be zero) is kept exactly as Babs
            confirmed; this just shows both running totals before
            submission instead of only failing after. */}
        {(() => {
          const hiveTypeTotal = ['hives_traditional_single', 'hives_traditional_double', 'hives_modern', 'hives_other']
            .reduce((sum, k) => sum + (Number(form[k]) || 0), 0);
          const cropTotal = HIVE_SPREAD_CROPS
            .map((crop) => `hive_${crop.toLowerCase().replace(' ', '_')}`)
            .reduce((sum, k) => sum + (Number(form[k]) || 0), 0);
          const matches = cropTotal === 0 || hiveTypeTotal === cropTotal;
          return (
            <p
              className={`text-xs ${matches ? 'text-[#5a6f9a]' : 'text-[#ba550c] font-medium'}`}
              data-testid="bk-overview-edit-hive-totals"
            >
              {t('forms.totalHivesByType')}: {hiveTypeTotal} · {t('forms.totalHivesByCrop')}: {cropTotal}
              {!matches && ` — ${t('forms.hiveTotalsMustMatch')}`}
            </p>
          );
        })()}

        <div className="flex gap-3">
          <Button type="button" variant="outline" data-testid="bk-overview-edit-discard" className="border-[#0f48aa] text-[#0f48aa] bg-white" onClick={() => setEditing(false)}>
            {t('companyProfile.discard')}
          </Button>
          <Button type="button" data-testid="bk-overview-edit-save" disabled={saving} onClick={handleSave} className="bg-[#0f48aa] text-white hover:bg-[#0d3d91]">
            {saving ? t('forms.saving') : t('companyProfile.saveChanges')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div data-testid="bk-overview-view">
      <div className="flex items-start justify-between mb-4">
        <div className="flex flex-wrap gap-x-12 gap-y-3">
          <DetailField label={t('beekeeperDetail.year')} value={current?.year} testId="bk-overview-year" />
          <DetailField label={t('forms.commitmentOfBeekeeper')} value={(bk.commitment || []).join(', ') || '-'} testId="bk-overview-commitment" />
        </div>
        {canEdit && (
          <Button variant="outline" data-testid="bk-overview-edit-button" className="border-[#0f48aa] text-[#0f48aa] bg-white" onClick={startEdit}>
            <Pencil className="h-4 w-4 mr-1" /> {t('companyProfile.update')}
          </Button>
        )}
      </div>

      <p className="text-xs text-[#5a6f9a] mb-2">{t('forms.hiveSpreadPerCrop')}</p>
      <div className="flex flex-wrap gap-3 mb-6">
        {HIVE_SPREAD_CROPS.map((crop) => {
          const key = `hive_${crop.toLowerCase().replace(' ', '_')}`;
          const count = bk[key] || 0;
          if (!count) return null;
          return (
            <span key={crop} className="inline-flex items-center gap-2 bg-[#ebf6ff] rounded-full px-3 py-1 text-sm text-[#032b71]" data-testid={`bk-overview-crop-pill-${crop}`}>
              {crop} <span className="bg-[#0f48aa] text-white rounded-full text-xs font-bold w-5 h-5 flex items-center justify-center">{count}</span>
            </span>
          );
        })}
      </div>

      <p className="text-xs text-[#5a6f9a] mb-2">{t('beekeeperDetail.totalBeehivesInstalled')}</p>
      <div className="grid grid-cols-5 gap-3 mb-8">
        {[
          [t('beekeeperDetail.totalHives'), bk.total_hives],
          [t('beekeeperDetail.traditionalSingleHives'), bk.hives_traditional_single],
          [t('beekeeperDetail.traditionalDoubleHives'), bk.hives_traditional_double],
          [t('beekeeperDetail.modernHives'), bk.hives_modern],
          [t('beekeeperDetail.otherHives'), bk.hives_other],
        ].map(([label, value]) => (
          <div key={label} className="bg-[#ebf6ff] border border-[#cfd8e6] rounded-[5px] p-3 text-center">
            <p className="text-lg font-black text-[#032b71]">{value ?? 0}</p>
            <p className="text-xs text-[#5a6f9a]">{label}</p>
          </div>
        ))}
      </div>

      <h3 className="text-sm font-black text-[#032b71] mb-3">{t('beekeeperDetail.previousYearDetails')}</h3>
      {history.length === 0 ? (
        <p className="text-sm text-[#5a6f9a]">{t('common.noRecordsFound')}</p>
      ) : (
        <table className="w-full text-sm" data-testid="bk-previous-years-table">
          <thead>
            <tr className="text-left text-[#5a6f9a] border-b border-[#cfd8e6]">
              <th className="py-2 w-8"></th>
              <th className="py-2">{t('beekeeperDetail.year')}</th>
              <th className="py-2">{t('beekeeperDetail.lastUpdatedOn')}</th>
              <th className="py-2">{t('forms.commitmentOfBeekeeper')}</th>
              <th className="py-2">{t('forms.hiveSpreadPerCrop')}</th>
              <th className="py-2">{t('beekeeperDetail.totalHives')}</th>
            </tr>
          </thead>
          <tbody>
            {history.map((r) => {
              const expanded = expandedYear === r.year;
              return (
                <React.Fragment key={r.year}>
                  <tr className="border-b border-[#f0f0f0] text-[#032b71] cursor-pointer" onClick={() => setExpandedYear(expanded ? null : r.year)} data-testid={`bk-year-row-${r.year}`}>
                    <td className="py-2">{expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</td>
                    <td className="py-2">{r.year}</td>
                    <td className="py-2">{r.updated_at?.slice(0, 10)}</td>
                    <td className="py-2">{(r.commitment || []).join(', ') || '-'}</td>
                    <td className="py-2">
                      {HIVE_SPREAD_CROPS.map((crop) => {
                        const key = `hive_${crop.toLowerCase().replace(' ', '_')}`;
                        return r[key] ? `${crop} ${r[key]}` : null;
                      }).filter(Boolean).join(', ') || '-'}
                    </td>
                    <td className="py-2">{r.total_hives}</td>
                  </tr>
                  {expanded && (
                    <tr className="border-b border-[#f0f0f0] bg-[#f9fbfd]" data-testid={`bk-year-row-${r.year}-expanded`}>
                      <td></td>
                      <td colSpan={5} className="py-3">
                        <div className="grid grid-cols-5 gap-4 text-sm">
                          <DetailField label={t('beekeeperDetail.traditionalSingleHives')} value={r.hives_traditional_single} />
                          <DetailField label={t('beekeeperDetail.traditionalDoubleHives')} value={r.hives_traditional_double} />
                          <DetailField label={t('beekeeperDetail.modernHives')} value={r.hives_modern} />
                          <DetailField label={t('beekeeperDetail.otherHives')} value={r.hives_other} />
                          <DetailField label={t('actorProfile.charterSigned')} value={r.charter_signed ? t('common.yes') : t('common.no')} />
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
