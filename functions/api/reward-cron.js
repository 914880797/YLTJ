import { jsonSuccess, jsonError } from './_shared.js';
import { autoScoreReward } from './_reward-score.js';

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const key = url.searchParams.get('key');

  if (!key) return jsonError('缺少认证密钥', 401);

  const expectedKey = env.REWARD_CRON_SECRET || 'yltj-reward-cron-2026';
  if (key !== expectedKey) return jsonError('密钥错误', 401);

  const result = await autoScoreReward(env);
  return jsonSuccess(result);
}
