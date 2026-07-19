import { jsonSuccess, jsonError } from './_shared.js';

export async function onRequestGet({ env }) {
  try {
    const { results: personCount } = await env.DB.prepare(
      `SELECT COUNT(DISTINCT person_name) as total FROM score_records`
    ).all();

    const { results: recordCount } = await env.DB.prepare(
      `SELECT COUNT(*) as total FROM score_records`
    ).all();

    const { results: groupAverages } = await env.DB.prepare(
      `SELECT g.name as group_name,
              ROUND(CAST(COUNT(DISTINCT sr.person_name || '-' || sr.slot_id) AS REAL) /
               NULLIF(COUNT(DISTINCT sr.person_name), 0), 1) as avg_slots
       FROM score_records sr
       LEFT JOIN groups g ON sr.group_id = g.id
       WHERE g.id IS NOT NULL
       GROUP BY sr.group_id
       ORDER BY g.order_index`
    ).all();

    const { results: scoreDist } = await env.DB.prepare(
      `SELECT person_name, COUNT(DISTINCT group_id || '-' || slot_id) as total_slots
       FROM score_records
       GROUP BY person_name
       ORDER BY total_slots DESC`
    ).all();

    const { results: groupSlotCounts } = await env.DB.prepare(
      `SELECT g.id, g.name, COUNT(ts.id) as total_slots
        FROM groups g
        LEFT JOIN time_slots ts ON ts.group_id = g.id
        GROUP BY g.id`
    ).all();

    const groupSlotMap = {};
    for (const g of (groupSlotCounts || [])) groupSlotMap[g.id] = g.total_slots;

    const { results: personGroups } = await env.DB.prepare(
      `SELECT DISTINCT person_name, group_id FROM score_records`
    ).all();

    const personSlotsDone = {};
    for (const row of (scoreDist || [])) personSlotsDone[row.person_name] = row.total_slots;

    const personExpected = {};
    for (const row of (personGroups || [])) {
      const slots = groupSlotMap[row.group_id] || 0;
      personExpected[row.person_name] = (personExpected[row.person_name] || 0) + slots;
    }

    const totalSlots = Object.values(groupSlotMap).reduce((a, b) => a + b, 0);
    const missingSlots = [];

    for (const [name, expected] of Object.entries(personExpected)) {
      const done = personSlotsDone[name] || 0;
      const missing = Math.max(0, expected - done);
      if (missing > 0) missingSlots.push({ name, done, missing });
    }

    return jsonSuccess({
      total_persons: personCount?.[0]?.total || 0,
      total_records: recordCount?.[0]?.total || 0,
      group_averages: groupAverages || [],
      score_distribution: scoreDist || [],
      missing_slots: missingSlots.slice(0, 20),
      total_slots: totalSlots
    });
  } catch (error) {
    return jsonError(error.message);
  }
}
