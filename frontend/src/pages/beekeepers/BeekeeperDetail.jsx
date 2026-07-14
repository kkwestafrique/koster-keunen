import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import AppLayout from '@/components/layout/AppLayout';
import DetailField from '@/components/common/DetailField';
import StandardBadge from '@/components/common/StandardBadge';
import RequiredLabel from '@/components/common/RequiredLabel';
import AddressFields from '@/components/common/AddressFields';
import PhoneInput from '@/components/common/PhoneInput';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronLeft, ChevronDown, ChevronUp, Pencil } from 'lucide-react';
import { STANDARDS, COMMITMENT_OF_BEEKEEPER, HIVE_SPREAD_CROPS } from '@/data/regions';
import { useBeekeeper, useUpdateBeekeeper, useBeekeeperYearlyRecords } from '@/hooks/useBeekeepers';
import { useBeekeeperTransactions } from '@/hooks/useTransactions';
import { useFindOrCreateVillage } from '@/hooks/useVillages';
import { useToast } from '@/hooks/use-toast';

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

// Header card: read view + inline edit (Beekeeper full name*, National ID,
// Internal code, Add standards* checkboxes, conditional Sustainable
// Beekeeper charter* checkbox, Linked producer organisation) — matches the
// live site's header Edit button, which is a DIFFERENT edit surface than
// the nested "Edit beekeeper details" button further down (audit finding).
function HeaderCard({ bk }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const updateBeekeeper = useUpdateBeekeeper();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  const startEdit = () => {
    setForm({
      full_name: bk.full_name || '',
      national_id: bk.national_id || '',
      internal_code: bk.internal_code || '',
      standards: bk.standards || [],
      charter_signed: bk.charter_signed || false,
      linked_producer_organisation: bk.linked_producer_organisation || '',
    });
    setEditing(true);
  };

  const set = (key) => (val) => setForm((f) => ({ ...f, [key]: val }));
  const toggleStandard = (std) => setForm((f) => ({
    ...f,
    standards: f.standards.includes(std) ? f.standards.filter((s) => s !== std) : [...f.standards, std],
  }));

  const charterRequired = form?.standards.includes('Sustainable');

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateBeekeeper.mutateAsync({ id: bk.id, ...form });
      toast({ title: t('companyProfile.saved') });
      setEditing(false);
    } catch (err) {
      toast({ title: t('companyProfile.saveFailed'), description: err.message, variant: 'destructive' });
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
            </div>
          </div>
        </div>
        {!editing && (
          <Button variant="outline" data-testid="beekeeper-edit-button" className="border-[#0f48aa] text-[#0f48aa] bg-white hover:bg-[#f5f5f5]" onClick={startEdit}>
            <Pencil className="h-4 w-4 mr-1" /> {t('actorProfile.edit')}
          </Button>
        )}
      </div>

      {!editing ? (
        <div className="flex flex-wrap gap-x-12 gap-y-3">
          <DetailField label={t('beekeeperDetail.nationalId')} value={bk.national_id} testId="bk-header-national-id" />
          <DetailField label={t('actorProfile.traceabilityCode')} value={bk.traceability_code} testId="bk-header-code" />
          <DetailField label={t('forms.internalCode')} value={bk.internal_code} testId="bk-header-internal-code" />
          <DetailField label={t('actorProfile.charterSigned')} value={bk.charter_signed ? t('common.yes') : t('common.no')} testId="bk-header-charter" />
          <DetailField label={t('forms.linkedProducerOrganisation')} value={bk.linked_producer_organisation} testId="bk-header-linked-org" />
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
              <Input className="bg-white" data-testid="bk-header-edit-linked-org" value={form.linked_producer_organisation} onChange={(e) => set('linked_producer_organisation')(e.target.value)} />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <RequiredLabel required>{t('forms.addStandards')}</RequiredLabel>
            <div className="flex gap-6">
              {STANDARDS.map((std) => (
                <label key={std} className="flex items-center gap-2 text-sm text-[#032b71] cursor-pointer">
                  <Checkbox data-testid={`bk-header-edit-standard-${std}`} checked={form.standards.includes(std)} onCheckedChange={() => toggleStandard(std)} /> {std}
                </label>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <RequiredLabel required={charterRequired}>{t('forms.sustainableBeekeeperCharter')}</RequiredLabel>
            <label className="flex items-center gap-2 text-sm text-[#032b71] cursor-pointer">
              <Checkbox data-testid="bk-header-edit-charter" checked={form.charter_signed} onCheckedChange={set('charter_signed')} /> {t('forms.readAndApprove')}
            </label>
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

// "Beekeeper details" tab: read view + its own separate inline edit
// (description, gender*, year of birth, address, contact info) — same
// fields/order as the Add-flow's steps 1-2, minus national ID/internal
// code/standards/charter/linked org, which live in the header edit instead.
function DetailsTab({ bk }) {
  const { t } = useTranslation();
  const { toast } = useToast();
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
      toast({ title: t('companyProfile.saveFailed'), description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (!editing) {
    return (
      <div data-testid="bk-details-tab-view">
        <p className="text-xs text-[#7089b4] mb-1">{t('beekeeperDetail.description')}</p>
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

        <Button variant="outline" data-testid="bk-details-edit-button" className="border-[#0f48aa] text-[#0f48aa] bg-white" onClick={startEdit}>
          <Pencil className="h-4 w-4 mr-1" /> {t('beekeeperDetail.editBeekeeperDetails')}
        </Button>
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
          <PhoneInput testIdPrefix="bk-details-edit-phone" dialCode={form.dial_code} number={form.contact_number} onDialCodeChange={set('dial_code')} onNumberChange={set('contact_number')} />
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

// "Overview" tab: current-year stats + inline edit (Commitment of
// beekeeper*, hive counts, hive spread per crop), plus the expandable
// "Previous year details" history table kept in sync by the DB trigger.
function OverviewTab({ bk }) {
  const { t } = useTranslation();
  const { toast } = useToast();
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
      toast({ title: t('companyProfile.saveFailed'), description: err.message, variant: 'destructive' });
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
        <Button variant="outline" data-testid="bk-overview-edit-button" className="border-[#0f48aa] text-[#0f48aa] bg-white" onClick={startEdit}>
          <Pencil className="h-4 w-4 mr-1" /> {t('companyProfile.update')}
        </Button>
      </div>

      <p className="text-xs text-[#7089b4] mb-2">{t('forms.hiveSpreadPerCrop')}</p>
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

      <p className="text-xs text-[#7089b4] mb-2">{t('beekeeperDetail.totalBeehivesInstalled')}</p>
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
            <p className="text-xs text-[#7089b4]">{label}</p>
          </div>
        ))}
      </div>

      <h3 className="text-sm font-black text-[#032b71] mb-3">{t('beekeeperDetail.previousYearDetails')}</h3>
      {history.length === 0 ? (
        <p className="text-sm text-[#7089b4]">{t('common.noRecordsFound')}</p>
      ) : (
        <table className="w-full text-sm" data-testid="bk-previous-years-table">
          <thead>
            <tr className="text-left text-[#7089b4] border-b border-[#cfd8e6]">
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

function TransactionsTab({ beekeeperId }) {
  const { t } = useTranslation();
  const { data: transactions = [] } = useBeekeeperTransactions(beekeeperId);

  if (transactions.length === 0) {
    return <p className="text-sm text-[#7089b4]" data-testid="bk-transactions-empty">{t('common.noRecordsFound')}</p>;
  }

  return (
    <table className="w-full text-sm" data-testid="bk-transactions-table">
      <thead>
        <tr className="text-left text-[#7089b4] border-b border-[#cfd8e6]">
          <th className="py-2">{t('transactions.date')}</th>
          <th className="py-2">{t('contractWizard.product')}</th>
          <th className="py-2">{t('transactions.quantityDelivered')}</th>
          <th className="py-2">{t('transactions.totalAmount')}</th>
        </tr>
      </thead>
      <tbody>
        {transactions.map((tx) => (
          <tr key={tx.id} className="border-b border-[#f0f0f0] text-[#032b71]">
            <td className="py-2">{tx.transaction_date}</td>
            <td className="py-2">{tx.product}</td>
            <td className="py-2">{tx.quantity} {tx.unit}</td>
            <td className="py-2">{tx.total_amount != null ? tx.total_amount.toLocaleString() : '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function BeekeeperDetail() {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: bk, isLoading } = useBeekeeper(id);

  if (isLoading || !bk) {
    return (
      <AppLayout title={t('beekeeperDetail.title')}>
        <p className="text-[#7089b4]">{t('common.loading')}</p>
      </AppLayout>
    );
  }

  return (
    <AppLayout hideDefaultHeader>
      <button
        data-testid="back-button"
        onClick={() => navigate(-1)}
        className="flex items-center gap-1 text-sm font-bold text-[#0f48aa] mb-3 hover:underline"
      >
        <ChevronLeft className="h-4 w-4" /> {t('actorProfile.back')}
      </button>
      <h1 className="text-lg font-black text-[#0f48aa] mb-4">{t('beekeeperDetail.title')}</h1>

      <HeaderCard bk={bk} />

      <Tabs defaultValue="details">
        <TabsList className="bg-transparent border-b border-[#cfd8e6] p-0 rounded-none h-auto gap-6 justify-start">
          <TabsTrigger value="details" data-testid="bk-tab-details" className="pb-3 rounded-none border-b-2 border-transparent data-[state=active]:border-[#0f48aa] data-[state=active]:bg-transparent data-[state=active]:text-[#0f48aa] data-[state=active]:shadow-none text-[#7089b4] font-bold">
            {t('beekeeperDetail.beekeeperDetails')}
          </TabsTrigger>
          <TabsTrigger value="overview" data-testid="bk-tab-overview" className="pb-3 rounded-none border-b-2 border-transparent data-[state=active]:border-[#0f48aa] data-[state=active]:bg-transparent data-[state=active]:text-[#0f48aa] data-[state=active]:shadow-none text-[#7089b4] font-bold">
            {t('beekeeperDetail.overview')}
          </TabsTrigger>
          <TabsTrigger value="transactions" data-testid="bk-tab-transactions" className="pb-3 rounded-none border-b-2 border-transparent data-[state=active]:border-[#0f48aa] data-[state=active]:bg-transparent data-[state=active]:text-[#0f48aa] data-[state=active]:shadow-none text-[#7089b4] font-bold">
            {t('actorProfile.transactions')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="pt-5">
          <DetailsTab bk={bk} />
        </TabsContent>
        <TabsContent value="overview" className="pt-5">
          <OverviewTab bk={bk} />
        </TabsContent>
        <TabsContent value="transactions" className="pt-5">
          <TransactionsTab beekeeperId={bk.id} />
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
}
