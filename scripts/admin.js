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

async function loadGroups() {
  const container = document.getElementById('groupsList');
  container.innerHTML = '<div class="loading">加载中...</div>';
  const res = await apiGet('/groups');
  if (!res.success) { container.innerHTML = `<div class="empty">${res.error}</div>`; return; }

  const groups = res.data || [];

  const slotsRes = await apiGet('/time-slots');
  const allSlots = (slotsRes.success && slotsRes.data) ? slotsRes.data : [];

  let html = '';
  html += '<button class="btn btn-primary" style="margin-bottom:12px" onclick="showAddGroup()">添加分组</button>';
  html += '<div style="display:flex;gap:16px;flex-wrap:wrap;align-items:flex-start">';
  html += '<div style="flex:1;min-width:360px">';

  for (const g of groups) {
    const projectKey = `group_${g.id}`;
    html += `<div class="duty-project card" style="margin-bottom:8px">
      <div style="display:flex;justify-content:space-between;align-items:center;cursor:pointer" onclick="toggleGroupProject('${projectKey}')">
        <div>
          <span id="${projectKey}_arrow" data-group-project style="color:#888;font-size:12px;margin-right:6px">&#9654;</span>
          <h3 style="color:#333;font-size:14px;margin:0;display:inline">${esc(g.name)}</h3>
          <span style="color:#f7a44a;font-size:11px;margin-left:8px">权重 ${g.score_weight || 1}</span>
          ${g.has_slots !== 0 ? `<span style="color:#888;font-size:11px;margin-left:8px">${g.slot_count || 0} 个时段</span>` : ''}
        </div>
        <div>
          ${g.has_slots !== 0 ? `<button onclick="event.stopPropagation();loadSlots(${g.id}, '${esc(g.name)}')" style="font-size:11px;padding:3px 8px">时段</button>` : ''}
          <button onclick="event.stopPropagation();editGroup(${g.id}, '${esc(g.name)}', ${g.order_index}, ${g.has_slots||1})" style="font-size:11px;padding:3px 8px">编辑</button>
          ${g.order_index > 1 ? `<button onclick="event.stopPropagation();moveGroup(${g.id}, -1)" style="font-size:11px;padding:3px 8px">上移</button>` : ''}
          ${g.order_index < groups.length ? `<button onclick="event.stopPropagation();moveGroup(${g.id}, 1)" style="font-size:11px;padding:3px 8px">下移</button>` : ''}
          <button class="btn-danger" onclick="event.stopPropagation();deleteGroup(${g.id})" style="font-size:11px;padding:3px 8px">删除</button>
        </div>
      </div>
      <div id="${projectKey}_body" data-group-project style="display:none;margin-top:8px;border-top:1px solid #ddd;padding-top:8px">${
        allSlots.filter(s => s.group_id == g.id && (!s.source || s.source === 'groups')).length > 0
          ? allSlots.filter(s => s.group_id == g.id && (!s.source || s.source === 'groups')).map(s => `<span style="display:inline-block;background:#f0f0f0;color:#666;font-size:12px;padding:2px 8px;border-radius:3px;margin:2px 4px 2px 0">${esc(s.time_range || s.name)}</span>`).join('')
          : '<span style="color:#888;font-size:12px">暂无时段</span>'
      }</div></div>`;
  }

  html += '</div>';

  html += `<div class="card" style="flex:1;min-width:340px;">
    <h3 style="color:#333;margin:0 0 12px;font-size:15px">智能导入</h3>
    <p style="color:#888;font-size:12px;margin-bottom:12px">选择分组和时段，粘贴人员名单直接导入计分</p>
    <div style="display:flex;gap:8px;margin-bottom:12px">
      <div class="form-group" style="flex:1;margin-bottom:0">
        <label>选择分组</label>
        <select id="groupImportGroup" onchange="onGroupImportChange()">
          <option value="">请选择分组</option>
          ${groups.filter(g => g.has_slots !== 0).map(g => `<option value="${g.id}|${g.score_weight||1}">${esc(g.name)}</option>`).join('')}
        </select>
      </div>
      <div class="form-group" style="flex:1;margin-bottom:0">
        <label>选择时段</label>
        <select id="groupImportSlot">
          <option value="">请先选择分组</option>
        </select>
      </div>
    </div>
    <div class="form-group">
      <label>日期</label>
      <input type="date" id="groupImportDate" class="form-input">
    </div>
    <div class="form-group">
      <label>粘贴人员名单（逗号/顿号/换行分隔）</label>
      <textarea id="groupImportNames" class="form-input" rows="4" style="resize:vertical;max-height:35vh;height:20vh;min-height:20vh" placeholder="张三，李四&#10;或每行一个名字&#10;支持逗号、顿号、换行分隔"></textarea>
    </div>
    <button class="btn btn-primary" onclick="handleGroupSmartImport()">开始导入</button>
    <div id="groupImportResult" style="margin-top:8px"></div>
  </div>`;

  html += '</div>';
  container.innerHTML = html;
  document.getElementById('groupImportDate').value = todayDateStr();
}

function toggleGroupProject(key) {
  const body = document.getElementById(key + '_body');
  const arrow = document.getElementById(key + '_arrow');
  const isOpen = body.style.display !== 'none';

  document.querySelectorAll('[id$="_body"][data-group-project]').forEach(b => { b.style.display = 'none'; });
  document.querySelectorAll('[id$="_arrow"][data-group-project]').forEach(a => { a.textContent = '\u25B6'; });

  if (!isOpen) {
    body.style.display = 'block';
    arrow.textContent = '\u25BC';
  }
}

async function onGroupImportChange() {
  const select = document.getElementById('groupImportGroup');
  const slotSelect = document.getElementById('groupImportSlot');
  const val = select.value;

  if (!val) {
    slotSelect.innerHTML = '<option value="">请先选择分组</option>';
    return;
  }

  const groupId = val.split('|')[0];
  const allSlots = await apiGet('/time-slots');
  let slots = [];
  if (allSlots.success && allSlots.data) {
    slots = allSlots.data.filter(s => s.group_id == groupId && (!s.source || s.source === 'groups'));
  }

  if (slots.length === 0) {
    slotSelect.innerHTML = '<option value="">该分组暂无时段</option>';
    return;
  }

  slotSelect.innerHTML = slots.map(s => `<option value="${s.id}">${esc(s.time_range || s.name)}</option>`).join('');
}

async function handleGroupSmartImport() {
  const select = document.getElementById('groupImportGroup');
  const val = select.value;
  const slotSelect = document.getElementById('groupImportSlot');
  const slotId = slotSelect.value;
  const recordDate = document.getElementById('groupImportDate').value || todayDateStr();
  const namesText = document.getElementById('groupImportNames').value.trim();
  const resultDiv = document.getElementById('groupImportResult');

  if (!val) return showToast('请选择分组', true);
  if (!slotId) return showToast('请选择时段', true);
  if (!namesText) return showToast('请输入人员名单', true);

  const parts = val.split('|');
  const groupId = parts[0];

  const names = namesText.split(/[,，、\n\r]+/).map(n => n.trim()).filter(n => n && !n.startsWith('-'));
  if (names.length === 0) { resultDiv.innerHTML = '<div class="import-result error">未识别到有效姓名</div>'; return; }

  resultDiv.innerHTML = `<div class="loading">正在导入 ${names.length} 人...</div>`;

  const res = await apiAuthPost('/groups', {
    type: 'smart-import',
    group_id: parseInt(groupId),
    slot_id: parseInt(slotId),
    names: names,
    record_date: recordDate
  }, adminToken);

  if (res.success) {
    resultDiv.innerHTML = `<div class="import-result success">${res.message || '导入成功'}</div>`;
    showToast(res.message || '导入成功');
  } else {
    resultDiv.innerHTML = `<div class="import-result error">${res.error}</div>`;
    showToast(res.error, true);
  }
}

async function showAddGroup() {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.style.display = 'block';
  overlay.innerHTML = `<div class="modal" style="max-width:350px">
    <h3 style="color:#333;margin:0 0 10px;font-size:15px">添加分组</h3>
    <div class="form-group">
      <label>分组名称</label>
      <input type="text" id="newGroupName" class="form-input" placeholder="如: 分组A">
    </div>
    <div class="form-group">
      <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
        <input type="checkbox" id="newHasSlots" checked> 需要时段管理（用于打卡计分）
      </label>
    </div>
    <button class="btn btn-primary" onclick="addGroupFromModal()">确定</button>
    <button class="btn btn-outline" style="margin-left:6px" onclick="this.closest('.modal-overlay').remove()">取消</button>
  </div>`;
  document.body.appendChild(overlay);
}

async function addGroupFromModal() {
  const name = document.getElementById('newGroupName').value.trim();
  const hasSlots = document.getElementById('newHasSlots').checked ? 1 : 0;
  if (!name) return showToast('请输入分组名称', true);
  const res = await apiAuthPost('/groups', { name, has_slots: hasSlots }, adminToken);
  document.querySelectorAll('.modal-overlay').forEach(m => m.remove());
  showToast(res.success ? '分组创建成功' : (res.error || '操作失败'), !res.success);
  if (res.success) loadGroups();
}

async function editGroup(id, oldName, oldOrder, oldHasSlots) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.style.display = 'block';
  overlay.innerHTML = `<div class="modal" style="max-width:350px">
    <h3 style="color:#333;margin:0 0 10px;font-size:15px">编辑分组</h3>
    <div class="form-group">
      <label>分组名称</label>
      <input type="text" id="editGroupName" class="form-input" value="${esc(oldName)}">
    </div>
    <div class="form-group">
      <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
        <input type="checkbox" id="editHasSlots" ${oldHasSlots !== 0 ? 'checked' : ''}> 需要时段管理（用于打卡计分）
      </label>
    </div>
    <button class="btn btn-primary" onclick="submitEditGroup(${id})">保存</button>
    <button class="btn btn-outline" style="margin-left:6px" onclick="this.closest('.modal-overlay').remove()">取消</button>
  </div>`;
  document.body.appendChild(overlay);
}

async function submitEditGroup(id) {
  const name = document.getElementById('editGroupName').value.trim();
  const hasSlots = document.getElementById('editHasSlots').checked ? 1 : 0;
  if (!name) return showToast('请输入分组名称', true);
  const res = await apiAuthPut('/groups', { id, name, has_slots: hasSlots }, adminToken);
  document.querySelectorAll('.modal-overlay').forEach(m => m.remove());
  showToast(res.success ? '已更新' : (res.error || '操作失败'), !res.success);
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

function todayDateStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

async function loadAnnouncements() {
  const container = document.getElementById('announcementsList');
  if (!container) return;
  const res = await apiGet('/announcements?all=1');
  if (!res.success) return;

  let html = '';
  const activeList = (res.data || []).filter(a => a.is_active);
  for (const a of activeList) {
    html += `<div class="announcement-item">
      <span style="color:#4a6cf7;font-weight:600;font-size:12px;margin-right:8px;min-width:24px">#${a.order_index || 0}</span>
      <span class="announcement-content">${esc(a.content)}</span>
      <span class="announcement-active">启用</span>
      <button class="btn btn-outline" style="font-size:11px;padding:3px 8px" onclick="toggleAnnouncement(${a.id}, 0)">停用</button>
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
  const groupsRes = await apiGet('/groups');
  const groups = groupsRes.success ? (groupsRes.data || []) : [];

  let html = `
    <div class="card">
      <p>总记录数: <strong>${res.totalRecords || 0}</strong></p>
      <p>周期起始日期: ${res.cycleStartDate || '未设置'}</p>
    </div>
    <div class="card" style="margin-top:12px">
      <h3 style="color:#333;margin-bottom:8px;font-size:15px">分组分值设置</h3>
      <p style="color:#888;font-size:12px;margin-bottom:8px">每个分组的打卡位数据计数后乘以此分值</p>
  `;

  for (const g of groups) {
    html += `<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
      <span style="color:#666;font-size:13px;min-width:80px">${esc(g.name)}</span>
      <input type="number" id="groupWeight_${g.id}" value="${g.score_weight || 1}" step="0.1" min="0" style="width:80px;padding:4px 8px;background:#f0f0f0;border:1px solid #ddd;border-radius:4px;color:#333;font-size:13px">
      <button class="btn btn-outline" style="font-size:11px;padding:3px 10px" onclick="updateGroupWeight(${g.id})">保存</button>
    </div>`;
  }

  html += '</div>';
  container.innerHTML = html;
}

async function updateGroupWeight(groupId) {
  const input = document.getElementById(`groupWeight_${groupId}`);
  const weight = parseFloat(input.value);
  if (isNaN(weight) || weight < 0) return showToast('请输入有效的分值', true);
  const res = await apiAuthPut('/groups', { id: groupId, score_weight: weight }, adminToken);
  showToast(res.success ? '分值已更新' : (res.error || '操作失败'), !res.success);
  if (res.success) loadSettings();
}

function loadAll() {
  loadGroups();
  loadAnnouncements();
  loadSettings();
}

async function loadDuty() {
  const container = document.getElementById('dutyList');
  if (!container) return;
  container.innerHTML = '<div class="loading">加载中...</div>';

  const projectsRes = await apiGet('/duty-projects');
  if (!projectsRes.success) {
    container.innerHTML = `<div class="empty">${projectsRes.error}</div>`;
    return;
  }

  const configRes = await apiGet('/duty-config');
  const dutyData = configRes.success ? (configRes.data || []) : [];

  let html = '<button class="btn btn-primary" style="margin-bottom:12px" onclick="showAddDutyProject()">添加值班项目</button>';
  html += '<button class="btn btn-outline" style="margin-bottom:12px;margin-left:6px" onclick="handleAutoScore()">一键加分</button>';
  html += '<input type="date" id="autoScoreDate" class="form-input" style="width:140px;margin-bottom:12px;margin-left:6px;display:inline-block">';
  html += '<div id="autoScoreResult" style="margin-bottom:8px"></div>';

  const projects = projectsRes.data || [];

  for (const dp of projects) {
    const dpd = dutyData.find(d => d.id === dp.id) || { groups: [] };

    html += `<div class="duty-project card" style="margin-bottom:8px">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div>
          <h3 style="color:#333;font-size:14px;margin:0;display:inline">${esc(dp.name)}</h3>
          ${dp.bind_group_name ? `<span style="color:#888;font-size:11px;margin-left:8px">绑定: ${esc(dp.bind_group_name)}</span>` : ''}
        </div>
        <div>
          <button onclick="editDutyProject(${dp.id},'${esc(dp.name)}',${dp.bind_group_id||0})" style="font-size:11px;padding:3px 8px">编辑</button>
          <button onclick="deleteDutyProject(${dp.id})" class="btn-danger" style="font-size:11px;padding:3px 8px">删除</button>
        </div>
      </div>
      <hr style="border-color:#ddd;margin:8px 0">`;

    for (const dg of dpd.groups) {
      html += `<div class="duty-group-item" style="margin-bottom:6px;padding:8px;background:#f0f0f0;border-radius:4px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
          <span style="color:#4a6cf7;font-weight:600;font-size:13px">${esc(dg.name || '未命名')}</span>
          <div>
            <button onclick="editDutyGroup(${dg.id},'${esc(dg.name || '')}')" style="font-size:10px;padding:2px 6px">编辑</button>
            <button onclick="deleteDutyGroup(${dg.id})" class="btn-danger" style="font-size:10px;padding:2px 6px">删除</button>
          </div>
        </div>`;

      for (const sp of (dg.slots || [])) {
        html += `<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;font-size:12px;color:#666">
          <span style="flex:1;color:#333">${esc(sp.persons || '')}</span>
          <button onclick="editDutySlotPerson(${sp.id},'${esc(sp.persons || '')}')" style="font-size:10px;padding:2px 6px">编辑</button>
          <button onclick="deleteDutySlotPerson(${sp.id})" class="btn-danger" style="font-size:10px;padding:2px 6px">删除</button>
        </div>`;
      }

      html += `<div style="margin-top:4px" id="addSlotForm_${dg.id}">
        <button onclick="showAddDutySlotPerson(${dg.id})" style="font-size:11px;padding:3px 8px">+ 添加人员</button>
      </div></div>`;
    }

    html += `<div style="margin-top:6px">
      <button onclick="showAddDutyGroup(${dp.id})" style="font-size:11px;padding:3px 8px">+ 添加分组</button>
    </div></div>`;
  }

  container.innerHTML = html;
  const dateInput = document.getElementById('autoScoreDate');
  if (dateInput) dateInput.value = todayDateStr();
}

async function showAddDutyProject() {
  const groupsRes = await apiGet('/groups');
  const groups = groupsRes.success ? (groupsRes.data || []) : [];

  let groupOptions = '<option value="">不绑定（无法自动加分）</option>';
  for (const g of groups) {
    groupOptions += `<option value="${g.id}">${esc(g.name)}</option>`;
  }

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.style.display = 'block';
  overlay.innerHTML = `<div class="modal" style="max-width:350px">
    <h3 style="color:#333;margin:0 0 10px;font-size:15px">添加值班项目</h3>
    <div class="form-group">
      <label>项目名称（如"会议"、"电报"）</label>
      <input type="text" id="newDutyProjectName" class="form-input" placeholder="会议">
    </div>
    <div class="form-group">
      <label>绑定主分组（用于加分）</label>
      <select id="newBindGroupId" class="form-input">${groupOptions}</select>
    </div>
    <button class="btn btn-primary" onclick="addDutyProjectFromModal()">确定</button>
    <button class="btn btn-outline" style="margin-left:6px" onclick="this.closest('.modal-overlay').remove()">取消</button>
  </div>`;
  document.body.appendChild(overlay);
}

async function addDutyProjectFromModal() {
  const name = document.getElementById('newDutyProjectName').value.trim();
  const bindGroupId = document.getElementById('newBindGroupId').value;
  if (!name) return showToast('请输入项目名称', true);
  const res = await apiAuthPost('/duty-projects', { name, bind_group_id: bindGroupId || null }, adminToken);
  document.querySelectorAll('.modal-overlay').forEach(m => m.remove());
  showToast(res.success ? '值班项目创建成功' : (res.error || '操作失败'), !res.success);
  if (res.success) loadDuty();
}

async function editDutyProject(id, oldName, oldBindGroupId) {
  const groupsRes = await apiGet('/groups');
  const groups = groupsRes.success ? (groupsRes.data || []) : [];

  let groupOptions = '<option value="">不绑定（无法自动加分）</option>';
  for (const g of groups) {
    groupOptions += `<option value="${g.id}" ${g.id == oldBindGroupId ? 'selected' : ''}>${esc(g.name)}</option>`;
  }

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.style.display = 'block';
  overlay.innerHTML = `<div class="modal" style="max-width:350px">
    <h3 style="color:#333;margin:0 0 10px;font-size:15px">编辑值班项目</h3>
    <div class="form-group">
      <label>项目名称</label>
      <input type="text" id="editDutyProjectName" class="form-input" value="${esc(oldName)}">
    </div>
    <div class="form-group">
      <label>绑定主分组（用于加分）</label>
      <select id="editBindGroupId" class="form-input">${groupOptions}</select>
    </div>
    <button class="btn btn-primary" onclick="submitEditDutyProject(${id})">保存</button>
    <button class="btn btn-outline" style="margin-left:6px" onclick="this.closest('.modal-overlay').remove()">取消</button>
  </div>`;
  document.body.appendChild(overlay);
}

async function submitEditDutyProject(id) {
  const name = document.getElementById('editDutyProjectName').value.trim();
  const bindGroupId = document.getElementById('editBindGroupId').value;
  if (!name) return showToast('请输入项目名称', true);
  const res = await apiAuthPut('/duty-projects', { id, name, bind_group_id: bindGroupId || null }, adminToken);
  document.querySelectorAll('.modal-overlay').forEach(m => m.remove());
  showToast(res.success ? '已更新' : (res.error || '操作失败'), !res.success);
  if (res.success) loadDuty();
}

async function deleteDutyProject(id) {
  if (!confirm('确定删除该值班项目及其下所有关联？')) return;
  const res = await apiAuthDelete('/duty-projects', { id }, adminToken);
  showToast(res.success ? '已删除' : (res.error || '操作失败'), !res.success);
  if (res.success) loadDuty();
}

async function showAddDutyGroup(dutyProjectId) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.style.display = 'block';
  overlay.innerHTML = `<div class="modal" style="max-width:350px">
    <h3 style="color:#333;margin:0 0 10px;font-size:15px">添加值班分组</h3>
    <div class="form-group">
      <label>分组名称</label>
      <input type="text" id="newDutyGroupName" class="form-input" placeholder="如: 分组A">
    </div>
    <button class="btn btn-primary" onclick="addDutyGroupFromModal(${dutyProjectId})">确定</button>
    <button class="btn btn-outline" style="margin-left:6px" onclick="this.closest('.modal-overlay').remove()">取消</button>
  </div>`;
  document.body.appendChild(overlay);
}

async function addDutyGroupFromModal(dutyProjectId) {
  const name = document.getElementById('newDutyGroupName').value.trim();
  if (!name) return showToast('请输入分组名称', true);
  const res = await apiAuthPost('/duty-config', { type: 'group', duty_project_id: dutyProjectId, name }, adminToken);
  document.querySelectorAll('.modal-overlay').forEach(m => m.remove());
  showToast(res.success ? '值班分组已创建' : (res.error || '操作失败'), !res.success);
  if (res.success) loadDuty();
}

async function editDutyGroup(id, currentName) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.style.display = 'block';
  overlay.innerHTML = `<div class="modal" style="max-width:350px">
    <h3 style="color:#333;margin:0 0 10px;font-size:15px">编辑值班分组</h3>
    <div class="form-group">
      <label>分组名称</label>
      <input type="text" id="editDutyGroupName" class="form-input" value="${esc(currentName)}">
    </div>
    <button class="btn btn-primary" onclick="submitEditDutyGroup(${id})">保存</button>
    <button class="btn btn-outline" style="margin-left:6px" onclick="this.closest('.modal-overlay').remove()">取消</button>
  </div>`;
  document.body.appendChild(overlay);
}

async function submitEditDutyGroup(id) {
  const name = document.getElementById('editDutyGroupName').value.trim();
  if (!name) return showToast('请输入分组名称', true);
  const res = await apiAuthPut('/duty-config', { type: 'group', id, name }, adminToken);
  document.querySelectorAll('.modal-overlay').forEach(m => m.remove());
  showToast(res.success ? '已更新' : (res.error || '操作失败'), !res.success);
  if (res.success) loadDuty();
}

async function deleteDutyGroup(id) {
  if (!confirm('确定删除该分组关联？')) return;
  const res = await apiAuthDelete('/duty-config', { type: 'group', id }, adminToken);
  showToast(res.success ? '已删除' : (res.error || '操作失败'), !res.success);
  if (res.success) loadDuty();
}

async function showAddDutySlotPerson(dutyGroupId) {
  const formHtml = `
    <div class="form-group">
      <label>人员名单（逗号/顿号/换行分隔，名前加 - 排除：-张三）</label>
      <textarea id="newPersons_${dutyGroupId}" class="form-input" rows="3" placeholder="贪狼，二哥，-张三"></textarea>
    </div>
  `;

  const existingForm = document.getElementById(`addSlotForm_${dutyGroupId}`);
  if (existingForm.querySelector('.duty-slot-add-form')) return;

  const div = document.createElement('div');
  div.className = 'duty-slot-add-form';
  div.innerHTML = formHtml + `<button class="btn btn-primary" style="margin-top:6px" onclick="addDutySlotPerson(${dutyGroupId})">确定</button>
    <button class="btn btn-outline" style="margin-top:6px;margin-left:6px" onclick="this.parentElement.remove()">取消</button>`;
  existingForm.appendChild(div);
}

async function addDutySlotPerson(dutyGroupId) {
  const persons = document.getElementById(`newPersons_${dutyGroupId}`).value.trim();
  if (!persons) return showToast('请输入人员名单', true);

  const res = await apiAuthPost('/duty-config', { type: 'slot', duty_group_id: dutyGroupId, persons }, adminToken);
  showToast(res.success ? '人员已添加' : (res.error || '操作失败'), !res.success);
  if (res.success) loadDuty();
}

async function editDutySlotPerson(id, currentPersons) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.style.display = 'block';
  overlay.innerHTML = `<div class="modal" style="max-width:400px">
    <h3 style="color:#333;margin:0 0 10px;font-size:15px">修改人员</h3>
    <div class="form-group">
      <label>人员名单（逗号/顿号/换行分隔，名前加 - 排除：-张三）</label>
      <textarea id="editPersons_${id}" class="form-input" rows="3">${esc(currentPersons)}</textarea>
    </div>
    <button class="btn btn-primary" onclick="submitEditDutySlotPerson(${id})">保存</button>
    <button class="btn btn-outline" style="margin-left:6px" onclick="this.closest('.modal-overlay').remove()">取消</button>
  </div>`;
  document.body.appendChild(overlay);
}

async function submitEditDutySlotPerson(id) {
  const persons = document.getElementById(`editPersons_${id}`).value.trim();
  if (!persons) return showToast('请输入人员名单', true);

  const res = await apiAuthPut('/duty-config', { type: 'slot', id, persons }, adminToken);
  document.querySelectorAll('.modal-overlay').forEach(m => m.remove());
  showToast(res.success ? '已更新' : (res.error || '操作失败'), !res.success);
  if (res.success) loadDuty();
}

async function deleteDutySlotPerson(id) {
  if (!confirm('确定删除该人员配置？')) return;
  const res = await apiAuthDelete('/duty-config', { type: 'slot', id }, adminToken);
  showToast(res.success ? '已删除' : (res.error || '操作失败'), !res.success);
  if (res.success) loadDuty();
}

async function handleAutoScore() {
  const resultDiv = document.getElementById('autoScoreResult');
  const dateInput = document.getElementById('autoScoreDate');
  const date = dateInput ? dateInput.value : '';
  resultDiv.innerHTML = '<div class="loading">正在分析值班人员...</div>';

  const preview = await apiAuthPost('/duty-config', { type: 'auto-score-preview', date: date || undefined }, adminToken);
  if (!preview.success) {
    resultDiv.innerHTML = `<div class="import-result error">${preview.error}</div>`;
    return;
  }

  if (!preview.active || preview.active.length === 0) {
    resultDiv.innerHTML = `<div class="import-result error">${preview.message || '无人员在班，无法加分'}</div>`;
    return;
  }

  let html = `<div class="modal" style="max-width:500px;max-height:70vh;overflow-y:auto">
    <h3 style="color:#333;margin:0 0 8px;font-size:15px">加分确认 - ${date || '今天'}</h3>
    <p style="color:#4caf50;font-size:13px;margin-bottom:8px">将加分 <strong>${preview.activeCount}</strong> 人</p>`;

  if (preview.excluded && preview.excluded.length > 0) {
    html += `<div style="background:#2d1b1b;padding:8px;border-radius:4px;margin-bottom:8px">
      <p style="color:#ef4444;font-size:13px;margin:0 0 4px">以下 <strong>${preview.excludedCount}</strong> 人因名前带"-"被排除（请假/停值）：</p>`;
    for (const p of preview.excluded) {
      html += `<p style="color:#ef8f8f;font-size:12px;margin:2px 0;display:flex;align-items:center;justify-content:space-between">
        <span>${esc(p.name)} (${esc(p.source)})</span>
        <button class="btn btn-sm" style="font-size:11px;padding:2px 8px" onclick="event.stopPropagation();removeExclusion(${p.duty_project_id},'${escAttr(p.name)}','${date}')">恢复</button>
      </p>`;
    }
    html += `<p style="color:#ef4444;font-size:11px;margin-top:6px">点击"恢复"去掉"-"号，或先在值班Tab中编辑人员名单。</p>
    </div>`;
  }

  html += `<button class="btn btn-primary" onclick="confirmAutoScore('${date}')">确认加分</button>
    <button class="btn btn-outline" style="margin-left:6px" onclick="this.closest('.modal-overlay').remove()">取消</button>
  </div>`;

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.style.display = 'block';
  overlay.innerHTML = html;
  document.body.appendChild(overlay);
  resultDiv.innerHTML = '';
}

async function confirmAutoScore(date) {
  document.querySelectorAll('.modal-overlay').forEach(m => m.remove());
  const resultDiv = document.getElementById('autoScoreResult');
  resultDiv.innerHTML = '<div class="loading">正在加分...</div>';
  const res = await apiAuthPost('/duty-config', { type: 'auto-score', date: date || undefined }, adminToken);
  if (res.success) {
    resultDiv.innerHTML = `<div class="import-result success">${res.message}</div>`;
    showToast(res.message);
  } else {
    resultDiv.innerHTML = `<div class="import-result error">${res.error}</div>`;
    showToast(res.error, true);
  }
}

async function removeExclusion(dutyProjectId, name, date) {
  const res = await apiAuthPost('/duty-config', { type: 'remove-exclusion', duty_project_id: dutyProjectId, name: name }, adminToken);
  if (res.success) {
    showToast(res.message);
    handleAutoScore();
  } else {
    showToast(res.error || '操作失败', true);
  }
}

async function loadReward() {
  const container = document.getElementById('rewardList');
  if (!container) return;
  container.innerHTML = '<div class="loading">加载中...</div>';

  const projectsRes = await apiGet('/reward-projects');
  if (!projectsRes.success) {
    container.innerHTML = `<div class="empty">${projectsRes.error}</div>`;
    return;
  }

  const projects = projectsRes.data || [];

  let html = '';
  html += '<button class="btn btn-primary" style="margin-bottom:12px" onclick="showAddRewardProject()">添加奖励项目</button>';
  html += '<div style="display:flex;gap:16px;flex-wrap:wrap;align-items:flex-start">';
  html += '<div style="flex:1;min-width:360px">';

  for (const rp of projects) {
    html += `<div class="duty-project card" style="margin-bottom:8px">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div>
          <h3 style="color:#333;font-size:14px;margin:0;display:inline">${esc(rp.name)}</h3>
          ${rp.bind_group_name ? `<span style="color:#888;font-size:11px;margin-left:8px">绑定: ${esc(rp.bind_group_name)}</span>` : '<span style="color:#ef4444;font-size:11px;margin-left:8px">未绑定</span>'}
          <span style="color:#f7a44a;font-size:11px;margin-left:8px">每人记${rp.score_weight || 1}分</span>
        </div>
        <div>
          <button onclick="editRewardProject(${rp.id},'${esc(rp.name)}',${rp.bind_group_id||0})" style="font-size:11px;padding:3px 8px">编辑</button>
          <button onclick="deleteRewardProject(${rp.id})" class="btn-danger" style="font-size:11px;padding:3px 8px">删除</button>
        </div>
      </div></div>`;
  }

  html += '</div>';

  html += `<div class="card" style="flex:1;min-width:340px;">
    <h3 style="color:#333;margin:0 0 12px;font-size:15px">智能导入</h3>
    <p style="color:#888;font-size:12px;margin-bottom:12px">选择奖励项目，粘贴人员名单直接导入计分</p>
    <div class="form-group">
      <label>选择奖励项目</label>
      <select id="rewardImportProject">
        <option value="">请选择奖励项目</option>
        ${projects.map(rp => `<option value="${rp.id}|${rp.bind_group_id||''}">${esc(rp.name)}</option>`).join('')}
      </select>
    </div>
    <div class="form-group">
      <label>日期</label>
      <input type="date" id="rewardImportDate" class="form-input">
    </div>
    <div class="form-group">
      <label>粘贴人员名单（逗号/顿号/换行分隔）</label>
      <textarea id="rewardImportNames" class="form-input" rows="4" style="resize:vertical;max-height:35vh;height:20vh;min-height:20vh" placeholder="张三，李四&#10;或每行一个名字&#10;支持逗号、顿号、换行分隔"></textarea>
    </div>
    <button class="btn btn-primary" onclick="handleRewardSmartImport()">开始导入</button>
    <div id="rewardImportResult" style="margin-top:8px"></div>
  </div>`;

  html += '</div>';
  container.innerHTML = html;
  document.getElementById('rewardImportDate').value = todayDateStr();
}

async function handleRewardSmartImport() {
  const select = document.getElementById('rewardImportProject');
  const val = select.value;
  const recordDate = document.getElementById('rewardImportDate').value || todayDateStr();
  const namesText = document.getElementById('rewardImportNames').value.trim();
  const resultDiv = document.getElementById('rewardImportResult');

  if (!val) return showToast('请选择奖励项目', true);
  if (!namesText) return showToast('请输入人员名单', true);

  const parts = val.split('|');
  const projectId = parts[0];
  const bindGroupId = parts[1];

  if (!bindGroupId) { resultDiv.innerHTML = '<div class="import-result error">该奖励项目未绑定主分组</div>'; return; }

  const names = namesText.split(/[,，、\n\r]+/).map(n => n.trim()).filter(n => n && !n.startsWith('-'));
  if (names.length === 0) { resultDiv.innerHTML = '<div class="import-result error">未识别到有效姓名</div>'; return; }

  resultDiv.innerHTML = `<div class="loading">正在导入 ${names.length} 人...</div>`;

  const res = await apiAuthPost('/reward-config', {
    type: 'smart-import',
    reward_project_id: parseInt(projectId),
    names: names,
    record_date: recordDate
  }, adminToken);

  if (res.success) {
    resultDiv.innerHTML = `<div class="import-result success">${res.message || '导入成功'}</div>`;
    showToast(res.message || '导入成功');
  } else {
    resultDiv.innerHTML = `<div class="import-result error">${res.error}</div>`;
    showToast(res.error, true);
  }
}

async function showAddRewardProject() {
  const groupsRes = await apiGet('/groups');
  const groups = groupsRes.success ? (groupsRes.data || []) : [];

  let groupOptions = '<option value="">不绑定（无法自动加分）</option>';
  for (const g of groups) {
    groupOptions += `<option value="${g.id}">${esc(g.name)}</option>`;
  }

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.style.display = 'block';
  overlay.innerHTML = `<div class="modal" style="max-width:350px">
    <h3 style="color:#333;margin:0 0 10px;font-size:15px">添加奖励项目</h3>
    <div class="form-group">
      <label>项目名称（如"优秀个人"、"突出贡献"）</label>
      <input type="text" id="newRewardProjectName" class="form-input" placeholder="优秀个人">
    </div>
    <div class="form-group">
      <label>绑定主分组（用于加分）</label>
      <select id="newRewardBindGroupId" class="form-input">${groupOptions}</select>
    </div>
    <div class="form-group">
      <label>计分系数（每人计几分）</label>
      <input type="number" id="newRewardScoreWeight" class="form-input" value="1" step="0.1" min="0">
    </div>
    <button class="btn btn-primary" onclick="addRewardProjectFromModal()">确定</button>
    <button class="btn btn-outline" style="margin-left:6px" onclick="this.closest('.modal-overlay').remove()">取消</button>
  </div>`;
  document.body.appendChild(overlay);
}

async function addRewardProjectFromModal() {
  const name = document.getElementById('newRewardProjectName').value.trim();
  const bindGroupId = document.getElementById('newRewardBindGroupId').value;
  const scoreWeight = parseFloat(document.getElementById('newRewardScoreWeight').value) || 1;
  if (!name) return showToast('请输入项目名称', true);
  const res = await apiAuthPost('/reward-projects', { name, bind_group_id: bindGroupId || null, score_weight: scoreWeight }, adminToken);
  document.querySelectorAll('.modal-overlay').forEach(m => m.remove());
  showToast(res.success ? '奖励项目创建成功' : (res.error || '操作失败'), !res.success);
  if (res.success) loadReward();
}

async function editRewardProject(id, oldName, oldBindGroupId) {
  const groupsRes = await apiGet('/groups');
  const groups = groupsRes.success ? (groupsRes.data || []) : [];

  let groupOptions = '<option value="">不绑定（无法自动加分）</option>';
  for (const g of groups) {
    groupOptions += `<option value="${g.id}" ${g.id == oldBindGroupId ? 'selected' : ''}>${esc(g.name)}</option>`;
  }

  const rewardsRes = await apiGet('/reward-projects');
  const reward = rewardsRes.success ? (rewardsRes.data || []).find(r => r.id === id) : null;
  const currentWeight = reward ? (reward.score_weight || 1) : 1;

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.style.display = 'block';
  overlay.innerHTML = `<div class="modal" style="max-width:350px">
    <h3 style="color:#333;margin:0 0 10px;font-size:15px">编辑奖励项目</h3>
    <div class="form-group">
      <label>项目名称</label>
      <input type="text" id="editRewardProjectName" class="form-input" value="${esc(oldName)}">
    </div>
    <div class="form-group">
      <label>绑定主分组（用于加分）</label>
      <select id="editRewardBindGroupId" class="form-input">${groupOptions}</select>
    </div>
    <div class="form-group">
      <label>计分系数（每人计几分）</label>
      <input type="number" id="editRewardScoreWeight" class="form-input" value="${currentWeight}" step="0.1" min="0">
    </div>
    <button class="btn btn-primary" onclick="submitEditRewardProject(${id})">保存</button>
    <button class="btn btn-outline" style="margin-left:6px" onclick="this.closest('.modal-overlay').remove()">取消</button>
  </div>`;
  document.body.appendChild(overlay);
}

async function submitEditRewardProject(id) {
  const name = document.getElementById('editRewardProjectName').value.trim();
  const bindGroupId = document.getElementById('editRewardBindGroupId').value;
  const scoreWeight = parseFloat(document.getElementById('editRewardScoreWeight').value) || 1;
  if (!name) return showToast('请输入项目名称', true);
  const res = await apiAuthPut('/reward-projects', { id, name, bind_group_id: bindGroupId || null, score_weight: scoreWeight }, adminToken);
  document.querySelectorAll('.modal-overlay').forEach(m => m.remove());
  showToast(res.success ? '已更新' : (res.error || '操作失败'), !res.success);
  if (res.success) loadReward();
}

async function deleteRewardProject(id) {
  if (!confirm('确定删除该奖励项目及其下所有关联？')) return;
  const res = await apiAuthDelete('/reward-projects', { id }, adminToken);
  showToast(res.success ? '已删除' : (res.error || '操作失败'), !res.success);
  if (res.success) loadReward();
}

async function showAddRewardSlotPerson(rewardProjectId) {
  const formHtml = `
    <div class="form-group">
      <label>人员名单（逗号/顿号/换行分隔，名前加 - 排除：-张三）</label>
      <textarea id="newRewardPersons_${rewardProjectId}" class="form-input" rows="3" placeholder="贪狼，二哥，-张三"></textarea>
    </div>
  `;

  const existingForm = document.getElementById(`addRewardSlotForm_${rewardProjectId}`);
  if (existingForm.querySelector('.reward-slot-add-form')) return;

  const div = document.createElement('div');
  div.className = 'reward-slot-add-form';
  div.innerHTML = formHtml + `<button class="btn btn-primary" style="margin-top:6px" onclick="addRewardSlotPerson(${rewardProjectId})">确定</button>
    <button class="btn btn-outline" style="margin-top:6px;margin-left:6px" onclick="this.parentElement.remove()">取消</button>`;
  existingForm.appendChild(div);
}

async function addRewardSlotPerson(rewardProjectId) {
  const persons = document.getElementById(`newRewardPersons_${rewardProjectId}`).value.trim();
  if (!persons) return showToast('请输入人员名单', true);

  const res = await apiAuthPost('/reward-config', { type: 'slot', reward_project_id: rewardProjectId, persons }, adminToken);
  showToast(res.success ? '人员已添加' : (res.error || '操作失败'), !res.success);
  if (res.success) loadReward();
}

async function editRewardSlotPerson(id, currentPersons) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.style.display = 'block';
  overlay.innerHTML = `<div class="modal" style="max-width:400px">
    <h3 style="color:#333;margin:0 0 10px;font-size:15px">修改人员</h3>
    <div class="form-group">
      <label>人员名单（逗号/顿号/换行分隔，名前加 - 排除：-张三）</label>
      <textarea id="editRewardPersons_${id}" class="form-input" rows="3">${esc(currentPersons)}</textarea>
    </div>
    <button class="btn btn-primary" onclick="submitEditRewardSlotPerson(${id})">保存</button>
    <button class="btn btn-outline" style="margin-left:6px" onclick="this.closest('.modal-overlay').remove()">取消</button>
  </div>`;
  document.body.appendChild(overlay);
}

async function submitEditRewardSlotPerson(id) {
  const persons = document.getElementById(`editRewardPersons_${id}`).value.trim();
  if (!persons) return showToast('请输入人员名单', true);

  const res = await apiAuthPut('/reward-config', { type: 'slot', id, persons }, adminToken);
  document.querySelectorAll('.modal-overlay').forEach(m => m.remove());
  showToast(res.success ? '已更新' : (res.error || '操作失败'), !res.success);
  if (res.success) loadReward();
}

async function deleteRewardSlotPerson(id) {
  if (!confirm('确定删除该人员配置？')) return;
  const res = await apiAuthDelete('/reward-config', { type: 'slot', id }, adminToken);
  showToast(res.success ? '已删除' : (res.error || '操作失败'), !res.success);
  if (res.success) loadReward();
}

async function handleRewardAutoScore() {
  const resultDiv = document.getElementById('rewardAutoScoreResult');
  const dateInput = document.getElementById('rewardAutoScoreDate');
  const date = dateInput ? dateInput.value : '';
  resultDiv.innerHTML = '<div class="loading">正在分析奖励人员...</div>';

  const preview = await apiAuthPost('/reward-config', { type: 'auto-score-preview', date: date || undefined }, adminToken);
  if (!preview.success) {
    resultDiv.innerHTML = `<div class="import-result error">${preview.error}</div>`;
    return;
  }

  if (!preview.active || preview.active.length === 0) {
    resultDiv.innerHTML = `<div class="import-result error">${preview.message || '无人员配置，无法加分'}</div>`;
    return;
  }

  let html = `<div class="modal" style="max-width:500px;max-height:70vh;overflow-y:auto">
    <h3 style="color:#333;margin:0 0 8px;font-size:15px">奖励加分确认 - ${date || '今天'}</h3>
    <p style="color:#4caf50;font-size:13px;margin-bottom:8px">将加分 <strong>${preview.activeCount}</strong> 人</p>`;

  if (preview.excluded && preview.excluded.length > 0) {
    html += `<div style="background:#2d1b1b;padding:8px;border-radius:4px;margin-bottom:8px">
      <p style="color:#ef4444;font-size:13px;margin:0 0 4px">以下 <strong>${preview.excludedCount}</strong> 人因名前带"-"被排除：</p>`;
    for (const p of preview.excluded) {
      html += `<p style="color:#ef8f8f;font-size:12px;margin:2px 0;display:flex;align-items:center;justify-content:space-between">
        <span>${esc(p.name)} (${esc(p.source)})</span>
        <button class="btn btn-sm" style="font-size:11px;padding:2px 8px" onclick="event.stopPropagation();removeRewardExclusion(${p.reward_project_id},'${escAttr(p.name)}','${date}')">恢复</button>
      </p>`;
    }
    html += `<p style="color:#ef4444;font-size:11px;margin-top:6px">点击"恢复"去掉"-"号，或先在奖励Tab中编辑人员名单。</p>
    </div>`;
  }

  html += `<button class="btn btn-primary" onclick="confirmRewardAutoScore('${date}')">确认加分</button>
    <button class="btn btn-outline" style="margin-left:6px" onclick="this.closest('.modal-overlay').remove()">取消</button>
  </div>`;

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.style.display = 'block';
  overlay.innerHTML = html;
  document.body.appendChild(overlay);
  resultDiv.innerHTML = '';
}

async function confirmRewardAutoScore(date) {
  document.querySelectorAll('.modal-overlay').forEach(m => m.remove());
  const resultDiv = document.getElementById('rewardAutoScoreResult');
  resultDiv.innerHTML = '<div class="loading">正在加分...</div>';
  const res = await apiAuthPost('/reward-config', { type: 'auto-score', date: date || undefined }, adminToken);
  if (res.success) {
    resultDiv.innerHTML = `<div class="import-result success">${res.message}</div>`;
    showToast(res.message);
  } else {
    resultDiv.innerHTML = `<div class="import-result error">${res.error}</div>`;
    showToast(res.error, true);
  }
}

async function removeRewardExclusion(rewardProjectId, name, date) {
  const res = await apiAuthPost('/reward-config', { type: 'remove-exclusion', reward_project_id: rewardProjectId, name: name }, adminToken);
  if (res.success) {
    showToast(res.message);
    handleRewardAutoScore();
  } else {
    showToast(res.error || '操作失败', true);
  }
}

async function loadWarmup() {
  const container = document.getElementById('warmupList');
  if (!container) return;
  container.innerHTML = '<div class="loading">加载中...</div>';

  const projectsRes = await apiGet('/warmup-projects');
  if (!projectsRes.success) {
    container.innerHTML = `<div class="empty">${projectsRes.error}</div>`;
    return;
  }

  const configRes = await apiGet('/warmup-config');
  const warmupData = configRes.success ? (configRes.data || []) : [];
  const projects = projectsRes.data || [];

  let html = '';
  html += '<button class="btn btn-primary" style="margin-bottom:12px" onclick="showAddWarmupProject()">添加预热项目</button>';
  html += '<div style="display:flex;gap:16px;flex-wrap:wrap;align-items:flex-start">';
  html += '<div style="flex:1;min-width:360px">';

  for (const wp of projects) {
    const wpd = warmupData.find(d => d.id === wp.id) || { groups: [] };
    const projectKey = `warmup_${wp.id}`;

    html += `<div class="duty-project card" style="margin-bottom:8px">
      <div style="display:flex;justify-content:space-between;align-items:center;cursor:pointer" onclick="toggleWarmupProject('${projectKey}')">
        <div>
          <span id="${projectKey}_arrow" data-warmup-project style="color:#888;font-size:12px;margin-right:6px">&#9654;</span>
          <h3 style="color:#333;font-size:14px;margin:0;display:inline">${esc(wp.name)}</h3>
          ${wp.bind_group_name ? `<span style="color:#888;font-size:11px;margin-left:8px">绑定: ${esc(wp.bind_group_name)}</span>` : '<span style="color:#ef4444;font-size:11px;margin-left:8px">未绑定</span>'}
        </div>
        <div>
          <button onclick="event.stopPropagation();editWarmupProject(${wp.id},'${esc(wp.name)}',${wp.bind_group_id||0})" style="font-size:11px;padding:3px 8px">编辑</button>
          <button onclick="event.stopPropagation();deleteWarmupProject(${wp.id})" class="btn-danger" style="font-size:11px;padding:3px 8px">删除</button>
        </div>
      </div>
      <div id="${projectKey}_body" data-warmup-project style="display:none;margin-top:8px;border-top:1px solid #ddd;padding-top:8px">`;

    for (const wg of wpd.groups) {
      html += `<div class="duty-group-item" style="margin-bottom:6px;padding:8px;background:#f0f0f0;border-radius:4px">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span style="color:#4a6cf7;font-weight:600;font-size:13px">${esc(wg.name || '未命名')}</span>
          <div>
            <button onclick="editWarmupGroup(${wg.id},'${esc(wg.name || '')}')" style="font-size:11px;padding:3px 8px">编辑</button>
            <button onclick="deleteWarmupGroup(${wg.id})" class="btn-danger" style="font-size:11px;padding:3px 8px">删除</button>
          </div>
        </div>
      </div>`;
    }

    html += `<div style="margin-top:6px">
      <button onclick="showAddWarmupGroup(${wp.id})" style="font-size:11px;padding:3px 8px">+ 添加分组</button>
    </div></div></div>`;
  }

  html += '</div>';

  html += `<div class="card" style="flex:1;min-width:340px;">
    <h3 style="color:#333;margin:0 0 12px;font-size:15px">智能导入</h3>
    <p style="color:#888;font-size:12px;margin-bottom:12px">选择预热项目和分组，粘贴人员名单直接导入计分</p>
    <div style="display:flex;gap:8px;margin-bottom:12px">
      <div class="form-group" style="flex:1;margin-bottom:0">
        <label>选择预热项目</label>
        <select id="warmupImportProject" onchange="onWarmupProjectChange()">
          <option value="">请选择预热项目</option>
          ${projects.map(wp => `<option value="${wp.id}|${wp.bind_group_id||''}">${esc(wp.name)}</option>`).join('')}
        </select>
      </div>
      <div class="form-group" style="flex:1;margin-bottom:0">
        <label>选择分组</label>
        <select id="warmupImportGroup">
          <option value="">请先选择预热项目</option>
        </select>
      </div>
    </div>
    <div class="form-group">
      <label>日期</label>
      <input type="date" id="warmupImportDate" class="form-input">
    </div>
    <div class="form-group">
      <label>粘贴人员名单（逗号/顿号/换行分隔）</label>
      <textarea id="warmupImportNames" class="form-input" rows="4" style="resize:vertical;max-height:35vh;height:20vh;min-height:20vh" placeholder="张三，李四&#10;或每行一个名字&#10;支持逗号、顿号、换行分隔"></textarea>
    </div>
    <button class="btn btn-primary" onclick="handleWarmupSmartImport()">开始导入</button>
    <div id="warmupImportResult" style="margin-top:8px"></div>
  </div>`;

  html += '</div>';
  container.innerHTML = html;
  document.getElementById('warmupImportDate').value = todayDateStr();
}

function toggleWarmupProject(key) {
  const body = document.getElementById(key + '_body');
  const arrow = document.getElementById(key + '_arrow');
  const isOpen = body.style.display !== 'none';

  document.querySelectorAll('[id$="_body"][data-warmup-project]').forEach(b => { b.style.display = 'none'; });
  document.querySelectorAll('[id$="_arrow"][data-warmup-project]').forEach(a => { a.textContent = '\u25B6'; });

  if (!isOpen) {
    body.style.display = 'block';
    arrow.textContent = '\u25BC';
  }
}

async function onWarmupProjectChange() {
  const select = document.getElementById('warmupImportProject');
  const groupSelect = document.getElementById('warmupImportGroup');
  const val = select.value;

  if (!val) {
    groupSelect.innerHTML = '<option value="">请先选择预热项目</option>';
    return;
  }

  const projectId = val.split('|')[0];
  const res = await apiGet(`/warmup-config?warmup_project_id=${projectId}`);

  if (!res.success || !res.data || res.data.length === 0) {
    groupSelect.innerHTML = '<option value="">该项目暂无分组</option>';
    return;
  }

  const project = res.data[0];
  const groups = project.groups || [];

  if (groups.length === 0) {
    groupSelect.innerHTML = '<option value="">该项目暂无分组</option>';
    return;
  }

  groupSelect.innerHTML = groups.map((g, i) =>
    `<option value="${g.id}">${esc(g.name || `分组${i+1}`)}</option>`
  ).join('');
}

async function handleWarmupSmartImport() {
  const select = document.getElementById('warmupImportProject');
  const val = select.value;
  const groupSelect = document.getElementById('warmupImportGroup');
  const warmupGroupId = groupSelect.value;
  const recordDate = document.getElementById('warmupImportDate').value || todayDateStr();
  const namesText = document.getElementById('warmupImportNames').value.trim();
  const resultDiv = document.getElementById('warmupImportResult');

  if (!val) return showToast('请选择预热项目', true);
  if (!warmupGroupId) return showToast('请选择分组', true);
  if (!namesText) return showToast('请输入人员名单', true);

  const parts = val.split('|');
  const projectId = parts[0];
  const bindGroupId = parts[1];

  if (!bindGroupId) { resultDiv.innerHTML = '<div class="import-result error">该预热项目未绑定主分组</div>'; return; }

  const names = namesText.split(/[,，、\n\r]+/).map(n => n.trim()).filter(n => n && !n.startsWith('-'));
  if (names.length === 0) { resultDiv.innerHTML = '<div class="import-result error">未识别到有效姓名</div>'; return; }

  resultDiv.innerHTML = `<div class="loading">正在导入 ${names.length} 人...</div>`;

  const res = await apiAuthPost('/warmup-config', {
    type: 'smart-import',
    warmup_project_id: parseInt(projectId),
    warmup_group_id: parseInt(warmupGroupId),
    names: names,
    record_date: recordDate
  }, adminToken);

  if (res.success) {
    resultDiv.innerHTML = `<div class="import-result success">${res.message || '导入成功'}</div>`;
    showToast(res.message || '导入成功');
  } else {
    resultDiv.innerHTML = `<div class="import-result error">${res.error}</div>`;
    showToast(res.error, true);
  }
}

async function showAddWarmupProject() {
  const groupsRes = await apiGet('/groups');
  const groups = groupsRes.success ? (groupsRes.data || []) : [];

  let groupOptions = '<option value="">不绑定（无法自动加分）</option>';
  for (const g of groups) {
    groupOptions += `<option value="${g.id}">${esc(g.name)}</option>`;
  }

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.style.display = 'block';
  overlay.innerHTML = `<div class="modal" style="max-width:350px">
    <h3 style="color:#333;margin:0 0 10px;font-size:15px">添加预热项目</h3>
    <div class="form-group">
      <label>项目名称</label>
      <input type="text" id="newWarmupProjectName" class="form-input" placeholder="如: 晨练">
    </div>
    <div class="form-group">
      <label>绑定主分组（用于加分）</label>
      <select id="newWarmupBindGroupId" class="form-input">${groupOptions}</select>
    </div>
    <button class="btn btn-primary" onclick="addWarmupProjectFromModal()">确定</button>
    <button class="btn btn-outline" style="margin-left:6px" onclick="this.closest('.modal-overlay').remove()">取消</button>
  </div>`;
  document.body.appendChild(overlay);
}

async function addWarmupProjectFromModal() {
  const name = document.getElementById('newWarmupProjectName').value.trim();
  const bindGroupId = document.getElementById('newWarmupBindGroupId').value;
  if (!name) return showToast('请输入项目名称', true);
  const res = await apiAuthPost('/warmup-projects', { name, bind_group_id: bindGroupId || null }, adminToken);
  document.querySelectorAll('.modal-overlay').forEach(m => m.remove());
  showToast(res.success ? '预热项目创建成功' : (res.error || '操作失败'), !res.success);
  if (res.success) loadWarmup();
}

async function editWarmupProject(id, oldName, oldBindGroupId) {
  const groupsRes = await apiGet('/groups');
  const groups = groupsRes.success ? (groupsRes.data || []) : [];

  let groupOptions = '<option value="">不绑定（无法自动加分）</option>';
  for (const g of groups) {
    groupOptions += `<option value="${g.id}" ${g.id == oldBindGroupId ? 'selected' : ''}>${esc(g.name)}</option>`;
  }

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.style.display = 'block';
  overlay.innerHTML = `<div class="modal" style="max-width:350px">
    <h3 style="color:#333;margin:0 0 10px;font-size:15px">编辑预热项目</h3>
    <div class="form-group">
      <label>项目名称</label>
      <input type="text" id="editWarmupProjectName" class="form-input" value="${esc(oldName)}">
    </div>
    <div class="form-group">
      <label>绑定主分组（用于加分）</label>
      <select id="editWarmupBindGroupId" class="form-input">${groupOptions}</select>
    </div>
    <button class="btn btn-primary" onclick="submitEditWarmupProject(${id})">保存</button>
    <button class="btn btn-outline" style="margin-left:6px" onclick="this.closest('.modal-overlay').remove()">取消</button>
  </div>`;
  document.body.appendChild(overlay);
}

async function submitEditWarmupProject(id) {
  const name = document.getElementById('editWarmupProjectName').value.trim();
  const bindGroupId = document.getElementById('editWarmupBindGroupId').value;
  if (!name) return showToast('请输入项目名称', true);
  const res = await apiAuthPut('/warmup-projects', { id, name, bind_group_id: bindGroupId || null }, adminToken);
  document.querySelectorAll('.modal-overlay').forEach(m => m.remove());
  showToast(res.success ? '已更新' : (res.error || '操作失败'), !res.success);
  if (res.success) loadWarmup();
}

async function deleteWarmupProject(id) {
  if (!confirm('确定删除该预热项目及其下所有关联？')) return;
  const res = await apiAuthDelete('/warmup-projects', { id }, adminToken);
  showToast(res.success ? '已删除' : (res.error || '操作失败'), !res.success);
  if (res.success) loadWarmup();
}

async function showAddWarmupGroup(wpId) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.style.display = 'block';
  overlay.innerHTML = `<div class="modal" style="max-width:350px">
    <h3 style="color:#333;margin:0 0 10px;font-size:15px">添加预热分组</h3>
    <div class="form-group">
      <label>分组名称</label>
      <input type="text" id="newWarmupGroupName" class="form-input" placeholder="如: 小组A">
    </div>
    <button class="btn btn-primary" onclick="addWarmupGroupFromModal(${wpId})">确定</button>
    <button class="btn btn-outline" style="margin-left:6px" onclick="this.closest('.modal-overlay').remove()">取消</button>
  </div>`;
  document.body.appendChild(overlay);
}

async function addWarmupGroupFromModal(wpId) {
  const name = document.getElementById('newWarmupGroupName').value.trim();
  if (!name) return showToast('请输入分组名称', true);
  const res = await apiAuthPost('/warmup-config', { type: 'group', warmup_project_id: wpId, name }, adminToken);
  document.querySelectorAll('.modal-overlay').forEach(m => m.remove());
  showToast(res.success ? '预热分组创建成功' : (res.error || '操作失败'), !res.success);
  if (res.success) loadWarmup();
}

function editWarmupGroup(id, oldName) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.style.display = 'block';
  overlay.innerHTML = `<div class="modal" style="max-width:350px">
    <h3 style="color:#333;margin:0 0 10px;font-size:15px">编辑预热分组</h3>
    <div class="form-group">
      <label>分组名称</label>
      <input type="text" id="editWarmupGroupName" class="form-input" value="${esc(oldName)}">
    </div>
    <button class="btn btn-primary" onclick="submitEditWarmupGroup(${id})">保存</button>
    <button class="btn btn-outline" style="margin-left:6px" onclick="this.closest('.modal-overlay').remove()">取消</button>
  </div>`;
  document.body.appendChild(overlay);
}

async function submitEditWarmupGroup(id) {
  const name = document.getElementById('editWarmupGroupName').value.trim();
  if (!name) return showToast('请输入分组名称', true);
  const res = await apiAuthPut('/warmup-config', { type: 'group', id, name }, adminToken);
  document.querySelectorAll('.modal-overlay').forEach(m => m.remove());
  showToast(res.success ? '已更新' : (res.error || '操作失败'), !res.success);
  if (res.success) loadWarmup();
}

async function deleteWarmupGroup(id) {
  if (!confirm('确定删除该预热分组？')) return;
  const res = await apiAuthDelete('/warmup-config', { type: 'group', id }, adminToken);
  showToast(res.success ? '已删除' : (res.error || '操作失败'), !res.success);
  if (res.success) loadWarmup();
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
