/* =========================================================
   SIKNAYAN - IN-PAGE MESSAGES AND QUESTIONS (every portal)

   The browser's own alert / confirm / prompt boxes start with the
   site address ("mediumblue-dragonfly-....hostingersite.com says").
   This file shows LMS-styled boxes instead:

     alert("Saved.")                         message with OK (window.alert is replaced)
     await SiknayanDialog.confirm(text, {     Yes/No question, resolves true or false
         title, confirmText, cancelText, danger })
     await SiknayanDialog.prompt(text, {      text box, resolves the text or null
         title, value, confirmText })

   Load it in <head> before the page's own scripts.
========================================================= */
(function () {
    "use strict";

    if (window.SiknayanDialog) return;

    const SUCCESS = /\b(success|successfully|created|updated|saved|deleted|removed|reset|added|imported|published|sent|activated|deactivated|changed|restored)\b/i;
    const PROBLEM = /\b(unable|cannot|can't|could not|failed|error|invalid|please|missing|not |must|denied|expired)\b/i;

    const ICON_OK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';
    const ICON_PROBLEM = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M12 8v5M12 16.5v.5"/><circle cx="12" cy="12" r="9.5" stroke-width="2"/></svg>';
    const ICON_QUESTION = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9.5"/><path d="M9.6 9.3a2.5 2.5 0 0 1 4.8.9c0 1.7-2.4 2.2-2.4 3.6"/><path d="M12 17h.01"/></svg>';

    function addStyle() {
        if (document.getElementById("sikDialogStyle")) return;
        const style = document.createElement("style");
        style.id = "sikDialogStyle";
        style.textContent = `
            .sik-dialog-overlay { position: fixed; inset: 0; z-index: 2147483000; display: flex;
                align-items: center; justify-content: center; padding: 16px;
                background: rgba(10, 20, 15, 0.45); }
            .sik-dialog { width: min(400px, 100%); padding: 24px 22px 18px; border-radius: 16px;
                background: #ffffff; box-shadow: 0 24px 60px rgba(0, 0, 0, 0.28); text-align: center;
                font-family: inherit; color: #1f2a24; animation: sik-dialog-in 0.16s ease-out; }
            @keyframes sik-dialog-in { from { transform: translateY(8px) scale(0.98); opacity: 0; } }
            .sik-dialog-icon { width: 52px; height: 52px; margin: 0 auto 12px; display: grid;
                place-items: center; border-radius: 50%; background: #e7f4ed; color: #087443; }
            .sik-dialog.problem .sik-dialog-icon,
            .sik-dialog.danger .sik-dialog-icon { background: #fdecec; color: #9b1c22; }
            .sik-dialog.question .sik-dialog-icon { background: #fdf4dc; color: #9a6a0a; }
            .sik-dialog-icon svg { width: 26px; height: 26px; }
            .sik-dialog h3 { margin: 0 0 6px; color: #1f2a24; font-size: 17px; font-weight: 700; line-height: 1.3; }
            .sik-dialog p { margin: 0 0 18px; color: #3b463f; font-size: 15px; line-height: 1.5;
                white-space: pre-line; overflow-wrap: anywhere; }
            .sik-dialog input { width: 100%; box-sizing: border-box; height: 42px; margin: -6px 0 18px;
                padding: 0 12px; border: 1px solid #cfd8d3; border-radius: 9px; font: inherit; font-size: 16px; }
            .sik-dialog input:focus { outline: 2px solid #087443; outline-offset: 1px; }
            .sik-dialog-actions { display: flex; justify-content: center; gap: 10px; flex-wrap: wrap; }
            .sik-dialog button { min-width: 110px; min-height: 44px; padding: 0 20px; border-radius: 10px;
                font: inherit; font-size: 15px; font-weight: 600; cursor: pointer; }
            .sik-dialog .sik-dialog-ok { border: 0; background: #087443; color: #ffffff; }
            .sik-dialog .sik-dialog-ok:hover { background: #065c36; }
            .sik-dialog.danger .sik-dialog-ok { background: #b42318; }
            .sik-dialog.danger .sik-dialog-ok:hover { background: #912018; }
            .sik-dialog .sik-dialog-cancel { border: 1px solid #cfd8d3; background: #ffffff; color: #1f2a24; }
            .sik-dialog .sik-dialog-cancel:hover { background: #f3f6f4; }
            .sik-dialog button:focus-visible { outline: 3px solid #f3cd6b; outline-offset: 2px; }
            @media (max-width: 420px) {
                .sik-dialog { padding: 20px 16px 16px; }
                .sik-dialog button { flex: 1 1 0; min-width: 0; }
            }
            @media (prefers-reduced-motion: reduce) { .sik-dialog { animation: none; } }`;
        (document.head || document.documentElement).appendChild(style);
    }

    function escapeHtml(value) {
        return String(value).replace(/[&<>"']/g, ch => ({
            "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
        })[ch]);
    }

    // One box at a time; later ones wait their turn.
    let chain = Promise.resolve();

    function whenBodyReady() {
        if (document.body) return Promise.resolve();
        return new Promise(resolve =>
            document.addEventListener("DOMContentLoaded", resolve, { once: true })
        );
    }

    function open(kind, message, options) {
        const run = () => whenBodyReady().then(() => new Promise(resolve => {
            addStyle();

            const text = String(message === undefined || message === null ? "" : message);
            const opts = options || {};
            let tone = "";
            let icon = ICON_OK;

            if (kind === "alert") {
                const problem = (PROBLEM.test(text) && !SUCCESS.test(text)) ||
                    /\b(unable|cannot|could not|failed|error)\b/i.test(text);
                tone = problem ? "problem" : "";
                icon = problem ? ICON_PROBLEM : ICON_OK;
            } else {
                tone = opts.danger ? "danger" : "question";
                icon = opts.danger ? ICON_PROBLEM : ICON_QUESTION;
            }

            const title = opts.title || (kind === "alert" ? "" : kind === "prompt" ? "" : "Please confirm");
            const okText = opts.confirmText || (kind === "alert" ? "OK" : kind === "prompt" ? "OK" : "Yes");
            const cancelText = opts.cancelText || "Cancel";

            const overlay = document.createElement("div");
            overlay.className = "sik-dialog-overlay";
            overlay.innerHTML = `
                <div class="sik-dialog ${tone}" role="${kind === "alert" ? "alertdialog" : "dialog"}"
                     aria-modal="true" aria-labelledby="sikDialogText">
                    <div class="sik-dialog-icon" aria-hidden="true">${icon}</div>
                    ${title ? `<h3>${escapeHtml(title)}</h3>` : ""}
                    <p id="sikDialogText">${escapeHtml(text)}</p>
                    ${kind === "prompt" ? '<input type="text" class="sik-dialog-input" autocomplete="off">' : ""}
                    <div class="sik-dialog-actions">
                        ${kind === "alert" ? "" : `<button type="button" class="sik-dialog-cancel">${escapeHtml(cancelText)}</button>`}
                        <button type="button" class="sik-dialog-ok">${escapeHtml(okText)}</button>
                    </div>
                </div>`;

            const input = overlay.querySelector(".sik-dialog-input");
            if (input) input.value = opts.value === undefined || opts.value === null ? "" : String(opts.value);

            const lastFocus = document.activeElement;

            function finish(answer) {
                document.removeEventListener("keydown", onKey, true);
                overlay.remove();
                if (lastFocus && typeof lastFocus.focus === "function" && document.contains(lastFocus)) {
                    lastFocus.focus();
                }
                resolve(answer);
            }

            const cancelValue = kind === "confirm" ? false : kind === "prompt" ? null : undefined;
            const okValue = () => kind === "confirm" ? true : kind === "prompt" ? input.value : undefined;

            function onKey(event) {
                if (event.key === "Escape") {
                    event.preventDefault();
                    event.stopPropagation();
                    finish(cancelValue);
                } else if (event.key === "Enter" && (kind !== "confirm" || event.target === input)) {
                    event.preventDefault();
                    event.stopPropagation();
                    finish(okValue());
                }
            }

            overlay.querySelector(".sik-dialog-ok").addEventListener("click", () => finish(okValue()));
            const cancel = overlay.querySelector(".sik-dialog-cancel");
            if (cancel) cancel.addEventListener("click", () => finish(cancelValue));
            document.addEventListener("keydown", onKey, true);

            document.body.appendChild(overlay);
            if (input) {
                input.focus();
                input.select();
            } else {
                overlay.querySelector(kind === "alert" ? ".sik-dialog-ok" : ".sik-dialog-cancel").focus();
            }
        }));

        const result = chain.then(run, run);
        chain = result.catch(() => {});
        return result;
    }

    const SiknayanDialog = {
        alert: (message, options) => open("alert", message, options),
        confirm: (message, options) => open("confirm", message, options),
        prompt: (message, options) => open("prompt", message, options)
    };

    window.SiknayanDialog = SiknayanDialog;

    // Messages never block the page, so the browser box can be replaced directly.
    window.alert = function (message) {
        SiknayanDialog.alert(message);
    };

    // The Academic Admin pages used this name for the same message box.
    window.SiknayanNotice = window.alert;
})();
