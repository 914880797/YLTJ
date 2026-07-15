import { jsonSuccess, jsonError, verifyAdmin, formatBeijingNow, pad } from './_shared.js';

export async function onRequestPost({ request, env }) {
  const isAdmin = await verifyAdmin(request, env);
  if (!isAdmin) return jsonError('未授权访问', 401);
  try {
    const data = await request.json();
    const { rows } = data;
    if (!rows || !Array.isArray(rows) || rows.length === 0) return jsonError('没有可导入的数据', 400);

    const { results: groups } = await env.DB.prepare(
      `SELECT g.*, ts.id as slot_id, ts.name as slot_name, ts.time_range
       FROM groups g LEFT JOIN time_slots ts ON ts.group_id = g.id`
    ).all();

    const groupSlotMap = {};
    for (const g of (groups || [])) {
      if (!g.slot_id) continue;
      const key = `${g.name}-${g.slot_name || g.time_range}`;
      groupSlotMap[key] = { group_id: g.id, slot_id: g.slot_id };
    }

    const errors = [];
    let imported = 0;
    const bjTimestamp = Date.now() + 8 * 60 * 60 * 1000;
    const bjDate = new Date(bjTimestamp);
    const today = `${bjDate.getUTCFullYear()}-${pad(bjDate.getUTCMonth() + 1)}-${pad(bjDate.getUTCDate())}`;
    const created_at = formatBeijingNow();
    const batch = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const personName = (row.person_name || row.name || '').trim();
      const groupName = (row.group_name || row.group || '').trim();
      const slotName = (row.slot_name || row.slot || '').trim();
      const score = parseFloat(row.score) || 0;
      const recordDate = row.record_date || row.date || today;

      if (!personName || !groupName || !slotName) {
        errors.push({ row: i + 2, message: '姓名、分组、时段不能为空' });
        continue;
      }

      const key = `${groupName}-${slotName}`;
      const mapping = groupSlotMap[key];
      if (!mapping) {
        errors.push({ row: i + 2, message: `分组-时段 '${key}' 不存在` });
        continue;
      }

      batch.push(
        env.DB.prepare(
          `INSERT OR REPLACE INTO score_records (person_name, group_id, slot_id, score, record_date, created_at, import_batch)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        ).bind(personName, mapping.group_id, mapping.slot_id, score, recordDate, created_at, created_at)
      );
      imported++;
    }

    if (batch.length > 0) {
      await env.DB.batch(batch);
    }

    return jsonSuccess({
      imported,
      total: rows.length,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    return jsonError(error.message);
  }
}
