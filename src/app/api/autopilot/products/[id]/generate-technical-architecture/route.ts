import { NextRequest, NextResponse } from 'next/server';
import { complete } from '@/lib/autopilot/llm';
import { getAutopilotProduct, updateAutopilotProduct } from '@/lib/db/autopilot-products';
import { run } from '@/lib/db';

function ensureAutopilotColumns() {
  try { run(`ALTER TABLE autopilot_products ADD COLUMN additional_prompt TEXT`); } catch {}
  try { run(`ALTER TABLE autopilot_products ADD COLUMN additional_prompt_arch TEXT`); } catch {}
  try { run(`ALTER TABLE autopilot_products ADD COLUMN executive_summary TEXT`); } catch {}
  try { run(`ALTER TABLE autopilot_products ADD COLUMN technical_architecture TEXT`); } catch {}
  try { run(`ALTER TABLE autopilot_products ADD COLUMN workflow_state TEXT DEFAULT 'initial'`); } catch {}
}

export const dynamic = 'force-dynamic';

function buildTechnicalArchitecturePrompt(
  productProgram: string,
  executiveSummary: string,
  additionalPrompt?: string | null
): string {
  const basePrompt = `You are an expert software architect. Create a CONCISE Technical Architecture document based on the Product Program and Executive Summary provided.

## Product Requirements Document (PRD):
${productProgram}

## Executive Summary:
${executiveSummary}

## MANDATORY CONSTRAINTS - FOLLOW EXACTLY:

1. **NO META-COMMENTARY**: Start directly with "## 1. Architecture Overview". Never include phrases like "I will analyze", "I have created", or file paths.

2. **BE CONCISE**: Use bullet points, tables, and brief descriptions. NO long paragraphs.

3. **INCLUDE DIAGRAMS AS TEXT**: Use ASCII diagrams or clear textual representations for architecture and database schemas.

## REQUIRED STRUCTURE:

## 1. Architecture Overview

### 1.1 High-Level Architecture
[ASCII diagram or text representation showing:
- Frontend layer
- API Gateway / Backend layer  
- Database / Storage layer
- External services integration
]

### 1.2 Technology Stack
| Layer | Technology | Purpose |
|-------|------------|---------|
| Frontend | [e.g., Next.js 14] | [Brief purpose] |
| Backend | [e.g., Node.js + Express] | [Brief purpose] |
| Database | [e.g., PostgreSQL] | [Brief purpose] |
| Cache | [e.g., Redis] | [Brief purpose] |
| Auth | [e.g., Auth0] | [Brief purpose] |
| Storage | [e.g., AWS S3] | [Brief purpose] |

## 2. Database Schema Design

### 2.1 Core Tables
[Text diagram showing main tables with key fields, e.g.:

users
- id: UUID (PK)
- email: VARCHAR
- created_at: TIMESTAMP
- ...

projects  
- id: UUID (PK)
- user_id: UUID (FK)
- name: VARCHAR
- ...
]

### 2.2 Key Relationships
- [Brief description of main relationships between tables]

## 3. API Design

### 3.1 Core Endpoints
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | /api/v1/resource | [Brief description] |
| POST | /api/v1/resource | [Brief description] |

## 4. Infrastructure

### 4.1 Deployment Architecture
[Brief description of hosting/deployment approach]

### 4.2 Key Environment Variables
- DATABASE_URL
- REDIS_URL
- [Other critical env vars]`;

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
        { error: 'Product Program (PRD) is required' },
        { status: 400 }
      );
    }

    if (!product.executive_summary) {
      return NextResponse.json(
        { error: 'Executive Summary is required before generating Technical Architecture' },
        { status: 400 }
      );
    }

    const body = await request.json().catch(() => ({}));
    if (body.additional_prompt !== undefined) {
      updateAutopilotProduct(params.id, { additional_prompt_arch: body.additional_prompt });
    }

    const additionalPrompt = body.additional_prompt ?? product.additional_prompt_arch;
    const prompt = buildTechnicalArchitecturePrompt(
      product.product_program,
      product.executive_summary,
      additionalPrompt
    );

    const result = await complete(prompt, {
      systemPrompt: 'You are an expert software architect. You create comprehensive technical architecture documents with all sections fully detailed. Include complete information for all 4 sections (Architecture Overview, Database Schema, API Design, and Infrastructure). Never truncate or summarize - provide full details.',
      temperature: 0.7,
      maxTokens: 8000,
      timeoutMs: 300_000,
    });

    console.log(`[TechArch] Raw response length: ${result.content.length} chars`);
    console.log(`[TechArch] Response preview (last 500 chars): ${result.content.slice(-500)}`);

    let technicalArchitecture = result.content.trim();
    
    const codeBlockMatch = technicalArchitecture.match(/^```(?:markdown)?\s*([\s\S]*?)```$/m);
    if (codeBlockMatch) {
      technicalArchitecture = codeBlockMatch[1].trim();
    }

    if (!technicalArchitecture.includes('## 1. Architecture Overview')) {
      technicalArchitecture = `## 1. Architecture Overview\n\n${technicalArchitecture}`;
    }

    console.log(`[TechArch] Final content length: ${technicalArchitecture.length} chars`);
    console.log(`[TechArch] Content includes '## 4.': ${technicalArchitecture.includes('## 4.')}`);
    console.log(`[TechArch] Content includes '### 4.3': ${technicalArchitecture.includes('### 4.3')}`);

    updateAutopilotProduct(params.id, { 
      technical_architecture: technicalArchitecture,
      workflow_state: 'architecture'
    });

    console.log(`[TechArch] Saved to DB for product ${params.id}`);

    return NextResponse.json({
      technicalArchitecture,
      source: 'gateway-llm',
      model: result.model,
      tokens: result.usage,
    });

  } catch (error) {
    console.error('Failed to generate technical architecture:', error);
    const errorMsg = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: errorMsg },
      { status: 500 }
    );
  }
}
