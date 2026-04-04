import { NextRequest, NextResponse } from 'next/server';
import { complete } from '@/lib/autopilot/llm';
import { getAutopilotPrompt, type PromptKey } from '@/lib/db/autopilot-prompts';
import { promises as fs } from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

const FALLBACK_PRD = `# Product Requirements Document

## Overview

## Objectives:

## Features:

## Reference Urls:

## Visual References:`;

const PROMPT_KEY: PromptKey = 'product-program';

async function getPromptAndConfig(productId?: string) {
  // 1. Try to get from DB if product_id provided
  if (productId) {
    const dbPrompt = getAutopilotPrompt(productId, PROMPT_KEY);
    if (dbPrompt) {
      return {
        prompt_text: dbPrompt.prompt_text,
        model: dbPrompt.model,
        temperature: dbPrompt.temperature,
        max_tokens: dbPrompt.max_tokens,
        timeout_ms: dbPrompt.timeout_ms,
        system_prompt: dbPrompt.system_prompt,
      };
    }
  }
  
  // 2. Fallback: read from file
  try {
    const filepath = path.join(process.cwd(), 'prompts', '01-product-program.md');
    const content = await fs.readFile(filepath, 'utf-8');
    
    // Parse prompt text
    const promptMatch = content.match(/## Prompt Template\s*\n\s*```(?:\w*\n|\n)?([\s\S]*?)```/);
    const promptText = promptMatch ? promptMatch[1].trim() : '';
    
    // Parse config
    const modelMatch = content.match(/- \*\*Model\*\*:\s*`?([^`\n]+)`?/);
    const tempMatch = content.match(/- \*\*Temperature\*\*:\s*`?([^`\n]+)`?/);
    const tokensMatch = content.match(/- \*\*Max Tokens\*\*:\s*`?([^`\n]+)`?/);
    const timeoutMatch = content.match(/- \*\*Timeout\*\*:\s*`?([^`\n\(]+)`?/);
    const systemMatch = content.match(/- \*\*System Prompt\*\*:\s*`?([^`\n]+)`?/);
    
    return {
      prompt_text: promptText,
      model: modelMatch ? modelMatch[1].trim() : 'openclaw',
      temperature: tempMatch ? parseFloat(tempMatch[1]) : 0.7,
      max_tokens: tokensMatch ? parseInt(tokensMatch[1]) : 2048,
      timeout_ms: timeoutMatch ? parseInt(timeoutMatch[1]) : 120000,
      system_prompt: systemMatch ? systemMatch[1].trim() : 'You are a product requirements specialist. Create concise, practical PRDs with maximum 3 items per section.',
    };
  } catch (error) {
    console.error('Failed to read prompt file:', error);
    // 3. Final fallback: hardcoded defaults
    return {
      prompt_text: '', // Will use hardcoded buildPrompt as last resort
      model: 'openclaw',
      temperature: 0.7,
      max_tokens: 2048,
      timeout_ms: 120000,
      system_prompt: 'You are a product requirements specialist. Create concise, practical PRDs with maximum 3 items per section.',
    };
  }
}

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
    const { name, description, repo_url, live_url, source_code_path, local_deploy_path, product_id } = body || {};

    if (!name || typeof name !== 'string') {
      return NextResponse.json(
        { error: 'name is required', fallback: FALLBACK_PRD },
        { status: 400 }
      );
    }

    // Get prompt and config from DB or file
    const config = await getPromptAndConfig(product_id);
    
    // Build the final prompt
    const promptText = config.prompt_text || buildPrompt({ name, description, repo_url, live_url, source_code_path, local_deploy_path });
    
    // Replace variables in prompt text if they exist
    const finalPrompt = promptText
      .replace(/\{\{name\}\}/g, name || 'Untitled Product')
      .replace(/\{\{description\}\}/g, description || 'No description provided')
      .replace(/\{\{repo_url\}\}/g, repo_url || '')
      .replace(/\{\{live_url\}\}/g, live_url || '')
      .replace(/\{\{source_code_path\}\}/g, source_code_path || '')
      .replace(/\{\{local_deploy_path\}\}/g, local_deploy_path || '');

    // Use the configured parameters
    const result = await complete(finalPrompt, {
      model: config.model,
      systemPrompt: config.system_prompt,
      temperature: config.temperature,
      maxTokens: config.max_tokens,
      timeoutMs: config.timeout_ms,
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