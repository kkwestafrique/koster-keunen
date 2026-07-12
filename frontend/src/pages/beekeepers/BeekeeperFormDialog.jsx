import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import AddressFields from '@/components/common/AddressFields';
import { useFindOrCreateVillage } from '@/hooks/useVillages';
import { useAllActorsLite } from '@/hooks/useActors';
import { useCreateBeekeeper } from '@/hooks/useBeekeepers';
import { useToast } from '@/hooks/use-toast';

const EMPTY = {
  traceability_code: '',
  full_name: '',
  gender: '',
  country: '',
  state_region: '',
  lga_municipality: '',
  village: '',
  actor_id: '',
  hives_traditional_single: 0,
  hives_traditional_double: 0,
  hives_modern: 0,
  hives_other: 0,
  active_years: 0,
  status: 'Potential',
};

// Address block matches the live-site audit: Add Beekeeper captures a full
// Country -> State/Region -> LGA/Municipality -> Village address inline
// (cascading dropdowns backed by the `regions` table), rather than picking
// from an existing village list. On submit we resolve that address to a
// village_id — reusing a matching village if one already exists for this
// supply chain, otherwise creating it — since beekeepers link to villages
// via village_id under the hood.
export default function BeekeeperFormDialog({ open, onOpenChange }) {
  const { t } = useTranslation();
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const { data: actors = [] } = useAllActorsLite();
  const createBeekeeper = useCreateBeekeeper();
  const findOrCreateVillage = useFindOrCreateVillage();
  const { toast } = useToast();

  const set = (key) => (val) => setForm((f) => ({ ...f, [key]: val }));

  const addressValid = form.country && form.state_region && form.lga_municipality && form.village;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const village_id = await findOrCreateVillage.mutateAsync({
        country: form.country,
        state_region: form.state_region,
        lga_municipality: form.lga_municipality,
        name: form.village,
      });

      const { country, state_region, lga_municipality, village, ...beekeeperFields } = form;
      await createBeekeeper.mutateAsync({ ...beekeeperFields, village_id });
      toast({ title: t('forms.beekeeperCreated'), description: t('forms.beekeeperCreatedDescription', { name: form.full_name }) });
      setForm(EMPTY);
      onOpenChange(false);
    } catch (err) {
      toast({ title: t('forms.beekeeperCreateFailed'), description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-white" data-testid="beekeeper-form-dialog">
        <DialogHeader>
          <DialogTitle className="text-[#032b71] font-black">{t('forms.addBeekeeper')}</DialogTitle>
          <DialogDescription>{t('forms.addBeekeeperDescription')}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <Label className="text-[#7089b4]">{t('forms.traceabilityCode')}</Label>
            <Input data-testid="bk-form-code" required value={form.traceability_code} onChange={(e) => set('traceability_code')(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-[#7089b4]">{t('forms.fullName')}</Label>
            <Input data-testid="bk-form-name" required value={form.full_name} onChange={(e) => set('full_name')(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-[#7089b4]">{t('forms.gender')}</Label>
            <Select value={form.gender} onValueChange={set('gender')}>
              <SelectTrigger data-testid="bk-form-gender"><SelectValue placeholder={t('forms.selectGender')} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Male">{t('common.male')}</SelectItem>
                <SelectItem value="Female">{t('common.female')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <AddressFields
            testIdPrefix="bk-form"
            value={{
              country: form.country,
              state_region: form.state_region,
              lga_municipality: form.lga_municipality,
              village: form.village,
            }}
            onChange={(addr) => setForm((f) => ({ ...f, ...addr }))}
          />
          <div className="flex flex-col gap-1.5 col-span-2">
            <Label className="text-[#7089b4]">{t('forms.organisation')}</Label>
            <Select value={form.actor_id} onValueChange={set('actor_id')}>
              <SelectTrigger data-testid="bk-form-actor"><SelectValue placeholder={t('forms.selectOrganisation')} /></SelectTrigger>
              <SelectContent>
                {actors.map((a) => <SelectItem key={a.id} value={a.id}>{a.contact_name} ({a.traceability_code})</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-[#7089b4]">{t('forms.traditionalSingleHives')}</Label>
            <Input type="number" min="0" data-testid="bk-form-hts" value={form.hives_traditional_single} onChange={(e) => set('hives_traditional_single')(Number(e.target.value))} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-[#7089b4]">{t('forms.traditionalDoubleHives')}</Label>
            <Input type="number" min="0" data-testid="bk-form-htd" value={form.hives_traditional_double} onChange={(e) => set('hives_traditional_double')(Number(e.target.value))} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-[#7089b4]">{t('forms.modernHives')}</Label>
            <Input type="number" min="0" data-testid="bk-form-modern" value={form.hives_modern} onChange={(e) => set('hives_modern')(Number(e.target.value))} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-[#7089b4]">{t('forms.otherHives')}</Label>
            <Input type="number" min="0" data-testid="bk-form-other" value={form.hives_other} onChange={(e) => set('hives_other')(Number(e.target.value))} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-[#7089b4]">{t('forms.activeYears')}</Label>
            <Input type="number" min="0" data-testid="bk-form-years" value={form.active_years} onChange={(e) => set('active_years')(Number(e.target.value))} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-[#7089b4]">{t('forms.status')}</Label>
            <Select value={form.status} onValueChange={set('status')}>
              <SelectTrigger data-testid="bk-form-status"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Potential">{t('common.potential')}</SelectItem>
                <SelectItem value="Actual">{t('common.actual')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DialogFooter className="col-span-2 mt-2">
            <Button type="button" variant="outline" className="border-[#0f48aa] text-[#0f48aa]" onClick={() => onOpenChange(false)}>{t('common.cancel')}</Button>
            <Button type="submit" data-testid="bk-form-submit" disabled={saving || !addressValid} className="bg-[#0f48aa] text-white hover:bg-[#0d3d91]">
              {saving ? t('forms.saving') : t('forms.saveBeekeeper')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
