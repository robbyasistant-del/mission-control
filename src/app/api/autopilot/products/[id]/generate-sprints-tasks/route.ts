import { NextRequest, NextResponse } from 'next/server';
import { getAutopilotProduct } from '@/lib/db/autopilot-products';
import { getDb } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

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
    
    const phaseMatch = line.match(phaseRegex);
    if (phaseMatch) {
      currentPhase = parseInt(phaseMatch[1]) || currentPhase;
      currentPhaseName = phaseMatch[2].trim();
      continue;
    }
    
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
    
    if (line.startsWith('##') || line.startsWith('**') || !line) {
      inFunctionalitySection = false;
      inFeaturesSection = false;
      inTasksSection = false;
      inDeliverablesSection = false;
      inQualityCriteriaSection = false;
      continue;
    }
    
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
    
    if (inFunctionalitySection && line) {
      currentSprint.functionalityAnalysis += (currentSprint.functionalityAnalysis ? ' ' : '') + line;
    }
    
    if (inFeaturesSection && line) {
      currentSprint.featuresDescription += (currentSprint.featuresDescription ? ' ' : '') + line;
    }
    
    if (inDeliverablesSection && line.startsWith('-')) {
      currentSprint.deliverables?.push(line.substring(1).trim());
    }
    
    if (inQualityCriteriaSection && line.startsWith('-')) {
      currentSprint.qualityCriteria?.push(line.substring(1).trim());
    }
  }
  
  if (currentSprint) {
    sprints.push(currentSprint);
  }
  
  return sprints;
}

function ensureTables(db: any) {
  try {
    db.pragma('foreign_keys = OFF');
    
    db.exec(`
      CREATE TABLE IF NOT EXISTS autopilot_sprints (
        id TEXT PRIMARY KEY,
        product_id TEXT NOT NULL,
        sprint_number INTEGER NOT NULL,
        phase_name TEXT NOT NULL,
        phase_number INTEGER NOT NULL,
        functionality_analysis TEXT,
        features_description TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        UNIQUE(product_id, sprint_number)
      )
    `);
    
    db.exec(`
      CREATE TABLE IF NOT EXISTS autopilot_tasks (
        id TEXT PRIMARY KEY,
        sprint_id TEXT NOT NULL,
        product_id TEXT NOT NULL,
        task_number INTEGER NOT NULL,
        agent_role TEXT NOT NULL,
        agent_name TEXT,
        start_date TEXT,
        end_date TEXT,
        status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'blocked', 'testing', 'done')),
        title TEXT NOT NULL,
        description_text TEXT,
        deliverables TEXT,
        quality_criteria TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        UNIQUE(sprint_id, task_number)
      )
    `);
    
    db.pragma('foreign_keys = ON');
  } catch (e) {
    console.error('Failed to ensure tables:', e);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const db = getDb();
    ensureTables(db);
    
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

    // Delete existing data
    db.pragma('foreign_keys = OFF');
    db.prepare('DELETE FROM autopilot_tasks WHERE product_id = ?').run(params.id);
    db.prepare('DELETE FROM autopilot_sprints WHERE product_id = ?').run(params.id);
    db.pragma('foreign_keys = ON');

    // Parse roadmap
    const parsedSprints = parseRoadmap(product.implementation_roadmap);

    // Insert using prepared statements within transaction
    const insertSprint = db.prepare(`
      INSERT INTO autopilot_sprints (id, product_id, sprint_number, phase_name, phase_number, functionality_analysis, features_description, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `);

    const insertTask = db.prepare(`
      INSERT INTO autopilot_tasks (id, sprint_id, product_id, task_number, agent_role, agent_name, start_date, end_date, status, title, description_text, deliverables, quality_criteria, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `);

    // Run in transaction
    const insertAll = db.transaction(() => {
      for (const parsedSprint of parsedSprints) {
        const sprintId = uuidv4();
        
        insertSprint.run(
          sprintId,
          params.id,
          parsedSprint.sprintNumber,
          parsedSprint.phaseName,
          parsedSprint.phaseNumber,
          parsedSprint.functionalityAnalysis || null,
          parsedSprint.featuresDescription || null
        );

        for (let i = 0; i < parsedSprint.tasks.length; i++) {
          const parsedTask = parsedSprint.tasks[i];
          insertTask.run(
            uuidv4(),
            sprintId,
            params.id,
            i + 1,
            parsedTask.agent,
            null,
            parsedTask.start || null,
            parsedTask.end || null,
            parsedTask.status,
            parsedTask.title,
            null,
            parsedSprint.deliverables?.join('\n') || null,
            parsedSprint.qualityCriteria?.join('\n') || null
          );
        }
      }
    });

    insertAll();

    // Update product
    db.prepare(`UPDATE autopilot_products SET sprints_generated = 1, workflow_state = 'planned' WHERE id = ?`).run(params.id);

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
