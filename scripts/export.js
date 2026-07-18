function esc(s) {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

async function loadExportPreview() {
  const container = document.getElementById('exportContent');
  container.innerHTML = '<div class="loading">加载中...</div>';

  try {
    const groups = await apiGet('/groups');
    const groupNames = (groups?.data || []).map(g => g.name);

    const rankings = await apiGet('/rankings');
    const data = rankings?.data || [];

    if (data.length === 0) {
      container.innerHTML = '<div class="empty">暂无数据可导出</div>';
      return;
    }

    let html = '<table style="min-width:600px"><thead><tr>';
    html += '<th style="position:sticky;left:0;top:0;z-index:2;background:#fff;min-width:80px">姓名</th>';
    for (const gn of groupNames) html += `<th style="min-width:90px">${esc(gn)}</th>`;
    html += '<th style="position:sticky;right:0;top:0;z-index:2;background:#fff;min-width:70px">总分</th></tr></thead><tbody>';

    for (const row of data) {
      html += `<tr data-name="${esc(row.name)}">`;
      html += `<td style="position:sticky;left:0;z-index:1;background:#fff">${esc(row.name)}</td>`;
      for (const gn of groupNames) html += `<td>${row.group_scores[gn] || 0}</td>`;
      html += `<td style="position:sticky;right:0;z-index:1;background:#fff"><strong>${row.total_score}</strong></td>`;
      html += '</tr>';
    }

    html += '</tbody></table>';
    container.innerHTML = html;
  } catch(e) {
    container.innerHTML = `<div class="empty">加载失败: ${e.message}</div>`;
  }
}

function filterExportTable() {
  const q = document.getElementById('exportSearch').value.trim().toLowerCase();
  const rows = document.querySelectorAll('#exportContent tbody tr');
  rows.forEach(r => r.style.background = '');
  if (!q) return;
  for (const r of rows) {
    const name = (r.getAttribute('data-name') || '').toLowerCase();
    if (name.includes(q)) {
      r.style.background = '#e8f0fe';
      r.scrollIntoView({ block: 'center', behavior: 'smooth' });
      break;
    }
  }
}

async function exportRankings() {
  try {
    const groups = await apiGet('/groups');
    const groupNames = (groups?.data || []).map(g => g.name);

    const rankings = await apiGet('/rankings');
    const data = rankings?.data || [];

    const header = ['姓名', ...groupNames, '总分'];
    const rows = data.map((row, idx) => {
      const r = [row.name];
      for (const gn of groupNames) r.push(row.group_scores[gn] || 0);
      r.push(row.total_score);
      return r;
    });

    const workbook = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
    XLSX.utils.book_append_sheet(workbook, ws, '排名');
    XLSX.writeFile(workbook, 'rankings.xlsx');
  } catch(e) {
    alert('导出失败: ' + e.message);
  }
}

document.addEventListener('DOMContentLoaded', loadExportPreview);
