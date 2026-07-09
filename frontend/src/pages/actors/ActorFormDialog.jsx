import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useConstants } from '@/hooks/useConstants';
import { useCreateActor } from '@/hooks/useActors';
import { uploadMediaFile } from '@/lib/supabaseClient';
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
  const [form, setForm] = useState(EMPTY);
  const [logoFile, setLogoFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const { data: actorTypes = [] } = useConstants('actor_type');
  const { data: countries = [] } = useConstants('country');
  const createActor = useCreateActor();
  const { toast } = useToast();

  const set = (key) => (val) => setForm((f) => ({ ...f, [key]: val }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      let logo_url = null;
      if (logoFile) logo_url = await uploadMediaFile(logoFile, 'actors');
      await createActor.mutateAsync({ ...form, logo_url });
      toast({ title: 'Actor created', description: `${form.contact_name} was added successfully.` });
      setForm(EMPTY);
      setLogoFile(null);
      onOpenChange(false);
    } catch (err) {
      toast({ title: 'Failed to create actor', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-white" data-testid="actor-form-dialog">
        <DialogHeader>
          <DialogTitle className="text-[#032b71] font-black">Add Actor</DialogTitle>
          <DialogDescription>Enter the actor's details below to add them to the supply chain.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <Label className="text-[#7089b4]">Traceability Code</Label>
            <Input data-testid="actor-form-code" required value={form.traceability_code} onChange={(e) => set('traceability_code')(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-[#7089b4]">Actor Type</Label>
            <Select value={form.actor_type} onValueChange={set('actor_type')}>
              <SelectTrigger data-testid="actor-form-type"><SelectValue placeholder="Select type" /></SelectTrigger>
              <SelectContent>
                {actorTypes.map((t) => <SelectItem key={t.id} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-[#7089b4]">Contact Name</Label>
            <Input data-testid="actor-form-contact-name" required value={form.contact_name} onChange={(e) => set('contact_name')(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-[#7089b4]">Contact Email</Label>
            <Input type="email" data-testid="actor-form-contact-email" value={form.contact_email} onChange={(e) => set('contact_email')(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-[#7089b4]">Contact Phone</Label>
            <Input data-testid="actor-form-contact-phone" value={form.contact_phone} onChange={(e) => set('contact_phone')(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-[#7089b4]">Country</Label>
            <Select value={form.country} onValueChange={set('country')}>
              <SelectTrigger data-testid="actor-form-country"><SelectValue placeholder="Select country" /></SelectTrigger>
              <SelectContent>
                {countries.map((c) => <SelectItem key={c.id} value={c.value}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-[#7089b4]">State / Region</Label>
            <Input data-testid="actor-form-state" value={form.state_region} onChange={(e) => set('state_region')(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-[#7089b4]">LGA / Municipality</Label>
            <Input data-testid="actor-form-lga" value={form.lga_municipality} onChange={(e) => set('lga_municipality')(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-[#7089b4]">Village</Label>
            <Input data-testid="actor-form-village" value={form.village} onChange={(e) => set('village')(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-[#7089b4]">Status</Label>
            <Select value={form.status} onValueChange={set('status')}>
              <SelectTrigger data-testid="actor-form-status"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Active">Active</SelectItem>
                <SelectItem value="Inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-[#7089b4]">Profile Completeness (%)</Label>
            <Input type="number" min="0" max="100" data-testid="actor-form-completeness" value={form.profile_completeness} onChange={(e) => set('profile_completeness')(Number(e.target.value))} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-[#7089b4]">Logo</Label>
            <Input type="file" accept="image/*" data-testid="actor-form-logo" onChange={(e) => setLogoFile(e.target.files?.[0] || null)} />
          </div>
          <div className="flex items-center gap-2 col-span-2 mt-1">
            <Checkbox id="charter" data-testid="actor-form-charter" checked={form.charter_signed} onCheckedChange={set('charter_signed')} />
            <Label htmlFor="charter" className="text-[#032b71]">Charter Signed</Label>
          </div>

          <DialogFooter className="col-span-2 mt-2">
            <Button type="button" variant="outline" className="border-[#0f48aa] text-[#0f48aa]" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" data-testid="actor-form-submit" disabled={saving} className="bg-[#0f48aa] text-white hover:bg-[#0d3d91]">
              {saving ? 'Saving...' : 'Save Actor'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
