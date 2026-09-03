import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import DetailField from '@/components/common/DetailField';
import StandardBadge from '@/components/common/StandardBadge';
import SubmitClaimDialog from '@/components/common/SubmitClaimDialog';
import RequiredLabel from '@/components/common/RequiredLabel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Pencil } from 'lucide-react';
import { useUpdateBeekeeper } from '@/hooks/useBeekeepers';
import { useAllActorsLite } from '@/hooks/useActors';
import { useClaimsForEntity } from '@/hooks/useClaims';
import { usePermissions } from '@/hooks/usePermissions';
import { useToast } from '@/hooks/use-toast';
import { getFriendlyErrorMessage } from '@/lib/errorMessages';

// Header card: read view + inline edit (Beekeeper full name*, National ID,
// Internal code, conditional Sustainable Beekeeper charter* checkbox,
// Linked producer organisation) — matches the live site's header Edit
// button, which is a DIFFERENT edit surface than the nested "Edit
// beekeeper details" button on the Details tab (audit finding).
//
// Standards are deliberately NOT editable here anymore. They used to be
// plain checkboxes writing straight to bk.standards -- no evidence, no
// review, a live bypass of the claims verification workflow this app
// otherwise enforces (see guard_standards_update in the DB and
// SubmitClaimDialog for the real submission path). The database now
// rejects a direct write to that column outright; this form just no
// longer offers it.
//
// Extracted from BeekeeperDetail.jsx (Gap 23, Low): that file had grown
// to 652 lines across four page-level components living in one file.
// Split into sibling files, matching the existing convention already
// used for CompanyProfile.jsx / SharingPanel.jsx in this same codebase
// (co-located sibling files, not a subfolder). Pure extraction — no
// logic or JSX changed.
export default function HeaderCard({ bk }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { canEdit } = usePermissions();
  const updateBeekeeper = useUpdateBeekeeper();
  const { data: actors = [] } = useAllActorsLite();
  const { data: claims = [] } = useClaimsForEntity('beekeeper', bk.id);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  const pendingStandards = claims.filter((c) => c.status === 'Pending').map((c) => c.standard);

  const startEdit = () => {
    setForm({
      full_name: bk.full_name || '',
      national_id: bk.national_id || '',
      internal_code: bk.internal_code || '',
      charter_signed: bk.charter_signed || false,
      linked_producer_organisation_id: bk.linked_producer_organisation_id || '',
    });
    setEditing(true);
  };

  const set = (key) => (val) => setForm((f) => ({ ...f, [key]: val }));

  const charterRequired = (bk.standards || []).includes('Sustainable');

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateBeekeeper.mutateAsync({ id: bk.id, ...form });
      toast({ title: t('companyProfile.saved') });
      setEditing(false);
    } catch (err) {
      toast({ title: t('companyProfile.saveFailed'), description: getFriendlyErrorMessage(err), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-[#ebf6ff] border border-[#cfd8e6] rounded-[5px] p-6 mb-6" data-testid="beekeeper-header-card">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-full bg-white border border-[#cfd8e6] flex items-center justify-center shrink-0">
            <span className="text-[#0f48aa] font-black text-xl">{bk.full_name?.[0]}</span>
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="text-xl font-black text-[#032b71]" data-testid="beekeeper-header-name">{bk.full_name}</h2>
              {(bk.standards || []).map((s) => <StandardBadge key={s} standard={s} />)}
              {pendingStandards.map((s) => (
                <span key={s} className="text-sm font-bold text-[#5a6f9a]" data-testid={`bk-pending-standard-${s}`}>
                  {s} ({t('verification.pending')})
                </span>
              ))}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canEdit && (
            <SubmitClaimDialog
              entityType="beekeeper"
              entityId={bk.id}
              currentStandards={bk.standards || []}
              pendingStandards={pendingStandards}
              testId="bk-submit-claim-trigger"
            />
          )}
          {!editing && canEdit && (
            <Button variant="outline" data-testid="beekeeper-edit-button" className="border-[#0f48aa] text-[#0f48aa] bg-white hover:bg-[#f5f5f5]" onClick={startEdit}>
              <Pencil className="h-4 w-4 mr-1" /> {t('actorProfile.edit')}
            </Button>
          )}
        </div>
      </div>

      {!editing ? (
        <div className="flex flex-wrap gap-x-12 gap-y-3">
          <DetailField label={t('beekeeperDetail.nationalId')} value={bk.national_id} testId="bk-header-national-id" />
          <DetailField label={t('actorProfile.traceabilityCode')} value={bk.traceability_code} testId="bk-header-code" />
          <DetailField label={t('forms.internalCode')} value={bk.internal_code} testId="bk-header-internal-code" />
          <DetailField label={t('actorProfile.charterSigned')} value={bk.charter_signed ? t('common.yes') : t('common.no')} testId="bk-header-charter" />
          <DetailField label={t('forms.linkedProducerOrganisation')} value={bk.linked_producer_organisation_actor?.contact_name || bk.linked_producer_organisation} testId="bk-header-linked-org" />
        </div>
      ) : (
        <div className="flex flex-col gap-4" data-testid="beekeeper-header-edit-form">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <RequiredLabel required>{t('forms.beekeeperFullName')}</RequiredLabel>
              <Input className="bg-white" data-testid="bk-header-edit-name" value={form.full_name} onChange={(e) => set('full_name')(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <RequiredLabel required={false}>{t('beekeeperDetail.nationalId')}</RequiredLabel>
              <Input className="bg-white" data-testid="bk-header-edit-national-id" value={form.national_id} onChange={(e) => set('national_id')(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <RequiredLabel required={false}>{t('forms.internalCode')}</RequiredLabel>
              <Input className="bg-white" data-testid="bk-header-edit-internal-code" value={form.internal_code} onChange={(e) => set('internal_code')(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <RequiredLabel required={false}>{t('forms.linkedProducerOrganisation')}</RequiredLabel>
              <Select value={form.linked_producer_organisation_id} onValueChange={(v) => set('linked_producer_organisation_id')(v)}>
                <SelectTrigger className="bg-white" data-testid="bk-header-edit-linked-org"><SelectValue placeholder={t('forms.linkedProducerOrganisation')} /></SelectTrigger>
                <SelectContent>
                  {actors.map((a) => <SelectItem key={a.id} value={a.id}>{a.contact_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <RequiredLabel required={charterRequired}>{t('forms.sustainableBeekeeperCharter')}</RequiredLabel>
            <label className="flex items-center gap-2 text-sm text-[#032b71] cursor-pointer">
              <Checkbox data-testid="bk-header-edit-charter" checked={form.charter_signed} onCheckedChange={set('charter_signed')} /> {t('forms.readAndApprove')}
            </label>
            <a
              href="/beekeeper-charter"
              target="_blank"
              rel="noopener noreferrer"
              data-testid="bk-header-charter-link"
              className="text-xs text-[#0f48aa] hover:underline w-fit"
            >
              {t('charter.readCharter')}
            </a>
          </div>

          <div className="flex gap-3">
            <Button type="button" variant="outline" data-testid="bk-header-edit-discard" className="border-[#0f48aa] text-[#0f48aa] bg-white" onClick={() => setEditing(false)}>
              {t('companyProfile.discard')}
            </Button>
            <Button type="button" data-testid="bk-header-edit-save" disabled={saving} onClick={handleSave} className="bg-[#0f48aa] text-white hover:bg-[#0d3d91]">
              {saving ? t('forms.saving') : t('companyProfile.saveChanges')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
