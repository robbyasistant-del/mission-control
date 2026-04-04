/**
 * Autopilot Prompts - Database Module
 * 
 * Stores LLM prompts and their configurations for Autopilot workflows.
 */

import { getDb } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

export interface AutopilotPrompt {
  id: string;
  product_id: string;
  prompt_key: string;           // e.g., 'product-program', 'executive-summary', etc.
  prompt_text: string;          // The full prompt template
  model: string;                // LLM model to use
  temperature: number;          // 0.0 - 2.0
  max_tokens: number;           // Max output tokens
  timeout_ms: number;           // Timeout in milliseconds
  system_prompt?: string;       // Optional system prompt
  is_enabled: boolean;          // Whether this prompt is active
  created_at: string;
  updated_at: string;
}

export interface AutopilotPromptInput {
  prompt_text?: string;
  model?: string;
  temperature?: number;
  max_tokens?: number;
  timeout_ms?: number;
  system_prompt?: string;
  is_enabled?: boolean;
}

// Default prompts from files - keys must match filenames
export const PROMPT_KEYS = [
  'product-program',
  'executive-summary',
  'technical-architecture',
  'implementation-roadmap',
  'watchdog-task-description',
  'research-cycle',
  'ideation-cycle',
] as const;

export type PromptKey = typeof PROMPT_KEYS[number];

// Default configurations for each prompt type
export const DEFAULT_PROMPT_CONFIGS: Record<PromptKey, {
  model: string;
  temperature: number;
  max_tokens: number;
  timeout_ms: number;
  system_prompt?: string;
}> = {
  'product-program': {
    model: 'openclaw',
    temperature: 0.7,
    max_tokens: 2048,
    timeout_ms: 120000,
    system_prompt: 'You are a product requirements specialist. Create concise, practical PRDs with maximum 3 items per section.',
  },
  'executive-summary': {
    model: 'anthropic/claude-sonnet-4-6',
    temperature: 0.7,
    max_tokens: 4096,
    timeout_ms: 300000,
    system_prompt: 'You are an expert product strategist. Create concise, actionable executive summaries.',
  },
  'technical-architecture': {
    model: 'openclaw',
    temperature: 0.7,
    max_tokens: 8000,
    timeout_ms: 300000,
    system_prompt: 'You are a software architect. Generate complete technical documentation with all requested sections. Never stop after section 1.',
  },
  'implementation-roadmap': {
    model: 'openclaw',
    temperature: 0.7,
    max_tokens: 12000,
    timeout_ms: 300000,
    system_prompt: 'You are a project manager specialized in software development roadmaps. Create detailed, actionable implementation plans with clear sprint breakdowns. Always provide complete content, never stop mid-section.',
  },
  'watchdog-task-description': {
    model: 'openclaw',
    temperature: 0.3,
    max_tokens: 4000,
    timeout_ms: 300000,
    system_prompt: 'You are a technical project manager creating clear, actionable task descriptions for developers.',
  },
  'research-cycle': {
    model: 'openclaw',
    temperature: 0.7,
    max_tokens: 4096,
    timeout_ms: 300000,
    system_prompt: 'You are a product research agent. Analyze the product and respond with a JSON research report only.',
  },
  'ideation-cycle': {
    model: 'openclaw',
    temperature: 0.7,
    max_tokens: 4096,
    timeout_ms: 300000,
    system_prompt: 'You are a product ideation agent. Respond with a JSON array of idea objects only.',
  },
};

/**
 * Ensure autopilot_prompts table exists
 */
export function ensureAutopilotPromptsTable(): void {
  const db = getDb();
  
  db.exec(`
    CREATE TABLE IF NOT EXISTS autopilot_prompts (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL,
      prompt_key TEXT NOT NULL,
      prompt_text TEXT NOT NULL,
      model TEXT NOT NULL DEFAULT 'openclaw',
      temperature REAL NOT NULL DEFAULT 0.7,
      max_tokens INTEGER NOT NULL DEFAULT 4096,
      timeout_ms INTEGER NOT NULL DEFAULT 300000,
      system_prompt TEXT,
      is_enabled INTEGER NOT NULL DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      UNIQUE(product_id, prompt_key)
    );
  `);

  // Create index for faster lookups
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_autopilot_prompts_product_key 
    ON autopilot_prompts(product_id, prompt_key);
  `);
}

/**
 * Get a prompt by product and key
 */
export function getAutopilotPrompt(productId: string, promptKey: PromptKey): AutopilotPrompt | null {
  ensureAutopilotPromptsTable();
  
  const db = getDb();
  return db.prepare(
    `SELECT * FROM autopilot_prompts WHERE product_id = ? AND prompt_key = ?`
  ).get(productId, promptKey) as AutopilotPrompt | null;
}

/**
 * Get all prompts for a product
 */
export function getAutopilotPromptsByProduct(productId: string): AutopilotPrompt[] {
  ensureAutopilotPromptsTable();
  
  const db = getDb();
  return db.prepare(
    `SELECT * FROM autopilot_prompts WHERE product_id = ? ORDER BY prompt_key`
  ).all(productId) as AutopilotPrompt[];
}

/**
 * Create or update a prompt
 */
export function upsertAutopilotPrompt(
  productId: string,
  promptKey: PromptKey,
  input: AutopilotPromptInput
): AutopilotPrompt {
  ensureAutopilotPromptsTable();
  
  const db = getDb();
  const now = new Date().toISOString();

  // Check if exists
  const existing = db.prepare(
    `SELECT id FROM autopilot_prompts WHERE product_id = ? AND prompt_key = ?`
  ).get(productId, promptKey) as { id: string } | null;

  if (existing) {
    // Update
    const fields: string[] = [];
    const values: any[] = [];

    if (input.prompt_text !== undefined) {
      fields.push('prompt_text = ?');
      values.push(input.prompt_text);
    }
    if (input.model !== undefined) {
      fields.push('model = ?');
      values.push(input.model);
    }
    if (input.temperature !== undefined) {
      fields.push('temperature = ?');
      values.push(input.temperature);
    }
    if (input.max_tokens !== undefined) {
      fields.push('max_tokens = ?');
      values.push(input.max_tokens);
    }
    if (input.timeout_ms !== undefined) {
      fields.push('timeout_ms = ?');
      values.push(input.timeout_ms);
    }
    if (input.system_prompt !== undefined) {
      fields.push('system_prompt = ?');
      values.push(input.system_prompt);
    }
    if (input.is_enabled !== undefined) {
      fields.push('is_enabled = ?');
      values.push(input.is_enabled ? 1 : 0);
    }

    fields.push('updated_at = ?');
    values.push(now);
    values.push(existing.id);

    db.prepare(
      `UPDATE autopilot_prompts SET ${fields.join(', ')} WHERE id = ?`
    ).run(...values);

    return getAutopilotPrompt(productId, promptKey)!;
  } else {
    // Insert
    const defaults = DEFAULT_PROMPT_CONFIGS[promptKey];
    const id = uuidv4();

    db.prepare(
      `INSERT INTO autopilot_prompts (
        id, product_id, prompt_key, prompt_text, model, temperature,
        max_tokens, timeout_ms, system_prompt, is_enabled, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      productId,
      promptKey,
      input.prompt_text ?? '',
      input.model ?? defaults.model,
      input.temperature ?? defaults.temperature,
      input.max_tokens ?? defaults.max_tokens,
      input.timeout_ms ?? defaults.timeout_ms,
      input.system_prompt ?? defaults.system_prompt ?? null,
      input.is_enabled !== undefined ? (input.is_enabled ? 1 : 0) : 1,
      now,
      now
    );

    return getAutopilotPrompt(productId, promptKey)!;
  }
}

/**
 * Reset a prompt to default (from file)
 */
export function resetAutopilotPromptToDefault(
  productId: string,
  promptKey: PromptKey,
  defaultPromptText: string
): AutopilotPrompt {
  const defaults = DEFAULT_PROMPT_CONFIGS[promptKey];
  
  return upsertAutopilotPrompt(productId, promptKey, {
    prompt_text: defaultPromptText,
    model: defaults.model,
    temperature: defaults.temperature,
    max_tokens: defaults.max_tokens,
    timeout_ms: defaults.timeout_ms,
    system_prompt: defaults.system_prompt,
    is_enabled: true,
  });
}

/**
 * Initialize default prompts for a product from files
 */
export async function initializeDefaultPromptsForProduct(
  productId: string,
  promptsDir: string = 'prompts'
): Promise<void> {
  const fs = await import('fs');
  const path = await import('path');
  
  for (const promptKey of PROMPT_KEYS) {
    const filename = `${promptKey}.md`;
    const filepath = path.join(process.cwd(), promptsDir, filename);
    
    try {
      const content = fs.readFileSync(filepath, 'utf-8');
      // Extract prompt text from markdown (content after ## Prompt Template)
      const match = content.match(/## Prompt Template\s*```\s*([\s\S]*?)\s*```/);
      const promptText = match ? match[1].trim() : content;
      
      // Only create if doesn't exist
      const existing = getAutopilotPrompt(productId, promptKey);
      if (!existing) {
        resetAutopilotPromptToDefault(productId, promptKey, promptText);
        console.log(`[Prompts] Initialized ${promptKey} for product ${productId}`);
      }
    } catch (error) {
      console.error(`[Prompts] Failed to load ${filename}:`, error);
    }
  }
}