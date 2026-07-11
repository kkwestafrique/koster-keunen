import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { COUNTRIES, getStatesForCountry, getLgasForState } from '@/data/regions';
import { useCreateVillage } from '@/hooks/useVillages';
import { useToast } from '@/hooks/use-toast';

const EMPTY = { name: '', country: '', state_region: '', lga_municipality: '' };

// Village creation uses the same cascading Country -> State -> LGA pattern as
// the shared AddressFields component, minus the trailing free-text Village
// field (the village's own name is the primary field here instead).
export default function VillageFormDialog({ open, onOpenChange }) {
  const { t } = useTranslation();
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const createVillage = useCreateVillage();
  const { toast } = useToast();

  const states = getStatesForCountry(form.country);
  const lgas = getLgasForState(form.state_region);

  const setCountry = (c) => setForm((f) => ({ ...f, country: c, state_region: '', lga_municipality: '' }));
  const setState = (s) => setForm((f) => ({ ...f, state_region: s, lga_municipality: '' }));
  const set = (key) => (val) => setForm((f) => ({ ...f, [key]: val }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await createVillage.mutateAsync(form);
      toast({ title: t('forms.villageCreated'), description: t('forms.actorCreatedDescription', { name: form.name }) });
      setForm(EMPTY);
      onOpenChange(false);
    } catch (err) {
      toast({ title: t('forms.villageCreateFailed'), description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg bg-white" data-testid="village-form-dialog">
        <DialogHeader>
          <DialogTitle className="text-[#032b71] font-black">{t('forms.addVillage')}</DialogTitle>
          <DialogDescription>{t('forms.addVillageDescription')}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4">
          <div className="flex flex-col gap-1.5">
            <Label className="text-[#7089b4]">{t('forms.villageName')}</Label>
            <Input data-testid="village-form-name" required value={form.name} onChange={(e) => set('name')(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-[#7089b4]">{t('forms.country')}</Label>
            <Select value={form.country} onValueChange={setCountry}>
              <SelectTrigger data-testid="village-form-country"><SelectValue placeholder={t('forms.selectCountry')} /></SelectTrigger>
              <SelectContent>
                {COUNTRIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-[#7089b4]">{t('forms.stateRegion')}</Label>
            <Select value={form.state_region} onValueChange={setState} disabled={!form.country}>
              <SelectTrigger data-testid="village-form-state">
                <SelectValue placeholder={form.country ? t('forms.selectState') : t('forms.selectCountryFirst')} />
              </SelectTrigger>
              <SelectContent>
                {states.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-[#7089b4]">{t('forms.lgaMunicipality')}</Label>
            {lgas.length > 0 ? (
              <Select value={form.lga_municipality} onValueChange={set('lga_municipality')} disabled={!form.state_region}>
                <SelectTrigger data-testid="village-form-lga">
                  <SelectValue placeholder={form.state_region ? t('forms.selectLga') : t('forms.selectStateFirst')} />
                </SelectTrigger>
                <SelectContent>
                  {lgas.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            ) : (
              <Input
                data-testid="village-form-lga"
                value={form.lga_municipality}
                disabled={!form.state_region}
                placeholder={form.state_region ? t('forms.enterLga') : t('forms.selectStateFirst')}
                onChange={(e) => set('lga_municipality')(e.target.value)}
              />
            )}
          </div>

          <DialogFooter className="mt-2">
            <Button type="button" variant="outline" className="border-[#0f48aa] text-[#0f48aa]" onClick={() => onOpenChange(false)}>{t('common.cancel')}</Button>
            <Button type="submit" data-testid="village-form-submit" disabled={saving} className="bg-[#0f48aa] text-white hover:bg-[#0d3d91]">
              {saving ? t('forms.saving') : t('forms.saveVillage')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
