import { jsonSuccess, jsonError, verifyAdmin } from './_shared.js';

export async function onRequestGet({ request, env }) {
  try {
    const url = new URL(request.url);
    const showAll = url.searchParams.get('all') === '1';
    const where = showAll ? '' : 'WHERE is_active = 1';
    const { results } = await env.DB.prepare(
      `SELECT id, content, is_active, order_index, created_at FROM announcements ${where} ORDER BY order_index ASC, id ASC`
    ).all();
    return jsonSuccess({ data: results || [] });
  } catch (error) {
    return jsonError(error.message);
  }
}

export async function onRequestPost({ request, env }) {
  const isAdmin = await verifyAdmin(request, env);
  if (!isAdmin) return jsonError('未授权访问', 401);
  try {
    const { content, order_index } = await request.json();
    if (!content || !content.trim()) return jsonError('公告内容不能为空', 400);

    const maxOrder = await env.DB.prepare(`SELECT MAX(order_index) as mx FROM announcements`).first();
    const nextOrder = order_index !== undefined ? order_index : ((maxOrder?.mx || 0) + 1);

    await env.DB.prepare(
      `INSERT INTO announcements (content, is_active, order_index) VALUES (?, 1, ?)`
    ).bind(content.trim(), nextOrder).run();
    return jsonSuccess({ message: '公告发布成功' });
  } catch (error) {
    return jsonError(error.message);
  }
}

export async function onRequestPut({ request, env }) {
  const isAdmin = await verifyAdmin(request, env);
  if (!isAdmin) return jsonError('未授权访问', 401);
  try {
    const { id, is_active } = await request.json();
    if (!id) return jsonError('缺少公告 ID', 400);

    if (is_active === 0) {
      await env.DB.prepare(`DELETE FROM announcements WHERE id = ?`).bind(id).run();
      const { results: remaining } = await env.DB.prepare(
        `SELECT id FROM announcements ORDER BY order_index ASC, id ASC`
      ).all();
      for (let i = 0; i < (remaining || []).length; i++) {
        await env.DB.prepare(
          `UPDATE announcements SET order_index = ? WHERE id = ?`
        ).bind(i + 1, remaining[i].id).run();
      }
      return jsonSuccess({ message: '公告已删除' });
    }

    await env.DB.prepare(
      `UPDATE announcements SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
    ).bind(is_active || 0, id).run();
    return jsonSuccess({ message: '公告已更新' });
  } catch (error) {
    return jsonError(error.message);
  }
}
