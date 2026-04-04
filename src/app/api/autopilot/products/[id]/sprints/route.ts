import { NextRequest, NextResponse } from 'next/server';
import { getSprintsWithTasks } from '@/lib/db/autopilot-sprints-tasks';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const sprints = getSprintsWithTasks(params.id);
    
    return NextResponse.json({ sprints });
  } catch (error) {
    console.error('Failed to get sprints:', error);
    const errorMsg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
