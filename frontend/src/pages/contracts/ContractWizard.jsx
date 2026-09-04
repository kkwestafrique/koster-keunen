import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import AppLayout from '@/components/layout/AppLayout';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import StandardBadge from '@/components/common/StandardBadge';
import SummaryField from '@/components/common/SummaryField';
import MissingFieldsHint from '@/components/common/MissingFieldsHint';
import { Plus, Trash2 } from 'lucide-react';
import { CURRENCIES, PRODUCTS, STANDARDS } from '@/data/regions';
import { useCountries } from '@/hooks/useReferenceData';
import { useActorDirectory, useActingActor } from '@/hooks/useActors';
import { useCreateContract } from '@/hooks/useContracts';
import { useCreateConnection } from '@/hooks/useConnections';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/hooks/use-toast';
import { uploadMediaFile, MEDIA_ACCEPT_ATTR } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { getFriendlyErrorMessage } from '@/lib/errorMessages';

const YEARS = ['2027', '2026', '2025', '2024', '2023', '2022'];
const EMPTY_PRODUCT_ROW = { product: '', expected_quantity: '', unit: 'Kg', price: '' };

// Full-page two-step Create Contract wizard, matching the live site:
// Step 1 Contract details -> Step 2 Contract summary. Not a modal.
export default function ContractWizard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { supplyChainId, profile } = useAuth();
  const { data: actors = [] } = useActorDirectory();
  const { data: countries = [] } = useCountries();
  const createContract = useCreateContract();
  const createConnection = useCreateConnection();
  const { isReadOnly } = useActingActor();

  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [contractFile, setContractFile] = useState(null);
  const fileInputRef = useRef(null);
  const [form, setForm] = useState({
    year: '',
    standard: '',
    supplier_actor_id: '',
    currency: '',
    products: [{ ...EMPTY_PRODUCT_ROW }],
    advance_amount_paid: '',
    comments: '',
    signature_date: '',
  });

  const set = (key) => (val) => setForm((f) => ({ ...f, [key]: val }));

  // Supplier dropdown should only ever offer actors certified for the
  // contract's selected Standard -- previously showed every actor
  // regardless of match, letting a Sustainable contract get signed with
  // a supplier who was never actually Sustainable-certified. Also gated
  // entirely (disabled + empty) until a Standard is picked at all, per
  // spec — there is no sensible supplier list before a Standard exists.
  //
  // Also excludes the actor currently creating this contract -- flagged
  // as a known bug all the way back in the original Contracts audit
  // ("current mock allows selecting yourself as your own supplier"), but
  // checked directly against the code and git history just now: this was
  // never actually implemented in any commit, despite being marked fixed
  // in earlier session notes.
  const suppliersMatchingStandard = form.standard
    ? actors
        .filter((a) => a.id !== profile?.current_actor_id)
        .filter((a) => (a.standards || []).includes(form.standard))
    : [];

  const handleStandardChange = (val) => {
    setForm((f) => {
      const stillValid = actors
        .find((a) => a.id === f.supplier_actor_id)
        ?.standards?.includes(val);
      return { ...f, standard: val, supplier_actor_id: stillValid ? f.supplier_actor_id : '' };
    });
  };

  // Auto-fills Currency from the selected supplier's country (audit:
  // "selecting a supplier auto-filled Currency"). Still just a normal
  // Select afterward — the person can change it manually if needed, this
  // only sets a sensible default at the moment of selection.
  const handleSupplierChange = (actorId) => {
    const selected = actors.find((a) => a.id === actorId);
    const mappedCurrency = selected?.country
      ? countries.find((c) => c.name === selected.country)?.currency
      : null;
    setForm((f) => ({
      ...f,
      supplier_actor_id: actorId,
      currency: mappedCurrency || f.currency,
    }));
  };

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
  const totalContractAmount = form.products.reduce(
    (sum, p) => sum + (Number(p.expected_quantity) || 0) * (Number(p.price) || 0), 0
  );
  const yellowWaxQuantity = form.products
    .filter((p) => p.product === 'Beeswax-Yellow')
    .reduce((sum, p) => sum + (Number(p.expected_quantity) || 0), 0);
  const percentageYellowWax = totalQuantity > 0 ? Math.round((yellowWaxQuantity / totalQuantity) * 100) : null;
  // Advance(%) is NOT user-entered — audit confirms it's a greyed,
  // auto-calculated field (Advance amount paid ÷ Total contract amount).
  const advancePercent = totalContractAmount > 0
    ? Math.round(((Number(form.advance_amount_paid) || 0) / totalContractAmount) * 100)
    : 0;
  // The live totals box only appears once at least one row has both
  // quantity and price filled in (audit finding).
  const showTotalsSummary = form.products.some((p) => p.expected_quantity && p.price);
  // Real bug found via independent audit (BUG-15): "-50" is truthy in
  // JS, so the old check (`p.expected_quantity` alone) let a negative
  // quantity pass all the way through to a real created contract --
  // confirmed exactly, reproducing the audit's own example (-50 Kg
  // reaching Create, producing a nonsense negative total and a
  // silently-zeroed advance percent). The native <input type="number"
  // min="0"> only affects the spinner arrows, not direct typing, so it
  // never actually blocked this. Now requires a genuinely positive
  // number. Price stays optional (an intentionally nullable "TBD"
  // value elsewhere in this flow), but if one is entered, it can't be
  // negative either.
  // Real gap found and confirmed while adding the missing-fields hint
  // below: this check never actually required a supplier to be
  // selected at all. Confirmed directly this wasn't just a theoretical
  // risk -- the database allows contracts.actor_id to be NULL, and the
  // actual submit code explicitly sends null when no supplier was ever
  // chosen (actor_id: form.supplier_actor_id || null). A contract is
  // fundamentally an agreement between two parties; one with no real
  // counterparty at all doesn't just look incomplete on the Summary
  // step (which already showed "Supplier: —" as a fallback) -- it's a
  // contract nothing could ever be meaningfully linked to. No existing
  // contracts currently have a null actor_id, so this was a real but
  // not-yet-triggered risk, not a live data problem.
  const detailsValid = form.year && form.standard && form.supplier_actor_id && form.currency && form.signature_date
    && form.products.every((p) =>
      p.product && Number(p.expected_quantity) > 0
      && (p.price === '' || p.price == null || Number(p.price) >= 0)
    );

  // Real gap found via independent audit (C5): the button was simply
  // disabled with zero indication of what was missing. Computes the
  // actual list of what's still needed, matching detailsValid's real
  // checks exactly -- including the product-line conditions (a real
  // product selected, a real positive expected quantity), summarized
  // as one entry rather than per-row detail given this can be a
  // repeating list.
  const detailsMissingFields = [
    !form.year && t('contractWizard.year'),
    !form.standard && t('contractWizard.standard'),
    form.standard && !form.supplier_actor_id && t('contractWizard.supplier'),
    !form.currency && t('contractWizard.currency'),
    !form.signature_date && t('contractWizard.signatureDate'),
    !form.products.every((p) => p.product && Number(p.expected_quantity) > 0) && t('contractWizard.products'),
  ].filter(Boolean);

  const handleSubmit = async () => {
    setSaving(true);
    try {
      let attachment_url = null;
      if (contractFile) {
        attachment_url = await uploadMediaFile(contractFile, 'contracts', supplyChainId);
      }
      await createContract.mutateAsync({
        year: Number(form.year),
        standard: form.standard,
        actor_id: form.supplier_actor_id || null,
        currency: form.currency,
        products: form.products,
        advance_amount_paid: Number(form.advance_amount_paid) || 0,
        advance_percent: advancePercent,
        comments: form.comments,
        signature_date: form.signature_date,
        contract_type: 'Send',
        country: supplier?.country || null,
        attachment_url,
      });
      // Real gap found live: Contracts used the same unscoped
      // useActorDirectory() Send Stock used to use before being
      // restricted to real connections -- meaning you could create a
      // contract with someone you'd never actually connected to,
      // producing exactly the confusion reported ("actors here that
      // are no longer in the system" -- they were never really
      // connected in the first place). Rather than require connecting
      // first as a separate step (confirmed with Babs as too much
      // friction), creating a contract with someone new now also
      // connects you to them automatically, in this one action --
      // instantly Active, matching the same reasoning already used for
      // brand-new-actor creation: formalizing a contract is an even
      // stronger, clearer signal of an already-real relationship than
      // "Connect via ID" (which still requires the other side's
      // separate approval, since that's just browsing the directory).
      if (form.supplier_actor_id) {
        const { data: existing } = await supabase
          .from('connections')
          .select('id')
          .eq('supply_chain_id', supplyChainId)
          .or(`and(actor_from_id.eq.${profile.current_actor_id},actor_to_id.eq.${form.supplier_actor_id}),and(actor_from_id.eq.${form.supplier_actor_id},actor_to_id.eq.${profile.current_actor_id})`)
          .maybeSingle();
        if (!existing) {
          await createConnection.mutateAsync({
            actor_from_id: profile.current_actor_id,
            actor_to_id: form.supplier_actor_id,
            status: 'Active',
          });
        }
      }
      toast({ title: t('contractWizard.created') });
      navigate('/contracts');
    } catch (err) {
      toast({ title: t('contractWizard.createFailed'), description: getFriendlyErrorMessage(err), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppLayout hideDefaultHeader>
      {isReadOnly ? (
        <div className="bg-[#fdecea] border border-[#f3b8b3] rounded-[5px] p-6 max-w-lg" data-testid="contract-wizard-readonly-block">
          <p className="text-sm text-[#ba550c] font-bold mb-3">{t('common.readOnlyActorTooltip')}</p>
          <Button type="button" variant="outline" className="border-[#cfd8e6] text-[#032b71]" onClick={() => navigate('/contracts')}>
            {t('contractWizard.back')}
          </Button>
        </div>
      ) : (
      <>
      <h1 className="text-lg font-black text-[#0f48aa] mb-6">{t('contractWizard.title')}</h1>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_240px] gap-6 items-start">
        <div className="bg-white border border-[#cfd8e6] rounded-[5px] p-6">
          {step === 1 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4" data-testid="contract-wizard-step1">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="contract-year" className="text-[#5a6f9a]">{t('contractWizard.year')}</Label>
                <Select value={form.year} onValueChange={set('year')}>
                  <SelectTrigger id="contract-year" data-testid="contract-year"><SelectValue placeholder={t('contractWizard.selectYear')} /></SelectTrigger>
                  <SelectContent>
                    {YEARS.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="contract-standard" className="text-[#5a6f9a]">{t('contractWizard.standard')}</Label>
                <Select value={form.standard} onValueChange={handleStandardChange}>
                  <SelectTrigger id="contract-standard" data-testid="contract-standard"><SelectValue placeholder={t('contractWizard.selectStandard')} /></SelectTrigger>
                  <SelectContent>
                    {STANDARDS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="contract-supplier" className="text-[#5a6f9a]">{t('contractWizard.supplier')}</Label>
                <Select value={form.supplier_actor_id} onValueChange={handleSupplierChange} disabled={!form.standard}>
                  <SelectTrigger id="contract-supplier" data-testid="contract-supplier"><SelectValue placeholder={form.standard ? t('contractWizard.selectSupplier') : t('contractWizard.selectStandardFirst')} /></SelectTrigger>
                  <SelectContent>
                    {suppliersMatchingStandard.length === 0 ? (
                      <div className="px-3 py-2 text-sm text-[#5a6f9a]">
                        {form.standard ? t('contractWizard.noSupplierMatchesStandard') : t('contractWizard.selectStandardFirst')}
                      </div>
                    ) : (
                      suppliersMatchingStandard.map((a) => <SelectItem key={a.id} value={a.id}>{a.contact_name}</SelectItem>)
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="contract-currency" className="text-[#5a6f9a]">{t('contractWizard.currency')}</Label>
                <Select value={form.currency} onValueChange={set('currency')}>
                  <SelectTrigger id="contract-currency" data-testid="contract-currency"><SelectValue placeholder={t('contractWizard.selectCurrency')} /></SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="col-span-full flex flex-col gap-3">
                <span className="text-[#032b71] font-bold block">{t('contractWizard.products')}</span>
                {form.products.map((row, idx) => (
                  <div key={idx} className="grid grid-cols-2 md:grid-cols-[2fr_1fr_1fr_1fr_auto] gap-3 items-end" data-testid={`contract-product-row-${idx}`}>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor={`contract-product-${idx}`} className="text-[#5a6f9a] text-xs">{t('contractWizard.product')}</Label>
                      <Select value={row.product} onValueChange={(v) => setProductRow(idx, { product: v })}>
                        <SelectTrigger id={`contract-product-${idx}`} data-testid={`contract-product-${idx}`}><SelectValue placeholder={t('contractWizard.selectProduct')} /></SelectTrigger>
                        <SelectContent>
                          {PRODUCTS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor={`contract-expected-quantity-${idx}`} className="text-[#5a6f9a] text-xs">{t('contractWizard.expectedQuantity')}</Label>
                      <Input id={`contract-expected-quantity-${idx}`} data-testid={`contract-expected-quantity-${idx}`} type="number" min="0" value={row.expected_quantity} onChange={(e) => setProductRow(idx, { expected_quantity: e.target.value })} />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label className="text-[#5a6f9a] text-xs">{t('contractWizard.unit')}</Label>
                      <div className="h-10 flex items-center px-3 text-sm text-[#032b71] bg-[#f4f6fa] rounded-md border border-input" data-testid={`contract-product-unit-${idx}`}>
                        {row.unit}
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor={`contract-price-${idx}`} className="text-[#5a6f9a] text-xs">{t('contractWizard.price')}</Label>
                      <Input id={`contract-price-${idx}`} data-testid={`contract-price-${idx}`} type="number" min="0" value={row.price} onChange={(e) => setProductRow(idx, { price: e.target.value })} />
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

              {showTotalsSummary && (
                <div className="col-span-full grid grid-cols-3 gap-4 bg-[#ebf6ff] border border-[#cfd8e6] rounded-[5px] p-4" data-testid="contract-totals-summary">
                  <SummaryField label={t('contractWizard.totalQuantityExpected')} value={`${totalQuantity}`} />
                  <SummaryField label={t('contractWizard.totalContractAmount')} value={totalContractAmount.toLocaleString()} />
                  <SummaryField label={t('contractWizard.percentageYellowWax')} value={percentageYellowWax != null ? `${percentageYellowWax}%` : '—'} />
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="contract-advance-amount" className="text-[#5a6f9a]">{t('contractWizard.advanceAmountPaid')}</Label>
                <Input id="contract-advance-amount" type="number" min="0" data-testid="contract-advance-amount" value={form.advance_amount_paid} onChange={(e) => set('advance_amount_paid')(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="contract-advance-percent" className="text-[#5a6f9a]">{t('contractWizard.advancePercent')}</Label>
                <Input id="contract-advance-percent" disabled data-testid="contract-advance-percent" value={`${advancePercent}%`} className="bg-[#f4f6fa] text-[#5a6f9a]" />
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-[#5a6f9a] block">{t('contractWizard.uploadContract')}</span>
                <div className="flex items-center gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    className="border-[#0f48aa] text-[#0f48aa] shrink-0"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {t('contractWizard.uploadFile')}
                  </Button>
                  <span className="text-sm text-[#5a6f9a] truncate">{contractFile?.name || t('forms.noFileChosen')}</span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={MEDIA_ACCEPT_ATTR}
                    className="hidden"
                    onChange={(e) => setContractFile(e.target.files?.[0] || null)}
                  />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="contract-signature-date" className="text-[#5a6f9a]">{t('contractWizard.signatureDate')}</Label>
                <Input id="contract-signature-date" type="date" data-testid="contract-signature-date" min="1900-01-01" max="2100-12-31" value={form.signature_date} onChange={(e) => set('signature_date')(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5 col-span-full">
                <Label htmlFor="contract-comments" className="text-[#5a6f9a]">{t('contractWizard.comments')}</Label>
                <Textarea id="contract-comments" data-testid="contract-comments" value={form.comments} onChange={(e) => set('comments')(e.target.value)} rows={3} />
              </div>

              <div className="col-span-full flex justify-between mt-2">
                <Button type="button" variant="outline" className="border-[#cfd8e6] text-[#032b71]" onClick={() => navigate('/contracts')}>
                  {t('contractWizard.back')}
                </Button>
                <div className="flex flex-col items-end gap-1">
                  <Button
                    type="button"
                    data-testid="contract-continue"
                    disabled={!detailsValid}
                    className="bg-[#0f48aa] text-white hover:bg-[#0d3d91]"
                    onClick={() => setStep(2)}
                  >
                    {t('contractWizard.continue')}
                  </Button>
                  <MissingFieldsHint missingFields={detailsMissingFields} testId="contract-missing-fields" />
                </div>
              </div>
            </div>
          ) : (
            <div data-testid="contract-wizard-step2">
              <h2 className="text-base font-black text-[#032b71] mb-4">{t('contractWizard.summaryTitle')}</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-4 mb-6">
                <SummaryField label={t('contractWizard.year')} value={form.year} />
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs text-[#5a6f9a]">{t('contractWizard.standard')}</span>
                  <StandardBadge standard={form.standard} />
                </div>
                <SummaryField label={t('contractWizard.supplier')} value={supplier?.contact_name || '—'} />
                <SummaryField label={t('contractWizard.currency')} value={form.currency} />
                <SummaryField label={t('contractWizard.advanceAmountPaid')} value={form.advance_amount_paid || '0'} />
                <SummaryField label={t('contractWizard.advancePercent')} value={`${advancePercent}%`} />
                <SummaryField label={t('contractWizard.signatureDate')} value={form.signature_date} />
                <SummaryField label={t('contractWizard.totalQuantityExpected')} value={`${totalQuantity} Kg`} />
                <SummaryField label={t('contractWizard.totalContractAmount')} value={totalContractAmount.toLocaleString()} />
                <SummaryField label={t('contractWizard.percentageYellowWax')} value={percentageYellowWax != null ? `${percentageYellowWax}%` : '—'} />
              </div>

              <table className="w-full text-sm mb-6">
                <thead>
                  <tr className="text-left text-[#5a6f9a] border-b border-[#cfd8e6]">
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

              <div className="mb-6">
                <span className="text-xs text-[#5a6f9a]">{t('contractWizard.attachedFile')}</span>
                <p className="text-sm text-[#032b71]">{contractFile?.name || t('contractWizard.noAttachedFiles')}</p>
              </div>

              {form.comments && (
                <div className="mb-6">
                  <span className="text-xs text-[#5a6f9a]">{t('contractWizard.comments')}</span>
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
                  disabled={saving || !detailsValid}
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
      </>
      )}
    </AppLayout>
  );
}

function StepMarker({ n, active, done, label }) {
  return (
    <div className="flex items-center gap-3">
      <div className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold ${
        active || done ? 'bg-[#0f48aa] text-white' : 'bg-[#ebf6ff] text-[#5a6f9a]'
      }`}>
        {n}
      </div>
      <span className={`text-sm ${active ? 'font-bold text-[#0f48aa]' : 'text-[#5a6f9a]'}`}>{label}</span>
    </div>
  );
}
