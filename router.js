/* ════════════════════════════════════════════════════════════
   router.js — Client-side hash router
   Clinstrux · Clinical Decision Infrastructure

   Handles all navigation within the platform shell.
   Uses window.location.hash for routing (#/dashboard, etc.)
   Supports static routes and single named parameters (:id).

   Usage:
     Router.navigate('/dashboard')
     Router.navigate('/cases/new')
     Router.navigate('/cases/case_abc123')

   Each route handler receives { params: { id: '...' } }
   Views must implement mount(container) and unmount().
════════════════════════════════════════════════════════════ */

var Router = (function() {

  /* ── Route registry ─────────────────────────────────────────
     Each entry: { pattern, keys, handler }
     Keys holds named param names in order of appearance.       */
  var _routes  = [];
  var _current = null;   /* { view, route } currently mounted  */
  var _appView = null;   /* cached #app-view container         */

  /* ── Register a route ───────────────────────────────────────
     path:    '/dashboard' or '/cases/:id'
     handler: function(params) — params is { id: '...' } etc.  */
  function _register(path, handler) {
    var keys    = [];
    /* Convert path string to a RegExp.
       :param segments become capture groups.                   */
    var pattern = '^' + path.replace(/:([a-zA-Z_]+)/g, function(_, key) {
      keys.push(key);
      return '([^/]+)';
    }) + '(?:\\?.*)?$';   /* allow optional query string        */
    _routes.push({ pattern: new RegExp(pattern), keys: keys, handler: handler });
  }

  /* ── Parse hash ─────────────────────────────────────────────
     Strips leading # and optional /
     '#/cases/new?workflow=oa' → '/cases/new?workflow=oa'       */
  function _parsePath() {
    var hash = window.location.hash || '';
    return hash.replace(/^#/, '') || '/';
  }

  /* ── Parse query string ─────────────────────────────────────
     '?workflow=oa&foo=bar' → { workflow: 'oa', foo: 'bar' }    */
  function _parseQuery(pathWithQuery) {
    var qIdx   = pathWithQuery.indexOf('?');
    if (qIdx === -1) return {};
    var qs     = pathWithQuery.slice(qIdx + 1);
    var result = {};
    qs.split('&').forEach(function(pair) {
      var parts = pair.split('=');
      if (parts[0]) result[decodeURIComponent(parts[0])] = decodeURIComponent(parts[1] || '');
    });
    return result;
  }

  /* ── Resolve current hash against registered routes ────────  */
  function _resolve() {
    var fullPath = _parsePath();
    var query    = _parseQuery(fullPath);
    /* Strip query for pattern matching */
    var path     = fullPath.split('?')[0];

    for (var i = 0; i < _routes.length; i++) {
      var route = _routes[i];
      var match = path.match(route.pattern);
      if (match) {
        /* Extract named params */
        var params = { query: query };
        route.keys.forEach(function(key, idx) {
          params[key] = match[idx + 1];
        });
        route.handler(params);
        return;
      }
    }

    /* No match — render 404 */
    _render404(path);
  }

  /* ── Render a view ──────────────────────────────────────────
     Unmounts the current view (if any), then mounts the new one.
     The view object must expose mount(container) and unmount().  */
  function _mountView(view, params) {
    /* Unmount previous */
    if (_current && _current.view && typeof _current.view.unmount === 'function') {
      try { _current.view.unmount(); } catch (e) { console.error('[Router] unmount error:', e); }
    }

    /* Show app-view, hide workflow pages */
    _appView = _appView || document.getElementById('app-view');
    if (_appView) {
      _appView.style.display = 'block';
    }

    /* Hide all legacy workflow/selector pages when a platform view is active */
    ['entry-page', 'selector-page', 'workflow-page', 'abx-page', 'poly-page'].forEach(function(id) {
      var el = document.getElementById(id);
      if (el) el.style.display = 'none';
    });

    _current = { view: view };

    if (view && typeof view.mount === 'function') {
      try { view.mount(_appView, params); } catch (e) { console.error('[Router] mount error:', e); }
    }
  }

  /* ── 404 handler ────────────────────────────────────────────  */
  function _render404(path) {
    _appView = _appView || document.getElementById('app-view');
    if (_current && _current.view && typeof _current.view.unmount === 'function') {
      try { _current.view.unmount(); } catch (e) {}
    }
    _current = { view: null };
    if (_appView) {
      _appView.style.display = 'block';
      _appView.innerHTML =
        '<div class="clx-not-found">' +
          '<div class="clx-not-found-code">404</div>' +
          '<div class="clx-not-found-msg">Page not found</div>' +
          '<div class="clx-not-found-path">' + path + '</div>' +
          '<button class="clx-btn clx-btn-secondary" onclick="Router.navigate(\'/dashboard\')">← Dashboard</button>' +
        '</div>';
    }
    ['entry-page', 'selector-page', 'workflow-page', 'abx-page', 'poly-page'].forEach(function(id) {
      var el = document.getElementById(id);
      if (el) el.style.display = 'none';
    });
  }

  /* ══════════════════════════════════════════════════════════
     PUBLIC API
  ══════════════════════════════════════════════════════════ */

  /* Navigate to a path. Adds to browser history. */
  function navigate(path) {
    window.location.hash = '#' + path;
  }

  /* Replace current history entry without adding to stack. */
  function replace(path) {
    var hash = '#' + path;
    /* Use replaceState if available, otherwise just set hash */
    if (window.history && window.history.replaceState) {
      window.history.replaceState(null, '', hash);
      _resolve();
    } else {
      window.location.hash = hash;
    }
  }

  /* Initialise: register all routes and resolve initial path.
     routes: array of { path, view } objects.
     view objects must have mount(container, params) and unmount().  */
  function init(routes) {
    routes.forEach(function(r) {
      _register(r.path, function(params) {
        _mountView(r.view, params);
      });
    });

    /* Listen for hash changes */
    window.addEventListener('hashchange', function() {
      _resolve();
    });

    /* Resolve on init — redirect bare hash or / to /dashboard */
    var initial = _parsePath();
    if (initial === '/' || initial === '') {
      replace('/dashboard');
    } else {
      _resolve();
    }
  }

  /* Return the current parsed path (without hash prefix). */
  function currentPath() {
    return _parsePath();
  }

  return {
    navigate:    navigate,
    replace:     replace,
    init:        init,
    currentPath: currentPath
  };

}());
