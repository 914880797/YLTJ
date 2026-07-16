import { jsonSuccess, jsonError, verifyAdmin } from './_shared.js';
import { runMigrations } from './_migrate.js';

export async function onRequestGet({ env }) {
  try {
    await runMigrations(env);

    const { results } = await env.DB.prepare(
      `SELECT rp.*, g.name as bind_group_name,
              (SELECT COUNT(*) FROM reward_slot_persons WHERE reward_project_id = rp.id) as person_count
       FROM reward_projects rp
       LEFT JOIN groups g ON rp.bind_group_id = g.id
       ORDER BY rp.order_index ASC, rp.id ASC`
    ).all();
    return jsonSuccess({ data: results || [] });
  } catch (error) {
    return jsonError(error.message);
  }
}

export async function onRequestPost({ request, env }) {
  const isAdmin = await verifyAdmin(request, env);
  if (!isAdmin) return jsonError('未授权访问', 401);
  try {
    const { name, bind_group_id, order_index, score_weight } = await request.json();
    if (!name || !name.trim()) return jsonError('奖励项目名称不能为空', 400);

    const exists = await env.DB.prepare(
      `SELECT id FROM reward_projects WHERE name = ?`
    ).bind(name.trim()).first();
    if (exists) return jsonError('奖励项目名称已存在', 400);

    await env.DB.prepare(
      `INSERT INTO reward_projects (name, bind_group_id, score_weight, order_index) VALUES (?, ?, ?, ?)`
    ).bind(name.trim(), bind_group_id || null, score_weight || 1, order_index || 0).run();
    return jsonSuccess({ message: '奖励项目创建成功' });
  } catch (error) {
    return jsonError(error.message);
  }
}

export async function onRequestPut({ request, env }) {
  const isAdmin = await verifyAdmin(request, env);
  if (!isAdmin) return jsonError('未授权访问', 401);
  try {
    const { id, name, bind_group_id, order_index, score_weight } = await request.json();
    if (!id) return jsonError('缺少奖励项目 ID', 400);

    if (name && name.trim()) {
      const exists = await env.DB.prepare(
        `SELECT id FROM reward_projects WHERE name = ? AND id != ?`
      ).bind(name.trim(), id).first();
      if (exists) return jsonError('奖励项目名称已存在', 400);
      await env.DB.prepare(`UPDATE reward_projects SET name = ? WHERE id = ?`)
        .bind(name.trim(), id).run();
    }
    if (order_index !== undefined) {
      await env.DB.prepare(`UPDATE reward_projects SET order_index = ? WHERE id = ?`)
        .bind(order_index, id).run();
    }
    if (bind_group_id !== undefined) {
      await env.DB.prepare(`UPDATE reward_projects SET bind_group_id = ? WHERE id = ?`)
        .bind(bind_group_id || null, id).run();
    }
    if (score_weight !== undefined) {
      await env.DB.prepare(`UPDATE reward_projects SET score_weight = ? WHERE id = ?`)
        .bind(score_weight, id).run();
    }
    return jsonSuccess({ message: '奖励项目更新成功' });
  } catch (error) {
    return jsonError(error.message);
  }
}

export async function onRequestDelete({ request, env }) {
  const isAdmin = await verifyAdmin(request, env);
  if (!isAdmin) return jsonError('未授权访问', 401);
  try {
    const { id } = await request.json();
    if (!id) return jsonError('缺少奖励项目 ID', 400);

    await env.DB.prepare(`DELETE FROM reward_projects WHERE id = ?`).bind(id).run();
    return jsonSuccess({ message: '奖励项目已删除' });
  } catch (error) {
    return jsonError(error.message);
  }
}
