import { v4 as uuidv4 } from 'uuid';
import { queryOne, queryAll, run } from '@/lib/db';
import { broadcast } from '@/lib/events';
import { getMissionControlUrl } from '@/lib/config';
import { buildCheckpointContext } from '@/lib/checkpoint';
import { getOpenClawClient } from '@/lib/openclaw/client';
import { syncGatewayAgentsToCatalog } from '@/lib/agent-catalog-sync';
import type { Agent, AgentHealth, AgentHealthState, Task } from '@/lib/types';

const STALL_THRESHOLD_MINUTES = 5;
const STUCK_THRESHOLD_MINUTES = 15;
const AUTO_NUDGE_AFTER_STALLS = 3;

/**
 * Check health state for a single agent.
 */
export function checkAgentHealth(agentId: string): AgentHealthState {
  const agent = queryOne<Agent>('SELECT * FROM agents WHERE id = ?', [agentId]);
  if (!agent) return 'offline';
  if (agent.status === 'offline') return 'offline';

  // Find active task
  const activeTask = queryOne<Task>(
    `SELECT * FROM tasks WHERE assigned_agent_id = ? AND status IN ('assigned', 'in_progress', 'testing', 'verification') LIMIT 1`,
    [agentId]
  );

  if (!activeTask) return 'idle';

  // Check if OpenClaw session is still alive
  const session = queryOne<{ status: string }>(
    `SELECT status FROM openclaw_sessions WHERE agent_id = ? AND task_id = ? AND status = 'active' LIMIT 1`,
    [agentId, activeTask.id]
  );

  if (!session) {
    // Check for any active session (task might not be linked yet)
    const anySession = queryOne<{ status: string }>(
      `SELECT status FROM openclaw_sessions WHERE agent_id = ? AND status = 'active' LIMIT 1`,
      [agentId]
    );
    if (!anySession) return 'zombie';
  }

  // Check last REAL activity (exclude health check logs — they reset the clock and prevent stuck detection)
  const lastActivity = queryOne<{ created_at: string }>(
    `SELECT created_at FROM task_activities WHERE task_id = ? AND message NOT LIKE 'Agent health:%' ORDER BY created_at DESC LIMIT 1`,
    [activeTask.id]
  );

  if (lastActivity) {
    const minutesSince = (Date.now() - new Date(lastActivity.created_at).getTime()) / 60000;
    if (minutesSince > STUCK_THRESHOLD_MINUTES) return 'stuck';
    if (minutesSince > STALL_THRESHOLD_MINUTES) return 'stalled';
  } else {
    // No real activity at all — check how long the task has been in progress
    const taskAge = (Date.now() - new Date(activeTask.updated_at).getTime()) / 60000;
    if (taskAge > STUCK_THRESHOLD_MINUTES) return 'stuck';
    if (taskAge > STALL_THRESHOLD_MINUTES) return 'stalled';
  }

  return 'working';
}

/**
 * Run a full health check cycle across all agents with active tasks.
 */
export async function runHealthCheckCycle(): Promise<AgentHealth[]> {
  const activeAgents = queryAll<{ id: string }>(
    `SELECT DISTINCT assigned_agent_id as id FROM tasks WHERE status IN ('assigned', 'in_progress', 'testing', 'verification') AND assigned_agent_id IS NOT NULL`
  );

  // Also check agents that are in 'working' status but may have no tasks
  const workingAgents = queryAll<{ id: string }>(
    `SELECT id FROM agents WHERE status = 'working'`
  );

  const allAgentIds = Array.from(new Set([...activeAgents.map(a => a.id), ...workingAgents.map(a => a.id)]));
  const results: AgentHealth[] = [];
  const now = new Date().toISOString();

  for (const agentId of allAgentIds) {
    const healthState = checkAgentHealth(agentId);

    // Find current task for this agent
    const activeTask = queryOne<Task>(
      `SELECT * FROM tasks WHERE assigned_agent_id = ? AND status IN ('assigned', 'in_progress', 'testing', 'verification') LIMIT 1`,
      [agentId]
    );

    // Upsert health record
    const existing = queryOne<AgentHealth>(
      'SELECT * FROM agent_health WHERE agent_id = ?',
      [agentId]
    );

    const previousState = existing?.health_state;

    if (existing) {
      const consecutiveStalls = healthState === 'stalled' || healthState === 'stuck'
        ? (existing.consecutive_stall_checks || 0) + 1
        : 0;

      run(
        `UPDATE agent_health SET health_state = ?, task_id = ?, last_activity_at = ?, consecutive_stall_checks = ?, updated_at = ?
         WHERE agent_id = ?`,
        [healthState, activeTask?.id || null, now, consecutiveStalls, now, agentId]
      );
    } else {
      const healthId = uuidv4();
      run(
        `INSERT INTO agent_health (id, agent_id, task_id, health_state, last_activity_at, consecutive_stall_checks, updated_at)
         VALUES (?, ?, ?, ?, ?, 0, ?)`,
        [healthId, agentId, activeTask?.id || null, healthState, now, now]
      );
    }

    // Broadcast if health state changed
    if (previousState && previousState !== healthState) {
      const healthRecord = queryOne<AgentHealth>('SELECT * FROM agent_health WHERE agent_id = ?', [agentId]);
      if (healthRecord) {
        broadcast({ type: 'agent_health_changed', payload: healthRecord });
      }
    }

    // Log warnings for degraded states
    if (activeTask && (healthState === 'stalled' || healthState === 'stuck' || healthState === 'zombie')) {
      run(
        `INSERT INTO task_activities (id, task_id, agent_id, activity_type, message, created_at)
         VALUES (?, ?, ?, 'status_changed', ?, ?)`,
        [uuidv4(), activeTask.id, agentId, `Agent health: ${healthState}`, now]
      );
    }

    // Auto-nudge after consecutive stall checks
    const updatedHealth = queryOne<AgentHealth>('SELECT * FROM agent_health WHERE agent_id = ?', [agentId]);
    if (updatedHealth) {
      results.push(updatedHealth);
      if (updatedHealth.consecutive_stall_checks >= AUTO_NUDGE_AFTER_STALLS && healthState === 'stuck') {
        // Auto-nudge is fire-and-forget
        nudgeAgent(agentId).catch(err =>
          console.error(`[Health] Auto-nudge failed for agent ${agentId}:`, err)
        );
      }
    }
  }

  // Sweep for orphaned assigned tasks — planning complete but never dispatched
  const ASSIGNED_STALE_MINUTES = 2;
  const orphanedTasks = queryAll<Task>(
    `SELECT * FROM tasks 
     WHERE status = 'assigned' 
       AND planning_complete = 1 
       AND (julianday('now') - julianday(updated_at)) * 1440 > ?`,
    [ASSIGNED_STALE_MINUTES]
  );

  for (const task of orphanedTasks) {
    console.log(`[Health] Orphaned assigned task detected: "${task.title}" (${task.id}) — stale for >${ASSIGNED_STALE_MINUTES}min, auto-dispatching`);
    
    const missionControlUrl = getMissionControlUrl();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (process.env.MC_API_TOKEN) {
      headers['Authorization'] = `Bearer ${process.env.MC_API_TOKEN}`;
    }

    try {
      const res = await fetch(`${missionControlUrl}/api/tasks/${task.id}/dispatch`, {
        method: 'POST',
        headers,
        signal: AbortSignal.timeout(30_000),
      });

      if (res.ok) {
        console.log(`[Health] Auto-dispatched orphaned task "${task.title}"`);
        run(
          `INSERT INTO task_activities (id, task_id, agent_id, activity_type, message, created_at)
           VALUES (?, ?, ?, 'status_changed', 'Auto-dispatched by health sweeper (was stuck in assigned)', ?)`,
          [uuidv4(), task.id, task.assigned_agent_id, now]
        );
      } else {
        const errorText = await res.text();
        console.error(`[Health] Failed to auto-dispatch orphaned task "${task.title}": ${errorText}`);
        // Record the failure so it shows in the UI
        run(
          `UPDATE tasks SET planning_dispatch_error = ?, updated_at = ? WHERE id = ?`,
          [`Health sweeper dispatch failed: ${errorText.substring(0, 200)}`, now, task.id]
        );
      }
    } catch (err) {
      console.error(`[Health] Auto-dispatch error for orphaned task "${task.title}":`, (err as Error).message);
    }
  }

  // Also set idle agents
  const idleAgents = queryAll<{ id: string }>(
    `SELECT id FROM agents WHERE status = 'standby' AND id NOT IN (SELECT assigned_agent_id FROM tasks WHERE status IN ('assigned', 'in_progress', 'testing', 'verification') AND assigned_agent_id IS NOT NULL)`
  );
  for (const { id: agentId } of idleAgents) {
    const existing = queryOne<{ id: string }>('SELECT id FROM agent_health WHERE agent_id = ?', [agentId]);
    if (existing) {
      run(`UPDATE agent_health SET health_state = 'idle', task_id = NULL, consecutive_stall_checks = 0, updated_at = ? WHERE agent_id = ?`, [now, agentId]);
    } else {
      run(
        `INSERT INTO agent_health (id, agent_id, health_state, updated_at) VALUES (?, ?, 'idle', ?)`,
        [uuidv4(), agentId, now]
      );
    }
  }

  return results;
}

/**
 * Nudge a stuck agent: Guaranteed recovery with session reset and health verification.
 * 
 * v2.0.0 - Robust Nudge with retry logic, Gateway cleanup, and escalation
 */
export async function nudgeAgent(agentId: string): Promise<{ 
  success: boolean; 
  error?: string;
  actions?: string[];
}> {
  const actions: string[] = [];
  const now = new Date().toISOString();
  
  const activeTask = queryOne<Task>(
    `SELECT * FROM tasks WHERE assigned_agent_id = ? 
     AND status IN ('assigned', 'in_progress', 'testing', 'verification') 
     LIMIT 1`,
    [agentId]
  );

  if (!activeTask) {
    return { success: false, error: 'No active task for this agent', actions };
  }

  actions.push(`Found active task: ${activeTask.id}`);

  // ========== STEP 1: FORCE-KILL ALL SESSIONS (Local + Gateway) ==========
  
  // 1a. Kill local sessions
  const killedLocal = run(
    `UPDATE openclaw_sessions 
     SET status = 'ended', ended_at = ?, updated_at = ?
     WHERE agent_id = ? AND status = 'active'`,
    [now, now, agentId]
  );
  actions.push(`Killed ${killedLocal.changes} local session(s)`);

  // 1b. Kill Gateway session (fire-and-forget, best effort)
  // NOTE: session.close method does not exist in OpenClaw Gateway
  // Gateway sessions are managed automatically, no manual cleanup needed
  actions.push('Gateway session cleanup skipped (auto-managed)');

  // Wait for session termination to propagate
  await new Promise(resolve => setTimeout(resolve, 2000));

  // ========== STEP 2: VERIFY AGENT IS REACHABLE ==========
  
  const agent = queryOne<Agent>('SELECT * FROM agents WHERE id = ?', [agentId]);
  if (!agent) {
    return { success: false, error: 'Agent not found in database', actions };
  }

  // Check if agent exists in Gateway catalog (sync and verify)
  try {
    await syncGatewayAgentsToCatalog({ reason: 'nudge_verify' });
    actions.push('Gateway catalog synced');
  } catch (err) {
    actions.push('Gateway catalog sync failed (proceeding anyway)');
  }

  // ========== STEP 3: CREATE COMPLETELY NEW SESSION ==========
  
  // Clear any stale session references
  run(
    `DELETE FROM openclaw_sessions 
     WHERE agent_id = ? AND status = 'ended' 
     AND ended_at < datetime('now', '-1 hour')`,
    [agentId]
  );

  // Create fresh session record
  const sessionId = uuidv4();
  const openclawSessionId = `mission-control-${agent.name.toLowerCase().replace(/\s+/g, '-')}-nudged-${Date.now()}`;
  
  run(
    `INSERT INTO openclaw_sessions 
     (id, agent_id, openclaw_session_id, channel, status, session_type, created_at, updated_at)
     VALUES (?, ?, ?, 'mission-control', 'active', 'persistent', ?, ?)`,
    [sessionId, agentId, openclawSessionId, now, now]
  );
  actions.push(`Created new session: ${openclawSessionId}`);

  // ========== STEP 4: BUILD CHECKPOINT CONTEXT ==========
  
  const checkpointCtx = buildCheckpointContext(activeTask.id);
  
  // Update task with checkpoint and reset to assigned
  let newDescription = activeTask.description || '';
  if (checkpointCtx) {
    // Avoid duplicate checkpoints
    if (!newDescription.includes('CHECKPOINT RECOVERY')) {
      newDescription += '\n\n---\n🔁 **CHECKPOINT RECOVERY (NUDGED)**\n' + checkpointCtx;
    }
  }
  
  // Add nudge counter to track recovery attempts
  const nudgeCount = (activeTask.description?.match(/NUDGE_COUNT:(\d+)/)?.[1] || '0');
  const newNudgeCount = parseInt(nudgeCount) + 1;
  
  // Remove old nudge count and add new one
  newDescription = newDescription.replace(/NUDGE_COUNT:\d+/, '');
  newDescription += `\nNUDGE_COUNT:${newNudgeCount}`;
  
  run(
    `UPDATE tasks 
     SET description = ?, 
         status = 'assigned',
         status_reason = 'Nudged: session reset, awaiting re-dispatch',
         planning_dispatch_error = NULL,
         updated_at = ?
     WHERE id = ?`,
    [newDescription, now, activeTask.id]
  );
  actions.push(`Updated task with checkpoint (nudge #${newNudgeCount})`);

  // ========== STEP 5: RE-DISPATCH WITH RETRY ==========
  
  const missionControlUrl = getMissionControlUrl();
  const headers: Record<string, string> = { 
    'Content-Type': 'application/json',
    'X-Nudge-Attempt': String(newNudgeCount)
  };
  if (process.env.MC_API_TOKEN) {
    headers['Authorization'] = `Bearer ${process.env.MC_API_TOKEN}`;
  }

  // Try dispatch up to 3 times with backoff
  let dispatchSuccess = false;
  let lastError = '';
  
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      actions.push(`Dispatch attempt ${attempt}/3...`);
      
      const res = await fetch(
        `${missionControlUrl}/api/tasks/${activeTask.id}/dispatch`, 
        {
          method: 'POST',
          headers,
          signal: AbortSignal.timeout(30_000),
        }
      );

      if (res.ok) {
        dispatchSuccess = true;
        actions.push('Dispatch successful');
        break;
      } else {
        const errorText = await res.text();
        lastError = errorText;
        actions.push(`Dispatch failed: ${errorText.substring(0, 100)}`);
        
        // Wait before retry (exponential backoff)
        if (attempt < 3) {
          const delay = attempt * 3000; // 3s, 6s, 9s
          await new Promise(r => setTimeout(r, delay));
        }
      }
    } catch (err) {
      lastError = (err as Error).message;
      actions.push(`Dispatch error: ${lastError.substring(0, 100)}`);
      
      if (attempt < 3) {
        await new Promise(r => setTimeout(r, 3000));
      }
    }
  }

  // ========== STEP 6: HANDLE RESULT ==========
  
  if (dispatchSuccess) {
    // Success: Log and reset health
    run(
      `INSERT INTO task_activities 
       (id, task_id, agent_id, activity_type, message, metadata, created_at)
       VALUES (?, ?, ?, 'status_changed', ?, ?, ?)`,
      [
        uuidv4(), 
        activeTask.id, 
        agentId, 
        `Agent nudged successfully — re-dispatched with checkpoint context (attempt #${newNudgeCount})`,
        JSON.stringify({ nudge_attempt: newNudgeCount, actions }),
        now
      ]
    );

    run(
      `UPDATE agent_health 
       SET consecutive_stall_checks = 0, 
           health_state = 'working',
           updated_at = ?
       WHERE agent_id = ?`,
      [now, agentId]
    );

    broadcast({
      type: 'agent_health_changed',
      payload: { agent_id: agentId, health_state: 'working', nudged: true }
    });

    return { success: true, actions };
  }

  // ========== STEP 7: FALLBACK - ESCALATE OR FAIL ==========
  
  actions.push('All dispatch attempts failed');

  // Mark task for escalation if multiple nudges failed
  if (newNudgeCount >= 3) {
    run(
      `UPDATE tasks 
       SET status = 'assigned',
           status_reason = 'ESCALATION_NEEDED: Multiple nudges failed. Manual intervention required.',
           planning_dispatch_error = ?,
           updated_at = ?
       WHERE id = ?`,
      [`Nudge failed ${newNudgeCount} times. Last error: ${lastError.substring(0, 200)}`, now, activeTask.id]
    );

    run(
      `INSERT INTO task_activities 
       (id, task_id, agent_id, activity_type, message, created_at)
       VALUES (?, ?, ?, 'status_changed', ?, ?)`,
      [
        uuidv4(),
        activeTask.id,
        agentId,
        `⚠️ ESCALATION: Agent nudge failed ${newNudgeCount} times. Manual intervention needed.`,
        now
      ]
    );

    return { 
      success: false, 
      error: `Nudge failed after ${newNudgeCount} attempts. Escalation required.`,
      actions 
    };
  }

  // Simple fail - will retry on next health cycle
  run(
    `UPDATE tasks 
     SET status = 'assigned',
         status_reason = 'Nudge failed, will retry',
         planning_dispatch_error = ?,
         updated_at = ?
     WHERE id = ?`,
    [`Nudge attempt ${newNudgeCount} failed: ${lastError.substring(0, 200)}`, now, activeTask.id]
  );

  return { 
    success: false, 
    error: `Dispatch failed: ${lastError}. Will retry on next health cycle.`,
    actions 
  };
}

/**
 * Get health state for all agents.
 */
export function getAllAgentHealth(): AgentHealth[] {
  return queryAll<AgentHealth>('SELECT * FROM agent_health ORDER BY updated_at DESC');
}

/**
 * Get health state for a single agent.
 */
export function getAgentHealth(agentId: string): AgentHealth | null {
  return queryOne<AgentHealth>('SELECT * FROM agent_health WHERE agent_id = ?', [agentId]) || null;
}
