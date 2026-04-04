# Technical Architecture Generation Prompt

## Model Configuration
- **Model**: `openclaw`
- **Temperature**: `0.7`
- **Max Tokens**: `8000`
- **Timeout**: `300000` (5 minutos)
- **System Prompt**: You are a software architect. Generate complete technical documentation with all requested sections. Never stop after section 1.

---

## Prompt Template

```
Genera un documento de Arquitectura Técnica completo con TODAS estas secciones en markdown:

## 1. Architecture Overview
Descripción de la arquitectura general y componentes principales.

## 2. Technology Stack
Lista de tecnologías por capa (Frontend, Backend, Database, etc).

## 3. Database Schema
Tablas principales y sus campos clave.

## 4. API Design
Endpoints principales con método y propósito.

## 5. Infrastructure
Despliegue y variables de entorno.

INFORMACIÓN DEL PRODUCTO:
{{product_program}}

{{#if executive_summary}}
RESUMEN EJECUTIVO:
{{executive_summary}}
{{/if}}

{{#if additional_prompt}}
NOTAS ADICIONALES: {{additional_prompt}}
{{/if}}

REGLA CRÍTICA: Debes generar las 5 secciones completas. No omitas ninguna.

MANDATORY: NUNCA se escribe la respuesta en fichero. Se debe devolver el texto completo directamente en la respuesta de esta llamada API. NO escribir a disco.
```

---

## Variables
- `product_program` - Product Requirements Document (required)
- `executive_summary` - Executive Summary (required)
- `additional_prompt` - Additional notes (optional, from `autopilot_products.additional_prompt_arch`)

---

## Output
- **Destination**: `autopilot_products.technical_architecture`
- **Format**: Markdown with 5 mandatory sections
- **Note**: Generation fails if prerequisite docs are missing