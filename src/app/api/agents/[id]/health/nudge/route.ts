import { NextRequest, NextResponse } from 'next/server';
import { nudgeAgent } from '@/lib/agent-health';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST /api/agents/[id]/health/nudge — Nudge a stuck agent
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const result = await nudgeAgent(id);

    if (!result.success) {
      return NextResponse.json({ 
        success: false,
        error: result.error,
        actions: result.actions 
      }, { status: 400 });
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Agent nudged and re-dispatched with checkpoint context',
      actions: result.actions 
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to nudge agent' }, { status: 500 });
  }
}
