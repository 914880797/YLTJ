import { jsonSuccess, jsonError, verifyAdmin } from './_shared.js';
import { autoScoreReward, previewRewardScore } from './_reward-score.js';

export async function onRequestGet({ request, env }) {
  try {
    try { await env.DB.prepare(`ALTER TABLE reward_projects ADD COLUMN bind_group_id INTEGER`).run(); } catch (e) {}

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

    const { results: rewardGroups } = await env.DB.prepare(
      `SELECT * FROM reward_groups
       WHERE reward_project_id IN (${pp})
       ORDER BY order_index ASC, id ASC`
    ).bind(...projectIds).all();

    const groupIds = (rewardGroups || []).map(rg => rg.id);
    let allSlotPersons = [];
    if (groupIds.length > 0) {
      const gp = groupIds.map(() => '?').join(',');
      const { results } = await env.DB.prepare(
        `SELECT * FROM reward_slot_persons
         WHERE reward_group_id IN (${gp})
         ORDER BY order_index ASC, id ASC`
      ).bind(...groupIds).all();
      allSlotPersons = results || [];
    }

    const data = projects.map(project => {
      const pGroups = (rewardGroups || []).filter(rg => rg.reward_project_id === project.id);
      const groups = pGroups.map(rg => {
        const slots = allSlotPersons.filter(sp => sp.reward_group_id === rg.id);
        return { ...rg, slots };
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

    if (type === 'group') return addRewardGroup(body, env);
    if (type === 'slot') return addRewardSlotPerson(body, env);
    if (type === 'auto-score') {
      const result = await autoScoreReward(env, body.date);
      return jsonSuccess(result);
    }
    if (type === 'auto-score-preview') {
      const result = await previewRewardScore(env, body.date);
      return jsonSuccess(result);
    }
    if (type === 'remove-exclusion') {
      return removeExclusion(body, env);
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

    if (type === 'group') return updateRewardGroup(body, env);
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

    if (type === 'group' && body.id) {
      await env.DB.prepare(`DELETE FROM reward_groups WHERE id = ?`).bind(body.id).run();
      return jsonSuccess({ message: '奖励分组已删除' });
    }
    if (type === 'slot' && body.id) {
      await env.DB.prepare(`DELETE FROM reward_slot_persons WHERE id = ?`).bind(body.id).run();
      return jsonSuccess({ message: '人员配置已删除' });
    }

    return jsonError('未知操作类型', 400);
  } catch (error) {
    return jsonError(error.message);
  }
}

async function addRewardGroup(body, env) {
  const { reward_project_id, name, order_index } = body;
  if (!reward_project_id) return jsonError('缺少奖励项目 ID', 400);
  if (!name || !name.trim()) return jsonError('奖励分组名称不能为空', 400);

  const rootRewardProject = await env.DB.prepare(
    `SELECT id FROM reward_projects WHERE id = ?`
  ).bind(reward_project_id).first();
  if (!rootRewardProject) return jsonError('奖励项目不存在', 400);

  await env.DB.prepare(
    `INSERT INTO reward_groups (reward_project_id, name, order_index) VALUES (?, ?, ?)`
  ).bind(reward_project_id, name.trim(), order_index || 0).run();
  return jsonSuccess({ message: '奖励分组创建成功' });
}

async function updateRewardGroup(body, env) {
  const { id, name, order_index } = body;
  if (!id) return jsonError('缺少奖励分组 ID', 400);

  if (name !== undefined && name.trim()) {
    await env.DB.prepare(`UPDATE reward_groups SET name = ? WHERE id = ?`).bind(name.trim(), id).run();
  }
  if (order_index !== undefined) {
    await env.DB.prepare(`UPDATE reward_groups SET order_index = ? WHERE id = ?`).bind(order_index, id).run();
  }
  return jsonSuccess({ message: '已更新' });
}

async function addRewardSlotPerson(body, env) {
  const { reward_group_id, persons, order_index } = body;
  if (!reward_group_id) return jsonError('缺少奖励分组 ID', 400);
  if (!persons || !persons.trim()) return jsonError('缺少人员名单', 400);

  await env.DB.prepare(
    `INSERT INTO reward_slot_persons (reward_group_id, persons, order_index) VALUES (?, ?, ?)`
  ).bind(reward_group_id, persons.trim(), order_index || 0).run();
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
    `SELECT rsp.id, rsp.persons
     FROM reward_slot_persons rsp
     LEFT JOIN reward_groups rg ON rsp.reward_group_id = rg.id
     WHERE rg.reward_project_id = ? AND rsp.persons LIKE ?`
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
