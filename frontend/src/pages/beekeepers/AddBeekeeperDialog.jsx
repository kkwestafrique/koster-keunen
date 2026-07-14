import React, { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import RequiredLabel from '@/components/common/RequiredLabel';
import AddressFields from '@/components/common/AddressFields';
import PhoneInput from '@/components/common/PhoneInput';
import { STANDARDS, COMMITMENT_OF_BEEKEEPER, HIVE_SPREAD_CROPS } from '@/data/regions';
import { useFindOrCreateVillage } from '@/hooks/useVillages';
import { useCreateBeekeeper } from '@/hooks/useBeekeepers';
import { useBulkUpload, downloadTemplate } from '@/hooks/useBulkUpload';
import { useToast } from '@/hooks/use-toast';

const STEP_BASIC = 1;
const STEP_CONNECTION = 2;
const STEP_HIVE = 3;

const CURRENT_YEAR = new Date().getFullYear();
// Descending list capped at current-year-minus-18 — the live site bakes a
// minimum-age-18 business rule into the option list itself rather than a
// min/max validator on a date field (audit finding).
const YEAR_OF_BIRTH_OPTIONS = Array.from({ length: 80 }, (_, i) => CURRENT_YEAR - 18 - i);

const EMPTY = {
  linked_producer_organisation: '',
  full_name: '',
  country: '', state_region: '', lga_municipality: '', village: '',
  contact_email: '',
  dial_code: '', contact_number: '',
  national_id: '',
  internal_code: '',
  gender: '',
  year_of_birth: '',
  standards: [],
  charter_signed: false,
  commitment: [],
  hives_traditional_single: 0,
  hives_traditional_double: 0,
  hives_modern: 0,
  hives_other: 0,
  hive_cashew: 0,
  hive_mango: 0,
  hive_shea: 0,
  hive_forest: 0,
  hive_other_forage: 0,
};

// Persistent side panel shown on every step of the wizard (audit: Figs
// 3.4/3.5/3.7 all show it).
function MultiUploadPanel({ multiMode, onToggle }) {
  const { t } = useTranslation();
  return (
    <div className="bg-[#ebf6ff] border border-[#cfd8e6] rounded-[8px] p-5 w-64 shrink-0 flex flex-col items-center text-center gap-2 self-start">
      <div className="w-16 h-16 rounded-full bg-[#cfe0fb]" aria-hidden="true" />
      <p className="font-black text-[#032b71]">
        {multiMode ? t('forms.addSingleConnections') : t('forms.addMultipleConnections')}
      </p>
      <p className="text-xs text-[#7089b4]">
        {multiMode ? t('forms.switchToSingleUploadDescription') : t('forms.switchToMultipleUploadDescription')}
      </p>
      <Button
        type="button"
        variant="outline"
        data-testid="bk-wizard-multi-toggle"
        className="border-[#0f48aa] text-[#0f48aa] w-full mt-1"
        onClick={onToggle}
      >
        {multiMode ? t('forms.switchToSingleUpload') : t('forms.switchToMultipleUpload')}
      </Button>
    </div>
  );
}

// 2-step Excel flow behind "Switch to multiple upload" (audit Fig 3.8):
// Step 1 downloads a template pre-filled with the right headers, Step 2
// uploads it back and verifies each row. Reuses the same useBulkUpload
// infrastructure already powering Received/Send stock's multi-transaction
// uploads, rather than a bespoke parser for this one flow.
function MultiUploadBody({ onDone }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const fileInputRef = useRef(null);
  const [fileLabel, setFileLabel] = useState('');
  const { rows, validCount, errorCount, uploading, parsing, loadFile, submit } = useBulkUpload('beekeepers');

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileLabel(file.name);
    try {
      await loadFile(file);
    } catch (err) {
      toast({ title: t('forms.fileParseFailed'), description: err.message, variant: 'destructive' });
    }
  };

  const handleGoToDetails = async () => {
    const result = await submit();
    if (result.inserted > 0) {
      toast({ title: t('forms.bulkUploadComplete'), description: t('forms.bulkUploadCompleteDescription', { inserted: result.inserted, failed: result.failed }) });
      onDone();
    } else {
      toast({ title: t('forms.bulkUploadFailed'), description: t('forms.bulkUploadFailedDescription'), variant: 'destructive' });
    }
  };

  const verified = rows.length > 0;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex gap-3 items-start">
        <div className="w-6 h-6 rounded-full bg-[#0f48aa] text-white text-xs font-bold flex items-center justify-center shrink-0">1</div>
        <div className="flex flex-col gap-2 flex-1">
          <p className="font-black text-[#032b71]">{t('forms.downloadExcelTemplate')}</p>
          <p className="text-xs text-[#7089b4]">{t('forms.downloadTemplateNote')}</p>
          <Button
            type="button"
            variant="outline"
            data-testid="bk-wizard-download-template"
            className="border-[#0f48aa] text-[#0f48aa] self-start"
            onClick={() => downloadTemplate('beekeepers', 'beekeepers-template.xlsx')}
          >
            {t('forms.downloadExcelTemplate')}
          </Button>
        </div>
      </div>

      <div className="flex gap-3 items-start">
        <div className="w-6 h-6 rounded-full bg-[#0f48aa] text-white text-xs font-bold flex items-center justify-center shrink-0">2</div>
        <div className="flex flex-col gap-2 flex-1">
          <p className="font-black text-[#032b71]">{t('forms.uploadAndVerifyTemplate')}</p>
          <div className="flex gap-2 items-center">
            <Button
              type="button"
              data-testid="bk-wizard-upload-verify"
              disabled={parsing}
              onClick={() => fileInputRef.current?.click()}
              className="bg-[#0f48aa] text-white hover:bg-[#0d3d91]"
            >
              {parsing ? t('forms.verifying') : t('forms.uploadAndVerifyData')}
            </Button>
            <span className="text-sm text-[#7089b4]">{fileLabel || t('forms.noFileChosen')}</span>
            <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleFileChange} />
          </div>

          {verified && (
            <div className="bg-[#ebf6ff] border border-[#cfd8e6] rounded-[5px] p-3 text-sm" data-testid="bk-wizard-verify-summary">
              <p className="text-[#032b71] font-bold">{t('forms.verifySummary', { valid: validCount, error: errorCount })}</p>
              {errorCount > 0 && (
                <ul className="mt-2 text-xs text-[#ba550c] list-disc list-inside max-h-32 overflow-y-auto">
                  {rows.filter((r) => r.errors.length > 0).slice(0, 20).map((r) => (
                    <li key={r.rowNumber}>{t('forms.rowError', { row: r.rowNumber, errors: r.errors.join('; ') })}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>

      <DialogFooter>
        <Button type="button" data-testid="bk-wizard-multi-go-details" disabled={!verified || uploading} onClick={handleGoToDetails} className="bg-[#0f48aa] text-white hover:bg-[#0d3d91]">
          {uploading ? t('forms.saving') : t('forms.goToDetailsPage')}
        </Button>
      </DialogFooter>
    </div>
  );
}

export default function AddBeekeeperDialog({ open, onOpenChange }) {
  const { t } = useTranslation();
  const [step, setStep] = useState(STEP_BASIC);
  const [multiMode, setMultiMode] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const findOrCreateVillage = useFindOrCreateVillage();
  const createBeekeeper = useCreateBeekeeper();
  const { toast } = useToast();

  const set = (key) => (val) => setForm((f) => ({ ...f, [key]: val }));
  const toggleArr = (key, val) => setForm((f) => ({
    ...f,
    [key]: f[key].includes(val) ? f[key].filter((x) => x !== val) : [...f[key], val],
  }));

  const addressValid = form.country && form.state_region && form.lga_municipality && form.village;
  const step1Valid = form.full_name && addressValid && form.dial_code && form.contact_number;
  const charterRequired = form.standards.includes('Sustainable');
  const step2Valid = form.gender && form.standards.length > 0 && form.commitment.length > 0 && (!charterRequired || form.charter_signed);

  const reset = () => { setForm(EMPTY); setStep(STEP_BASIC); setMultiMode(false); };
  const handleClose = () => { reset(); onOpenChange(false); };

  const handleFinalSubmit = async () => {
    setSaving(true);
    try {
      const village_id = await findOrCreateVillage.mutateAsync({
        country: form.country, state_region: form.state_region, lga_municipality: form.lga_municipality, name: form.village,
      });
      const contact_phone = form.dial_code && form.contact_number ? `${form.dial_code} ${form.contact_number}` : form.contact_number;

      await createBeekeeper.mutateAsync({
        full_name: form.full_name,
        linked_producer_organisation: form.linked_producer_organisation || null,
        contact_email: form.contact_email || null,
        contact_phone,
        national_id: form.national_id || null,
        internal_code: form.internal_code || null,
        gender: form.gender,
        year_of_birth: form.year_of_birth ? Number(form.year_of_birth) : null,
        standards: form.standards,
        charter_signed: form.charter_signed,
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
        village_id,
      });
      toast({ title: t('forms.beekeeperCreated'), description: t('forms.beekeeperCreatedDescription', { name: form.full_name }) });
      handleClose();
    } catch (err) {
      toast({ title: t('forms.beekeeperCreateFailed'), description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const stepTitle = step === STEP_BASIC ? t('forms.basicDetails') : step === STEP_CONNECTION ? t('forms.connectionDetails') : t('forms.hiveDetails');

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-4xl bg-white max-h-[90vh] overflow-y-auto" data-testid="add-beekeeper-dialog">
        <DialogHeader>
          <DialogTitle className="text-[#032b71] font-black">{t('forms.addBeekeeper')}</DialogTitle>
          <DialogDescription>{stepTitle}</DialogDescription>
        </DialogHeader>

        <div className="flex gap-6 items-start">
          <div className="flex-1 flex flex-col gap-4">
            {multiMode ? (
              <MultiUploadBody onDone={handleClose} />
            ) : (
              <>
                {step === STEP_BASIC && (
                  <>
                    <h3 className="text-sm font-black text-[#032b71]">{t('forms.basicDetails')}</h3>
                    <div className="flex flex-col gap-1.5">
                      <RequiredLabel required={false}>{t('forms.linkedProducerOrganisation')}</RequiredLabel>
                      <Input data-testid="bk-wizard-linked-org" value={form.linked_producer_organisation} onChange={(e) => set('linked_producer_organisation')(e.target.value)} placeholder={t('forms.linkedProducerOrganisation')} />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <RequiredLabel required>{t('forms.beekeeperFullName')}</RequiredLabel>
                      <Input data-testid="bk-wizard-name" required value={form.full_name} onChange={(e) => set('full_name')(e.target.value)} placeholder={t('forms.beekeeperFullName')} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <AddressFields
                        testIdPrefix="bk-wizard"
                        value={{ country: form.country, state_region: form.state_region, lga_municipality: form.lga_municipality, village: form.village }}
                        onChange={(addr) => setForm((f) => ({ ...f, ...addr }))}
                      />
                    </div>
                    <h3 className="text-sm font-black text-[#032b71] mt-2">{t('actorProfile.contactInformation')}</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex flex-col gap-1.5">
                        <RequiredLabel required={false}>{t('actorProfile.contactEmail')}</RequiredLabel>
                        <Input type="email" data-testid="bk-wizard-email" value={form.contact_email} onChange={(e) => set('contact_email')(e.target.value)} />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <RequiredLabel required>{t('actorProfile.contactNumber')}</RequiredLabel>
                        <PhoneInput
                          testIdPrefix="bk-wizard-contact-phone"
                          dialCode={form.dial_code}
                          number={form.contact_number}
                          onDialCodeChange={set('dial_code')}
                          onNumberChange={set('contact_number')}
                        />
                      </div>
                    </div>
                  </>
                )}

                {step === STEP_CONNECTION && (
                  <>
                    <h3 className="text-sm font-black text-[#032b71]">{t('forms.connectionDetails')}</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex flex-col gap-1.5">
                        <RequiredLabel required={false}>{t('forms.nationalId')}</RequiredLabel>
                        <Input data-testid="bk-wizard-national-id" value={form.national_id} onChange={(e) => set('national_id')(e.target.value)} placeholder={t('forms.nationalId')} />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <RequiredLabel required={false}>{t('forms.internalCode')}</RequiredLabel>
                        <Input data-testid="bk-wizard-internal-code" value={form.internal_code} onChange={(e) => set('internal_code')(e.target.value)} placeholder={t('forms.internalCode')} />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <RequiredLabel required spaced={false}>{t('forms.gender')}</RequiredLabel>
                        <Select value={form.gender} onValueChange={set('gender')}>
                          <SelectTrigger data-testid="bk-wizard-gender"><SelectValue placeholder={t('forms.selectGender')} /></SelectTrigger>
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
                          <SelectTrigger data-testid="bk-wizard-year-of-birth"><SelectValue placeholder={t('forms.selectYearOfBirth')} /></SelectTrigger>
                          <SelectContent className="max-h-60">
                            {YEAR_OF_BIRTH_OPTIONS.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <RequiredLabel required>{t('forms.addStandards')}</RequiredLabel>
                      <div className="flex gap-6">
                        {STANDARDS.map((std) => (
                          <label key={std} className="flex items-center gap-2 text-sm text-[#032b71] cursor-pointer">
                            <Checkbox data-testid={`bk-wizard-standard-${std}`} checked={form.standards.includes(std)} onCheckedChange={() => toggleArr('standards', std)} /> {std}
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <RequiredLabel required={charterRequired}>{t('forms.sustainableBeekeeperCharter')}</RequiredLabel>
                      <label className="flex items-center gap-2 text-sm text-[#032b71] cursor-pointer">
                        <Checkbox data-testid="bk-wizard-charter" checked={form.charter_signed} onCheckedChange={set('charter_signed')} /> {t('forms.readAndApprove')}
                      </label>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <RequiredLabel required spaced={false}>{t('forms.commitmentOfBeekeeper')}</RequiredLabel>
                      <div className="flex gap-6">
                        {COMMITMENT_OF_BEEKEEPER.map((c) => (
                          <label key={c} className="flex items-center gap-2 text-sm text-[#032b71] cursor-pointer">
                            <Checkbox data-testid={`bk-wizard-commitment-${c}`} checked={form.commitment.includes(c)} onCheckedChange={() => toggleArr('commitment', c)} /> {c}
                          </label>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {step === STEP_HIVE && (
                  <>
                    <div className="flex flex-col gap-1.5">
                      <RequiredLabel required spaced={false}>{t('forms.totalHivesInstalled')}</RequiredLabel>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="flex flex-col gap-1.5">
                          <RequiredLabel required={false} className="text-xs">{t('forms.traditionalSingleHives')}</RequiredLabel>
                          <Input type="number" min="0" data-testid="bk-wizard-hts" value={form.hives_traditional_single} onChange={(e) => set('hives_traditional_single')(e.target.value)} />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <RequiredLabel required={false} className="text-xs">{t('forms.traditionalDoubleHives')}</RequiredLabel>
                          <Input type="number" min="0" data-testid="bk-wizard-htd" value={form.hives_traditional_double} onChange={(e) => set('hives_traditional_double')(e.target.value)} />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <RequiredLabel required={false} className="text-xs">{t('forms.modernHives')}</RequiredLabel>
                          <Input type="number" min="0" data-testid="bk-wizard-modern" value={form.hives_modern} onChange={(e) => set('hives_modern')(e.target.value)} />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <RequiredLabel required={false} className="text-xs">{t('forms.otherHives')}</RequiredLabel>
                          <Input type="number" min="0" data-testid="bk-wizard-other" value={form.hives_other} onChange={(e) => set('hives_other')(e.target.value)} />
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col gap-1.5 mt-2">
                      <RequiredLabel required spaced={false}>{t('forms.hiveSpreadPerCrop')}</RequiredLabel>
                      <div className="grid grid-cols-5 gap-3">
                        {HIVE_SPREAD_CROPS.map((crop) => {
                          const key = `hive_${crop.toLowerCase().replace(' ', '_')}`;
                          return (
                            <div key={crop} className="flex flex-col gap-1.5">
                              <RequiredLabel required={false} className="text-xs">{crop}</RequiredLabel>
                              <Input type="number" min="0" data-testid={`bk-wizard-crop-${crop}`} value={form[key] ?? 0} onChange={(e) => set(key)(e.target.value)} />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </>
                )}
              </>
            )}
          </div>

          <MultiUploadPanel multiMode={multiMode} onToggle={() => setMultiMode((v) => !v)} />
        </div>

        {!multiMode && (
          <DialogFooter className="mt-2">
            {step === STEP_BASIC && (
              <>
                <Button type="button" variant="ghost" className="text-[#0f48aa]" onClick={handleClose}>{t('common.cancel')}</Button>
                <Button type="button" data-testid="bk-wizard-next-1" disabled={!step1Valid} onClick={() => setStep(STEP_CONNECTION)} className="bg-[#0f48aa] text-white hover:bg-[#0d3d91]">
                  {t('forms.nextConnectionDetails')}
                </Button>
              </>
            )}
            {step === STEP_CONNECTION && (
              <>
                <Button type="button" variant="outline" className="border-[#0f48aa] text-[#0f48aa]" onClick={() => setStep(STEP_BASIC)}>{t('common.back')}</Button>
                <Button type="button" data-testid="bk-wizard-next-2" disabled={!step2Valid} onClick={() => setStep(STEP_HIVE)} className="bg-[#0f48aa] text-white hover:bg-[#0d3d91]">
                  {t('forms.nextHiveDetails')}
                </Button>
              </>
            )}
            {step === STEP_HIVE && (
              <>
                <Button type="button" variant="outline" className="border-[#0f48aa] text-[#0f48aa]" onClick={() => setStep(STEP_CONNECTION)}>{t('common.back')}</Button>
                <Button type="button" data-testid="bk-wizard-submit" disabled={saving} onClick={handleFinalSubmit} className="bg-[#0f48aa] text-white hover:bg-[#0d3d91]">
                  {saving ? t('forms.saving') : t('forms.addBeekeeper')}
                </Button>
              </>
            )}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
