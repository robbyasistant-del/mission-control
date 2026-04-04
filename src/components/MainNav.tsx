'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, FlaskConical, Rocket, Activity } from 'lucide-react';

const navItems = [
  { id: 'home', label: 'Workspaces', href: '/', icon: Home },
  { id: 'laboratory', label: 'Laboratory', href: '/laboratory', icon: FlaskConical },
  { id: 'autopilot', label: 'Autopilot', href: '/autopilot', icon: Rocket },
  { id: 'activity', label: 'Activity', href: '/activity', icon: Activity },
];

export function MainNav() {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  return (
    <header className="border-b border-mc-border bg-mc-bg-secondary sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3">
        <div className="flex items-center justify-between">
          {/* Logo - clickable to home */}
          <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <span className="text-2xl">🦞</span>
            <div className="flex flex-col">
              <h1 className="text-lg font-bold leading-tight">Mission Control</h1>
              <span className="text-[10px] text-mc-text-secondary/60 font-mono tracking-tight">
                v2.1.1
              </span>
            </div>
          </Link>

          {/* Navigation tabs */}
          <nav className="flex items-center gap-1">
            {navItems.map((item) => {
              const active = isActive(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    active
                      ? 'bg-mc-accent/10 text-mc-accent border border-mc-accent/30'
                      : 'text-mc-text-secondary hover:text-mc-text hover:bg-mc-bg-tertiary'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="hidden sm:inline">{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
    </header>
  );
}
