# CREATE TASK INSTRUCTIONS.md

### Paso 1: leer la configuracion del Watchdog de este producto

### Paso 2: Revisar tareas existentes
Primero lee las tareas de nuestro <workspace> en mission control en la base de datos de:
`C:\Users\robby\.openclaw\workspace\Epic_Agent_Mission_Control\MyMissionControl`

- Si hay tareas en 'inbox' con agente asignado → pasar a 'assigned' y terminar aquí
- Si hay tareas en 'assigned' en estado 'stuck y esta chekeado en la config "Auto-nudge stuck tasks": ejecutar el auto-nudge del mission-control por API
- Si hay tareas en estados diferentes a 'done' (assigned, in_progress, convoy_active, etc.) → terminar aquí
- Si NO hay tareas pendientes → continuar al Paso 2

### Paso 3: Crear nueva tarea desde Autopilot

1. Se busca en la BD de autopilot, de este producto, se selecciona la primera tarea por orden de Sprint-Tarea que esté 'pending'
- Si la siguiente tarea corresponde a un Sprint siguiente a la tarea creada anterior (es decir pasamos de Sprint pero no es el primero) y esta chequeada en al config la opcion "
Stop watchdog when sprint finishes" termina aqui y pausa el Watchdog.

2. Se leen los datos, y descripcion y agent_id de esta tarea

3. Se contruye el contexto de la creacion de esta tarea que estara compuesto por:
- Si hay "Additional Prompt for Task Creation" se incluye
- Los textos marcados en "Include in Task Creation Context:" se incluyen asi:
Basic Info del producto se incluye completo
Product Program del producto se incluye completo
Executive Summary del producto se incluye haciendo un resumen del texto de Executive Summary 
Technical Architecture se incluye solo la parte de 'stack tecnologico' como una referencia, no todo el fichero
Implementation Roadmap se incluye solo el texto del sprint correspondiente al que estamos asi como MANDATORY e IMPORTANTE las DEVELOPER RULES

4. Si esta chequeada la opcion "Create regression testing tasks when:"
- si la ultima tarea ejecutada en nuestro mission-control en el workspace era una "Regression Testing #" salta al punto 5
- se comprueba si ya le toca ejecutarse ya sea por tiempo o por frecuencia indicada en la configuración, si no le toca -> salta al punto 5
- crea una la tarea en la base de datos con:
      - title: "Regression Testing #"
      - status: 'assigned'
      - priority: 'urgent'
      - assigned_agent_id: el ID del agente
      - workspace_path: <Source Code Path> de datos basicos
      - Crea un contexto basado en toda la información del punto 3 que consista en parar, compilar, desplegar y arrancar los necesario para probar todo la funcionalidad completa desde el punto de vista de API / UI de usuario / Navegador o como corresponda prestando atención a las consolas, logs y UI para detectar que no haya errores si se detecta un error solicita a gateway LLM que lo corrija.
      - Condición de completitud: Esto lo hace iterativamente hasta que prueba todo y ya no hay errores, entonces la puede terminar


5. Crea la tarea en la base de datos con:
   - status: 'assigned'
   - priority: 'urgent'
   - assigned_agent_id: el ID del agente
   - workspace_path: <Source Code Path> de datos basicos
   - Actualiza en la BD la tarea con la fecha y hora de <start> en la tarea correspondiente

6. La tarea de construccion debe incluir:
   - Instrucciones claras de calidad construidas a partir del contexto dato
   - Condición de terminación definida y de pruebas de calidad consistente, sin errores
   - Lee y toma como referencia de diseño: IMPLEMENTATION_ROADMAP.md
   - Lee y toma como referencia de arquitectura tecnica: TECHNICAL_ARCHITECTURE.md
   - lee y toma como referencia las DEVELOPER RULES de: IMPLEMENTATION_ROADMAP.md
   - Tomas datos de Workspace: Basic Info del producto
   - Al pasar a 'in progress' escribir en BD el estado de la tarea a [in progress]
   - Al verificar la tarea (cuando pasa a 'verification'), desplegar, arrancar y probar su funcionamiento completo, se revisa log para ver que no hay errores
   - Al terminar la tarea (cuando pasa a 'done') escribir en BD de la tarea la fecha y hora de <end> y el estado a [done]
   - Cuando las tareas pasan de estado a 'done','blocked','testing' si en Watchdog Setting esta checkeado "Notify on Telegram when task status changes to: <estado>" MANDATORY enviar un mensaje por Telegram informandome.

7. si esta chekeado en la config "Notify on Telegram when new task created"
   - MANDATORY enviar un mensaje por Telegram informandome de la tarea creada

