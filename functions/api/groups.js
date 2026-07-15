import { jsonSuccess, jsonError, verifyAdmin } from './_shared.js';

export async function onRequestGet({ env }) {
  try {
    const { results } = await env.DB.prepare(
      `SELECT g.*, (SELECT COUNT(*) FROM time_slots WHERE group_id = g.id) as slot_count
       FROM groups g ORDER BY g.order_index ASC, g.id ASC`
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
    const { name, order_index, score_weight, has_slots } = await request.json();
    if (!name || !name.trim()) return jsonError('分组名称不能为空', 400);

    const exists = await env.DB.prepare(
      `SELECT id FROM groups WHERE name = ?`
    ).bind(name.trim()).first();
    if (exists) return jsonError('分组名称已存在', 400);

    await env.DB.prepare(
      `INSERT INTO groups (name, order_index, score_weight, has_slots) VALUES (?, ?, ?, ?)`
    ).bind(name.trim(), order_index || 0, score_weight !== undefined ? score_weight : 1, has_slots !== undefined ? has_slots : 1).run();

    if ((has_slots !== undefined ? has_slots : 1) === 0) {
      const groupResult = await env.DB.prepare(
        `SELECT id FROM groups WHERE name = ?`
      ).bind(name.trim()).first();
      if (groupResult) {
        await env.DB.prepare(
          `INSERT INTO time_slots (group_id, name, time_range, order_index) VALUES (?, '默认', '全天', 0)`
        ).bind(groupResult.id).run();
      }
    }

    return jsonSuccess({ message: '分组创建成功' });
  } catch (error) {
    return jsonError(error.message);
  }
}

export async function onRequestPut({ request, env }) {
  const isAdmin = await verifyAdmin(request, env);
  if (!isAdmin) return jsonError('未授权访问', 401);
  try {
    const { id, name, order_index, score_weight, has_slots } = await request.json();
    if (!id) return jsonError('缺少分组 ID', 400);

    if (name && name.trim()) {
      const exists = await env.DB.prepare(
        `SELECT id FROM groups WHERE name = ? AND id != ?`
      ).bind(name.trim(), id).first();
      if (exists) return jsonError('分组名称已存在', 400);
      await env.DB.prepare(`UPDATE groups SET name = ? WHERE id = ?`)
        .bind(name.trim(), id).run();
    }
    if (order_index !== undefined) {
      await env.DB.prepare(`UPDATE groups SET order_index = ? WHERE id = ?`)
        .bind(order_index, id).run();
    }
    if (score_weight !== undefined) {
      await env.DB.prepare(`UPDATE groups SET score_weight = ? WHERE id = ?`)
        .bind(score_weight, id).run();
    }
    if (has_slots !== undefined) {
      await env.DB.prepare(`UPDATE groups SET has_slots = ? WHERE id = ?`)
        .bind(has_slots, id).run();
      if (has_slots === 0) {
        const existingSlot = await env.DB.prepare(
          `SELECT id FROM time_slots WHERE group_id = ? LIMIT 1`
        ).bind(id).first();
        if (!existingSlot) {
          await env.DB.prepare(
            `INSERT INTO time_slots (group_id, name, time_range, order_index) VALUES (?, '默认', '全天', 0)`
          ).bind(id).run();
        }
      }
    }
    return jsonSuccess({ message: '分组更新成功' });
  } catch (error) {
    return jsonError(error.message);
  }
}

export async function onRequestDelete({ request, env }) {
  const isAdmin = await verifyAdmin(request, env);
  if (!isAdmin) return jsonError('未授权访问', 401);
  try {
    const { id } = await request.json();
    if (!id) return jsonError('缺少分组 ID', 400);

    const inUse = await env.DB.prepare(
      `SELECT id FROM score_records WHERE group_id = ? LIMIT 1`
    ).bind(id).first();
    if (inUse) return jsonError('该分组下有记录数据，无法删除', 400);

    await env.DB.prepare(`DELETE FROM groups WHERE id = ?`).bind(id).run();
    return jsonSuccess({ message: '分组删除成功' });
  } catch (error) {
    return jsonError(error.message);
  }
}
