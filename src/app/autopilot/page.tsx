import { Rocket } from 'lucide-react';
import Link from 'next/link';

export default function AutopilotHomePage() {
  return (
    <div className="min-h-screen bg-mc-bg">
      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="flex items-center gap-3 mb-4">
          <Rocket className="w-7 h-7 text-mc-accent-cyan" />
          <h1 className="text-2xl font-bold text-mc-text">Autopilot</h1>
        </div>

        <p className="text-mc-text-secondary mb-8">
          Nuevo módulo en construcción. Aquí irá la funcionalidad de Autopilot.
        </p>

        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="min-h-11 px-4 rounded-lg border border-mc-border bg-mc-bg-tertiary text-mc-text-secondary hover:text-mc-text"
          >
            Volver al dashboard
          </Link>
          <Link
            href="/laboratory"
            className="min-h-11 px-4 rounded-lg border border-mc-border bg-mc-bg text-mc-text-secondary hover:text-mc-text"
          >
            Ir a Laboratory
          </Link>
        </div>
      </div>
    </div>
  );
}
