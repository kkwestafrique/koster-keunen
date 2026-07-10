import React from 'react';
import { Bell, LogOut, ChevronDown } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useAllActorsLite } from '@/hooks/useActors';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

export default function TopBar() {
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
      <div className="flex items-center gap-5">
        <button
          data-testid="top-bar-notifications"
          className="relative h-9 w-9 flex items-center justify-center rounded-full hover:bg-[#f5f5f5] transition-colors"
        >
          <Bell className="h-5 w-5 text-[#032b71]" />
          <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-[#eb5757]" />
        </button>

        <div className="flex items-center gap-1 border border-[#cfd8e6] rounded px-2.5 py-1.5 text-sm text-[#032b71] cursor-default">
          <span className="text-xs">🇬🇧</span>
          <span className="text-xs">Eng</span>
          <ChevronDown className="h-3 w-3 text-[#7089b4]" />
        </div>

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
          <DropdownMenuContent align="end" className="w-48">
            <div className="px-2 py-1.5 text-xs text-[#7089b4]">{profile?.role || 'Viewer'}</div>
            <DropdownMenuSeparator />
            <DropdownMenuItem data-testid="logout-button" onClick={signOut}>
              <LogOut className="h-4 w-4 mr-2" /> Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
