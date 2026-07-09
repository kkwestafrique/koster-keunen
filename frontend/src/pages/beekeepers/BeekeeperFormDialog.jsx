import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAllVillagesLite } from '@/hooks/useVillages';
import { useAllActorsLite } from '@/hooks/useActors';
import { useCreateBeekeeper } from '@/hooks/useBeekeepers';
import { useToast } from '@/hooks/use-toast';

const EMPTY = {
  traceability_code: '',
  full_name: '',
  gender: '',
  village_id: '',
  actor_id: '',
  hives_traditional_single: 0,
  hives_traditional_double: 0,
  hives_modern: 0,
  hives_other: 0,
  active_years: 0,
  status: 'Potential',
};

export default function BeekeeperFormDialog({ open, onOpenChange }) {
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const { data: villages = [] } = useAllVillagesLite();
  const { data: actors = [] } = useAllActorsLite();
  const createBeekeeper = useCreateBeekeeper();
  const { toast } = useToast();

  const set = (key) => (val) => setForm((f) => ({ ...f, [key]: val }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await createBeekeeper.mutateAsync(form);
      toast({ title: 'Beekeeper created', description: `${form.full_name} was added successfully.` });
      setForm(EMPTY);
      onOpenChange(false);
    } catch (err) {
      toast({ title: 'Failed to create beekeeper', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-white" data-testid="beekeeper-form-dialog">
        <DialogHeader>
          <DialogTitle className="text-[#032b71] font-black">Add Beekeeper</DialogTitle>
          <DialogDescription>Enter the beekeeper's details below to add them to the supply chain.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <Label className="text-[#7089b4]">Traceability Code</Label>
            <Input data-testid="bk-form-code" required value={form.traceability_code} onChange={(e) => set('traceability_code')(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-[#7089b4]">Full Name</Label>
            <Input data-testid="bk-form-name" required value={form.full_name} onChange={(e) => set('full_name')(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-[#7089b4]">Gender</Label>
            <Select value={form.gender} onValueChange={set('gender')}>
              <SelectTrigger data-testid="bk-form-gender"><SelectValue placeholder="Select gender" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Male">Male</SelectItem>
                <SelectItem value="Female">Female</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-[#7089b4]">Village</Label>
            <Select value={form.village_id} onValueChange={set('village_id')}>
              <SelectTrigger data-testid="bk-form-village"><SelectValue placeholder="Select village" /></SelectTrigger>
              <SelectContent>
                {villages.map((v) => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5 col-span-2">
            <Label className="text-[#7089b4]">Organisation (Actor)</Label>
            <Select value={form.actor_id} onValueChange={set('actor_id')}>
              <SelectTrigger data-testid="bk-form-actor"><SelectValue placeholder="Select organisation" /></SelectTrigger>
              <SelectContent>
                {actors.map((a) => <SelectItem key={a.id} value={a.id}>{a.contact_name} ({a.traceability_code})</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-[#7089b4]">Traditional Single Hives</Label>
            <Input type="number" min="0" data-testid="bk-form-hts" value={form.hives_traditional_single} onChange={(e) => set('hives_traditional_single')(Number(e.target.value))} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-[#7089b4]">Traditional Double Hives</Label>
            <Input type="number" min="0" data-testid="bk-form-htd" value={form.hives_traditional_double} onChange={(e) => set('hives_traditional_double')(Number(e.target.value))} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-[#7089b4]">Modern Hives</Label>
            <Input type="number" min="0" data-testid="bk-form-modern" value={form.hives_modern} onChange={(e) => set('hives_modern')(Number(e.target.value))} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-[#7089b4]">Other Hives</Label>
            <Input type="number" min="0" data-testid="bk-form-other" value={form.hives_other} onChange={(e) => set('hives_other')(Number(e.target.value))} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-[#7089b4]">Active Years</Label>
            <Input type="number" min="0" data-testid="bk-form-years" value={form.active_years} onChange={(e) => set('active_years')(Number(e.target.value))} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-[#7089b4]">Status</Label>
            <Select value={form.status} onValueChange={set('status')}>
              <SelectTrigger data-testid="bk-form-status"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Potential">Potential</SelectItem>
                <SelectItem value="Actual">Actual</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DialogFooter className="col-span-2 mt-2">
            <Button type="button" variant="outline" className="border-[#0f48aa] text-[#0f48aa]" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" data-testid="bk-form-submit" disabled={saving} className="bg-[#0f48aa] text-white hover:bg-[#0d3d91]">
              {saving ? 'Saving...' : 'Save Beekeeper'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
