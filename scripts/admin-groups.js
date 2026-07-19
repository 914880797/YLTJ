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

  const names = [...new Set(namesText.split(/[,，、\n\r]+/).map(n => n.trim()).filter(n => n && !n.startsWith('-')))];

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
  overlay.style.display = 'flex';
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
  overlay.style.display = 'flex';
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
