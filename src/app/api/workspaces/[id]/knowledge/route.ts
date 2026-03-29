import { NextRequest, NextResponse } from 'next/server';
import { queryAll, run, queryOne } from '@/lib/db';
import { appendWorkspaceMemoryEntry } from '@/lib/workspace-memory';

export const dynamic = 'force-dynamic';

function appendWorkspaceLearningToAgentsMd(workspaceId: string, entry: {
  title: string;
  content: string;
  category: string;
  confidence: number;
  createdAt?: string;
}) {
  const createdAt = entry.createdAt || new Date().toISOString();
  const summary = entry.content.length > 280 ? `${entry.content.slice(0, 277)}...` : entry.content;
  const memoryLine = `- [${createdAt}] (${entry.category}, confidence ${entry.confidence.toFixed(2)}) **${entry.title}** — ${summary}`;

  const agents = queryAll<{ id: string; agents_md: string | null }>(
    'SELECT id, agents_md FROM agents WHERE workspace_id = ?',
    [workspaceId]
  );

  for (const agent of agents) {
    const existing = agent.agents_md || '# Team Roster';
    const marker = '## Persistent Team Learnings';
    let updated: string;

    if (existing.includes(marker)) {
      const [head, rest] = existing.split(marker);
      const oldLines = rest
        .split('\n')
        .map(l => l.trimEnd())
        .filter(l => l.trim().startsWith('- ['))
        .slice(0, 19);
      updated = `${head.trimEnd()}\n\n${marker}\n\n${memoryLine}\n${oldLines.join('\n')}`.trim() + '\n';
    } else {
      updated = `${existing.trimEnd()}\n\n${marker}\n\n${memoryLine}\n`;
    }

    run('UPDATE agents SET agents_md = ?, updated_at = ? WHERE id = ?', [updated, new Date().toISOString(), agent.id]);
  }
}

/**
 * GET /api/workspaces/[id]/knowledge
 * Query knowledge entries for a workspace
 * Supports query params: category, tags, limit
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: workspaceId } = await params;
  const { searchParams } = new URL(request.url);
  const category = searchParams.get('category');
  const limit = parseInt(searchParams.get('limit') || '50', 10);

  try {
    let sql = 'SELECT * FROM knowledge_entries WHERE workspace_id = ?';
    const sqlParams: unknown[] = [workspaceId];

    if (category) {
      sql += ' AND category = ?';
      sqlParams.push(category);
    }

    sql += ' ORDER BY confidence DESC, created_at DESC LIMIT ?';
    sqlParams.push(limit);

    const entries = queryAll<{
      id: string; workspace_id: string; task_id: string; category: string;
      title: string; content: string; tags: string; confidence: number;
      created_by_agent_id: string; created_at: string;
    }>(sql, sqlParams);

    const parsed = entries.map(e => ({
      ...e,
      tags: e.tags ? JSON.parse(e.tags) : [],
    }));

    return NextResponse.json(parsed);
  } catch (error) {
    console.error('Failed to fetch knowledge entries:', error);
    return NextResponse.json({ error: 'Failed to fetch entries' }, { status: 500 });
  }
}

/**
 * POST /api/workspaces/[id]/knowledge
 * Create a knowledge entry (used by Learner agent)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: workspaceId } = await params;

  try {
    const body = await request.json();
    const { task_id, category, title, content, tags, confidence, created_by_agent_id } = body;

    if (!category || !title || !content) {
      return NextResponse.json(
        { error: 'category, title, and content are required' },
        { status: 400 }
      );
    }

    const id = crypto.randomUUID();

    const confidenceValue = confidence ?? 0.5;

    run(
      `INSERT INTO knowledge_entries (id, workspace_id, task_id, category, title, content, tags, confidence, created_by_agent_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      [
        id, workspaceId, task_id || null, category, title, content,
        tags ? JSON.stringify(tags) : null,
        confidenceValue,
        created_by_agent_id || null
      ]
    );

    // High-confidence knowledge becomes persistent team memory for future sessions
    if (confidenceValue >= 0.7) {
      appendWorkspaceLearningToAgentsMd(workspaceId, {
        title,
        content,
        category,
        confidence: confidenceValue,
      });

      // Also persist to filesystem WORKSPACE_MEMORY.md
      const ws = queryOne<{ slug: string }>('SELECT slug FROM workspaces WHERE id = ?', [workspaceId]);
      if (ws) {
        try {
          appendWorkspaceMemoryEntry(ws.slug, { title, content, category, confidence: confidenceValue });
        } catch (err) {
          console.warn('[Knowledge] Failed to update WORKSPACE_MEMORY.md:', err);
        }
      }
    }

    return NextResponse.json({ id, message: 'Knowledge entry created' }, { status: 201 });
  } catch (error) {
    console.error('Failed to create knowledge entry:', error);
    return NextResponse.json({ error: 'Failed to create entry' }, { status: 500 });
  }
}
