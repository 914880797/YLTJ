import { jsonSuccess, jsonError, verifyAdmin, formatBeijingNow } from './_shared.js';
import { runMigrations } from './_migrate.js';

export async function onRequestGet({ env }) {
  try {
    await runMigrations(env);

    const { results } = await env.DB.prepare(
       `SELECT g.*, (SELECT COUNT(*) FROM time_slots WHERE group_id = g.id AND (source IS NULL OR source = 'groups')) as slot_count
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
    const body = await request.json();
    const { type } = body;

    if (type === 'smart-import') {
      return handleGroupSmartImport(body, env);
    }

    const { name, order_index, score_weight, has_slots } = body;    if (!name || !name.trim()) return jsonError('分组名称不能为空', 400);

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
          `INSERT INTO time_slots (group_id, name, time_range, order_index, source) VALUES (?, '默认', '全天', 0, 'groups')`
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
            `INSERT INTO time_slots (group_id, name, time_range, order_index, source) VALUES (?, '默认', '全天', 0, 'groups')`
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

async function handleGroupSmartImport(body, env) {
  const { group_id, slot_id, names, record_date } = body;
  if (!group_id) return jsonError('缺少分组 ID', 400);
  if (!names || !Array.isArray(names) || names.length === 0) return jsonError('缺少人员名单', 400);

  if (slot_id) {
    const slot = await env.DB.prepare(
      `SELECT id FROM time_slots WHERE id = ? AND group_id = ?`
    ).bind(slot_id, group_id).first();
    if (!slot) return jsonError('时段不存在或不属于该分组', 400);
  }

  const group = await env.DB.prepare(
    `SELECT id, name, score_weight, has_slots FROM groups WHERE id = ?`
  ).bind(group_id).first();

  if (!group) return jsonError('分组不存在', 400);

  const weight = group.score_weight || 1;
  const now = formatBeijingNow();

  let slot;
  if (slot_id) {
    slot = { id: slot_id };
  } else {
    const slotName = group.name;
    let found = await env.DB.prepare(
      `SELECT id FROM time_slots WHERE group_id = ? AND name = ?`
    ).bind(group_id, slotName).first();
    if (!found) {
      await env.DB.prepare(
        `INSERT INTO time_slots (group_id, name, time_range, order_index, source) VALUES (?, ?, ?, 0, 'groups')`
      ).bind(group_id, slotName, group.has_slots ? slotName : '全天').run();
      found = await env.DB.prepare(
        `SELECT id FROM time_slots WHERE group_id = ? AND name = ?`
      ).bind(group_id, slotName).first();
    }
    slot = found;
  }

  if (!slot) return jsonError('无法创建时段', 400);

  let imported = 0;
  const batch = [];

  for (const name of names) {
    const exists = await env.DB.prepare(
      `SELECT id FROM score_records WHERE person_name = ? AND group_id = ? AND slot_id = ? AND record_date = ?`
    ).bind(name, group_id, slot.id, record_date).first();
    if (exists) continue;

    batch.push(
      env.DB.prepare(
        `INSERT INTO score_records (person_name, group_id, slot_id, score, record_date, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).bind(name, group_id, slot.id, weight, record_date, now)
    );
    imported++;
  }

  if (batch.length > 0) {
    await env.DB.batch(batch);
  }

  return jsonSuccess({
    message: `成功导入 ${imported} 条记录`,
    imported
  });
}
