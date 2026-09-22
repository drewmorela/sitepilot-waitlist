/**
 * SitePilot waitlist capture (offline-friendly stub)
 * Stores submissions in localStorage and supports JSON/CSV download + clipboard.
 * No network required. No payments. Draft / waitlist only.
 */
(function () {
  var STORAGE_KEY = "sitepilot_waitlist_v1";
  var META_KEY = "sitepilot_waitlist_meta_v1";

  function loadEntries() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      var parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }

  function saveEntries(entries) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  }

  function loadMeta() {
    try {
      var raw = localStorage.getItem(META_KEY);
      if (!raw) return {};
      var parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (e) {
      return {};
    }
  }

  function saveMeta(meta) {
    localStorage.setItem(META_KEY, JSON.stringify(meta));
  }

  function stampDate() {
    return new Date().toISOString().slice(0, 10);
  }

  function downloadBlob(filename, mime, text) {
    var blob = new Blob([text], { type: mime });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function buildPayload(entries) {
    return {
      product: "SitePilot",
      company: "Zed",
      exportedAt: new Date().toISOString(),
      count: entries.length,
      entries: entries
    };
  }

  function downloadJson(entries) {
    var payload = buildPayload(entries);
    downloadBlob(
      "sitepilot-waitlist-" + stampDate() + ".json",
      "application/json",
      JSON.stringify(payload, null, 2)
    );
  }

  function csvEscape(value) {
    var s = value == null ? "" : String(value);
    if (/[",\n\r]/.test(s)) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  }

  function downloadCsv(entries) {
    var headers = [
      "id",
      "email",
      "site",
      "cms",
      "notes",
      "source",
      "submittedAt"
    ];
    var lines = [headers.join(",")];
    entries.forEach(function (e) {
      lines.push(
        [
          e.id,
          e.email,
          e.site,
          e.cms,
          e.notes,
          e.source,
          e.submittedAt
        ]
          .map(csvEscape)
          .join(",")
      );
    });
    downloadBlob(
      "sitepilot-waitlist-" + stampDate() + ".csv",
      "text/csv;charset=utf-8",
      lines.join("\n")
    );
  }

  function copyJson(entries) {
    var text = JSON.stringify(buildPayload(entries), null, 2);
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).then(
        function () {
          return true;
        },
        function () {
          return fallbackCopy(text);
        }
      );
    }
    return Promise.resolve(fallbackCopy(text));
  }

  function fallbackCopy(text) {
    try {
      var ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "readonly");
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      var ok = document.execCommand("copy");
      ta.remove();
      return !!ok;
    } catch (e) {
      return false;
    }
  }

  function markExported(count, format) {
    var meta = loadMeta();
    meta.lastExportedAt = new Date().toISOString();
    meta.lastExportCount = count;
    meta.lastExportFormat = format;
    saveMeta(meta);
  }

  function setStatus(el, message, ok) {
    if (!el) return;
    el.textContent = message;
    el.hidden = false;
    el.setAttribute("data-ok", ok ? "1" : "0");
    el.style.color = ok ? "var(--accent-2)" : "var(--warn)";
  }

  function exportHint(meta) {
    if (!meta || !meta.lastExportedAt) {
      return "Export JSON/CSV anytime for agent import — see WAITLIST_CAPTURE.md.";
    }
    var when = meta.lastExportedAt.slice(0, 16).replace("T", " ") + "Z";
    return (
      "Last export: " +
      (meta.lastExportCount || 0) +
      " via " +
      (meta.lastExportFormat || "json") +
      " @ " +
      when +
      "."
    );
  }

  function init() {
    var form = document.querySelector("form.form");
    if (!form) return;

    // Offline capture replaces weak mailto; keep fields/markup for design.
    form.removeAttribute("action");
    form.removeAttribute("method");
    form.removeAttribute("enctype");
    form.setAttribute("novalidate", "novalidate");

    var note = form.querySelector(".form-note");
    if (note) {
      note.innerHTML =
        "Saved on this device (localStorage). " +
        exportHint(loadMeta()) +
        " No live checkout.";
    }

    var status = document.createElement("p");
    status.className = "form-note";
    status.id = "waitlist-status";
    status.setAttribute("role", "status");
    status.hidden = true;
    form.appendChild(status);

    var tools = document.createElement("div");
    tools.className = "cta-row";
    tools.style.marginTop = "0.75rem";
    tools.setAttribute("aria-label", "Waitlist export tools");

    function requireEntries(actionLabel) {
      var entries = loadEntries();
      if (!entries.length) {
        setStatus(
          status,
          "No signups on this browser yet. Submit the form first, then " +
            actionLabel +
            ".",
          false
        );
        return null;
      }
      return entries;
    }

    var exportBtn = document.createElement("button");
    exportBtn.type = "button";
    exportBtn.className = "btn btn-ghost";
    exportBtn.textContent = "Download JSON";
    exportBtn.title = "Download waitlist as JSON for agent merge";
    exportBtn.addEventListener("click", function () {
      var entries = requireEntries("download JSON");
      if (!entries) return;
      downloadJson(entries);
      markExported(entries.length, "json");
      setStatus(
        status,
        "Downloaded JSON · " +
          entries.length +
          " signup(s). Save under waitlist-exports/ for agent merge.",
        true
      );
      if (note) {
        note.innerHTML =
          "Saved on this device (localStorage). " +
          exportHint(loadMeta()) +
          " No live checkout.";
      }
    });

    var csvBtn = document.createElement("button");
    csvBtn.type = "button";
    csvBtn.className = "btn btn-ghost";
    csvBtn.textContent = "Download CSV";
    csvBtn.title = "Download waitlist as CSV (email, site, CMS, notes)";
    csvBtn.addEventListener("click", function () {
      var entries = requireEntries("download CSV");
      if (!entries) return;
      downloadCsv(entries);
      markExported(entries.length, "csv");
      setStatus(
        status,
        "Downloaded CSV · " +
          entries.length +
          " signup(s). Good for quick review in a spreadsheet.",
        true
      );
      if (note) {
        note.innerHTML =
          "Saved on this device (localStorage). " +
          exportHint(loadMeta()) +
          " No live checkout.";
      }
    });

    var copyBtn = document.createElement("button");
    copyBtn.type = "button";
    copyBtn.className = "btn btn-ghost";
    copyBtn.textContent = "Copy JSON";
    copyBtn.title = "Copy waitlist JSON to clipboard";
    copyBtn.addEventListener("click", function () {
      var entries = requireEntries("copy JSON");
      if (!entries) return;
      copyJson(entries).then(function (ok) {
        if (ok) {
          markExported(entries.length, "clipboard");
          setStatus(
            status,
            "Copied JSON · " + entries.length + " signup(s) to clipboard.",
            true
          );
          if (note) {
            note.innerHTML =
              "Saved on this device (localStorage). " +
              exportHint(loadMeta()) +
              " No live checkout.";
          }
        } else {
          setStatus(
            status,
            "Clipboard blocked — use Download JSON instead.",
            false
          );
        }
      });
    });

    var countBtn = document.createElement("button");
    countBtn.type = "button";
    countBtn.className = "btn btn-ghost";
    countBtn.textContent = "Show count";
    countBtn.addEventListener("click", function () {
      var n = loadEntries().length;
      var meta = loadMeta();
      var extra = meta.lastExportedAt
        ? " Last export: " +
          (meta.lastExportCount || 0) +
          " (" +
          (meta.lastExportFormat || "json") +
          ")."
        : " Not exported yet from this browser.";
      setStatus(
        status,
        n + " signup(s) in localStorage on this browser." + extra,
        true
      );
    });

    tools.appendChild(exportBtn);
    tools.appendChild(csvBtn);
    tools.appendChild(copyBtn);
    tools.appendChild(countBtn);
    form.appendChild(tools);

    form.addEventListener("submit", function (ev) {
      ev.preventDefault();

      var emailEl = form.querySelector("#email");
      var siteEl = form.querySelector("#site");
      var cmsEl = form.querySelector("#cms");
      var notesEl = form.querySelector("#notes");

      var email = emailEl && emailEl.value ? emailEl.value.trim() : "";
      if (!email || email.indexOf("@") === -1) {
        setStatus(status, "Enter a valid work email.", false);
        if (emailEl) emailEl.focus();
        return;
      }

      var entry = {
        id:
          "wl_" +
          Date.now().toString(36) +
          "_" +
          Math.random().toString(36).slice(2, 8),
        email: email,
        site: siteEl && siteEl.value ? siteEl.value.trim() : "",
        cms: cmsEl && cmsEl.value ? cmsEl.value.trim() : "",
        notes: notesEl && notesEl.value ? notesEl.value.trim() : "",
        source: "web/index.html",
        userAgent: navigator.userAgent || "",
        submittedAt: new Date().toISOString()
      };

      var entries = loadEntries();
      var dup = entries.some(function (e) {
        return (
          e.email && e.email.toLowerCase() === entry.email.toLowerCase()
        );
      });
      if (dup) {
        setStatus(
          status,
          "That email is already on this browser’s waitlist. Use Download JSON/CSV or Copy JSON to export.",
          true
        );
        return;
      }

      entries.push(entry);
      saveEntries(entries);
      form.reset();
      setStatus(
        status,
        "You’re on the waitlist (" +
          entries.length +
          " on this device). Export with Download JSON, CSV, or Copy JSON.",
        true
      );
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
