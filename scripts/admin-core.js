let adminToken = getToken();

function showToast(msg, isError) {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();
  const t = document.createElement('div');
  t.className = `toast ${isError ? 'toast-error' : 'toast-success'}`;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2500);
}

function escAttr(s) {
  return esc(s).replace(/'/g, "&#39;").replace(/"/g, '&quot;');
}

async function handleLogin() {
  const username = document.getElementById('adminUsername').value.trim();
  const password = document.getElementById('adminPassword').value;
  if (!username || !password) return showToast('请输入账号和密码', true);

  const res = await apiPost('/admin/login', { username, password });
  if (!res.success) return showToast(res.error, true);

  adminToken = res.token;
  setToken(adminToken);
  document.getElementById('loginOverlay').style.display = 'none';
  loadAll();
}

function checkAuth() {
  if (!adminToken) {
    document.getElementById('loginOverlay').style.display = 'flex';
    return false;
  }
  return true;
}

function logout() {
  clearToken();
  adminToken = '';
  document.getElementById('loginOverlay').style.display = 'flex';
}

function switchTab(tabName) {
  document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.admin-panel').forEach(p => p.classList.remove('active'));
  const tab = document.querySelector(`[data-tab="${tabName}"]`);
  if (tab) tab.classList.add('active');
  const panel = document.getElementById(`panel-${tabName}`);
  if (panel) panel.classList.add('active');

  if (tabName === 'groups') loadGroups();
  else if (tabName === 'announcements') loadAnnouncements();
  else if (tabName === 'duty') loadDuty();
  else if (tabName === 'reward') loadReward();
  else if (tabName === 'warmup') loadWarmup();
  else if (tabName === 'settings') loadSettings();
}

function loadAll() {
  loadGroups();
  loadAnnouncements();
  loadSettings();
}
