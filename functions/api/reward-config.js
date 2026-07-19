import { jsonSuccess, jsonError, verifyAdmin, formatBeijingNow } from './_shared.js';
import { autoScore, previewAutoScore, SCORE_TYPES } from './_score-engine.js';
import { runMigrations } from './_migrate.js';

export async function onRequestGet({ request, env }) {
  try {
    await runMigrations(env);

    const url = new URL(request.url);
    const rewardProjectId = url.searchParams.get('reward_project_id');

    let projectWhere = '';
    const projectArgs = [];
    if (rewardProjectId) {
      projectWhere = 'WHERE rp.id = ?';
      projectArgs.push(rewardProjectId);
    }

    const { results: projects } = await env.DB.prepare(
      `SELECT * FROM reward_projects ${projectWhere} ORDER BY order_index ASC, id ASC`
    ).bind(...projectArgs).all();

    if (!projects || projects.length === 0) return jsonSuccess({ data: [] });

    const projectIds = projects.map(p => p.id);
    const pp = projectIds.map(() => '?').join(',');

    const { results: allSlotPersons } = await env.DB.prepare(
      `SELECT * FROM reward_slot_persons
       WHERE reward_project_id IN (${pp})
       ORDER BY order_index ASC, id ASC`
    ).bind(...projectIds).all();

    const data = projects.map(project => {
      const persons = (allSlotPersons || []).filter(sp => sp.reward_project_id === project.id);
      return { ...project, persons };
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

    if (type === 'slot') return addRewardSlotPerson(body, env);
    if (type === 'auto-score') {
      const result = await autoScore(env, body.date, SCORE_TYPES.reward);
      return jsonSuccess(result);
    }
    if (type === 'auto-score-preview') {
      const result = await previewAutoScore(env, body.date, SCORE_TYPES.reward);
      return jsonSuccess(result);
    }
    if (type === 'remove-exclusion') {
      return removeExclusion(body, env);
    }
    if (type === 'smart-import') {
      return handleRewardSmartImport(body, env);
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

    if (type === 'slot') return updateRewardSlotPerson(body, env);

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

    if (type === 'slot' && body.id) {
      await env.DB.prepare(`DELETE FROM reward_slot_persons WHERE id = ?`).bind(body.id).run();
      return jsonSuccess({ message: '人员配置已删除' });
    }

    return jsonError('未知操作类型', 400);
  } catch (error) {
    return jsonError(error.message);
  }
}

async function addRewardSlotPerson(body, env) {
  const { reward_project_id, persons, order_index } = body;
  if (!reward_project_id) return jsonError('缺少奖励项目 ID', 400);
  if (!persons || !persons.trim()) return jsonError('缺少人员名单', 400);

  await env.DB.prepare(
    `INSERT INTO reward_slot_persons (reward_project_id, persons, order_index) VALUES (?, ?, ?)`
  ).bind(reward_project_id, persons.trim(), order_index || 0).run();
  return jsonSuccess({ message: '人员配置成功' });
}

async function updateRewardSlotPerson(body, env) {
  const { id, persons, order_index } = body;
  if (!id) return jsonError('缺少配置 ID', 400);

  if (persons !== undefined && persons.trim()) {
    await env.DB.prepare(`UPDATE reward_slot_persons SET persons = ? WHERE id = ?`).bind(persons.trim(), id).run();
  }
  if (order_index !== undefined) {
    await env.DB.prepare(`UPDATE reward_slot_persons SET order_index = ? WHERE id = ?`).bind(order_index, id).run();
  }
  return jsonSuccess({ message: '已更新' });
}

async function removeExclusion(body, env) {
  const { reward_project_id, name } = body;
  if (!reward_project_id || !name) return jsonError('缺少参数', 400);

  const { results: rows } = await env.DB.prepare(
    `SELECT id, persons FROM reward_slot_persons
     WHERE reward_project_id = ? AND persons LIKE ?`
  ).bind(reward_project_id, `%-${name}%`).all();

  if (!rows || rows.length === 0) return jsonError('未找到该人员的排除记录', 404);

  for (const row of rows) {
    const parts = row.persons.split(/[,，、\n\r]+/).map(p => p.trim());
    const updated = parts.map(p => p === `-${name}` ? name : p).join(', ');
    await env.DB.prepare(`UPDATE reward_slot_persons SET persons = ? WHERE id = ?`)
      .bind(updated, row.id).run();
  }

  return jsonSuccess({ message: `已将 ${name} 恢复为正常加分人员` });
}

async function handleRewardSmartImport(body, env) {
  const { reward_project_id, names, record_date } = body;
  if (!reward_project_id) return jsonError('缺少奖励项目 ID', 400);
  if (!names || !Array.isArray(names) || names.length === 0) return jsonError('缺少人员名单', 400);

  const project = await env.DB.prepare(
    `SELECT rp.*, g.has_slots, g.score_weight as group_score_weight
     FROM reward_projects rp
     LEFT JOIN groups g ON rp.bind_group_id = g.id
     WHERE rp.id = ?`
  ).bind(reward_project_id).first();

  if (!project || !project.bind_group_id) return jsonError('奖励项目未绑定主分组', 400);

  const groupId = project.bind_group_id;
  const weight = project.score_weight || project.group_score_weight || 1;
  const now = formatBeijingNow();
  const slotName = project.name;

  let slot = await env.DB.prepare(
    `SELECT id FROM time_slots WHERE group_id = ? AND name = ?`
  ).bind(groupId, slotName).first();
  if (!slot) {
    await env.DB.prepare(
      `INSERT INTO time_slots (group_id, name, time_range, order_index, source) VALUES (?, ?, ?, 0, 'reward')`
    ).bind(groupId, slotName, slotName).run();
    slot = await env.DB.prepare(
      `SELECT id FROM time_slots WHERE group_id = ? AND name = ?`
    ).bind(groupId, slotName).first();
  }

  if (!slot) return jsonError('无法创建时段', 400);

  let imported = 0;
  const batch = [];

  for (const name of names) {
    const exists = await env.DB.prepare(
      `SELECT id FROM score_records WHERE person_name = ? AND group_id = ? AND slot_id = ? AND record_date = ?`
    ).bind(name, groupId, slot.id, record_date).first();
    if (exists) continue;

    batch.push(
      env.DB.prepare(
        `INSERT INTO score_records (person_name, group_id, slot_id, score, record_date, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).bind(name, groupId, slot.id, weight, record_date, now)
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
