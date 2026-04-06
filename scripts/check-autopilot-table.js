const Database = require('better-sqlite3');
const db = new Database('./mission-control.db');

const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='autopilot_tasks'").all();

if (tables.length === 0) {
  console.log('La tabla autopilot_tasks no existe. Creándola con esquema actualizado...');
  db.exec(`
    CREATE TABLE autopilot_tasks (
      id TEXT PRIMARY KEY,
      sprint_id TEXT NOT NULL REFERENCES autopilot_sprints(id) ON DELETE CASCADE,
      product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      task_number INTEGER NOT NULL,
      agent_role TEXT NOT NULL,
      agent_name TEXT,
      start_date TEXT,
      end_date TEXT,
      status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'dispatched', 'in_progress', 'blocked', 'testing', 'done')),
      title TEXT NOT NULL,
      description_text TEXT,
      deliverables TEXT,
      quality_criteria TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      UNIQUE(sprint_id, task_number)
    )
  `);
  console.log('✅ Tabla autopilot_tasks creada con CHECK constraint actualizado');
} else {
  console.log('La tabla autopilot_tasks ya existe en BD de código fuente');
}

db.close();
