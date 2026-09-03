import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Download, Bell, ChevronDown, Loader2, CheckCircle2, XCircle, Menu, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useAllActorsLite } from '@/hooks/useActors';
import { useRecentExports, useDeleteExport } from '@/hooks/useExports';
import { useNotifications, useMarkNotificationRead, useMarkAllNotificationsRead } from '@/hooks/useNotifications';
import { useUpdateMyProfile } from '@/hooks/useMyProfile';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { getFriendlyErrorMessage } from '@/lib/errorMessages';
import { usePermissions } from '@/hooks/usePermissions';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const LANGUAGES = [
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'fr', label: 'French', flag: '🇫🇷' },
];

function LanguageSwitcher() {
  const { i18n, t } = useTranslation();
  const { profile } = useAuth();
  const updateProfile = useUpdateMyProfile();
  const current = LANGUAGES.find((l) => l.code === i18n.language) || LANGUAGES[0];

  const handleChangeLanguage = (code) => {
    i18n.changeLanguage(code);
    // Persist the choice, not just apply it for this session -- previously
    // this only ever called i18n.changeLanguage(), so the choice never
    // survived a fresh login on a different device/browser. Best-effort:
    // if this fails (e.g. profile not loaded yet), the language still
    // changes for the current session regardless. The database stores the
    // full word ('English'/'French'), not i18next's 2-letter code -- a
    // real mismatch confirmed directly against the live constraint.
    if (profile?.id) {
      const dbLanguage = code === 'fr' ? 'French' : 'English';
      updateProfile.mutate({ id: profile.id, username: profile.username, language_preference: dbLanguage });
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          data-testid="language-switcher"
          className="flex items-center gap-1.5 border border-[#cfd8e6] rounded px-2.5 py-1.5 text-sm text-[#032b71] hover:bg-[#f5f5f5] transition-colors"
        >
          <span className="text-sm leading-none">{current.flag}</span>
          <span className="text-xs font-medium">{current.code === 'en' ? 'En' : 'Fr'}</span>
          <ChevronDown className="h-3 w-3 text-[#5a6f9a]" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <div className="px-3 py-1.5 text-xs font-semibold text-[#032b71]">{t('topbar.languages')}</div>
        {LANGUAGES.map((lang) => (
          <DropdownMenuItem
            key={lang.code}
            data-testid={`language-option-${lang.code}`}
            onClick={() => handleChangeLanguage(lang.code)}
            className="flex items-center gap-2"
          >
            <span>{lang.flag}</span>
            <span>{lang.code === 'en' ? t('topbar.english') : t('topbar.french')}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function statusIcon(status) {
  if (status === 'Completed') return <CheckCircle2 className="h-4 w-4 text-[#219653] shrink-0" />;
  if (status === 'Failed') return <XCircle className="h-4 w-4 text-[#ba550c] shrink-0" />;
  return <Loader2 className="h-4 w-4 text-[#5a6f9a] shrink-0 animate-spin" />;
}

function DownloadsPanel() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { canDelete } = usePermissions();
  const { data: exports = [] } = useRecentExports();
  const deleteExport = useDeleteExport();

  const handleDelete = async (id) => {
    try {
      await deleteExport.mutateAsync(id);
    } catch (err) {
      toast({ title: t('topbar.downloadDeleteFailed'), description: getFriendlyErrorMessage(err), variant: 'destructive' });
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          data-testid="top-bar-download"
          aria-label={t('topbar.downloads')}
          className="relative h-9 w-9 flex items-center justify-center rounded-full hover:bg-[#f5f5f5] transition-colors"
        >
          <Download className="h-5 w-5 text-[#032b71]" />
          {exports.some((e) => e.status === 'Inprogress') && (
            <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-[#0f48aa]" data-testid="top-bar-download-active-indicator" />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0 bg-white" data-testid="downloads-panel">
        <div className="px-4 py-3 border-b border-[#f0f0f0]">
          <p className="text-sm font-bold text-[#032b71]">{t('topbar.downloads')}</p>
        </div>
        <div className="max-h-80 overflow-y-auto">
          {exports.length === 0 ? (
            <p className="text-sm text-[#5a6f9a] text-center py-8">{t('topbar.noDownloadsYet')}</p>
          ) : (
            exports.map((e) => (
              <div key={e.id} className="flex items-start gap-2.5 px-4 py-2.5 border-b border-[#f5f5f5] last:border-0" data-testid={`download-row-${e.id}`}>
                {statusIcon(e.status)}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[#032b71] font-medium truncate">{e.file_name}</p>
                  <p className="text-xs text-[#5a6f9a]">
                    {e.status === 'Inprogress' && t('topbar.downloadInProgress')}
                    {e.status === 'Completed' && t('topbar.downloadRowCount', { count: e.row_count ?? 0 })}
                    {e.status === 'Failed' && (e.error_message || t('topbar.downloadFailed'))}
                  </p>
                </div>
                {e.status === 'Completed' && e.file_url && (
                  <a
                    href={e.file_url}
                    download
                    data-testid={`download-link-${e.id}`}
                    className="text-xs font-bold text-[#0f48aa] hover:underline shrink-0"
                  >
                    {t('topbar.downloadAgain')}
                  </a>
                )}
                {canDelete && (
                  <button
                    type="button"
                    aria-label={t('topbar.deleteDownload')}
                    data-testid={`download-delete-${e.id}`}
                    onClick={() => handleDelete(e.id)}
                    className="text-[#5a6f9a] hover:text-[#ba550c] shrink-0 p-0.5"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function timeAgo(dateStr) {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function NotificationBell() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: notifications = [] } = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  const unreadCount = notifications.filter((n) => !n.read_at).length;

  const handleClick = (n) => {
    if (!n.read_at) markRead.mutate(n.id);
    if (n.link) navigate(n.link);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          data-testid="top-bar-notifications"
          aria-label={unreadCount > 0 ? t('topbar.notificationsUnread', { count: unreadCount }) : t('topbar.notifications')}
          className="relative h-9 w-9 flex items-center justify-center rounded-full hover:bg-[#f5f5f5] transition-colors"
        >
          <Bell className="h-5 w-5 text-[#032b71]" />
          {unreadCount > 0 && (
            <span
              className="absolute top-0.5 right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-[#ba550c] text-white text-[10px] font-bold flex items-center justify-center"
              data-testid="top-bar-notifications-count"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0 bg-white" data-testid="notifications-panel">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#f0f0f0]">
          <p className="text-sm font-bold text-[#032b71]">{t('topbar.notifications')}</p>
          {unreadCount > 0 && (
            <button
              data-testid="mark-all-notifications-read"
              onClick={() => markAllRead.mutate()}
              className="text-xs font-bold text-[#0f48aa] hover:underline"
            >
              {t('topbar.markAllRead')}
            </button>
          )}
        </div>
        <div className="max-h-96 overflow-y-auto">
          {notifications.length === 0 ? (
            <p className="text-sm text-[#5a6f9a] text-center py-8">{t('topbar.noNotificationsYet')}</p>
          ) : (
            notifications.map((n) => (
              <button
                key={n.id}
                data-testid={`notification-row-${n.id}`}
                onClick={() => handleClick(n)}
                className={`w-full text-left flex items-start gap-2.5 px-4 py-2.5 border-b border-[#f5f5f5] last:border-0 hover:bg-[#f5f5f5] transition-colors ${!n.read_at ? 'bg-[#ebf6ff]' : ''}`}
              >
                {!n.read_at && <span className="h-2 w-2 rounded-full bg-[#0f48aa] mt-1.5 shrink-0" />}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[#032b71] font-medium">{n.title}</p>
                  {n.message && <p className="text-xs text-[#5a6f9a] truncate">{n.message}</p>}
                  <p className="text-xs text-[#5a6f9a] mt-0.5">{timeAgo(n.created_at)}</p>
                </div>
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default function TopBar({ onOpenMobileMenu }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, profile, signOut } = useAuth();
  const { data: actors = [] } = useAllActorsLite();
  const currentActor = actors.find((a) => a.id === profile?.current_actor_id);
  const displayName = profile?.username || user?.email || 'User';

  return (
    <header
      className="h-16 flex items-center justify-between px-4 md:px-8 bg-white sticky top-0 z-10 border-b border-[#e2eaf5]"
      data-testid="top-bar"
    >
      <div className="flex items-center gap-4">
        {/* Real gap found via the newest audit (M2): with the sidebar
            now correctly hidden by default on small screens, there was
            no way to actually open it -- this is that entry point,
            visible only below the md breakpoint where the sidebar
            itself is hidden. */}
        <button
          data-testid="top-bar-menu-toggle"
          aria-label={t('topbar.openMenu')}
          onClick={onOpenMobileMenu}
          className="md:hidden h-9 w-9 flex items-center justify-center rounded-full hover:bg-[#f5f5f5] transition-colors shrink-0"
        >
          <Menu className="h-5 w-5 text-[#032b71]" />
        </button>
        <div className="text-lg font-black text-[#0f48aa] truncate max-w-[140px] md:max-w-none" data-testid="top-bar-actor-name">
          {currentActor?.contact_name || 'Koster Keunen'}
        </div>
      </div>
      <div className="flex items-center gap-2 md:gap-4">
        <LanguageSwitcher />

        <NotificationBell />
        <DownloadsPanel />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              data-testid="top-bar-account-menu"
              className="flex items-center gap-2 hover:bg-[#f5f5f5] rounded-[4px] px-2 py-1 transition-colors"
            >
              <Avatar className="h-8 w-8">
                <AvatarImage src={currentActor?.logo_url} alt={displayName} />
                <AvatarFallback className="bg-[#0f48aa] text-white text-xs font-bold">
                  {displayName[0]?.toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm text-[#032b71] font-medium" data-testid="top-bar-username">
                {displayName}
              </span>
              <ChevronDown className="h-4 w-4 text-[#5a6f9a]" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem data-testid="top-bar-my-profile" onClick={() => navigate('/user-profile')}>
              {t('topbar.myProfile')}
            </DropdownMenuItem>
            <DropdownMenuItem data-testid="logout-button" onClick={signOut}>
              {t('topbar.logout')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
