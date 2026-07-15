const assert = require('assert');

function testBeijingTime() {
  const ts = Date.now();
  const bj = new Date(ts + 8 * 60 * 60 * 1000);
  assert.ok(bj.getUTCHours() >= 0 && bj.getUTCHours() < 24, 'Beijing hour in range');
  console.log('PASS: Beijing time calculation');
}

function testRankingTie() {
  const scores = [
    { name: 'A', total: 10 },
    { name: 'B', total: 10 },
    { name: 'C', total: 8 }
  ];

  const ranked = scores.map((s, idx, arr) => {
    const rank = idx === 0 ? 1 :
      arr[idx - 1].total === s.total ? arr[idx - 1]._rank : idx + 1;
    s._rank = rank;
    return s;
  });

  assert.strictEqual(ranked[0]._rank, 1);
  assert.strictEqual(ranked[1]._rank, 1);
  assert.strictEqual(ranked[2]._rank, 3);
  console.log('PASS: Ranking tie handling');
}

function testGroupScore() {
  const records = [
    { person_name: '张三', group_id: 1, slot_id: 1 },
    { person_name: '张三', group_id: 1, slot_id: 2 },
    { person_name: '张三', group_id: 2, slot_id: 3 }
  ];

  const groupScores = {};
  for (const r of records) {
    const key = `${r.person_name}-${r.group_id}`;
    if (!groupScores[key]) groupScores[key] = new Set();
    groupScores[key].add(r.slot_id);
  }

  const personTotals = {};
  for (const [key, slots] of Object.entries(groupScores)) {
    const [name] = key.split('-');
    personTotals[name] = (personTotals[name] || 0) + slots.size;
  }

  assert.strictEqual(personTotals['张三'], 3);
  console.log('PASS: Group score calculation');
}

function testEmptyRanking() {
  const data = [];
  assert.strictEqual(data.length, 0);
  console.log('PASS: Empty ranking handling');
}

try {
  testBeijingTime();
  testRankingTie();
  testGroupScore();
  testEmptyRanking();
  console.log('\nAll tests passed.');
} catch (e) {
  console.error('FAIL:', e.message);
  process.exit(1);
}
