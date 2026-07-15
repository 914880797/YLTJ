import { jsonSuccess, jsonError, verifyAdmin } from './_shared.js';

export async function onRequestGet({ env }) {
  try {
    const { results } = await env.DB.prepare(
      `SELECT id, content, is_active, created_at FROM announcements WHERE is_active = 1 ORDER BY created_at DESC`
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
    const { content } = await request.json();
    if (!content || !content.trim()) return jsonError('公告内容不能为空', 400);

    await env.DB.prepare(
      `INSERT INTO announcements (content, is_active) VALUES (?, 1)`
    ).bind(content.trim()).run();
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

    await env.DB.prepare(
      `UPDATE announcements SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
    ).bind(is_active || 0, id).run();
    return jsonSuccess({ message: '公告已更新' });
  } catch (error) {
    return jsonError(error.message);
  }
}
