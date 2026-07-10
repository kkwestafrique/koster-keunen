import React from 'react';
import { useTranslation } from 'react-i18next';
import { Download, ChevronDown } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useAllActorsLite } from '@/hooks/useActors';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
  const current = LANGUAGES.find((l) => l.code === i18n.language) || LANGUAGES[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          data-testid="language-switcher"
          className="flex items-center gap-1.5 border border-[#cfd8e6] rounded px-2.5 py-1.5 text-sm text-[#032b71] hover:bg-[#f5f5f5] transition-colors"
        >
          <span className="text-sm leading-none">{current.flag}</span>
          <span className="text-xs font-medium">{current.code === 'en' ? 'En' : 'Fr'}</span>
          <ChevronDown className="h-3 w-3 text-[#7089b4]" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <div className="px-3 py-1.5 text-xs font-semibold text-[#032b71]">{t('topbar.languages')}</div>
        {LANGUAGES.map((lang) => (
          <DropdownMenuItem
            key={lang.code}
            data-testid={`language-option-${lang.code}`}
            onClick={() => i18n.changeLanguage(lang.code)}
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

export default function TopBar() {
  const { t } = useTranslation();
  const { user, profile, signOut } = useAuth();
  const { data: actors = [] } = useAllActorsLite();
  const currentActor = actors.find((a) => a.id === profile?.current_actor_id);
  const displayName = profile?.username || user?.email || 'User';

  return (
    <header
      className="h-16 flex items-center justify-between px-8 bg-white sticky top-0 z-10 border-b border-[#e2eaf5]"
      data-testid="top-bar"
    >
      <div className="flex items-center gap-4">
        <h1 className="text-lg font-black text-[#0f48aa]" data-testid="top-bar-actor-name">
          {currentActor?.contact_name || 'Koster Keunen'}
        </h1>
      </div>
      <div className="flex items-center gap-4">
        <LanguageSwitcher />

        <button
          data-testid="top-bar-download"
          className="h-9 w-9 flex items-center justify-center rounded-full hover:bg-[#f5f5f5] transition-colors"
        >
          <Download className="h-5 w-5 text-[#032b71]" />
        </button>

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
              <ChevronDown className="h-4 w-4 text-[#7089b4]" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem data-testid="top-bar-my-profile">
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
