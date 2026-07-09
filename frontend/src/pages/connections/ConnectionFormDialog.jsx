import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAllActorsLite } from '@/hooks/useActors';
import { useAllVillagesLite } from '@/hooks/useVillages';
import { useCreateConnection } from '@/hooks/useConnections';
import { useToast } from '@/hooks/use-toast';

const EMPTY = {
  actor_from_id: '',
  actor_to_id: '',
  status: 'Active',
  connection_type: '',
  contact_gender: '',
  year: new Date().getFullYear(),
  village_id: '',
  is_supplier: false,
  is_buyer: false,
};

export default function ConnectionFormDialog({ open, onOpenChange }) {
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const { data: actors = [] } = useAllActorsLite();
  const { data: villages = [] } = useAllVillagesLite();
  const createConnection = useCreateConnection();
  const { toast } = useToast();

  const set = (key) => (val) => setForm((f) => ({ ...f, [key]: val }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await createConnection.mutateAsync(form);
      toast({ title: 'Connection created' });
      setForm(EMPTY);
      onOpenChange(false);
    } catch (err) {
      toast({ title: 'Failed to create connection', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-white" data-testid="connection-form-dialog">
        <DialogHeader>
          <DialogTitle className="text-[#032b71] font-black">Add Connection</DialogTitle>
          <DialogDescription>Link two actors together in the supply chain.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <Label className="text-[#7089b4]">Actor From</Label>
            <Select value={form.actor_from_id} onValueChange={set('actor_from_id')}>
              <SelectTrigger data-testid="conn-form-from"><SelectValue placeholder="Select actor" /></SelectTrigger>
              <SelectContent>
                {actors.map((a) => <SelectItem key={a.id} value={a.id}>{a.contact_name} ({a.traceability_code})</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-[#7089b4]">Actor To</Label>
            <Select value={form.actor_to_id} onValueChange={set('actor_to_id')}>
              <SelectTrigger data-testid="conn-form-to"><SelectValue placeholder="Select actor" /></SelectTrigger>
              <SelectContent>
                {actors.map((a) => <SelectItem key={a.id} value={a.id}>{a.contact_name} ({a.traceability_code})</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-[#7089b4]">Connection Type</Label>
            <Input data-testid="conn-form-type" value={form.connection_type} onChange={(e) => set('connection_type')(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-[#7089b4]">Status</Label>
            <Select value={form.status} onValueChange={set('status')}>
              <SelectTrigger data-testid="conn-form-status"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Active">Active</SelectItem>
                <SelectItem value="Revoked">Revoked</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-[#7089b4]">Contact Gender</Label>
            <Select value={form.contact_gender} onValueChange={set('contact_gender')}>
              <SelectTrigger data-testid="conn-form-gender"><SelectValue placeholder="Select gender" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Male">Male</SelectItem>
                <SelectItem value="Female">Female</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-[#7089b4]">Year</Label>
            <Input type="number" data-testid="conn-form-year" value={form.year} onChange={(e) => set('year')(Number(e.target.value))} />
          </div>
          <div className="flex flex-col gap-1.5 col-span-2">
            <Label className="text-[#7089b4]">Village</Label>
            <Select value={form.village_id} onValueChange={set('village_id')}>
              <SelectTrigger data-testid="conn-form-village"><SelectValue placeholder="Select village" /></SelectTrigger>
              <SelectContent>
                {villages.map((v) => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox id="is_supplier" data-testid="conn-form-supplier" checked={form.is_supplier} onCheckedChange={set('is_supplier')} />
            <Label htmlFor="is_supplier" className="text-[#032b71]">Is Supplier</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox id="is_buyer" data-testid="conn-form-buyer" checked={form.is_buyer} onCheckedChange={set('is_buyer')} />
            <Label htmlFor="is_buyer" className="text-[#032b71]">Is Buyer</Label>
          </div>

          <DialogFooter className="col-span-2 mt-2">
            <Button type="button" variant="outline" className="border-[#0f48aa] text-[#0f48aa]" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" data-testid="conn-form-submit" disabled={saving} className="bg-[#0f48aa] text-white hover:bg-[#0d3d91]">
              {saving ? 'Saving...' : 'Save Connection'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
