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

function esc(s) {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
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
  else if (tabName === 'import') loadSmartImportGroups();
  else if (tabName === 'announcements') loadAnnouncements();
  else if (tabName === 'settings') loadSettings();
}

async function loadGroups() {
  const container = document.getElementById('groupsList');
  container.innerHTML = '<div class="loading">加载中...</div>';
  const res = await apiGet('/groups');
  if (!res.success) { container.innerHTML = `<div class="empty">${res.error}</div>`; return; }

  let html = '';
  for (const g of (res.data || [])) {
    html += `<div class="group-item">
      <div class="group-info">
        <div class="group-name">${esc(g.name)}</div>
        <div class="group-meta">${g.slot_count || 0} 个时段</div>
      </div>
      <div class="group-actions">
        <button onclick="loadSlots(${g.id}, '${esc(g.name)}')">时段管理</button>
        <button onclick="editGroup(${g.id}, '${esc(g.name)}', ${g.order_index})">编辑</button>
        ${g.order_index > 1 ? `<button onclick="moveGroup(${g.id}, -1)">上移</button>` : ''}
        ${g.order_index < (res.data?.length || 0) ? `<button onclick="moveGroup(${g.id}, 1)">下移</button>` : ''}
        <button class="btn-danger" onclick="deleteGroup(${g.id})">删除</button>
      </div>
    </div>`;
  }
  html += `<button class="btn btn-primary" style="margin-top:8px" onclick="showAddGroup()">添加分组</button>`;
  container.innerHTML = html;
}

async function showAddGroup() {
  const name = prompt('请输入分组名称：');
  if (!name) return;
  const res = await apiAuthPost('/groups', { name: name.trim() }, adminToken);
  showToast(res.success ? '分组创建成功' : (res.error || '操作失败'), !res.success);
  if (res.success) loadGroups();
}

async function editGroup(id, oldName, oldOrder) {
  const name = prompt('修改分组名称：', oldName);
  if (!name) return;
  const res = await apiAuthPut('/groups', { id, name: name.trim(), order_index: oldOrder }, adminToken);
  showToast(res.success ? '分组更新成功' : (res.error || '操作失败'), !res.success);
  if (res.success) loadGroups();
}

async function moveGroup(id, direction) {
  const res = await apiGet('/groups');
  if (!res.success) return;
  const groups = res.data || [];
  const idx = groups.findIndex(g => g.id === id);
  if (idx < 0) return;

  const targetIdx = idx + direction;
  if (targetIdx < 0 || targetIdx >= groups.length) return;

  await apiAuthPut('/groups', { id: groups[idx].id, order_index: groups[targetIdx].order_index }, adminToken);
  await apiAuthPut('/groups', { id: groups[targetIdx].id, order_index: groups[idx].order_index }, adminToken);
  loadGroups();
}

async function deleteGroup(id) {
  if (!confirm('确定删除该分组？这将同时删除该分组下所有时段和关联数据。')) return;
  const res = await apiAuthDelete('/groups', { id }, adminToken);
  showToast(res.success ? '分组已删除' : (res.error || '操作失败'), !res.success);
  if (res.success) loadGroups();
}

async function loadSlots(groupId, groupName) {
  document.getElementById('slotGroupName').textContent = groupName;
  document.getElementById('slotGroupId').value = groupId;

  const container = document.getElementById('slotsList');
  container.innerHTML = '<div class="loading">加载中...</div>';

  const allSlots = await apiGet('/time-slots');
  let slots = [];
  if (allSlots.success && allSlots.data) {
    slots = allSlots.data.filter(s => s.group_id == groupId);
  }

  let html = '';
  for (const s of slots) {
    html += `<div class="slot-item">
      <span>${esc(s.time_range)}</span>
      <button onclick="deleteSlot(${s.id})">删除</button>
    </div>`;
  }
  html += `<div style="margin-top:8px; display:flex; gap:6px;">
    <input type="text" id="newSlotTimeRange" class="form-input" placeholder="如: 08:00-11:00" style="flex:1">
    <button class="btn btn-primary" onclick="addSlot(${groupId})">添加</button>
  </div>`;
  container.innerHTML = html;
  document.getElementById('slotManager').style.display = 'block';
}

function closeSlotManager() {
  document.getElementById('slotManager').style.display = 'none';
}

async function addSlot(groupId) {
  const timeRange = document.getElementById('newSlotTimeRange').value.trim();
  if (!timeRange) return showToast('请输入时段范围', true);
  const res = await apiAuthPost('/time-slots', { group_id: groupId, time_range: timeRange }, adminToken);
  showToast(res.success ? '时段添加成功' : (res.error || '操作失败'), !res.success);
  if (res.success) loadSlots(groupId, document.getElementById('slotGroupName').textContent);
}

async function deleteSlot(id) {
  if (!confirm('确定删除该时段？')) return;
  const res = await apiAuthDelete('/time-slots', { id }, adminToken);
  showToast(res.success ? '时段已删除' : (res.error || '操作失败'), !res.success);
  if (res.success) loadGroups();
}

async function loadSmartImportGroups() {
  const res = await apiGet('/groups');
  const select = document.getElementById('smartImportGroup');
  if (!select) return;
  let html = '<option value="">请选择分组</option>';
  for (const g of (res.data || [])) {
    html += `<option value="${g.id}">${esc(g.name)}</option>`;
  }
  select.innerHTML = html;
  document.getElementById('smartImportSlot').innerHTML = '<option value="">请先选择分组</option>';
  document.getElementById('smartImportDate').value = todayDateStr();
}

function todayDateStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

async function onSmartGroupChange() {
  const groupId = document.getElementById('smartImportGroup').value;
  const select = document.getElementById('smartImportSlot');
  if (!groupId) { select.innerHTML = '<option value="">请先选择分组</option>'; return; }

  select.innerHTML = '<option value="">加载中...</option>';
  const allSlots = await apiGet('/time-slots');
  let slots = [];
  if (allSlots.success && allSlots.data) {
    slots = allSlots.data.filter(s => s.group_id == groupId);
  }
  let html = '<option value="">请选择时段</option>';
  for (const s of slots) {
    html += `<option value="${s.id}">${esc(s.time_range)}</option>`;
  }
  select.innerHTML = html;
}

async function handleSmartImport() {
  const groupId = document.getElementById('smartImportGroup').value;
  const slotId = document.getElementById('smartImportSlot').value;
  const score = parseFloat(document.getElementById('smartImportScore').value) || 0;
  const recordDate = document.getElementById('smartImportDate').value;
  const namesText = document.getElementById('smartImportNames').value.trim();

  if (!groupId) return showToast('请选择分组', true);
  if (!slotId) return showToast('请选择时段', true);
  if (!namesText) return showToast('请输入人员名单', true);

  const names = namesText.split(/[,，、\n\r]+/).map(n => n.trim()).filter(n => n);
  if (names.length === 0) return showToast('未识别到有效姓名', true);

  const resultDiv = document.getElementById('smartImportResult');
  resultDiv.innerHTML = `<div class="loading">正在导入 ${names.length} 人...</div>`;

  const res = await apiGet('/groups');
  const groups = res.data || [];
  const group = groups.find(g => g.id == groupId);

  const allSlots = await apiGet('/time-slots');
  let slotInfo = null;
  if (allSlots.success && allSlots.data) {
    for (const s of allSlots.data) {
      if (s.group_id == groupId && s.id == slotId) {
        slotInfo = s;
        break;
      }
    }
  }

  const rows = names.map(name => ({
    person_name: name,
    group_name: group ? group.name : '',
    slot_name: slotInfo ? (slotInfo.name || slotInfo.time_range) : '',
    score: score,
    record_date: recordDate || todayDateStr()
  }));

  const importRes = await apiAuthPost('/import', { rows }, adminToken);
  if (importRes.success) {
    let msg = `成功导入 ${importRes.imported} 人`;
    if (importRes.errors && importRes.errors.length > 0) {
      msg += '\n错误: ' + importRes.errors.map(e => e.message).join(', ');
    }
    resultDiv.innerHTML = `<div class="import-result success">${msg}</div>`;
    showToast(`已导入 ${importRes.imported} 人`);
  } else {
    resultDiv.innerHTML = `<div class="import-result error">${importRes.error}</div>`;
    showToast(importRes.error, true);
  }
}

async function handleImport() {
  const fileInput = document.getElementById('importFile');
  const file = fileInput.files[0];
  if (!file) return showToast('请选择文件', true);

  const resultDiv = document.getElementById('importResult');
  resultDiv.innerHTML = '<div class="loading">解析文件中...</div>';

  try {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(new Uint8Array(buffer), { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    if (!rawRows || rawRows.length === 0) {
      resultDiv.innerHTML = '<div class="import-result error">文件中没有数据</div>';
      return;
    }

    const rows = [];
    const keys = Object.keys(rawRows[0]);
    const hasName = keys.some(k => k.includes('姓名') || k.toLowerCase() === 'name');
    const hasGroup = keys.some(k => k.includes('分组') || k.toLowerCase() === 'group');
    const hasSlot = keys.some(k => k.includes('时段') || k.toLowerCase() === 'slot' || k.toLowerCase() === 'time');

    if (hasName && hasGroup && hasSlot) {
      const nameCol = keys.find(k => k.includes('姓名') || k.toLowerCase() === 'name');
      const groupCol = keys.find(k => k.includes('分组') || k.toLowerCase() === 'group');
      const slotCol = keys.find(k => k.includes('时段') || k.toLowerCase() === 'slot' || k.toLowerCase() === 'time');
      const scoreCol = keys.find(k => k.includes('分值') || k.toLowerCase() === 'score');
      const dateCol = keys.find(k => k.includes('日期') || k.toLowerCase() === 'date');

      for (const r of rawRows) {
        rows.push({
          person_name: String(r[nameCol] || '').trim(),
          group_name: String(r[groupCol] || '').trim(),
          slot_name: String(r[slotCol] || '').trim(),
          score: parseFloat(r[scoreCol]) || 0,
          record_date: dateCol ? String(r[dateCol] || '').trim() : ''
        });
      }
    } else {
      const nonNameCols = keys.filter(k => !(k === '姓名'));
      const hasDashCols = nonNameCols.some(k => k.includes('-'));
      if (!hasDashCols) {
        resultDiv.innerHTML = '<div class="import-result error">无法识别文件格式，请使用列表格式（姓名/分组/时段/分值/日期）或矩阵格式（行=人员，列=分组-时段）</div>';
        return;
      }

      for (const r of rawRows) {
        const personName = String(r['姓名'] || r[keys[0]] || '').trim();
        if (!personName) continue;

        for (const key of nonNameCols) {
          if (!key.includes('-')) continue;
          const val = r[key];
          if (val === '' || val === null || val === undefined) continue;

          const dashIdx = key.indexOf('-');
          const groupName = key.substring(0, dashIdx).trim();
          const slotName = key.substring(dashIdx + 1).trim();

          rows.push({
            person_name: personName,
            group_name: groupName,
            slot_name: slotName,
            score: parseFloat(val) || 0,
            record_date: ''
          });
        }
      }
    }

    resultDiv.innerHTML = '<div class="loading">导入中...</div>';

    const res = await apiAuthPost('/import', { rows }, adminToken);
    let html = '';
    if (res.success) {
      html = `<div class="import-result success">成功导入 ${res.imported} 条记录`;
      if (res.errors && res.errors.length > 0) {
        html += '<br><br>错误:<br>';
        for (const err of res.errors) {
          html += `第${err.row}行: ${err.message}<br>`;
        }
      }
      html += '</div>';
    } else {
      html = `<div class="import-result error">${res.error}</div>`;
    }
    resultDiv.innerHTML = html;
  } catch(e) {
    resultDiv.innerHTML = `<div class="import-result error">导入失败: ${e.message}</div>`;
  }
}

async function loadAnnouncements() {
  const container = document.getElementById('announcementsList');
  if (!container) return;
  const res = await apiGet('/announcements');
  if (!res.success) return;

  let html = '';
  for (const a of (res.data || [])) {
    html += `<div class="announcement-item">
      <span class="announcement-content">${esc(a.content)}</span>
      <span class="${a.is_active ? 'announcement-active' : 'announcement-inactive'}">${a.is_active ? '启用' : '停用'}</span>
      ${a.is_active ? `<button class="btn btn-outline" style="font-size:11px;padding:3px 8px" onclick="toggleAnnouncement(${a.id}, 0)">停用</button>` : ''}
    </div>`;
  }
  html += `<div style="margin-top:8px; display:flex; gap:6px;">
    <input type="text" id="newAnnouncementContent" class="form-input" placeholder="输入公告内容" style="flex:1">
    <button class="btn btn-primary" onclick="addAnnouncement()">发布</button>
  </div>`;
  container.innerHTML = html;
}

async function addAnnouncement() {
  const content = document.getElementById('newAnnouncementContent').value.trim();
  if (!content) return showToast('请输入公告内容', true);
  const res = await apiAuthPost('/announcements', { content }, adminToken);
  showToast(res.success ? '公告已发布' : (res.error || '操作失败'), !res.success);
  if (res.success) loadAnnouncements();
}

async function toggleAnnouncement(id, isActive) {
  const res = await apiAuthPut('/announcements', { id, is_active: isActive }, adminToken);
  showToast(res.success ? '已更新' : (res.error || '操作失败'), !res.success);
  if (res.success) loadAnnouncements();
}

async function loadSettings() {
  const container = document.getElementById('settingsInfo');
  if (!container) return;
  const res = await apiGet('/settings');
  if (!res.success) return;
  container.innerHTML = `
    <div class="card">
      <p>总记录数: <strong>${res.totalRecords || 0}</strong></p>
      <p>周期起始日期: ${res.cycleStartDate || '未设置'}</p>
    </div>
  `;
}

function loadAll() {
  loadGroups();
  loadAnnouncements();
  loadSettings();
}

document.addEventListener('DOMContentLoaded', () => {
  if (adminToken) {
    document.getElementById('loginOverlay').style.display = 'none';
    loadAll();
  } else {
    document.getElementById('loginOverlay').style.display = 'flex';
  }
  document.getElementById('adminPassword').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleLogin();
  });
});
