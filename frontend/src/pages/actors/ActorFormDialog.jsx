import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import RequiredLabel from '@/components/common/RequiredLabel';
import AddressFields from '@/components/common/AddressFields';
import PhoneInput from '@/components/common/PhoneInput';
import { ACTOR_TYPES, STANDARDS } from '@/data/regions';
import { useCreateActor } from '@/hooks/useActors';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/hooks/use-toast';

const EMPTY = {
  contact_name: '',
  actor_type: ACTOR_TYPES[0],
  standards: [],
  country: '',
  state_region: '',
  lga_municipality: '',
  village: '',
  contact_email: '',
  dial_code: '',
  contact_number: '',
};

function ConnectIdModal({ open, onOpenChange, onAdded }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [connectId, setConnectId] = useState('');
  const [searching, setSearching] = useState(false);
  const [adding, setAdding] = useState(false);
  const [found, setFound] = useState(null);
  const [searched, setSearched] = useState(false);
  const createActor = useCreateActor();

  const reset = () => { setConnectId(''); setFound(null); setSearched(false); };

  const handleSearch = async () => {
    if (!connectId.trim()) return;
    setSearching(true);
    setSearched(false);
    try {
      const { data, error } = await supabase.rpc('lookup_actor_by_connect_id', { p_connect_id: connectId.trim() });
      if (error) throw error;
      setFound(data?.[0] || null);
    } catch (err) {
      toast({ title: t('forms.connectIdSearchFailed'), description: err.message, variant: 'destructive' });
      setFound(null);
    } finally {
      setSearching(false);
      setSearched(true);
    }
  };

  const handleAdd = async () => {
    if (!found) return;
    setAdding(true);
    try {
      await createActor.mutateAsync({
        contact_name: found.contact_name,
        actor_type: found.actor_type,
        standards: found.standards || [],
        country: found.country,
        state_region: found.state_region,
        lga_municipality: found.lga_municipality,
        village: found.village,
        contact_email: found.contact_email,
        contact_phone: found.contact_phone,
      });
      toast({ title: t('forms.actorCreated'), description: t('forms.actorCreatedDescription', { name: found.contact_name }) });
      reset();
      onOpenChange(false);
      onAdded();
    } catch (err) {
      toast({ title: t('forms.actorCreateFailed'), description: err.message, variant: 'destructive' });
    } finally {
      setAdding(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-md bg-white" data-testid="connect-id-modal">
        <DialogHeader>
          <DialogTitle className="text-[#032b71] font-black">{t('forms.addActorUsingConnectId')}</DialogTitle>
          <DialogDescription>{t('forms.connectIdSearchDescription')}</DialogDescription>
        </DialogHeader>
        <div className="flex gap-2">
          <Input
            data-testid="connect-id-input"
            value={connectId}
            onChange={(e) => setConnectId(e.target.value)}
            placeholder={t('forms.enterConnectId')}
            className="bg-white border-[#cfd8e6] text-[#032b71]"
          />
          <Button
            type="button"
            data-testid="connect-id-search"
            onClick={handleSearch}
            disabled={searching || !connectId.trim()}
            className="bg-[#0f48aa] text-white hover:bg-[#0d3d91] shrink-0"
          >
            {searching ? t('forms.searching') : t('forms.search')}
          </Button>
        </div>

        {searched && !found && (
          <p className="text-sm text-[#ba550c]" data-testid="connect-id-not-found">{t('forms.connectIdNotFound')}</p>
        )}
        {found && (
          <div className="bg-[#ebf6ff] border border-[#cfd8e6] rounded-[5px] p-3 text-sm text-[#032b71]" data-testid="connect-id-found">
            <p className="font-bold">{found.contact_name}</p>
            <p className="text-[#7089b4]">{found.actor_type} &middot; {found.country}</p>
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" className="border-[#0f48aa] text-[#0f48aa]" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            type="button"
            data-testid="connect-id-add-actor"
            onClick={handleAdd}
            disabled={!found || adding}
            className="bg-[#0f48aa] text-white hover:bg-[#0d3d91]"
          >
            {adding ? t('forms.saving') : t('actorsList.addActor')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function ActorFormDialog({ open, onOpenChange }) {
  const { t } = useTranslation();
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [connectIdOpen, setConnectIdOpen] = useState(false);
  const createActor = useCreateActor();
  const { toast } = useToast();

  const set = (key) => (val) => setForm((f) => ({ ...f, [key]: val }));

  const toggleStandard = (std) => {
    setForm((f) => ({
      ...f,
      standards: f.standards.includes(std) ? f.standards.filter((s) => s !== std) : [...f.standards, std],
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const contact_phone = form.dial_code && form.contact_number ? `${form.dial_code} ${form.contact_number}` : form.contact_number;
      await createActor.mutateAsync({
        contact_name: form.contact_name,
        actor_type: form.actor_type,
        standards: form.standards,
        country: form.country,
        state_region: form.state_region,
        lga_municipality: form.lga_municipality,
        village: form.village,
        contact_email: form.contact_email,
        contact_phone,
      });
      toast({ title: t('forms.actorCreated'), description: t('forms.actorCreatedDescription', { name: form.contact_name }) });
      setForm(EMPTY);
      onOpenChange(false);
    } catch (err) {
      toast({ title: t('forms.actorCreateFailed'), description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-white max-h-[90vh] overflow-y-auto" data-testid="actor-form-dialog">
        <DialogHeader>
          <DialogTitle className="text-[#032b71] font-black">{t('forms.addActor')}</DialogTitle>
          <DialogDescription>{t('forms.addActorDescription')}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <h3 className="text-sm font-black text-[#032b71]">{t('forms.connectionDetails')}</h3>

          <div className="flex gap-3 items-end">
            <div className="flex flex-col gap-1.5 flex-1">
              <RequiredLabel required>{t('forms.actorName')}</RequiredLabel>
              <Input
                data-testid="actor-form-name"
                required
                value={form.contact_name}
                onChange={(e) => set('contact_name')(e.target.value)}
                placeholder={t('forms.actorName')}
              />
            </div>
            <Button
              type="button"
              variant="outline"
              data-testid="actor-form-connect-id-button"
              className="border-[#0f48aa] text-[#0f48aa] shrink-0"
              onClick={() => setConnectIdOpen(true)}
            >
              {t('forms.addUsingConnectId')}
            </Button>
          </div>

          <div className="flex flex-col gap-1.5">
            <RequiredLabel required spaced={false}>{t('forms.actorType')}</RequiredLabel>
            <RadioGroup value={form.actor_type} onValueChange={set('actor_type')} className="flex gap-6">
              {ACTOR_TYPES.map((ty) => (
                <label key={ty} className="flex items-center gap-2 text-sm text-[#032b71] cursor-pointer">
                  <RadioGroupItem value={ty} data-testid={`actor-form-type-${ty}`} /> {ty}
                </label>
              ))}
            </RadioGroup>
          </div>

          <div className="flex flex-col gap-1.5">
            <RequiredLabel required>{t('forms.addStandards')}</RequiredLabel>
            <div className="flex gap-6">
              {STANDARDS.map((std) => (
                <label key={std} className="flex items-center gap-2 text-sm text-[#032b71] cursor-pointer">
                  <Checkbox
                    data-testid={`actor-form-standard-${std}`}
                    checked={form.standards.includes(std)}
                    onCheckedChange={() => toggleStandard(std)}
                  /> {std}
                </label>
              ))}
            </div>
          </div>

          <h3 className="text-sm font-black text-[#032b71] mt-2">{t('actorProfile.address')}</h3>
          <div className="grid grid-cols-2 gap-4">
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
          </div>

          <h3 className="text-sm font-black text-[#032b71] mt-2">{t('actorProfile.contactInformation')}</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <RequiredLabel required>{t('actorProfile.contactFullName')}</RequiredLabel>
              <Input data-testid="actor-form-contact-name" required value={form.contact_name} onChange={(e) => set('contact_name')(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <RequiredLabel required>{t('actorProfile.contactEmail')}</RequiredLabel>
              <Input type="email" data-testid="actor-form-contact-email" required value={form.contact_email} onChange={(e) => set('contact_email')(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5 col-span-2 max-w-xs">
              <RequiredLabel required>{t('actorProfile.contactNumber')}</RequiredLabel>
              <PhoneInput
                testIdPrefix="actor-form-contact-phone"
                dialCode={form.dial_code}
                number={form.contact_number}
                onDialCodeChange={set('dial_code')}
                onNumberChange={set('contact_number')}
              />
            </div>
          </div>

          <DialogFooter className="mt-2">
            <Button type="button" variant="ghost" className="text-[#0f48aa]" onClick={() => onOpenChange(false)}>{t('common.cancel')}</Button>
            <Button type="submit" data-testid="actor-form-submit" disabled={saving} className="bg-[#0f48aa] text-white hover:bg-[#0d3d91]">
              {saving ? t('forms.saving') : t('forms.addConnections')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>

      <ConnectIdModal
        open={connectIdOpen}
        onOpenChange={setConnectIdOpen}
        onAdded={() => onOpenChange(false)}
      />
    </Dialog>
  );
}
