import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import { useAvailableBatches } from '@/hooks/useTransactions';

// "Add batch details" modal, shared by Send (draws from Final Product
// stock) and Process (draws from Raw Material stock for the source side).
// Matches the audit: table of available batches with a Select checkbox,
// each selected batch gets its own editable quantity, a running selection
// summary with a progress bar, an over-selection warning (NOT a hard
// block — the audit shows the person corrected it themselves rather than
// being prevented from confirming), and "No batches found" when the
// product/standard combination has nothing available. Confirm is only
// blocked when zero batches are selected, matching the audit's tested
// validation message "Please select atleast one batch".
export default function BatchPickerModal({ open, onOpenChange, product, standard, stockType, requiredQuantity, onConfirm, testIdPrefix = 'batch-picker' }) {
  const { t } = useTranslation();
  const { data: batches = [], isLoading } = useAvailableBatches({ product, standard, stockType });
  const [selections, setSelections] = useState({}); // stockId -> quantity

  useEffect(() => {
    if (open) setSelections({});
  }, [open]);

  const toggleBatch = (batch, checked) => {
    setSelections((s) => {
      const next = { ...s };
      if (checked) {
        const required = Number(requiredQuantity) || 0;
        const alreadySelected = Object.values(next).reduce((sum, q) => sum + Number(q), 0);
        const remaining = Math.max(required - alreadySelected, 0);
        next[batch.id] = Math.min(Number(batch.quantity_available), remaining || Number(batch.quantity_available));
      } else {
        delete next[batch.id];
      }
      return next;
    });
  };

  const setQuantity = (stockId, value) => setSelections((s) => ({ ...s, [stockId]: value }));
  const removeSelection = (stockId) => setSelections((s) => { const next = { ...s }; delete next[stockId]; return next; });

  const totalSelected = Object.values(selections).reduce((sum, q) => sum + (Number(q) || 0), 0);
  const required = Number(requiredQuantity) || 0;
  const progressPct = required > 0 ? Math.min((totalSelected / required) * 100, 100) : 0;
  const overSelected = required > 0 && totalSelected > required;
  const selectedCount = Object.keys(selections).length;

  const handleConfirm = () => {
    const result = Object.entries(selections).map(([stockId, quantity]) => {
      const batch = batches.find((b) => b.id === stockId);
      return { stockId, quantity: Number(quantity), batchReference: batch?.batch_reference };
    });
    onConfirm(result, totalSelected);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-white max-h-[85vh] overflow-y-auto" data-testid={`${testIdPrefix}-modal`}>
        <DialogHeader>
          <DialogTitle className="text-[#032b71] font-black">{t('batchPicker.title')}</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <p className="text-sm text-[#7089b4]">{t('common.loading')}</p>
        ) : batches.length === 0 ? (
          <p className="text-sm text-[#7089b4]" data-testid={`${testIdPrefix}-empty`}>{t('batchPicker.noBatchesFound')}</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[#7089b4] border-b border-[#cfd8e6]">
                <th className="py-2 w-10"></th>
                <th className="py-2">{t('batchPicker.id')}</th>
                <th className="py-2">{t('batchPicker.batch')}</th>
                <th className="py-2">{t('batchPicker.quantityAvailable')}</th>
                <th className="py-2 w-32">{t('batchPicker.select')}</th>
              </tr>
            </thead>
            <tbody>
              {batches.map((b, idx) => {
                const isSelected = b.id in selections;
                return (
                  <tr key={b.id} className="border-b border-[#f0f0f0] text-[#032b71]" data-testid={`${testIdPrefix}-row-${idx}`}>
                    <td className="py-2">
                      <Checkbox
                        data-testid={`${testIdPrefix}-checkbox-${idx}`}
                        checked={isSelected}
                        onCheckedChange={(checked) => toggleBatch(b, checked)}
                      />
                    </td>
                    <td className="py-2">{idx + 1}</td>
                    <td className="py-2">{b.batch_reference}</td>
                    <td className="py-2">{b.quantity_available} {b.unit}</td>
                    <td className="py-2">
                      {isSelected && (
                        <div className="flex items-center gap-1">
                          <Input
                            type="number" min="0" max={b.quantity_available}
                            data-testid={`${testIdPrefix}-qty-${idx}`}
                            value={selections[b.id]}
                            onChange={(e) => setQuantity(b.id, e.target.value)}
                            className="h-8 w-20"
                          />
                          <button type="button" onClick={() => removeSelection(b.id)} data-testid={`${testIdPrefix}-remove-${idx}`}>
                            <X className="h-4 w-4 text-[#0f48aa]" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        <div className="bg-[#ebf6ff] border border-[#cfd8e6] rounded-[5px] p-4 mt-2" data-testid={`${testIdPrefix}-summary`}>
          <div className="flex justify-between text-sm mb-2">
            <span className="text-[#7089b4]">{t('batchPicker.selectionSummary')}</span>
            <span className={overSelected ? 'text-[#ba550c] font-bold' : 'text-[#032b71] font-bold'}>
              {totalSelected} / {required} {batches[0]?.unit || 'Kg'}
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-[#e3e9f5] overflow-hidden">
            <div className={`h-full transition-all ${overSelected ? 'bg-[#ba550c]' : 'bg-[#0f48aa]'}`} style={{ width: `${progressPct}%` }} />
          </div>
          {overSelected && (
            <p className="text-xs text-[#ba550c] mt-2" data-testid={`${testIdPrefix}-over-selection-warning`}>
              {t('batchPicker.overSelectionWarning')}
            </p>
          )}
        </div>

        <DialogFooter className="mt-2">
          <Button type="button" variant="outline" className="border-[#cfd8e6] text-[#032b71]" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            type="button"
            data-testid={`${testIdPrefix}-confirm`}
            disabled={selectedCount === 0}
            onClick={handleConfirm}
            className="bg-[#0f48aa] text-white hover:bg-[#0d3d91]"
          >
            {t('batchPicker.confirmSelection')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
