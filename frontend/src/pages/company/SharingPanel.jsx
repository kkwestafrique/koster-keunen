import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import RequiredLabel from '@/components/common/RequiredLabel';
import MissingFieldsHint from '@/components/common/MissingFieldsHint';
import { useUnsavedChanges } from '@/contexts/UnsavedChangesContext';
import { Plus, X } from 'lucide-react';
import { usePermissions } from '@/hooks/usePermissions';
import {
  useMyGrants,
  useGrantsReceived,
  useCreateGrant,
  useRevokeGrant,
  MODULES,
  PERMISSION_LEVELS,
} from '@/hooks/useSharing';
import { useToast } from '@/hooks/use-toast';
import { getFriendlyErrorMessage } from '@/lib/errorMessages';

const MODULE_LABEL_KEYS = {
  actors: 'nav.commercialPartners',
  beekeepers: 'nav.beekeepers',
  contracts: 'nav.contracts',
  transactions: 'nav.transactions',
  stocks: 'nav.stocks',
};

const LEVEL_DESCRIPTION_KEYS = {
  View: 'sharing.levelViewDescription',
  Edit: 'sharing.levelEditDescription',
  Manage: 'sharing.levelManageDescription',
};

function ShareAccessDialog({ open, onOpenChange }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const createGrant = useCreateGrant();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ email: '', module: '', permissionLevel: '' });

  // Real gap found via independent audit (UF4): partially filling this
  // dialog and dismissing it (Cancel, Escape, or the backdrop) silently
  // discarded it. Same single-close-path pattern used consistently
  // across every other form using this guard, after a real bug was
  // found and fixed while wiring AddBeekeeperDialog: one function,
  // checked first, used by every real dismiss path.
  const { hasUnsavedChanges, setHasUnsavedChanges } = useUnsavedChanges();
  useEffect(() => {
    setHasUnsavedChanges(!!(form.email || form.module || form.permissionLevel));
  }, [form, setHasUnsavedChanges]);
  useEffect(() => () => setHasUnsavedChanges(false), [setHasUnsavedChanges]);
  const attemptClose = () => {
    if (hasUnsavedChanges && !window.confirm(t('forms.unsavedChangesWarning'))) return;
    setHasUnsavedChanges(false);
    setForm({ email: '', module: '', permissionLevel: '' });
    onOpenChange(false);
  };

  const valid = form.email && form.module && form.permissionLevel;
  // Real gap found via independent audit (C5): the button was simply
  // disabled with zero indication of what was missing.
  const missingFields = [
    !form.email && t('sharing.personEmail'),
    !form.module && t('sharing.module'),
    !form.permissionLevel && t('sharing.permissionLevel'),
  ].filter(Boolean);

  const handleSubmit = async () => {
    setSaving(true);
    try {
      await createGrant.mutateAsync({
        granteeEmail: form.email,
        module: form.module,
        permissionLevel: form.permissionLevel,
      });
      toast({ title: t('sharing.grantCreated') });
      setHasUnsavedChanges(false);
      attemptClose();
    } catch (err) {
      // Surfaces the RPC's own real error message (e.g. "No account found
      // for that email") rather than a generic failure — the RPC already
      // raises clear, specific exceptions for every real failure case.
      toast({ title: t('sharing.grantFailed'), description: getFriendlyErrorMessage(err), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (v) onOpenChange(v); else attemptClose(); }}>
      <DialogContent className="max-w-md bg-white">
        <DialogHeader>
          <DialogTitle className="text-[#032b71] font-black">{t('sharing.shareAccess')}</DialogTitle>
          <DialogDescription className="sr-only">{t('sharing.shareAccess')}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <RequiredLabel required>{t('sharing.personEmail')}</RequiredLabel>
            <Input
              type="email"
              data-testid="sharing-grantee-email"
              placeholder={t('sharing.personEmailPlaceholder')}
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <RequiredLabel required>{t('sharing.module')}</RequiredLabel>
            <Select value={form.module} onValueChange={(v) => setForm((f) => ({ ...f, module: v }))}>
              <SelectTrigger data-testid="sharing-module"><SelectValue placeholder={t('sharing.selectModule')} /></SelectTrigger>
              <SelectContent>
                {MODULES.map((m) => (
                  <SelectItem key={m} value={m}>{t(MODULE_LABEL_KEYS[m])}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <RequiredLabel required>{t('sharing.permissionLevel')}</RequiredLabel>
            <Select value={form.permissionLevel} onValueChange={(v) => setForm((f) => ({ ...f, permissionLevel: v }))}>
              <SelectTrigger data-testid="sharing-permission-level"><SelectValue placeholder={t('sharing.selectPermissionLevel')} /></SelectTrigger>
              <SelectContent>
                {PERMISSION_LEVELS.map((level) => (
                  <SelectItem key={level} value={level}>{level}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.permissionLevel && (
              <p className="text-xs text-[#5a6f9a]">{t(LEVEL_DESCRIPTION_KEYS[form.permissionLevel])}</p>
            )}
          </div>
        </div>

        <DialogFooter className="mt-2">
          <Button type="button" variant="outline" className="border-[#cfd8e6] text-[#032b71]" onClick={attemptClose}>
            {t('common.cancel')}
          </Button>
          <div className="flex flex-col items-end gap-1">
            <Button
              type="button"
              data-testid="sharing-submit"
              disabled={!valid || saving}
              onClick={handleSubmit}
              className="bg-[#0f48aa] text-white hover:bg-[#0d3d91]"
            >
              {saving ? t('forms.saving') : t('sharing.shareAccess')}
            </Button>
            <MissingFieldsHint missingFields={missingFields} testId="sharing-missing-fields" />
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function SharingPanel() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { canEdit } = usePermissions();
  const { data: myGrants = [], isLoading: loadingMyGrants } = useMyGrants();
  const { data: grantsReceived = [], isLoading: loadingReceived } = useGrantsReceived();
  const revokeGrant = useRevokeGrant();
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [revokingId, setRevokingId] = useState(null);

  const handleRevoke = async (grantId) => {
    if (!window.confirm(t('sharing.confirmRevoke'))) return;
    setRevokingId(grantId);
    try {
      await revokeGrant.mutateAsync(grantId);
      toast({ title: t('sharing.grantRevoked') });
    } catch (err) {
      toast({ title: t('sharing.revokeFailed'), description: getFriendlyErrorMessage(err), variant: 'destructive' });
    } finally {
      setRevokingId(null);
    }
  };

  const activeMyGrants = myGrants.filter((g) => !g.revoked_at);
  const revokedMyGrants = myGrants.filter((g) => g.revoked_at);

  return (
    <div data-testid="sharing-panel">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-black text-[#032b71]">{t('sharing.sharedByMe')}</h3>
        {canEdit && (
          <Button
            type="button"
            size="sm"
            data-testid="sharing-open-dialog"
            className="bg-[#0f48aa] text-white hover:bg-[#0d3d91]"
            onClick={() => setShareDialogOpen(true)}
          >
            <Plus className="h-4 w-4 mr-1" /> {t('sharing.shareAccess')}
          </Button>
        )}
      </div>

      {loadingMyGrants ? (
        <p className="text-sm text-[#5a6f9a] mb-6">{t('common.loading')}</p>
      ) : activeMyGrants.length === 0 && revokedMyGrants.length === 0 ? (
        <p className="text-sm text-[#5a6f9a] mb-6" data-testid="sharing-my-grants-empty">{t('sharing.noneSharedYet')}</p>
      ) : (
        <table className="w-full text-sm mb-6" data-testid="sharing-my-grants-table">
          <thead>
            <tr className="text-left text-[#5a6f9a] border-b border-[#cfd8e6]">
              <th className="py-2">{t('sharing.person')}</th>
              <th className="py-2">{t('sharing.module')}</th>
              <th className="py-2">{t('sharing.permissionLevel')}</th>
              <th className="py-2">{t('sharing.sharedOn')}</th>
              <th className="py-2">{t('sharing.status')}</th>
              <th className="py-2"></th>
            </tr>
          </thead>
          <tbody>
            {[...activeMyGrants, ...revokedMyGrants].map((g) => (
              <tr key={g.id} className="border-b border-[#f0f0f0] text-[#032b71]" data-testid={`sharing-my-grant-${g.id}`}>
                <td className="py-2">{g.grantee_username || g.grantee_email}</td>
                <td className="py-2">{t(MODULE_LABEL_KEYS[g.module] || g.module)}</td>
                <td className="py-2">{g.permission_level}</td>
                <td className="py-2">{g.created_at?.slice(0, 10)}</td>
                <td className="py-2">
                  {g.revoked_at ? (
                    <span className="text-[#5a6f9a]">{t('sharing.revokedOn', { date: g.revoked_at.slice(0, 10) })}</span>
                  ) : (
                    <span className="text-[#219653] font-bold">{t('sharing.active')}</span>
                  )}
                </td>
                <td className="py-2">
                  {!g.revoked_at && canEdit && (
                    <button
                      type="button"
                      data-testid={`sharing-revoke-${g.id}`}
                      disabled={revokingId === g.id}
                      onClick={() => handleRevoke(g.id)}
                      className="text-[#ba550c] hover:underline text-xs flex items-center gap-1"
                    >
                      <X className="h-3 w-3" /> {t('sharing.revoke')}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h3 className="text-sm font-black text-[#032b71] mb-3">{t('sharing.sharedWithMe')}</h3>
      {loadingReceived ? (
        <p className="text-sm text-[#5a6f9a]">{t('common.loading')}</p>
      ) : grantsReceived.length === 0 ? (
        <p className="text-sm text-[#5a6f9a]" data-testid="sharing-received-empty">{t('sharing.nothingSharedWithYouYet')}</p>
      ) : (
        <table className="w-full text-sm" data-testid="sharing-received-table">
          <thead>
            <tr className="text-left text-[#5a6f9a] border-b border-[#cfd8e6]">
              <th className="py-2">{t('sharing.sharedBy')}</th>
              <th className="py-2">{t('sharing.from')}</th>
              <th className="py-2">{t('sharing.module')}</th>
              <th className="py-2">{t('sharing.permissionLevel')}</th>
              <th className="py-2">{t('sharing.since')}</th>
            </tr>
          </thead>
          <tbody>
            {grantsReceived.map((g) => (
              <tr key={g.id} className="border-b border-[#f0f0f0] text-[#032b71]" data-testid={`sharing-received-${g.id}`}>
                <td className="py-2">{g.granted_by_username}</td>
                <td className="py-2">{g.grantor_supply_chain_name}</td>
                <td className="py-2">{t(MODULE_LABEL_KEYS[g.module] || g.module)}</td>
                <td className="py-2">{g.permission_level}</td>
                <td className="py-2">{g.created_at?.slice(0, 10)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <ShareAccessDialog open={shareDialogOpen} onOpenChange={setShareDialogOpen} />
    </div>
  );
}
