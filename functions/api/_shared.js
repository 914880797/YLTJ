const TZ_OFFSET = 8 * 60 * 60 * 1000;
const SALT = 'yltj_salt_2026';

function pad(n) { return String(n).padStart(2, '0'); }

function getBeijingNow() {
  return new Date(Date.now() + TZ_OFFSET);
}

function todayBeijing() {
  const bj = getBeijingNow();
  return `${bj.getUTCFullYear()}-${pad(bj.getUTCMonth() + 1)}-${pad(bj.getUTCDate())}`;
}

function formatBeijingNow() {
  const bj = getBeijingNow();
  return `${bj.getUTCFullYear()}-${pad(bj.getUTCMonth() + 1)}-${pad(bj.getUTCDate())} ${pad(bj.getUTCHours())}:${pad(bj.getUTCMinutes())}:${pad(bj.getUTCSeconds())}`;
}

async function hashPassword(password, salt = SALT) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + salt);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function verifyAdmin(request, env) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return false;
  const token = authHeader.slice(7);
  const { results } = await env.DB.prepare(
    `SELECT username FROM admin_users WHERE is_active = 1`
  ).all();
  for (const admin of (results || [])) {
    if (token === await hashPassword(admin.username)) return true;
  }
  return false;
}

function jsonSuccess(data, status = 200) {
  return Response.json({ success: true, ...data }, { status });
}

function jsonError(message, status = 500, context = {}) {
  console.error(JSON.stringify({
    timestamp: formatBeijingNow(),
    status,
    message,
    ...context
  }));
  return Response.json({ success: false, error: message, ...context }, { status });
}

export {
  pad,
  getBeijingNow,
  todayBeijing,
  formatBeijingNow,
  hashPassword,
  verifyAdmin,
  jsonSuccess,
  jsonError
};
