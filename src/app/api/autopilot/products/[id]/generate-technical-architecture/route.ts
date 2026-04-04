import { NextRequest, NextResponse } from 'next/server';
import { complete } from '@/lib/autopilot/llm';
import { getAutopilotProduct, updateAutopilotProduct } from '@/lib/db/autopilot-products';
import { getAutopilotPrompt, type PromptKey } from '@/lib/db/autopilot-prompts';
import { run } from '@/lib/db';
import { promises as fs } from 'fs';
import path from 'path';

function ensureAutopilotColumns() {
  try { run(`ALTER TABLE autopilot_products ADD COLUMN additional_prompt_arch TEXT`); } catch {}
  try { run(`ALTER TABLE autopilot_products ADD COLUMN technical_architecture TEXT`); } catch {}
  try { run(`ALTER TABLE autopilot_products ADD COLUMN workflow_state TEXT DEFAULT 'initial'`); } catch {}
}

export const dynamic = 'force-dynamic';

const PROMPT_KEY: PromptKey = 'technical-architecture';

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
    const filepath = path.join(process.cwd(), 'prompts', '03-technical-architecture.md');
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
      max_tokens: tokensMatch ? parseInt(tokensMatch[1]) : 8000,
      timeout_ms: timeoutMatch ? parseInt(timeoutMatch[1]) : 300000,
      system_prompt: systemMatch ? systemMatch[1].trim() : 'You are a software architect. Generate complete technical documentation with all requested sections. Never stop after section 1.',
    };
  } catch (error) {
    console.error('Failed to read prompt file:', error);
    // 3. Final fallback: hardcoded defaults
    return {
      prompt_text: '',
      model: 'openclaw',
      temperature: 0.7,
      max_tokens: 8000,
      timeout_ms: 300000,
      system_prompt: 'You are a software architect. Generate complete technical documentation with all requested sections. Never stop after section 1.',
    };
  }
}

function buildFallbackPrompt(productProgram: string, executiveSummary: string, additionalPrompt?: string | null): string {
  return `Genera un documento de Arquitectura Técnica completo con TODAS estas secciones en markdown:

## 1. Architecture Overview
Descripción de la arquitectura general y componentes principales.

## 2. Technology Stack
Lista de tecnologías por capa (Frontend, Backend, Database, etc).

## 3. Database Schema
Tablas principales y sus campos clave.

## 4. API Design
Endpoints principales con método y propósito.

## 5. Infrastructure
Despliegue y variables de entorno.

INFORMACIÓN DEL PRODUCTO:
${productProgram.slice(0, 1500)}${productProgram.length > 1500 ? '...' : ''}

RESUMEN EJECUTIVO:
${executiveSummary.slice(0, 1000)}${executiveSummary.length > 1000 ? '...' : ''}

${additionalPrompt ? `NOTAS ADICIONALES: ${additionalPrompt}` : ''}

REGLA CRÍTICA: Debes generar las 5 secciones completas. No omitas ninguna.

MANDATORY: NUNCA se escribe la respuesta en fichero. Se debe devolver el texto completo directamente en la respuesta de esta llamada API. NO escribir a disco.`;
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    ensureAutopilotColumns();
    const product = getAutopilotProduct(params.id);
    
    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    if (!product.product_program || !product.executive_summary) {
      return NextResponse.json(
        { error: 'Product Program and Executive Summary are required' },
        { status: 400 }
      );
    }

    const body = await request.json().catch(() => ({}));
    if (body.additional_prompt !== undefined) {
      updateAutopilotProduct(params.id, { additional_prompt_arch: body.additional_prompt });
    }

    const additionalPrompt = body.additional_prompt ?? product.additional_prompt_arch;
    
    // Get prompt and config from DB or file
    const config = await getPromptAndConfig(params.id);
    
    // Build the final prompt
    const promptText = config.prompt_text || buildFallbackPrompt(product.product_program, product.executive_summary, additionalPrompt);
    
    // Replace variables in prompt text if they exist
    const finalPrompt = promptText
      .replace(/\{\{product_program\}\}/g, product.product_program || '')
      .replace(/\{\{executive_summary\}\}/g, product.executive_summary || '')
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
    const technicalArchitecture = result.content.trim();

    updateAutopilotProduct(params.id, { 
      technical_architecture: technicalArchitecture,
      workflow_state: 'architecture'
    });

    return NextResponse.json({
      technicalArchitecture,
      source: 'gateway-llm',
      model: result.model,
      tokens: result.usage,
    });

  } catch (error) {
    console.error('Failed to generate technical architecture:', error);
    const errorMsg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}