async function loadRankings() {
  const container = document.getElementById('rankingList');
  const searchInput = document.getElementById('searchInput');
  const name = searchInput ? searchInput.value.trim() : '';

  container.innerHTML = '<div class="loading">加载中...</div>';

  try {
    const res = await apiGet('/rankings' + (name ? `?name=${encodeURIComponent(name)}` : ''));
    if (!res.success) { container.innerHTML = `<div class="empty">${res.error}</div>`; return; }

    const { results: groups } = await apiGet('/groups');
    const groupNames = (groups?.data || []).map(g => g.name);

    if (!res.data || res.data.length === 0) {
      container.innerHTML = '<div class="empty">暂无排名数据，请先导入数据</div>';
      return;
    }

    let html = '<table><thead><tr>';
    html += '<th>排名</th><th>姓名</th>';
    for (const gn of groupNames) {
      html += `<th>${gn}</th>`;
    }
    html += '<th>总分</th></tr></thead><tbody>';

    for (const row of res.data) {
      html += '<tr>';
      html += `<td><strong>#${row.rank}</strong></td>`;
      html += `<td>${esc(row.name)}</td>`;
      for (const gn of groupNames) {
        html += `<td>${row.group_scores[gn] || 0}</td>`;
      }
      html += `<td><strong>${row.total_score}</strong></td>`;
      html += '</tr>';
    }

    html += '</tbody></table>';
    container.innerHTML = html;
  } catch (e) {
    container.innerHTML = `<div class="empty">加载失败: ${e.message}</div>`;
  }
}

function esc(s) {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

async function loadAnnouncements() {
  const bar = document.getElementById('announcementBar');
  if (!bar) return;
  try {
    const res = await apiGet('/announcements');
    if (res.success && res.data && res.data.length > 0) {
      const active = res.data.filter(a => a.is_active !== 0);
      if (active.length === 0) { bar.style.display = 'none'; return; }
      const joined = active.map(a => `#${a.order_index || 0} ${a.content}`).join('  \u3000\u3000  ');
      bar.innerHTML = `<span class="announcement-marquee">${esc(joined)}${esc('  \u3000\u3000  ' + joined)}</span>`;
      bar.style.display = 'block';
    } else {
      bar.style.display = 'none';
    }
  } catch(e) {
    bar.style.display = 'none';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  loadAnnouncements();
  loadRankings();
  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    let timer;
    searchInput.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(loadRankings, 300);
    });
  }
});
