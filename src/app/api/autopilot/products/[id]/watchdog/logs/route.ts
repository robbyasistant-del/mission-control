import { NextRequest, NextResponse } from 'next/server';
import { listWatchdogLogs, clearWatchdogLogs } from '@/lib/db/autopilot-watchdog';
import { getDb } from '@/lib/db';

function ensureTable() {
  try {
    const db = getDb();
    db.exec(`
      CREATE TABLE IF NOT EXISTS autopilot_watchdog_logs (
        id TEXT PRIMARY KEY,
        product_id TEXT NOT NULL,
        execution_type TEXT NOT NULL,
        status TEXT NOT NULL,
        message TEXT NOT NULL,
        details TEXT,
        task_id TEXT,
        duration_ms INTEGER,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_watchdog_logs_product ON autopilot_watchdog_logs(product_id, created_at DESC)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_watchdog_logs_status ON autopilot_watchdog_logs(status)`);
  } catch (e) {
    console.error('Failed to ensure watchdog logs table:', e);
  }
}

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    ensureTable();
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    
    const logs = listWatchdogLogs(params.id, limit);
    return NextResponse.json({ logs });
  } catch (error) {
    console.error('Failed to get watchdog logs:', error);
    const errorMsg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    ensureTable();
    clearWatchdogLogs(params.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to clear watchdog logs:', error);
    const errorMsg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
