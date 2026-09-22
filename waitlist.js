/**
 * SitePilot waitlist capture (offline-friendly stub)
 * Stores submissions in localStorage and supports JSON download.
 * No network required. No payments. Draft / waitlist only.
 */
(function () {
  var STORAGE_KEY = "sitepilot_waitlist_v1";

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

  function downloadJson(entries) {
    var payload = {
      product: "SitePilot",
      company: "Zed",
      exportedAt: new Date().toISOString(),
      count: entries.length,
      entries: entries
    };
    var blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json"
    });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    var stamp = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = "sitepilot-waitlist-" + stamp + ".json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function setStatus(el, message, ok) {
    if (!el) return;
    el.textContent = message;
    el.hidden = false;
    el.setAttribute("data-ok", ok ? "1" : "0");
    el.style.color = ok ? "var(--accent-2)" : "var(--warn)";
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
        "Saved on this device (localStorage). Export JSON anytime — see <code>WAITLIST_CAPTURE.md</code>. No live checkout.";
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

    var exportBtn = document.createElement("button");
    exportBtn.type = "button";
    exportBtn.className = "btn btn-ghost";
    exportBtn.textContent = "Download waitlist JSON";
    exportBtn.addEventListener("click", function () {
      var entries = loadEntries();
      if (!entries.length) {
        setStatus(status, "No signups stored on this browser yet.", false);
        return;
      }
      downloadJson(entries);
      setStatus(
        status,
        "Downloaded " + entries.length + " signup(s). Keep the file for agent import.",
        true
      );
    });

    var countBtn = document.createElement("button");
    countBtn.type = "button";
    countBtn.className = "btn btn-ghost";
    countBtn.textContent = "Show count";
    countBtn.addEventListener("click", function () {
      var n = loadEntries().length;
      setStatus(status, n + " signup(s) in localStorage on this browser.", true);
    });

    tools.appendChild(exportBtn);
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
          "That email is already on this browser’s waitlist. You can still export JSON.",
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
          " on this device). Use “Download waitlist JSON” to export.",
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
