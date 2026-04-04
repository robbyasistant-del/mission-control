import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

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
    
    // Parse the markdown file
    const lines = content.split('\n');
    const config: Record<string, string> = {};
    let inPromptTemplate = false;
    const promptTemplateLines: string[] = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Parse config from frontmatter-style section
      if (line.startsWith('- **')) {
        const match = line.match(/- \*\*(.+?)\*\*:\s*`?(.+?)`?$/);
        if (match) {
          const key = match[1].toLowerCase().replace(/\s+/g, '_');
          config[key] = match[2];
        }
      }
      
      // Detect prompt template section
      if (line.trim() === '## Prompt Template') {
        inPromptTemplate = true;
        continue;
      }
      
      if (inPromptTemplate) {
        if (line.startsWith('```')) {
          if (promptTemplateLines.length > 0) {
            // End of code block
            break;
          }
          // Start of code block, skip
          continue;
        }
        promptTemplateLines.push(line);
      }
    }
    
    const promptText = promptTemplateLines.join('\n').trim();
    
    return NextResponse.json({
      key,
      content,
      prompt_text: promptText,
      config: {
        model: config.model || 'openclaw',
        temperature: parseFloat(config.temperature) || 0.7,
        max_tokens: parseInt(config.max_tokens) || 4096,
        timeout_ms: parseInt(config.timeout) || 300000,
        system_prompt: config.system_prompt || '',
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

// POST /api/prompts/[key] - Save prompt content to file
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
    const { prompt_text } = body;
    
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
    const header = headerMatch ? headerMatch[0] : `# ${key.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}\n\n`;
    
    // Build new content
    const newContent = `${header}## Prompt Template\n\n\`\`\`\n${prompt_text}\n\`\`\`\n`;
    
    await fs.writeFile(filepath, newContent, 'utf-8');
    
    return NextResponse.json({ success: true, key });
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