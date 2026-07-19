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

  const names = [...new Set(namesText.split(/[,，、\n\r]+/).map(n => n.trim()).filter(n => n && !n.startsWith('-')))];
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
  overlay.style.display = 'flex';
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
  overlay.style.display = 'flex';
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
  overlay.style.display = 'flex';
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
  overlay.style.display = 'flex';
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
