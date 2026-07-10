import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  LayoutDashboard,
  FileText,
  Link2,
  CreditCard,
  Copy,
  AlignJustify,
  FileSpreadsheet,
  PieChart,
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
  { key: 'dashboard', labelKey: 'nav.dashboard', icon: LayoutDashboard, to: '/' },
  { key: 'actorProfile', labelKey: 'nav.actorProfile', icon: FileText, to: '/company-profile' },
  {
    key: 'commercialPartners',
    labelKey: 'nav.commercialPartners',
    icon: Link2,
    children: [
      { labelKey: 'nav.actors', to: '/actors/actual' },
      { labelKey: 'nav.beekeepers', to: '/beekeepers' },
    ],
  },
  { key: 'contracts', labelKey: 'nav.contracts', icon: CreditCard, to: '/contracts' },
  {
    key: 'transactions',
    labelKey: 'nav.transactions',
    icon: Copy,
    children: [
      { labelKey: 'nav.received', to: '/transactions/received' },
      { labelKey: 'nav.processing', to: '/transactions/processing' },
      { labelKey: 'nav.send', to: '/transactions/send' },
    ],
  },
  {
    key: 'stocks',
    labelKey: 'nav.stocks',
    icon: AlignJustify,
    children: [
      { labelKey: 'nav.rawMaterial', to: '/stocks/raw-material' },
      { labelKey: 'nav.finalProduct', to: '/stocks/final-product' },
      { labelKey: 'nav.loss', to: '/stocks/loss' },
    ],
  },
  { key: 'bulkUploads', labelKey: 'nav.bulkUploads', icon: FileSpreadsheet, to: '/bulk-uploads' },
  { key: 'report', labelKey: 'nav.report', icon: PieChart, to: '/report' },
];

function NavIcon({ Icon, active }) {
  return <Icon className={`h-[18px] w-[18px] shrink-0 ${active ? 'text-white' : 'text-[#0f48aa]'}`} />;
}

function NavGroup({ item, currentPath, t }) {
  const isChildActive = item.children.some((c) => currentPath.startsWith(c.to));
  const [open, setOpen] = useState(isChildActive);

  return (
    <div className="px-3">
      <button
        data-testid={`sidebar-nav-${item.key}`}
        onClick={() => setOpen(!open)}
        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-full text-[14px] transition-colors ${
          isChildActive ? 'bg-[#0f48aa] text-white font-bold' : 'text-[#032b71] font-normal hover:bg-white/60'
        }`}
      >
        <NavIcon Icon={item.icon} active={isChildActive} />
        <span className="flex-1 text-left">{t(item.labelKey)}</span>
        {open ? (
          <ChevronDown className={`h-4 w-4 ${isChildActive ? 'text-white' : 'text-[#7089b4]'}`} />
        ) : (
          <ChevronRight className={`h-4 w-4 ${isChildActive ? 'text-white' : 'text-[#7089b4]'}`} />
        )}
      </button>
      {open && (
        <div className="ml-8 mt-1 flex flex-col gap-0.5 pb-1">
          {item.children.map((child) => (
            <NavLink
              key={child.to}
              to={child.to}
              data-testid={`sidebar-nav-${item.key}-${child.labelKey}`}
              className={({ isActive }) =>
                `px-3 py-1.5 rounded-[4px] text-[13px] transition-colors ${
                  isActive ? 'text-[#0f48aa] font-bold' : 'text-[#032b71] font-normal hover:bg-white/60'
                }`
              }
            >
              {t(child.labelKey)}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Sidebar() {
  const { t } = useTranslation();
  const { profile, switchActor } = useAuth();
  const { data: actors = [] } = useAllActorsLite();
  const currentActor = actors.find((a) => a.id === profile?.current_actor_id);

  return (
    <aside
      className="w-[240px] h-screen fixed left-0 top-0 flex flex-col bg-[#f0f6ff]"
      data-testid="sidebar"
    >
      {/* Logo area */}
      <div className="h-16 flex items-center px-5 shrink-0 bg-white">
        <span className="text-lg font-black text-[#0f48aa]">Koster Keunen</span>
      </div>

      <nav className="flex-1 overflow-y-auto pt-3 flex flex-col gap-1">
        {NAV_ITEMS.map((item) =>
          item.children ? (
            <NavGroup key={item.key} item={item} currentPath={window.location.pathname} t={t} />
          ) : (
            <div className="px-3" key={item.key}>
              <NavLink
                to={item.to}
                end
                data-testid={`sidebar-nav-${item.key}`}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-full text-[14px] transition-colors ${
                    isActive ? 'bg-[#0f48aa] text-white font-bold' : 'text-[#032b71] font-normal hover:bg-white/60'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <NavIcon Icon={item.icon} active={isActive} />
                    <span>{t(item.labelKey)}</span>
                  </>
                )}
              </NavLink>
            </div>
          )
        )}
      </nav>

      <div className="p-3">
        <p className="text-xs text-[#7089b4] px-1 mb-1.5">{t('topbar.myActor')}</p>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              data-testid="my-actor-switcher"
              className="w-full flex items-center gap-3 px-3 py-2 rounded-[4px] bg-white border border-[#cfd8e6] hover:bg-[#f5f5f5] transition-colors"
            >
              <div className="h-8 w-8 rounded-full bg-[#0f48aa] flex items-center justify-center text-white text-xs font-bold overflow-hidden shrink-0">
                {currentActor?.logo_url ? (
                  <img src={currentActor.logo_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  (currentActor?.contact_name || 'A')[0]
                )}
              </div>
              <div className="flex-1 text-left overflow-hidden">
                <p className="text-sm text-[#032b71] font-medium truncate">
                  {currentActor?.contact_name || t('topbar.selectActor')}
                </p>
              </div>
              <ChevronDown className="h-4 w-4 text-[#7089b4] shrink-0" />
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
