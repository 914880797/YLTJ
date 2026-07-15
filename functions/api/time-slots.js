import { jsonSuccess, jsonError, verifyAdmin } from './_shared.js';

export async function onRequestGet({ request, env }) {
  try {
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const groupId = pathParts[pathParts.indexOf('groups') + 1];

    if (groupId) {
      const { results } = await env.DB.prepare(
        `SELECT * FROM time_slots WHERE group_id = ? ORDER BY order_index ASC, id ASC`
      ).bind(groupId).all();
      return jsonSuccess({ data: results || [] });
    }

    const { results } = await env.DB.prepare(
      `SELECT ts.*, g.name as group_name FROM time_slots ts
       LEFT JOIN groups g ON ts.group_id = g.id
       ORDER BY g.order_index, ts.order_index`
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
    const { group_id, name, time_range, order_index } = await request.json();
    if (!group_id) return jsonError('缺少分组 ID', 400);
    if (!time_range || !time_range.trim()) return jsonError('时段范围不能为空', 400);

    const slotName = name || time_range;

    const exists = await env.DB.prepare(
      `SELECT id FROM time_slots WHERE group_id = ? AND name = ?`
    ).bind(group_id, slotName).first();
    if (exists) return jsonError('该时段已存在', 400);

    const result = await env.DB.prepare(
      `INSERT INTO time_slots (group_id, name, time_range, order_index) VALUES (?, ?, ?, ?)`
    ).bind(group_id, slotName, time_range.trim(), order_index || 0).run();

    return jsonSuccess({ message: '时段添加成功', id: result.meta?.last_row_id });
  } catch (error) {
    return jsonError(error.message);
  }
}

export async function onRequestPut({ request, env }) {
  const isAdmin = await verifyAdmin(request, env);
  if (!isAdmin) return jsonError('未授权访问', 401);
  try {
    const { id, name, time_range, order_index } = await request.json();
    if (!id) return jsonError('缺少时段 ID', 400);

    if (time_range && time_range.trim()) {
      await env.DB.prepare(
        `UPDATE time_slots SET time_range = ?, name = COALESCE(?, name), order_index = COALESCE(?, order_index) WHERE id = ?`
      ).bind(time_range.trim(), name || time_range.trim(), order_index, id).run();
    } else if (order_index !== undefined) {
      await env.DB.prepare(
        `UPDATE time_slots SET order_index = ? WHERE id = ?`
      ).bind(order_index, id).run();
    }

    return jsonSuccess({ message: '时段更新成功' });
  } catch (error) {
    return jsonError(error.message);
  }
}

export async function onRequestDelete({ request, env }) {
  const isAdmin = await verifyAdmin(request, env);
  if (!isAdmin) return jsonError('未授权访问', 401);
  try {
    const { id } = await request.json();
    if (!id) return jsonError('缺少时段 ID', 400);

    await env.DB.prepare(`DELETE FROM time_slots WHERE id = ?`).bind(id).run();
    return jsonSuccess({ message: '时段删除成功' });
  } catch (error) {
    return jsonError(error.message);
  }
}
