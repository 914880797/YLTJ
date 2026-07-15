import { jsonSuccess, jsonError, verifyAdmin } from './_shared.js';

export async function onRequestGet({ env }) {
  try {
    const { results } = await env.DB.prepare(
      `SELECT dp.*, (SELECT COUNT(*) FROM duty_groups WHERE duty_project_id = dp.id) as group_count
       FROM duty_projects dp ORDER BY dp.order_index ASC, dp.id ASC`
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
    const { name, order_index } = await request.json();
    if (!name || !name.trim()) return jsonError('值班项目名称不能为空', 400);

    const exists = await env.DB.prepare(
      `SELECT id FROM duty_projects WHERE name = ?`
    ).bind(name.trim()).first();
    if (exists) return jsonError('值班项目名称已存在', 400);

    await env.DB.prepare(
      `INSERT INTO duty_projects (name, order_index) VALUES (?, ?)`
    ).bind(name.trim(), order_index || 0).run();
    return jsonSuccess({ message: '值班项目创建成功' });
  } catch (error) {
    return jsonError(error.message);
  }
}

export async function onRequestPut({ request, env }) {
  const isAdmin = await verifyAdmin(request, env);
  if (!isAdmin) return jsonError('未授权访问', 401);
  try {
    const { id, name, order_index } = await request.json();
    if (!id) return jsonError('缺少值班项目 ID', 400);

    if (name && name.trim()) {
      const exists = await env.DB.prepare(
        `SELECT id FROM duty_projects WHERE name = ? AND id != ?`
      ).bind(name.trim(), id).first();
      if (exists) return jsonError('值班项目名称已存在', 400);
      await env.DB.prepare(`UPDATE duty_projects SET name = ? WHERE id = ?`)
        .bind(name.trim(), id).run();
    }
    if (order_index !== undefined) {
      await env.DB.prepare(`UPDATE duty_projects SET order_index = ? WHERE id = ?`)
        .bind(order_index, id).run();
    }
    return jsonSuccess({ message: '值班项目更新成功' });
  } catch (error) {
    return jsonError(error.message);
  }
}

export async function onRequestDelete({ request, env }) {
  const isAdmin = await verifyAdmin(request, env);
  if (!isAdmin) return jsonError('未授权访问', 401);
  try {
    const { id } = await request.json();
    if (!id) return jsonError('缺少值班项目 ID', 400);

    await env.DB.prepare(`DELETE FROM duty_projects WHERE id = ?`).bind(id).run();
    return jsonSuccess({ message: '值班项目已删除' });
  } catch (error) {
    return jsonError(error.message);
  }
}
