import { NextRequest, NextResponse } from 'next/server';
import { getOpenClawClient } from '@/lib/openclaw/client';
import { queryOne } from '@/lib/db';
import type { OpenClawHistoryMessage, OpenClawSessionInfo } from '@/lib/types';

export const dynamic = 'force-dynamic';

const FALLBACK_PRD = `# Product Requirements Document

## Overview

## Objectives:

## Features:

## Reference Urls:

## Visual References:`;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildPrompt(input: {
  name: string;
  description?: string;
  repo_url?: string;
  live_url?: string;
  source_code_path?: string;
  local_deploy_path?: string;
}) {
  return `Create a Product Program (PRD) with this exact structure:
# Product Requirements Document

## Overview
(max 3 bullet points)

## Objectives:
(max 3 bullet points)

## Features:
(max 3 bullet points)

## Reference Urls:
(max 3 URLs)

## Visual References:
(max 3 references)

IMPORTANT CONSTRAINTS:
- Maximum 3 items per section (keep it extremely simple)
- Each bullet point max 1 line
- Use the product info below to fill content
- This is a SUGGESTED draft for user editing

Product info:
- Name: ${input.name || ''}
- Description: ${input.description || ''}
- Repo URL: ${input.repo_url || ''}
- Live URL: ${input.live_url || ''}
- Source-code path: ${input.source_code_path || ''}
- Local Deploy path: ${input.local_deploy_path || ''}`;
}

function extractLastAssistant(history: unknown[]): string | null {
  if (!Array.isArray(history)) return null;
  const msgs = history as OpenClawHistoryMessage[];
  for (let i = msgs.length - 1; i >= 0; i--) {
    const m = msgs[i];
    if (m?.role === 'assistant' && typeof m.content === 'string' && m.content.trim()) {
      return m.content.trim();
    }
  }
  return null;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, repo_url, live_url, source_code_path, local_deploy_path } = body || {};

    if (!name || typeof name !== 'string') {
      return NextResponse.json({ error: 'name is required', fallback: FALLBACK_PRD }, { status: 400 });
    }

    const client = getOpenClawClient();
    if (!client.isConnected()) {
      try {
        await client.connect();
      } catch {
        return NextResponse.json({ suggestedProgram: FALLBACK_PRD, source: 'fallback:gateway-unavailable' });
      }
    }

    // 1) Prefer DB-known main session
    const dbMain = queryOne<{ openclaw_session_id: string }>(
      `SELECT openclaw_session_id FROM openclaw_sessions
       WHERE session_type = 'main' AND status != 'completed'
       ORDER BY updated_at DESC LIMIT 1`
    );

    // 2) Fallback to live sessions
    const sessions = await client.listSessions().catch(() => [] as OpenClawSessionInfo[]);
    const mainCandidate = sessions.find((s) => s.id === 'main')
      || sessions.find((s) => (s.channel || '').toLowerCase() === 'main')
      || sessions[0];

    const sessionId = dbMain?.openclaw_session_id || mainCandidate?.id;
    if (!sessionId) {
      return NextResponse.json({ suggestedProgram: FALLBACK_PRD, source: 'fallback:no-session' });
    }

    const beforeHistory = await client.getSessionHistory(sessionId).catch(() => []);
    const beforeLen = Array.isArray(beforeHistory) ? beforeHistory.length : 0;

    const prompt = buildPrompt({ name, description, repo_url, live_url, source_code_path, local_deploy_path });
    await client.sendMessage(sessionId, prompt);

    // Wait up to 2 minutes, poll every 3s
    const timeoutAt = Date.now() + 2 * 60 * 1000;
    while (Date.now() < timeoutAt) {
      await sleep(3000);
      const history = await client.getSessionHistory(sessionId).catch(() => []);
      const arr = Array.isArray(history) ? history : [];
      if (arr.length > beforeLen) {
        const maybe = extractLastAssistant(arr);
        if (maybe) {
          return NextResponse.json({ suggestedProgram: maybe, source: 'gateway-main' });
        }
      }
    }

    return NextResponse.json({ suggestedProgram: FALLBACK_PRD, source: 'fallback:timeout' });
  } catch (error) {
    console.error('Failed to generate autopilot product program:', error);
    return NextResponse.json({ suggestedProgram: FALLBACK_PRD, source: 'fallback:error' });
  }
}
