import { z } from 'zod';

// Agent IDs can be: UUIDs, 32-char hex strings, or gateway-imported identifiers (alphanumeric with underscores/hyphens)
const agentId = z.string()
  .min(1, 'Agent ID cannot be empty')
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$|^[0-9a-f]{32}$|^[a-z0-9_-]+$/i, 'Must be a valid agent ID (UUID, hex, or identifier with underscores/hyphens)');

// Task status and priority enums from types
const TaskStatus = z.enum([
  'pending_dispatch',
  'planning',
  'inbox',
  'assigned',
  'dispatched',
  'in_progress',
  'convoy_active',
  'testing',
  'review',
  'verification',
  'done'
]);

const TaskPriority = z.enum(['low', 'normal', 'high', 'urgent']);

const ActivityType = z.enum([
  'spawned',
  'updated',
  'completed',
  'file_created',
  'status_changed'
]);

const DeliverableType = z.enum(['file', 'url', 'artifact']);

// Task validation schemas
export const CreateTaskSchema = z.object({
  title: z.string().min(1, 'Title is required').max(500, 'Title must be 500 characters or less'),
  description: z.string().max(10000, 'Description must be 10000 characters or less').optional(),
  status: TaskStatus.optional(),
  priority: TaskPriority.optional(),
  assigned_agent_id: z.preprocess(
    (val) => (val === '' ? null : val),
    z.union([agentId, z.null()]).optional()
  ),
  created_by_agent_id: z.preprocess(
    (val) => (val === '' ? null : val),
    z.union([agentId, z.null()]).optional()
  ),
  business_id: z.string().optional(),
  workspace_id: z.string().optional(),
  due_date: z.string().optional().nullable(),
});

export const UpdateTaskSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(10000).optional(),
  status: TaskStatus.optional(),
  priority: TaskPriority.optional(),
  assigned_agent_id: z.preprocess(
    (val) => (val === '' ? null : val),
    z.union([agentId, z.null()]).optional()
  ),
  workflow_template_id: z.string().optional().nullable(),
  due_date: z.string().optional().nullable(),
  updated_by_agent_id: z.preprocess(
    (val) => (val === '' ? null : val),
    z.union([agentId, z.null()]).optional()
  ),
  status_reason: z.string().max(2000).optional(),
  board_override: z.boolean().optional(),
  override_reason: z.string().max(2000).optional(),
  pr_url: z.string().url().optional().nullable(),
  pr_status: z.enum(['pending', 'open', 'merged', 'closed']).optional(),
});

// Activity validation schema
export const CreateActivitySchema = z.object({
  activity_type: ActivityType,
  message: z.string().min(1, 'Message is required').max(5000, 'Message must be 5000 characters or less'),
  agent_id: z.preprocess(
    (val) => (val === '' ? null : val),
    z.union([agentId, z.null()]).optional()
  ),
  metadata: z.string().optional(),
});

// Deliverable validation schema
export const CreateDeliverableSchema = z.object({
  deliverable_type: DeliverableType,
  title: z.string().min(1, 'Title is required'),
  path: z.string().optional(),
  description: z.string().optional(),
});

// Product Autopilot validation schemas

const IdeaCategory = z.enum([
  'feature', 'improvement', 'ux', 'performance', 'integration',
  'infrastructure', 'content', 'growth', 'monetization', 'operations', 'security'
]);

const IdeaComplexity = z.enum(['S', 'M', 'L', 'XL']);

const SwipeAction = z.enum(['approve', 'reject', 'maybe', 'fire']);

const CostCapType = z.enum(['per_cycle', 'per_task', 'daily', 'monthly', 'per_product_monthly']);

const CostEventType = z.enum([
  'agent_dispatch', 'research_cycle', 'ideation_cycle', 'build_task',
  'content_generation', 'seo_analysis', 'web_search', 'external_api'
]);

const ProductStatus = z.enum(['active', 'paused', 'archived']);

export const CreateProductSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  description: z.string().max(5000).optional(),
  status: ProductStatus.optional(),
  cost_cap_amount: z.number().min(0).optional(),
  cost_cap_type: CostCapType.optional(),
});

export const UpdateProductSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(5000).optional(),
  status: ProductStatus.optional(),
  cost_cap_amount: z.number().min(0).optional(),
  cost_cap_type: CostCapType.optional(),
});

export const CreateIdeaSchema = z.object({
  title: z.string().min(1, 'Title is required').max(300),
  description: z.string().max(5000).optional().default(''),
  category: IdeaCategory,
  complexity: IdeaComplexity.optional(),
});

export const UpdateIdeaSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  description: z.string().max(5000).optional(),
  category: IdeaCategory.optional(),
  complexity: IdeaComplexity.optional(),
  swipe_status: SwipeAction.optional(),
  swipe_reason: z.string().max(1000).optional(),
});

export const SwipeIdeaSchema = z.object({
  action: SwipeAction,
  reason: z.string().max(1000).optional(),
});

export const CostEventSchema = z.object({
  event_type: CostEventType,
  cost_usd: z.number().min(0),
  description: z.string().max(500).optional(),
  metadata: z.string().optional(),
});

// Cost Caps validation schemas
export const CreateCostCapSchema = z.object({
  product_id: z.string(),
  cap_type: CostCapType,
  limit_usd: z.number().min(0),
  period_start: z.string().optional(),
  period_end: z.string().optional(),
});

export const UpdateCostCapSchema = z.object({
  cap_type: CostCapType.optional(),
  limit_usd: z.number().min(0).optional(),
  period_start: z.string().optional(),
  period_end: z.string().optional(),
});

// Cost Event validation schema (alias for compatibility)
export const CreateCostEventSchema = CostEventSchema;

// Schedule validation schemas
export const CreateScheduleSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  schedule_type: z.string().min(1),
  cron_expression: z.string().min(1, 'Cron expression is required'),
  timezone: z.string().optional(),
  enabled: z.boolean().optional(),
  config: z.string().optional(),
});

export const UpdateScheduleSchema = z.object({
  name: z.string().min(1).optional(),
  schedule_type: z.string().min(1).optional(),
  cron_expression: z.string().min(1).optional(),
  timezone: z.string().optional(),
  enabled: z.boolean().optional(),
  config: z.string().optional(),
});

// Swipe validation schema
export const SwipeActionSchema = z.object({
  idea_id: z.string(),
  action: SwipeAction,
  reason: z.string().max(1000).optional(),
});
