# Mission Control - Workflow de Tareas: Análisis Detallado

## 📊 DIAGRAMA DE ESTADOS Y TRANSICIONES

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                           WORKFLOW DE TAREAS MISSION CONTROL                              │
└─────────────────────────────────────────────────────────────────────────────────────────┘

ESTADOS PRINCIPALES:
╔════════════════╦════════════════════════════════════════════════════════════════════════╗
║    ESTADO      ║                         DESCRIPCIÓN                                     ║
╠════════════════╬════════════════════════════════════════════════════════════════════════╣
║ inbox          ║ Tarea creada, pendiente de asignación                                  ║
║ assigned       ║ Asignada a agente, esperando dispatch                                  ║
║ in_progress    ║ Agente trabajando en la tarea                                          ║
║ convoy_active  ║ Tarea en modo convoy (múltiples agentes)                               ║
║ testing        ║ En fase de testing/QA                                                  ║
║ review         ║ En revisión de código/documentación                                    ║
║ verification   ║ Verificación final antes de done                                       ║
║ done           ║ Tarea completada                                                       ║
║ pending_dispatch║ Esperando planificación antes de asignar                              ║
║ planning       ║ En fase de planificación multi-agente                                  ║
╚════════════════╩════════════════════════════════════════════════════════════════════════╝

TRANSICIONES DE ESTADO:
═══════════════════════════════════════════════════════════════════════════════════════════

[CREACIÓN] → inbox/assigned
    └─> Si tiene assigned_agent_id → assigned
    └─> Si no → inbox (espera asignación dinámica)

[inbox] ──► [assigned]
    Trigger: Tarea asignada a agente (automático o manual)
    Condición: assigned_agent_id != NULL
    
[assigned] ──► [in_progress]
    Trigger: POST /api/tasks/{id}/dispatch exitoso
    Actor: Dispatch route
    Acción: Mensaje enviado a sesión OpenClaw del agente

[in_progress] ──► [testing|review|verification]
    Trigger: Agente actualiza status vía API PATCH
    Condición: workflow template definido
    Actor: Agente llama a /api/tasks/{id} con nuevo status

[in_progress] ──► [done]
    Trigger: Agente marca como completado
    Condición: POST /api/tasks/{id}/complete o PATCH status="done"
    Acción: Se dispara drainQueue() para siguiente tarea en cola

[testing|verification] ──► [in_progress]
    Trigger: Fallo en testing (handleStageFailure)
    Condición: workflow.fail_targets[status] definido
    Acción: Vuelve a builder con contexto del fallo

[any] ──► [assigned]
    Trigger: Health monitor detecta "zombie" o "stuck"
    Condición: >15min sin actividad + reintentos fallidos
    Acción: Re-dispatch con checkpoint context

═══════════════════════════════════════════════════════════════════════════════════════════
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                           WATCHDOG / HEALTH MONITOR                                     │
└─────────────────────────────────────────────────────────────────────────────────────────┘

CICLO DE HEALTH CHECK (cada 2 minutos aprox):
═══════════════════════════════════════════════════════════════════════════════════════════

1. SCAN AGENTES ACTIVOS
   └─> SELECT DISTINCT assigned_agent_id FROM tasks 
       WHERE status IN ('assigned', 'in_progress', 'testing', 'verification')

2. EVALUAR ESTADO DE SALUD POR AGENTE (checkAgentHealth):
   
   ┌─────────────────────────────────────────────────────────────────────────────────┐
   │  ESTADOS DE SALUD                                                               │
   ├─────────────────────────────────────────────────────────────────────────────────┤
   │  • working   → Actividad reciente (<5 min) ✓                                   │
   │  • stalled   → Sin actividad 5-15 min ⚠️                                       │
   │  • stuck     → Sin actividad >15 min ⚠️⚠️                                      │
   │  • zombie    → Sin sesión OpenClaw activa 🧟                                    │
   │  • idle      → Sin tarea activa                                                 │
   │  • offline   → Agente marcado como offline                                      │
   └─────────────────────────────────────────────────────────────────────────────────┘

3. CONDICIONES DE TRANSICIÓN DE SALUD:
   
   STALL (stalled):
   └─> Última actividad > STALL_THRESHOLD_MINUTES (5 min)
   └─> Log: "Agent health: stalled"
   └─> Incrementa consecutive_stall_checks
   
   STUCK:
   └─> Última actividad > STUCK_THRESHOLD_MINUTES (15 min)
   └─> Log: "Agent health: stuck"
   └─> consecutive_stall_checks >= AUTO_NUDGE_AFTER_STALLS (3)
   
   ZOMBIE:
   └─> No existe openclaw_sessions.status='active' para el agente
   └─> Sesión muerta pero tarea sigue asignada

4. AUTO-NUDGE (Recuperación automática):
   
   Trigger: consecutive_stall_checks >= 3 Y estado = 'stuck'
   
   Acción nudgeAgent(agentId):
   ├─> 1. Verificar/crear sesión OpenClaw
   ├─> 2. Construir checkpoint context (qué se hizo hasta ahora)
   ├─> 3. Re-dispatch con contexto de recuperación
   └─> 4. Log: "Agent nudged — re-dispatching with checkpoint context"

5. SWEEP DE TAREAS HUÉRFANAS (Orphaned Tasks):
   
   Condición:
   └─> status = 'assigned' 
   └─> planning_complete = 1
   └─> updated_at > 2 minutos
   
   Acción:
   └─> Auto-dispatch: POST /api/tasks/{id}/dispatch
   └─> Log: "Auto-dispatched by health sweeper (was stuck in assigned)"

═══════════════════════════════════════════════════════════════════════════════════════════
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                           DISPATCH FLOW                                                 │
└─────────────────────────────────────────────────────────────────────────────────────────┘

POST /api/tasks/{id}/dispatch
═══════════════════════════════════════════════════════════════════════════════════════════

1. SYNC AGENT CATALOG
   └─> syncGatewayAgentsToCatalog() - Actualiza catálogo desde OpenClaw Gateway

2. RESOLVE AGENTE
   ├─> Si task.assigned_agent_id existe → usar ese
   └─> Si no → pickDynamicAgent(role) basado en status/rol

3. VALIDACIÓN
   ├─> ¿Task existe? → 404 si no
   ├─> ¿Agente existe? → 404 si no
   └─> ¿Agente es master con otros orchestrators? → 409 Conflict (warning)

4. CONEXIÓN OPENCLAW
   ├─> getOpenClawClient().connect()
   ├─> Si falla → forceReconnect() → 503

5. GESTIÓN DE SESIÓN
   ├─> Buscar sesión activa: openclaw_sessions WHERE agent_id=? AND status='active'
   ├─> Si no existe → Crear nueva sesión persistente
   └─> sessionKey = `{prefix}{openclaw_session_id}`

6. WORKSPACE ISOLATION (solo builder dispatch)
   ├─> determineIsolationStrategy(task) → worktree|sandbox|null
   ├─> Si estrategia existe → createTaskWorkspace(task)
   └─> Devuelve: path, port, branch name

7. CONSTRUIR MENSAJE PARA AGENTE
   Componentes:
   ├─> Priority emoji (🔴 urgent, 🟡 high, ⚪ normal, 🔵 low)
   ├─> Título y descripción
   ├─> Planning spec (si existe)
   ├─> Agent instructions (de planning_agents JSON)
   ├─> Skills matched (proven procedures)
   ├─> Relevant knowledge (from learner)
   ├─> Checkpoint context (what was done before)
   ├─> Output directory (workspace path)
   ├─> Completion instructions (API calls agent must make)
   │   ├─> Builder: activities + deliverables + status PATCH
   │   ├─> Tester: TEST_PASS/TEST_FAIL + status PATCH
   │   └─> Verifier: VERIFY_PASS/VERIFY_FAIL + status PATCH
   ├─> Repository info (if repo_url exists)
   ├─> Isolation warnings ("do NOT modify files outside")
   ├─> Reference images (if any)
   └─> Agent identity context (soul_md, user_md, agents_md)

8. ENVIAR MENSAJE
   └─> client.call('chat.send', { sessionKey, message, idempotencyKey })

9. ACTUALIZAR ESTADOS
   ├─> Task: status = 'in_progress' (si estaba 'assigned')
   ├─> Agent: status = 'working'
   ├─> Log event: 'task_dispatched'
   └─> Log activity: "Task dispatched to {agent_name}"

10. BROADCAST
    └─> broadcast({ type: 'task_updated', payload: task })

11. MANEJO DE ERRORES
    └─> Si falla envío → forceReconnect() + reset task a 'assigned'
    └─> planning_dispatch_error = error message

═══════════════════════════════════════════════════════════════════════════════════════════
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                           WORKFLOW TEMPLATE ENGINE                                      │
└─────────────────────────────────────────────────────────────────────────────────────────┘

ESTRUCTURA WORKFLOW TEMPLATE:
═══════════════════════════════════════════════════════════════════════════════════════════

{
  "id": "uuid",
  "name": "Standard Development",
  "stages": [
    { "status": "in_progress", "label": "Build", "role": "builder" },
    { "status": "testing", "label": "Test", "role": "tester" },
    { "status": "review", "label": "Review", "role": null },      // Queue stage
    { "status": "verification", "label": "Verify", "role": "reviewer" },
    { "status": "done", "label": "Done", "role": null }
  ],
  "fail_targets": {
    "testing": "in_progress",        // Test fail → back to builder
    "verification": "in_progress"    // Verify fail → back to builder
  }
}

HANDLE STAGE TRANSITION:
═══════════════════════════════════════════════════════════════════════════════════════════

1. Obtener workflow template
2. Buscar stage que corresponda al nuevo status
3. Si stage.role existe → Handoff a agente con ese rol
   └─> Buscar en task_roles → asignar_agent_id → dispatch
4. Si stage.role es null y no es 'done' → Queue stage
   └─> drainQueue() para auto-avanzar si siguiente stage está libre

DRAIN QUEUE:
════════════

Cuando una tarea entra en queue stage (role=null):
├─> Buscar siguiente stage con role
├─> Verificar si hay tarea ocupando ese stage
└─> Si libre → auto-avanzar tarea más antigua de la cola

═══════════════════════════════════════════════════════════════════════════════════════════
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                           PROBLEMAS IDENTIFICADOS Y SOLUCIONES                          │
└─────────────────────────────────────────────────────────────────────────────────────────┘

PROBLEMA 1: Agente marca "completed" pero no actualiza status
═══════════════════════════════════════════════════════════════════════════════════════════
Síntoma: Activity log muestra "completed", pero task.status sigue "in_progress"
Causa: Agente no llama a PATCH /api/tasks/{id} con status="done"

Solución implementada en Heartbeat:
├─> Detectar tareas con activity_type='completed' en últimas 6h
├─> Si status != 'done' → Auto-avanzar a 'done'
└─> Log: "Auto-completed by heartbeat: task was marked completed but status not updated"

PROBLEMA 2: Sesión OpenClaw muerta (zombie)
═══════════════════════════════════════════════════════════════════════════════════════════
Síntoma: Agente en estado 'working', pero sin sesión activa en openclaw_sessions
Causa: Sesión expiró o agente se desconectó sin notificar

Soluciones:
├─> Health check detecta 'zombie' → Re-dispatch
├─> Heartbeat verifica sesión antes de dispatch
└─> Si no hay sesión → POST /api/agents/{id}/openclaw → crear nueva

PROBLEMA 3: Tarea stuck en 'assigned' sin dispatch
═══════════════════════════════════════════════════════════════════════════════════════════
Síntoma: Tarea asignada pero nunca se hace dispatch
Causa: Fallo en dispatch inicial o race condition

Solución Health Sweeper:
└─> Cada ciclo de health check: detectar assigned >2min → auto-dispatch

PROBLEMA 4: Agente "stuck" - sin actividad >15 min
═══════════════════════════════════════════════════════════════════════════════════════════
Síntoma: Última actividad hace 15+ minutos
Solución:
├─> consecutive_stall_checks >= 3 → nudgeAgent()
├─> Re-dispatch con checkpoint context
└─> Preserva el trabajo hecho hasta el punto del stall

═══════════════════════════════════════════════════════════════════════════════════════════
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                           API ENDPOINTS CLAVE                                          │
└─────────────────────────────────────────────────────────────────────────────────────────┘

TASK MANAGEMENT:
├─ POST   /api/tasks                    → Crear tarea
├─ GET    /api/tasks/{id}               → Obtener tarea
├─ PATCH  /api/tasks/{id}               → Actualizar status/título/etc
├─ POST   /api/tasks/{id}/dispatch      → Enviar tarea a agente
├─ POST   /api/tasks/{id}/complete      → Marcar como completada
├─ POST   /api/tasks/{id}/fail          → Reportar fallo (con reason)
├─ POST   /api/tasks/{id}/activities    → Log actividad
└─ POST   /api/tasks/{id}/deliverables  → Registrar entregable

AGENT MANAGEMENT:
├─ POST   /api/agents/{id}/openclaw     → Crear sesión OpenClaw
├─ GET    /api/agents/{id}/health       → Obtener health state
├─ POST   /api/agents/{id}/health/nudge → Forzar nudge manual
└─ GET    /api/agents/health            → Health check de todos

═══════════════════════════════════════════════════════════════════════════════════════════

FLUJO RECOMENDADO PARA COMPLETAR TAREA:
═══════════════════════════════════════════════════════════════════════════════════════════

1. Agente recibe mensaje de dispatch
2. Trabaja en la tarea...
3. Periódicamente loguea actividad: POST /api/tasks/{id}/activities
4. Registra entregables: POST /api/tasks/{id}/deliverables
5. Cuando termina:
   ├─> POST /api/tasks/{id}/activities (activity_type='completed', message=summary)
   ├─> PATCH /api/tasks/{id} (status='done' o siguiente stage)
   └─> Si falla → POST /api/tasks/{id}/fail (reason=why)

Si el agente no sigue este flujo:
   └─> Heartbeat detecta y auto-completa (si activity 'completed' existe)
   └─> Health monitor nudgea después de 3 stalls
   └─> Health sweeper auto-dispatches si stuck en assigned

═══════════════════════════════════════════════════════════════════════════════════════════
```

## 📋 RESUMEN EJECUTIVO

### Arquitectura del Workflow

**Mission Control** opera sobre un sistema de **máquina de estados** con las siguientes capas:

1. **Task State Machine**: 9 estados principales con transiciones definidas
2. **Health Monitor**: Watchdog que evalúa agentes cada ~2 minutos
3. **Workflow Engine**: Motor de templates para handoffs multi-agente
4. **Recovery Layer**: Mecanismos de auto-recuperación (nudge, sweep, drain)

### Puntos Críticos de Fallo

| Fallo | Detección | Recuperación |
|-------|-----------|--------------|
| Agente no reporta done | Activity 'completed' + status stuck | Heartbeat auto-complete |
| Sesión muerta (zombie) | No openclaw_session active | Re-dispatch con nueva sesión |
| Stuck en assigned | >2min sin dispatch | Health sweeper auto-dispatch |
| Stuck in_progress | >15min sin actividad | Nudge después de 3 stalls |
| Queue congestion | Stage ocupado | drainQueue auto-avanza |

### Mejoras Implementadas en Heartbeat

✅ **Auto-detectión de tareas "completed" sin status update**
✅ **Auto-creación de sesiones OpenClaw para agentes zombie**
✅ **Auto-dispatch de tareas stuck en assigned**
✅ **Notificación Telegram en cada nueva tarea creada**

### Flujo de Datos Principal

```
HEARTBEAT (cada 15 min)
        ↓
   [Check DB Tasks]
        ↓
   ├─> inbox → assigned (si tiene agente)
   ├─> assigned + stuck → dispatch (crear sesión si falta)
   ├─> in_progress + completed_activity → auto-done
   └─> done/next → crear nueva tarea desde roadmap
```

El sistema es **resiliente** y **self-healing** con múltiples capas de recuperación.
