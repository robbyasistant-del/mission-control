# HEARTBEAT.md

# Keep this file empty (or with only comments) to skip heartbeat API calls.

# Add tasks below when you want the agent to check something periodically.

## FLUJO DE TRABAJO DEL HEARTBEAT

### Paso 1: Revisar tareas existentes
Primero lee las tareas de nuestro mission control en la base de datos de:
`C:\Users\robby\.openclaw\workspace\Epic_Agent_Mission_Control\MyMissionControl`

- Si hay tareas en 'inbox' con agente asignado → pasar a 'assigned' y terminar aquí
- Si hay tareas en 'assigned' en estado 'stuck:
    A. si el agente asignado no tiene sesion activa la creamos POST http://localhost:4001/api/agents/{agent_id}/openclaw
    B. si el agente asignado si tiene sesion activa se realiza el dispatch 'stuck waiting for be dispatched llama a POST http://localhost:4001/api/tasks/{TASK_ID}/dispatch
- Si hay tareas en estados diferentes a 'done' (assigned, in_progress, convoy_active, etc.) → terminar aquí
- Si NO hay tareas pendientes → continuar al Paso 2

### Paso 2: Crear nueva tarea desde PROJECT_PLAN.md

1. Lee los ficheros:
   - `C:\Users\robby\.openclaw\workspace\market-dashboard\IMPLEMENTATION_ROADMAP.md`
   - `C:\Users\robby\.openclaw\workspace\market-dashboard\PROJECT_PLAN.md`

2. Coge la primera tarea que esté [pending]

3. Busca el agent_id correspondiente al agente indicado en PROJECT_PLAN.md:
   - `rob_web` → 560d705425902ba289b39868e7c09194
   - `rob_asogrowth` → f409d028f1fff24316074dbc192cf32b
   - `rob_uxdesigner` → 4f2192eade48761244eeb22dadec24c5
   - `rob_market` → 2ec10eda186dcddd06675ed63931e517
   - `rob_tester` → 1c42cf27401a9e5ac2b993c63b9ad001

4. Crea la tarea en la base de datos con:
   - status: 'assigned'
   - priority: 'urgent'
   - assigned_agent_id: el ID del agente
   - workspace_path: 'C:\Users\robby\.openclaw\workspace\market-dashboard'
   - Escribe en PROJECT_PLAN.md el [<start date:hour>] en la tarea correspondiente

5. La tarea debe incluir:
   - Instrucciones claras de calidad
   - Condición de terminación definida
   - Lee y toma como referencia de diseño: IMPLEMENTATION_ROADMAP.md
   - Lee y toma como referencia de arquitectura tecnica: TECHNICAL_ARCHITECTURE.md
   - lee y toma como referencia las DEVELOPER RULES de: IMPLEMENTATION_ROADMAP.md
   - Workspace: 'C:\Users\robby\.openclaw\workspace\market-dashboard'
   - Al pasar a 'in progress' escribir en PROJECT_PLAN.md el estado a [in progress]
   - Al verificar la tarea (cuando pasa a 'verification'), probar en puerto 4003 que funciona el dashboard
   - Al terminar la tarea (cuando pasa a 'done') escribir en PROJECT_PLAN.md [<end date:hour>][done]
   - Al pasar a 'done', ejecutar HEARTBEAT nuevamente


6. IMPORTANTE: enviame un mensaje a Telegram
   - usa el canal de telegram poara resumirme en tres lineas la tarea creada