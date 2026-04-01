/**
 * Version Badge Component
 * Muestra la versión actual de Mission Control en todas las páginas
 * 
 * Format: v{MAJOR}.{MINOR}.{PATCH}-{BUILD}
 * - MAJOR: Cambios grandes de arquitectura
 * - MINOR: Nuevas funcionalidades
 * - PATCH: Bug fixes y mejoras
 * - BUILD: Timestamp o hash corto
 */

export const MC_VERSION = 'v2.1.0-20250401';
export const MC_VERSION_NAME = 'Robust Nudge';

export function VersionBadge() {
  return (
    <span className="text-[10px] text-mc-text-secondary/50 font-mono tracking-tight">
      {MC_VERSION}
    </span>
  );
}

export function VersionWithTooltip() {
  return (
    <div className="group relative inline-flex items-center">
      <VersionBadge />
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 
                      bg-mc-bg-tertiary border border-mc-border rounded text-xs 
                      text-mc-text-secondary whitespace-nowrap opacity-0 
                      group-hover:opacity-100 transition-opacity pointer-events-none z-50">
        Mission Control {MC_VERSION} — {MC_VERSION_NAME}
        <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 
                        border-4 border-transparent border-t-mc-border" />
      </div>
    </div>
  );
}
