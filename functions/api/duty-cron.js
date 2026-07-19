import { jsonSuccess, jsonError } from './_shared.js';
import { autoScore, SCORE_TYPES } from './_score-engine.js';

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const key = url.searchParams.get('key');

  if (!key) return jsonError('缺少认证密钥', 401);

  const expectedKey = env.DUTY_CRON_SECRET || 'yltj-duty-cron-2026';
  if (key !== expectedKey) return jsonError('密钥错误', 401);

  const result = await autoScore(env, null, SCORE_TYPES.duty);
  return jsonSuccess(result);
}
