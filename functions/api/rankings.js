import { jsonSuccess, jsonError } from './_shared.js';

export async function onRequestGet({ request, env }) {
  try {
    try { await env.DB.prepare(`ALTER TABLE groups ADD COLUMN score_weight REAL NOT NULL DEFAULT 1`).run(); } catch (e) {}

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
              g.score_weight * COUNT(DISTINCT sr.slot_id) as group_score
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

    const data = Object.entries(personTotalScores)
      .sort((a, b) => b[1] - a[1])
      .map(([name, total], idx, arr) => {
        const rank = idx === 0 ? 1 :
          arr[idx - 1][1] === total ? (arr[idx - 1].rank || idx) : idx + 1;
        arr[idx].rank = rank;
        return {
          rank,
          name,
          group_scores: personGroupScores[name] || {},
          total_score: total
        };
      });

    return jsonSuccess({ data, total: data.length });
  } catch (error) {
    return jsonError(error.message);
  }
}
