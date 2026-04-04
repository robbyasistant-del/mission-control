import { getDb } from '@/lib/db';
import { addWatchdogLog, getOrCreateWatchdogSettings, updateWatchdogSettings } from '@/lib/db/autopilot-watchdog';
import { executeWatchdogCycle as executeFullWatchdogCycle } from '@/lib/watchdog-executor';

interface WatchdogInstance {
  intervalId: ReturnType<typeof setInterval>;
  nextRunAt: Date;
  isRunning: boolean;
}

// Map to store active watchdog intervals per product
const activeWatchdogs = new Map<string, WatchdogInstance>();

// Calculate next run time based on interval
function calculateNextRun(intervalSeconds: number): Date {
  return new Date(Date.now() + intervalSeconds * 1000);
}

// Run a single watchdog cycle using the full executor
async function runWatchdogCycle(productId: string) {
  const settings = getOrCreateWatchdogSettings(productId);
  
  if (!settings.is_running) {
    console.log(`[Watchdog ${productId}] Skipping cycle - watchdog is stopped`);
    return;
  }

  // Execute full watchdog logic
  const result = await executeFullWatchdogCycle(productId);

  // Log the result
  addWatchdogLog(productId, {
    execution_type: 'cycle',
    status: result.success ? 'success' : 'error',
    message: result.message,
    details: result.details,
  });

  // Update last run info
  updateWatchdogSettings(productId, {
    last_run_at: new Date().toISOString(),
    last_run_status: result.success ? 'success' : 'error',
    last_run_summary: result.message,
  });

  // Update next run time silently
  const intervalSeconds = settings.interval_seconds || 300;
  const nextRunAt = calculateNextRun(intervalSeconds);
  
  updateWatchdogSettings(productId, {
    next_run_at: nextRunAt.toISOString(),
  });

  // Update in-memory map so SSE returns correct countdown
  const watchdog = activeWatchdogs.get(productId);
  if (watchdog) {
    watchdog.nextRunAt = nextRunAt;
  }
}

// Start watchdog for a product
export function startWatchdog(productId: string, intervalSeconds?: number): boolean {
  // Stop existing if any
  stopWatchdog(productId);

  const settings = getOrCreateWatchdogSettings(productId);
  const interval = intervalSeconds || settings.interval_seconds || 300;

  // Calculate next run time
  const nextRunAt = calculateNextRun(interval);
  
  // Update settings
  updateWatchdogSettings(productId, {
    is_running: true,
    interval_seconds: interval,
    next_run_at: nextRunAt.toISOString(),
  });

  // Log start
  addWatchdogLog(productId, {
    execution_type: 'control',
    status: 'info',
    message: 'Watchdog started',
    details: `Interval: ${interval}s`,
  });

  // Set up interval
  const intervalId = setInterval(() => {
    runWatchdogCycle(productId);
  }, interval * 1000);

  // Store reference
  activeWatchdogs.set(productId, {
    intervalId,
    nextRunAt,
    isRunning: true,
  });

  console.log(`[Watchdog] Started for product ${productId} with interval ${interval}s`);
  return true;
}

// Stop watchdog for a product
export function stopWatchdog(productId: string): boolean {
  const watchdog = activeWatchdogs.get(productId);
  
  if (watchdog) {
    clearInterval(watchdog.intervalId);
    activeWatchdogs.delete(productId);
  }

  // Update settings
  updateWatchdogSettings(productId, {
    is_running: false,
    next_run_at: null,
  });

  // Log stop
  addWatchdogLog(productId, {
    execution_type: 'control',
    status: 'info',
    message: 'Watchdog stopped',
  });

  console.log(`[Watchdog] Stopped for product ${productId}`);
  return true;
}

// Restart watchdog with new interval
export function restartWatchdog(productId: string, newIntervalSeconds: number): boolean {
  stopWatchdog(productId);
  return startWatchdog(productId, newIntervalSeconds);
}

// Get watchdog status
export function getWatchdogStatus(productId: string): {
  isRunning: boolean;
  nextRunAt: Date | null;
  intervalSeconds: number;
} {
  const watchdog = activeWatchdogs.get(productId);
  const settings = getOrCreateWatchdogSettings(productId);

  return {
    isRunning: watchdog?.isRunning || false,
    nextRunAt: watchdog?.nextRunAt || (settings.next_run_at ? new Date(settings.next_run_at) : null),
    intervalSeconds: settings.interval_seconds || 300,
  };
}

// Initialize watchdogs on server start (restore running watchdogs)
export function initializeWatchdogs() {
  try {
    const db = getDb();
    const runningSettings = db.prepare(
      'SELECT product_id, interval_seconds FROM autopilot_watchdog_settings WHERE is_running = 1'
    ).all() as { product_id: string; interval_seconds: number }[];

    for (const row of runningSettings) {
      console.log(`[Watchdog] Restoring watchdog for product ${row.product_id}`);
      startWatchdog(row.product_id, row.interval_seconds);
    }

    console.log(`[Watchdog] Initialized ${runningSettings.length} watchdog(s)`);
  } catch (error) {
    console.error('[Watchdog] Failed to initialize watchdogs:', error);
  }
}
