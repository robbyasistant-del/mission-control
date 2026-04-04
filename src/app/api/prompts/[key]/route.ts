import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { upsertAutopilotPrompt, type PromptKey } from '@/lib/db/autopilot-prompts';

export const dynamic = 'force-dynamic';

// Map prompt keys to file names
const PROMPT_FILES: Record<string, string> = {
  'product-program': '01-product-program.md',
  'executive-summary': '02-executive-summary.md',
  'technical-architecture': '03-technical-architecture.md',
  'implementation-roadmap': '04-implementation-roadmap.md',
  'watchdog-task-description': '05-watchdog-task-description.md',
  'research-cycle': '06-research-cycle.md',
  'ideation-cycle': '07-ideation-cycle.md',
};

// GET /api/prompts/[key] - Get prompt content from file
export async function GET(
  request: NextRequest,
  { params }: { params: { key: string } }
) {
  try {
    const { key } = await Promise.resolve(params);
    const filename = PROMPT_FILES[key];
    
    if (!filename) {
      return NextResponse.json(
        { error: 'Invalid prompt key' },
        { status: 400 }
      );
    }
    
    const filepath = path.join(process.cwd(), 'prompts', filename);
    const content = await fs.readFile(filepath, 'utf-8');
    
    // Parse config values
    const modelMatch = content.match(/- \*\*Model\*\*:\s*`?([^`\n]+)`?/);
    const tempMatch = content.match(/- \*\*Temperature\*\*:\s*`?([^`\n]+)`?/);
    const tokensMatch = content.match(/- \*\*Max Tokens\*\*:\s*`?([^`\n]+)`?/);
    const timeoutMatch = content.match(/- \*\*Timeout\*\*:\s*`?([^`\n\(]+)`?/);
    const systemMatch = content.match(/- \*\*System Prompt\*\*:\s*`?([^`\n]+)`?/);
    
    // Extract content between ``` after ## Prompt Template
    const promptMatch = content.match(/## Prompt Template\s*\n\s*```(?:\w*\n|\n)?([\s\S]*?)```/);
    const promptText = promptMatch ? promptMatch[1].trim() : '';
    
    return NextResponse.json({
      key,
      content,
      prompt_text: promptText,
      config: {
        model: modelMatch ? modelMatch[1].trim() : 'openclaw',
        temperature: tempMatch ? parseFloat(tempMatch[1]) : 0.7,
        max_tokens: tokensMatch ? parseInt(tokensMatch[1]) : 4096,
        timeout_ms: timeoutMatch ? parseInt(timeoutMatch[1]) : 300000,
        system_prompt: systemMatch ? systemMatch[1].trim() : '',
      },
    });
  } catch (error) {
    console.error('Failed to read prompt file:', error);
    return NextResponse.json(
      { error: 'Failed to read prompt file' },
      { status: 500 }
    );
  }
}

// POST /api/prompts/[key] - Save prompt content to file and DB params
export async function POST(
  request: NextRequest,
  { params }: { params: { key: string } }
) {
  try {
    const { key } = await Promise.resolve(params);
    const filename = PROMPT_FILES[key];
    
    if (!filename) {
      return NextResponse.json(
        { error: 'Invalid prompt key' },
        { status: 400 }
      );
    }
    
    const body = await request.json();
    const { prompt_text, model, temperature, max_tokens, timeout_ms, system_prompt, product_id } = body;
    
    if (typeof prompt_text !== 'string') {
      return NextResponse.json(
        { error: 'prompt_text is required' },
        { status: 400 }
      );
    }
    
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
    const header = headerMatch ? headerMatch[0] : `# ${key.replace(/-/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}\n\n`;
    
    // Build new content
    const newContent = `${header}## Prompt Template\n\n\`\`\`\n${prompt_text}\n\`\`\`\n`;
    
    await fs.writeFile(filepath, newContent, 'utf-8');
    
    // Save params to DB if product_id provided
    if (product_id) {
      upsertAutopilotPrompt(product_id, key as PromptKey, {
        prompt_text,
        model,
        temperature,
        max_tokens,
        timeout_ms,
        system_prompt,
        is_enabled: true,
      });
    }
    
    return NextResponse.json({ success: true, key, saved_to_db: !!product_id });
  } catch (error) {
    console.error('Failed to save prompt file:', error);
    return NextResponse.json(
      { error: 'Failed to save prompt file' },
      { status: 500 }
    );
  }
}

// PUT /api/prompts/[key] - Reset to default (from .backup file)
export async function PUT(
  request: NextRequest,
  { params }: { params: { key: string } }
) {
  try {
    const { key } = await Promise.resolve(params);
    const filename = PROMPT_FILES[key];
    
    if (!filename) {
      return NextResponse.json(
        { error: 'Invalid prompt key' },
        { status: 400 }
      );
    }
    
    const filepath = path.join(process.cwd(), 'prompts', filename);
    const backupPath = `${filepath}.backup`;
    
    // Check if backup exists
    try {
      await fs.access(backupPath);
    } catch {
      return NextResponse.json(
        { error: 'Backup file not found' },
        { status: 404 }
      );
    }
    
    // Copy backup to main file
    const backupContent = await fs.readFile(backupPath, 'utf-8');
    await fs.writeFile(filepath, backupContent, 'utf-8');
    
    return NextResponse.json({ success: true, key, message: 'Reset to default' });
  } catch (error) {
    console.error('Failed to reset prompt file:', error);
    return NextResponse.json(
      { error: 'Failed to reset prompt file' },
      { status: 500 }
    );
  }
}