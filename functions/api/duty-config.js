import { jsonSuccess, jsonError, verifyAdmin } from './_shared.js';
import { autoScoreDuty, previewAutoScore } from './_duty-score.js';

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
    if (type === 'auto-score') {
      const result = await autoScoreDuty(env, body.date);
      return jsonSuccess(result);
    }
    if (type === 'auto-score-preview') {
      const result = await previewAutoScore(env, body.date);
      return jsonSuccess(result);
    }

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
  const { duty_group_id, persons, order_index } = body;
  if (!duty_group_id) return jsonError('缺少值班分组 ID', 400);
  if (!persons || !persons.trim()) return jsonError('缺少人员名单', 400);

  await env.DB.prepare(
    `INSERT INTO duty_slot_persons (duty_group_id, persons, order_index) VALUES (?, ?, ?)`
  ).bind(duty_group_id, persons.trim(), order_index || 0).run();
  return jsonSuccess({ message: '人员配置成功' });
}

async function updateDutySlotPerson(body, env) {
  const { id, persons, order_index } = body;
  if (!id) return jsonError('缺少配置 ID', 400);

  if (persons !== undefined && persons.trim()) {
    await env.DB.prepare(`UPDATE duty_slot_persons SET persons = ? WHERE id = ?`).bind(persons.trim(), id).run();
  }
  if (order_index !== undefined) {
    await env.DB.prepare(`UPDATE duty_slot_persons SET order_index = ? WHERE id = ?`).bind(order_index, id).run();
  }
  return jsonSuccess({ message: '已更新' });
}
