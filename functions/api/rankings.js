import { jsonSuccess, jsonError } from './_shared.js';
import { runMigrations } from './_migrate.js';

export async function onRequestGet({ request, env }) {
  try {
    await runMigrations(env);

    const url = new URL(request.url);
    const name = url.searchParams.get('name');

    const { results: groups } = await env.DB.prepare(
      `SELECT * FROM groups ORDER BY order_index ASC, id ASC`
    ).all();

    const { results: slots } = await env.DB.prepare(
      `SELECT ts.*, g.name as group_name FROM time_slots ts
       LEFT JOIN groups g ON ts.group_id = g.id
       ORDER BY g.order_index, ts.order_index`
    ).all();

    let where = '';
    const args = [];
    if (name) { where = ' WHERE sr.person_name LIKE ?'; args.push(`%${name}%`); }

    const { results: groupScores } = await env.DB.prepare(
      `SELECT sr.person_name, sr.group_id, g.name as group_name,
              SUM(sr.score) as group_score
       FROM score_records sr
       LEFT JOIN groups g ON sr.group_id = g.id
       ${where}
       GROUP BY sr.person_name, sr.group_id
       ORDER BY sr.person_name`
    ).bind(...args).all();

    const personGroupScores = {};
    const personTotalScores = {};

    for (const gs of (groupScores || [])) {
      if (!personGroupScores[gs.person_name]) personGroupScores[gs.person_name] = {};
      personGroupScores[gs.person_name][gs.group_name] = gs.group_score;
      personTotalScores[gs.person_name] = (personTotalScores[gs.person_name] || 0) + gs.group_score;
    }

    const allData = Object.entries(personTotalScores)
      .sort((a, b) => b[1] - a[1])
      .map(([name, total], idx) => ({
        rank: idx + 1,
        name,
        group_scores: personGroupScores[name] || {},
        total_score: total
      }));

    const data = name ? allData : allData.slice(0, 10);

    return jsonSuccess({ data, total: data.length, allCount: allData.length });
  } catch (error) {
    return jsonError(error.message);
  }
}
