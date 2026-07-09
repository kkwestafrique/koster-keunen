import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useConstants } from '@/hooks/useConstants';
import { useCreateVillage } from '@/hooks/useVillages';
import { useToast } from '@/hooks/use-toast';

const EMPTY = { name: '', country: '', state_region: '', lga_municipality: '' };

export default function VillageFormDialog({ open, onOpenChange }) {
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const { data: countries = [] } = useConstants('country');
  const createVillage = useCreateVillage();
  const { toast } = useToast();

  const set = (key) => (val) => setForm((f) => ({ ...f, [key]: val }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await createVillage.mutateAsync(form);
      toast({ title: 'Village created', description: `${form.name} was added successfully.` });
      setForm(EMPTY);
      onOpenChange(false);
    } catch (err) {
      toast({ title: 'Failed to create village', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg bg-white" data-testid="village-form-dialog">
        <DialogHeader>
          <DialogTitle className="text-[#032b71] font-black">Add Village</DialogTitle>
          <DialogDescription>Enter the village details below.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4">
          <div className="flex flex-col gap-1.5">
            <Label className="text-[#7089b4]">Village Name</Label>
            <Input data-testid="village-form-name" required value={form.name} onChange={(e) => set('name')(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-[#7089b4]">Country</Label>
            <Select value={form.country} onValueChange={set('country')}>
              <SelectTrigger data-testid="village-form-country"><SelectValue placeholder="Select country" /></SelectTrigger>
              <SelectContent>
                {countries.map((c) => <SelectItem key={c.id} value={c.value}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-[#7089b4]">State / Region</Label>
            <Input data-testid="village-form-state" value={form.state_region} onChange={(e) => set('state_region')(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-[#7089b4]">LGA / Municipality</Label>
            <Input data-testid="village-form-lga" value={form.lga_municipality} onChange={(e) => set('lga_municipality')(e.target.value)} />
          </div>

          <DialogFooter className="mt-2">
            <Button type="button" variant="outline" className="border-[#0f48aa] text-[#0f48aa]" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" data-testid="village-form-submit" disabled={saving} className="bg-[#0f48aa] text-white hover:bg-[#0d3d91]">
              {saving ? 'Saving...' : 'Save Village'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
