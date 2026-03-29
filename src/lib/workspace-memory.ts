/**
 * Workspace Memory — persistent WORKSPACE_MEMORY.md per workspace folder.
 *
 * The file lives at WORKSPACE_BASE_PATH/<slug>/WORKSPACE_MEMORY.md and
 * is injected into every dispatch so agents have workspace-level context.
 */
import fs from 'fs';
import path from 'path';
import os from 'os';
import { getWorkspaceBasePath } from './config';

function resolve(p: string): string {
  return p.startsWith('~') ? path.join(os.homedir(), p.slice(1)) : p;
}

/** Return the filesystem directory for a workspace slug */
export function getWorkspaceDir(slug: string): string {
  return path.join(resolve(getWorkspaceBasePath()), slug);
}

const MEMORY_FILENAME = 'WORKSPACE_MEMORY.md';

/** Ensure workspace folder + WORKSPACE_MEMORY.md exist. Idempotent. */
export function ensureWorkspaceDir(slug: string, meta?: { name?: string; description?: string }): string {
  const dir = getWorkspaceDir(slug);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const memFile = path.join(dir, MEMORY_FILENAME);
  if (!fs.existsSync(memFile)) {
    const title = meta?.name || slug;
    const desc = meta?.description ? `\n${meta.description}\n` : '';
    const initial = `# ${title} — Workspace Memory\n${desc}
_This file is the persistent memory for the **${title}** workspace.
It is automatically injected into every agent dispatch so knowledge survives across sessions.
The Learner agent and the system append important learnings here._

---

## Key Learnings

_(nothing yet)_
`;
    fs.writeFileSync(memFile, initial, 'utf-8');
  }

  return dir;
}

/** Read the full WORKSPACE_MEMORY.md content (returns empty string if missing) */
export function readWorkspaceMemory(slug: string): string {
  const memFile = path.join(getWorkspaceDir(slug), MEMORY_FILENAME);
  try {
    return fs.readFileSync(memFile, 'utf-8');
  } catch {
    return '';
  }
}

/**
 * Append a learning entry to WORKSPACE_MEMORY.md.
 * Keeps the file from growing indefinitely by capping entries.
 */
export function appendWorkspaceMemoryEntry(slug: string, entry: {
  title: string;
  content: string;
  category: string;
  confidence: number;
}): void {
  const dir = getWorkspaceDir(slug);
  const memFile = path.join(dir, MEMORY_FILENAME);

  // Ensure dir + file exist
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const timestamp = new Date().toISOString();
  const summary = entry.content.length > 300 ? `${entry.content.slice(0, 297)}...` : entry.content;
  const newLine = `- **[${timestamp}]** (${entry.category}) **${entry.title}** — ${summary}`;

  if (!fs.existsSync(memFile)) {
    // Create with the entry
    const content = `# Workspace Memory\n\n## Key Learnings\n\n${newLine}\n`;
    fs.writeFileSync(memFile, content, 'utf-8');
    return;
  }

  let content = fs.readFileSync(memFile, 'utf-8');

  // Replace placeholder if present
  content = content.replace('_(nothing yet)_\n', '');

  const marker = '## Key Learnings';
  if (content.includes(marker)) {
    const [head, rest] = content.split(marker);
    // Keep last 30 entries to prevent unbounded growth
    const existingLines = rest.split('\n').filter(l => l.trim().startsWith('- **['));
    const allLines = [newLine, ...existingLines].slice(0, 30);
    content = `${head.trimEnd()}\n\n${marker}\n\n${allLines.join('\n')}\n`;
  } else {
    // Append at end
    content = `${content.trimEnd()}\n\n## Key Learnings\n\n${newLine}\n`;
  }

  fs.writeFileSync(memFile, content, 'utf-8');
}
