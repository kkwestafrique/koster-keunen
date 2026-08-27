import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { History } from 'lucide-react';
import { useFieldChangeHistory } from '@/hooks/useFieldChangeHistory';
import { formatDateTime } from '@/lib/dateFormat';

const ACTION_LABELS = { INSERT: 'created', UPDATE: 'updated', DELETE: 'deleted' };

// Gap 9 (Medium, Phase 9): field-level change history, Admin only. Scope
// is Transactions, Contracts, and Stocks only (not every entity type) --
// confirmed with Babs. This component doesn't check the role itself;
// callers only render it when usePermissions().canViewChangeHistory is
// true, and field_change_log's own RLS SELECT policy is the real
// boundary regardless of what the UI does.
export default function ChangeHistoryDialog({ tableName, recordId, groupId, testId }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const { data: entries = [], isLoading } = useFieldChangeHistory({ tableName, recordId, groupId });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        data-testid={testId || 'change-history-trigger'}
        className="border-[#cfd8e6] text-[#7089b4] bg-white hover:bg-[#f5f5f5]"
        onClick={() => setOpen(true)}
      >
        <History className="h-3.5 w-3.5 mr-1" /> {t('changeHistory.button')}
      </Button>
      <DialogContent className="max-w-2xl bg-white max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-[#032b71] font-black">{t('changeHistory.title')}</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <p className="text-sm text-[#7089b4]">{t('common.loading')}</p>
        ) : entries.length === 0 ? (
          <p className="text-sm text-[#7089b4]" data-testid="change-history-empty">{t('changeHistory.noHistory')}</p>
        ) : (
          <div className="flex flex-col gap-4">
            {entries.map((entry) => (
              <div key={entry.id} className="border border-[#cfd8e6] rounded-[5px] p-3" data-testid={`change-history-entry-${entry.id}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-bold text-[#032b71]">
                    {t(`changeHistory.action.${ACTION_LABELS[entry.action] || entry.action}`)}
                  </span>
                  <span className="text-xs text-[#7089b4]">{formatDateTime(entry.changed_at)}</span>
                </div>
                <p className="text-xs text-[#7089b4] mb-2">
                  {t('changeHistory.by')}: {entry.changed_by_name || t('activityLog.unknown')}
                </p>
                {entry.action === 'UPDATE' && entry.changed_fields?.length > 0 && (
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-[#7089b4] border-b border-[#f0f0f0]">
                        <th className="py-1 pr-2">{t('changeHistory.field')}</th>
                        <th className="py-1 pr-2">{t('changeHistory.oldValue')}</th>
                        <th className="py-1">{t('changeHistory.newValue')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {entry.changed_fields.map((field) => (
                        <tr key={field} className="border-b border-[#f8f8f8] text-[#032b71]">
                          <td className="py-1 pr-2 font-medium">{field}</td>
                          <td className="py-1 pr-2 text-[#7089b4]">{String(entry.old_data?.[field] ?? '—')}</td>
                          <td className="py-1">{String(entry.new_data?.[field] ?? '—')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
