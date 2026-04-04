import { getDb } from '@/lib/db';
import { getOrCreateWatchdogSettings, addWatchdogLog, WatchdogSettings } from '@/lib/db/autopilot-watchdog';
import { getAutopilotProduct, AutopilotProduct } from '@/lib/db/autopilot-products';
import { getNextPendingTask, getCurrentTask, updateAutopilotTask, AutopilotTask, listAutopilotTasksByProduct } from '@/lib/db/autopilot-sprints-tasks';

// Lock para evitar ejecuciones paralelas del mismo producto
const executionLocks = new Map<string, boolean>();

interface ExecutionContext {
  product: AutopilotProduct;
  settings: WatchdogSettings;
  workspaceTasks: any[];
}

interface TaskCreationResult {
  success: boolean;
  taskId?: string;
  message: string;
  shouldStopWatchdog?: boolean;
}

/**
 * Ejecuta un ciclo completo del watchdog para un producto
 * Este método es el entry point principal
 */
export async function executeWatchdogCycle(productId: string): Promise<{
  success: boolean;
  message: string;
  details?: string;
}> {
  // Verificar lock para evitar paralelismo
  if (executionLocks.get(productId)) {
    return {
      success: false,
      message: 'Previous cycle still running',
      details: 'Watchdog cycle skipped due to active lock',
    };
  }

  executionLocks.set(productId, true);
  const startTime = Date.now();

  try {
    // Paso 1: Leer configuración
    const context = await loadExecutionContext(productId);
    if (!context) {
      return {
        success: false,
        message: 'Failed to load execution context',
        details: 'Could not retrieve product or settings',
      };
    }

    // Paso 2: Revisar tareas existentes en Mission Control
    const existingTaskCheck = await checkExistingTasks(context);
    if (!existingTaskCheck.shouldContinue) {
      return {
        success: true,
        message: existingTaskCheck.message,
        details: `Duration: ${Date.now() - startTime}ms`,
      };
    }

    // Paso 3: Crear nueva tarea
    const creationResult = await createNextTask(context);
    
    if (creationResult.shouldStopWatchdog) {
      return {
        success: true,
        message: creationResult.message,
        details: 'Watchdog paused - sprint boundary reached',
      };
    }

    if (!creationResult.success) {
      return {
        success: false,
        message: creationResult.message,
        details: 'Task creation failed',
      };
    }

    return {
      success: true,
      message: `Created task: ${creationResult.taskId}`,
      details: `Duration: ${Date.now() - startTime}ms`,
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[Watchdog ${productId}] Execution error:`, error);
    
    return {
      success: false,
      message: 'Watchdog execution failed',
      details: errorMessage,
    };
  } finally {
    executionLocks.delete(productId);
  }
}

/**
 * Carga el contexto de ejecución (producto + settings)
 */
async function loadExecutionContext(productId: string): Promise<ExecutionContext | null> {
  try {
    const product = getAutopilotProduct(productId);
    if (!product) {
      console.error(`[Watchdog ${productId}] Product not found`);
      return null;
    }

    const settings = getOrCreateWatchdogSettings(productId);
    
    // Cargar tareas del workspace
    const workspaceTasks = await fetchWorkspaceTasks(product.workspace_id || undefined);

    return { product, settings, workspaceTasks };
  } catch (error) {
    console.error(`[Watchdog ${productId}] Failed to load context:`, error);
    return null;
  }
}

/**
 * Obtiene las tareas del workspace desde Mission Control
 */
async function fetchWorkspaceTasks(workspaceId?: string): Promise<any[]> {
  if (!workspaceId) return [];
  
  try {
    const db = getDb();
    const tasks = db.prepare(
      `SELECT * FROM tasks WHERE workspace_id = ? ORDER BY created_at DESC LIMIT 100`
    ).all(workspaceId);
    return tasks || [];
  } catch (error) {
    console.error(`[Watchdog] Failed to fetch workspace tasks:`, error);
    return [];
  }
}

interface TaskCheckResult {
  shouldContinue: boolean;
  message: string;
}

/**
 * Paso 2: Revisa las tareas existentes y decide si continuar
 */
async function checkExistingTasks(context: ExecutionContext): Promise<TaskCheckResult> {
  const { settings, workspaceTasks } = context;

  // 2.1: Tareas en 'inbox' con agente asignado → pasar a 'assigned'
  const inboxTasks = workspaceTasks.filter(
    (t) => t.status === 'inbox' && t.assigned_agent_id
  );
  
  for (const task of inboxTasks) {
    try {
      await updateWorkspaceTaskStatus(task.id, 'assigned');
      console.log(`[Watchdog] Moved inbox task ${task.id} to assigned`);
    } catch (error) {
      console.error(`[Watchdog] Failed to move inbox task ${task.id}:`, error);
    }
  }

  if (inboxTasks.length > 0) {
    return {
      shouldContinue: false,
      message: `Processed ${inboxTasks.length} inbox tasks`,
    };
  }

  // 2.2: Tareas en 'assigned' estado 'stuck' con auto-nudge activado
  if (settings.auto_nudge_stuck) {
    const stuckTasks = workspaceTasks.filter(
      (t) => t.status === 'assigned' && t.is_stuck === 1
    );
    
    for (const task of stuckTasks) {
      try {
        await executeAutoNudge(task);
        console.log(`[Watchdog] Auto-nudged stuck task ${task.id}`);
      } catch (error) {
        console.error(`[Watchdog] Failed to nudge task ${task.id}:`, error);
      }
    }

    if (stuckTasks.length > 0) {
      return {
        shouldContinue: false,
        message: `Auto-nudged ${stuckTasks.length} stuck tasks`,
      };
    }
  }

  // 2.3: Verificar si hay tareas activas (no done)
  const activeStatuses = ['assigned', 'in_progress', 'convoy_active', 'testing', 'verification'];
  const activeTasks = workspaceTasks.filter((t) => activeStatuses.includes(t.status));

  if (activeTasks.length > 0) {
    return {
      shouldContinue: false,
      message: `${activeTasks.length} active tasks in progress`,
    };
  }

  // No hay tareas pendientes, continuar
  return {
    shouldContinue: true,
    message: 'No active tasks, ready to create new',
  };
}

/**
 * Actualiza el estado de una tarea en el workspace
 */
async function updateWorkspaceTaskStatus(taskId: string, newStatus: string): Promise<void> {
  const db = getDb();
  db.prepare(
    `UPDATE tasks SET status = ?, updated_at = datetime('now') WHERE id = ?`
  ).run(newStatus, taskId);
}

/**
 * Ejecuta auto-nudge para una tarea stuck
 */
async function executeAutoNudge(task: any): Promise<void> {
  // TODO: Implementar lógica de auto-nudge llamando al API de Mission Control
  // Por ahora solo logueamos
  console.log(`[Watchdog] Executing auto-nudge for task ${task.id}`);
}

/**
 * Obtiene el número de sprint para una tarea
 */
function getSprintNumberForTask(sprintId: string): number | null {
  try {
    const db = getDb();
    const result = db.prepare(
      'SELECT sprint_number FROM autopilot_sprints WHERE id = ?'
    ).get(sprintId) as { sprint_number: number } | undefined;
    return result?.sprint_number ?? null;
  } catch (error) {
    console.error(`[Watchdog] Failed to get sprint number:`, error);
    return null;
  }
}

/**
 * Paso 3: Crea la siguiente tarea desde Autopilot
 */
async function createNextTask(context: ExecutionContext): Promise<TaskCreationResult> {
  const { product, settings } = context;

  // 3.1: Obtener la siguiente tarea pendiente ordenada por sprint-tarea
  const nextTask = getNextPendingTaskOrdered(product.id);
  
  if (!nextTask) {
    return {
      success: false,
      message: 'No pending tasks available',
    };
  }

  // 3.2: Verificar si es cambio de sprint (y si debemos detener)
  if (settings.stop_on_sprint_finish) {
    const lastCreatedSprint = await getLastCreatedTaskSprint(product.id);
    const currentSprint = getSprintNumberForTask(nextTask.sprint_id);

    if (lastCreatedSprint !== null && currentSprint !== null && currentSprint > lastCreatedSprint) {
      // Cambio de sprint detectado, pausar watchdog
      return {
        success: false,
        message: `Sprint ${currentSprint} boundary reached`,
        shouldStopWatchdog: true,
      };
    }
  }

  // 3.3: Construir contexto de creación
  const creationContext = await buildTaskCreationContext(product, settings, nextTask);

  // 3.4: Verificar regression testing
  if (settings.regression_testing_enabled) {
    const shouldRunRegression = await checkRegressionTestingNeeded(context);
    
    if (shouldRunRegression) {
      const regressionResult = await createRegressionTestingTask(product, settings, creationContext);
      if (regressionResult.success) {
        // Notificar si está habilitado
        if (settings.notify_new_task) {
          await notifyTelegramNewTask(product, regressionResult.taskId!, 'Regression Testing');
        }
        return regressionResult;
      }
    }
  }

  // 3.5: Crear tarea normal
  const taskResult = await createMissionControlTask(product, nextTask, creationContext);
  
  if (taskResult.success) {
    // Actualizar BD Autopilot con fecha de inicio
    updateAutopilotTask(nextTask.id, { 
      status: 'in_progress',
      start_date: new Date().toISOString(),
    });

    // Notificar si está habilitado
    if (settings.notify_new_task) {
      await notifyTelegramNewTask(product, taskResult.taskId!, nextTask.title);
    }
  }

  return taskResult;
}

/**
 * Obtiene la siguiente tarea pendiente
 */
function getNextPendingTaskOrdered(productId: string): AutopilotTask | null {
  return getNextPendingTask(productId);
}

/**
 * Obtiene el sprint de la última tarea creada
 */
async function getLastCreatedTaskSprint(productId: string): Promise<number | null> {
  try {
    const db = getDb();
    const result = db.prepare(
      `SELECT s.sprint_number 
       FROM autopilot_tasks t
       JOIN autopilot_sprints s ON t.sprint_id = s.id
       WHERE t.product_id = ? AND t.status IN ('in_progress', 'done')
       ORDER BY t.start_date DESC
       LIMIT 1`
    ).get(productId) as { sprint_number: number } | undefined;
    
    return result?.sprint_number ?? null;
  } catch (error) {
    console.error(`[Watchdog] Failed to get last sprint:`, error);
    return null;
  }
}

/**
 * Construye el contexto para crear una tarea
 */
async function buildTaskCreationContext(
  product: AutopilotProduct,
  settings: WatchdogSettings,
  task: AutopilotTask
): Promise<string> {
  const parts: string[] = [];

  // Additional Prompt si existe
  if (settings.additional_prompt_task_creation) {
    parts.push(`## Additional Instructions\n${settings.additional_prompt_task_creation}`);
  }

  // Basic Info
  if (settings.include_basic_info && product.description) {
    parts.push(`## Product Basic Info\n${product.description}`);
  }

  // Product Program
  if (settings.include_product_program && product.product_program) {
    parts.push(`## Product Program\n${product.product_program}`);
  }

  // Executive Summary (resumido)
  if (settings.include_executive_summary && product.executive_summary) {
    const summary = await summarizeText(product.executive_summary, 500);
    parts.push(`## Executive Summary (Summary)\n${summary}`);
  }

  // Technical Architecture - solo stack tecnológico
  if (settings.include_technical_architecture && product.technical_architecture) {
    const stack = extractTechStack(product.technical_architecture);
    parts.push(`## Tech Stack\n${stack}`);
  }

  // Implementation Roadmap - solo sprint actual
  if (settings.include_implementation_roadmap && product.implementation_roadmap) {
    const sprintContent = extractSprintContent(product.implementation_roadmap);
    const devRules = extractDeveloperRules(product.implementation_roadmap);
    parts.push(`## Current Sprint\n${sprintContent}`);
    parts.push(`## DEVELOPER RULES (MANDATORY)\n${devRules}`);
  }

  // Referencias a documentos
  parts.push(`## Reference Documents
- Read and follow: IMPLEMENTATION_ROADMAP.md
- Read and follow: TECHNICAL_ARCHITECTURE.md
- Read and follow: DEVELOPER_RULES from IMPLEMENTATION_ROADMAP.md`);

  // Instrucciones específicas de la tarea
  parts.push(`## Task Details
Title: ${task.title}
Description: ${task.description_text || 'No description'}
Agent: ${task.agent_role}

## Instructions
- When moving to 'in progress', update status in database
- When moving to 'verification', deploy, start and test functionality
- When completed (moved to 'done'), update end timestamp and status
- Ensure no errors in logs after deployment`);

  return parts.join('\n\n---\n\n');
}

/**
 * Resume un texto a N caracteres
 */
async function summarizeText(text: string, maxLength: number): Promise<string> {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

/**
 * Extrae el stack tecnológico de la arquitectura
 */
function extractTechStack(architecture: string): string {
  // Buscar sección de stack tecnológico
  const stackMatch = architecture.match(/##?\s*(Tech Stack|Technology Stack|Stack|Technologies)[\s\S]*?(?=##?\s|$)/i);
  if (stackMatch) {
    return stackMatch[0].substring(0, 2000); // Limitar tamaño
  }
  // Si no hay sección específica, devolver primeras líneas
  return architecture.split('\n').slice(0, 30).join('\n');
}

/**
 * Extrae el contenido del sprint específico
 */
function extractSprintContent(roadmap: string): string {
  // Buscar sección del sprint (por número o ID)
  const sprintMatch = roadmap.match(/##?\s*Sprint\s*\d+[\s\S]*?(?=##?\s*Sprint|$)/i);
  if (sprintMatch) {
    return sprintMatch[0].substring(0, 3000);
  }
  return 'See IMPLEMENTATION_ROADMAP.md for current sprint details';
}

/**
 * Extrae las reglas de desarrollador del roadmap
 */
function extractDeveloperRules(roadmap: string): string {
  const rulesMatch = roadmap.match(/##?\s*(Developer Rules|Dev Rules|Coding Rules|Rules)[\s\S]*?(?=##?\s|$)/i);
  if (rulesMatch) {
    return rulesMatch[0];
  }
  return 'Follow best practices and project conventions. See IMPLEMENTATION_ROADMAP.md for DEVELOPER RULES.';
}

/**
 * Verifica si es necesario ejecutar regression testing
 */
async function checkRegressionTestingNeeded(context: ExecutionContext): Promise<boolean> {
  const { settings } = context;
  
  if (!settings.regression_testing_enabled) return false;

  // Verificar si la última tarea fue de regression testing
  const lastTask = await getLastCreatedTask(context.product.id);
  if (lastTask?.title?.includes('Regression Testing')) {
    return true; // Continuar con tarea normal después de regression
  }

  // Verificar por trigger configurado
  const trigger = settings.regression_trigger || 'sprint finish';
  
  // TODO: Implementar lógica de frecuencia (cada X tareas, cada X horas)
  // Por ahora solo verificamos por sprint finish
  if (trigger === 'sprint finish') {
    // Implementar lógica de sprint finish
    // Esto requeriría saber cuándo se completó el último sprint
  }
  
  return false;
}

/**
 * Obtiene la última tarea creada
 */
async function getLastCreatedTask(productId: string): Promise<AutopilotTask | null> {
  try {
    const db = getDb();
    return db.prepare(
      `SELECT t.* 
       FROM autopilot_tasks t
       WHERE t.product_id = ? AND t.status IN ('in_progress', 'done')
       ORDER BY t.start_date DESC
       LIMIT 1`
    ).get(productId) as AutopilotTask | undefined || null;
  } catch (error) {
    console.error(`[Watchdog] Failed to get last task:`, error);
    return null;
  }
}

/**
 * Crea una tarea de regression testing
 */
async function createRegressionTestingTask(
  product: AutopilotProduct,
  settings: WatchdogSettings,
  context: string
): Promise<TaskCreationResult> {
  // Generar número de regression testing
  const regressionCount = await getRegressionTestingCount(product.id);
  const title = `Regression Testing #${regressionCount + 1}`;

  const fullContext = `${context}\n\n## Regression Testing Instructions\nStop current services, compile/deploy/start, test full functionality (API/UI/Browser).\nCheck console logs and UI for errors. Fix any issues found iteratively until all tests pass.`;

  try {
    const taskId = await createMissionControlTaskDirect({
      title,
      description: fullContext,
      status: 'assigned',
      priority: 'urgent',
      assigned_agent_id: settings.assigned_agents ? JSON.parse(settings.assigned_agents)[0]?.agent_id : undefined,
      workspace_path: product.source_code_path || undefined,
    });

    return {
      success: true,
      taskId,
      message: `Created regression testing task: ${title}`,
    };
  } catch (error) {
    console.error(`[Watchdog] Failed to create regression task:`, error);
    return {
      success: false,
      message: 'Failed to create regression testing task',
    };
  }
}

/**
 * Obtiene el conteo de regression tests previos
 */
async function getRegressionTestingCount(productId: string): Promise<number> {
  try {
    const db = getDb();
    const result = db.prepare(
      `SELECT COUNT(*) as count
       FROM tasks t
       JOIN autopilot_products p ON p.workspace_id = t.workspace_id
       WHERE p.id = ?
       AND t.title LIKE 'Regression Testing%'`
    ).get(productId) as { count: number };
    return result?.count || 0;
  } catch (error) {
    console.error('[Watchdog] Failed to count regression tests:', error);
    return 0;
  }
}

/**
 * Crea una tarea normal en Mission Control
 */
async function createMissionControlTask(
  product: AutopilotProduct,
  autopilotTask: AutopilotTask,
  context: string
): Promise<TaskCreationResult> {
  try {
    const taskId = await createMissionControlTaskDirect({
      title: autopilotTask.title,
      description: `${autopilotTask.description_text || ''}\n\n${context}`,
      status: 'assigned',
      priority: 'urgent',
      assigned_agent_id: autopilotTask.agent_role, // Using agent_role as identifier
      workspace_path: product.source_code_path || undefined,
    });

    return {
      success: true,
      taskId,
      message: `Created task: ${autopilotTask.title}`,
    };
  } catch (error) {
    console.error(`[Watchdog] Failed to create task:`, error);
    return {
      success: false,
      message: 'Failed to create mission control task',
    };
  }
}

interface CreateTaskParams {
  title: string;
  description: string;
  status: string;
  priority: string;
  assigned_agent_id?: string;
  workspace_path?: string;
}

/**
 * Crea una tarea directamente en Mission Control
 */
async function createMissionControlTaskDirect(params: CreateTaskParams): Promise<string> {
  const db = getDb();
  const { v4: uuidv4 } = await import('uuid');
  
  const taskId = uuidv4();
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO tasks (
      id, title, description, status, priority, 
      assigned_agent_id, workspace_path, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    taskId,
    params.title,
    params.description,
    params.status,
    params.priority,
    params.assigned_agent_id || null,
    params.workspace_path || null,
    now,
    now
  );

  return taskId;
}

/**
 * Notifica por Telegram sobre nueva tarea
 */
async function notifyTelegramNewTask(
  product: AutopilotProduct,
  taskId: string,
  taskTitle: string
): Promise<void> {
  try {
    // TODO: Implementar integración con Telegram
    console.log(`[Watchdog] Telegram notification: New task "${taskTitle}" in ${product.name}`);
    
    // Aquí iría la llamada al API de OpenClaw Gateway o Telegram Bot
    // await fetch('/api/notify/telegram', { ... });
  } catch (error) {
    console.error(`[Watchdog] Failed to send Telegram notification:`, error);
  }
}
