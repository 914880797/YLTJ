import { jsonSuccess, jsonError, verifyAdmin } from './_shared.js';

export async function onRequestGet({ env }) {
  try {
    const row = await env.DB.prepare(
      `SELECT value FROM settings WHERE key = 'cycle_start_date'`
    ).first();
    const count = await env.DB.prepare(
      `SELECT COUNT(*) as total FROM score_records`
    ).first();

    return jsonSuccess({
      cycleStartDate: row?.value || null,
      totalRecords: count?.total || 0
    });
  } catch (error) {
    return jsonError(error.message);
  }
}

export async function onRequestPut({ request, env }) {
  const isAdmin = await verifyAdmin(request, env);
  if (!isAdmin) return jsonError('未授权访问', 401);
  try {
    const data = await request.json();
    if (data.cycleStartDate) {
      const { results } = await env.DB.prepare(
        `SELECT value FROM settings WHERE key = 'cycle_start_date'`
      ).all();
      const oldValue = results?.[0]?.value;

      const { meta } = await env.DB.prepare(
        `DELETE FROM score_records`
      ).run();

      await env.DB.prepare(
        `INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES ('cycle_start_date', ?, CURRENT_TIMESTAMP)`
      ).bind(data.cycleStartDate).run();

      return jsonSuccess({
        message: `周期起始日期已更新，清除了 ${meta?.changes || 0} 条记录`,
        deleted: meta?.changes || 0
      });
    }
    return jsonSuccess();
  } catch (error) {
    return jsonError(error.message);
  }
}
