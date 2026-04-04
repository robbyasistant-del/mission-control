import { NextRequest, NextResponse } from 'next/server';
import { getOrCreateWatchdogSettings, updateWatchdogSettings } from '@/lib/db/autopilot-watchdog';
import { restartWatchdog, getWatchdogStatus } from '@/lib/watchdog-engine';
import { getDb } from '@/lib/db';

function recreateTableWithoutFK(db: any) {
  try {
    // Check if table exists with foreign key constraint
    const tableInfo = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='autopilot_watchdog_settings'").get();
    
    if (tableInfo && tableInfo.sql.includes('REFERENCES')) {
      // Table has FK constraint, need to recreate
      db.pragma('foreign_keys = OFF');
      
      // Backup existing data
      const existingData = db.prepare('SELECT * FROM autopilot_watchdog_settings').all();
      
      // Drop and recreate without FK
      db.exec('DROP TABLE autopilot_watchdog_settings');
      
      db.exec(`
        CREATE TABLE autopilot_watchdog_settings (
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
          additional_prompt_task_creation TEXT,
          include_basic_info INTEGER DEFAULT 1,
          include_product_program INTEGER DEFAULT 1,
          include_executive_summary INTEGER DEFAULT 1,
          include_technical_architecture INTEGER DEFAULT 1,
          include_implementation_roadmap INTEGER DEFAULT 1,
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
      
      // Restore data
      if (existingData.length > 0) {
        const insert = db.prepare(`INSERT INTO autopilot_watchdog_settings (
          id, product_id, dashboard_url, interval_seconds, auto_nudge_stuck, notify_new_task,
          new_task_priority, notify_status_change, notify_statuses, stop_on_sprint_finish,
          regression_testing_enabled, regression_trigger, assigned_agents,
          additional_prompt_task_creation, include_basic_info, include_product_program,
          include_executive_summary, include_technical_architecture, include_implementation_roadmap,
          is_running, next_run_at, last_run_at, last_run_status, last_run_summary,
          current_task_id, next_task_id, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
        
        for (const row of existingData) {
          insert.run(
            row.id, row.product_id, row.dashboard_url, row.interval_seconds,
            row.auto_nudge_stuck, row.notify_new_task, row.new_task_priority,
            row.notify_status_change, row.notify_statuses, row.stop_on_sprint_finish,
            row.regression_testing_enabled, row.regression_trigger, row.assigned_agents,
            row.additional_prompt_task_creation || null, row.include_basic_info ?? 1,
            row.include_product_program ?? 1, row.include_executive_summary ?? 1,
            row.include_technical_architecture ?? 1, row.include_implementation_roadmap ?? 1,
            row.is_running, row.next_run_at, row.last_run_at, row.last_run_status,
            row.last_run_summary, row.current_task_id, row.next_task_id,
            row.created_at, row.updated_at
          );
        }
      }
      
      db.pragma('foreign_keys = ON');
    } else if (!tableInfo) {
      // Table doesn't exist, create it
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
          additional_prompt_task_creation TEXT,
          include_basic_info INTEGER DEFAULT 1,
          include_product_program INTEGER DEFAULT 1,
          include_executive_summary INTEGER DEFAULT 1,
          include_technical_architecture INTEGER DEFAULT 1,
          include_implementation_roadmap INTEGER DEFAULT 1,
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
    }
    
    db.exec(`CREATE INDEX IF NOT EXISTS idx_watchdog_settings_product ON autopilot_watchdog_settings(product_id)`);
  } catch (e) {
    console.error('Failed to ensure watchdog table:', e);
  }
}

function ensureTable() {
  try {
    const db = getDb();
    recreateTableWithoutFK(db);
  } catch (e) {
    console.error('Failed to ensure watchdog table:', e);
  }
}

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    ensureTable();
    const settings = getOrCreateWatchdogSettings(params.id);
    return NextResponse.json({ settings });
  } catch (error) {
    console.error('Failed to get watchdog settings:', error);
    const errorMsg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    ensureTable();
    const body = await request.json().catch(() => ({}));
    
    // Check if interval changed and watchdog is running
    const currentStatus = getWatchdogStatus(params.id);
    const newInterval = body.interval_seconds;
    const intervalChanged = newInterval !== undefined && newInterval !== currentStatus.intervalSeconds;
    
    const settings = updateWatchdogSettings(params.id, {
      dashboard_url: body.dashboard_url,
      interval_seconds: body.interval_seconds,
      auto_nudge_stuck: body.auto_nudge_stuck,
      notify_new_task: body.notify_new_task,
      new_task_priority: body.new_task_priority,
      notify_status_change: body.notify_status_change,
      notify_statuses: body.notify_statuses,
      stop_on_sprint_finish: body.stop_on_sprint_finish,
      regression_testing_enabled: body.regression_testing_enabled,
      regression_trigger: body.regression_trigger,
      assigned_agents: body.assigned_agents,
      additional_prompt_task_creation: body.additional_prompt_task_creation,
      include_basic_info: body.include_basic_info,
      include_product_program: body.include_product_program,
      include_executive_summary: body.include_executive_summary,
      include_technical_architecture: body.include_technical_architecture,
      include_implementation_roadmap: body.include_implementation_roadmap,
    });

    // Restart watchdog if interval changed and it was running
    if (intervalChanged && currentStatus.isRunning && newInterval) {
      console.log(`[Watchdog] Interval changed to ${newInterval}s, restarting...`);
      restartWatchdog(params.id, newInterval);
    }

    return NextResponse.json({ settings });
  } catch (error) {
    console.error('Failed to update watchdog settings:', error);
    const errorMsg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
