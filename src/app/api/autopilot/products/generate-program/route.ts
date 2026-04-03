import { NextRequest, NextResponse } from 'next/server';
import { getOpenClawClient } from '@/lib/openclaw/client';

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

export async function POST(request: NextRequest) {
  const debug: string[] = [];
  
  try {
    const body = await request.json();
    const { name, description, repo_url, live_url, source_code_path, local_deploy_path } = body || {};

    if (!name || typeof name !== 'string') {
      return NextResponse.json({ error: 'name is required', fallback: FALLBACK_PRD }, { status: 400 });
    }

    debug.push(`1. Starting generation for product: ${name}`);

    // Get OpenClaw client
    const client = getOpenClawClient();
    debug.push(`2. Got OpenClaw client instance`);

    // Check connection and connect if needed
    if (!client.isConnected()) {
      debug.push(`3. Client not connected, attempting connect...`);
      try {
        await client.connect();
        debug.push(`4. Connected successfully`);
      } catch (connErr) {
        debug.push(`4. Connection failed: ${connErr instanceof Error ? connErr.message : String(connErr)}`);
        return NextResponse.json({ 
          suggestedProgram: FALLBACK_PRD, 
          source: 'fallback:gateway-unavailable',
          error: 'Cannot connect to Gateway',
          debug
        });
      }
    } else {
      debug.push(`3. Client already connected`);
    }

    // List sessions to find main
    debug.push(`5. Listing sessions...`);
    let sessions;
    try {
      sessions = await client.listSessions();
      debug.push(`6. Found ${sessions.length} sessions`);
    } catch (listErr) {
      debug.push(`6. Failed to list sessions: ${listErr instanceof Error ? listErr.message : String(listErr)}`);
      return NextResponse.json({ 
        suggestedProgram: FALLBACK_PRD, 
        source: 'fallback:list-sessions-failed',
        error: 'Failed to list Gateway sessions',
        debug
      });
    }

    if (!sessions || sessions.length === 0) {
      debug.push(`7. No sessions found`);
      return NextResponse.json({ 
        suggestedProgram: FALLBACK_PRD, 
        source: 'fallback:no-sessions',
        error: 'No Gateway sessions available',
        debug
      });
    }

    // Find main session or use first available
    const mainSession = sessions.find((s) => s.id === 'main') 
      || sessions.find((s) => (s.channel || '').toLowerCase() === 'main')
      || sessions[0];
    
    const sessionId = mainSession.id;
    debug.push(`7. Using session: ${sessionId} (channel: ${mainSession.channel || 'unknown'})`);

    // Get history before sending
    let beforeHistory;
    try {
      beforeHistory = await client.getSessionHistory(sessionId);
      debug.push(`8. Got history, length: ${beforeHistory.length}`);
    } catch (histErr) {
      debug.push(`8. Failed to get history: ${histErr instanceof Error ? histErr.message : String(histErr)}`);
      return NextResponse.json({ 
        suggestedProgram: FALLBACK_PRD, 
        source: 'fallback:history-failed',
        error: 'Failed to get session history',
        debug
      });
    }
    
    const beforeLen = Array.isArray(beforeHistory) ? beforeHistory.length : 0;

    // Send message
    const prompt = buildPrompt({ name, description, repo_url, live_url, source_code_path, local_deploy_path });
    debug.push(`9. Sending prompt (${prompt.length} chars)...`);
    
    try {
      await client.sendMessage(sessionId, prompt);
      debug.push(`10. Message sent successfully`);
    } catch (sendErr) {
      debug.push(`10. Failed to send message: ${sendErr instanceof Error ? sendErr.message : String(sendErr)}`);
      return NextResponse.json({ 
        suggestedProgram: FALLBACK_PRD, 
        source: 'fallback:send-failed',
        error: 'Failed to send message to Gateway',
        debug
      });
    }

    // Poll for response (2 minute timeout)
    debug.push(`11. Starting poll loop (2 min timeout)...`);
    const timeoutMs = 2 * 60 * 1000;
    const startTime = Date.now();
    let pollCount = 0;
    
    while (Date.now() - startTime < timeoutMs) {
      await sleep(3000);
      pollCount++;
      
      try {
        const history = await client.getSessionHistory(sessionId);
        const arr = Array.isArray(history) ? (history as Array<{ role?: string; content?: string }>) : [];

        if (arr.length > beforeLen) {
          debug.push(`12. Poll #${pollCount}: History grew from ${beforeLen} to ${arr.length}`);

          // Find last assistant message
          for (let i = arr.length - 1; i >= 0; i--) {
            const msg = arr[i];
            if (msg?.role === 'assistant' && typeof msg.content === 'string' && msg.content.trim()) {
              debug.push(`13. Found assistant response at index ${i}`);
              return NextResponse.json({
                suggestedProgram: msg.content.trim(),
                source: 'gateway-main',
                debug
              });
            }
          }
        }
      } catch (pollErr) {
        debug.push(`12. Poll #${pollCount} error: ${pollErr instanceof Error ? pollErr.message : String(pollErr)}`);
      }
    }

    debug.push(`14. Timeout after ${pollCount} polls`);
    return NextResponse.json({ 
      suggestedProgram: FALLBACK_PRD, 
      source: 'fallback:timeout',
      error: 'Gateway timeout - no response within 2 minutes',
      debug
    });
    
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    debug.push(`ERROR: ${errorMsg}`);
    console.error('Failed to generate autopilot product program:', error);
    return NextResponse.json({ 
      suggestedProgram: FALLBACK_PRD, 
      source: 'fallback:error',
      error: errorMsg,
      debug
    });
  }
}
