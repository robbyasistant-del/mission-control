-- Autopilot Products Table
CREATE TABLE IF NOT EXISTS autopilot_products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  repo_url TEXT,
  live_url TEXT,
  icon TEXT DEFAULT '🚀',
  product_program TEXT,
  build_mode TEXT DEFAULT 'plan_first',
  default_branch TEXT DEFAULT 'main',
  workspace_id TEXT,
  status TEXT DEFAULT 'active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Autopilot Product Health Scores
CREATE TABLE IF NOT EXISTS autopilot_health_scores (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  score REAL NOT NULL,
  health_data TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (product_id) REFERENCES autopilot_products(id) ON DELETE CASCADE
);

-- Autopilot Product Ideas
CREATE TABLE IF NOT EXISTS autopilot_ideas (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'pending',
  priority INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (product_id) REFERENCES autopilot_products(id) ON DELETE CASCADE
);

-- Autopilot Product Schedules
CREATE TABLE IF NOT EXISTS autopilot_schedules (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  name TEXT NOT NULL,
  cron TEXT NOT NULL,
  enabled INTEGER DEFAULT 1,
  last_run TEXT,
  next_run TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (product_id) REFERENCES autopilot_products(id) ON DELETE CASCADE
);

-- Autopilot Activity Log
CREATE TABLE IF NOT EXISTS autopilot_activities (
  id TEXT PRIMARY KEY,
  product_id TEXT,
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  metadata TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (product_id) REFERENCES autopilot_products(id) ON DELETE SET NULL
);
