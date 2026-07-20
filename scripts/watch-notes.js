/*
 * The watch page's per-episode "My Notes" panel. Exposes window.IMWatchNotes.
 *
 * Personal notes with a markdown-lite editor (headings, bold, italic), a
 * preview tab with clickable timestamps that seek the player, debounced
 * autosave, and a mobile-collapsed default. Notes are stored the same way as
 * watch progress (local first, synced to Firestore when signed in), keyed by
 * the same series/standalone id scheme so notes survive an R2 videoSrc swap.
 *
 * watch-page.js calls IMWatchNotes.init({ player, storageKey }) after it has
 * resolved the current episode. Loaded on the watch template before
 * watch-page.js.
 */
(() => {
  "use strict";

  const { escapeHtml, readJsonStorage, writeJsonStorage } = window.IMUtils;

  function init({ player, storageKey }) {
    const notesPanel = document.querySelector(".notes-panel");
    const notesPanelToggle = document.querySelector("#notes-panel-toggle");
    const notesTextarea = document.querySelector("#notes-textarea");
    const notesEditView = document.querySelector("#notes-edit-view");
    const notesPreviewView = document.querySelector("#notes-preview-view");
    const notesPreviewBody = document.querySelector("#notes-preview-body");
    const notesStatus = document.querySelector("#notes-status");
    const notesToolbar = document.querySelector("#notes-toolbar");
    const notesTabs = document.querySelectorAll("[data-notes-tab]");
    const notesInsertTimestampBtn = document.querySelector("#notes-insert-timestamp");
    const notesCurrentTimeLabel = document.querySelector("#notes-current-time-label");
    const notesClearBtn = document.querySelector("#notes-clear-btn");

    if (!notesTextarea) return;

    function readNote() {
      return readJsonStorage(storageKey, { text: "", updatedAt: 0 });
    }

    function writeNote(text) {
      writeJsonStorage(storageKey, { text, updatedAt: Date.now() });
    }

    function formatNoteTimestamp(totalSeconds) {
      const seconds = Math.max(0, Math.floor(totalSeconds || 0));
      const h = Math.floor(seconds / 3600);
      const m = Math.floor((seconds % 3600) / 60);
      const s = seconds % 60;
      if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
      return `${m}:${String(s).padStart(2, "0")}`;
    }

    // Markdown-lite + clickable-timestamp renderer for the Preview tab. Mirrors
    // renderRecap's escape-then-format approach, extended with h2/h3, italics,
    // and turning any MM:SS / H:MM:SS token into a button that seeks the player.
    function linkifyNoteTimestamps(escapedHtml) {
      return escapedHtml.replace(/\b(\d{1,2}):([0-5]\d)(?::([0-5]\d))?\b/g, (match, a, b, c) => {
        const seconds = c !== undefined ? Number(a) * 3600 + Number(b) * 60 + Number(c) : Number(a) * 60 + Number(b);
        return `<button type="button" class="note-timestamp" data-seek="${seconds}">${match}</button>`;
      });
    }

    function applyNoteInline(escapedText) {
      let html = escapedText.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
      html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");
      return linkifyNoteTimestamps(html);
    }

    function renderNoteMarkdown(text) {
      return text
        .trim()
        .split(/\n\n+/)
        .map((block) => {
          const trimmed = block.trim();
          if (!trimmed) return "";
          const headingMatch = trimmed.match(/^(#{1,3})\s+(.+)$/s);
          if (headingMatch) {
            const level = headingMatch[1].length;
            const escaped = escapeHtml(headingMatch[2].trim());
            return `<p class="note-heading note-h${level}">${applyNoteInline(escaped)}</p>`;
          }
          const escaped = escapeHtml(trimmed).replace(/\n/g, "<br>");
          return `<p class="note-line">${applyNoteInline(escaped)}</p>`;
        })
        .join("");
    }

    function renderNotesPreview() {
      const text = notesTextarea.value.trim();
      notesPreviewBody.innerHTML = text
        ? renderNoteMarkdown(text)
        : '<p class="notes-empty">Nothing written yet. Switch to Edit to add notes.</p>';
    }

    function insertAtCursor(textarea, text) {
      const start = textarea.selectionStart ?? textarea.value.length;
      const end = textarea.selectionEnd ?? textarea.value.length;
      const before = textarea.value.slice(0, start);
      const after = textarea.value.slice(end);
      const prefix = before.length > 0 && !before.endsWith("\n") ? "\n" : "";
      textarea.value = before + prefix + text + after;
      const cursorPos = (before + prefix + text).length;
      textarea.setSelectionRange(cursorPos, cursorPos);
      textarea.focus();
    }

    function wrapSelection(textarea, before, after) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const selected = textarea.value.slice(start, end) || "text";
      textarea.value = textarea.value.slice(0, start) + before + selected + after + textarea.value.slice(end);
      textarea.setSelectionRange(start + before.length, start + before.length + selected.length);
      textarea.focus();
    }

    function prefixLine(textarea, prefix) {
      const start = textarea.selectionStart;
      const value = textarea.value;
      const lineStart = value.lastIndexOf("\n", start - 1) + 1;
      const lineEndIdx = value.indexOf("\n", lineStart);
      const lineEnd = lineEndIdx === -1 ? value.length : lineEndIdx;
      const stripped = value.slice(lineStart, lineEnd).replace(/^#{1,3}\s*/, "");
      const newLine = prefix + stripped;
      textarea.value = value.slice(0, lineStart) + newLine + value.slice(lineEnd);
      const newCursor = lineStart + newLine.length;
      textarea.setSelectionRange(newCursor, newCursor);
      textarea.focus();
    }

    // Load saved note and keep it saved shortly after the user stops typing.
    notesTextarea.value = readNote().text || "";

    function setNotesPanelCollapsed(collapsed) {
      if (!notesPanel || !notesPanelToggle) return;
      notesPanel.classList.toggle("is-collapsed", collapsed);
      notesPanelToggle.setAttribute("aria-expanded", String(!collapsed));
      notesPanelToggle.setAttribute("aria-label", collapsed ? "Open notes editor" : "Collapse notes editor");
    }

    // Empty editors start compact on phones so takeaways, recaps, and the next
    // lecture remain close to the player. Existing notes always open in full.
    setNotesPanelCollapsed(
      window.matchMedia?.("(max-width: 600px)").matches && !notesTextarea.value.trim(),
    );

    notesPanelToggle?.addEventListener("click", () => {
      const shouldCollapse = !notesPanel.classList.contains("is-collapsed");
      setNotesPanelCollapsed(shouldCollapse);
      if (!shouldCollapse) notesTextarea.focus();
    });

    let notesSaveTimer = null;
    let notesStatusClearTimer = null;
    function scheduleNotesSave() {
      if (notesStatus) notesStatus.textContent = "Saving…";
      clearTimeout(notesSaveTimer);
      notesSaveTimer = setTimeout(() => {
        writeNote(notesTextarea.value);
        if (notesStatus) {
          notesStatus.textContent = "Saved";
          clearTimeout(notesStatusClearTimer);
          notesStatusClearTimer = setTimeout(() => { notesStatus.textContent = ""; }, 2000);
        }
      }, 600);
    }

    notesTextarea.addEventListener("input", scheduleNotesSave);

    // Flush immediately if the user navigates away mid-debounce.
    document.addEventListener("visibilitychange", () => {
      if (document.hidden && notesSaveTimer) {
        clearTimeout(notesSaveTimer);
        writeNote(notesTextarea.value);
      }
    });

    if (notesToolbar) {
      notesToolbar.addEventListener("click", (event) => {
        const btn = event.target.closest("[data-note-format]");
        if (!btn) return;
        const format = btn.dataset.noteFormat;
        if (format === "h1") prefixLine(notesTextarea, "# ");
        else if (format === "h2") prefixLine(notesTextarea, "## ");
        else if (format === "h3") prefixLine(notesTextarea, "### ");
        else if (format === "bold") wrapSelection(notesTextarea, "**", "**");
        else if (format === "italic") wrapSelection(notesTextarea, "*", "*");
        scheduleNotesSave();
      });
    }

    if (notesInsertTimestampBtn) {
      notesInsertTimestampBtn.addEventListener("click", () => {
        insertAtCursor(notesTextarea, `${formatNoteTimestamp(player.currentTime)} `);
        scheduleNotesSave();
      });
    }

    if (notesCurrentTimeLabel) {
      player.addEventListener("timeupdate", () => {
        notesCurrentTimeLabel.textContent = formatNoteTimestamp(player.currentTime);
      });
    }

    notesTabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        notesTabs.forEach((t) => {
          const active = t === tab;
          t.classList.toggle("is-active", active);
          t.setAttribute("aria-selected", String(active));
        });
        const showPreview = tab.dataset.notesTab === "preview";
        notesEditView.hidden = showPreview;
        notesPreviewView.hidden = !showPreview;
        if (showPreview) renderNotesPreview();
      });
    });

    if (notesPreviewBody) {
      notesPreviewBody.addEventListener("click", (event) => {
        const btn = event.target.closest(".note-timestamp");
        if (!btn) return;
        const seconds = Number(btn.dataset.seek);
        if (!Number.isFinite(seconds)) return;
        player.currentTime = Math.min(seconds, player.duration || seconds);
        player.play().catch(() => {});
        player.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    }

    if (notesClearBtn) {
      notesClearBtn.addEventListener("click", () => {
        if (!notesTextarea.value.trim()) return;
        if (!window.confirm("Clear all notes for this episode? This cannot be undone.")) return;
        notesTextarea.value = "";
        writeNote("");
        renderNotesPreview();
        if (notesStatus) notesStatus.textContent = "Cleared";
      });
    }
  }

  window.IMWatchNotes = { init };
})();
