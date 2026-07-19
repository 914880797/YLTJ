document.addEventListener('DOMContentLoaded', () => {
  if (adminToken) {
    document.getElementById('loginOverlay').style.display = 'none';
    loadAll();
  } else {
    document.getElementById('loginOverlay').style.display = 'flex';
  }
  document.getElementById('adminPassword').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleLogin();
  });
});
