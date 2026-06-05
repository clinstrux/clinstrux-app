/* ════════════════════════════════════════════════════════════
   event-bus.js — Platform-wide publish / subscribe
   Clinstrux · Clinical Decision Infrastructure

   Lightweight synchronous event bus. No external dependencies.
   All platform modules communicate through this bus rather than
   holding direct references to each other.

   Usage:
     EventBus.on('case:created', function(payload) { ... });
     EventBus.emit('case:created', { caseId: 'case_abc123' });
     EventBus.off('case:created', handlerRef);
════════════════════════════════════════════════════════════ */

var EventBus = (function() {

  /* Internal handler registry — keyed by event name */
  var _handlers = {};

  /* ── Subscribe ─────────────────────────────────────────────
     Register a handler for an event.
     The same handler can be registered for multiple events.
     Registering the same handler for the same event twice is
     a no-op (guarded against duplicate registration).           */
  function on(event, handler) {
    if (typeof event !== 'string' || !event) {
      console.warn('[EventBus] on(): event name must be a non-empty string');
      return;
    }
    if (typeof handler !== 'function') {
      console.warn('[EventBus] on(): handler must be a function');
      return;
    }
    if (!_handlers[event]) {
      _handlers[event] = [];
    }
    /* Guard against duplicate registration */
    if (_handlers[event].indexOf(handler) === -1) {
      _handlers[event].push(handler);
    }
  }

  /* ── Unsubscribe ────────────────────────────────────────────
     Remove a specific handler from an event.
     If the handler is not registered, this is a silent no-op.   */
  function off(event, handler) {
    if (!_handlers[event]) return;
    var idx = _handlers[event].indexOf(handler);
    if (idx !== -1) {
      _handlers[event].splice(idx, 1);
    }
  }

  /* ── Emit ───────────────────────────────────────────────────
     Dispatch an event synchronously to all registered handlers.
     Handlers are called in registration order.
     Errors in individual handlers are caught and logged so that
     one failing handler does not prevent others from running.    */
  function emit(event, payload) {
    if (!_handlers[event] || _handlers[event].length === 0) return;
    /* Shallow-copy the handler list before iterating so that
       handlers which call off() during dispatch do not corrupt
       the iteration.                                             */
    var list = _handlers[event].slice();
    for (var i = 0; i < list.length; i++) {
      try {
        list[i](payload);
      } catch (err) {
        console.error('[EventBus] Error in handler for "' + event + '":', err);
      }
    }
  }

  /* ── Diagnostics (dev only) ────────────────────────────────
     Returns a snapshot of registered event names and handler
     counts. Useful for debugging in the browser console.        */
  function _inspect() {
    var out = {};
    Object.keys(_handlers).forEach(function(event) {
      out[event] = _handlers[event].length;
    });
    return out;
  }

  return { on: on, off: off, emit: emit, _inspect: _inspect };

}());

/* ── Defined platform events (reference) ──────────────────────
   These are the canonical events used across Phase 1.
   All emitters and subscribers must use these exact strings.

   case:created        { caseId, workflowId }
   case:updated        { caseId, changes }
   case:archived       { caseId }
   section:visited     { caseId, sectionId }
   workflow:stateChanged { caseId, workflowId }   (Phase 3)
   workflow:completed  { caseId }                 (Phase 3)
   assessment:flagged  { caseId, flag }           (Phase 3)
────────────────────────────────────────────────────────────── */
