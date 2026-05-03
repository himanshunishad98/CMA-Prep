
(function () {
  document.documentElement.style.visibility = 'hidden';
  var raw;
  try { raw = sessionStorage.getItem('cmaUser'); } catch (_) {}
  if (!raw) { window.location.replace('index.html#login'); return; }
  var user;
  try { user = JSON.parse(raw); } catch (_) { window.location.replace('index.html#login'); return; }
  if (user.role !== 'admin') { window.location.replace('dashboard.html'); return; }
  document.documentElement.style.visibility = '';
})();

