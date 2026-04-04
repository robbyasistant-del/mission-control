import { NextRequest, NextResponse } from 'next/server';
import { complete } from '@/lib/autopilot/llm';

export const dynamic = 'force-dynamic';

const FALLBACK_PRD = `# Product Requirements Document

## Overview

## Objectives:

## Features:

## Reference Urls:

## Visual References:`;

function buildPrompt(input: {
  name: string;
  description?: string;
  repo_url?: string;
  live_url?: string;
  source_code_path?: string;
  local_deploy_path?: string;
}) {
  return `You are a Product Requirements Agent. Create a simple, practical Product Program (PRD) based on the product information provided.

## Product Information
- Name: ${input.name || 'Untitled Product'}
- Description: ${input.description || 'No description provided'}
${input.repo_url ? `- Repository: ${input.repo_url}` : ''}
${input.live_url ? `- Live URL: ${input.live_url}` : ''}
${input.source_code_path ? `- Source Code Path: ${input.source_code_path}` : ''}
${input.local_deploy_path ? `- Local Deploy Path: ${input.local_deploy_path}` : ''}

## Your Task
Create a concise Product Requirements Document with exactly this structure:

# Product Requirements Document

## Overview
(max 3 bullet points describing what this product does and who it's for)

## Objectives:
(max 3 bullet points with key goals this product should achieve)

## Features:
(max 3 bullet points listing core functionality)

## Reference Urls:
(max 3 relevant URLs - use the repo/live URLs provided if available, or suggest useful references)

## Visual References:
(max 3 visual/design references or suggestions)

## Constraints
- Maximum 3 items per section
- Each item should be 1 line maximum
- Be specific and actionable, not generic
- Use the provided URLs/paths as context
- Keep it simple and practical

Respond with ONLY the PRD content in the exact format above. No markdown code blocks, no extra explanation.`;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, repo_url, live_url, source_code_path, local_deploy_path } = body || {};

    if (!name || typeof name !== 'string') {
      return NextResponse.json(
        { error: 'name is required', fallback: FALLBACK_PRD },
        { status: 400 }
      );
    }

    const prompt = buildPrompt({ name, description, repo_url, live_url, source_code_path, local_deploy_path });

    // Use the same approach as Research: complete() against /v1/chat/completions
    const result = await complete(prompt, {
      model: 'openclaw', // Use Gateway's default agent
      systemPrompt: 'You are a product requirements specialist. Create concise, practical PRDs with maximum 3 items per section.',
      temperature: 0.7,
      maxTokens: 2048,
      timeoutMs: 120_000, // 2 minutes
      signal: request.signal,
    });

    if (request.signal.aborted) {
      return NextResponse.json({ error: 'Request aborted', suggestedProgram: FALLBACK_PRD, source: 'fallback:aborted' }, { status: 499 });
    }

    // Preserve the complete LLM response without filtering
    const suggestedProgram = result.content.trim();

    return NextResponse.json({
      suggestedProgram,
      source: 'gateway-llm',
      model: result.model,
      tokens: result.usage,
    });

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('Failed to generate autopilot product program:', error);
    
    return NextResponse.json({
      suggestedProgram: FALLBACK_PRD,
      source: 'fallback:error',
      error: errorMsg,
    });
  }
}
