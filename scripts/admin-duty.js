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
      html += `<div class="duty-group-item" style="margin-bottom:6px;padding:8px;background:#ffffff;border:1px solid #d0d0d0;border-radius:4px">
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
  overlay.style.display = 'flex';
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
  overlay.style.display = 'flex';
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
  overlay.style.display = 'flex';
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
  overlay.style.display = 'flex';
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
  overlay.style.display = 'flex';
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
  overlay.style.display = 'flex';
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
