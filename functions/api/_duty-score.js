import { jsonSuccess, jsonError, formatBeijingNow } from './_shared.js';

export async function autoScoreDuty(env, targetDate) {
  let recordDate, y, m, d;
  if (targetDate && /^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
    recordDate = targetDate;
  } else {
    const today = new Date();
    y = today.getFullYear();
    m = String(today.getMonth() + 1).padStart(2, '0');
    d = String(today.getDate()).padStart(2, '0');
    recordDate = `${y}-${m}-${d}`;
  }
  const now = formatBeijingNow();

  const { results: configs } = await env.DB.prepare(
    `SELECT dsp.persons, dsp.duty_group_id, dg.name as duty_group_name,
            dp.id as duty_project_id, dp.name as duty_project_name,
            dp.bind_group_id, g.score_weight, g.has_slots
     FROM duty_slot_persons dsp
     LEFT JOIN duty_groups dg ON dsp.duty_group_id = dg.id
     LEFT JOIN duty_projects dp ON dg.duty_project_id = dp.id
     LEFT JOIN groups g ON dp.bind_group_id = g.id
     WHERE dp.bind_group_id IS NOT NULL`
  ).all();

  if (!configs || configs.length === 0) {
    const { results: diag } = await env.DB.prepare(
      `SELECT id, name, bind_group_id FROM duty_projects`
    ).all();
    return {
      message: `未找到需要加分的人员配置`,
      imported: 0,
      debug: {
        configCount: 0,
        date: recordDate,
        projects: (diag || []).map(p => ({ name: p.name, bind_group_id: p.bind_group_id }))
      }
    };
  }

  let imported = 0;
  const errors = [];
  const slotCache = {};

  for (const cfg of (configs || [])) {
    const names = cfg.persons.split(/[,，、\n\r]+/).map(n => n.trim()).filter(n => n && !n.startsWith('-'));
    const weight = cfg.score_weight || 1;
    const groupId = cfg.bind_group_id;

    const cacheKey = `${groupId}_dutygroup_${cfg.duty_group_id}`;
    if (!slotCache[cacheKey]) {
      if (cfg.has_slots === 0) {
        const slotName = `${cfg.duty_project_name}_${cfg.duty_group_name}`;
        const existing = await env.DB.prepare(
          `SELECT id FROM time_slots WHERE group_id = ? AND name = ?`
        ).bind(groupId, slotName).first();
        if (existing) {
          slotCache[cacheKey] = [existing.id];
        } else {
          await env.DB.prepare(
            `INSERT INTO time_slots (group_id, name, time_range, order_index) VALUES (?, ?, '全天', 0)`
          ).bind(groupId, slotName).run();
          const slot = await env.DB.prepare(
            `SELECT id FROM time_slots WHERE group_id = ? AND name = ?`
          ).bind(groupId, slotName).first();
          slotCache[cacheKey] = slot ? [slot.id] : [];
        }
      } else {
        const { results: slots } = await env.DB.prepare(
          `SELECT id FROM time_slots WHERE group_id = ?`
        ).bind(groupId).all();
        slotCache[cacheKey] = (slots || []).map(s => s.id);
      }
    }

    const slotIds = slotCache[cacheKey] || [];
    if (slotIds.length === 0) continue;

    for (const name of names) {
      for (const slotId of slotIds) {
        try {
          const existing = await env.DB.prepare(
            `SELECT id FROM score_records WHERE person_name = ? AND group_id = ? AND slot_id = ? AND record_date = ?`
          ).bind(name, groupId, slotId, recordDate).first();
          if (existing) continue;

          await env.DB.prepare(
            `INSERT INTO score_records (person_name, group_id, slot_id, score, record_date, created_at)
             VALUES (?, ?, ?, ?, ?, ?)`
          ).bind(name, groupId, slotId, weight, recordDate, now).run();
          imported++;
        } catch (e) {
          errors.push({ person: name, message: e.message });
        }
      }
    }
  }

  return { message: `已为今日(${recordDate})加分: ${imported} 条记录`, imported, errors, debug: { configCount: (configs || []).length, date: recordDate } };
}
