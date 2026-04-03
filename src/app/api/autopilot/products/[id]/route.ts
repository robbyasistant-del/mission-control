import { NextRequest, NextResponse } from 'next/server';
import {
  getAutopilotProduct,
  updateAutopilotProduct,
  archiveAutopilotProduct,
  deleteAutopilotProduct
} from '@/lib/db/autopilot-products';
import { run } from '@/lib/db';

function ensureAutopilotColumns() {
  try { run(`ALTER TABLE autopilot_products ADD COLUMN additional_prompt TEXT`); } catch {}
  try { run(`ALTER TABLE autopilot_products ADD COLUMN additional_prompt_arch TEXT`); } catch {}
  try { run(`ALTER TABLE autopilot_products ADD COLUMN executive_summary TEXT`); } catch {}
  try { run(`ALTER TABLE autopilot_products ADD COLUMN technical_architecture TEXT`); } catch {}
  try { run(`ALTER TABLE autopilot_products ADD COLUMN implementation_roadmap TEXT`); } catch {}
  try { run(`ALTER TABLE autopilot_products ADD COLUMN workflow_state TEXT DEFAULT 'initial'`); } catch {}
}

// GET /api/autopilot/products/[id] - Get single product
export async function GET(
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
    
    return NextResponse.json(product);
  } catch (error) {
    console.error('Failed to get autopilot product:', error);
    return NextResponse.json(
      { error: 'Failed to get product' },
      { status: 500 }
    );
  }
}

// PATCH /api/autopilot/products/[id] - Update product
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    ensureAutopilotColumns();
    const body = await request.json();
    const product = updateAutopilotProduct(params.id, body);
    
    if (!product) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(product);
  } catch (error) {
    console.error('Failed to update autopilot product:', error);
    return NextResponse.json(
      { error: 'Failed to update product' },
      { status: 500 }
    );
  }
}

// DELETE /api/autopilot/products/[id] - Delete product
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const success = deleteAutopilotProduct(params.id);
    
    if (!success) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete autopilot product:', error);
    return NextResponse.json(
      { error: 'Failed to delete product' },
      { status: 500 }
    );
  }
}
