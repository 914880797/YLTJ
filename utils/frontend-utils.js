const BASE = '/api';

async function apiGet(path) {
  const res = await fetch(BASE + path);
  return res.json();
}

async function apiPost(path, data) {
  const res = await fetch(BASE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  return res.json();
}

async function apiPut(path, data) {
  const res = await fetch(BASE + path, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  return res.json();
}

async function apiDelete(path, data) {
  const res = await fetch(BASE + path, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  return res.json();
}

async function apiPostForm(path, formData) {
  const res = await fetch(BASE + path, {
    method: 'POST',
    body: formData
  });
  return res.json();
}

async function apiAuthGet(path, token) {
  const res = await fetch(BASE + path, {
    headers: { 'Authorization': 'Bearer ' + token }
  });
  return res.json();
}

async function apiAuthPost(path, data, token) {
  const res = await fetch(BASE + path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + token
    },
    body: JSON.stringify(data)
  });
  return res.json();
}

async function apiAuthPut(path, data, token) {
  const res = await fetch(BASE + path, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + token
    },
    body: JSON.stringify(data)
  });
  return res.json();
}

async function apiAuthDelete(path, data, token) {
  const res = await fetch(BASE + path, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + token
    },
    body: JSON.stringify(data)
  });
  return res.json();
}

function getToken() {
  return localStorage.getItem('yltj_admin_token') || '';
}

function setToken(t) {
  localStorage.setItem('yltj_admin_token', t);
}

function clearToken() {
  localStorage.removeItem('yltj_admin_token');
}

function esc(s) {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

function todayDateStr() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}
