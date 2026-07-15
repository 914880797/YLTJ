function esc(s) {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

async function loadExportPreview() {
  const container = document.getElementById('exportContent');
  container.innerHTML = '<div class="loading">加载中...</div>';

  try {
    const { results: groups } = await apiGet('/groups');
    const groupNames = (groups?.data || []).map(g => g.name);

    const { results: rankings } = await apiGet('/rankings');
    const data = rankings?.data || [];

    if (data.length === 0) {
      container.innerHTML = '<div class="empty">暂无数据可导出</div>';
      return;
    }

    let html = '<table><thead><tr>';
    html += '<th>姓名</th>';
    for (const gn of groupNames) html += `<th>${esc(gn)}</th>`;
    html += '<th>总分</th></tr></thead><tbody>';

    for (const row of data) {
      html += '<tr>';
      html += `<td>${esc(row.name)}</td>`;
      for (const gn of groupNames) html += `<td>${row.group_scores[gn] || 0}</td>`;
      html += `<td><strong>${row.total_score}</strong></td>`;
      html += '</tr>';
    }

    html += '</tbody></table>';
    container.innerHTML = html;
  } catch(e) {
    container.innerHTML = `<div class="empty">加载失败: ${e.message}</div>`;
  }
}

async function exportRankings() {
  try {
    const { results: groups } = await apiGet('/groups');
    const groupNames = (groups?.data || []).map(g => g.name);

    const { results: rankings } = await apiGet('/rankings');
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
