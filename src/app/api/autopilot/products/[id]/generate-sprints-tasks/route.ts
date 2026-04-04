import { NextRequest, NextResponse } from 'next/server';
import { complete } from '@/lib/autopilot/llm';
import { getAutopilotProduct } from '@/lib/db/autopilot-products';
import { 
  createAutopilotSprint, 
  createAutopilotTask,
  deleteAutopilotSprintsByProduct,
  deleteAutopilotTasksByProduct
} from '@/lib/db/autopilot-sprints-tasks';
import { run } from '@/lib/db';

function ensureColumns() {
  try { run(`ALTER TABLE autopilot_products ADD COLUMN sprints_generated INTEGER DEFAULT 0`); } catch {}
}

export const dynamic = 'force-dynamic';

interface ParsedTask {
  agent: string;
  start?: string;
  end?: string;
  status: string;
  title: string;
}

interface ParsedSprint {
  phaseNumber: number;
  phaseName: string;
  sprintNumber: number;
  functionalityAnalysis?: string;
  featuresDescription?: string;
  deliverables?: string[];
  qualityCriteria?: string[];
  tasks: ParsedTask[];
}

function parseRoadmap(roadmapContent: string): ParsedSprint[] {
  const sprints: ParsedSprint[] = [];
  
  // Split by "## PHASE" or "### Sprint"
  const phaseRegex = /##\s*PHASE\s*#?(\d+)[:\s]*([^\n]*)/i;
  const sprintRegex = /###\s*Sprint\s*#?(\d+)[:\s]*([^\n]*)/i;
  const taskRegex = /^-\s*\[([^\]]*)\](?:\[([^\]]*)\])?(?:\[([^\]]*)\])?(?:\[([^\]]*)\])?\s*(.+)$/m;
  
  const lines = roadmapContent.split('\n');
  let currentPhase = 1;
  let currentPhaseName = '';
  let currentSprint: ParsedSprint | null = null;
  let inTasksSection = false;
  let inDeliverablesSection = false;
  let inQualityCriteriaSection = false;
  let inFunctionalitySection = false;
  let inFeaturesSection = false;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Check for phase header
    const phaseMatch = line.match(phaseRegex);
    if (phaseMatch) {
      currentPhase = parseInt(phaseMatch[1]) || currentPhase;
      currentPhaseName = phaseMatch[2].trim();
      continue;
    }
    
    // Check for sprint header
    const sprintMatch = line.match(sprintRegex);
    if (sprintMatch) {
      if (currentSprint) {
        sprints.push(currentSprint);
      }
      currentSprint = {
        phaseNumber: currentPhase,
        phaseName: currentPhaseName,
        sprintNumber: parseInt(sprintMatch[1]) || sprints.length + 1,
        functionalityAnalysis: '',
        featuresDescription: '',
        deliverables: [],
        qualityCriteria: [],
        tasks: []
      };
      inTasksSection = false;
      inDeliverablesSection = false;
      inQualityCriteriaSection = false;
      inFunctionalitySection = false;
      inFeaturesSection = false;
      continue;
    }
    
    if (!currentSprint) continue;
    
    // Check for section headers
    if (line.match(/\*\*Functionality Analysis\*\*/i)) {
      inFunctionalitySection = true;
      inFeaturesSection = false;
      inTasksSection = false;
      inDeliverablesSection = false;
      inQualityCriteriaSection = false;
      continue;
    }
    if (line.match(/\*\*Features Description\*\*/i)) {
      inFunctionalitySection = false;
      inFeaturesSection = true;
      inTasksSection = false;
      inDeliverablesSection = false;
      inQualityCriteriaSection = false;
      continue;
    }
    if (line.match(/\*\*Tasks:\*\*/i)) {
      inFunctionalitySection = false;
      inFeaturesSection = false;
      inTasksSection = true;
      inDeliverablesSection = false;
      inQualityCriteriaSection = false;
      continue;
    }
    if (line.match(/\*\*Deliverables:\*\*/i)) {
      inFunctionalitySection = false;
      inFeaturesSection = false;
      inTasksSection = false;
      inDeliverablesSection = true;
      inQualityCriteriaSection = false;
      continue;
    }
    if (line.match(/\*\*Quality Criteria:\*\*/i)) {
      inFunctionalitySection = false;
      inFeaturesSection = false;
      inTasksSection = false;
      inDeliverablesSection = false;
      inQualityCriteriaSection = true;
      continue;
    }
    
    // Skip empty lines and new section headers
    if (line.startsWith('##') || line.startsWith('**') || !line) {
      inFunctionalitySection = false;
      inFeaturesSection = false;
      inTasksSection = false;
      inDeliverablesSection = false;
      inQualityCriteriaSection = false;
      continue;
    }
    
    // Parse tasks
    if (inTasksSection) {
      const taskMatch = line.match(taskRegex);
      if (taskMatch) {
        currentSprint.tasks.push({
          agent: taskMatch[1]?.trim() || 'rob_main',
          start: taskMatch[2]?.trim() || undefined,
          end: taskMatch[3]?.trim() || undefined,
          status: taskMatch[4]?.trim() || 'pending',
          title: taskMatch[5]?.trim() || 'Untitled task'
        });
      }
    }
    
    // Collect functionality analysis
    if (inFunctionalitySection && line) {
      currentSprint.functionalityAnalysis += (currentSprint.functionalityAnalysis ? ' ' : '') + line;
    }
    
    // Collect features description
    if (inFeaturesSection && line) {
      currentSprint.featuresDescription += (currentSprint.featuresDescription ? ' ' : '') + line;
    }
    
    // Collect deliverables
    if (inDeliverablesSection && line.startsWith('-')) {
      currentSprint.deliverables?.push(line.substring(1).trim());
    }
    
    // Collect quality criteria
    if (inQualityCriteriaSection && line.startsWith('-')) {
      currentSprint.qualityCriteria?.push(line.substring(1).trim());
    }
  }
  
  // Don't forget the last sprint
  if (currentSprint) {
    sprints.push(currentSprint);
  }
  
  return sprints;
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    ensureColumns();
    const product = getAutopilotProduct(params.id);

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    if (!product.implementation_roadmap) {
      return NextResponse.json(
        { error: 'Implementation Roadmap is required. Please generate it first.' },
        { status: 400 }
      );
    }

    // Delete existing sprints and tasks for this product
    deleteAutopilotTasksByProduct(params.id);
    deleteAutopilotSprintsByProduct(params.id);

    // Parse the roadmap
    const parsedSprints = parseRoadmap(product.implementation_roadmap);

    // Create sprints and tasks in database
    for (const parsedSprint of parsedSprints) {
      const sprint = createAutopilotSprint({
        product_id: params.id,
        sprint_number: parsedSprint.sprintNumber,
        phase_name: parsedSprint.phaseName,
        phase_number: parsedSprint.phaseNumber,
        functionality_analysis: parsedSprint.functionalityAnalysis,
        features_description: parsedSprint.featuresDescription,
      });

      for (let i = 0; i < parsedSprint.tasks.length; i++) {
        const parsedTask = parsedSprint.tasks[i];
        createAutopilotTask({
          sprint_id: sprint.id,
          product_id: params.id,
          task_number: i + 1,
          agent_role: parsedTask.agent,
          start_date: parsedTask.start,
          end_date: parsedTask.end,
          status: parsedTask.status as any,
          title: parsedTask.title,
          deliverables: parsedSprint.deliverables?.join('\n'),
          quality_criteria: parsedSprint.qualityCriteria?.join('\n'),
        });
      }
    }

    // Update product to mark sprints as generated
    run(`UPDATE autopilot_products SET sprints_generated = 1, workflow_state = 'planned' WHERE id = ?`, [params.id]);

    return NextResponse.json({
      success: true,
      sprintsGenerated: parsedSprints.length,
      totalTasks: parsedSprints.reduce((sum, s) => sum + s.tasks.length, 0),
    });

  } catch (error) {
    console.error('Failed to generate sprints and tasks:', error);
    const errorMsg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
