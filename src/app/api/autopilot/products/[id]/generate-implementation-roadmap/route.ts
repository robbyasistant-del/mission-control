import { NextRequest, NextResponse } from 'next/server';
import { complete } from '@/lib/autopilot/llm';
import { getAutopilotProduct, updateAutopilotProduct } from '@/lib/db/autopilot-products';
import { getAutopilotPrompt, type PromptKey } from '@/lib/db/autopilot-prompts';
import { run } from '@/lib/db';
import { promises as fs } from 'fs';
import path from 'path';

function ensureAutopilotColumns() {
  try { run(`ALTER TABLE autopilot_products ADD COLUMN additional_prompt_roadmap TEXT`); } catch {}
}

export const dynamic = 'force-dynamic';

const PROMPT_KEY: PromptKey = 'implementation-roadmap';

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
    const filepath = path.join(process.cwd(), 'prompts', '04-implementation-roadmap.md');
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
      max_tokens: tokensMatch ? parseInt(tokensMatch[1]) : 12000,
      timeout_ms: timeoutMatch ? parseInt(timeoutMatch[1]) : 300000,
      system_prompt: systemMatch ? systemMatch[1].trim() : 'You are a project manager specialized in software development roadmaps. Create detailed, actionable implementation plans with clear sprint breakdowns. Always provide complete content, never stop mid-section.',
    };
  } catch (error) {
    console.error('Failed to read prompt file:', error);
    // 3. Final fallback: hardcoded defaults
    return {
      prompt_text: '',
      model: 'openclaw',
      temperature: 0.7,
      max_tokens: 12000,
      timeout_ms: 300000,
      system_prompt: 'You are a project manager specialized in software development roadmaps. Create detailed, actionable implementation plans with clear sprint breakdowns. Always provide complete content, never stop mid-section.',
    };
  }
}

function buildFallbackPrompt(
  productProgram: string,
  executiveSummary: string,
  technicalArchitecture: string,
  sourceCodePath?: string | null,
  localDeployPath?: string | null,
  additionalPrompt?: string | null
): string {
  return `Genera un Implementation Roadmap completo en formato markdown para el siguiente producto:

## CONTEXTO DEL PRODUCTO

### Product Program (PRD)
${productProgram.slice(0, 3000)}${productProgram.length > 3000 ? '...' : ''}

### Executive Summary
${executiveSummary.slice(0, 2000)}${executiveSummary.length > 2000 ? '...' : ''}

### Technical Architecture
${technicalArchitecture.slice(0, 3000)}${technicalArchitecture.length > 3000 ? '...' : ''}

${additionalPrompt ? `## NOTAS ADICIONALES\n${additionalPrompt}\n` : ''}

---

## INSTRUCCIONES MANDATORY

Genera un roadmap de implementación completo con el siguiente formato EXACTO:

# Implementation Roadmap
**Document Purpose:** This roadmap provides a detailed, actionable plan for implementing the product. It breaks down the work into phases, identifies dependencies, estimates tasks and subtasks, and defines success criteria for each milestone.

## DEVELOPMENT RULES (MANDATORY)
- Work in this path ${sourceCodePath || localDeployPath || '[path not provided]'}
- Deploy/check runtime in this path ${localDeployPath || sourceCodePath || '[path not provided]'}
- Work must follow the technical architecture defined above
- Each sprint must deliver a complete, working feature
- Each sprint must contain between 5 and 10 clear subtasks or user stories
- All code must be tested before marking as done
- Documentation must be updated with each deliverable

### Status Legend
- \`pending\` → no iniciada
- \`in_progress\` → en curso
- \`blocked\` → bloqueada
- \`review\` → lista para revisión
- \`done\` → completada

### Agent Roles
- \`rob_main\` → coordinación, kickoff, stakeholders, documentación funcional
- \`rob_web\` → infra, despliegue, observabilidad, seguridad, performance, backend APIs
- \`rob_asogrowth\` → warehouse, pipelines, calidad de datos, scoring, analytics, scripts de recolección
- \`rob_uxdesigner\` → UI dashboard, graphical design, navegación, widgets, vistas
- \`rob_market\` → lógica de inteligencia de mercado, ASO, benchmarking, reporting
- \`rob_tester\` → testing, validación, UAT, QA checklist

---

## PHASE 1: Foundation & Setup

### Sprint 1: Project Initialization

**Functionality Analysis:**
Setup del proyecto, repositorio, estructura de carpetas, configuración inicial del entorno de desarrollo.

**Features Description:**
- Configuración del repositorio Git
- Setup de herramientas de desarrollo
- Configuración de CI/CD básico
- Documentación inicial del proyecto

**Tasks:**
- [rob_main][][][pending] Crear estructura de carpetas del proyecto
- [rob_web][][][pending] Configurar repositorio Git y protección de ramas
- [rob_web][][][pending] Setup de CI/CD pipeline básico
- [rob_tester][][][pending] Definir estrategia de testing

**Deliverables:**
- Repositorio configurado
- Pipeline CI/CD funcionando
- Documentación de setup completa

**Quality Criteria:**
- Build exitoso en CI
- Tests básicos pasando
- Documentación clara para nuevos desarrolladores

---

## PHASE 2: Core Development

### Sprint 2: [Nombre de funcionalidad principal]

[Continuar con el mismo patrón para cada sprint...]

---

**REGLAS IMPORTANTES:**
1. Genera TODAS las fases necesarias (Phase 1, 2, 3...) hasta completar el producto
2. Cada Sprint debe ser una funcionalidad COMPLETA con 5-10 subtareas
3. Cada tarea debe tener un título CLARO, CONCISO y DIRECTO
4. Incluye suficiente descripción para NO necesitar preguntas adicionales
5. Las tareas deben poder hacerse en ORDEN secuencial
6. Asigna agentes según el tipo de trabajo (rob_main, rob_web, rob_uxdesigner, rob_tester)

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

    if (!product.product_program || !product.executive_summary || !product.technical_architecture) {
      return NextResponse.json(
        { error: 'Product Program, Executive Summary and Technical Architecture are required' },
        { status: 400 }
      );
    }

    const body = await request.json().catch(() => ({}));
    if (body.additional_prompt !== undefined) {
      updateAutopilotProduct(params.id, { additional_prompt_roadmap: body.additional_prompt });
    }

    const additionalPrompt = body.additional_prompt ?? product.additional_prompt_roadmap;
    
    // Get prompt and config from DB or file
    const config = await getPromptAndConfig(params.id);
    
    // Build the final prompt
    const promptText = config.prompt_text || buildFallbackPrompt(
      product.product_program,
      product.executive_summary,
      product.technical_architecture,
      product.source_code_path,
      product.local_deploy_path,
      additionalPrompt
    );
    
    // Replace variables in prompt text if they exist
    const finalPrompt = promptText
      .replace(/\{\{product_program\}\}/g, product.product_program || '')
      .replace(/\{\{executive_summary\}\}/g, product.executive_summary || '')
      .replace(/\{\{technical_architecture\}\}/g, product.technical_architecture || '')
      .replace(/\{\{source_code_path\}\}/g, product.source_code_path || '')
      .replace(/\{\{local_deploy_path\}\}/g, product.local_deploy_path || '')
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
    const implementationRoadmap = result.content.trim();

    updateAutopilotProduct(params.id, {
      implementation_roadmap: implementationRoadmap,
      workflow_state: 'roadmap'
    });

    return NextResponse.json({
      implementationRoadmap,
      source: 'gateway-llm',
      model: result.model,
      tokens: result.usage,
    });

  } catch (error) {
    console.error('Failed to generate implementation roadmap:', error);
    const errorMsg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}