import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import AddressFields from '@/components/common/AddressFields';
import { useConstants } from '@/hooks/useConstants';
import { useCreateActor } from '@/hooks/useActors';
import { uploadMediaFile } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

const EMPTY = {
  traceability_code: '',
  actor_type: '',
  country: '',
  state_region: '',
  lga_municipality: '',
  village: '',
  charter_signed: false,
  contact_name: '',
  contact_email: '',
  contact_phone: '',
  status: 'Inactive',
  profile_completeness: 0,
};

export default function ActorFormDialog({ open, onOpenChange }) {
  const { t } = useTranslation();
  const [form, setForm] = useState(EMPTY);
  const [logoFile, setLogoFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const { data: actorTypes = [] } = useConstants('actor_type');
  const createActor = useCreateActor();
  const { supplyChainId } = useAuth();
  const { toast } = useToast();

  const set = (key) => (val) => setForm((f) => ({ ...f, [key]: val }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      let logo_url = null;
      if (logoFile) logo_url = await uploadMediaFile(logoFile, 'actors', supplyChainId);
      await createActor.mutateAsync({ ...form, logo_url });
      toast({ title: t('forms.actorCreated'), description: t('forms.actorCreatedDescription', { name: form.contact_name }) });
      setForm(EMPTY);
      setLogoFile(null);
      onOpenChange(false);
    } catch (err) {
      toast({ title: t('forms.actorCreateFailed'), description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-white" data-testid="actor-form-dialog">
        <DialogHeader>
          <DialogTitle className="text-[#032b71] font-black">{t('forms.addActor')}</DialogTitle>
          <DialogDescription>{t('forms.addActorDescription')}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <Label className="text-[#7089b4]">{t('forms.traceabilityCode')}</Label>
            <Input data-testid="actor-form-code" required value={form.traceability_code} onChange={(e) => set('traceability_code')(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-[#7089b4]">{t('forms.actorType')}</Label>
            <Select value={form.actor_type} onValueChange={set('actor_type')}>
              <SelectTrigger data-testid="actor-form-type"><SelectValue placeholder={t('forms.selectType')} /></SelectTrigger>
              <SelectContent>
                {actorTypes.map((ty) => <SelectItem key={ty.id} value={ty.value}>{ty.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-[#7089b4]">{t('forms.contactName')}</Label>
            <Input data-testid="actor-form-contact-name" required value={form.contact_name} onChange={(e) => set('contact_name')(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-[#7089b4]">{t('forms.contactEmail')}</Label>
            <Input type="email" data-testid="actor-form-contact-email" value={form.contact_email} onChange={(e) => set('contact_email')(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-[#7089b4]">{t('forms.contactPhone')}</Label>
            <Input data-testid="actor-form-contact-phone" value={form.contact_phone} onChange={(e) => set('contact_phone')(e.target.value)} />
          </div>
          <AddressFields
            testIdPrefix="actor-form"
            value={{
              country: form.country,
              state_region: form.state_region,
              lga_municipality: form.lga_municipality,
              village: form.village,
            }}
            onChange={(addr) => setForm((f) => ({ ...f, ...addr }))}
          />
          <div className="flex flex-col gap-1.5">
            <Label className="text-[#7089b4]">{t('forms.status')}</Label>
            <Select value={form.status} onValueChange={set('status')}>
              <SelectTrigger data-testid="actor-form-status"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Active">{t('common.active')}</SelectItem>
                <SelectItem value="Inactive">{t('common.inactive')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-[#7089b4]">{t('forms.profileCompleteness')}</Label>
            <Input type="number" min="0" max="100" data-testid="actor-form-completeness" value={form.profile_completeness} onChange={(e) => set('profile_completeness')(Number(e.target.value))} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-[#7089b4]">{t('forms.logo')}</Label>
            <Input type="file" accept="image/*" data-testid="actor-form-logo" onChange={(e) => setLogoFile(e.target.files?.[0] || null)} />
          </div>
          <div className="flex items-center gap-2 col-span-2 mt-1">
            <Checkbox id="charter" data-testid="actor-form-charter" checked={form.charter_signed} onCheckedChange={set('charter_signed')} />
            <Label htmlFor="charter" className="text-[#032b71]">{t('forms.charterSigned')}</Label>
          </div>

          <DialogFooter className="col-span-2 mt-2">
            <Button type="button" variant="outline" className="border-[#0f48aa] text-[#0f48aa]" onClick={() => onOpenChange(false)}>{t('common.cancel')}</Button>
            <Button type="submit" data-testid="actor-form-submit" disabled={saving} className="bg-[#0f48aa] text-white hover:bg-[#0d3d91]">
              {saving ? t('forms.saving') : t('forms.saveActor')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
