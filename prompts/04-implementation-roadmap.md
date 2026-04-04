# Implementation Roadmap Generation Prompt

## Model Configuration
- **Model**: `openclaw`
- **Temperature**: `0.7`
- **Max Tokens**: `12000`
- **Timeout**: `300000` (5 minutos)
- **System Prompt**: You are a project manager specialized in software development roadmaps. Create detailed, actionable implementation plans with clear sprint breakdowns. Always provide complete content, never stop mid-section.

---

## Prompt Template

```
Genera un Implementation Roadmap completo en formato markdown para el siguiente producto:

## CONTEXTO DEL PRODUCTO

### Product Program (PRD)
{{product_program}}

### Executive Summary
{{executive_summary}}

### Technical Architecture
{{technical_architecture}}

{{#if additional_prompt}}
## NOTAS ADICIONALES
{{additional_prompt}}
{{/if}}

---

## INSTRUCCIONES MANDATORY

Genera un roadmap de implementación completo con el siguiente formato EXACTO:

# Implementation Roadmap
**Document Purpose:** This roadmap provides a detailed, actionable plan for implementing the product. It breaks down the work into phases, identifies dependencies, estimates tasks and subtasks, and defines success criteria for each milestone.

## DEVELOPMENT RULES (MANDATORY)
- Work in this path {{source_code_path}}
- Deploy/check runtime in this path {{local_deploy_path}}
- Work must follow the technical architecture defined above
- Each sprint must deliver a complete, working feature
- Each sprint must contain between 5 and 10 clear subtasks or user stories
- All code must be tested before marking as done
- Documentation must be updated with each deliverable

### Status Legend
- `pending` → no iniciada
- `in_progress` → en curso
- `blocked` → bloqueada
- `review` → lista para revisión
- `done` → completada

### Agent Roles
- `rob_main` → coordinación, kickoff, stakeholders, documentación funcional
- `rob_web` → infra, despliegue, observabilidad, seguridad, performance, backend APIs
- `rob_asogrowth` → warehouse, pipelines, calidad de datos, scoring, analytics, scripts de recolección
- `rob_uxdesigner` → UI dashboard, graphical design, navegación, widgets, vistas
- `rob_market` → lógica de inteligencia de mercado, ASO, benchmarking, reporting
- `rob_tester` → testing, validación, UAT, QA checklist

---

## PHASE 1: Foundation & Setup

### Sprint 1: Project Initialization

**Functionality Analysis:**
Setup del proyecto, repositorio, estructura de carpetas, configuración inicial del entorno de desarrollo.

**Features Description:**
- Configuración del repositorio Git
- Setup de herramientas de desarrollo
- Configuración de CI/CD básico
- Documentación inicial del proyecto

**Tasks:**
- [rob_main][][][pending] Crear estructura de carpetas del proyecto
- [rob_web][][][pending] Configurar repositorio Git y protección de ramas
- [rob_web][][][pending] Setup de CI/CD pipeline básico
- [rob_tester][][][pending] Definir estrategia de testing

**Deliverables:**
- Repositorio configurado
- Pipeline CI/CD funcionando
- Documentación de setup completa

**Quality Criteria:**
- Build exitoso en CI
- Tests básicos pasando
- Documentación clara para nuevos desarrolladores

---

## PHASE 2: Core Development

### Sprint 2: [Nombre de funcionalidad principal]

[Continuar con el mismo patrón para cada sprint...]

---

**REGLAS IMPORTANTES:**
1. Genera TODAS las fases necesarias (Phase 1, 2, 3...) hasta completar el producto
2. Cada Sprint debe ser una funcionalidad COMPLETA con 5-10 subtareas
3. Cada tarea debe tener un título CLARO, CONCISO y DIRECTO
4. Incluye suficiente descripción para NO necesitar preguntas adicionales
5. Las tareas deben poder hacerse en ORDEN secuencial
6. Asigna agentes según el tipo de trabajo (rob_main, rob_web, rob_uxdesigner, rob_tester)

MANDATORY: NUNCA se escribe la respuesta en fichero. Se debe devolver el texto completo directamente en la respuesta de esta llamada API. NO escribir a disco.
```

---

## Variables
- `product_program` - Product Requirements Document (required)
- `executive_summary` - Executive Summary (required)
- `technical_architecture` - Technical Architecture (required)
- `source_code_path` - Source code path (optional, from product)
- `local_deploy_path` - Local deploy path (optional, from product)
- `additional_prompt` - Additional notes (optional, from `autopilot_products.additional_prompt_roadmap`)

---

## Output
- **Destination**: `autopilot_products.implementation_roadmap`
- **Format**: Markdown with sprints/tasks structure
- **Note**: This is the largest prompt (~12K tokens output)