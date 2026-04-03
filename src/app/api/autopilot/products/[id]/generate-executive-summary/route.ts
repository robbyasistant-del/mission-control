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
  const basePrompt = `You are an expert product strategist and technical architect. Your task is to create a comprehensive Executive Summary for a product based on the provided Product Requirements Document (PRD).

## Product Requirements Document (PRD):
${productProgram}

## Your Task
Create a detailed Executive Summary following this exact structure. Research and analyze the PRD content deeply to extract strategic insights:

# Executive Summary
**Document Purpose:** This executive summary provides decision-makers with the key strategic insights and recommendations from our product development roadmap. 

## 🎯 STRATEGIC IMPERATIVES

### Why This Product Matters Now

1. **Matters 1** Description 1
2. **Matters 2** Description 2
3. **Matters 3** Description 3

## 📊 KEY FINDINGS

### Finding 1:
**Key Insight:**

### Finding 2:
**Key Insight:**

### Finding 3:
**Key Insight:**

### Strategic Benefits

1. **benefit 1**
2. **benefit 2**
3. **benefit 3**

## ⚠️ CRITICAL SUCCESS FACTORS
### What Will Make This Fail (Avoid These)
1...
2...
3...
4...
5...

### What Will Make This Succeed (Do These)
1...
2...
3...
4...
5...

## 🗺️ ROADMAP OVERVIEW
### PHASE 1: [Name]
**PHASE 1 user story**...

### PHASE 2: [Name]
**PHASE 2 user story**...

### PHASE 3: [Name]
**PHASE 3 user story**...

### PHASE 4: [Name]
**PHASE 4 user story**...

## TECHNOLOGY STACK
**Frontend:** ...
**Backend:** ...
**Database:** ...
**Infrastructure:** ...
**AI/ML (if applicable):** ...

## Instructions:
- Analyze the PRD deeply and extract strategic insights
- Create realistic, actionable phases based on the product scope
- Suggest appropriate technology stack based on the product requirements
- Be specific and detailed in each section
- Focus on business value and technical feasibility
- Consider the URLs and paths mentioned in the PRD for context`;

  if (additionalPrompt && additionalPrompt.trim()) {
    return `${basePrompt}\n\n## Additional Context from User:\n${additionalPrompt}\n\nUse this additional context to guide your analysis and recommendations.`;
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
      systemPrompt: 'You are an expert product strategist, technical architect, and business analyst. You excel at creating comprehensive executive summaries that bridge business strategy with technical implementation. You analyze product requirements deeply and provide actionable, realistic roadmaps and technology recommendations.',
      temperature: 0.7,
      maxTokens: 4096,
      timeoutMs: 300_000, // 5 minutes
    });

    // Clean up the response
    let executiveSummary = result.content.trim();
    
    // Remove markdown code blocks if present
    const codeBlockMatch = executiveSummary.match(/^```(?:markdown)?\s*([\s\S]*?)```$/m);
    if (codeBlockMatch) {
      executiveSummary = codeBlockMatch[1].trim();
    }

    // Ensure it starts with the expected header
    if (!executiveSummary.includes('# Executive Summary')) {
      executiveSummary = `# Executive Summary\n\n${executiveSummary}`;
    }

    // Save to database
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
