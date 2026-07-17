export async function runMigrations(env) {
  try { await env.DB.prepare(`CREATE TABLE IF NOT EXISTS groups (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, order_index INTEGER NOT NULL DEFAULT 0, score_weight REAL NOT NULL DEFAULT 1, has_slots INTEGER NOT NULL DEFAULT 1)`).run(); } catch (e) {}
  try { await env.DB.prepare(`CREATE TABLE IF NOT EXISTS time_slots (id INTEGER PRIMARY KEY AUTOINCREMENT, group_id INTEGER NOT NULL, name TEXT NOT NULL, time_range TEXT NOT NULL, order_index INTEGER NOT NULL DEFAULT 0, FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE, UNIQUE(group_id, name))`).run(); } catch (e) {}
  try { await env.DB.prepare(`ALTER TABLE time_slots ADD COLUMN source TEXT`).run(); } catch (e) {}
  try { await env.DB.prepare(`CREATE TABLE IF NOT EXISTS score_records (id INTEGER PRIMARY KEY AUTOINCREMENT, person_name TEXT NOT NULL, group_id INTEGER NOT NULL, slot_id INTEGER NOT NULL, score REAL NOT NULL DEFAULT 0, record_date TEXT NOT NULL, created_at TEXT NOT NULL, import_batch TEXT, FOREIGN KEY (group_id) REFERENCES groups(id), FOREIGN KEY (slot_id) REFERENCES time_slots(id), UNIQUE(person_name, group_id, slot_id, record_date))`).run(); } catch (e) {}
  try { await env.DB.prepare(`CREATE TABLE IF NOT EXISTS settings (id INTEGER PRIMARY KEY AUTOINCREMENT, key TEXT NOT NULL UNIQUE, value TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)`).run(); } catch (e) {}
  try { await env.DB.prepare(`CREATE TABLE IF NOT EXISTS announcements (id INTEGER PRIMARY KEY AUTOINCREMENT, content TEXT NOT NULL, is_active INTEGER DEFAULT 1, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)`).run(); } catch (e) {}
  try { await env.DB.prepare(`ALTER TABLE announcements ADD COLUMN order_index INTEGER NOT NULL DEFAULT 0`).run(); } catch (e) {}
  try {
    const { results } = await env.DB.prepare(`SELECT id, order_index FROM announcements ORDER BY order_index ASC, id ASC`).all();
    if (results && results.length > 0 && results[0].order_index !== 1) {
      for (let i = 0; i < results.length; i++) {
        await env.DB.prepare(`UPDATE announcements SET order_index = ? WHERE id = ?`).bind(i + 1, results[i].id).run();
      }
    }
  } catch (e) {}
  try { await env.DB.prepare(`CREATE TABLE IF NOT EXISTS admin_users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL UNIQUE, is_active INTEGER DEFAULT 1)`).run(); } catch (e) {}
  try { await env.DB.prepare(`CREATE TABLE IF NOT EXISTS duty_projects (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, bind_group_id INTEGER, order_index INTEGER NOT NULL DEFAULT 0, FOREIGN KEY (bind_group_id) REFERENCES groups(id) ON DELETE SET NULL)`).run(); } catch (e) {}
  try { await env.DB.prepare(`CREATE TABLE IF NOT EXISTS duty_groups (id INTEGER PRIMARY KEY AUTOINCREMENT, duty_project_id INTEGER NOT NULL, name TEXT NOT NULL, order_index INTEGER NOT NULL DEFAULT 0, FOREIGN KEY (duty_project_id) REFERENCES duty_projects(id) ON DELETE CASCADE)`).run(); } catch (e) {}
  try { await env.DB.prepare(`CREATE TABLE IF NOT EXISTS duty_slot_persons (id INTEGER PRIMARY KEY AUTOINCREMENT, duty_group_id INTEGER NOT NULL, persons TEXT NOT NULL, order_index INTEGER NOT NULL DEFAULT 0, FOREIGN KEY (duty_group_id) REFERENCES duty_groups(id) ON DELETE CASCADE)`).run(); } catch (e) {}
  try { await env.DB.prepare(`CREATE TABLE IF NOT EXISTS reward_projects (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, bind_group_id INTEGER, score_weight REAL NOT NULL DEFAULT 1, order_index INTEGER NOT NULL DEFAULT 0, FOREIGN KEY (bind_group_id) REFERENCES groups(id) ON DELETE SET NULL)`).run(); } catch (e) {}
  try { await env.DB.prepare(`ALTER TABLE reward_projects ADD COLUMN score_weight REAL NOT NULL DEFAULT 1`).run(); } catch (e) {}
  try { await env.DB.prepare(`CREATE TABLE IF NOT EXISTS reward_slot_persons (id INTEGER PRIMARY KEY AUTOINCREMENT, reward_project_id INTEGER NOT NULL, persons TEXT NOT NULL, order_index INTEGER NOT NULL DEFAULT 0, FOREIGN KEY (reward_project_id) REFERENCES reward_projects(id) ON DELETE CASCADE)`).run(); } catch (e) {}
  try { await env.DB.prepare(`CREATE TABLE IF NOT EXISTS warmup_projects (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, bind_group_id INTEGER, order_index INTEGER NOT NULL DEFAULT 0, FOREIGN KEY (bind_group_id) REFERENCES groups(id) ON DELETE SET NULL)`).run(); } catch (e) {}
  try { await env.DB.prepare(`CREATE TABLE IF NOT EXISTS warmup_groups (id INTEGER PRIMARY KEY AUTOINCREMENT, warmup_project_id INTEGER NOT NULL, name TEXT NOT NULL, order_index INTEGER NOT NULL DEFAULT 0, FOREIGN KEY (warmup_project_id) REFERENCES warmup_projects(id) ON DELETE CASCADE)`).run(); } catch (e) {}
  try { await env.DB.prepare(`CREATE TABLE IF NOT EXISTS warmup_slot_persons (id INTEGER PRIMARY KEY AUTOINCREMENT, warmup_group_id INTEGER NOT NULL, persons TEXT NOT NULL, order_index INTEGER NOT NULL DEFAULT 0, FOREIGN KEY (warmup_group_id) REFERENCES warmup_groups(id) ON DELETE CASCADE)`).run(); } catch (e) {}
  try { await env.DB.prepare(`INSERT OR IGNORE INTO admin_users (username) VALUES ('admin')`).run(); } catch (e) {}
}
