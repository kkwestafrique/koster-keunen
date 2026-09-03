import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import DetailField from '@/components/common/DetailField';
import RequiredLabel from '@/components/common/RequiredLabel';
import AddressFields from '@/components/common/AddressFields';
import PhoneInput from '@/components/common/PhoneInput';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Pencil } from 'lucide-react';
import { useUpdateBeekeeper } from '@/hooks/useBeekeepers';
import { useFindOrCreateVillage } from '@/hooks/useVillages';
import { usePermissions } from '@/hooks/usePermissions';
import { useToast } from '@/hooks/use-toast';
import { getFriendlyErrorMessage } from '@/lib/errorMessages';

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OF_BIRTH_OPTIONS = Array.from({ length: 80 }, (_, i) => CURRENT_YEAR - 18 - i);

function splitPhone(contactPhone) {
  if (!contactPhone) return { dial_code: '', contact_number: '' };
  const parts = contactPhone.trim().split(/\s+/);
  if (parts.length > 1 && parts[0].startsWith('+')) {
    return { dial_code: parts[0], contact_number: parts.slice(1).join(' ') };
  }
  return { dial_code: '', contact_number: contactPhone };
}

// "Beekeeper details" tab: read view + its own separate inline edit
// (description, gender*, year of birth, address, contact info) — same
// fields/order as the Add-flow's steps 1-2, minus national ID/internal
// code/standards/charter/linked org, which live in the header edit instead.
//
// Extracted from BeekeeperDetail.jsx (Gap 23, Low) — see HeaderCard.jsx
// for the full extraction rationale. Pure extraction, no logic changed.
export default function DetailsTab({ bk }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { canEdit } = usePermissions();
  const updateBeekeeper = useUpdateBeekeeper();
  const findOrCreateVillage = useFindOrCreateVillage();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  const startEdit = () => {
    const { dial_code, contact_number } = splitPhone(bk.contact_phone);
    setForm({
      description: bk.description || '',
      gender: bk.gender || '',
      year_of_birth: bk.year_of_birth || '',
      country: bk.villages?.country || '',
      state_region: bk.villages?.state_region || '',
      lga_municipality: bk.villages?.lga_municipality || '',
      village: bk.villages?.name || '',
      contact_email: bk.contact_email || '',
      dial_code, contact_number,
    });
    setEditing(true);
  };

  const set = (key) => (val) => setForm((f) => ({ ...f, [key]: val }));

  const handleSave = async () => {
    setSaving(true);
    try {
      const village_id = await findOrCreateVillage.mutateAsync({
        country: form.country, state_region: form.state_region, lga_municipality: form.lga_municipality, name: form.village,
      });
      const contact_phone = form.dial_code && form.contact_number ? `${form.dial_code} ${form.contact_number}` : form.contact_number;
      await updateBeekeeper.mutateAsync({
        id: bk.id,
        description: form.description || null,
        gender: form.gender,
        year_of_birth: form.year_of_birth ? Number(form.year_of_birth) : null,
        contact_email: form.contact_email || null,
        contact_phone,
        village_id,
      });
      toast({ title: t('companyProfile.saved') });
      setEditing(false);
    } catch (err) {
      toast({ title: t('companyProfile.saveFailed'), description: getFriendlyErrorMessage(err), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (!editing) {
    return (
      <div data-testid="bk-details-tab-view">
        <p className="text-xs text-[#5a6f9a] mb-1">{t('beekeeperDetail.description')}</p>
        <p className="text-sm text-[#032b71] mb-5">{bk.description || '-'}</p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-5">
          <DetailField label={t('beekeepersList.gender')} value={bk.gender} testId="bk-field-gender" />
          <DetailField label={t('forms.yearOfBirth')} value={bk.year_of_birth} testId="bk-field-yob" />
        </div>

        <h3 className="text-sm font-black text-[#032b71] mb-3">{t('actorProfile.address')}</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-5">
          <DetailField label={t('actorProfile.country')} value={bk.villages?.country} testId="bk-field-country" />
          <DetailField label={t('actorProfile.stateRegion')} value={bk.villages?.state_region} testId="bk-field-state" />
          <DetailField label={t('actorProfile.lga')} value={bk.villages?.lga_municipality} testId="bk-field-lga" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-5">
          <DetailField label={t('actorProfile.village')} value={bk.villages?.name} testId="bk-field-village" />
        </div>

        <h3 className="text-sm font-black text-[#032b71] mb-3">{t('actorProfile.contactInformation')}</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <DetailField label={t('actorProfile.contactEmail')} value={bk.contact_email} testId="bk-field-email" />
          <DetailField label={t('actorProfile.contactNumber')} value={bk.contact_phone} testId="bk-field-phone" />
        </div>

        {canEdit && (
          <Button variant="outline" data-testid="bk-details-edit-button" className="border-[#0f48aa] text-[#0f48aa] bg-white" onClick={startEdit}>
            <Pencil className="h-4 w-4 mr-1" /> {t('beekeeperDetail.editBeekeeperDetails')}
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4" data-testid="bk-details-tab-edit">
      <div className="flex flex-col gap-1.5">
        <RequiredLabel required={false}>{t('beekeeperDetail.description')}</RequiredLabel>
        <Textarea data-testid="bk-details-edit-description" className="bg-white" value={form.description} onChange={(e) => set('description')(e.target.value)} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <RequiredLabel required spaced={false}>{t('forms.gender')}</RequiredLabel>
          <Select value={form.gender} onValueChange={set('gender')}>
            <SelectTrigger data-testid="bk-details-edit-gender" className="bg-white"><SelectValue placeholder={t('forms.selectGender')} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Male">{t('common.male')}</SelectItem>
              <SelectItem value="Female">{t('common.female')}</SelectItem>
              <SelectItem value="Other">{t('common.other')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <RequiredLabel required={false}>{t('forms.yearOfBirth')}</RequiredLabel>
          <Select value={form.year_of_birth ? String(form.year_of_birth) : ''} onValueChange={set('year_of_birth')}>
            <SelectTrigger data-testid="bk-details-edit-yob" className="bg-white"><SelectValue placeholder={t('forms.selectYearOfBirth')} /></SelectTrigger>
            <SelectContent className="max-h-60">
              {YEAR_OF_BIRTH_OPTIONS.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <h3 className="text-sm font-black text-[#032b71]">{t('actorProfile.address')}</h3>
      <div className="grid grid-cols-2 gap-4">
        <AddressFields
          testIdPrefix="bk-details-edit"
          value={{ country: form.country, state_region: form.state_region, lga_municipality: form.lga_municipality, village: form.village }}
          onChange={(addr) => setForm((f) => ({ ...f, ...addr }))}
        />
      </div>

      <h3 className="text-sm font-black text-[#032b71]">{t('actorProfile.contactInformation')}</h3>
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <RequiredLabel required={false}>{t('actorProfile.contactEmail')}</RequiredLabel>
          <Input type="email" className="bg-white" data-testid="bk-details-edit-email" value={form.contact_email} onChange={(e) => set('contact_email')(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <RequiredLabel required>{t('actorProfile.contactNumber')}</RequiredLabel>
          <PhoneInput testIdPrefix="bk-details-edit-phone" dialCode={form.dial_code} number={form.contact_number} onDialCodeChange={set('dial_code')} onNumberChange={set('contact_number')} country={form.country} />
        </div>
      </div>

      <div className="flex gap-3">
        <Button type="button" variant="outline" data-testid="bk-details-edit-discard" className="border-[#0f48aa] text-[#0f48aa] bg-white" onClick={() => setEditing(false)}>
          {t('companyProfile.discard')}
        </Button>
        <Button type="button" data-testid="bk-details-edit-save" disabled={saving} onClick={handleSave} className="bg-[#0f48aa] text-white hover:bg-[#0d3d91]">
          {saving ? t('forms.saving') : t('companyProfile.saveChanges')}
        </Button>
      </div>
    </div>
  );
}
