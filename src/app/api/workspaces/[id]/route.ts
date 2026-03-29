import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';
// GET /api/workspaces/[id] - Get a single workspace
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  
  try {
    const db = getDb();
    
    // Try to find by ID or slug
    const workspace = db.prepare(
      'SELECT * FROM workspaces WHERE id = ? OR slug = ?'
    ).get(id, id);
    
    if (!workspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }
    
    return NextResponse.json(workspace);
  } catch (error) {
    console.error('Failed to fetch workspace:', error);
    return NextResponse.json({ error: 'Failed to fetch workspace' }, { status: 500 });
  }
}

// PATCH /api/workspaces/[id] - Update a workspace
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  
  try {
    const body = await request.json();
    const { name, description, icon } = body;
    
    const db = getDb();
    
    // Check workspace exists
    const existing = db.prepare('SELECT * FROM workspaces WHERE id = ?').get(id);
    if (!existing) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }
    
    // Build update query dynamically
    const updates: string[] = [];
    const values: unknown[] = [];
    
    if (name !== undefined) {
      updates.push('name = ?');
      values.push(name);
    }
    if (description !== undefined) {
      updates.push('description = ?');
      values.push(description);
    }
    if (icon !== undefined) {
      updates.push('icon = ?');
      values.push(icon);
    }
    
    if (updates.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }
    
    updates.push("updated_at = datetime('now')");
    values.push(id);
    
    db.prepare(`
      UPDATE workspaces SET ${updates.join(', ')} WHERE id = ?
    `).run(...values);
    
    const workspace = db.prepare('SELECT * FROM workspaces WHERE id = ?').get(id);
    return NextResponse.json(workspace);
  } catch (error) {
    console.error('Failed to update workspace:', error);
    return NextResponse.json({ error: 'Failed to update workspace' }, { status: 500 });
  }
}

// DELETE /api/workspaces/[id] - Delete a workspace
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  
  try {
    const db = getDb();
    
    // Don't allow deleting the default workspace
    if (id === 'default') {
      return NextResponse.json({ error: 'Cannot delete the default workspace' }, { status: 400 });
    }
    
    // Check workspace exists
    const existing = db.prepare('SELECT * FROM workspaces WHERE id = ?').get(id);
    if (!existing) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }
    
    // Prevent deleting the default workspace
    if (id === 'default') {
      return NextResponse.json({ error: 'Cannot delete the default workspace' }, { status: 400 });
    }

    // Cascade-delete all tasks in this workspace (using cleanupTaskReferences pattern)
    const tasks = db.prepare('SELECT id FROM tasks WHERE workspace_id = ?').all(id) as { id: string }[];
    for (const task of tasks) {
      // Clean FK references for each task
      db.prepare('DELETE FROM workspace_ports WHERE task_id = ?').run(task.id);
      db.prepare('DELETE FROM workspace_merges WHERE task_id = ?').run(task.id);
      db.prepare('DELETE FROM skill_reports WHERE task_id = ?').run(task.id);
      db.prepare('DELETE FROM work_checkpoints WHERE task_id = ?').run(task.id);
      db.prepare('DELETE FROM openclaw_sessions WHERE task_id = ?').run(task.id);
      db.prepare('DELETE FROM events WHERE task_id = ?').run(task.id);
      db.prepare('UPDATE agent_health SET task_id = NULL WHERE task_id = ?').run(task.id);
      db.prepare('UPDATE ideas SET task_id = NULL WHERE task_id = ?').run(task.id);
      db.prepare('UPDATE cost_events SET task_id = NULL WHERE task_id = ?').run(task.id);
      db.prepare('UPDATE content_inventory SET task_id = NULL WHERE task_id = ?').run(task.id);
      db.prepare('UPDATE product_skills SET created_by_task_id = NULL WHERE created_by_task_id = ?').run(task.id);
      db.prepare('UPDATE rollback_history SET task_id = NULL WHERE task_id = ?').run(task.id);
      db.prepare('UPDATE conversations SET task_id = NULL WHERE task_id = ?').run(task.id);
      db.prepare('UPDATE knowledge_entries SET task_id = NULL WHERE task_id = ?').run(task.id);
      // Cascade-delete convoys owned by this task
      const convoy = db.prepare('SELECT id FROM convoys WHERE parent_task_id = ?').get(task.id) as { id: string } | undefined;
      if (convoy) {
        db.prepare('DELETE FROM agent_mailbox WHERE convoy_id = ?').run(convoy.id);
      }
      db.prepare('DELETE FROM tasks WHERE id = ?').run(task.id);
    }

    // Cascade-delete agents in this workspace
    const agents = db.prepare('SELECT id FROM agents WHERE workspace_id = ?').all(id) as { id: string }[];
    for (const agent of agents) {
      db.prepare('DELETE FROM agent_health WHERE agent_id = ?').run(agent.id);
      db.prepare('DELETE FROM openclaw_sessions WHERE agent_id = ?').run(agent.id);
      db.prepare('UPDATE events SET agent_id = NULL WHERE agent_id = ?').run(agent.id);
    }
    db.prepare('DELETE FROM agents WHERE workspace_id = ?').run(id);

    // Delete associated records
    db.prepare('DELETE FROM workflow_templates WHERE workspace_id = ?').run(id);
    db.prepare('DELETE FROM knowledge_entries WHERE workspace_id = ?').run(id);
    db.prepare('DELETE FROM cost_events WHERE workspace_id = ?').run(id);
    db.prepare('DELETE FROM cost_caps WHERE workspace_id = ?').run(id);
    
    db.prepare('DELETE FROM workspaces WHERE id = ?').run(id);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete workspace:', error);
    return NextResponse.json({ error: 'Failed to delete workspace' }, { status: 500 });
  }
}
