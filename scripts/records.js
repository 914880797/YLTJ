let allRecords = [];
let currentView = 'list';
let currentPage = 1;
let totalPages = 1;
let totalRecords = 0;
const PAGE_SIZE = 50;

function esc(s) {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

function showToast(msg, isError) {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();
  const t = document.createElement('div');
  t.className = `toast ${isError ? 'toast-error' : 'toast-success'}`;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2500);
}

async function loadRecords(page) {
  if (page !== undefined) currentPage = page;
  else currentPage = 1;

  const name = document.getElementById('filterName').value.trim();
  const startDate = document.getElementById('filterStartDate').value;
  const endDate = document.getElementById('filterEndDate').value;

  let path = `/records?page=${currentPage}&page_size=${PAGE_SIZE}&`;
  if (name) path += `name=${encodeURIComponent(name)}&`;
  if (startDate) path += `start_date=${startDate}&`;
  if (endDate) path += `end_date=${endDate}&`;

  const res = await apiGet(path);
  if (!res.success) return;
  allRecords = res.data || [];
  totalRecords = res.total || 0;
  totalPages = Math.ceil(totalRecords / PAGE_SIZE) || 1;
  renderView();
  renderPagination();
}

async function loadCrossTable() {
  const container = document.getElementById('recordsContainer');
  container.innerHTML = '<div class="loading">加载中...</div>';

  try {
    const name = document.getElementById('filterName').value.trim();
    const startDate = document.getElementById('filterStartDate').value;
    const endDate = document.getElementById('filterEndDate').value;

    let path = '/records/cross-table?';
    if (name) path += `name=${encodeURIComponent(name)}&`;
    if (startDate) path += `start_date=${startDate}&`;
    if (endDate) path += `end_date=${endDate}&`;

    const res = await apiGet(path);
    if (!res.success) { container.innerHTML = `<div class="empty">${res.error}</div>`; return; }

    if (!res.columns || res.columns.length === 0) {
      container.innerHTML = '<div class="empty">暂无数据，请先创建分组和时段</div>';
      return;
    }

    let html = '<table style="font-size:12px"><thead><tr><th>姓名</th>';
    for (const col of res.columns) {
      html += `<th>${esc(col.label)}</th>`;
    }
    html += '</tr></thead><tbody>';

    for (const row of (res.rows || [])) {
      html += '<tr>';
      html += `<td><strong>${esc(row.name)}</strong></td>`;
      for (const col of res.columns) {
        const val = row.scores[col.label];
        if (val === null || val === undefined) {
          html += '<td style="color:#ef4444">-</td>';
        } else {
          html += `<td>${val}</td>`;
        }
      }
      html += '</tr>';
    }
    html += '</tbody></table>';
    container.innerHTML = html;
    document.getElementById('paginationBar').innerHTML = '';
  } catch(e) {
    container.innerHTML = `<div class="empty">加载失败: ${e.message}</div>`;
  }
}

function renderView() {
  const container = document.getElementById('recordsContainer');
  if (currentView === 'cross') {
    loadCrossTable();
    return;
  }

  if (allRecords.length === 0) {
    container.innerHTML = '<div class="empty">暂无记录数据</div>';
    return;
  }

  let html = '<table><thead><tr>';
  html += '<th>姓名</th><th>分组</th><th>时段</th><th>分值</th><th>日期</th><th>导入时间</th>';
  if (getToken()) html += '<th>操作</th>';
  html += '</tr></thead><tbody>';

  for (const r of allRecords) {
    html += '<tr>';
    html += `<td>${esc(r.person_name)}</td>`;
    html += `<td>${esc(r.group_name || '')}</td>`;
    html += `<td>${esc(r.slot_name || r.time_range || '')}</td>`;
    html += `<td>${r.score}</td>`;
    html += `<td>${r.record_date}</td>`;
    html += `<td style="font-size:11px;color:#888">${r.created_at}</td>`;
    if (getToken()) {
      html += `<td>
        <button class="btn btn-outline" style="font-size:11px;padding:2px 8px" onclick="editRecord(${r.id}, ${r.score})">编辑</button>
        <button class="btn btn-danger" style="font-size:11px;padding:2px 8px" onclick="deleteRecord(${r.id})">删除</button>
      </td>`;
    }
    html += '</tr>';
  }
  html += '</tbody></table>';
  container.innerHTML = html;
  container.scrollTop = 0;
}

function renderPagination() {
  const bar = document.getElementById('paginationBar');
  if (!bar || totalPages <= 1) { if (bar) bar.innerHTML = ''; return; }

  let html = `<span>共 ${totalRecords} 条</span>`;
  html += `<button class="btn btn-outline" style="font-size:11px;padding:3px 10px" onclick="loadRecords(1)" ${currentPage === 1 ? 'disabled' : ''}>首页</button>`;
  html += `<button class="btn btn-outline" style="font-size:11px;padding:3px 10px" onclick="loadRecords(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}>上一页</button>`;
  html += `<span>${currentPage} / ${totalPages}</span>`;
  html += `<button class="btn btn-outline" style="font-size:11px;padding:3px 10px" onclick="loadRecords(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''}>下一页</button>`;
  html += `<button class="btn btn-outline" style="font-size:11px;padding:3px 10px" onclick="loadRecords(${totalPages})" ${currentPage === totalPages ? 'disabled' : ''}>末页</button>`;

  bar.innerHTML = html;
}

function switchView(view) {
  currentView = view;
  currentPage = 1;
  document.getElementById('btnList').classList.toggle('active', view === 'list');
  document.getElementById('btnCross').classList.toggle('active', view === 'cross');
  if (view === 'cross') loadCrossTable();
  else loadRecords(1);
}

async function editRecord(id, currentScore) {
  const score = prompt('修改分值：', currentScore);
  if (score === null) return;
  const token = getToken();
  if (!token) return showToast('请先登录管理员', true);
  const res = await apiAuthPut('/records', { id, score: parseFloat(score) || 0 }, token);
  showToast(res.success ? '记录已更新' : (res.error || '操作失败'), !res.success);
  if (res.success) loadRecords(currentPage);
}

async function deleteRecord(id) {
  if (!confirm('确定删除该记录？')) return;
  const token = getToken();
  if (!token) return showToast('请先登录管理员', true);
  const res = await apiAuthDelete('/records', { id }, token);
  showToast(res.success ? '记录已删除' : (res.error || '操作失败'), !res.success);
  if (res.success) loadRecords(currentPage);
}

document.addEventListener('DOMContentLoaded', () => {
  let timer;
  document.getElementById('filterName').addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(() => loadRecords(1), 300);
  });
  document.getElementById('filterStartDate').addEventListener('change', () => loadRecords(1));
  document.getElementById('filterEndDate').addEventListener('change', () => loadRecords(1));
  loadRecords(1);
});
