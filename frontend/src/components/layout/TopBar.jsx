import React from 'react';
import { LogOut } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';

export default function TopBar({ title }) {
  const { user, profile, signOut } = useAuth();

  return (
    <header
      className="h-16 flex items-center justify-between px-8 bg-white border-b border-[#cfd8e6] sticky top-0 z-10"
      style={{ boxShadow: '0 4px 5px rgba(207, 216, 230, 0.3)' }}
      data-testid="top-bar"
    >
      <h1 className="text-xl font-black text-[#032b71]" data-testid="top-bar-title">
        {title}
      </h1>
      <div className="flex items-center gap-4">
        <div className="text-right">
          <p className="text-sm text-[#032b71] font-medium" data-testid="top-bar-username">
            {profile?.username || user?.email}
          </p>
          <p className="text-xs text-[#7089b4]">{profile?.role || 'Viewer'}</p>
        </div>
        <Button
          data-testid="logout-button"
          variant="outline"
          size="sm"
          onClick={signOut}
          className="border-[#0f48aa] text-[#0f48aa] hover:bg-[#ebf6ff]"
        >
          <LogOut className="h-4 w-4 mr-1" /> Logout
        </Button>
      </div>
    </header>
  );
}
