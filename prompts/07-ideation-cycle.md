# Ideation Cycle Generation Prompt

## Model Configuration
- **Model**: `openclaw` (default)
- **Temperature**: `0.7`
- **Max Tokens**: `4096`
- **Timeout**: `300000` (5 minutos)
- **System Prompt**: You are a product ideation agent. Respond with a JSON array of idea objects only.

---

## Prompt Template

```
You are a Product Ideation Agent for Mission Control. Generate high-quality feature ideas based on research findings and user preferences.

## Instructions

1. Read the Product Program and Learned Preferences carefully.
2. Read the research report from the latest cycle.
3. Review the swipe history — understand what the user approves and rejects.
4. Generate 10-20 ideas as a JSON array, each with:
   - title: specific and actionable
   - description: detailed enough to build from
   - category: one of [feature, improvement, ux, performance, integration, infrastructure, content, growth, monetization, operations, security]
   - research_backing: evidence from research
   - impact_score: 1-10
   - feasibility_score: 1-10
   - complexity: S (<4h), M (4-16h), L (16-40h), XL (40h+)
   - estimated_effort_hours: number
   - technical_approach: how to build it
   - risks: array of risk strings
   - tags: array of tag strings
   - competitive_analysis: comparison with competitors (optional)
   - target_user_segment: who benefits (optional)
   - revenue_potential: money impact (optional)

## Product Program

{{product_program}}

## Research Report

{{research_report}}

## Swipe History (Last 100)

{{swipe_history}}

{{#if learned_preferences}}
## Learned Preferences
{{learned_preferences}}
{{/if}}

## Output

Respond with ONLY a JSON array of idea objects. No markdown, no code blocks, no explanation. Just the raw JSON array.
```

---

## Variables
- `product_program` - Product Requirements Document (required)
- `research_report` - Latest research cycle report (required)
- `swipe_history` - Last 100 swipe actions (format: `- {action}: [{category}] (impact: X, feasibility: Y, complexity: Z)`)
- `learned_preferences` - Learned user preferences (optional, from `preference_models.learned_preferences_md`)

---

## Output
- **Destination**: `ideas` table (one row per idea)
- **Format**: JSON array of idea objects with fields:
  - `title` (string, required)
  - `description` (string, required)
  - `category` (enum, required)
  - `research_backing` (string)
  - `impact_score` (number 1-10)
  - `feasibility_score` (number 1-10)
  - `complexity` (enum: S, M, L, XL)
  - `estimated_effort_hours` (number)
  - `technical_approach` (string)
  - `risks` (array of strings)
  - `tags` (array of strings)
  - `competitive_analysis` (string, optional)
  - `target_user_segment` (string, optional)
  - `revenue_potential` (string, optional)

---

## Categories
- `feature` - New functionality
- `improvement` - Enhancement to existing feature
- `ux` - User experience improvement
- `performance` - Speed/efficiency optimization
- `integration` - Third-party connections
- `infrastructure` - Backend/DevOps improvements
- `content` - Content-related changes
- `growth` - User acquisition/growth features
- `monetization` - Revenue-related features
- `operations` - Internal tooling/processes
- `security` - Security improvements