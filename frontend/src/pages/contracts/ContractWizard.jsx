import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import AppLayout from '@/components/layout/AppLayout';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import StandardBadge from '@/components/common/StandardBadge';
import { Plus, Trash2 } from 'lucide-react';
import { CURRENCIES, PRODUCTS, UNITS, STANDARDS } from '@/data/regions';
import { useAllActorsLite } from '@/hooks/useActors';
import { useCreateContract } from '@/hooks/useContracts';
import { useToast } from '@/hooks/use-toast';

const YEARS = ['2027', '2026', '2025', '2024', '2023', '2022'];
const EMPTY_PRODUCT_ROW = { product: '', expected_quantity: '', unit: 'Kg', price: '' };

// Full-page two-step Create Contract wizard, matching the live site:
// Step 1 Contract details -> Step 2 Contract summary. Not a modal.
export default function ContractWizard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: actors = [] } = useAllActorsLite();
  const createContract = useCreateContract();

  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    year: '',
    standard: '',
    supplier_actor_id: '',
    currency: '',
    products: [{ ...EMPTY_PRODUCT_ROW }],
    advance_amount_paid: '',
    advance_percent: '',
    comments: '',
    signature_date: '',
  });

  const set = (key) => (val) => setForm((f) => ({ ...f, [key]: val }));
  const setProductRow = (idx, patch) =>
    setForm((f) => ({
      ...f,
      products: f.products.map((row, i) => (i === idx ? { ...row, ...patch } : row)),
    }));
  const addProductRow = () => setForm((f) => ({ ...f, products: [...f.products, { ...EMPTY_PRODUCT_ROW }] }));
  const removeProductRow = (idx) =>
    setForm((f) => ({ ...f, products: f.products.filter((_, i) => i !== idx) }));

  const supplier = actors.find((a) => a.id === form.supplier_actor_id);
  const totalQuantity = form.products.reduce((sum, p) => sum + (Number(p.expected_quantity) || 0), 0);
  const detailsValid = form.year && form.standard && form.currency && form.signature_date
    && form.products.every((p) => p.product && p.expected_quantity);

  const handleSubmit = async () => {
    setSaving(true);
    try {
      await createContract.mutateAsync({
        year: Number(form.year),
        standard: form.standard,
        supplier_actor_id: form.supplier_actor_id || null,
        currency: form.currency,
        products: form.products,
        total_quantity_expected: totalQuantity,
        advance_amount_paid: Number(form.advance_amount_paid) || 0,
        advance_percent: Number(form.advance_percent) || 0,
        comments: form.comments,
        signature_date: form.signature_date,
        contract_type: 'Send',
      });
      toast({ title: t('contractWizard.created') });
      navigate('/contracts');
    } catch (err) {
      toast({ title: t('contractWizard.createFailed'), description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppLayout hideDefaultHeader>
      <h1 className="text-lg font-black text-[#0f48aa] mb-6">{t('contractWizard.title')}</h1>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_240px] gap-6 items-start">
        <div className="bg-white border border-[#cfd8e6] rounded-[5px] p-6">
          {step === 1 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4" data-testid="contract-wizard-step1">
              <div className="flex flex-col gap-1.5">
                <Label className="text-[#7089b4]">{t('contractWizard.year')}</Label>
                <Select value={form.year} onValueChange={set('year')}>
                  <SelectTrigger data-testid="contract-year"><SelectValue placeholder={t('contractWizard.selectYear')} /></SelectTrigger>
                  <SelectContent>
                    {YEARS.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-[#7089b4]">{t('contractWizard.standard')}</Label>
                <Select value={form.standard} onValueChange={set('standard')}>
                  <SelectTrigger data-testid="contract-standard"><SelectValue placeholder={t('contractWizard.selectStandard')} /></SelectTrigger>
                  <SelectContent>
                    {STANDARDS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-[#7089b4]">{t('contractWizard.supplier')}</Label>
                <Select value={form.supplier_actor_id} onValueChange={set('supplier_actor_id')}>
                  <SelectTrigger data-testid="contract-supplier"><SelectValue placeholder={t('contractWizard.selectSupplier')} /></SelectTrigger>
                  <SelectContent>
                    {actors.length === 0 ? (
                      <div className="px-3 py-2 text-sm text-[#7089b4]">{t('contractWizard.noSupplierFound')}</div>
                    ) : (
                      actors.map((a) => <SelectItem key={a.id} value={a.id}>{a.contact_name}</SelectItem>)
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-[#7089b4]">{t('contractWizard.currency')}</Label>
                <Select value={form.currency} onValueChange={set('currency')}>
                  <SelectTrigger data-testid="contract-currency"><SelectValue placeholder={t('contractWizard.selectCurrency')} /></SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="col-span-full flex flex-col gap-3">
                <Label className="text-[#032b71] font-bold">{t('contractWizard.products')}</Label>
                {form.products.map((row, idx) => (
                  <div key={idx} className="grid grid-cols-2 md:grid-cols-[2fr_1fr_1fr_1fr_auto] gap-3 items-end" data-testid={`contract-product-row-${idx}`}>
                    <div className="flex flex-col gap-1.5">
                      <Label className="text-[#7089b4] text-xs">{t('contractWizard.product')}</Label>
                      <Select value={row.product} onValueChange={(v) => setProductRow(idx, { product: v })}>
                        <SelectTrigger><SelectValue placeholder={t('contractWizard.selectProduct')} /></SelectTrigger>
                        <SelectContent>
                          {PRODUCTS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label className="text-[#7089b4] text-xs">{t('contractWizard.expectedQuantity')}</Label>
                      <Input type="number" min="0" value={row.expected_quantity} onChange={(e) => setProductRow(idx, { expected_quantity: e.target.value })} />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label className="text-[#7089b4] text-xs">{t('contractWizard.unit')}</Label>
                      <Select value={row.unit} onValueChange={(v) => setProductRow(idx, { unit: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label className="text-[#7089b4] text-xs">{t('contractWizard.price')}</Label>
                      <Input type="number" min="0" value={row.price} onChange={(e) => setProductRow(idx, { price: e.target.value })} />
                    </div>
                    {form.products.length > 1 && (
                      <Button type="button" variant="ghost" className="text-[#ba550c]" onClick={() => removeProductRow(idx)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
                <Button type="button" variant="outline" onClick={addProductRow} className="w-fit border-[#0f48aa] text-[#0f48aa]" data-testid="contract-add-product">
                  <Plus className="h-4 w-4 mr-1" /> {t('contractWizard.addMoreProducts')}
                </Button>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label className="text-[#7089b4]">{t('contractWizard.advanceAmountPaid')}</Label>
                <Input type="number" min="0" data-testid="contract-advance-amount" value={form.advance_amount_paid} onChange={(e) => set('advance_amount_paid')(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-[#7089b4]">{t('contractWizard.advancePercent')}</Label>
                <Input type="number" min="0" max="100" data-testid="contract-advance-percent" value={form.advance_percent} onChange={(e) => set('advance_percent')(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-[#7089b4]">{t('contractWizard.signatureDate')}</Label>
                <Input type="date" data-testid="contract-signature-date" value={form.signature_date} onChange={(e) => set('signature_date')(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5 col-span-full">
                <Label className="text-[#7089b4]">{t('contractWizard.comments')}</Label>
                <Textarea data-testid="contract-comments" value={form.comments} onChange={(e) => set('comments')(e.target.value)} rows={3} />
              </div>

              <div className="col-span-full flex justify-between mt-2">
                <Button type="button" variant="outline" className="border-[#cfd8e6] text-[#032b71]" onClick={() => navigate('/contracts')}>
                  {t('contractWizard.back')}
                </Button>
                <Button
                  type="button"
                  data-testid="contract-continue"
                  disabled={!detailsValid}
                  className="bg-[#0f48aa] text-white hover:bg-[#0d3d91]"
                  onClick={() => setStep(2)}
                >
                  {t('contractWizard.continue')}
                </Button>
              </div>
            </div>
          ) : (
            <div data-testid="contract-wizard-step2">
              <h2 className="text-base font-black text-[#032b71] mb-4">{t('contractWizard.summaryTitle')}</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-4 mb-6">
                <SummaryField label={t('contractWizard.year')} value={form.year} />
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs text-[#7089b4]">{t('contractWizard.standard')}</span>
                  <StandardBadge standard={form.standard} />
                </div>
                <SummaryField label={t('contractWizard.supplier')} value={supplier?.contact_name || '—'} />
                <SummaryField label={t('contractWizard.currency')} value={form.currency} />
                <SummaryField label={t('contractWizard.advanceAmountPaid')} value={form.advance_amount_paid || '0'} />
                <SummaryField label={t('contractWizard.advancePercent')} value={`${form.advance_percent || 0}%`} />
                <SummaryField label={t('contractWizard.signatureDate')} value={form.signature_date} />
                <SummaryField label={t('contractWizard.totalQuantityExpected')} value={`${totalQuantity} Kg`} />
              </div>

              <table className="w-full text-sm mb-6">
                <thead>
                  <tr className="text-left text-[#7089b4] border-b border-[#cfd8e6]">
                    <th className="py-2">{t('contractWizard.product')}</th>
                    <th className="py-2">{t('contractWizard.expectedQuantity')}</th>
                    <th className="py-2">{t('contractWizard.unit')}</th>
                    <th className="py-2">{t('contractWizard.price')}</th>
                  </tr>
                </thead>
                <tbody>
                  {form.products.map((row, idx) => (
                    <tr key={idx} className="border-b border-[#f0f0f0] text-[#032b71]">
                      <td className="py-2">{row.product}</td>
                      <td className="py-2">{row.expected_quantity}</td>
                      <td className="py-2">{row.unit}</td>
                      <td className="py-2">{row.price || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {form.comments && (
                <div className="mb-6">
                  <span className="text-xs text-[#7089b4]">{t('contractWizard.comments')}</span>
                  <p className="text-sm text-[#032b71]">{form.comments}</p>
                </div>
              )}

              <div className="flex justify-between">
                <Button type="button" variant="outline" className="border-[#cfd8e6] text-[#032b71]" onClick={() => setStep(1)}>
                  {t('contractWizard.back')}
                </Button>
                <Button
                  type="button"
                  data-testid="contract-submit"
                  disabled={saving}
                  className="bg-[#0f48aa] text-white hover:bg-[#0d3d91]"
                  onClick={handleSubmit}
                >
                  {saving ? t('forms.saving') : t('contractWizard.createContract')}
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Step rail */}
        <div className="bg-white border border-[#cfd8e6] rounded-[5px] p-5 flex flex-col gap-4" data-testid="contract-wizard-steps">
          <StepMarker n={1} active={step === 1} done={step > 1} label={t('contractWizard.stepDetails')} />
          <StepMarker n={2} active={step === 2} done={false} label={t('contractWizard.stepSummary')} />
        </div>
      </div>
    </AppLayout>
  );
}

function SummaryField({ label, value }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-[#7089b4]">{label}</span>
      <span className="text-sm text-[#032b71] font-medium">{value || '—'}</span>
    </div>
  );
}

function StepMarker({ n, active, done, label }) {
  return (
    <div className="flex items-center gap-3">
      <div className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold ${
        active || done ? 'bg-[#0f48aa] text-white' : 'bg-[#ebf6ff] text-[#7089b4]'
      }`}>
        {n}
      </div>
      <span className={`text-sm ${active ? 'font-bold text-[#0f48aa]' : 'text-[#7089b4]'}`}>{label}</span>
    </div>
  );
}
