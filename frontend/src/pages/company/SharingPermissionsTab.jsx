import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { Plus } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useMyGrants, useGrantsReceived, useCreateGrant, useRevokeGrant } from '@/hooks/useSharing';
import { useToast } from '@/hooks/use-toast';

const MODULES = [
  { value: 'actors', labelKey: 'sharing.moduleActors' },
  { value: 'beekeepers', labelKey: 'sharing.moduleBeekeepers' },
  { value: 'contracts', labelKey: 'sharing.moduleContracts' },
  { value: 'transactions', labelKey: 'sharing.moduleTransactions' },
  { value: 'stocks', labelKey: 'sharing.moduleStocks' },
];

const LEVELS = [
  { value: 'View', labelKey: 'sharing.levelView', descKey: 'sharing.levelViewDesc' },
  { value: 'Edit', labelKey: 'sharing.levelEdit', descKey: 'sharing.levelEditDesc' },
  { value: 'Manage', labelKey: 'sharing.levelManage', descKey: 'sharing.levelManageDesc' },
];

const moduleLabel = (t, value) => t(MODULES.find((m) => m.value === value)?.labelKey || value) || value;

function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString();
}

function ShareAccessDialog({ open, onOpenChange }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const createGrant = useCreateGrant();
  const EMPTY = { email: '', module: '', level: '' };
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const set = (key) => (val) => setForm((f) => ({ ...f, [key]: val }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await createGrant.mutateAsync({ email: form.email.trim(), module: form.module, level: form.level });
      toast({ title: t('sharing.shareSuccess'), description: t('sharing.shareSuccessDescription', { email: form.email }) });
      setForm(EMPTY);
      onOpenChange(false);
    } catch (err) {
      toast({ title: t('sharing.shareFailed'), description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) setForm(EMPTY); onOpenChange(v); }}>
      <DialogContent className="max-w-md bg-white" data-testid="share-access-dialog">
        <DialogHeader>
          <DialogTitle className="text-[#032b71] font-black">{t('sharing.shareAccessDialogTitle')}</DialogTitle>
          <DialogDescription>{t('sharing.shareAccessDialogDescription')}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label className="text-[#7089b4]">{t('sharing.email')}</Label>
            <Input
              type="email"
              required
              data-testid="share-access-email"
              placeholder={t('sharing.emailPlaceholder')}
              value={form.email}
              onChange={(e) => set('email')(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-[#7089b4]">{t('sharing.module')}</Label>
            <Select value={form.module} onValueChange={set('module')}>
              <SelectTrigger data-testid="share-access-module">
                <SelectValue placeholder={t('sharing.selectModule')} />
              </SelectTrigger>
              <SelectContent>
                {MODULES.map((m) => (
                  <SelectItem key={m.value} value={m.value} data-testid={`share-access-module-${m.value}`}>
                    {t(m.labelKey)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-[#7089b4]">{t('sharing.permissionLevel')}</Label>
            <Select value={form.level} onValueChange={set('level')}>
              <SelectTrigger data-testid="share-access-level">
                <SelectValue placeholder={t('sharing.selectLevel')} />
              </SelectTrigger>
              <SelectContent>
                {LEVELS.map((lvl) => (
                  <SelectItem key={lvl.value} value={lvl.value} data-testid={`share-access-level-${lvl.value}`}>
                    <div className="flex flex-col py-0.5">
                      <span className="font-medium text-[#032b71]">{t(lvl.labelKey)}</span>
                      <span className="text-xs text-[#7089b4]">{t(lvl.descKey)}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter className="mt-2">
            <Button type="button" variant="outline" className="border-[#cfd8e6] text-[#032b71]" onClick={() => onOpenChange(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              type="submit"
              data-testid="share-access-submit"
              disabled={saving || !form.email || !form.module || !form.level}
              className="bg-[#0f48aa] text-white hover:bg-[#0d3d91]"
            >
              {saving ? t('sharing.sharing') : t('sharing.shareAccess')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function SharingPermissionsTab() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { role } = useAuth();
  const canShare = role === 'Admin' || role === 'Member';

  const { data: myGrants = [], isLoading: loadingMine } = useMyGrants();
  const { data: received = [], isLoading: loadingReceived } = useGrantsReceived();
  const revokeGrant = useRevokeGrant();

  const [shareOpen, setShareOpen] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState(null);

  const confirmRevoke = async () => {
    if (!revokeTarget) return;
    try {
      await revokeGrant.mutateAsync(revokeTarget.id);
      toast({ title: t('sharing.revokeSuccess') });
    } catch (err) {
      toast({ title: t('sharing.revokeFailed'), description: err.message, variant: 'destructive' });
    } finally {
      setRevokeTarget(null);
    }
  };

  return (
    <div className="flex flex-col gap-8" data-testid="sharing-permissions-tab">
      {/* A) Shared by me */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-black text-[#032b71]">{t('sharing.sharedByMe')}</h3>
          {canShare && (
            <Button
              variant="outline"
              data-testid="share-access-button"
              className="border-[#0f48aa] text-[#0f48aa]"
              onClick={() => setShareOpen(true)}
            >
              <Plus className="h-4 w-4 mr-1" /> {t('sharing.shareAccess')}
            </Button>
          )}
        </div>

        {loadingMine ? (
          <p className="text-sm text-[#7089b4]">{t('common.loading')}</p>
        ) : myGrants.length === 0 ? (
          <p className="text-sm text-[#7089b4]" data-testid="shared-by-me-empty">{t('sharing.noSharedByMe')}</p>
        ) : (
          <table className="w-full text-sm" data-testid="shared-by-me-table">
            <thead>
              <tr className="text-left text-[#7089b4] border-b border-[#cfd8e6]">
                <th className="py-2 font-bold">{t('sharing.person')}</th>
                <th className="py-2 font-bold">{t('sharing.module')}</th>
                <th className="py-2 font-bold">{t('sharing.permissionLevel')}</th>
                <th className="py-2 font-bold">{t('sharing.sharedOn')}</th>
                <th className="py-2 font-bold">{t('sharing.status')}</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {myGrants.map((g) => {
                const isActive = !g.revoked_at;
                return (
                  <tr key={g.id} className="border-b border-[#f0f0f0] text-[#032b71]" data-testid={`shared-by-me-row-${g.id}`}>
                    <td className="py-2.5">{g.grantee_username || g.grantee_email}</td>
                    <td className="py-2.5">{moduleLabel(t, g.module)}</td>
                    <td className="py-2.5">{g.permission_level}</td>
                    <td className="py-2.5">{formatDate(g.created_at)}</td>
                    <td className="py-2.5">
                      {isActive ? (
                        <span className="font-bold text-[#219653]">{t('sharing.active')}</span>
                      ) : (
                        <span className="font-bold text-[#7089b4]">
                          {t('sharing.revokedOn', { date: formatDate(g.revoked_at) })}
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 text-right">
                      {isActive && (
                        <Button
                          variant="ghost"
                          size="sm"
                          data-testid={`revoke-grant-${g.id}`}
                          className="text-[#ba550c] hover:bg-[#fff4f4] hover:text-[#ba550c]"
                          onClick={() => setRevokeTarget(g)}
                        >
                          {t('sharing.revoke')}
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* B) Shared with me */}
      <div>
        <h3 className="text-sm font-black text-[#032b71] mb-3">{t('sharing.sharedWithMe')}</h3>
        {loadingReceived ? (
          <p className="text-sm text-[#7089b4]">{t('common.loading')}</p>
        ) : received.length === 0 ? (
          <p className="text-sm text-[#7089b4]" data-testid="shared-with-me-empty">{t('sharing.noSharedWithMe')}</p>
        ) : (
          <table className="w-full text-sm" data-testid="shared-with-me-table">
            <thead>
              <tr className="text-left text-[#7089b4] border-b border-[#cfd8e6]">
                <th className="py-2 font-bold">{t('sharing.sharedBy')}</th>
                <th className="py-2 font-bold">{t('sharing.from')}</th>
                <th className="py-2 font-bold">{t('sharing.module')}</th>
                <th className="py-2 font-bold">{t('sharing.permissionLevel')}</th>
                <th className="py-2 font-bold">{t('sharing.since')}</th>
              </tr>
            </thead>
            <tbody>
              {received.map((g) => (
                <tr key={g.id} className="border-b border-[#f0f0f0] text-[#032b71]" data-testid={`shared-with-me-row-${g.id}`}>
                  <td className="py-2.5">{g.granted_by_username}</td>
                  <td className="py-2.5">{g.grantor_supply_chain_name}</td>
                  <td className="py-2.5">{moduleLabel(t, g.module)}</td>
                  <td className="py-2.5">{g.permission_level}</td>
                  <td className="py-2.5">{formatDate(g.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <ShareAccessDialog open={shareOpen} onOpenChange={setShareOpen} />

      <AlertDialog open={!!revokeTarget} onOpenChange={(v) => !v && setRevokeTarget(null)}>
        <AlertDialogContent data-testid="revoke-confirm-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[#032b71]">{t('sharing.revokeConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {revokeTarget && t('sharing.revokeConfirmDescription', {
                email: revokeTarget.grantee_username || revokeTarget.grantee_email,
                module: moduleLabel(t, revokeTarget.module),
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="revoke-confirm-cancel">{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              data-testid="revoke-confirm-submit"
              className="bg-[#ba550c] hover:bg-[#a34909]"
              onClick={confirmRevoke}
            >
              {t('sharing.revoke')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
