/* ════════════════════════════════════════════════════════════
   storage-adapter.js — Persistence layer abstraction
   Clinstrux · Clinical Decision Infrastructure

   Single seam between all managers and the storage backend.
   v1 backend: localStorage.
   Future backend: Supabase — replace the five _backend.*
   functions only. The public interface and all callers stay
   identical.

   Key namespace:  'clx:'
   All keys are prefixed automatically. Callers pass bare
   keys (e.g. 'patient:pt_123') and the adapter adds 'clx:'.

   Public interface:
     StorageAdapter.get(key)          → object | null
     StorageAdapter.set(key, value)   → void
     StorageAdapter.delete(key)       → void
     StorageAdapter.list(prefix)      → Array<{ key, value }>
     StorageAdapter.clear(prefix)     → void  (dev/test only)

   Keys passed in are bare (no 'clx:' prefix).
   Keys returned from list() are also bare (prefix stripped).
════════════════════════════════════════════════════════════ */

var StorageAdapter = (function () {

  var NS = 'clx:';   /* Namespace prefix applied to all keys */

  /* ── Private: namespace helpers ─────────────────────────── */

  function _ns(key) {
    return NS + key;
  }

  function _stripNs(nsKey) {
    return nsKey.indexOf(NS) === 0 ? nsKey.slice(NS.length) : nsKey;
  }

  /* ── Private: localStorage backend ─────────────────────────
     These five functions are the ONLY place localStorage is
     touched. To migrate to Supabase, replace these functions
     with async-compatible equivalents and update callers to
     await. The public interface shape does not change.         */

  var _backend = {

    get: function (nsKey) {
      try {
        var raw = localStorage.getItem(nsKey);
        if (raw === null) return null;
        return JSON.parse(raw);
      } catch (err) {
        console.error('[StorageAdapter] get failed for key "' + nsKey + '":', err);
        return null;
      }
    },

    set: function (nsKey, value) {
      try {
        localStorage.setItem(nsKey, JSON.stringify(value));
      } catch (err) {
        console.error('[StorageAdapter] set failed for key "' + nsKey + '":', err);
      }
    },

    delete: function (nsKey) {
      try {
        localStorage.removeItem(nsKey);
      } catch (err) {
        console.error('[StorageAdapter] delete failed for key "' + nsKey + '":', err);
      }
    },

    /* Returns all localStorage keys that start with nsPrefix */
    listKeys: function (nsPrefix) {
      var keys = [];
      try {
        for (var i = 0; i < localStorage.length; i++) {
          var k = localStorage.key(i);
          if (k && k.indexOf(nsPrefix) === 0) {
            keys.push(k);
          }
        }
      } catch (err) {
        console.error('[StorageAdapter] listKeys failed:', err);
      }
      return keys;
    },

    clearKeys: function (nsPrefix) {
      /* Build list first — modifying localStorage while iterating
         it causes index shift bugs in some browsers.             */
      var keys = _backend.listKeys(nsPrefix);
      keys.forEach(function (k) {
        try { localStorage.removeItem(k); } catch (e) {}
      });
    }

  };

  /* ══════════════════════════════════════════════════════════
     PUBLIC API
  ══════════════════════════════════════════════════════════ */

  /* get(key) → object | null
     Returns the parsed value stored under the key, or null
     if the key does not exist or the value is unparseable.  */
  function get(key) {
    return _backend.get(_ns(key));
  }

  /* set(key, value)
     Serialises value to JSON and stores it.                 */
  function set(key, value) {
    _backend.set(_ns(key), value);
  }

  /* delete(key)
     Removes the key from storage. Silent if not found.      */
  function del(key) {
    _backend.delete(_ns(key));
  }

  /* list(prefix) → Array<{ key: String, value: Object }>
     Returns all entries whose key starts with prefix.
     Returned keys are bare (no 'clx:' namespace prefix).
     e.g. list('patient:') returns entries for all patients. */
  function list(prefix) {
    var nsPrefix = _ns(prefix || '');
    var nsKeys   = _backend.listKeys(nsPrefix);
    var results  = [];
    nsKeys.forEach(function (nsKey) {
      var value = _backend.get(nsKey);
      if (value !== null) {
        results.push({ key: _stripNs(nsKey), value: value });
      }
    });
    return results;
  }

  /* clear(prefix)
     Removes ALL keys matching the prefix.
     Intended for dev/test resets only. Never call in
     production flows without explicit user confirmation.    */
  function clear(prefix) {
    _backend.clearKeys(_ns(prefix || ''));
  }

  return {
    get:    get,
    set:    set,
    delete: del,   /* 'delete' is a reserved word in IE8 — exposed as 'delete' in
                      the public API but the internal function is named 'del'.
                      Modern callers use StorageAdapter.delete(key) safely.       */
    list:   list,
    clear:  clear
  };

}());
