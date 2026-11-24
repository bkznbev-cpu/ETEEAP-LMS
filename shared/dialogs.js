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
            .sik-dialog-label { display: block; margin: 0 0 12px; color: #3b463f; font-size: 13.5px;
                font-weight: 600; text-align: left; }
            .sik-dialog .sik-dialog-error { margin: -10px 0 14px; color: #b42318; font-size: 13.5px;
                text-align: left; }
            .sik-dialog .sik-dialog-error[hidden] { display: none; }
            .sik-dialog button:disabled { opacity: 0.65; cursor: default; }
            .sik-password-field { box-sizing: border-box; margin: 4px 0 14px; text-align: left; }
            .sik-password-field label { display: block; margin: 0 0 5px; color: #3b463f;
                font-size: 12.5px; font-weight: 600; }
            .sik-password-field input { display: block; width: 100%; max-width: 320px; box-sizing: border-box;
                height: 34px; padding: 0 10px; border: 1px solid #cfd8d3; border-radius: 7px;
                background: #ffffff; color: #1f2a24; font: inherit; font-size: 14px; }
            .sik-password-field input:focus { outline: 2px solid #087443; outline-offset: 1px; }
            .sik-password-box { position: relative; max-width: 320px; }
            .sik-password-box input { max-width: none; padding-right: 40px; }
            .sik-password-input.sik-masked { -webkit-text-security: disc; text-security: disc; }
            .sik-dialog .sik-password-box { max-width: none; margin: -6px 0 18px; }
            .sik-dialog .sik-password-box input { margin: 0; padding-right: 44px; }
            .sik-dialog .sik-password-box .sik-password-eye,
            .sik-password-field .sik-password-box button.sik-password-eye { position: absolute; top: 50%; right: 4px; transform: translateY(-50%);
                width: 32px; height: 30px; min-width: 0; min-height: 0; padding: 0; display: grid;
                place-items: center; border: 0; border-radius: 6px; background: transparent;
                color: #5b6b62; cursor: pointer; }
            .sik-password-box button.sik-password-eye:hover { background: #eef3f0; color: #087443; }
            .sik-password-eye:focus-visible { outline: 2px solid #087443; outline-offset: 1px; }
            .sik-password-eye svg { width: 18px; height: 18px; }
            .sik-password-error { margin-top: 6px; color: #b42318; font-size: 13px; }
            .sik-password-error[hidden] { display: none; }
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

    /* -----------------------------------------------------
       DELETE CONFIRMATION WITH PASSWORD (admin portals)

       const password = await SiknayanDialog.confirmPassword(text, {
           title, confirmText });
       Resolves the admin's password once the server has checked it,
       or null when cancelled. The box stays open on a wrong password.
       Send it with the delete:  headers: { "X-Confirm-Password": password }
       (the server checks it again before deleting).
    ----------------------------------------------------- */
    function apiToken() {
        try {
            return window.SIKNAYAN_API_TOKEN ||
                sessionStorage.getItem("authToken") ||
                localStorage.getItem("siknayan_api_token") ||
                localStorage.getItem("token") ||
                "";
        } catch (error) {
            return window.SIKNAYAN_API_TOKEN || "";
        }
    }

    async function checkPassword(password) {
        const root = window.SIKNAYAN_API_ROOT || "/api";
        let response;

        try {
            response = await fetch(`${root}/account/confirm-password`, {
                method: "POST",
                headers: {
                    "Accept": "application/json",
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${apiToken()}`
                },
                body: JSON.stringify({ password })
            });
        } catch (error) {
            return "Unable to reach the server. Check your connection and try again.";
        }

        if (response.ok) return "";
        if (response.status === 429) return "Too many tries. Please wait a minute and try again.";
        if (response.status === 401) return "Your session has ended. Please log in again.";

        try {
            const payload = await response.json();
            return payload.message || "Your password is incorrect.";
        } catch (error) {
            return "Your password is incorrect.";
        }
    }

    function confirmPassword(message, options) {
        const run = () => whenBodyReady().then(() => new Promise(resolve => {
            addStyle();

            const opts = options || {};
            const title = opts.title || "Confirm delete";
            const okText = opts.confirmText || "Delete";

            const overlay = document.createElement("div");
            overlay.className = "sik-dialog-overlay";
            overlay.innerHTML = `
                <form class="sik-dialog danger" role="dialog" aria-modal="true"
                      aria-labelledby="sikDialogText" novalidate>
                    <div class="sik-dialog-icon" aria-hidden="true">${ICON_PROBLEM}</div>
                    <h3>${escapeHtml(title)}</h3>
                    <p id="sikDialogText">${escapeHtml(String(message || ""))}</p>
                    <label class="sik-dialog-label" for="sikDialogPassword">
                        Enter your password to continue
                    </label>
                    <div class="sik-password-box">
                        ${passwordInput("sikDialogPassword", "sik-dialog-input", "required")}
                        ${EYE_BUTTON}
                    </div>
                    <div class="sik-dialog-error" role="alert" hidden></div>
                    <div class="sik-dialog-actions">
                        <button type="button" class="sik-dialog-cancel">Cancel</button>
                        <button type="submit" class="sik-dialog-ok">${escapeHtml(okText)}</button>
                    </div>
                </form>`;

            const form = overlay.querySelector("form");
            const input = overlay.querySelector(".sik-password-input");
            setupEye(input, overlay.querySelector(".sik-password-eye"));
            const error = overlay.querySelector(".sik-dialog-error");
            const ok = overlay.querySelector(".sik-dialog-ok");
            const cancel = overlay.querySelector(".sik-dialog-cancel");
            const lastFocus = document.activeElement;
            let busy = false;

            function showError(text) {
                error.textContent = text;
                error.hidden = !text;
            }

            function finish(answer) {
                document.removeEventListener("keydown", onKey, true);
                overlay.remove();
                if (lastFocus && typeof lastFocus.focus === "function" && document.contains(lastFocus)) {
                    lastFocus.focus();
                }
                resolve(answer);
            }

            function onKey(event) {
                if (event.key === "Escape" && !busy) {
                    event.preventDefault();
                    event.stopPropagation();
                    finish(null);
                }
            }

            form.addEventListener("submit", async event => {
                event.preventDefault();
                if (busy) return;

                const password = input.value;
                if (!password) {
                    showError("Please enter your password.");
                    input.focus();
                    return;
                }

                busy = true;
                ok.disabled = true;
                cancel.disabled = true;
                ok.textContent = "Checking...";
                showError("");

                const problem = await checkPassword(password);

                if (!problem) {
                    finish(password);
                    return;
                }

                busy = false;
                ok.disabled = false;
                cancel.disabled = false;
                ok.textContent = okText;
                showError(problem);
                input.select();
                input.focus();
            });

            cancel.addEventListener("click", () => finish(null));
            document.addEventListener("keydown", onKey, true);

            document.body.appendChild(overlay);
            input.focus();
        }));

        const result = chain.then(run, run);
        chain = result.catch(() => {});
        return result;
    }

    /* Eye button: shows or hides the typed password. */
    const ICON_EYE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';
    const ICON_EYE_OFF = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9.9 4.24A9.1 9.1 0 0 1 12 4c6.5 0 10 8 10 8a17.6 17.6 0 0 1-2.16 3.19"/><path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"/><path d="M17.94 17.94A10.1 10.1 0 0 1 12 20c-6.5 0-10-8-10-8a17.8 17.8 0 0 1 4.06-5.94"/><path d="m2 2 20 20"/></svg>';
    // The password must be typed each time: the browser must not fill in or
    // list saved passwords. Browsers do that for every type="password" box,
    // so where the browser can hide typed text with dots (Chrome, Edge,
    // Safari, Firefox) the box is a plain text box shown as dots instead.
    // Older browsers keep a password box with autofill turned off.
    const CAN_MASK = !!(window.CSS && CSS.supports && CSS.supports("-webkit-text-security", "disc"));

    function passwordInput(id, classes, extra = "") {
        const common = `id="${id}" class="${classes} sik-password-input" name="sik-confirm-${id}" ` +
            'autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" ' +
            'data-lpignore="true" data-1p-ignore="true" data-bwignore="true" data-form-type="other"';
        return CAN_MASK
            ? `<input type="text" ${common} ${extra}>`
            : `<input type="password" ${common} ${extra}>`;
    }

    const EYE_BUTTON = `<button type="button" class="sik-password-eye" aria-label="Show password" title="Show password">${ICON_EYE}</button>`;

    function setupEye(input, eye) {
        let shown = false;

        if (CAN_MASK) {
            input.classList.add("sik-masked");
            // The hidden password cannot be copied out of the box.
            ["copy", "cut"].forEach(type => input.addEventListener(type, event => {
                if (!shown) event.preventDefault();
            }));
        }

        eye.setPassword = function (show) {
            shown = show;
            if (CAN_MASK) input.classList.toggle("sik-masked", !show);
            else input.type = show ? "text" : "password";
            eye.innerHTML = show ? ICON_EYE_OFF : ICON_EYE;
            const label = show ? "Hide password" : "Show password";
            eye.setAttribute("aria-label", label);
            eye.title = label;
            eye.setAttribute("aria-pressed", String(show));
        };

        eye.addEventListener("click", () => {
            eye.setPassword(!shown);
            input.focus();
        });
    }

    /* -----------------------------------------------------
       PASSWORD FIELD INSIDE A PAGE'S OWN DELETE BOX

       const field = SiknayanDialog.passwordField(confirmButton);
         Puts "Enter your password" above the row holding confirmButton.
       field.reset()             empty it and hide the error (on open)
       await field.verify()      the checked password, or null (the
                                 error is shown in the box)
       field.showError(text)     e.g. the server's message after a delete
    ----------------------------------------------------- */
    function passwordField(confirmButton) {
        addStyle();

        const row = confirmButton && confirmButton.parentElement;
        if (!row) {
            return { reset() {}, verify: async () => null, showError() {}, focus() {} };
        }

        const existing = row.previousElementSibling;
        if (existing && existing.classList.contains("sik-password-field")) {
            return existing.sikField;
        }

        const id = `sikDeletePassword${Math.random().toString(36).slice(2, 8)}`;
        const wrap = document.createElement("div");
        wrap.className = "sik-password-field";
        wrap.innerHTML = `
            <label for="${id}">Enter your password to confirm</label>
            <div class="sik-password-box">
                ${passwordInput(id, "")}
                ${EYE_BUTTON}
            </div>
            <div class="sik-password-error" role="alert" hidden></div>`;

        row.parentElement.insertBefore(wrap, row);

        // Some boxes pad only their sections, not the box itself: line the
        // field up with the button row's side padding so it isn't edge to edge.
        const boxStyle = getComputedStyle(row.parentElement);
        if (parseFloat(boxStyle.paddingLeft) === 0) {
            const rowStyle = getComputedStyle(row);
            wrap.style.paddingLeft = rowStyle.paddingLeft;
            wrap.style.paddingRight = rowStyle.paddingRight;
        }

        const input = wrap.querySelector(".sik-password-input");
        const error = wrap.querySelector(".sik-password-error");
        const eye = wrap.querySelector(".sik-password-eye");

        setupEye(input, eye);

        // Enter in the field works like clicking the delete button.
        input.addEventListener("keydown", event => {
            if (event.key === "Enter") {
                event.preventDefault();
                if (!confirmButton.disabled) confirmButton.click();
            }
        });

        input.addEventListener("input", () => {
            error.hidden = true;
        });

        const field = {
            reset() {
                input.value = "";
                error.textContent = "";
                error.hidden = true;
                // Hidden again each time the box opens.
                eye.setPassword(false);
            },
            focus() {
                input.focus();
            },
            showError(text) {
                error.textContent = text || "";
                error.hidden = !text;
            },
            async verify() {
                const password = input.value;

                if (!password) {
                    field.showError("Please enter your password.");
                    input.focus();
                    return null;
                }

                const problem = await checkPassword(password);

                if (problem) {
                    field.showError(problem);
                    input.select();
                    input.focus();
                    return null;
                }

                field.showError("");
                return password;
            }
        };

        wrap.sikField = field;
        return field;
    }

    const SiknayanDialog = {
        alert: (message, options) => open("alert", message, options),
        confirm: (message, options) => open("confirm", message, options),
        prompt: (message, options) => open("prompt", message, options),
        confirmPassword,
        passwordField
    };

    window.SiknayanDialog = SiknayanDialog;

    // Messages never block the page, so the browser box can be replaced directly.
    window.alert = function (message) {
        SiknayanDialog.alert(message);
    };

    // The Academic Admin pages used this name for the same message box.
    window.SiknayanNotice = window.alert;
})();
