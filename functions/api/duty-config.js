import { jsonSuccess, jsonError, verifyAdmin, formatBeijingNow } from './_shared.js';

export async function onRequestGet({ request, env }) {
  try {
    const url = new URL(request.url);
    const dutyProjectId = url.searchParams.get('duty_project_id');

    let projectWhere = '';
    const projectArgs = [];
    if (dutyProjectId) {
      projectWhere = 'WHERE dp.id = ?';
      projectArgs.push(dutyProjectId);
    }

    const { results: projects } = await env.DB.prepare(
      `SELECT * FROM duty_projects ${projectWhere} ORDER BY order_index ASC, id ASC`
    ).bind(...projectArgs).all();

    if (!projects || projects.length === 0) return jsonSuccess({ data: [] });

    const projectIds = projects.map(p => p.id);
    const placeholders = projectIds.map(() => '?').join(',');

    const { results: dutyGroups } = await env.DB.prepare(
      `SELECT dg.*, g.name as group_name
       FROM duty_groups dg
       LEFT JOIN groups g ON dg.group_id = g.id
       WHERE dg.duty_project_id IN (${placeholders})
       ORDER BY dg.order_index ASC, dg.id ASC`
    ).bind(...projectIds).all();

    const groupIds = (dutyGroups || []).map(dg => dg.id);
    let allSlotPersons = [];
    if (groupIds.length > 0) {
      const gpPlaceholders = groupIds.map(() => '?').join(',');
      const { results } = await env.DB.prepare(
        `SELECT dsp.*, ts.name as slot_name, ts.time_range
         FROM duty_slot_persons dsp
         LEFT JOIN time_slots ts ON dsp.slot_id = ts.id
         WHERE dsp.duty_group_id IN (${gpPlaceholders})
         ORDER BY dsp.order_index ASC, dsp.id ASC`
      ).bind(...groupIds).all();
      allSlotPersons = results || [];
    }

    const data = projects.map(project => {
      const pGroups = (dutyGroups || []).filter(dg => dg.duty_project_id === project.id);
      const groups = pGroups.map(dg => {
        const slots = allSlotPersons.filter(sp => sp.duty_group_id === dg.id);
        return { ...dg, slots };
      });
      return { ...project, groups };
    });

    return jsonSuccess({ data });
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

    if (type === 'group') return addDutyGroup(body, env);
    if (type === 'slot') return addDutySlotPerson(body, env);
    if (type === 'auto-score') return autoScore(body, env);

    return jsonError('未知操作类型', 400);
  } catch (error) {
    return jsonError(error.message);
  }
}

export async function onRequestPut({ request, env }) {
  const isAdmin = await verifyAdmin(request, env);
  if (!isAdmin) return jsonError('未授权访问', 401);
  try {
    const body = await request.json();
    const { type } = body;

    if (type === 'group') return updateDutyGroup(body, env);
    if (type === 'slot') return updateDutySlotPerson(body, env);

    return jsonError('未知操作类型', 400);
  } catch (error) {
    return jsonError(error.message);
  }
}

export async function onRequestDelete({ request, env }) {
  const isAdmin = await verifyAdmin(request, env);
  if (!isAdmin) return jsonError('未授权访问', 401);
  try {
    const body = await request.json();
    const { type } = body;

    if (type === 'group' && body.id) {
      await env.DB.prepare(`DELETE FROM duty_groups WHERE id = ?`).bind(body.id).run();
      return jsonSuccess({ message: '分组关联已删除' });
    }
    if (type === 'slot' && body.id) {
      await env.DB.prepare(`DELETE FROM duty_slot_persons WHERE id = ?`).bind(body.id).run();
      return jsonSuccess({ message: '时段人员配置已删除' });
    }

    return jsonError('未知操作类型', 400);
  } catch (error) {
    return jsonError(error.message);
  }
}

async function addDutyGroup(body, env) {
  const { duty_project_id, group_id, order_index } = body;
  if (!duty_project_id) return jsonError('缺少值班项目 ID', 400);
  if (!group_id) return jsonError('缺少分组 ID', 400);

  const rootDutyProject = await env.DB.prepare(
    `SELECT id FROM duty_projects WHERE id = ?`
  ).bind(duty_project_id).first();
  if (!rootDutyProject) return jsonError('值班项目不存在', 400);

  const exists = await env.DB.prepare(
    `SELECT id FROM duty_groups WHERE duty_project_id = ? AND group_id = ?`
  ).bind(duty_project_id, group_id).first();
  if (exists) return jsonError('该分组已关联到此值班项目', 400);

  await env.DB.prepare(
    `INSERT INTO duty_groups (duty_project_id, group_id, order_index) VALUES (?, ?, ?)`
  ).bind(duty_project_id, group_id, order_index || 0).run();
  return jsonSuccess({ message: '分组关联成功' });
}

async function updateDutyGroup(body, env) {
  const { id, order_index } = body;
  if (!id) return jsonError('缺少分组关联 ID', 400);
  if (order_index !== undefined) {
    await env.DB.prepare(`UPDATE duty_groups SET order_index = ? WHERE id = ?`).bind(order_index, id).run();
  }
  return jsonSuccess({ message: '排序已更新' });
}

async function addDutySlotPerson(body, env) {
  const { duty_group_id, slot_id, persons, order_index } = body;
  if (!duty_group_id) return jsonError('缺少分组关联 ID', 400);
  if (!slot_id) return jsonError('缺少时段 ID', 400);
  if (!persons || !persons.trim()) return jsonError('缺少人员名单', 400);

  await env.DB.prepare(
    `INSERT INTO duty_slot_persons (duty_group_id, slot_id, persons, order_index) VALUES (?, ?, ?, ?)`
  ).bind(duty_group_id, slot_id, persons.trim(), order_index || 0).run();
  return jsonSuccess({ message: '时段人员配置成功' });
}

async function updateDutySlotPerson(body, env) {
  const { id, slot_id, persons, order_index } = body;
  if (!id) return jsonError('缺少配置 ID', 400);

  if (slot_id !== undefined) {
    await env.DB.prepare(`UPDATE duty_slot_persons SET slot_id = ? WHERE id = ?`).bind(slot_id, id).run();
  }
  if (persons !== undefined && persons.trim()) {
    await env.DB.prepare(`UPDATE duty_slot_persons SET persons = ? WHERE id = ?`).bind(persons.trim(), id).run();
  }
  if (order_index !== undefined) {
    await env.DB.prepare(`UPDATE duty_slot_persons SET order_index = ? WHERE id = ?`).bind(order_index, id).run();
  }
  return jsonSuccess({ message: '配置已更新' });
}

async function autoScore(body, env) {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  const recordDate = `${year}-${month}-${day}`;
  const now = formatBeijingNow();

  const { results: allConfigs } = await env.DB.prepare(
    `SELECT dsp.persons, dsp.slot_id, dg.group_id
     FROM duty_slot_persons dsp
     LEFT JOIN duty_groups dg ON dsp.duty_group_id = dg.id`
  ).all();

  const { results: groups } = await env.DB.prepare(`SELECT id, score_weight FROM groups`).all();
  const weightMap = {};
  for (const g of (groups || [])) weightMap[g.id] = g.score_weight || 1;

  let imported = 0;
  const errors = [];

  for (const cfg of (allConfigs || [])) {
    if (!cfg.slot_id || !cfg.persons) continue;
    const names = cfg.persons.split(/[,，、\n\r]+/).map(n => n.trim()).filter(n => n);
    const score = weightMap[cfg.group_id] || 1;

    for (const name of names) {
      try {
        const existing = await env.DB.prepare(
          `SELECT id FROM score_records WHERE person_name = ? AND group_id = ? AND slot_id = ? AND record_date = ?`
        ).bind(name, cfg.group_id, cfg.slot_id, recordDate).first();

        if (existing) continue;

        await env.DB.prepare(
          `INSERT INTO score_records (person_name, group_id, slot_id, score, record_date, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`
        ).bind(name, cfg.group_id, cfg.slot_id, score, recordDate, now).run();
        imported++;
      } catch (e) {
        errors.push({ person: name, message: e.message });
      }
    }
  }

  return jsonSuccess({ message: `已为今日(${recordDate})加分: ${imported} 条记录`, imported, errors });
}
