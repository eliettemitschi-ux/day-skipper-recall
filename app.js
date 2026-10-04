/* On-device database that stands in for the Claude artifact database.
   Same small API the page already uses (collection/doc, onSnapshot, set, update, delete).
   Everything is saved in this browser's localStorage, so the app works offline. */
(function(){
  "use strict";
  var KEY = "dsr:store:v1";
  var STATE_FIELDS = ["box","dueAt","lastResult","lastReviewedAt","lastReviewedTs"];
  var DATA = window.__DSR_DATA || { version: "0", cards: {}, lessons: {}, glossary: {}, meta: {} };
  var persistOK = true;

  function clone(o){ return JSON.parse(JSON.stringify(o)); }
  function mergeInto(t, s){
    for (var k in s){
      if (s[k] && typeof s[k] === "object" && !Array.isArray(s[k])){
        if (s[k].__delete__){ delete t[k]; continue; }
        if (!t[k] || typeof t[k] !== "object") t[k] = {};
        mergeInto(t[k], s[k]);
      } else t[k] = s[k];
    }
    return t;
  }

  function fresh(){
    return { dataVersion: DATA.version, cards: clone(DATA.cards), lessons: clone(DATA.lessons), glossary: clone(DATA.glossary), meta: clone(DATA.meta) };
  }
  function load(){
    var s = null;
    try { s = JSON.parse(localStorage.getItem(KEY) || "null"); } catch (e) { persistOK = false; }
    if (!s || !s.cards) return fresh();
    if (s.dataVersion !== DATA.version){            // new content shipped: update text, keep progress
      var out = fresh();
      Object.keys(out.cards).forEach(function(id){
        var old = s.cards[id];
        if (old) STATE_FIELDS.forEach(function(f){ if (old[f] !== undefined) out.cards[id][f] = old[f]; });
      });
      out.meta.progress = s.meta && s.meta.progress ? s.meta.progress : out.meta.progress;
      return out;
    }
    s.lessons = s.lessons || {}; s.glossary = s.glossary || {}; s.meta = s.meta || {};
    return s;
  }
  var store = load();

  var timer = null;
  function saveNow(){
    timer = null;
    try { localStorage.setItem(KEY, JSON.stringify(store)); persistOK = true; } catch (e) { persistOK = false; showNote(); }
  }
  function save(){ if (!timer) timer = setTimeout(saveNow, 250); }
  window.addEventListener("pagehide", function(){ if (timer){ clearTimeout(timer); saveNow(); } });
  document.addEventListener("visibilitychange", function(){ if (document.visibilityState === "hidden" && timer){ clearTimeout(timer); saveNow(); } });
  saveNow();
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) {}

  var listeners = {};
  function colSnap(name){ return { docs: Object.keys(store[name]).map(function(id){ return { id: id, exists: true, data: function(){ return clone(store[name][id]); } }; }) }; }
  function docSnap(col, id){ var d = store[col] && store[col][id]; return { id: id, exists: !!d, data: function(){ return d ? clone(d) : undefined; } }; }
  function fireCol(name){ (listeners[name] || []).forEach(function(cb){ cb(colSnap(name)); }); }
  function fireDoc(col, id){ (listeners[col + "/" + id] || []).forEach(function(cb){ cb(docSnap(col, id)); }); }

  var db = {
    collection: function(name){
      store[name] = store[name] || {};
      return {
        onSnapshot: function(cb){ (listeners[name] = listeners[name] || []).push(cb); setTimeout(function(){ cb(colSnap(name)); }, 0); return function(){}; },
        doc: function(id){ return {
          set: function(d){ store[name][id] = clone(d); save(); fireCol(name); return Promise.resolve(); },
          update: function(p){ if (!store[name][id]) return Promise.reject({ code: "invalid_argument" }); mergeInto(store[name][id], clone(p)); save(); fireCol(name); return Promise.resolve(); },
          delete: function(){ delete store[name][id]; save(); fireCol(name); return Promise.resolve(); }
        }; }
      };
    },
    doc: function(path){
      var p = path.split("/"), col = p[0], id = p[1]; store[col] = store[col] || {};
      return {
        onSnapshot: function(cb){ (listeners[path] = listeners[path] || []).push(cb); setTimeout(function(){ cb(docSnap(col, id)); }, 0); return function(){}; },
        set: function(d){ store[col][id] = clone(d); save(); fireDoc(col, id); return Promise.resolve(); },
        update: function(pt){ if (!store[col][id]) return Promise.reject({ code: "invalid_argument" }); mergeInto(store[col][id], clone(pt)); save(); fireDoc(col, id); return Promise.resolve(); }
      };
    }
  };
  window.claude = { use: function(n){ return Promise.resolve(n === "db" ? db : null); } };
  window.__dsrStore = store;

  /* ---- backup / restore, shown under the cards ---- */
  function showNote(){
    var n = document.getElementById("syncNote"); if (!n) return;
    n.innerHTML = (persistOK ? "Saved on this device. Works offline." : "<b>This browser is not saving your progress.</b> Leave private mode, or back up often.") +
      ' <a href="#" id="dsrBackup">Back up</a> &middot; <a href="#" id="dsrRestore">Restore</a><input type="file" id="dsrFile" accept="application/json" style="display:none">';
    document.getElementById("dsrBackup").onclick = function(e){
      e.preventDefault();
      var blob = new Blob([JSON.stringify({ app: "day-skipper-recall", saved: new Date().toISOString(), store: store })], { type: "application/json" });
      var a = document.createElement("a"); a.href = URL.createObjectURL(blob);
      a.download = "skipper-progress-" + new Date().toISOString().slice(0, 10) + ".json"; document.body.appendChild(a); a.click();
      setTimeout(function(){ URL.revokeObjectURL(a.href); a.remove(); }, 500);
    };
    document.getElementById("dsrRestore").onclick = function(e){ e.preventDefault(); document.getElementById("dsrFile").click(); };
    document.getElementById("dsrFile").onchange = function(ev){
      var f = ev.target.files && ev.target.files[0]; if (!f) return;
      var r = new FileReader();
      r.onload = function(){
        try {
          var j = JSON.parse(r.result);
          if (!j || j.app !== "day-skipper-recall" || !j.store || !j.store.cards) throw new Error("not a backup");
          if (!confirm("Replace the progress on this device with this backup?")) return;
          localStorage.setItem(KEY, JSON.stringify(j.store)); location.reload();
        } catch (err) { alert("That file is not a Day Skipper backup."); }
      };
      r.readAsText(f);
    };
  }
  document.addEventListener("DOMContentLoaded", showNote);
  window.addEventListener("load", showNote);
})();
