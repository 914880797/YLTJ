import { formatBeijingNow } from './_shared.js';

function resolveDate(targetDate) {
  if (targetDate && /^\d{4}-\d{2}-\d{2}$/.test(targetDate)) return targetDate;
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
}

export const SCORE_TYPES = {
  duty: {
    configQuery:
      `SELECT dsp.persons, dsp.duty_group_id, dg.name as duty_group_name,
              dp.id as duty_project_id, dp.name as duty_project_name,
              dp.bind_group_id, g.name as bind_group_name, g.score_weight, g.has_slots
       FROM duty_slot_persons dsp
       LEFT JOIN duty_groups dg ON dsp.duty_group_id = dg.id
       LEFT JOIN duty_projects dp ON dg.duty_project_id = dp.id
       LEFT JOIN groups g ON dp.bind_group_id = g.id
       WHERE dp.bind_group_id IS NOT NULL`,
    diagTable: 'duty_projects',
    getLabel: cfg => `${cfg.duty_project_name} > ${cfg.duty_group_name} > ${cfg.bind_group_name}`,
    getWeight: cfg => cfg.score_weight || 1,
    getCacheKey: (groupId, cfg) => `${groupId}_dutygroup_${cfg.duty_group_id}`,
    getSlotName: cfg => `${cfg.duty_project_name}_${cfg.duty_group_name}`,
    sourceTag: 'auto-duty',
    projectIdKey: 'duty_project_id',
    successMsg: (date, count) => `已为今日(${date})值班加分: ${count} 条记录`,
  },
  reward: {
    configQuery:
      `SELECT rsp.persons, rsp.reward_project_id,
              rp.name as reward_project_name, rp.score_weight as project_score_weight,
              rp.bind_group_id, g.name as bind_group_name, g.score_weight as group_score_weight, g.has_slots
       FROM reward_slot_persons rsp
       LEFT JOIN reward_projects rp ON rsp.reward_project_id = rp.id
       LEFT JOIN groups g ON rp.bind_group_id = g.id
       WHERE rp.bind_group_id IS NOT NULL`,
    diagTable: 'reward_projects',
    getLabel: cfg => `${cfg.reward_project_name} > ${cfg.bind_group_name}`,
    getWeight: cfg => cfg.project_score_weight || cfg.group_score_weight || 1,
    getCacheKey: (groupId, cfg) => `${groupId}_reward_${cfg.reward_project_id}`,
    getSlotName: cfg => cfg.reward_project_name,
    sourceTag: 'auto-reward',
    projectIdKey: 'reward_project_id',
    successMsg: (date, count) => `已为(${date})奖励加分: ${count} 条记录`,
  },
  warmup: {
    configQuery:
      `SELECT dsp.persons, dsp.warmup_group_id, dg.name as warmup_group_name,
              dp.id as warmup_project_id, dp.name as warmup_project_name,
              dp.bind_group_id, g.name as bind_group_name, g.score_weight, g.has_slots
       FROM warmup_slot_persons dsp
       LEFT JOIN warmup_groups dg ON dsp.warmup_group_id = dg.id
       LEFT JOIN warmup_projects dp ON dg.warmup_project_id = dp.id
       LEFT JOIN groups g ON dp.bind_group_id = g.id
       WHERE dp.bind_group_id IS NOT NULL`,
    diagTable: 'warmup_projects',
    getLabel: cfg => `${cfg.warmup_project_name} > ${cfg.warmup_group_name} > ${cfg.bind_group_name}`,
    getWeight: cfg => cfg.score_weight || 1,
    getCacheKey: (groupId, cfg) => `${groupId}_warmupgroup_${cfg.warmup_group_id}`,
    getSlotName: cfg => `${cfg.warmup_project_name}_${cfg.warmup_group_name}`,
    sourceTag: 'auto-warmup',
    projectIdKey: 'warmup_project_id',
    successMsg: (date, count) => `已为今日(${date})预热加分: ${count} 条记录`,
  },
};

export async function previewAutoScore(env, targetDate, typeCfg) {
  const recordDate = resolveDate(targetDate);
  const { results: configs } = await env.DB.prepare(typeCfg.configQuery).all();

  if (!configs || configs.length === 0) {
    const { results: diag } = await env.DB.prepare(
      `SELECT id, name, bind_group_id FROM ${typeCfg.diagTable}`
    ).all();
    return {
      message: '未找到需要加分的人员配置',
      active: [], excluded: [],
      activeCount: 0, excludedCount: 0,
      debug: { projects: (diag || []).map(p => ({ name: p.name, bind_group_id: p.bind_group_id })) }
    };
  }

  const activeList = [], excludedList = [];
  const seenActive = new Set(), seenExcluded = new Set();

  for (const cfg of configs) {
    const rawNames = cfg.persons.split(/[,，、\n\r]+/).map(n => n.trim()).filter(n => n);
    const label = typeCfg.getLabel(cfg);
    const pid = cfg[typeCfg.projectIdKey];

    for (const name of rawNames) {
      if (name.startsWith('-')) {
        const realName = name.substring(1);
        const key = `${realName}::${pid}`;
        if (!seenExcluded.has(key)) {
          seenExcluded.add(key);
          excludedList.push({ name: realName, source: label, [typeCfg.projectIdKey]: pid });
        }
      } else {
        const key = `${name}::${pid}`;
        if (!seenActive.has(key)) {
          seenActive.add(key);
          activeList.push({ name, source: label, score: typeCfg.getWeight(cfg) });
        }
      }
    }
  }

  return {
    active: activeList, excluded: excludedList,
    activeCount: activeList.length, excludedCount: excludedList.length,
    date: recordDate
  };
}

export async function autoScore(env, targetDate, typeCfg) {
  const recordDate = resolveDate(targetDate);
  const now = formatBeijingNow();

  const { results: configs } = await env.DB.prepare(typeCfg.configQuery).all();

  if (!configs || configs.length === 0) {
    const { results: diag } = await env.DB.prepare(
      `SELECT id, name, bind_group_id FROM ${typeCfg.diagTable}`
    ).all();
    return {
      message: '未找到需要加分的人员配置',
      imported: 0,
      debug: { configCount: 0, date: recordDate, projects: (diag || []).map(p => ({ name: p.name, bind_group_id: p.bind_group_id })) }
    };
  }

  let imported = 0;
  const errors = [];
  const slotCache = {};

  for (const cfg of configs) {
    const names = cfg.persons.split(/[,，、\n\r]+/).map(n => n.trim()).filter(n => n && !n.startsWith('-'));
    const weight = typeCfg.getWeight(cfg);
    const groupId = cfg.bind_group_id;
    const cacheKey = typeCfg.getCacheKey(groupId, cfg);

    if (!slotCache[cacheKey]) {
      if (cfg.has_slots === 0) {
        const slotName = typeCfg.getSlotName(cfg);
        const existing = await env.DB.prepare(
          'SELECT id FROM time_slots WHERE group_id = ? AND name = ?'
        ).bind(groupId, slotName).first();
        if (existing) {
          slotCache[cacheKey] = [existing.id];
        } else {
          await env.DB.prepare(
            'INSERT INTO time_slots (group_id, name, time_range, order_index, source) VALUES (?, ?, \'全天\', 0, ?)'
          ).bind(groupId, slotName, typeCfg.sourceTag).run();
          const slot = await env.DB.prepare(
            'SELECT id FROM time_slots WHERE group_id = ? AND name = ?'
          ).bind(groupId, slotName).first();
          slotCache[cacheKey] = slot ? [slot.id] : [];
        }
      } else {
        const { results: slots } = await env.DB.prepare(
          'SELECT id FROM time_slots WHERE group_id = ?'
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
            'SELECT id FROM score_records WHERE person_name = ? AND group_id = ? AND slot_id = ? AND record_date = ?'
          ).bind(name, groupId, slotId, recordDate).first();
          if (existing) continue;

          await env.DB.prepare(
            'INSERT INTO score_records (person_name, group_id, slot_id, score, record_date, created_at) VALUES (?, ?, ?, ?, ?, ?)'
          ).bind(name, groupId, slotId, weight, recordDate, now).run();
          imported++;
        } catch (e) {
          errors.push({ person: name, message: e.message });
        }
      }
    }
  }

  return { message: typeCfg.successMsg(recordDate, imported), imported, errors, debug: { configCount: (configs || []).length, date: recordDate } };
}
