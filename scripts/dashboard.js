function esc(s) {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

async function loadDashboard() {
  const container = document.getElementById('dashboardContent');
  container.innerHTML = '<div class="loading">加载中...</div>';

  try {
    const res = await apiGet('/dashboard');
    if (!res.success) { container.innerHTML = `<div class="empty">${res.error}</div>`; return; }

    let html = '<div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:12px;">';
    html += statCard('总人数', res.total_persons);
    html += statCard('总记录数', res.total_records);
    html += statCard('总打卡位数', res.total_slots);
    html += statCard('缺卡人数', res.missing_slots?.length || 0);
    html += '</div>';

    if (res.group_averages && res.group_averages.length > 0) {
      html += '<div class="card" style="margin-top:12px"><h3 style="color:#fff;margin-bottom:8px;font-size:15px">分组平均完成时段数</h3>';
      for (const ga of res.group_averages) {
        html += `<p style="color:#b0b0c0;font-size:13px">${esc(ga.group_name)}: <strong>${ga.avg_slots}</strong></p>`;
      }
      html += '</div>';
    }

    if (res.missing_slots && res.missing_slots.length > 0) {
      html += '<div class="card" style="margin-top:12px"><h3 style="color:#fff;margin-bottom:8px;font-size:15px">缺卡人员</h3>';
      html += '<table><thead><tr><th>姓名</th><th>已完成</th><th>缺失</th></tr></thead><tbody>';
      for (const m of res.missing_slots) {
        html += `<tr><td>${esc(m.name)}</td><td>${m.done}</td><td style="color:#ef4444">${m.missing}</td></tr>`;
      }
      html += '</tbody></table></div>';
    }

    container.innerHTML = html;
  } catch(e) {
    container.innerHTML = `<div class="empty">加载失败: ${e.message}</div>`;
  }
}

function statCard(title, value) {
  return `<div class="card" style="text-align:center">
    <div style="color:#888;font-size:12px">${title}</div>
    <div style="color:#4a6cf7;font-size:28px;font-weight:700;margin-top:4px">${value}</div>
  </div>`;
}

document.addEventListener('DOMContentLoaded', loadDashboard);
