import { jsonSuccess, jsonError, verifyAdmin, formatBeijingNow } from './_shared.js';

export async function onRequestGet({ request, env }) {
  try {
    try { await env.DB.prepare(`ALTER TABLE duty_projects ADD COLUMN bind_group_id INTEGER`).run(); } catch (e) {}

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
    const pp = projectIds.map(() => '?').join(',');

    const { results: dutyGroups } = await env.DB.prepare(
      `SELECT * FROM duty_groups
       WHERE duty_project_id IN (${pp})
       ORDER BY order_index ASC, id ASC`
    ).bind(...projectIds).all();

    const groupIds = (dutyGroups || []).map(dg => dg.id);
    let allSlotPersons = [];
    if (groupIds.length > 0) {
      const gp = groupIds.map(() => '?').join(',');
      const { results } = await env.DB.prepare(
        `SELECT * FROM duty_slot_persons
         WHERE duty_group_id IN (${gp})
         ORDER BY order_index ASC, id ASC`
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
      return jsonSuccess({ message: '值班分组已删除' });
    }
    if (type === 'slot' && body.id) {
      await env.DB.prepare(`DELETE FROM duty_slot_persons WHERE id = ?`).bind(body.id).run();
      return jsonSuccess({ message: '人员配置已删除' });
    }

    return jsonError('未知操作类型', 400);
  } catch (error) {
    return jsonError(error.message);
  }
}

async function addDutyGroup(body, env) {
  const { duty_project_id, name, order_index } = body;
  if (!duty_project_id) return jsonError('缺少值班项目 ID', 400);
  if (!name || !name.trim()) return jsonError('值班分组名称不能为空', 400);

  const rootDutyProject = await env.DB.prepare(
    `SELECT id FROM duty_projects WHERE id = ?`
  ).bind(duty_project_id).first();
  if (!rootDutyProject) return jsonError('值班项目不存在', 400);

  await env.DB.prepare(
    `INSERT INTO duty_groups (duty_project_id, name, order_index) VALUES (?, ?, ?)`
  ).bind(duty_project_id, name.trim(), order_index || 0).run();
  return jsonSuccess({ message: '值班分组创建成功' });
}

async function updateDutyGroup(body, env) {
  const { id, name, order_index } = body;
  if (!id) return jsonError('缺少值班分组 ID', 400);

  if (name !== undefined && name.trim()) {
    await env.DB.prepare(`UPDATE duty_groups SET name = ? WHERE id = ?`).bind(name.trim(), id).run();
  }
  if (order_index !== undefined) {
    await env.DB.prepare(`UPDATE duty_groups SET order_index = ? WHERE id = ?`).bind(order_index, id).run();
  }
  return jsonSuccess({ message: '已更新' });
}

async function addDutySlotPerson(body, env) {
  const { duty_group_id, time_range, persons, order_index } = body;
  if (!duty_group_id) return jsonError('缺少值班分组 ID', 400);
  if (!time_range || !time_range.trim()) return jsonError('缺少时段范围', 400);
  if (!persons || !persons.trim()) return jsonError('缺少人员名单', 400);

  await env.DB.prepare(
    `INSERT INTO duty_slot_persons (duty_group_id, time_range, persons, order_index) VALUES (?, ?, ?, ?)`
  ).bind(duty_group_id, time_range.trim(), persons.trim(), order_index || 0).run();
  return jsonSuccess({ message: '人员配置成功' });
}

async function updateDutySlotPerson(body, env) {
  const { id, time_range, persons, order_index } = body;
  if (!id) return jsonError('缺少配置 ID', 400);

  if (time_range !== undefined && time_range.trim()) {
    await env.DB.prepare(`UPDATE duty_slot_persons SET time_range = ? WHERE id = ?`).bind(time_range.trim(), id).run();
  }
  if (persons !== undefined && persons.trim()) {
    await env.DB.prepare(`UPDATE duty_slot_persons SET persons = ? WHERE id = ?`).bind(persons.trim(), id).run();
  }
  if (order_index !== undefined) {
    await env.DB.prepare(`UPDATE duty_slot_persons SET order_index = ? WHERE id = ?`).bind(order_index, id).run();
  }
  return jsonSuccess({ message: '已更新' });
}

async function autoScore(body, env) {
  const today = new Date();
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, '0');
  const d = String(today.getDate()).padStart(2, '0');
  const recordDate = `${y}-${m}-${d}`;
  const now = formatBeijingNow();

  const { results: configs } = await env.DB.prepare(
    `SELECT dsp.persons, dp.bind_group_id, g.score_weight
     FROM duty_slot_persons dsp
     LEFT JOIN duty_groups dg ON dsp.duty_group_id = dg.id
     LEFT JOIN duty_projects dp ON dg.duty_project_id = dp.id
     LEFT JOIN groups g ON dp.bind_group_id = g.id
     WHERE dp.bind_group_id IS NOT NULL`
  ).all();

  let imported = 0;
  const errors = [];

  for (const cfg of (configs || [])) {
    const names = cfg.persons.split(/[,，、\n\r]+/).map(n => n.trim()).filter(n => n);
    const weight = cfg.score_weight || 1;

    const { results: slots } = await env.DB.prepare(
      `SELECT id FROM time_slots WHERE group_id = ?`
    ).bind(cfg.bind_group_id).all();

    if (!slots || slots.length === 0) continue;

    for (const name of names) {
      for (const slot of slots) {
        try {
          const existing = await env.DB.prepare(
            `SELECT id FROM score_records WHERE person_name = ? AND group_id = ? AND slot_id = ? AND record_date = ?`
          ).bind(name, cfg.bind_group_id, slot.id, recordDate).first();
          if (existing) continue;

          await env.DB.prepare(
            `INSERT INTO score_records (person_name, group_id, slot_id, score, record_date, created_at)
             VALUES (?, ?, ?, ?, ?, ?)`
          ).bind(name, cfg.bind_group_id, slot.id, weight, recordDate, now).run();
          imported++;
        } catch (e) {
          errors.push({ person: name, message: e.message });
        }
      }
    }
  }

  return jsonSuccess({ message: `已为今日(${recordDate})加分: ${imported} 条记录`, imported, errors });
}
