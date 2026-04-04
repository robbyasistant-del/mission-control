import { queryOne, queryAll, run } from './index';
import { v4 as uuidv4 } from 'uuid';

export interface AutopilotSprint {
  id: string;
  product_id: string;
  sprint_number: number;
  phase_name: string;
  phase_number: number;
  functionality_analysis: string | null;
  features_description: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  tasks?: AutopilotTask[];
}

export interface AutopilotTask {
  id: string;
  sprint_id: string;
  product_id: string;
  task_number: number;
  agent_role: string;
  agent_name: string | null;
  start_date: string | null;
  end_date: string | null;
  status: 'pending' | 'in_progress' | 'blocked' | 'testing' | 'done';
  title: string;
  description_text: string | null;
  deliverables: string | null;
  quality_criteria: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateSprintInput {
  product_id: string;
  sprint_number: number;
  phase_name: string;
  phase_number: number;
  functionality_analysis?: string;
  features_description?: string;
}

export interface CreateTaskInput {
  sprint_id: string;
  product_id: string;
  task_number: number;
  agent_role: string;
  agent_name?: string;
  start_date?: string;
  end_date?: string;
  status?: 'pending' | 'in_progress' | 'blocked' | 'testing' | 'done';
  title: string;
  description_text?: string;
  deliverables?: string;
  quality_criteria?: string;
}

export function createAutopilotSprint(input: CreateSprintInput): AutopilotSprint {
  const now = new Date().toISOString();
  const id = uuidv4();

  run(
    `INSERT INTO autopilot_sprints (id, product_id, sprint_number, phase_name, phase_number, functionality_analysis, features_description, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.product_id,
      input.sprint_number,
      input.phase_name,
      input.phase_number,
      input.functionality_analysis ?? null,
      input.features_description ?? null,
      now,
      now,
    ]
  );

  return {
    id,
    product_id: input.product_id,
    sprint_number: input.sprint_number,
    phase_name: input.phase_name,
    phase_number: input.phase_number,
    functionality_analysis: input.functionality_analysis ?? null,
    features_description: input.features_description ?? null,
    created_at: now,
    updated_at: now,
  };
}

export function createAutopilotTask(input: CreateTaskInput): AutopilotTask {
  const now = new Date().toISOString();
  const id = uuidv4();

  run(
    `INSERT INTO autopilot_tasks (id, sprint_id, product_id, task_number, agent_role, agent_name, start_date, end_date, status, title, description_text, deliverables, quality_criteria, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.sprint_id,
      input.product_id,
      input.task_number,
      input.agent_role,
      input.agent_name ?? null,
      input.start_date ?? null,
      input.end_date ?? null,
      input.status ?? 'pending',
      input.title,
      input.description_text ?? null,
      input.deliverables ?? null,
      input.quality_criteria ?? null,
      now,
      now,
    ]
  );

  return {
    id,
    sprint_id: input.sprint_id,
    product_id: input.product_id,
    task_number: input.task_number,
    agent_role: input.agent_role,
    agent_name: input.agent_name ?? null,
    start_date: input.start_date ?? null,
    end_date: input.end_date ?? null,
    status: input.status ?? 'pending',
    title: input.title,
    description_text: input.description_text ?? null,
    deliverables: input.deliverables ?? null,
    quality_criteria: input.quality_criteria ?? null,
    created_at: now,
    updated_at: now,
  };
}

export function getAutopilotSprint(id: string): AutopilotSprint | null {
  return queryOne<AutopilotSprint>('SELECT * FROM autopilot_sprints WHERE id = ?', [id]) ?? null;
}

export function getAutopilotTask(id: string): AutopilotTask | null {
  return queryOne<AutopilotTask>('SELECT * FROM autopilot_tasks WHERE id = ?', [id]) ?? null;
}

export function listAutopilotSprints(productId: string): AutopilotSprint[] {
  return queryAll<AutopilotSprint>(
    'SELECT * FROM autopilot_sprints WHERE product_id = ? ORDER BY sprint_number ASC',
    [productId]
  );
}

export function listAutopilotTasks(sprintId: string): AutopilotTask[] {
  return queryAll<AutopilotTask>(
    'SELECT * FROM autopilot_tasks WHERE sprint_id = ? ORDER BY task_number ASC',
    [sprintId]
  );
}

export function listAutopilotTasksByProduct(productId: string): AutopilotTask[] {
  return queryAll<AutopilotTask>(
    'SELECT * FROM autopilot_tasks WHERE product_id = ? ORDER BY sprint_id, task_number ASC',
    [productId]
  );
}

export function updateAutopilotTask(id: string, updates: Partial<AutopilotTask>): AutopilotTask | null {
  const existing = getAutopilotTask(id);
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
    `UPDATE autopilot_tasks SET ${fields.join(', ')} WHERE id = ?`,
    values
  );

  return getAutopilotTask(id);
}

export function deleteAutopilotSprint(id: string): boolean {
  const result = run('DELETE FROM autopilot_sprints WHERE id = ?', [id]);
  return result.changes > 0;
}

export function deleteAutopilotTasksByProduct(productId: string): boolean {
  const result = run('DELETE FROM autopilot_tasks WHERE product_id = ?', [productId]);
  return result.changes > 0;
}

export function deleteAutopilotSprintsByProduct(productId: string): boolean {
  const result = run('DELETE FROM autopilot_sprints WHERE product_id = ?', [productId]);
  return result.changes > 0;
}

export function getSprintsWithTasks(productId: string): AutopilotSprint[] {
  const sprints = listAutopilotSprints(productId);
  return sprints.map(sprint => ({
    ...sprint,
    tasks: listAutopilotTasks(sprint.id),
  }));
}
