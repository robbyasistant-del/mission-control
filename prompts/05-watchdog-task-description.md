# Watchdog Task Description Generation Prompt

## Model Configuration
- **Model**: `openclaw`
- **Temperature**: `0.3`
- **Max Tokens**: `4000`
- **Timeout**: `300000` (5 minutos)
- **System Prompt**: You are a technical project manager creating clear, actionable task descriptions for developers.

---

## Prompt Template

```
You are a technical project manager. Create a comprehensive task description with clear, atomic instructions.

TASK TO IMPLEMENT:
- Title: {{task_title}}
- Agent Role: {{task_agent_role}}
- Original Description: {{task_description}}
- Deliverables: {{task_deliverables}}
- Quality Criteria: {{task_quality_criteria}}

CONTEXT:
{{context}}

INSTRUCTIONS - MANDATORY:
Create a task description with exactly these sections:

## User Story
[Describe the feature from user perspective in 2-3 sentences]

## What to Build (5-10 Atomic Steps)
Provide between 5 and 10 clear, atomic, actionable steps. Each step should be:
- Specific and concrete
- Independent where possible
- Easy to understand and implement
- Ordered logically

Example format:
1. [Specific action to take]
2. [Specific action to take]
3. [Specific action to take]
...

## Technical Requirements
[Key technical details: APIs, components, data structures needed]

## Quality Checks / Acceptance Criteria
[Specific, testable criteria to verify completion]

## Definition of Done
- Code is implemented according to specifications
- All acceptance criteria pass
- No console errors when running
- Feature works as described in user story
- Code follows project conventions

Be CONCISE but COMPLETE. The agent must know EXACTLY what to build.
```

---

## Context Builder Variables

The `{{context}}` variable is built dynamically from:

1. **Additional Prompt** (`watchdog_settings.additional_prompt_task_creation`)
2. **Basic Info** (if enabled): `product.description`
3. **Product Program** (if enabled): `product.product_program`
4. **Executive Summary** (if enabled): summarized to 500 chars
5. **Tech Stack** (if enabled): extracted from Technical Architecture
6. **Current Sprint** (if enabled): extracted from Implementation Roadmap
7. **Developer Rules** (if enabled): extracted from Implementation Roadmap

---

## Task Variables
- `task_title` - Title of the task (required)
- `task_agent_role` - Assigned agent role (required)
- `task_description` - Original task description from roadmap
- `task_deliverables` - Deliverables from roadmap
- `task_quality_criteria` - Quality criteria from roadmap

---

## Output
- **Destination**: `tasks.description` (Mission Control tasks table)
- **Format**: Markdown with sections defined above
- **Includes metadata header**:
  ```markdown
  # Task: {title}
  **Agent:** {agent_role}
  **Generated:** {ISO timestamp}
  ```

---

## Include Settings (Configurable per product)
- `include_basic_info` - Include product description
- `include_product_program` - Include full product program
- `include_executive_summary` - Include summarized executive summary
- `include_technical_architecture` - Include extracted tech stack
- `include_implementation_roadmap` - Include current sprint info
- `additional_prompt_task_creation` - Custom instructions to prepend