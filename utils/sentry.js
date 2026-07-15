(function() {
  var dsn = window.SENTRY_DSN;
  if (!dsn) return;
  var env = window.SENTRY_ENV || 'production';
  window.onerror = function(msg, url, line, col, err) {
    var payload = {
      message: msg,
      source: url,
      line: line,
      col: col,
      env: env,
      timestamp: new Date().toISOString()
    };
    try {
      fetch(dsn.split('@')[0].replace('https://', '') + '/api/1/store/', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
    } catch(e) {}
  };
  window.addEventListener('unhandledrejection', function(e) {
    window.onerror(e.reason ? e.reason.message : 'Unhandled rejection', '', 0, 0, e.reason);
  });
})();
