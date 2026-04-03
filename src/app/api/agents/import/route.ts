import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { queryOne, queryAll, run, transaction } from '@/lib/db';
import type { Agent } from '@/lib/types';

export const dynamic = 'force-dynamic';
interface ImportAgentRequest {
  gateway_agent_id: string;
  name: string;
  model?: string | { primary?: string; fallbacks?: string[] };
  workspace_id?: string;
  gateway_workspace_path?: string;
}

interface ImportRequest {
  agents: ImportAgentRequest[];
}

// POST /api/agents/import - Import one or more agents from the OpenClaw Gateway
export async function POST(request: NextRequest) {
  try {
    const body: ImportRequest = await request.json();

    if (!body.agents || !Array.isArray(body.agents) || body.agents.length === 0) {
      return NextResponse.json(
        { error: 'At least one agent is required in the agents array' },
        { status: 400 }
      );
    }

    // Validate each agent
    for (const agentReq of body.agents) {
      if (!agentReq.gateway_agent_id || !agentReq.name) {
        return NextResponse.json(
          { error: 'Each agent must have gateway_agent_id and name' },
          { status: 400 }
        );
      }
    }

    // Check for conflicts (already imported)
    const existingImports = queryAll<Agent>(
      `SELECT * FROM agents WHERE gateway_agent_id IS NOT NULL`
    );
    const importedGatewayIds = new Set(existingImports.map((a) => a.gateway_agent_id));

    const results: { imported: Agent[]; skipped: { gateway_agent_id: string; reason: string }[] } = {
      imported: [],
      skipped: [],
    };

    transaction(() => {
      const now = new Date().toISOString();

      for (const agentReq of body.agents) {
        // Skip if already imported
        if (importedGatewayIds.has(agentReq.gateway_agent_id)) {
          results.skipped.push({
            gateway_agent_id: agentReq.gateway_agent_id,
            reason: 'Already imported',
          });
          continue;
        }

        const id = uuidv4();
        const workspaceId = agentReq.workspace_id || 'default';

        const defaultSoulMd = [
          `# ${agentReq.name}`,
          '',
          `Imported from OpenClaw Gateway (agent: ${agentReq.gateway_agent_id}).`,
          '',
          'Configure this agent\'s personality, values, and communication style here.',
        ].join('\n');

        const defaultUserMd = [
          '# User Context',
          '',
          `Imported from OpenClaw Gateway (agent: ${agentReq.gateway_agent_id}).`,
          '',
          'Add context about the human this agent works with.',
        ].join('\n');

        const defaultAgentsMd = [
          '# Team Roster',
          '',
          `Imported from OpenClaw Gateway (agent: ${agentReq.gateway_agent_id}).`,
          '',
          'Describe the other agents this agent collaborates with.',
        ].join('\n');

        const workspacePath = agentReq.gateway_workspace_path?.trim();
        const loadMdFromWorkspace = (filename: 'SOUL.md' | 'USER.md' | 'AGENTS.md') => {
          if (!workspacePath) return undefined;
          try {
            const fullPath = path.join(workspacePath, filename);
            if (!existsSync(fullPath)) return undefined;
            const content = readFileSync(fullPath, 'utf-8').trim();
            return content.length > 0 ? content : undefined;
          } catch {
            return undefined;
          }
        };

        const soulMd = loadMdFromWorkspace('SOUL.md') || defaultSoulMd;
        const userMd = loadMdFromWorkspace('USER.md') || defaultUserMd;
        const agentsMd = loadMdFromWorkspace('AGENTS.md') || defaultAgentsMd;

        const normalizedModel =
          typeof agentReq.model === 'string'
            ? agentReq.model
            : agentReq.model?.primary || null;

        run(
          `INSERT INTO agents (id, name, role, description, avatar_emoji, is_master, workspace_id, soul_md, user_md, agents_md, model, source, gateway_agent_id, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            id,
            agentReq.name,
            'Imported Agent',
            `Imported from OpenClaw Gateway (${agentReq.gateway_agent_id})`,
            '🔗',
            0,
            workspaceId,
            soulMd,
            userMd,
            agentsMd,
            normalizedModel,
            'gateway',
            agentReq.gateway_agent_id,
            now,
            now,
          ]
        );

        // Log event
        run(
          `INSERT INTO events (id, type, agent_id, message, created_at)
           VALUES (?, ?, ?, ?, ?)`,
          [uuidv4(), 'agent_joined', id, `${agentReq.name} imported from OpenClaw Gateway`, now]
        );

        const agent = queryOne<Agent>('SELECT * FROM agents WHERE id = ?', [id]);
        if (agent) {
          results.imported.push(agent);
        }
      }
    });

    return NextResponse.json(results, { status: 201 });
  } catch (error) {
    console.error('Failed to import agents:', error);
    return NextResponse.json(
      { error: 'Failed to import agents' },
      { status: 500 }
    );
  }
}
