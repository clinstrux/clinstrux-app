/* ════════════════════════════════════════════════════════════
   patient-manager.js — Patient record lifecycle
   Clinstrux · Clinical Decision Infrastructure

   Owns all patient CRUD. Knows nothing about cases, UI,
   workflows, or routes.

   Depends on:
     StorageAdapter  (must be loaded first)
     EventBus        (must be loaded first)

   Storage keys used:
     'patient:{patientId}'    individual patient record
     'patients:index'         ordered array of patientIds

   The index key is an ordered array of patientIds sorted
   by updatedAt descending. It is the source of truth for
   list order and avoids scanning all keys on every list().

   Public interface:
     PatientManager.createPatient(fields)            → patient
     PatientManager.getPatient(patientId)            → patient | null
     PatientManager.updatePatient(patientId, fields) → patient | null
     PatientManager.listPatients(filters?)           → patient[]
     PatientManager.deletePatient(patientId)         → boolean
     PatientManager.searchPatients(query)            → patient[]
     PatientManager.clearAllData()                   → void  (dev/test only)

   Events emitted:
     patient:created  { patientId, patient }
     patient:updated  { patientId, patient }
     patient:deleted  { patientId }

   Required fields for createPatient():
     firstName, lastName, dateOfBirth, sex

   Optional fields (default to empty if omitted):
     diagnoses[]   → []
     medications[] → []
     allergies[]   → []
     notes         → ''
════════════════════════════════════════════════════════════ */

var PatientManager = (function () {

  /* ── Key helpers ────────────────────────────────────────── */

  function _patientKey(patientId) {
    return 'patient:' + patientId;
  }

  var INDEX_KEY = 'patients:index';

  /* ── ID generation ──────────────────────────────────────── */

  /* Format:  pt_{timestamp}_{3 random alphanumeric chars}
     Example: pt_1749123456789_a3f
     Stable, sortable by creation time, no external library.  */
  function _generateId() {
    var rand = Math.random().toString(36).slice(2, 5);
    return 'pt_' + Date.now() + '_' + rand;
  }

  /* ── ISO timestamp ──────────────────────────────────────── */

  function _now() {
    return new Date().toISOString();
  }

  /* ── Index helpers ──────────────────────────────────────── */

  /* Returns the ordered patientId index array from storage.  */
  function _loadIndex() {
    return StorageAdapter.get(INDEX_KEY) || [];
  }

  /* Writes a new index array to storage.                     */
  function _saveIndex(index) {
    StorageAdapter.set(INDEX_KEY, index);
  }

  /* Inserts a patientId at the front of the index
     (newest first). Removes any existing entry first to
     prevent duplicates after an update re-insertion.         */
  function _indexPrepend(patientId) {
    var idx = _loadIndex().filter(function (id) { return id !== patientId; });
    idx.unshift(patientId);
    _saveIndex(idx);
  }

  /* Removes a patientId from the index.                      */
  function _indexRemove(patientId) {
    var idx = _loadIndex().filter(function (id) { return id !== patientId; });
    _saveIndex(idx);
  }

  /* ── Validation ─────────────────────────────────────────── */

  var REQUIRED_FIELDS = ['firstName', 'lastName', 'dateOfBirth', 'sex'];
  var VALID_SEX       = ['male', 'female', 'other', 'unknown'];

  /* Returns null if valid, or a string error message.        */
  function _validate(fields) {
    for (var i = 0; i < REQUIRED_FIELDS.length; i++) {
      var f = REQUIRED_FIELDS[i];
      if (!fields[f] || (typeof fields[f] === 'string' && !fields[f].trim())) {
        return 'Required field missing: ' + f;
      }
    }
    if (VALID_SEX.indexOf(fields.sex) === -1) {
      return 'Invalid sex value: "' + fields.sex + '". Must be one of: ' + VALID_SEX.join(', ');
    }
    /* Basic date format check: YYYY-MM-DD */
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fields.dateOfBirth)) {
      return 'dateOfBirth must be in YYYY-MM-DD format';
    }
    return null;
  }

  /* ── Patient object factory ─────────────────────────────── */

  function _buildPatient(fields, patientId, createdAt) {
    var now = _now();
    return {
      patientId:   patientId,
      firstName:   fields.firstName.trim(),
      lastName:    fields.lastName.trim(),
      dateOfBirth: fields.dateOfBirth,
      sex:         fields.sex,
      diagnoses:   Array.isArray(fields.diagnoses)   ? fields.diagnoses.slice()   : [],
      medications: Array.isArray(fields.medications) ? fields.medications.slice() : [],
      allergies:   Array.isArray(fields.allergies)   ? fields.allergies.slice()   : [],
      notes:       typeof fields.notes === 'string'  ? fields.notes               : '',
      createdAt:   createdAt || now,
      updatedAt:   now
    };
  }

  /* ══════════════════════════════════════════════════════════
     PUBLIC API
  ══════════════════════════════════════════════════════════ */

  /* ── createPatient ──────────────────────────────────────── */

  /* Creates a new patient record and persists it.
     fields: { firstName, lastName, dateOfBirth, sex,
               diagnoses?, medications?, allergies?, notes? }
     Returns the created patient object.
     Throws on validation failure.                            */
  function createPatient(fields) {
    var error = _validate(fields);
    if (error) {
      throw new Error('[PatientManager] createPatient validation failed: ' + error);
    }

    var patientId = _generateId();
    var patient   = _buildPatient(fields, patientId, null);

    StorageAdapter.set(_patientKey(patientId), patient);
    _indexPrepend(patientId);

    EventBus.emit('patient:created', { patientId: patientId, patient: patient });
    return patient;
  }

  /* ── getPatient ─────────────────────────────────────────── */

  /* Returns the patient object for the given ID, or null.    */
  function getPatient(patientId) {
    if (!patientId) return null;
    return StorageAdapter.get(_patientKey(patientId));
  }

  /* ── updatePatient ──────────────────────────────────────── */

  /* Merges fields into the existing patient record.
     Only supplied fields are changed. Required fields are
     re-validated if supplied.
     Returns the updated patient object, or null if not found. */
  function updatePatient(patientId, fields) {
    var existing = getPatient(patientId);
    if (!existing) {
      console.warn('[PatientManager] updatePatient: patient not found:', patientId);
      return null;
    }

    /* Merge supplied fields over existing */
    var merged = {
      firstName:   fields.firstName   !== undefined ? fields.firstName   : existing.firstName,
      lastName:    fields.lastName    !== undefined ? fields.lastName    : existing.lastName,
      dateOfBirth: fields.dateOfBirth !== undefined ? fields.dateOfBirth : existing.dateOfBirth,
      sex:         fields.sex         !== undefined ? fields.sex         : existing.sex,
      diagnoses:   fields.diagnoses   !== undefined ? fields.diagnoses   : existing.diagnoses,
      medications: fields.medications !== undefined ? fields.medications : existing.medications,
      allergies:   fields.allergies   !== undefined ? fields.allergies   : existing.allergies,
      notes:       fields.notes       !== undefined ? fields.notes       : existing.notes
    };

    /* Re-validate required fields on merged result */
    var error = _validate(merged);
    if (error) {
      throw new Error('[PatientManager] updatePatient validation failed: ' + error);
    }

    var updated = _buildPatient(merged, patientId, existing.createdAt);
    StorageAdapter.set(_patientKey(patientId), updated);

    /* Move to front of index (recently updated = top of list) */
    _indexPrepend(patientId);

    EventBus.emit('patient:updated', { patientId: patientId, patient: updated });
    return updated;
  }

  /* ── listPatients ───────────────────────────────────────── */

  /* Returns all patient records in updatedAt desc order
     (maintained by the index).
     Optional filters: { sex: 'female' }                      */
  function listPatients(filters) {
    var index    = _loadIndex();
    var patients = [];

    index.forEach(function (patientId) {
      var p = getPatient(patientId);
      if (p) patients.push(p);
    });

    if (filters) {
      if (filters.sex) {
        patients = patients.filter(function (p) { return p.sex === filters.sex; });
      }
    }

    return patients;
  }

  /* ── deletePatient ──────────────────────────────────────── */

  /* Removes the patient record and index entry.
     Returns true if deleted, false if not found.
     Note: does NOT cascade-delete associated cases.
     Case records will retain their patientId as an orphan
     reference — callers should handle this if needed.        */
  function deletePatient(patientId) {
    var existing = getPatient(patientId);
    if (!existing) {
      console.warn('[PatientManager] deletePatient: patient not found:', patientId);
      return false;
    }

    StorageAdapter.delete(_patientKey(patientId));
    _indexRemove(patientId);

    EventBus.emit('patient:deleted', { patientId: patientId });
    return true;
  }

  /* ── searchPatients ─────────────────────────────────────── */

  /* Case-insensitive substring search across:
       firstName, lastName, patientId
     Returns matching patients in index order (updatedAt desc). */
  function searchPatients(query) {
    if (!query || !query.trim()) return listPatients();
    var q = query.trim().toLowerCase();
    return listPatients().filter(function (p) {
      return (
        p.firstName.toLowerCase().indexOf(q)  !== -1 ||
        p.lastName.toLowerCase().indexOf(q)   !== -1 ||
        p.patientId.toLowerCase().indexOf(q)  !== -1
      );
    });
  }

  /* ── clearAllData ───────────────────────────────────────── */

  /* Removes all patient records and the index.
     Dev/test reset only. Never call automatically.           */
  function clearAllData() {
    var index = _loadIndex();
    index.forEach(function (patientId) {
      StorageAdapter.delete(_patientKey(patientId));
    });
    StorageAdapter.delete(INDEX_KEY);
    console.info('[PatientManager] All patient data cleared.');
  }

  /* ══════════════════════════════════════════════════════════
     PUBLIC SURFACE
  ══════════════════════════════════════════════════════════ */

  return {
    createPatient: createPatient,
    getPatient:    getPatient,
    updatePatient: updatePatient,
    listPatients:  listPatients,
    deletePatient: deletePatient,
    searchPatients:searchPatients,
    clearAllData:  clearAllData
  };

}());
