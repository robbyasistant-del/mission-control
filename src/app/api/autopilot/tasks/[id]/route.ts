import { NextRequest, NextResponse } from 'next/server';
import { updateAutopilotTask, getAutopilotTask } from '@/lib/db/autopilot-sprints-tasks';

export const dynamic = 'force-dynamic';

// PATCH /api/autopilot/tasks/[id] - Update an autopilot task
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Check if task exists
    const existing = getAutopilotTask(id);
    if (!existing) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    // Validate status if provided (must match DB CHECK constraint)
    const validStatuses = ['pending', 'dispatched', 'in_progress', 'blocked', 'testing', 'done'];
    if (body.status && !validStatuses.includes(body.status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      );
    }

    // Update the task
    const updates: Partial<typeof existing> = {};
    if (body.status !== undefined) updates.status = body.status;
    if (body.agent_name !== undefined) updates.agent_name = body.agent_name;
    if (body.start_date !== undefined) updates.start_date = body.start_date;
    if (body.end_date !== undefined) updates.end_date = body.end_date;

    const updated = updateAutopilotTask(id, updates);

    if (!updated) {
      return NextResponse.json({ error: 'Failed to update task' }, { status: 500 });
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Failed to update autopilot task:', error);
    return NextResponse.json(
      { error: 'Failed to update task' },
      { status: 500 }
    );
  }
}

// GET /api/autopilot/tasks/[id] - Get a single autopilot task
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const task = getAutopilotTask(id);

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    return NextResponse.json(task);
  } catch (error) {
    console.error('Failed to fetch autopilot task:', error);
    return NextResponse.json(
      { error: 'Failed to fetch task' },
      { status: 500 }
    );
  }
}
