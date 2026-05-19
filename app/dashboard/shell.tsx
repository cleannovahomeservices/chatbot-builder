'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  match?: (pathname: string) => boolean;
}

const IconBot = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="7" width="18" height="13" rx="3" /><path d="M12 7V3" /><circle cx="12" cy="3" r="1" /><path d="M8 13h.01M16 13h.01M9 17h6" />
  </svg>
);
const IconTool = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
  </svg>
);
const IconMap = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s-8-7.5-8-13a8 8 0 0 1 16 0c0 5.5-8 13-8 13z" /><circle cx="12" cy="9" r="3" />
  </svg>
);
const IconSettings = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);
const IconMenu = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 6h18M3 12h18M3 18h18" />
  </svg>
);
const IconX = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
);

const NAV: Array<{ section: string; items: NavItem[] }> = [
  {
    section: 'Principal',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: <IconBot />, match: p => p === '/dashboard' },
    ],
  },
  {
    section: 'Herramientas',
    items: [
      { href: '/dashboard/tools/extractor', label: 'Extractor de negocios', icon: <IconMap /> },
    ],
  },
  {
    section: 'Cuenta',
    items: [
      { href: '/dashboard/settings', label: 'Ajustes', icon: <IconSettings /> },
    ],
  },
];

interface Props {
  githubUsername: string | null;
  githubAvatar: string | null;
  googleName: string | null;
  googleAvatar: string | null;
  email: string | null;
  hasGithub: boolean;
  children: React.ReactNode;
}

export function DashboardShell({
  githubUsername, githubAvatar, googleName, googleAvatar, email, hasGithub, children,
}: Props) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const displayName = githubUsername ?? googleName ?? email?.split('@')[0] ?? '';
  const avatar = githubAvatar ?? googleAvatar;

  function isActive(item: NavItem) {
    if (item.match) return item.match(pathname);
    return pathname === item.href || pathname.startsWith(item.href + '/');
  }

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="px-5 py-5 border-b border-white/5 flex items-center gap-2.5">
        <Image src="/logo.png" alt="BotLuma" width={28} height={28} className="rounded-lg" />
        <span className="font-semibold text-white/90">BotLuma</span>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {NAV.map(group => (
          <div key={group.section} className="mb-5">
            <p className="px-3 mb-1.5 text-[10px] uppercase tracking-wider text-white/30 font-semibold">{group.section}</p>
            {group.items.map(item => {
              const active = isActive(item);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition mb-0.5 ${
                    active
                      ? 'bg-white/10 text-white font-medium'
                      : 'text-white/55 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="border-t border-white/5 p-3">
        {hasGithub ? (
          <p className="px-2 mb-2 text-[10px] flex items-center gap-1.5 text-emerald-400/70">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
            {githubUsername ? `@${githubUsername}` : 'GitHub conectado'}
          </p>
        ) : (
          <a
            href="/api/auth/github?next=/dashboard"
            className="block px-2 mb-2 text-[10px] text-violet-400 hover:text-violet-300"
          >
            Conectar GitHub →
          </a>
        )}
        <div className="flex items-center gap-2.5 px-2 py-2">
          {avatar && (
            <img src={avatar} alt={displayName} className="h-7 w-7 rounded-full border border-white/10" />
          )}
          <span className="text-xs text-white/60 truncate flex-1">{displayName}</span>
        </div>
        <form action="/api/auth/logout" method="POST">
          <button className="w-full text-left text-xs text-white/40 hover:text-white/80 transition px-2 py-1.5 rounded-lg hover:bg-white/5">
            Cerrar sesión
          </button>
        </form>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white flex">
      <aside className="hidden lg:flex w-64 shrink-0 border-r border-white/5 bg-[#0c0c0c]">
        {sidebar}
      </aside>

      <header className="lg:hidden fixed top-0 inset-x-0 z-30 h-14 border-b border-white/5 bg-[#0A0A0A]/90 backdrop-blur flex items-center px-4 justify-between">
        <div className="flex items-center gap-2.5">
          <Image src="/logo.png" alt="BotLuma" width={26} height={26} className="rounded-lg" />
          <span className="font-semibold text-white/90 text-sm">BotLuma</span>
        </div>
        <button
          onClick={() => setMobileOpen(true)}
          className="p-2 -mr-2 text-white/70 hover:text-white"
        >
          <IconMenu />
        </button>
      </header>

      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/60"
          onClick={() => setMobileOpen(false)}
        >
          <aside
            className="absolute left-0 top-0 bottom-0 w-72 bg-[#0c0c0c] border-r border-white/5"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute top-4 right-4 p-1 text-white/60 hover:text-white"
            >
              <IconX />
            </button>
            {sidebar}
          </aside>
        </div>
      )}

      <main className="flex-1 min-w-0 pt-14 lg:pt-0">
        {children}
      </main>
    </div>
  );
}
