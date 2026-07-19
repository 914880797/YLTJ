let missingData = [];
let currentMissingPage = 1;
const MISSING_PAGE_SIZE = 50;

function renderMissingPage(pg) {
  const contentEl = document.getElementById('dashboardContent');
  currentMissingPage = pg;
  const totalPages = Math.ceil(missingData.length / MISSING_PAGE_SIZE);
  const start = (pg - 1) * MISSING_PAGE_SIZE;
  const items = missingData.slice(start, start + MISSING_PAGE_SIZE);
  let html = '<div class="card"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><h3 style="color:#333;font-size:15px;margin:0">缺卡人员 (' + missingData.length + '人)</h3>';
  if (totalPages > 1) {
    html += '<div style="display:flex;gap:4px;align-items:center">';
    html += '<button class="btn btn-sm" onclick="renderMissingPage(' + Math.max(1, pg - 1) + ')" ' + (pg === 1 ? 'disabled' : '') + '>上一页</button>';
    html += '<span style="font-size:12px;color:#666">' + pg + '/' + totalPages + '</span>';
    html += '<button class="btn btn-sm" onclick="renderMissingPage(' + Math.min(totalPages, pg + 1) + ')" ' + (pg === totalPages ? 'disabled' : '') + '>下一页</button>';
    html += '</div>';
  }
  html += '</div>';
  html += '<table><thead><tr><th>姓名</th><th>已完成</th><th>缺失</th></tr></thead><tbody>';
  for (const m of items) {
    html += `<tr><td>${esc(m.name)}</td><td>${m.done}</td><td style="color:#ef4444">${m.missing}</td></tr>`;
  }
  html += '</tbody></table></div>';
  contentEl.innerHTML = html;
}

function esc(s) {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

async function loadDashboard() {
  const statsEl = document.getElementById('dashboardStats');
  const contentEl = document.getElementById('dashboardContent');
  contentEl.innerHTML = '<div class="loading">加载中...</div>';

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
      renderMissingPage(1);
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
