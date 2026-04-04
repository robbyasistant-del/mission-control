import { NextRequest, NextResponse } from 'next/server';
import { toggleWatchdog, addWatchdogLog } from '@/lib/db/autopilot-watchdog';
import { getDb } from '@/lib/db';

function ensureTable() {
  try {
    const db = getDb();
    db.exec(`
      CREATE TABLE IF NOT EXISTS autopilot_watchdog_settings (
        id TEXT PRIMARY KEY,
        product_id TEXT NOT NULL,
        dashboard_url TEXT,
        interval_seconds INTEGER DEFAULT 300,
        auto_nudge_stuck INTEGER DEFAULT 1,
        notify_new_task INTEGER DEFAULT 1,
        new_task_priority TEXT DEFAULT 'normal',
        notify_status_change INTEGER DEFAULT 0,
        notify_statuses TEXT,
        stop_on_sprint_finish INTEGER DEFAULT 0,
        regression_testing_enabled INTEGER DEFAULT 1,
        regression_trigger TEXT DEFAULT 'sprint finish',
        assigned_agents TEXT,
        is_running INTEGER DEFAULT 0,
        next_run_at TEXT,
        last_run_at TEXT,
        last_run_status TEXT,
        last_run_summary TEXT,
        current_task_id TEXT,
        next_task_id TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        UNIQUE(product_id)
      )
    `);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_watchdog_settings_product ON autopilot_watchdog_settings(product_id)`);
  } catch (e) {
    console.error('Failed to ensure watchdog table:', e);
  }
}

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    ensureTable();
    const body = await request.json().catch(() => ({}));
    const isRunning = body.is_running === true;
    
    const settings = toggleWatchdog(params.id, isRunning);
    
    // Log the action
    addWatchdogLog(params.id, {
      execution_type: 'control',
      status: 'info',
      message: isRunning ? 'Watchdog started' : 'Watchdog stopped',
      details: JSON.stringify({ timestamp: new Date().toISOString() }),
    });

    return NextResponse.json({ settings });
  } catch (error) {
    console.error('Failed to toggle watchdog:', error);
    const errorMsg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
