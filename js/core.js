/* ════════════════════════════════════════════════════════════
   core.js — Page routing, shared DOM utilities
   Clinstrux · Clinical Decision Infrastructure
════════════════════════════════════════════════════════════ */

/* ─── Page routing ──────────────────────────────────────────────────────── */

function showSelector() {
  ['entry-page', 'workflow-page', 'abx-page', 'poly-page'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
  var sp = document.getElementById('selector-page');
  if (sp) { sp.style.display = 'block'; window.scrollTo({ top: 0, behavior: 'auto' }); }
}

function returnToSelector() { showSelector(); }

function enterWorkflow() {
  var ep = document.getElementById('entry-page');
  var wp = document.getElementById('workflow-page');
  var sp = document.getElementById('selector-page');
  if (ep) ep.style.display = 'none';
  if (sp) sp.style.display = 'none';
  if (wp) { wp.style.display = 'block'; window.scrollTo({ top: 0, behavior: 'auto' }); }
}

function enterAbxWorkflow() {
  var sp = document.getElementById('selector-page');
  var ap = document.getElementById('abx-page');
  if (sp) sp.style.display = 'none';
  if (ap) { ap.style.display = 'block'; window.scrollTo({ top: 0, behavior: 'auto' }); }
  abxRunReasoningEngine();
}

function enterPolyWorkflow() {
  var sp = document.getElementById('selector-page');
  var pp = document.getElementById('poly-page');
  if (sp) sp.style.display = 'none';
  if (pp) { pp.style.display = 'block'; window.scrollTo({ top: 0, behavior: 'auto' }); }
  polyRunReasoningEngine();
}

/* ─── Shared DOM helpers ────────────────────────────────────────────────── */

function flashElement(id) {
  var el = document.getElementById(id);
  if (!el) return;
  el.classList.remove('flash-update');
  void el.offsetWidth;
  el.classList.add('flash-update');
}

function setEl(id, text) {
  var el = document.getElementById(id);
  if (el) el.textContent = text;
}

function setElHtml(id, html) {
  var el = document.getElementById(id);
  if (el) el.innerHTML = html;
}

function setElClass(id, cls) {
  var el = document.getElementById(id);
  if (!el) return;
  var base = el.className.replace(/\b(r-low|r-mod|r-high|ip-val-ok|ip-val-warning|ip-val-danger|ip-warning|ip-danger)\b/g, '').trim();
  el.className = cls ? base + ' ' + cls : base;
}

/* ─── Global popover close (shared across all workflows) ────────────────── */

document.addEventListener('click', function(e) {
  // OA popovers
  if (typeof _activePopover !== 'undefined' && _activePopover) {
    var oaPop = document.getElementById('ip-pop-' + _activePopover);
    if (oaPop && !oaPop.contains(e.target)) closePopover(_activePopover);
  }
  // ABX popovers
  if (typeof _abxActivePopover !== 'undefined' && _abxActivePopover) {
    var abxPop = document.getElementById('abx-pop-' + _abxActivePopover);
    if (abxPop && !abxPop.contains(e.target)) abxClosePopover(_abxActivePopover);
  }
  // Poly popovers
  if (typeof _polyActivePopover !== 'undefined' && _polyActivePopover) {
    var polyPop = document.getElementById('poly-pop-' + _polyActivePopover);
    if (polyPop && !polyPop.contains(e.target)) polyClosePopover(_polyActivePopover);
  }
});
