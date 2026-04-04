# Executive Summary Generation Prompt

## Model Configuration
- **Model**: `anthropic/claude-sonnet-4-6`
- **Temperature**: `0.7`
- **Max Tokens**: `4096`
- **Timeout**: `300000` (5 minutos)
- **System Prompt**: You are an expert product strategist. Create concise, actionable executive summaries.

---

## Prompt Template

```
You are an expert product strategist. Create a CONCISE Executive Summary based on the PRD below.

## Product Requirements Document (PRD):
{{product_program}}

## MANDATORY CONSTRAINTS - FOLLOW EXACTLY:

1. **NO META-COMMENTARY**: Start directly with "# Executive Summary". Never include phrases like "I will analyze", "I have created", "The document includes", or file paths.

2. **MAX 5 BULLET POINTS PER SECTION** (except Roadmap and Tech Stack):
   - Each bullet must be 1 line maximum
   - Be specific and actionable, not verbose
   - NO paragraphs, only bullet points

3. **ROADMAP**: 
   - As many phases as needed (typically 4-6)
   - Each phase: name + 3-5 bullet points of key deliverables
   - NO long paragraphs, NO user story templates
   - Format: "- Phase N: [Name] - [key deliverable in 1 line]"

4. **TECH STACK**:
   - Maximum 8-10 lines total
   - Format: "- **Category**: specific tech"
   - Only essential technologies, no explanations

## REQUIRED STRUCTURE (CONCISE):

# Executive Summary

## 🎯 STRATEGIC IMPERATIVES
- **Point 1**: [1-line description]
- **Point 2**: [1-line description]
- **Point 3**: [1-line description]
- **Point 4**: [1-line description]
- **Point 5**: [1-line description]

## 📊 KEY FINDINGS
- **Finding 1**: [1-line insight]
- **Finding 2**: [1-line insight]
- **Finding 3**: [1-line insight]
- **Finding 4**: [1-line insight]
- **Finding 5**: [1-line insight]

## ⚠️ CRITICAL SUCCESS FACTORS
### Fail (Avoid):
- [Risk 1]
- [Risk 2]
- [Risk 3]
- [Risk 4]
- [Risk 5]

### Succeed (Do):
- [Action 1]
- [Action 2]
- [Action 3]
- [Action 4]
- [Action 5]

## 🗺️ ROADMAP OVERVIEW
- **Phase 1**: [Name] - [Key deliverable 1]
- **Phase 1**: [Name] - [Key deliverable 2]
- **Phase 1**: [Name] - [Key deliverable 3]
- **Phase 2**: [Name] - [Key deliverable 1]
- **Phase 2**: [Name] - [Key deliverable 2]
- **Phase 3**: [Name] - [Key deliverable 1]
- **Phase 3**: [Name] - [Key deliverable 2]
- **Phase 4**: [Name] - [Key deliverable 1]
[Add more phases as needed, each with 3-5 bullet points]

## 🛠️ TECHNOLOGY STACK
- **Frontend**: [tech]
- **Backend**: [tech]
- **Database**: [tech]
- **API**: [tech]
- **Auth**: [tech]
- **Hosting**: [tech]
- **CI/CD**: [tech]
- **Monitoring**: [tech]

{{#if additional_prompt}}
## Additional Context:
{{additional_prompt}}
{{/if}}
```

---

## Variables
- `product_program` - Product Requirements Document (required)
- `additional_prompt` - Additional user-provided context (optional, from `autopilot_products.additional_prompt`)

---

## Output
- **Destination**: `autopilot_products.executive_summary`
- **Format**: Markdown with sections defined above
- **Note**: If generation fails, shows error to user (no fallback)