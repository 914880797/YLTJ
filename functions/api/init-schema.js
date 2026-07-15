import { jsonSuccess, jsonError, hashPassword } from './_shared.js';

export async function onRequestPost({ env }) {
  try {
    await env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS groups (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        order_index INTEGER NOT NULL DEFAULT 0,
        score_weight REAL NOT NULL DEFAULT 1
      )`
    ).run();

    await env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS time_slots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        group_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        time_range TEXT NOT NULL,
        order_index INTEGER NOT NULL DEFAULT 0,
        FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
        UNIQUE(group_id, name)
      )`
    ).run();

    await env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS score_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        person_name TEXT NOT NULL,
        group_id INTEGER NOT NULL,
        slot_id INTEGER NOT NULL,
        score REAL NOT NULL DEFAULT 0,
        record_date TEXT NOT NULL,
        created_at TEXT NOT NULL,
        import_batch TEXT,
        FOREIGN KEY (group_id) REFERENCES groups(id),
        FOREIGN KEY (slot_id) REFERENCES time_slots(id),
        UNIQUE(person_name, group_id, slot_id, record_date)
      )`
    ).run();

    await env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key TEXT NOT NULL UNIQUE,
        value TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`
    ).run();

    await env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS announcements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        content TEXT NOT NULL,
        is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`
    ).run();

    await env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS admin_users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        is_active INTEGER DEFAULT 1
      )`
    ).run();

    await env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS duty_projects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        bind_group_id INTEGER,
        order_index INTEGER NOT NULL DEFAULT 0,
        FOREIGN KEY (bind_group_id) REFERENCES groups(id) ON DELETE SET NULL
      )`
    ).run();

    await env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS duty_groups (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        duty_project_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        order_index INTEGER NOT NULL DEFAULT 0,
        FOREIGN KEY (duty_project_id) REFERENCES duty_projects(id) ON DELETE CASCADE
      )`
    ).run();

    await env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS duty_slot_persons (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        duty_group_id INTEGER NOT NULL,
        time_range TEXT NOT NULL,
        persons TEXT NOT NULL,
        order_index INTEGER NOT NULL DEFAULT 0,
        FOREIGN KEY (duty_group_id) REFERENCES duty_groups(id) ON DELETE CASCADE
      )`
    ).run();

    const existing = await env.DB.prepare(
      `SELECT id FROM admin_users WHERE username = 'admin'`
    ).first();

    if (!existing) {
      await env.DB.prepare(
        `INSERT INTO admin_users (username, is_active) VALUES ('admin', 1)`
      ).run();
    }

    const adminHash = await hashPassword('admin');

    try {
      await env.DB.prepare(`ALTER TABLE groups ADD COLUMN score_weight REAL NOT NULL DEFAULT 1`).run();
    } catch (e) {}

    return jsonSuccess({ message: '数据库初始化成功', admin_token: adminHash });
  } catch (error) {
    return jsonError(error.message);
  }
}
