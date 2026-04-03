import { NextRequest, NextResponse } from 'next/server';
import { complete } from '@/lib/autopilot/llm';
import { getAutopilotProduct, updateAutopilotProduct } from '@/lib/db/autopilot-products';
import { run } from '@/lib/db';

function ensureAutopilotColumns() {
  try { run(`ALTER TABLE autopilot_products ADD COLUMN additional_prompt TEXT`); } catch {}
  try { run(`ALTER TABLE autopilot_products ADD COLUMN executive_summary TEXT`); } catch {}
  try { run(`ALTER TABLE autopilot_products ADD COLUMN workflow_state TEXT DEFAULT 'initial'`); } catch {}
}

export const dynamic = 'force-dynamic';

function buildExecutiveSummaryPrompt(productProgram: string, additionalPrompt?: string | null): string {
  const basePrompt = `You are an expert product strategist and technical architect. Create a comprehensive Executive Summary based on the provided Product Requirements Document (PRD).

## Product Requirements Document (PRD):
${productProgram}

## CRITICAL INSTRUCTIONS

1. **NO INTRODUCTIONS OR META-COMMENTARY**: Start directly with "# Executive Summary". Do NOT include phrases like "Voy a revisar primero...", "Ahora tengo el contexto completo...", "He creado el Executive Summary...", or "El documento completo incluye...". Output ONLY the Executive Summary content.

2. **NO FILE REFERENCES**: Do NOT mention file paths, saving locations, or that the document is saved anywhere. Just output the content.

3. **ROADMAP MUST BE COMPREHENSIVE**: Create as many phases/sprints as necessary for the product (typically 4-8 phases). Each phase MUST include:
   - Clear phase name indicating the focus
   - Detailed user story with: As a [role], I want [feature], so that [benefit]
   - Specific features and functionality being delivered
   - Acceptance criteria or deliverables
   - Estimated effort indication (if relevant)

4. **TECH STACK MUST BE COMPLETE**: List ALL technological layers needed, including but not limited to:
   - Frontend framework/library
   - Backend/runtime
   - Database(s) - primary, cache, search
   - API layer
   - Authentication/Authorization
   - Infrastructure/Hosting
   - CI/CD
   - Monitoring/Logging
   - Testing frameworks
   - Any other relevant technology layers

## REQUIRED OUTPUT STRUCTURE

# Executive Summary
**Document Purpose:** This executive summary provides decision-makers with the key strategic insights and recommendations from our product development roadmap.

## 🎯 STRATEGIC IMPERATIVES

### Why This Product Matters Now
[3-5 compelling reasons with detailed explanations]

## 📊 KEY FINDINGS

### Finding 1: [Title]
**Key Insight:** [Detailed explanation]

### Finding 2: [Title]
**Key Insight:** [Detailed explanation]

### Finding 3: [Title]
**Key Insight:** [Detailed explanation]

### Strategic Benefits
1. **[Benefit Name]:** [Detailed description of business value]
2. **[Benefit Name]:** [Detailed description of business value]
3. **[Benefit Name]:** [Detailed description of business value]

## ⚠️ CRITICAL SUCCESS FACTORS

### What Will Make This Fail (Avoid These)
1. [Specific risk with mitigation strategy]
2. [Specific risk with mitigation strategy]
3. [Specific risk with mitigation strategy]
4. [Specific risk with mitigation strategy]
5. [Specific risk with mitigation strategy]

### What Will Make This Succeed (Do These)
1. [Specific action with implementation approach]
2. [Specific action with implementation approach]
3. [Specific action with implementation approach]
4. [Specific action with implementation approach]
5. [Specific action with implementation approach]

## 🗺️ ROADMAP OVERVIEW
[Create as many phases as needed - typically 4-8 phases]

### PHASE 1: [Descriptive Name]
**User Story:** As a [user type], I want [capability], so that [benefit/outcome]

**Features & Functionality:**
- [Specific feature with detailed description]
- [Specific feature with detailed description]
- [Specific feature with detailed description]

**Acceptance Criteria:**
- [Measurable criterion]
- [Measurable criterion]

**Key Deliverables:** [What is produced at end of phase]

### PHASE 2: [Descriptive Name]
[Same detailed structure as Phase 1]

### PHASE 3: [Descriptive Name]
[Same detailed structure as Phase 1]

### PHASE 4: [Descriptive Name]
[Same detailed structure as Phase 1]

[Continue with additional phases as needed for the product scope]

## 🛠️ TECHNOLOGY STACK

**Frontend:** [Specific technologies with versions if relevant - e.g., "Next.js 14 with React 18, Tailwind CSS for styling, React Query for state management"]

**Backend:** [Specific runtime/framework - e.g., "Node.js with Express, or Python with FastAPI"]

**Database:** [All data stores - e.g., "PostgreSQL 15 for primary data, Redis for caching and sessions, Elasticsearch for search if needed"]

**API Layer:** [e.g., "REST with OpenAPI spec, or GraphQL with Apollo Server"]

**Authentication/Authorization:** [e.g., "Auth0, Firebase Auth, or custom JWT implementation"]

**Infrastructure/Hosting:** [e.g., "Vercel for frontend, AWS EC2/Fargate for backend, RDS for PostgreSQL"]

**CI/CD:** [e.g., "GitHub Actions for automated testing and deployment"]

**Monitoring & Logging:** [e.g., "Datadog, Sentry for error tracking, CloudWatch"]

**Testing:** [e.g., "Jest + React Testing Library for frontend, Pytest for backend, Playwright for E2E"]

**Additional Layers:** [Any other specific technologies needed - e.g., "WebSocket for real-time features, Stripe for payments, SendGrid for email"]`;

  if (additionalPrompt && additionalPrompt.trim()) {
    return `${basePrompt}

## Additional Context from User:
${additionalPrompt.trim()}

Incorporate this additional context into your analysis and recommendations.`;
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

    // Save additional_prompt if provided in request body
    const body = await request.json().catch(() => ({}));
    if (body.additional_prompt !== undefined) {
      updateAutopilotProduct(params.id, { additional_prompt: body.additional_prompt });
    }

    const additionalPrompt = body.additional_prompt ?? product.additional_prompt;

    const prompt = buildExecutiveSummaryPrompt(product.product_program, additionalPrompt);

    // Generate using LLM with 5 minute timeout
    const result = await complete(prompt, {
      model: 'openclaw',
      systemPrompt: 'You are an expert product strategist and technical architect. You create comprehensive, actionable executive summaries. You NEVER include meta-commentary like "I will analyze" or "I have created". You NEVER mention saving files or paths. You output ONLY the requested document content. You always provide detailed, specific recommendations.',
      temperature: 0.7,
      maxTokens: 4096,
      timeoutMs: 300_000, // 5 minutes
    });

    // Clean up the response aggressively
    let executiveSummary = result.content.trim();
    
    // Remove markdown code blocks if present
    const codeBlockMatch = executiveSummary.match(/^```(?:markdown)?\s*([\s\S]*?)```$/m);
    if (codeBlockMatch) {
      executiveSummary = codeBlockMatch[1].trim();
    }

    // Remove common LLM intros/outros
    const lines = executiveSummary.split('\n');
    const cleanedLines: string[] = [];
    let foundStart = false;
    
    for (const line of lines) {
      // Skip lines before # Executive Summary
      if (!foundStart && line.trim().startsWith('# Executive Summary')) {
        foundStart = true;
      }
      if (!foundStart) continue;
      
      // Stop at file references or meta-commentary
      if (line.includes('**Archivo guardado en:**') || 
          line.includes('El documento completo incluye') ||
          line.match(/^He creado el Executive Summary/) ||
          line.match(/^Voy a revisar/) ||
          line.match(/^Ahora tengo el contexto/) ||
          line.match(/^---$/)) {
        break;
      }
      
      cleanedLines.push(line);
    }
    
    executiveSummary = cleanedLines.join('\n').trim();

    // Ensure it starts with the expected header
    if (!executiveSummary.includes('# Executive Summary')) {
      executiveSummary = `# Executive Summary\n\n${executiveSummary}`;
    }

    // Save to database only (no file system)
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
