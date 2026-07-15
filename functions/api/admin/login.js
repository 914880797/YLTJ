import { jsonSuccess, jsonError, hashPassword, verifyAdmin } from './_shared.js';

export async function onRequestPost({ request, env }) {
  try {
    const { username, password } = await request.json();
    if (!username || !password) return jsonError('账号和密码不能为空', 400);

    const user = await env.DB.prepare(
      `SELECT username FROM admin_users WHERE username = ? AND is_active = 1`
    ).bind(username.trim()).first();

    if (!user) return jsonError('账号或密码错误', 401);

    const expectedHash = await hashPassword(user.username);
    const providedHash = await hashPassword(password);

    if (providedHash !== expectedHash) return jsonError('账号或密码错误', 401);

    const token = expectedHash;
    return jsonSuccess({ token });
  } catch (error) {
    return jsonError(error.message);
  }
}
