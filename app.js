/* ════════════════════════════════════════════════════════════
   app.js — Boot / initialisation entry point
   Loads after: core.js, oa.js, abx.js, poly.js
   Clinstrux · Clinical Decision Infrastructure
════════════════════════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', function() {

  // ── Show the workflow selector on load ────────────────────────────────────
  var ep = document.getElementById('entry-page');
  var sp = document.getElementById('selector-page');
  if (ep) ep.style.display = 'none';
  if (sp) sp.style.display = 'block';

  // ── OA workflow boot (pre-warm so it's ready when user enters) ────────────
  updateParamTiles();
  updateComplexityBar();
  updateClinicalStatusSummary();
  updateClinicalImpression();

  var rec    = buildPrimaryRec();
  var nsaidR = buildNsaidReasoning();
  _isFirstRun = true;
  updateClinicalReasoningPanel(rec, nsaidR);
  updateTradeoffStrip();
  updateEscalationTags();
  updateRenalDosingBlock();
  updateInterventionPanel(rec);

  updatePolypharmacyPanel();
  initLongitudinalProgression();
  updateHandoffMeta();

  // ── ABX workflow pre-warm ─────────────────────────────────────────────────
  abxRunReasoningEngine();

  // ── Poly workflow pre-warm ────────────────────────────────────────────────
  polyRunReasoningEngine();

});
