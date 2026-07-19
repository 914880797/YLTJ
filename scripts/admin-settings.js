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
      <div style="display:flex;align-items:center;gap:8px;margin-top:8px">
        <span style="color:#666;font-size:13px">周期起始日期:</span>
        <input type="date" id="cycleStartDate" class="form-input" style="width:180px;margin-bottom:0" value="${res.cycleStartDate || ''}">
        <button class="btn btn-primary" onclick="saveCycleStartDate()">保存并重置数据</button>
      </div>
      <p style="color:#ef4444;font-size:11px;margin-top:6px">修改周期起始日期将清空所有智能导入的分数数据</p>
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

async function saveCycleStartDate() {
  const input = document.getElementById('cycleStartDate');
  if (!input || !input.value) return showToast('请选择日期', true);
  if (!confirm(`确认将周期起始日期设为 ${input.value} 吗？\n\n此操作将清空所有已导入的分数数据，不可恢复。`)) return;
  const res = await apiAuthPut('/settings', { cycleStartDate: input.value }, adminToken);
  showToast(res.success ? (res.message || '设置已保存') : (res.error || '操作失败'), !res.success);
  if (res.success) loadSettings();
}

async function updateGroupWeight(groupId) {
  const input = document.getElementById(`groupWeight_${groupId}`);
  const weight = parseFloat(input.value);
  if (isNaN(weight) || weight < 0) return showToast('请输入有效的分值', true);
  const res = await apiAuthPut('/groups', { id: groupId, score_weight: weight }, adminToken);
  showToast(res.success ? '分值已更新' : (res.error || '操作失败'), !res.success);
  if (res.success) loadSettings();
}
