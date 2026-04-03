import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { 
  createAutopilotProduct, 
  listAutopilotProducts, 
  getAutopilotProduct,
  updateAutopilotProduct,
  archiveAutopilotProduct,
  deleteAutopilotProduct
} from '@/lib/db/autopilot-products';
import { run } from '@/lib/db';
import type { AutopilotProduct } from '@/lib/db/autopilot-products';

// Ensure table exists and has all columns
function ensureTable() {
  try {
    // Create table if not exists
    run(`
      CREATE TABLE IF NOT EXISTS autopilot_products (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        repo_url TEXT,
        live_url TEXT,
        source_code_path TEXT,
        local_deploy_path TEXT,
        icon TEXT DEFAULT '🚀',
        product_program TEXT,
        executive_summary TEXT,
        additional_prompt TEXT,
        technical_architecture TEXT,
        implementation_roadmap TEXT,
        build_mode TEXT DEFAULT 'plan_first',
        default_branch TEXT DEFAULT 'main',
        workspace_id TEXT,
        status TEXT DEFAULT 'active',
        workflow_state TEXT DEFAULT 'initial',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);
    
    // Migrate: add columns if they don't exist (SQLite doesn't support IF NOT EXISTS for ALTER)
    try {
      run(`ALTER TABLE autopilot_products ADD COLUMN source_code_path TEXT`);
    } catch (e) {
      // Column likely exists, ignore
    }
    try {
      run(`ALTER TABLE autopilot_products ADD COLUMN local_deploy_path TEXT`);
    } catch (e) {
      // Column likely exists, ignore
    }
    try {
      run(`ALTER TABLE autopilot_products ADD COLUMN executive_summary TEXT`);
    } catch (e) {
      // Column likely exists, ignore
    }
    try {
      run(`ALTER TABLE autopilot_products ADD COLUMN technical_architecture TEXT`);
    } catch (e) {
      // Column likely exists, ignore
    }
    try {
      run(`ALTER TABLE autopilot_products ADD COLUMN implementation_roadmap TEXT`);
    } catch (e) {
      // Column likely exists, ignore
    }
    try {
      run(`ALTER TABLE autopilot_products ADD COLUMN additional_prompt TEXT`);
    } catch (e) {
      // Column likely exists, ignore
    }
    try {
      run(`ALTER TABLE autopilot_products ADD COLUMN workflow_state TEXT DEFAULT 'initial'`);
    } catch (e) {
      // Column likely exists, ignore
    }
  } catch (e) {
    console.error('Failed to create/migrate autopilot_products table:', e);
  }
}

// GET /api/autopilot/products - List all products
export async function GET(request: NextRequest) {
  ensureTable();
  
  try {
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspace_id');
    
    const products = listAutopilotProducts(workspaceId || undefined);
    return NextResponse.json(products);
  } catch (error) {
    console.error('Failed to list autopilot products:', error);
    return NextResponse.json(
      { error: 'Failed to list products' },
      { status: 500 }
    );
  }
}

// POST /api/autopilot/products - Create new product
export async function POST(request: NextRequest) {
  ensureTable();
  
  try {
    const body = await request.json();
    
    if (!body.name || typeof body.name !== 'string') {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      );
    }

    const product = createAutopilotProduct({
      name: body.name,
      description: body.description,
      repo_url: body.repo_url,
      live_url: body.live_url,
      source_code_path: body.source_code_path,
      local_deploy_path: body.local_deploy_path,
      icon: body.icon || '🚀',
      product_program: body.product_program,
      build_mode: body.build_mode || 'plan_first',
      default_branch: body.default_branch || 'main',
      workspace_id: body.workspace_id,
    });

    // Log activity
    try {
      run(
        `INSERT INTO autopilot_activities (id, product_id, type, message, created_at)
         VALUES (?, ?, ?, ?, ?)`,
        [uuidv4(), product.id, 'product_created', `Product "${product.name}" created`, new Date().toISOString()]
      );
    } catch {}

    return NextResponse.json(product, { status: 201 });
  } catch (error) {
    console.error('Failed to create autopilot product:', error);
    return NextResponse.json(
      { error: 'Failed to create product' },
      { status: 500 }
    );
  }
}
