let missingData = [];
let currentMissingPage = 1;
let missingTotalPages = 1;
const MISSING_PAGE_SIZE = 50;

function renderMissingTable(pg) {
  const contentEl = document.getElementById('dashboardContent');
  currentMissingPage = pg;
  const start = (pg - 1) * MISSING_PAGE_SIZE;
  const items = missingData.slice(start, start + MISSING_PAGE_SIZE);

  let html = '<div class="card"><h3 style="color:#333;margin-bottom:8px;font-size:15px">缺卡人员 (' + missingData.length + '人)</h3>';
  html += '<table><thead><tr><th>姓名</th><th>已完成</th><th>缺失</th></tr></thead><tbody>';
  for (const m of items) {
    html += `<tr><td>${esc(m.name)}</td><td>${m.done}</td><td style="color:#ef4444">${m.missing}</td></tr>`;
  }
  html += '</tbody></table></div>';
  contentEl.innerHTML = html;
  contentEl.scrollTop = 0;
}

function renderMissingPagination() {
  const bar = document.getElementById('paginationBar');
  if (!bar || missingTotalPages <= 1) { if (bar) bar.innerHTML = ''; return; }

  let html = `<span>共 ${missingData.length} 人</span>`;
  html += `<button class="btn btn-outline" style="font-size:11px;padding:3px 10px" onclick="goPage(1)" ${currentMissingPage === 1 ? 'disabled' : ''}>首页</button>`;
  html += `<button class="btn btn-outline" style="font-size:11px;padding:3px 10px" onclick="goPage(${currentMissingPage - 1})" ${currentMissingPage === 1 ? 'disabled' : ''}>上一页</button>`;
  html += `<span>${currentMissingPage} / ${missingTotalPages}</span>`;
  html += `<button class="btn btn-outline" style="font-size:11px;padding:3px 10px" onclick="goPage(${currentMissingPage + 1})" ${currentMissingPage === missingTotalPages ? 'disabled' : ''}>下一页</button>`;
  html += `<button class="btn btn-outline" style="font-size:11px;padding:3px 10px" onclick="goPage(${missingTotalPages})" ${currentMissingPage === missingTotalPages ? 'disabled' : ''}>末页</button>`;

  bar.innerHTML = html;
}

function goPage(pg) {
  renderMissingTable(pg);
  renderMissingPagination();
}

async function loadDashboard() {
  const statsEl = document.getElementById('dashboardStats');
  const contentEl = document.getElementById('dashboardContent');
  const paginationBar = document.getElementById('paginationBar');
  contentEl.innerHTML = '<div class="loading">加载中...</div>';
  paginationBar.innerHTML = '';

  try {
    const res = await apiGet('/dashboard');
    if (!res.success) { contentEl.innerHTML = `<div class="empty">${res.error}</div>`; return; }

    let statsHtml = '<div class="dashboard-stats-grid">';
    statsHtml += statCard('总人数', res.total_persons);
    statsHtml += statCard('总记录数', res.total_records);
    statsHtml += statCard('总打卡位数', res.total_slots);
    statsHtml += statCard('缺卡人数', res.missing_slots?.length || 0);
    statsHtml += '</div>';

    if (res.group_averages && res.group_averages.length > 0) {
      statsHtml += '<div class="card" style="margin-top:12px"><h3 style="color:#333;margin-bottom:8px;font-size:15px">分组平均完成时段数</h3>';
      for (const ga of res.group_averages) {
        statsHtml += `<p style="color:#666;font-size:13px">${esc(ga.group_name)}: <strong>${ga.avg_slots}</strong></p>`;
      }
      statsHtml += '</div>';
    }

    statsEl.innerHTML = statsHtml;

    if (res.missing_slots && res.missing_slots.length > 0) {
      missingData = res.missing_slots;
      currentMissingPage = 1;
      missingTotalPages = Math.ceil(missingData.length / MISSING_PAGE_SIZE);
      renderMissingTable(1);
      renderMissingPagination();
    } else {
      contentEl.innerHTML = '<div class="empty">暂无缺卡数据</div>';
    }
  } catch(e) {
    contentEl.innerHTML = `<div class="empty">加载失败: ${e.message}</div>`;
  }
}

function statCard(title, value) {
  return `<div class="card stat-card">
    <div class="stat-card-title">${title}</div>
    <div class="stat-card-value">${value}</div>
  </div>`;
}

document.addEventListener('DOMContentLoaded', loadDashboard);
