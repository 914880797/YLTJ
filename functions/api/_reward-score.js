import { jsonSuccess, jsonError, formatBeijingNow } from './_shared.js';

export async function previewRewardScore(env, targetDate) {
  let recordDate;
  if (targetDate && /^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
    recordDate = targetDate;
  } else {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    recordDate = `${y}-${m}-${d}`;
  }

  const { results: configs } = await env.DB.prepare(
    `SELECT rsp.persons, rsp.reward_project_id,
            rp.name as reward_project_name, rp.score_weight as project_score_weight,
            rp.bind_group_id, g.name as bind_group_name, g.score_weight as group_score_weight, g.has_slots
     FROM reward_slot_persons rsp
     LEFT JOIN reward_projects rp ON rsp.reward_project_id = rp.id
     LEFT JOIN groups g ON rp.bind_group_id = g.id
     WHERE rp.bind_group_id IS NOT NULL`
  ).all();

  if (!configs || configs.length === 0) {
    const { results: diag } = await env.DB.prepare(
      `SELECT id, name, bind_group_id FROM reward_projects`
    ).all();
    return {
      message: '未找到需要加分的人员配置',
      active: [],
      excluded: [],
      activeCount: 0,
      excludedCount: 0,
      debug: { projects: (diag || []).map(p => ({ name: p.name, bind_group_id: p.bind_group_id })) }
    };
  }

  const activeList = [];
  const excludedList = [];
  const seenActive = new Set();
  const seenExcluded = new Set();

  for (const cfg of configs) {
    const rawNames = cfg.persons.split(/[,，、\n\r]+/).map(n => n.trim()).filter(n => n);
    const label = `${cfg.reward_project_name} > ${cfg.bind_group_name}`;
    const scoreWeight = cfg.project_score_weight || cfg.group_score_weight || 1;

    for (const name of rawNames) {
      if (name.startsWith('-')) {
        const realName = name.substring(1);
        const key = `${realName}::${cfg.reward_project_id}`;
        if (!seenExcluded.has(key)) {
          seenExcluded.add(key);
          excludedList.push({ name: realName, source: label, reward_project_id: cfg.reward_project_id });
        }
      } else {
        const key = `${name}::${cfg.reward_project_id}`;
        if (!seenActive.has(key)) {
          seenActive.add(key);
          activeList.push({ name, source: label, score: scoreWeight });
        }
      }
    }
  }

  return {
    active: activeList,
    excluded: excludedList,
    activeCount: activeList.length,
    excludedCount: excludedList.length,
    date: recordDate
  };
}

export async function autoScoreReward(env, targetDate) {
  let recordDate;
  if (targetDate && /^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
    recordDate = targetDate;
  } else {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    recordDate = `${y}-${m}-${d}`;
  }
  const now = formatBeijingNow();

  const { results: configs } = await env.DB.prepare(
    `SELECT rsp.persons, rsp.reward_project_id,
            rp.name as reward_project_name, rp.score_weight as project_score_weight,
            rp.bind_group_id, g.score_weight as group_score_weight, g.has_slots
     FROM reward_slot_persons rsp
     LEFT JOIN reward_projects rp ON rsp.reward_project_id = rp.id
     LEFT JOIN groups g ON rp.bind_group_id = g.id
     WHERE rp.bind_group_id IS NOT NULL`
  ).all();

  if (!configs || configs.length === 0) {
    const { results: diag } = await env.DB.prepare(
      `SELECT id, name, bind_group_id FROM reward_projects`
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
    const weight = cfg.project_score_weight || cfg.group_score_weight || 1;
    const groupId = cfg.bind_group_id;

    const cacheKey = `${groupId}_reward_${cfg.reward_project_id}`;
    if (!slotCache[cacheKey]) {
      if (cfg.has_slots === 0) {
        const slotName = cfg.reward_project_name;
        const existing = await env.DB.prepare(
          `SELECT id FROM time_slots WHERE group_id = ? AND name = ?`
        ).bind(groupId, slotName).first();
        if (existing) {
          slotCache[cacheKey] = [existing.id];
        } else {
          await env.DB.prepare(
            `INSERT INTO time_slots (group_id, name, time_range, order_index, source) VALUES (?, ?, '全天', 0, 'auto-reward')`
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

  return { message: `已为(${recordDate})奖励加分: ${imported} 条记录`, imported, errors, debug: { configCount: (configs || []).length, date: recordDate } };
}
