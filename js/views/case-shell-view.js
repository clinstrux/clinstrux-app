/* ════════════════════════════════════════════════════════════
   views/case-shell-view.js — Router adapter for /cases/:id
   Clinstrux · Clinical Decision Infrastructure

   Implements the standard mount(container, params) / unmount()
   contract expected by Router.init(). Delegates all work to
   CaseShell — this file is intentionally thin.

   Replaces _CaseStubView in app.js.
════════════════════════════════════════════════════════════ */

var CaseShellView = (function () {

  function _esc(str) {
    if (!str && str !== 0) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function mount(container, params) {
    var caseId = params && params.id;

    if (!caseId) {
      _render404(container, '');
      return;
    }

    /* Validate case exists before handing to CaseShell */
    var kase = CaseManager.getCase(caseId);
    if (!kase) {
      _render404(container, caseId);
      return;
    }

    /* Delegate to CaseShell — this shows the workflow page
       and hides #app-view. container is left empty while
       the workflow page is the visible surface.             */
    var ok = CaseShell.mount(caseId);

    if (!ok) {
      /* CaseShell rejected the case (unknown workflowId etc) */
      if (container) {
        container.innerHTML =
          '<div class="clx-not-found">' +
            '<div class="clx-not-found-code">Error</div>' +
            '<div class="clx-not-found-msg">Could not open case</div>' +
            '<div class="clx-not-found-path">' + _esc(caseId) + '</div>' +
            '<button class="clx-btn clx-btn-secondary" ' +
              'onclick="Router.navigate(\'/cases\')">← Case List</button>' +
          '</div>';
        /* Ensure app-view is visible if CaseShell failed */
        var appView = document.getElementById('app-view');
        if (appView) appView.style.display = 'block';
      }
    }
  }

  function _render404(container, caseId) {
    if (!container) return;
    container.innerHTML =
      '<div class="clx-not-found">' +
        '<div class="clx-not-found-code">404</div>' +
        '<div class="clx-not-found-msg">Case not found</div>' +
        '<div class="clx-not-found-path">' + _esc(caseId) + '</div>' +
        '<button class="clx-btn clx-btn-secondary" ' +
          'onclick="Router.navigate(\'/cases\')">← Case List</button>' +
      '</div>';
  }

  function unmount() {
    CaseShell.unmount();
  }

  return { mount: mount, unmount: unmount };

}());
