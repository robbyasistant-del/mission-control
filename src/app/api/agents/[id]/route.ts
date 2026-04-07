import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { queryOne, run } from '@/lib/db';
import type { Agent, UpdateAgentRequest } from '@/lib/types';

export const dynamic = 'force-dynamic';
// GET /api/agents/[id] - Get a single agent
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const agent = queryOne<Agent>('SELECT * FROM agents WHERE id = ?', [id]);

    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    return NextResponse.json(agent);
  } catch (error) {
    console.error('Failed to fetch agent:', error);
    return NextResponse.json({ error: 'Failed to fetch agent' }, { status: 500 });
  }
}

// PATCH /api/agents/[id] - Update an agent
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body: UpdateAgentRequest = await request.json();

    const existing = queryOne<Agent>('SELECT * FROM agents WHERE id = ?', [id]);
    if (!existing) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    const updates: string[] = [];
    const values: unknown[] = [];

    if (body.name !== undefined) {
      updates.push('name = ?');
      values.push(body.name);
    }
    if (body.role !== undefined) {
      updates.push('role = ?');
      values.push(body.role);
    }
    if (body.description !== undefined) {
      updates.push('description = ?');
      values.push(body.description);
    }
    if (body.avatar_emoji !== undefined) {
      updates.push('avatar_emoji = ?');
      values.push(body.avatar_emoji);
    }
    if (body.status !== undefined) {
      updates.push('status = ?');
      values.push(body.status);

      // Log status change event
      const now = new Date().toISOString();
      run(
        `INSERT INTO events (id, type, agent_id, message, created_at)
         VALUES (?, ?, ?, ?, ?)`,
        [uuidv4(), 'agent_status_changed', id, `${existing.name} is now ${body.status}`, now]
      );
    }
    if (body.is_master !== undefined) {
      updates.push('is_master = ?');
      values.push(body.is_master ? 1 : 0);
    }
    if (body.soul_md !== undefined) {
      updates.push('soul_md = ?');
      values.push(body.soul_md);
    }
    if (body.user_md !== undefined) {
      updates.push('user_md = ?');
      values.push(body.user_md);
    }
    if (body.agents_md !== undefined) {
      updates.push('agents_md = ?');
      values.push(body.agents_md);
    }
    if (body.model !== undefined) {
      updates.push('model = ?');
      values.push(body.model);
    }
    if (body.session_key_prefix !== undefined) {
      updates.push('session_key_prefix = ?');
      const trimmed = body.session_key_prefix?.trim();
      values.push(!trimmed ? null : trimmed.endsWith(':') ? trimmed : trimmed + ':');
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No updates provided' }, { status: 400 });
    }

    updates.push('updated_at = ?');
    values.push(new Date().toISOString());
    values.push(id);

    run(`UPDATE agents SET ${updates.join(', ')} WHERE id = ?`, values);

    const agent = queryOne<Agent>('SELECT * FROM agents WHERE id = ?', [id]);
    return NextResponse.json(agent);
  } catch (error) {
    console.error('Failed to update agent:', error);
    return NextResponse.json({ error: 'Failed to update agent' }, { status: 500 });
  }
}

// DELETE /api/agents/[id] - Delete an agent
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const existing = queryOne<Agent>('SELECT * FROM agents WHERE id = ?', [id]);

    if (!existing) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    // Delete or nullify related records first (foreign key constraints)
    // Wrap each in try-catch so one failure doesn't stop the others
    const errors: string[] = [];
    
    // Sessions and health
    try { run('DELETE FROM openclaw_sessions WHERE agent_id = ?', [id]); } catch (e) { errors.push(`openclaw_sessions: ${(e as Error).message}`); }
    try { run('DELETE FROM agent_health WHERE agent_id = ?', [id]); } catch (e) { errors.push(`agent_health: ${(e as Error).message}`); }
    
    // Mailbox (both from and to)
    try { run('DELETE FROM agent_mailbox WHERE from_agent_id = ? OR to_agent_id = ?', [id, id]); } catch (e) { errors.push(`agent_mailbox: ${(e as Error).message}`); }
    
    // Events and messages
    try { run('DELETE FROM events WHERE agent_id = ?', [id]); } catch (e) { errors.push(`events: ${(e as Error).message}`); }
    try { run('DELETE FROM messages WHERE sender_agent_id = ?', [id]); } catch (e) { errors.push(`messages: ${(e as Error).message}`); }
    try { run('DELETE FROM conversation_participants WHERE agent_id = ?', [id]); } catch (e) { errors.push(`conversation_participants: ${(e as Error).message}`); }
    
    // Task-related tables
    try { run('DELETE FROM task_roles WHERE agent_id = ?', [id]); } catch (e) { errors.push(`task_roles: ${(e as Error).message}`); }
    try { run('UPDATE tasks SET assigned_agent_id = NULL WHERE assigned_agent_id = ?', [id]); } catch (e) { errors.push(`tasks.assigned: ${(e as Error).message}`); }
    try { run('UPDATE tasks SET created_by_agent_id = NULL WHERE created_by_agent_id = ?', [id]); } catch (e) { errors.push(`tasks.created: ${(e as Error).message}`); }
    try { run('UPDATE task_activities SET agent_id = NULL WHERE agent_id = ?', [id]); } catch (e) { errors.push(`task_activities: ${(e as Error).message}`); }
    try { run('DELETE FROM work_checkpoints WHERE agent_id = ?', [id]); } catch (e) { errors.push(`work_checkpoints: ${(e as Error).message}`); }
    
    // Knowledge and skills
    try { run('UPDATE knowledge_entries SET created_by_agent_id = NULL WHERE created_by_agent_id = ?', [id]); } catch (e) { errors.push(`knowledge_entries: ${(e as Error).message}`); }
    try { run('UPDATE product_skills SET created_by_agent_id = NULL WHERE created_by_agent_id = ?', [id]); } catch (e) { errors.push(`product_skills: ${(e as Error).message}`); }
    
    // Cost and operations
    try { run('UPDATE cost_events SET agent_id = NULL WHERE agent_id = ?', [id]); } catch (e) { errors.push(`cost_events: ${(e as Error).message}`); }
    try { run('UPDATE operations_log SET agent_id = NULL WHERE agent_id = ?', [id]); } catch (e) { errors.push(`operations_log: ${(e as Error).message}`); }
    try { run('UPDATE research_cycles SET agent_id = NULL WHERE agent_id = ?', [id]); } catch (e) { errors.push(`research_cycles: ${(e as Error).message}`); }

    // Now delete the agent
    run('DELETE FROM agents WHERE id = ?', [id]);

    if (errors.length > 0) {
      console.warn(`[DELETE Agent ${id}] Some related records could not be cleaned up:`, errors);
    }

    return NextResponse.json({ success: true, warnings: errors.length > 0 ? errors : undefined });
  } catch (error) {
    console.error('Failed to delete agent:', error);
    return NextResponse.json({ error: 'Failed to delete agent', details: (error as Error).message }, { status: 500 });
  }
}
