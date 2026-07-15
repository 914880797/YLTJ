import { jsonSuccess, jsonError, verifyAdmin, formatBeijingNow, pad } from './_shared.js';

export async function onRequestGet({ request, env }) {
  try {
    const url = new URL(request.url);
    if (url.pathname.endsWith('/cross-table')) {
      return getCrossTable(request, env);
    }

    const name = url.searchParams.get('name');
    const groupId = url.searchParams.get('group_id');
    const slotId = url.searchParams.get('slot_id');
    const startDate = url.searchParams.get('start_date');
    const endDate = url.searchParams.get('end_date');

    let sql = `SELECT sr.*, g.name as group_name, ts.name as slot_name, ts.time_range
               FROM score_records sr
               LEFT JOIN groups g ON sr.group_id = g.id
               LEFT JOIN time_slots ts ON sr.slot_id = ts.id
               WHERE 1=1`;
    const args = [];

    if (name) { sql += ` AND sr.person_name LIKE ?`; args.push(`%${name}%`); }
    if (groupId) { sql += ` AND sr.group_id = ?`; args.push(groupId); }
    if (slotId) { sql += ` AND sr.slot_id = ?`; args.push(slotId); }
    if (startDate) { sql += ` AND sr.record_date >= ?`; args.push(startDate); }
    if (endDate) { sql += ` AND sr.record_date <= ?`; args.push(endDate); }

    sql += ` ORDER BY sr.record_date DESC, sr.created_at DESC`;

    const { results } = await env.DB.prepare(sql).bind(...args).all();
    return jsonSuccess({ data: results || [] });
  } catch (error) {
    return jsonError(error.message);
  }
}

async function getCrossTable(request, env) {
  try {
    const url = new URL(request.url);
    const name = url.searchParams.get('name');
    const groupId = url.searchParams.get('group_id');
    const startDate = url.searchParams.get('start_date');
    const endDate = url.searchParams.get('end_date');

    const { results: groups } = await env.DB.prepare(
      `SELECT g.*, ts.id as slot_id, ts.name as slot_name, ts.time_range
       FROM groups g
       LEFT JOIN time_slots ts ON ts.group_id = g.id
       ORDER BY g.order_index, ts.order_index`
    ).all();

    let recordWhere = '1=1';
    const recordArgs = [];
    if (name) { recordWhere += ' AND sr.person_name LIKE ?'; recordArgs.push(`%${name}%`); }
    if (groupId) { recordWhere += ' AND sr.group_id = ?'; recordArgs.push(groupId); }
    if (startDate) { recordWhere += ' AND sr.record_date >= ?'; recordArgs.push(startDate); }
    if (endDate) { recordWhere += ' AND sr.record_date <= ?'; recordArgs.push(endDate); }

    const { results: records } = await env.DB.prepare(
      `SELECT person_name, group_id, slot_id, score FROM score_records sr WHERE ${recordWhere}`
    ).bind(...recordArgs).all();

    const columns = (groups || []).map(g => ({
      group_id: g.id,
      group_name: g.name,
      slot_id: g.slot_id,
      slot_name: g.slot_name || g.time_range,
      label: g.slot_id ? `${g.name}-${g.slot_name || g.time_range}` : null
    })).filter(c => c.slot_id);

    const scoreMap = {};
    for (const r of (records || [])) {
      const key = `${r.person_name}::${r.group_id}::${r.slot_id}`;
      scoreMap[key] = r.score || 0;
    }

    const personMap = {};
    for (const r of (records || [])) {
      if (!personMap[r.person_name]) personMap[r.person_name] = {};
      for (const col of columns) {
        if (col.group_id === r.group_id && col.slot_id === r.slot_id) {
          personMap[r.person_name][col.label] = r.score || 0;
        }
      }
    }

    const rows = Object.entries(personMap).map(([name, scores]) => {
      const row = { name, scores: {} };
      for (const col of columns) {
        row.scores[col.label] = scores[col.label] !== undefined ? scores[col.label] : null;
      }
      return row;
    });

    return jsonSuccess({ columns, rows });
  } catch (error) {
    return jsonError(error.message);
  }
}

export async function onRequestPost({ request, env }) {
  const isAdmin = await verifyAdmin(request, env);
  if (!isAdmin) return jsonError('未授权访问', 401);
  try {
    const { person_name, group_id, slot_id, score, record_date } = await request.json();
    if (!person_name || !person_name.trim()) return jsonError('姓名不能为空', 400);
    if (!group_id) return jsonError('缺少分组', 400);
    if (!slot_id) return jsonError('缺少时段', 400);
    if (!record_date) return jsonError('缺少日期', 400);

    const date = record_date;
    const created_at = formatBeijingNow();

    const existing = await env.DB.prepare(
      `SELECT id FROM score_records WHERE person_name = ? AND group_id = ? AND slot_id = ? AND record_date = ?`
    ).bind(person_name.trim(), group_id, slot_id, date).first();

    if (existing) {
      await env.DB.prepare(
        `UPDATE score_records SET score = ?, created_at = ? WHERE id = ?`
      ).bind(score || 0, created_at, existing.id).run();
      return jsonSuccess({ message: '记录已更新' });
    }

    await env.DB.prepare(
      `INSERT INTO score_records (person_name, group_id, slot_id, score, record_date, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(person_name.trim(), group_id, slot_id, score || 0, date, created_at).run();

    return jsonSuccess({ message: '记录添加成功' });
  } catch (error) {
    return jsonError(error.message);
  }
}

export async function onRequestPut({ request, env }) {
  const isAdmin = await verifyAdmin(request, env);
  if (!isAdmin) return jsonError('未授权访问', 401);
  try {
    const { id, score } = await request.json();
    if (!id) return jsonError('缺少记录 ID', 400);

    await env.DB.prepare(
      `UPDATE score_records SET score = ? WHERE id = ?`
    ).bind(score || 0, id).run();
    return jsonSuccess({ message: '记录更新成功' });
  } catch (error) {
    return jsonError(error.message);
  }
}

export async function onRequestDelete({ request, env }) {
  const isAdmin = await verifyAdmin(request, env);
  if (!isAdmin) return jsonError('未授权访问', 401);
  try {
    const { id } = await request.json();
    if (!id) return jsonError('缺少记录 ID', 400);

    await env.DB.prepare(`DELETE FROM score_records WHERE id = ?`).bind(id).run();
    return jsonSuccess({ message: '记录删除成功' });
  } catch (error) {
    return jsonError(error.message);
  }
}
