import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  UserRound,
  MapPin,
  Link2,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useAllActorsLite } from '@/hooks/useActors';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const NAV_ITEMS = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, to: '/' },
  {
    key: 'actors',
    label: 'Actors',
    icon: Users,
    children: [
      { label: 'Potential', to: '/actors/potential' },
      { label: 'Actual', to: '/actors/actual' },
    ],
  },
  {
    key: 'beekeepers',
    label: 'Beekeepers',
    icon: UserRound,
    children: [
      { label: 'List', to: '/beekeepers' },
      { label: 'Potential', to: '/beekeepers/potential' },
      { label: 'Actual', to: '/beekeepers/actual' },
    ],
  },
  { key: 'villages', label: 'Villages', icon: MapPin, to: '/villages' },
  { key: 'connections', label: 'Connections', icon: Link2, to: '/connections' },
];

function NavIcon({ Icon, active }) {
  return (
    <span
      className={`flex items-center justify-center h-[34px] w-[34px] shrink-0 rounded-lg ${
        active ? 'bg-[#0f48aa]' : ''
      }`}
    >
      <Icon className={`h-[18px] w-[18px] ${active ? 'text-white' : 'text-[#0f48aa]'}`} />
    </span>
  );
}

function NavGroup({ item, currentPath }) {
  const isChildActive = item.children.some((c) => currentPath.startsWith(c.to));
  const [open, setOpen] = useState(isChildActive);

  return (
    <div>
      <button
        data-testid={`sidebar-nav-${item.key}`}
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-4 py-2 text-[13px] font-normal text-[#032b71] hover:bg-white/60 transition-colors"
      >
        <NavIcon Icon={item.icon} active={isChildActive} />
        <span className={`flex-1 text-left ${isChildActive ? 'text-[#0f48aa] font-bold' : ''}`}>{item.label}</span>
        {open ? <ChevronDown className="h-4 w-4 text-[#7089b4]" /> : <ChevronRight className="h-4 w-4 text-[#7089b4]" />}
      </button>
      {open && (
        <div className="ml-[60px] mt-0.5 flex flex-col gap-0.5 pb-2">
          {item.children.map((child) => (
            <NavLink
              key={child.to}
              to={child.to}
              data-testid={`sidebar-nav-${item.key}-${child.label.toLowerCase()}`}
              className={({ isActive }) =>
                `px-3 py-1.5 rounded-[4px] text-[13px] transition-colors ${
                  isActive ? 'text-[#0f48aa] font-bold' : 'text-[#032b71] font-normal hover:bg-white/60'
                }`
              }
            >
              {child.label}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Sidebar() {
  const { profile, switchActor } = useAuth();
  const { data: actors = [] } = useAllActorsLite();
  const currentActor = actors.find((a) => a.id === profile?.current_actor_id);

  return (
    <aside
      className="w-[210px] h-screen fixed left-0 top-0 flex flex-col bg-[#f0f6ff] border-r border-[#e2eaf5]"
      data-testid="sidebar"
    >
      {/* Logo area */}
      <div className="h-16 flex items-center px-4 gap-2 shrink-0">
        <div className="h-7 w-7 rounded-full bg-[#c8a200] flex items-center justify-center">
          <span className="text-white text-xs font-black">K</span>
        </div>
        <span className="text-[11px] font-black text-[#032b71] tracking-wider uppercase">Koster <span className="text-[11px]">Keunen</span></span>
      </div>

      <nav className="flex-1 overflow-y-auto pt-2 flex flex-col gap-0.5">
        {NAV_ITEMS.map((item) =>
          item.children ? (
            <NavGroup key={item.key} item={item} currentPath={window.location.pathname} />
          ) : (
            <NavLink
              key={item.key}
              to={item.to}
              end
              data-testid={`sidebar-nav-${item.key}`}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-2 text-[13px] transition-colors ${
                  isActive ? 'text-[#0f48aa] font-bold' : 'text-[#032b71] font-normal hover:bg-white/60'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <NavIcon Icon={item.icon} active={isActive} />
                  <span>{item.label}</span>
                </>
              )}
            </NavLink>
          )
        )}
      </nav>

      <div className="p-3 border-t border-[#e2eaf5]">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              data-testid="my-actor-switcher"
              className="w-full flex items-center gap-3 px-3 py-2 rounded-[4px] bg-white border border-[#cfd8e6] hover:bg-[#f5f5f5] transition-colors"
            >
              <div className="h-8 w-8 rounded-full bg-[#0f48aa] flex items-center justify-center text-white text-xs font-bold overflow-hidden">
                {currentActor?.logo_url ? (
                  <img src={currentActor.logo_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  (currentActor?.contact_name || 'A')[0]
                )}
              </div>
              <div className="flex-1 text-left overflow-hidden">
                <p className="text-xs text-[#7089b4]">My Actor</p>
                <p className="text-sm text-[#032b71] font-medium truncate">
                  {currentActor?.contact_name || 'Select actor'}
                </p>
              </div>
              <ChevronDown className="h-4 w-4 text-[#7089b4]" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            {actors.map((a) => (
              <DropdownMenuItem
                key={a.id}
                data-testid={`my-actor-option-${a.id}`}
                onClick={() => switchActor(a.id)}
              >
                {a.contact_name} — {a.traceability_code}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  );
}
