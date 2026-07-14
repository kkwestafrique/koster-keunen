import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import AppLayout from '@/components/layout/AppLayout';
import DetailField from '@/components/common/DetailField';
import AddressFields from '@/components/common/AddressFields';
import StandardBadge from '@/components/common/StandardBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Pencil, MoreVertical, Plus } from 'lucide-react';
import { ACTOR_TYPES, STANDARDS, TEAM_ROLES } from '@/data/regions';
import { useAuth } from '@/contexts/AuthContext';
import { useActor, useUpdateActor } from '@/hooks/useActors';
import {
  useTeamMembers, useInviteTeamMember, useUpdateTeamMemberRole, useRemoveTeamMember,
} from '@/hooks/useTeamMembers';
import { uploadMediaFile } from '@/lib/supabaseClient';
import { useToast } from '@/hooks/use-toast';

// Actor (company) profile. Edit mode is deliberately limited, matching the
// live site: only Actor name, Actor type (radio), and logo are editable —
// address/contact stay read-only here. Team members tab supports invite,
// role edit (only role), and remove.
export default function CompanyProfile() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { profile, supplyChainId } = useAuth();
  const actorId = profile?.current_actor_id;
  const { data: currentActor } = useActor(actorId);
  const actor = currentActor || {};
  const updateActor = useUpdateActor();

  const { data: teamMembers = [] } = useTeamMembers(actorId);
  const inviteMember = useInviteTeamMember();
  const updateRole = useUpdateTeamMemberRole();
  const removeMember = useRemoveTeamMember();

  const EMPTY_EDIT_FORM = {
    contact_name: '', actor_type: '', description: '', standards: [],
    country: '', state_region: '', lga_municipality: '', village: '',
    contact_email: '', contact_phone: '',
  };

  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState(EMPTY_EDIT_FORM);
  const [logoFile, setLogoFile] = useState(null);
  const [saving, setSaving] = useState(false);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState({ name: '', email: '', role: '' });
  const [editRoleFor, setEditRoleFor] = useState(null); // member object
  const [roleValue, setRoleValue] = useState('');

  // profile_completeness is computed server-side (weighted by field
  // importance) via a DB trigger — never set manually here.
  const completeness = actor.profile_completeness ?? 0;

  const startEdit = () => {
    setEditForm({
      contact_name: actor.contact_name || '',
      actor_type: actor.actor_type || '',
      description: actor.description || '',
      standards: actor.standards || [],
      country: actor.country || '',
      state_region: actor.state_region || '',
      lga_municipality: actor.lga_municipality || '',
      village: actor.village || '',
      contact_email: actor.contact_email || '',
      contact_phone: actor.contact_phone || '',
    });
    setLogoFile(null);
    setEditing(true);
  };

  const toggleStandard = (std) => setEditForm((f) => ({
    ...f,
    standards: f.standards.includes(std) ? f.standards.filter((s) => s !== std) : [...f.standards, std],
  }));

  const saveEdit = async () => {
    setSaving(true);
    try {
      let patch = { ...editForm };
      if (logoFile) patch.logo_url = await uploadMediaFile(logoFile, 'actors', supplyChainId);
      await updateActor.mutateAsync({ id: actorId, ...patch });
      toast({ title: t('companyProfile.saved') });
      setEditing(false);
    } catch (err) {
      toast({ title: t('companyProfile.saveFailed'), description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const submitInvite = async () => {
    try {
      await inviteMember.mutateAsync({ actorId, ...inviteForm });
      toast({ title: t('companyProfile.memberInvited') });
      setInviteOpen(false);
      setInviteForm({ name: '', email: '', role: '' });
    } catch (err) {
      toast({ title: t('companyProfile.inviteFailed'), description: err.message, variant: 'destructive' });
    }
  };

  const submitRoleEdit = async () => {
    try {
      await updateRole.mutateAsync({ id: editRoleFor.id, actorId, role: roleValue });
      toast({ title: t('companyProfile.roleUpdated') });
      setEditRoleFor(null);
    } catch (err) {
      toast({ title: t('companyProfile.roleUpdateFailed'), description: err.message, variant: 'destructive' });
    }
  };

  const handleRemove = async (member) => {
    try {
      await removeMember.mutateAsync({ id: member.id, actorId });
      toast({ title: t('companyProfile.memberRemoved') });
    } catch (err) {
      toast({ title: t('companyProfile.removeFailed'), description: err.message, variant: 'destructive' });
    }
  };

  return (
    <AppLayout hideDefaultHeader>
      <h1 className="text-lg font-black text-[#0f48aa] mb-4">{t('actorProfile.title')}</h1>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6 items-start">
        <div>
          {/* Header card with inline edit mode */}
          <div className="bg-[#ebf6ff] border border-[#cfd8e6] rounded-[5px] p-6 mb-6" data-testid="company-header-card">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 rounded-full bg-white border border-[#cfd8e6] flex items-center justify-center overflow-hidden shrink-0">
                  {actor.logo_url ? (
                    <img src={actor.logo_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-[#0f48aa] font-black text-xl">{actor.contact_name?.[0]}</span>
                  )}
                </div>
                <div className="flex flex-col gap-1.5">
                  {editing ? (
                    <Input
                      data-testid="company-edit-name"
                      className="bg-white max-w-xs"
                      value={editForm.contact_name}
                      onChange={(e) => setEditForm((f) => ({ ...f, contact_name: e.target.value }))}
                    />
                  ) : (
                    <div className="flex items-center gap-3 flex-wrap">
                      <h2 className="text-xl font-black text-[#032b71]" data-testid="company-name">{actor.contact_name || '—'}</h2>
                      {(actor.standards || []).map((s) => (
                        <StandardBadge key={s} standard={s} />
                      ))}
                    </div>
                  )}
                </div>
              </div>
              {!editing && (
                <Button
                  data-testid="company-profile-edit-button"
                  variant="outline"
                  onClick={startEdit}
                  className="border-[#0f48aa] text-[#0f48aa] bg-white hover:bg-[#f5f5f5]"
                >
                  <Pencil className="h-4 w-4 mr-1" /> {t('actorProfile.edit')}
                </Button>
              )}
            </div>

            {editing ? (
              <div className="flex flex-col gap-4" data-testid="company-edit-form">
                <div className="flex flex-col gap-1.5 max-w-md">
                  <Label className="text-[#7089b4]">{t('actorProfile.contactFullName')}</Label>
                  <Input
                    className="bg-white"
                    data-testid="company-edit-contact-name"
                    value={editForm.contact_name}
                    onChange={(e) => setEditForm((f) => ({ ...f, contact_name: e.target.value }))}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-[#7089b4]">{t('forms.actorType')}</Label>
                  <RadioGroup
                    value={editForm.actor_type}
                    onValueChange={(v) => setEditForm((f) => ({ ...f, actor_type: v }))}
                    className="flex flex-col gap-2"
                  >
                    {ACTOR_TYPES.map((type) => (
                      <label key={type} className="flex items-center gap-2 text-sm text-[#032b71] cursor-pointer">
                        <RadioGroupItem value={type} data-testid={`company-type-${type}`} /> {type}
                      </label>
                    ))}
                  </RadioGroup>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-[#7089b4]">{t('forms.addStandards')}</Label>
                  <div className="flex gap-6">
                    {STANDARDS.map((std) => (
                      <label key={std} className="flex items-center gap-2 text-sm text-[#032b71] cursor-pointer">
                        <Checkbox data-testid={`company-edit-standard-${std}`} checked={editForm.standards.includes(std)} onCheckedChange={() => toggleStandard(std)} /> {std}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col gap-1.5 max-w-xs">
                  <Label className="text-[#7089b4]">{t('forms.logo')}</Label>
                  <Input type="file" accept="image/*" className="bg-white" data-testid="company-edit-logo" onChange={(e) => setLogoFile(e.target.files?.[0] || null)} />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label className="text-[#7089b4]">{t('actorProfile.actorDescription')}</Label>
                  <textarea
                    data-testid="company-edit-description"
                    className="border border-[#cfd8e6] rounded-[5px] bg-white text-[#032b71] text-sm p-3 min-h-[80px] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#0f48aa]"
                    value={editForm.description}
                    onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                  />
                </div>

                <h3 className="text-sm font-black text-[#032b71]">{t('actorProfile.address')}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <AddressFields
                    testIdPrefix="company-edit"
                    value={{
                      country: editForm.country,
                      state_region: editForm.state_region,
                      lga_municipality: editForm.lga_municipality,
                      village: editForm.village,
                    }}
                    onChange={(addr) => setEditForm((f) => ({ ...f, ...addr }))}
                  />
                </div>

                <h3 className="text-sm font-black text-[#032b71]">{t('actorProfile.contactInformation')}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-[#7089b4]">{t('actorProfile.contactEmail')}</Label>
                    <Input
                      type="email"
                      className="bg-white"
                      data-testid="company-edit-contact-email"
                      value={editForm.contact_email}
                      onChange={(e) => setEditForm((f) => ({ ...f, contact_email: e.target.value }))}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-[#7089b4]">{t('actorProfile.contactNumber')}</Label>
                    <Input
                      className="bg-white"
                      data-testid="company-edit-contact-phone"
                      value={editForm.contact_phone}
                      onChange={(e) => setEditForm((f) => ({ ...f, contact_phone: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button variant="outline" className="border-[#cfd8e6] text-[#032b71] bg-white" data-testid="company-edit-discard" onClick={() => setEditing(false)}>
                    {t('companyProfile.discard')}
                  </Button>
                  <Button data-testid="company-edit-save" disabled={saving} className="bg-[#0f48aa] text-white hover:bg-[#0d3d91]" onClick={saveEdit}>
                    {saving ? t('forms.saving') : t('companyProfile.saveChanges')}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-x-12 gap-y-3">
                <DetailField label={t('actorProfile.actorType')} value={actor.actor_type} />
                <DetailField label={t('actorProfile.traceabilityCode')} value={actor.traceability_code} />
                <DetailField label={t('actorProfile.charterSigned')} value={actor.charter_signed ? 'Yes' : 'No'} />
                <DetailField label={t('actorProfile.connectId')} value={actor.connect_id} />
              </div>
            )}
          </div>

          <Tabs defaultValue="details">
            <TabsList className="bg-transparent border-b border-[#cfd8e6] p-0 rounded-none h-auto gap-6 justify-start">
              <TabsTrigger
                value="details"
                data-testid="company-tab-details"
                className="pb-3 rounded-none border-b-2 border-transparent data-[state=active]:border-[#0f48aa] data-[state=active]:bg-transparent data-[state=active]:text-[#0f48aa] data-[state=active]:shadow-none text-[#7089b4] font-bold"
              >
                {t('actorProfile.actorDetails')}
              </TabsTrigger>
              <TabsTrigger
                value="team"
                data-testid="company-tab-team"
                className="pb-3 rounded-none border-b-2 border-transparent data-[state=active]:border-[#0f48aa] data-[state=active]:bg-transparent data-[state=active]:text-[#0f48aa] data-[state=active]:shadow-none text-[#7089b4] font-bold flex items-center gap-2"
              >
                {t('actorProfile.teamMembers')}
                <span className="bg-[#0f48aa] text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                  {teamMembers.length}
                </span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="pt-5">
              <p className="text-xs text-[#7089b4] mb-1">{t('actorProfile.actorDescription')}</p>
              <p className="text-sm text-[#032b71] mb-5">{actor.description || '-'}</p>

              <h3 className="text-sm font-black text-[#032b71] mb-3">{t('actorProfile.address')}</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-5">
                <DetailField label={t('actorProfile.country')} value={actor.country} />
                <DetailField label={t('actorProfile.stateRegion')} value={actor.state_region} />
                <DetailField label={t('actorProfile.lga')} value={actor.lga_municipality} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-5">
                <DetailField label={t('actorProfile.village')} value={actor.village} />
              </div>

              <h3 className="text-sm font-black text-[#032b71] mb-3">{t('actorProfile.contactInformation')}</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <DetailField label={t('actorProfile.contactFullName')} value={actor.contact_name} />
                <DetailField label={t('actorProfile.contactEmail')} value={actor.contact_email} />
                <DetailField label={t('actorProfile.contactNumber')} value={actor.contact_phone} />
              </div>
            </TabsContent>

            <TabsContent value="team" className="pt-5">
              {teamMembers.length === 0 ? (
                <p className="text-sm text-[#7089b4] mb-4">{t('common.noRecordsFound')}</p>
              ) : (
                <table className="w-full text-sm mb-4" data-testid="team-members-table">
                  <thead>
                    <tr className="text-left text-[#7089b4] border-b border-[#cfd8e6]">
                      <th className="py-2 font-bold">{t('companyProfile.memberId')}</th>
                      <th className="py-2 font-bold">{t('companyProfile.member')}</th>
                      <th className="py-2 font-bold">{t('companyProfile.email')}</th>
                      <th className="py-2 font-bold">{t('companyProfile.role')}</th>
                      <th className="py-2 font-bold">{t('companyProfile.status')}</th>
                      <th className="py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {teamMembers.map((m) => (
                      <tr key={m.id} className="border-b border-[#f0f0f0] text-[#032b71]" data-testid={`team-member-row-${m.id}`}>
                        <td className="py-2.5">{String(m.id).slice(0, 8)}</td>
                        <td className="py-2.5">{m.name}</td>
                        <td className="py-2.5">{m.email}</td>
                        <td className="py-2.5">{m.role}</td>
                        <td className="py-2.5">
                          <span className={`font-bold ${m.status === 'Active' ? 'text-[#219653]' : 'text-[#79730a]'}`}>{m.status}</span>
                        </td>
                        <td className="py-2.5 text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button className="p-1 rounded hover:bg-[#f5f5f5]" data-testid={`team-member-menu-${m.id}`}>
                                <MoreVertical className="h-4 w-4 text-[#7089b4]" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => { setEditRoleFor(m); setRoleValue(m.role); }}>
                                {t('actorProfile.edit')}
                              </DropdownMenuItem>
                              <DropdownMenuItem className="text-[#ba550c]" onClick={() => handleRemove(m)}>
                                {t('companyProfile.remove')}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              <Button
                variant="outline"
                data-testid="add-team-member-button"
                className="border-[#0f48aa] text-[#0f48aa]"
                onClick={() => setInviteOpen(true)}
              >
                <Plus className="h-4 w-4 mr-1" /> {t('companyProfile.addNewTeamMembers')}
              </Button>
            </TabsContent>
          </Tabs>
        </div>

        <div className="bg-[#ebf6ff] border border-[#cfd8e6] rounded-[5px] p-5" data-testid="profile-completion-panel">
          <p className="text-sm font-bold text-[#032b71] mb-2">{t('actorProfile.profileCompleted')}</p>
          <p className="text-3xl font-black text-[#0f48aa] mb-3">{completeness}%</p>
          <Progress value={completeness} className="bg-[#c5cae9] [&>div]:bg-[#0f48aa] h-2" />
        </div>
      </div>

      {/* Invite member dialog */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="max-w-md bg-white" data-testid="invite-member-dialog">
          <DialogHeader>
            <DialogTitle className="text-[#032b71] font-black">{t('companyProfile.inviteMember')}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label className="text-[#7089b4]">{t('companyProfile.memberFullName')}</Label>
              <Input data-testid="invite-name" value={inviteForm.name} onChange={(e) => setInviteForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-[#7089b4]">{t('companyProfile.memberEmail')}</Label>
              <Input type="email" data-testid="invite-email" value={inviteForm.email} onChange={(e) => setInviteForm((f) => ({ ...f, email: e.target.value }))} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-[#7089b4]">{t('companyProfile.memberRole')}</Label>
              <Select value={inviteForm.role} onValueChange={(v) => setInviteForm((f) => ({ ...f, role: v }))}>
                <SelectTrigger data-testid="invite-role"><SelectValue placeholder={t('companyProfile.selectRole')} /></SelectTrigger>
                <SelectContent>
                  {TEAM_ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="border-[#cfd8e6] text-[#032b71]" onClick={() => setInviteOpen(false)}>{t('common.cancel')}</Button>
            <Button
              data-testid="invite-submit"
              disabled={!inviteForm.name || !inviteForm.email || !inviteForm.role}
              className="bg-[#0f48aa] text-white hover:bg-[#0d3d91]"
              onClick={submitInvite}
            >
              {t('companyProfile.sendInvite')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit member role dialog — role is the ONLY editable field, per live site */}
      <Dialog open={!!editRoleFor} onOpenChange={(open) => !open && setEditRoleFor(null)}>
        <DialogContent className="max-w-sm bg-white" data-testid="edit-member-dialog">
          <DialogHeader>
            <DialogTitle className="text-[#032b71] font-black">{t('companyProfile.editMember')}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-1.5">
            <Label className="text-[#7089b4]">{t('companyProfile.memberRole')}</Label>
            <Select value={roleValue} onValueChange={setRoleValue}>
              <SelectTrigger data-testid="edit-role-select"><SelectValue /></SelectTrigger>
              <SelectContent>
                {TEAM_ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" className="border-[#cfd8e6] text-[#032b71]" onClick={() => setEditRoleFor(null)}>{t('common.cancel')}</Button>
            <Button data-testid="edit-role-submit" className="bg-[#0f48aa] text-white hover:bg-[#0d3d91]" onClick={submitRoleEdit}>
              {t('companyProfile.editMember')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
