import { NextRequest, NextResponse } from 'next/server';

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

// Call Gateway REST API directly
async function gatewayCall<T>(method: string, params?: Record<string, unknown>): Promise<T> {
  const gatewayUrl = process.env.OPENCLAW_GATEWAY_URL || 'http://127.0.0.1:18789';
  const token = process.env.OPENCLAW_GATEWAY_TOKEN || '';
  
  const response = await fetch(`${gatewayUrl}/api/v1/rpc`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      type: 'req',
      id: crypto.randomUUID(),
      method,
      params,
    }),
  });

  if (!response.ok) {
    throw new Error(`Gateway error: ${response.status}`);
  }

  const data = await response.json();
  if (data.ok === false && data.error) {
    throw new Error(data.error.message || 'Gateway RPC error');
  }
  return data.payload as T;
}

async function findMainSession(): Promise<string | null> {
  try {
    // Try to find main session via RPC
    const sessions = await gatewayCall<Array<{ id: string; channel?: string; peer?: string }>>('sessions.list');
    
    // Look for main session
    const main = sessions.find((s) => s.id === 'main') 
      || sessions.find((s) => (s.channel || '').toLowerCase() === 'main')
      || sessions[0];
    
    return main?.id || null;
  } catch {
    return null;
  }
}

async function sendMessageAndWait(sessionId: string, content: string, timeoutMs: number): Promise<string | null> {
  // Get history before sending
  const beforeHistory = await gatewayCall<Array<{ role?: string; content?: string }>>('sessions.history', { 
    session_id: sessionId 
  });
  const beforeLen = beforeHistory?.length || 0;

  // Send message
  await gatewayCall('sessions.send', { 
    session_id: sessionId, 
    content 
  });

  // Poll for response
  const startTime = Date.now();
  while (Date.now() - startTime < timeoutMs) {
    await sleep(3000);
    
    try {
      const history = await gatewayCall<Array<{ role?: string; content?: string }>>('sessions.history', { 
        session_id: sessionId 
      });
      
      if (history && history.length > beforeLen) {
        // Find last assistant message
        for (let i = history.length - 1; i >= 0; i--) {
          const msg = history[i];
          if (msg?.role === 'assistant' && msg?.content?.trim()) {
            return msg.content.trim();
          }
        }
      }
    } catch {
      // Continue polling
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

    // Find main session
    const sessionId = await findMainSession();
    if (!sessionId) {
      return NextResponse.json({ 
        suggestedProgram: FALLBACK_PRD, 
        source: 'fallback:no-session',
        error: 'No Gateway session available'
      });
    }

    const prompt = buildPrompt({ name, description, repo_url, live_url, source_code_path, local_deploy_path });
    
    // Send and wait for response (2 minute timeout)
    const response = await sendMessageAndWait(sessionId, prompt, 2 * 60 * 1000);
    
    if (response) {
      return NextResponse.json({ 
        suggestedProgram: response, 
        source: 'gateway-main' 
      });
    }

    return NextResponse.json({ 
      suggestedProgram: FALLBACK_PRD, 
      source: 'fallback:timeout',
      error: 'Gateway timeout - no response within 2 minutes'
    });
    
  } catch (error) {
    console.error('Failed to generate autopilot product program:', error);
    return NextResponse.json({ 
      suggestedProgram: FALLBACK_PRD, 
      source: 'fallback:error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
