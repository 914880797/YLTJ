import { jsonSuccess, jsonError, verifyAdmin, formatBeijingNow } from './_shared.js';
import { autoScore, previewAutoScore, SCORE_TYPES } from './_score-engine.js';
import { runMigrations } from './_migrate.js';

export async function onRequestGet({ request, env }) {
  try {
    await runMigrations(env);

    const url = new URL(request.url);
    const warmupProjectId = url.searchParams.get('warmup_project_id');

    let projectWhere = '';
    const projectArgs = [];
    if (warmupProjectId) {
      projectWhere = 'WHERE id = ?';
      projectArgs.push(warmupProjectId);
    }

    const { results: projects } = await env.DB.prepare(
      `SELECT * FROM warmup_projects ${projectWhere} ORDER BY order_index ASC, id ASC`
    ).bind(...projectArgs).all();

    if (!projects || projects.length === 0) return jsonSuccess({ data: [] });

    const projectIds = projects.map(p => p.id);
    const pp = projectIds.map(() => '?').join(',');

    const { results: warmupGroups } = await env.DB.prepare(
      `SELECT * FROM warmup_groups
       WHERE warmup_project_id IN (${pp})
       ORDER BY order_index ASC, id ASC`
    ).bind(...projectIds).all();

    const groupIds = (warmupGroups || []).map(dg => dg.id);
    let allSlotPersons = [];
    if (groupIds.length > 0) {
      const gp = groupIds.map(() => '?').join(',');
      const { results } = await env.DB.prepare(
        `SELECT * FROM warmup_slot_persons
         WHERE warmup_group_id IN (${gp})
         ORDER BY order_index ASC, id ASC`
      ).bind(...groupIds).all();
      allSlotPersons = results || [];
    }

    const data = projects.map(project => {
      const pGroups = (warmupGroups || []).filter(dg => dg.warmup_project_id === project.id);
      const groups = pGroups.map(dg => {
        const slots = allSlotPersons.filter(sp => sp.warmup_group_id === dg.id);
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

    if (type === 'group') return addWarmupGroup(body, env);
    if (type === 'slot') return addWarmupSlotPerson(body, env);
    if (type === 'auto-score') {
      const result = await autoScore(env, body.date, SCORE_TYPES.warmup);
      return jsonSuccess(result);
    }
    if (type === 'auto-score-preview') {
      const result = await previewAutoScore(env, body.date, SCORE_TYPES.warmup);
      return jsonSuccess(result);
    }
    if (type === 'remove-exclusion') {
      return removeWarmupExclusion(body, env);
    }
    if (type === 'smart-import') {
      return handleWarmupSmartImport(body, env);
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

    if (type === 'group') return updateWarmupGroup(body, env);
    if (type === 'slot') return updateWarmupSlotPerson(body, env);

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
      await env.DB.prepare(`DELETE FROM warmup_groups WHERE id = ?`).bind(body.id).run();
      return jsonSuccess({ message: '预热分组已删除' });
    }
    if (type === 'slot' && body.id) {
      await env.DB.prepare(`DELETE FROM warmup_slot_persons WHERE id = ?`).bind(body.id).run();
      return jsonSuccess({ message: '人员配置已删除' });
    }

    return jsonError('未知操作类型', 400);
  } catch (error) {
    return jsonError(error.message);
  }
}

async function addWarmupGroup(body, env) {
  const { warmup_project_id, name, order_index } = body;
  if (!warmup_project_id) return jsonError('缺少预热项目 ID', 400);
  if (!name || !name.trim()) return jsonError('预热分组名称不能为空', 400);

  const rootWarmupProject = await env.DB.prepare(
    `SELECT id FROM warmup_projects WHERE id = ?`
  ).bind(warmup_project_id).first();
  if (!rootWarmupProject) return jsonError('预热项目不存在', 400);

  await env.DB.prepare(
    `INSERT INTO warmup_groups (warmup_project_id, name, order_index) VALUES (?, ?, ?)`
  ).bind(warmup_project_id, name.trim(), order_index || 0).run();
  return jsonSuccess({ message: '预热分组创建成功' });
}

async function updateWarmupGroup(body, env) {
  const { id, name, order_index } = body;
  if (!id) return jsonError('缺少预热分组 ID', 400);

  if (name !== undefined && name.trim()) {
    await env.DB.prepare(`UPDATE warmup_groups SET name = ? WHERE id = ?`).bind(name.trim(), id).run();
  }
  if (order_index !== undefined) {
    await env.DB.prepare(`UPDATE warmup_groups SET order_index = ? WHERE id = ?`).bind(order_index, id).run();
  }
  return jsonSuccess({ message: '已更新' });
}

async function addWarmupSlotPerson(body, env) {
  const { warmup_group_id, persons, order_index } = body;
  if (!warmup_group_id) return jsonError('缺少预热分组 ID', 400);
  if (!persons || !persons.trim()) return jsonError('缺少人员名单', 400);

  await env.DB.prepare(
    `INSERT INTO warmup_slot_persons (warmup_group_id, persons, order_index) VALUES (?, ?, ?)`
  ).bind(warmup_group_id, persons.trim(), order_index || 0).run();
  return jsonSuccess({ message: '人员配置成功' });
}

async function updateWarmupSlotPerson(body, env) {
  const { id, persons, order_index } = body;
  if (!id) return jsonError('缺少配置 ID', 400);

  if (persons !== undefined && persons.trim()) {
    await env.DB.prepare(`UPDATE warmup_slot_persons SET persons = ? WHERE id = ?`).bind(persons.trim(), id).run();
  }
  if (order_index !== undefined) {
    await env.DB.prepare(`UPDATE warmup_slot_persons SET order_index = ? WHERE id = ?`).bind(order_index, id).run();
  }
  return jsonSuccess({ message: '已更新' });
}

async function removeExclusion(body, env) {
  const { warmup_project_id, name } = body;
  if (!warmup_project_id || !name) return jsonError('缺少参数', 400);

  const { results: rows } = await env.DB.prepare(
    `SELECT dsp.id, dsp.persons
     FROM warmup_slot_persons dsp
     LEFT JOIN warmup_groups dg ON dsp.warmup_group_id = dg.id
     WHERE dg.warmup_project_id = ? AND dsp.persons LIKE ?`
  ).bind(warmup_project_id, `%-${name}%`).all();

  if (!rows || rows.length === 0) return jsonError('未找到该人员的排除记录', 404);

  for (const row of rows) {
    const parts = row.persons.split(/[,，、\n\r]+/).map(p => p.trim());
    const updated = parts.map(p => p === `-${name}` ? name : p).join(', ');
    await env.DB.prepare(`UPDATE warmup_slot_persons SET persons = ? WHERE id = ?`)
      .bind(updated, row.id).run();
  }

  return jsonSuccess({ message: `已将 ${name} 恢复为正常加分人员` });
}

async function handleWarmupSmartImport(body, env) {
  const { warmup_project_id, warmup_group_id, names, record_date } = body;
  if (!warmup_project_id) return jsonError('缺少预热项目 ID', 400);
  if (!names || !Array.isArray(names) || names.length === 0) return jsonError('缺少人员名单', 400);

  const project = await env.DB.prepare(
    `SELECT wp.*, g.has_slots, g.score_weight as group_score_weight
     FROM warmup_projects wp
     LEFT JOIN groups g ON wp.bind_group_id = g.id
     WHERE wp.id = ?`
  ).bind(warmup_project_id).first();

  if (!project || !project.bind_group_id) return jsonError('预热项目未绑定主分组', 400);

  const groupId = project.bind_group_id;
  const weight = project.group_score_weight || 1;
  const now = formatBeijingNow();

  let slotName = '全天';
  if (warmup_group_id) {
    const wg = await env.DB.prepare(
      `SELECT name FROM warmup_groups WHERE id = ?`
    ).bind(warmup_group_id).first();
    if (wg && wg.name) slotName = wg.name;
  }

  let slotIds = [];
  let slot = await env.DB.prepare(
    `SELECT id FROM time_slots WHERE group_id = ? AND name = ?`
  ).bind(groupId, slotName).first();
  if (!slot) {
    await env.DB.prepare(
      `INSERT INTO time_slots (group_id, name, time_range, order_index, source) VALUES (?, ?, ?, 0, 'warmup')`
    ).bind(groupId, slotName, slotName).run();
    slot = await env.DB.prepare(
      `SELECT id FROM time_slots WHERE group_id = ? AND name = ?`
    ).bind(groupId, slotName).first();
  }
  if (slot) slotIds = [slot.id];

  if (slotIds.length === 0) return jsonError('无法创建时段', 400);

  let imported = 0;
  const errors = [];
  const batch = [];

  for (const name of names) {
    for (const slotId of slotIds) {
      const exists = await env.DB.prepare(
        `SELECT id FROM score_records WHERE person_name = ? AND group_id = ? AND slot_id = ? AND record_date = ?`
      ).bind(name, groupId, slotId, record_date).first();
      if (exists) continue;

      batch.push(
        env.DB.prepare(
          `INSERT INTO score_records (person_name, group_id, slot_id, score, record_date, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`
        ).bind(name, groupId, slotId, weight, record_date, now)
      );
      imported++;
    }
  }

  if (batch.length > 0) {
    await env.DB.batch(batch);
  }

  return jsonSuccess({
    message: `成功导入 ${imported} 条记录`,
    imported,
    errors: errors.length > 0 ? errors : undefined
  });
}
