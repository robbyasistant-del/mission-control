import { NextRequest, NextResponse } from 'next/server';
import { complete } from '@/lib/autopilot/llm';
import { getAutopilotProduct, updateAutopilotProduct } from '@/lib/db/autopilot-products';
import { run } from '@/lib/db';

function ensureAutopilotColumns() {
  try { run(`ALTER TABLE autopilot_products ADD COLUMN additional_prompt_roadmap TEXT`); } catch {}
}

export const dynamic = 'force-dynamic';

function buildPrompt(
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
    const prompt = buildPrompt(
      product.product_program,
      product.executive_summary,
      product.technical_architecture,
      product.source_code_path,
      product.local_deploy_path,
      additionalPrompt
    );

    const result = await complete(prompt, {
      model: 'openclaw',
      systemPrompt: 'You are a project manager specialized in software development roadmaps. Create detailed, actionable implementation plans with clear sprint breakdowns. Always provide complete content, never stop mid-section.',
      temperature: 0.7,
      maxTokens: 12000,
      timeoutMs: 300_000,
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
