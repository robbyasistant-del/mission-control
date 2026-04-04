import { queryOne, queryAll, run } from './index';
import { v4 as uuidv4 } from 'uuid';

export interface WatchdogSettings {
  id: string;
  product_id: string;
  dashboard_url: string | null;
  interval_seconds: number;
  auto_nudge_stuck: boolean;
  notify_new_task: boolean;
  new_task_priority: string;
  notify_status_change: boolean;
  notify_statuses: string | null;
  stop_on_sprint_finish: boolean;
  regression_testing_enabled: boolean;
  regression_trigger: string;
  assigned_agents: string | null; // JSON array of {name, agent_id}
  is_running: boolean;
  next_run_at: string | null;
  last_run_at: string | null;
  last_run_status: string | null;
  last_run_summary: string | null;
  current_task_id: string | null;
  next_task_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface WatchdogLog {
  id: string;
  product_id: string;
  execution_type: string;
  status: 'success' | 'error' | 'warning' | 'info';
  message: string;
  details: string | null;
  task_id: string | null;
  duration_ms: number | null;
  created_at: string;
}

export interface WatchdogSettingsInput {
  dashboard_url?: string;
  interval_seconds?: number;
  auto_nudge_stuck?: boolean;
  notify_new_task?: boolean;
  new_task_priority?: string;
  notify_status_change?: boolean;
  notify_statuses?: string[];
  stop_on_sprint_finish?: boolean;
  regression_testing_enabled?: boolean;
  regression_trigger?: string;
  assigned_agents?: { name: string; agent_id: string }[];
}

const DEFAULT_SETTINGS: Partial<WatchdogSettings> = {
  interval_seconds: 300,
  auto_nudge_stuck: true,
  notify_new_task: true,
  new_task_priority: 'normal',
  notify_status_change: false,
  stop_on_sprint_finish: false,
  regression_testing_enabled: true,
  regression_trigger: 'sprint finish',
  is_running: false,
};

export function getOrCreateWatchdogSettings(productId: string): WatchdogSettings {
  let settings = queryOne<WatchdogSettings>(
    'SELECT * FROM autopilot_watchdog_settings WHERE product_id = ?',
    [productId]
  );

  if (!settings) {
    const now = new Date().toISOString();
    const id = uuidv4();
    
    run(
      `INSERT INTO autopilot_watchdog_settings (
        id, product_id, interval_seconds, auto_nudge_stuck, notify_new_task,
        new_task_priority, notify_status_change, notify_statuses, stop_on_sprint_finish,
        regression_testing_enabled, regression_trigger, assigned_agents, is_running,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        productId,
        DEFAULT_SETTINGS.interval_seconds,
        DEFAULT_SETTINGS.auto_nudge_stuck ? 1 : 0,
        DEFAULT_SETTINGS.notify_new_task ? 1 : 0,
        DEFAULT_SETTINGS.new_task_priority,
        DEFAULT_SETTINGS.notify_status_change ? 1 : 0,
        null,
        DEFAULT_SETTINGS.stop_on_sprint_finish ? 1 : 0,
        DEFAULT_SETTINGS.regression_testing_enabled ? 1 : 0,
        DEFAULT_SETTINGS.regression_trigger,
        null,
        DEFAULT_SETTINGS.is_running ? 1 : 0,
        now,
        now,
      ]
    );

    settings = queryOne<WatchdogSettings>(
      'SELECT * FROM autopilot_watchdog_settings WHERE id = ?',
      [id]
    )!;
  }

  return settings;
}

export function updateWatchdogSettings(
  productId: string,
  updates: WatchdogSettingsInput
): WatchdogSettings | null {
  const settings = getOrCreateWatchdogSettings(productId);
  const now = new Date().toISOString();
  
  const fields: string[] = [];
  const values: (string | number | null)[] = [];

  if (updates.dashboard_url !== undefined) {
    fields.push('dashboard_url = ?');
    values.push(updates.dashboard_url);
  }
  if (updates.interval_seconds !== undefined) {
    fields.push('interval_seconds = ?');
    values.push(updates.interval_seconds);
  }
  if (updates.auto_nudge_stuck !== undefined) {
    fields.push('auto_nudge_stuck = ?');
    values.push(updates.auto_nudge_stuck ? 1 : 0);
  }
  if (updates.notify_new_task !== undefined) {
    fields.push('notify_new_task = ?');
    values.push(updates.notify_new_task ? 1 : 0);
  }
  if (updates.new_task_priority !== undefined) {
    fields.push('new_task_priority = ?');
    values.push(updates.new_task_priority);
  }
  if (updates.notify_status_change !== undefined) {
    fields.push('notify_status_change = ?');
    values.push(updates.notify_status_change ? 1 : 0);
  }
  if (updates.notify_statuses !== undefined) {
    fields.push('notify_statuses = ?');
    values.push(JSON.stringify(updates.notify_statuses));
  }
  if (updates.stop_on_sprint_finish !== undefined) {
    fields.push('stop_on_sprint_finish = ?');
    values.push(updates.stop_on_sprint_finish ? 1 : 0);
  }
  if (updates.regression_testing_enabled !== undefined) {
    fields.push('regression_testing_enabled = ?');
    values.push(updates.regression_testing_enabled ? 1 : 0);
  }
  if (updates.regression_trigger !== undefined) {
    fields.push('regression_trigger = ?');
    values.push(updates.regression_trigger);
  }
  if (updates.assigned_agents !== undefined) {
    fields.push('assigned_agents = ?');
    values.push(JSON.stringify(updates.assigned_agents));
  }

  if (fields.length === 0) return settings;

  fields.push('updated_at = ?');
  values.push(now);
  values.push(productId);

  run(
    `UPDATE autopilot_watchdog_settings SET ${fields.join(', ')} WHERE product_id = ?`,
    values
  );

  return getOrCreateWatchdogSettings(productId);
}

export function toggleWatchdog(productId: string, isRunning: boolean): WatchdogSettings | null {
  const now = new Date().toISOString();
  const nextRunAt = isRunning 
    ? new Date(Date.now() + (getOrCreateWatchdogSettings(productId).interval_seconds * 1000)).toISOString()
    : null;

  run(
    `UPDATE autopilot_watchdog_settings SET is_running = ?, next_run_at = ?, updated_at = ? WHERE product_id = ?`,
    [isRunning ? 1 : 0, nextRunAt, now, productId]
  );

  return getOrCreateWatchdogSettings(productId);
}

export function updateWatchdogRunStatus(
  productId: string,
  status: {
    last_run_status?: string;
    last_run_summary?: string;
    current_task_id?: string | null;
    next_task_id?: string | null;
  }
): void {
  const now = new Date().toISOString();
  const settings = getOrCreateWatchdogSettings(productId);
  
  const nextRunAt = settings.is_running
    ? new Date(Date.now() + (settings.interval_seconds * 1000)).toISOString()
    : null;

  run(
    `UPDATE autopilot_watchdog_settings SET 
      last_run_at = ?,
      last_run_status = ?,
      last_run_summary = ?,
      current_task_id = ?,
      next_task_id = ?,
      next_run_at = ?,
      updated_at = ?
    WHERE product_id = ?`,
    [
      now,
      status.last_run_status ?? null,
      status.last_run_summary ?? null,
      status.current_task_id ?? null,
      status.next_task_id ?? null,
      nextRunAt,
      now,
      productId,
    ]
  );
}

export function addWatchdogLog(
  productId: string,
  log: {
    execution_type: string;
    status: 'success' | 'error' | 'warning' | 'info';
    message: string;
    details?: string;
    task_id?: string;
    duration_ms?: number;
  }
): WatchdogLog {
  const now = new Date().toISOString();
  const id = uuidv4();

  run(
    `INSERT INTO autopilot_watchdog_logs (id, product_id, execution_type, status, message, details, task_id, duration_ms, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      productId,
      log.execution_type,
      log.status,
      log.message,
      log.details ?? null,
      log.task_id ?? null,
      log.duration_ms ?? null,
      now,
    ]
  );

  return {
    id,
    product_id: productId,
    execution_type: log.execution_type,
    status: log.status,
    message: log.message,
    details: log.details ?? null,
    task_id: log.task_id ?? null,
    duration_ms: log.duration_ms ?? null,
    created_at: now,
  };
}

export function listWatchdogLogs(productId: string, limit: number = 50): WatchdogLog[] {
  return queryAll<WatchdogLog>(
    'SELECT * FROM autopilot_watchdog_logs WHERE product_id = ? ORDER BY created_at DESC LIMIT ?',
    [productId, limit]
  );
}

export function clearWatchdogLogs(productId: string): void {
  run('DELETE FROM autopilot_watchdog_logs WHERE product_id = ?', [productId]);
}
