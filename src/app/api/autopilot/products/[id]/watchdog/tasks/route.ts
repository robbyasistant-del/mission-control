import { NextRequest, NextResponse } from 'next/server';
import { getCurrentTask, getNextPendingTask, getSprintsWithTasks } from '@/lib/db/autopilot-sprints-tasks';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const currentTask = getCurrentTask(params.id);
    const nextTask = getNextPendingTask(params.id);
    const sprints = getSprintsWithTasks(params.id);
    
    return NextResponse.json({ 
      currentTask,
      nextTask,
      sprints
    });
  } catch (error) {
    console.error('Failed to get watchdog tasks:', error);
    const errorMsg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
