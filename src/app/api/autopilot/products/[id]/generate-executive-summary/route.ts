import { NextRequest, NextResponse } from 'next/server';
import { complete } from '@/lib/autopilot/llm';
import { getAutopilotProduct, updateAutopilotProduct } from '@/lib/db/autopilot-products';
import { getAutopilotPrompt, type PromptKey } from '@/lib/db/autopilot-prompts';
import { run } from '@/lib/db';
import { promises as fs } from 'fs';
import path from 'path';

function ensureAutopilotColumns() {
  try { run(`ALTER TABLE autopilot_products ADD COLUMN additional_prompt TEXT`); } catch {}
  try { run(`ALTER TABLE autopilot_products ADD COLUMN executive_summary TEXT`); } catch {}
  try { run(`ALTER TABLE autopilot_products ADD COLUMN workflow_state TEXT DEFAULT 'initial'`); } catch {}
}

export const dynamic = 'force-dynamic';

const PROMPT_KEY: PromptKey = 'executive-summary';

async function getPromptAndConfig(productId: string) {
  // 1. Try to get from DB
  const dbPrompt = getAutopilotPrompt(productId, PROMPT_KEY);
  if (dbPrompt && dbPrompt.prompt_text) {
    return {
      prompt_text: dbPrompt.prompt_text,
      model: dbPrompt.model,
      temperature: dbPrompt.temperature,
      max_tokens: dbPrompt.max_tokens,
      timeout_ms: dbPrompt.timeout_ms,
      system_prompt: dbPrompt.system_prompt,
    };
  }
  
  // 2. Fallback: read from file
  try {
    const filepath = path.join(process.cwd(), 'prompts', '02-executive-summary.md');
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
      model: modelMatch ? modelMatch[1].trim() : 'anthropic/claude-sonnet-4-6',
      temperature: tempMatch ? parseFloat(tempMatch[1]) : 0.7,
      max_tokens: tokensMatch ? parseInt(tokensMatch[1]) : 4096,
      timeout_ms: timeoutMatch ? parseInt(timeoutMatch[1]) : 300000,
      system_prompt: systemMatch ? systemMatch[1].trim() : 'You are a concise product strategist. You create brief, bullet-point executive summaries. You NEVER use paragraphs when bullet points suffice. You are strictly limited to 5 bullets per section. You prioritize clarity and brevity over verbosity.',
    };
  } catch (error) {
    console.error('Failed to read prompt file:', error);
    // 3. Final fallback: hardcoded defaults
    return {
      prompt_text: '',
      model: 'anthropic/claude-sonnet-4-6',
      temperature: 0.7,
      max_tokens: 4096,
      timeout_ms: 300000,
      system_prompt: 'You are a concise product strategist. You create brief, bullet-point executive summaries. You NEVER use paragraphs when bullet points suffice. You are strictly limited to 5 bullets per section. You prioritize clarity and brevity over verbosity.',
    };
  }
}

function buildFallbackPrompt(productProgram: string, additionalPrompt?: string | null): string {
  const basePrompt = `You are an expert product strategist. Create a CONCISE Executive Summary based on the PRD below.

## Product Requirements Document (PRD):
${productProgram}

## MANDATORY CONSTRAINTS - FOLLOW EXACTLY:

1. **NO META-COMMENTARY**: Start directly with "# Executive Summary". Never include phrases like "I will analyze", "I have created", "The document includes", or file paths.

2. **MAX 5 BULLET POINTS PER SECTION** (except Roadmap and Tech Stack):
   - Each bullet must be 1 line maximum
   - Be specific and actionable, not verbose
   - NO paragraphs, only bullet points

3. **ROADMAP**: 
   - As many phases as needed (typically 4-6)
   - Each phase: name + 3-5 bullet points of key deliverables
   - NO long paragraphs, NO user story templates
   - Format: "- Phase N: [Name] - [key deliverable in 1 line]"

4. **TECH STACK**:
   - Maximum 8-10 lines total
   - Format: "- **Category**: specific tech"
   - Only essential technologies, no explanations

## REQUIRED STRUCTURE (CONCISE):

# Executive Summary

## 🎯 STRATEGIC IMPERATIVES
- **Point 1**: [1-line description]
- **Point 2**: [1-line description]
- **Point 3**: [1-line description]
- **Point 4**: [1-line description]
- **Point 5**: [1-line description]

## 📊 KEY FINDINGS
- **Finding 1**: [1-line insight]
- **Finding 2**: [1-line insight]
- **Finding 3**: [1-line insight]
- **Finding 4**: [1-line insight]
- **Finding 5**: [1-line insight]

## ⚠️ CRITICAL SUCCESS FACTORS
### Fail (Avoid):
- [Risk 1]
- [Risk 2]
- [Risk 3]
- [Risk 4]
- [Risk 5]

### Succeed (Do):
- [Action 1]
- [Action 2]
- [Action 3]
- [Action 4]
- [Action 5]

## 🗺️ ROADMAP OVERVIEW
- **Phase 1**: [Name] - [Key deliverable 1]
- **Phase 1**: [Name] - [Key deliverable 2]
- **Phase 1**: [Name] - [Key deliverable 3]
- **Phase 2**: [Name] - [Key deliverable 1]
- **Phase 2**: [Name] - [Key deliverable 2]
- **Phase 3**: [Name] - [Key deliverable 1]
- **Phase 3**: [Name] - [Key deliverable 2]
- **Phase 4**: [Name] - [Key deliverable 1]
[Add more phases as needed, each with 3-5 bullet points]

## 🛠️ TECHNOLOGY STACK
- **Frontend**: [tech]
- **Backend**: [tech]
- **Database**: [tech]
- **API**: [tech]
- **Auth**: [tech]
- **Hosting**: [tech]
- **CI/CD**: [tech]
- **Monitoring**: [tech]`;

  if (additionalPrompt && additionalPrompt.trim()) {
    return `${basePrompt}

## Additional Context:
${additionalPrompt.trim()}`;
  }

  return basePrompt;
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    ensureAutopilotColumns();
    const product = getAutopilotProduct(params.id);
    
    if (!product) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      );
    }

    if (!product.product_program) {
      return NextResponse.json(
        { error: 'Product Program (PRD) is required to generate Executive Summary' },
        { status: 400 }
      );
    }

    const body = await request.json().catch(() => ({}));
    if (body.additional_prompt !== undefined) {
      updateAutopilotProduct(params.id, { additional_prompt: body.additional_prompt });
    }

    const additionalPrompt = body.additional_prompt ?? product.additional_prompt;
    
    // Get prompt and config from DB or file
    const config = await getPromptAndConfig(params.id);
    
    // Build the final prompt
    const promptText = config.prompt_text || buildFallbackPrompt(product.product_program, additionalPrompt);
    
    // Replace variables in prompt text if they exist
    const finalPrompt = promptText
      .replace(/\{\{product_program\}\}/g, product.product_program || '')
      .replace(/\{\{additional_prompt\}\}/g, additionalPrompt || '');

    const result = await complete(finalPrompt, {
      model: config.model,
      systemPrompt: config.system_prompt,
      temperature: config.temperature,
      maxTokens: config.max_tokens,
      timeoutMs: config.timeout_ms,
      signal: request.signal,
    });

    if (request.signal.aborted) {
      return NextResponse.json({ error: 'Request aborted' }, { status: 499 });
    }

    // Use the complete LLM response without filtering - preserve everything
    const executiveSummary = result.content.trim();

    updateAutopilotProduct(params.id, { 
      executive_summary: executiveSummary,
      workflow_state: 'executive'
    });

    return NextResponse.json({
      executiveSummary,
      source: 'gateway-llm',
      model: result.model,
      tokens: result.usage,
    });

  } catch (error) {
    console.error('Failed to generate executive summary:', error);
    const errorMsg = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: errorMsg },
      { status: 500 }
    );
  }
}