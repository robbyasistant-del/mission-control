import { queryOne, queryAll, run } from './index';
import { v4 as uuidv4 } from 'uuid';

export interface AutopilotProduct {
  id: string;
  name: string;
  description: string | null;
  repo_url: string | null;
  live_url: string | null;
  source_code_path: string | null;
  local_deploy_path: string | null;
  icon: string | null;
  product_program: string | null;
  build_mode: string | null;
  default_branch: string | null;
  workspace_id: string | null;
  status: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateAutopilotProductInput {
  name: string;
  description?: string;
  repo_url?: string;
  live_url?: string;
  source_code_path?: string;
  local_deploy_path?: string;
  icon?: string;
  product_program?: string;
  build_mode?: 'plan_first' | 'auto_build';
  default_branch?: string;
  workspace_id?: string;
}

export function createAutopilotProduct(input: CreateAutopilotProductInput): AutopilotProduct {
  const now = new Date().toISOString();
  const id = uuidv4();
  
  const product: AutopilotProduct = {
    id,
    name: input.name,
    description: input.description ?? null,
    repo_url: input.repo_url ?? null,
    live_url: input.live_url ?? null,
    source_code_path: input.source_code_path ?? null,
    local_deploy_path: input.local_deploy_path ?? null,
    icon: input.icon ?? '🚀',
    product_program: input.product_program ?? null,
    build_mode: input.build_mode ?? 'plan_first',
    default_branch: input.default_branch ?? 'main',
    workspace_id: input.workspace_id ?? null,
    status: 'active',
    created_at: now,
    updated_at: now,
  };

  run(
    `INSERT INTO autopilot_products (id, name, description, repo_url, live_url, source_code_path, local_deploy_path, icon, product_program, build_mode, default_branch, workspace_id, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      product.id,
      product.name,
      product.description,
      product.repo_url,
      product.live_url,
      product.source_code_path,
      product.local_deploy_path,
      product.icon,
      product.product_program,
      product.build_mode,
      product.default_branch,
      product.workspace_id,
      product.status,
      product.created_at,
      product.updated_at,
    ]
  );

  return product;
}

export function getAutopilotProduct(id: string): AutopilotProduct | null {
  return queryOne<AutopilotProduct>(
    'SELECT * FROM autopilot_products WHERE id = ? AND status = ?',
    [id, 'active']
  ) ?? null;
}

export function listAutopilotProducts(workspaceId?: string): AutopilotProduct[] {
  if (workspaceId) {
    return queryAll<AutopilotProduct>(
      'SELECT * FROM autopilot_products WHERE workspace_id = ? AND status = ? ORDER BY created_at DESC',
      [workspaceId, 'active']
    );
  }
  return queryAll<AutopilotProduct>(
    'SELECT * FROM autopilot_products WHERE status = ? ORDER BY created_at DESC',
    ['active']
  );
}

export function updateAutopilotProduct(id: string, updates: Partial<AutopilotProduct>): AutopilotProduct | null {
  const existing = getAutopilotProduct(id);
  if (!existing) return null;

  const now = new Date().toISOString();
  const fields: string[] = [];
  const values: (string | number | null)[] = [];

  Object.entries(updates).forEach(([key, value]) => {
    if (key !== 'id' && key !== 'created_at' && value !== undefined) {
      fields.push(`${key} = ?`);
      values.push(value);
    }
  });

  if (fields.length === 0) return existing;

  fields.push('updated_at = ?');
  values.push(now);
  values.push(id);

  run(
    `UPDATE autopilot_products SET ${fields.join(', ')} WHERE id = ?`,
    values
  );

  return getAutopilotProduct(id);
}

export function archiveAutopilotProduct(id: string): boolean {
  const result = run(
    'UPDATE autopilot_products SET status = ?, updated_at = ? WHERE id = ?',
    ['archived', new Date().toISOString(), id]
  );
  return result.changes > 0;
}

export function deleteAutopilotProduct(id: string): boolean {
  const result = run(
    'DELETE FROM autopilot_products WHERE id = ?',
    [id]
  );
  return result.changes > 0;
}
