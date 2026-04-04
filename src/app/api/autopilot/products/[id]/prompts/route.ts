import { NextRequest, NextResponse } from 'next/server';
import {
  getAutopilotPromptsByProduct,
  upsertAutopilotPrompt,
  resetAutopilotPromptToDefault,
  initializeDefaultPromptsForProduct,
  PROMPT_KEYS,
  type PromptKey,
} from '@/lib/db/autopilot-prompts';
import { promises as fs } from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/autopilot/products/[id]/prompts - List all prompts for product
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: productId } = await params;
    
    // Ensure defaults are initialized
    await initializeDefaultPromptsForProduct(productId);
    
    const prompts = getAutopilotPromptsByProduct(productId);
    
    return NextResponse.json({ prompts });
  } catch (error) {
    console.error('Failed to fetch prompts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch prompts' },
      { status: 500 }
    );
  }
}

// POST /api/autopilot/products/[id]/prompts - Update a prompt (file + DB)
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: productId } = await params;
    const body = await request.json();
    
    const { prompt_key, prompt_text, model, temperature, max_tokens, timeout_ms, system_prompt } = body;
    
    if (!prompt_key || !PROMPT_KEYS.includes(prompt_key as PromptKey)) {
      return NextResponse.json(
        { error: 'Invalid or missing prompt_key' },
        { status: 400 }
      );
    }
    
    // 1. Save to file
    const filename = `${prompt_key}.md`;
    const filepath = path.join(process.cwd(), 'prompts', filename);
    
    // Read existing file to preserve header/config
    let existingContent = '';
    try {
      existingContent = await fs.readFile(filepath, 'utf-8');
    } catch {
      // File doesn't exist, will create new
    }
    
    // Extract header (everything before ## Prompt Template)
    const headerMatch = existingContent.match(/^[\s\S]*?(?=## Prompt Template)/);
    const header = headerMatch ? headerMatch[0] : `# ${prompt_key.replace(/-/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}\n\n`;
    
    // Build new content with updated config
    const newContent = `${header}## Prompt Template\n\n\`\`\`\n${prompt_text}\n\`\`\`\n`;
    
    await fs.writeFile(filepath, newContent, 'utf-8');
    
    // 2. Save to database
    const prompt = upsertAutopilotPrompt(productId, prompt_key as PromptKey, {
      prompt_text,
      model,
      temperature,
      max_tokens,
      timeout_ms,
      system_prompt,
      is_enabled: true,
    });
    
    return NextResponse.json({ prompt, saved_to_file: true });
  } catch (error) {
    console.error('Failed to update prompt:', error);
    return NextResponse.json(
      { error: 'Failed to update prompt' },
      { status: 500 }
    );
  }
}

// PUT /api/autopilot/products/[id]/prompts/reset - Reset to default
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: productId } = await params;
    const body = await request.json();
    const { prompt_key } = body;
    
    if (!prompt_key || !PROMPT_KEYS.includes(prompt_key as PromptKey)) {
      return NextResponse.json(
        { error: 'Invalid or missing prompt_key' },
        { status: 400 }
      );
    }
    
    // Read default from file
    const filename = `${prompt_key}.md`;
    const filepath = path.join(process.cwd(), 'prompts', filename);
    
    let defaultPromptText = '';
    try {
      const content = await fs.readFile(filepath, 'utf-8');
      const match = content.match(/## Prompt Template\s*```\s*([\s\S]*?)\s*```/);
      defaultPromptText = match ? match[1].trim() : content;
    } catch {
      return NextResponse.json(
        { error: 'Default prompt file not found' },
        { status: 404 }
      );
    }
    
    const prompt = resetAutopilotPromptToDefault(productId, prompt_key as PromptKey, defaultPromptText);
    
    return NextResponse.json({ prompt });
  } catch (error) {
    console.error('Failed to reset prompt:', error);
    return NextResponse.json(
      { error: 'Failed to reset prompt' },
      { status: 500 }
    );
  }
}