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
      html += `<div class="duty-group-item" style="margin-bottom:6px;padding:8px;background:#ffffff;border:1px solid #d0d0d0;border-radius:4px">
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

  const names = [...new Set(namesText.split(/[,，、\n\r]+/).map(n => n.trim()).filter(n => n && !n.startsWith('-')))];
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
  overlay.style.display = 'flex';
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
  overlay.style.display = 'flex';
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
  overlay.style.display = 'flex';
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
  overlay.style.display = 'flex';
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
