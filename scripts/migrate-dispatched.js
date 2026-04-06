const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

// Obtener ruta de la BD desde argumentos o usar default
const dbPath = process.argv[2] || './mission-control.db';

if (!fs.existsSync(dbPath)) {
  console.error('❌ BD no encontrada:', dbPath);
  process.exit(1);
}

console.log('🔄 Migrando BD:', dbPath);

const db = new Database(dbPath);

try {
  // Desactivar foreign keys temporalmente
  db.exec('PRAGMA foreign_keys = OFF');
  // Paso 0: Verificar datos antes
  const before = db.prepare("SELECT status, COUNT(*) as count FROM autopilot_tasks GROUP BY status").all();
  console.log('\nAntes de migración:', JSON.stringify(before, null, 2));

  // Paso 1: Crear tabla temporal con nuevo constraint
  db.exec(`
    CREATE TABLE autopilot_tasks_new (
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
      created_at TEXT,
      updated_at TEXT,
      UNIQUE(sprint_id, task_number)
    )
  `);
  console.log('✅ Tabla temporal creada');

  // Paso 2: Copiar datos (convirtiendo in_progress a dispatched)
  const insertStmt = db.prepare(`
    INSERT INTO autopilot_tasks_new 
    (id, sprint_id, product_id, task_number, agent_role, agent_name, start_date, end_date, status, title, description_text, deliverables, quality_criteria, created_at, updated_at)
    SELECT 
    id, sprint_id, product_id, task_number, agent_role, agent_name,
    start_date, end_date,
    CASE WHEN status = 'in_progress' THEN 'dispatched' ELSE status END,
    title, description_text, deliverables, quality_criteria, created_at, updated_at
    FROM autopilot_tasks
  `);
  
  const result = insertStmt.run();
  console.log('✅ Filas copiadas:', result.changes);

  // Paso 3: Verificar copia
  const copied = db.prepare('SELECT COUNT(*) as count FROM autopilot_tasks_new').get();
  const original = db.prepare('SELECT COUNT(*) as count FROM autopilot_tasks').get();
  
  if (copied.count !== original.count) {
    throw new Error(`Error de copia: ${copied.count} vs ${original.count}`);
  }

  // Paso 4: Eliminar tabla vieja
  db.exec('DROP TABLE autopilot_tasks');
  console.log('✅ Tabla vieja eliminada');

  // Paso 5: Renombrar tabla nueva
  db.exec('ALTER TABLE autopilot_tasks_new RENAME TO autopilot_tasks');
  console.log('✅ Tabla renombrada');

  // Paso 6: Verificar datos después
  const after = db.prepare("SELECT status, COUNT(*) as count FROM autopilot_tasks GROUP BY status").all();
  console.log('\nDespués de migración:', JSON.stringify(after, null, 2));

  // Reactivar foreign keys
  db.exec('PRAGMA foreign_keys = ON');
  
  db.close();
  console.log('\n✅ Migración completada exitosamente');

} catch (err) {
  console.error('\n❌ Error en migración:', err.message);
  db.close();
  process.exit(1);
}
