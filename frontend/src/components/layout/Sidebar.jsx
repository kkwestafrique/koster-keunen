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
      className={`flex items-center justify-center h-7 w-7 rounded-md ${
        active ? 'bg-[#0f48aa]' : ''
      }`}
    >
      <Icon className={`h-4 w-4 ${active ? 'text-white' : 'text-[#032b71]'}`} />
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
        className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-[#032b71] hover:bg-white/60 transition-colors"
      >
        <NavIcon Icon={item.icon} active={isChildActive} />
        <span className="flex-1 text-left">{item.label}</span>
        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
      </button>
      {open && (
        <div className="ml-10 mt-1 flex flex-col gap-1">
          {item.children.map((child) => (
            <NavLink
              key={child.to}
              to={child.to}
              data-testid={`sidebar-nav-${item.key}-${child.label.toLowerCase()}`}
              className={({ isActive }) =>
                `px-3 py-1.5 rounded-md text-sm transition-colors ${
                  isActive ? 'text-[#0f48aa] font-semibold' : 'text-[#032b71] hover:bg-white/60'
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
      className="w-64 h-screen fixed left-0 top-0 flex flex-col bg-[#ebf6ff] border-r border-[#cfd8e6]"
      data-testid="sidebar"
    >
      <div className="px-5 py-6 flex items-center gap-2">
        <div className="h-9 w-9 rounded-md bg-[#0f48aa] flex items-center justify-center text-white font-black">
          B
        </div>
        <span className="font-black text-lg text-[#032b71]">BeezTrace</span>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 flex flex-col gap-1">
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
                `flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive ? 'text-[#0f48aa] font-semibold' : 'text-[#032b71] hover:bg-white/60'
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

      <div className="p-3 border-t border-[#cfd8e6]">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              data-testid="my-actor-switcher"
              className="w-full flex items-center gap-3 px-3 py-2 rounded-md bg-white border border-[#cfd8e6] hover:bg-[#f5f5f5] transition-colors"
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
