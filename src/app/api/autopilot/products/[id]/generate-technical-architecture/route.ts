import { NextRequest, NextResponse } from 'next/server';
import { complete } from '@/lib/autopilot/llm';
import { getAutopilotProduct, updateAutopilotProduct } from '@/lib/db/autopilot-products';
import { run } from '@/lib/db';

function ensureAutopilotColumns() {
  try { run(`ALTER TABLE autopilot_products ADD COLUMN additional_prompt_arch TEXT`); } catch {}
  try { run(`ALTER TABLE autopilot_products ADD COLUMN technical_architecture TEXT`); } catch {}
  try { run(`ALTER TABLE autopilot_products ADD COLUMN workflow_state TEXT DEFAULT 'initial'`); } catch {}
}

export const dynamic = 'force-dynamic';

function buildPrompt(productProgram: string, executiveSummary: string, additionalPrompt?: string | null): string {
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
    const prompt = buildPrompt(product.product_program, product.executive_summary, additionalPrompt);

    const result = await complete(prompt, {
      model: 'openclaw',
      systemPrompt: 'You are a software architect. Generate complete technical documentation with all requested sections. Never stop after section 1.',
      temperature: 0.7,
      maxTokens: 8000,
      timeoutMs: 300_000,
    });

    let technicalArchitecture = result.content.trim();
    
    const codeBlockMatch = technicalArchitecture.match(/^```(?:markdown)?\s*([\s\S]*?)```$/m);
    if (codeBlockMatch) {
      technicalArchitecture = codeBlockMatch[1].trim();
    }

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
