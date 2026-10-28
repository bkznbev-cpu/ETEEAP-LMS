/* =========================================================
   SIKNAYAN - ADD YOUR EMAIL (shared/email-step.js)

   The step after setting a new password on the learner, instructor
   and academic admin setup pages. The person must add their email
   (used for "Forgot Password?" codes and announcements) and confirm
   it with the 6-digit code sent to it before they can use the LMS.
   A made-up address can't receive the code, so it can't be used.
   The server refuses everything else until then.

   SiknayanEmailStep.start({
       form,          the password form (hidden during this step)
       description,   text under the title (changed for this step)
       buttonClass,   the page's main button class, for the same look
       showMessage,   the page's message function (text, type)
       onDone         what to do after the email is confirmed
   })
   A page opened with ?step=email starts here directly (sign-in sends
   people here when the password is set but the email is missing or
   not confirmed yet).
========================================================= */

(function () {
    "use strict";

    const STYLE = `
        .email-step { display: flex; flex-direction: column; gap: 14px; margin-top: 6px; }
        .email-step-badge { align-self: flex-start; padding: 4px 12px; border-radius: 999px;
            background: #e2ac2f; color: #3d0a0d; font-size: 12px; font-weight: 700; letter-spacing: .3px; }
        .email-step h3 { margin: 0; color: #0b5d35; font-size: 18px; }
        .email-step p { margin: 0; color: #5b6760; font-size: 13.5px; line-height: 1.55; }
        .email-step label { display: block; margin-bottom: 6px; color: #344054; font-size: 14px; font-weight: 600; text-align: left; }
        .email-step-input { position: relative; }
        .email-step-input i { position: absolute; top: 50%; left: 14px; color: #8a958f; transform: translateY(-50%); }
        .email-step input { box-sizing: border-box; width: 100%; padding: 12px 14px 12px 40px; border: 1px solid #cfd8d3;
            border-radius: 9px; background: #fff; font: inherit; font-size: 15px; }
        .email-step input:focus { outline: 3px solid rgba(8, 116, 67, .18); border-color: #087443; }
        .email-step input.email-step-code { letter-spacing: 8px; font-size: 20px; font-weight: 700; text-align: center; padding-left: 14px; }
        .email-step-error { margin: 0; color: #b42318 !important; font-size: 13px; }
        .email-step-error:empty { display: none; }
        .email-step-note { margin: 0; color: #0b5d35 !important; font-size: 13px; }
        .email-step-note:empty { display: none; }
        .email-step button { width: 100%; }
        .email-step-links { display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
        .email-step-links button { width: auto; padding: 0; border: 0; background: none; color: #087443;
            font: inherit; font-size: 13.5px; font-weight: 600; cursor: pointer; text-decoration: underline; }
        .email-step-links button:disabled { color: #8a958f; cursor: default; text-decoration: none; }
        .email-step [hidden] { display: none !important; }
    `;

    function escapeHtml(value) {
        return String(value ?? "").replace(/[&<>"']/g, character => ({
            "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
        }[character]));
    }

    function token() {
        return sessionStorage.getItem("authToken") || localStorage.getItem("siknayan_api_token") || "";
    }

    /* POST to the API; returns the JSON or throws an Error with the message to show. */
    async function post(path, body) {
        let response;
        try {
            response = await fetch(`${window.SIKNAYAN_API_ROOT}${path}`, {
                method: "POST",
                headers: {
                    "Accept": "application/json",
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token()}`
                },
                body: JSON.stringify(body || {})
            });
        } catch (networkError) {
            throw new Error("Cannot reach the server. Please check your connection and try again.");
        }

        const data = await response.json().catch(() => ({}));

        if (response.status === 401) {
            throw new Error("Your session has ended. Please log in again.");
        }
        if (!response.ok || data.success === false) {
            const first = data.errors && Object.values(data.errors).flat()[0];
            const error = new Error(first || data.message || "Something went wrong. Please try again.");
            error.data = data;
            throw error;
        }

        return data;
    }

    function start(options) {
        const { form, description, buttonClass = "", showMessage = () => {}, onDone = () => {} } = options;
        if (!form || document.getElementById("emailStepForm")) return;

        if (!document.getElementById("emailStepStyle")) {
            const style = document.createElement("style");
            style.id = "emailStepStyle";
            style.textContent = STYLE;
            document.head.appendChild(style);
        }

        form.hidden = true;
        form.style.display = "none";

        if (description) {
            description.textContent = "Your password is set. One more step: add and confirm your email address.";
        }

        let user = {};
        try { user = JSON.parse(sessionStorage.getItem("user") || "{}") || {}; } catch (error) { user = {}; }

        const step = document.createElement("form");
        step.id = "emailStepForm";
        step.className = "email-step";
        step.noValidate = true;
        step.innerHTML = `
            <span class="email-step-badge">STEP 2 OF 2</span>
            <h3 id="emailStepTitle">Add your email address</h3>
            <p id="emailStepText">It is used to send you a code if you forget your password, and to tell you about new announcements.
               We will send a code to it to make sure it is really yours.</p>

            <div id="emailStepEmailPart">
                <label for="emailStepInput">Email Address</label>
                <div class="email-step-input">
                    <i class="fa-solid fa-envelope" aria-hidden="true"></i>
                    <input id="emailStepInput" type="email" maxlength="255" autocomplete="email" required
                        placeholder="name@example.com" value="${escapeHtml(user.email || "")}">
                </div>
            </div>

            <div id="emailStepCodePart" hidden>
                <label for="emailStepCode">Verification Code</label>
                <input id="emailStepCode" class="email-step-code" type="text" inputmode="numeric"
                    autocomplete="one-time-code" maxlength="6" placeholder="000000">
            </div>

            <p class="email-step-note" id="emailStepNote" role="status"></p>
            <p class="email-step-error" id="emailStepError" role="alert"></p>
            <button type="submit" class="${escapeHtml(buttonClass)}" id="emailStepButton">Send Verification Code</button>

            <div class="email-step-links" id="emailStepLinks" hidden>
                <button type="button" id="emailStepResend">Resend code</button>
                <button type="button" id="emailStepChange">Use a different email</button>
            </div>`;
        form.insertAdjacentElement("afterend", step);

        const $ = id => step.querySelector(`#${id}`);
        const input = $("emailStepInput");
        const codeInput = $("emailStepCode");
        const emailPart = $("emailStepEmailPart");
        const codePart = $("emailStepCodePart");
        const links = $("emailStepLinks");
        const resendButton = $("emailStepResend");
        const changeButton = $("emailStepChange");
        const title = $("emailStepTitle");
        const text = $("emailStepText");
        const note = $("emailStepNote");
        const error = $("emailStepError");
        const button = $("emailStepButton");

        let phase = "email";
        let resendTimer = null;

        setTimeout(() => input.focus(), 50);

        function setError(message) {
            error.textContent = message || "";
        }

        function waitToResend(seconds) {
            clearInterval(resendTimer);
            let left = Math.max(0, Number(seconds) || 0);

            const tick = () => {
                if (left <= 0) {
                    clearInterval(resendTimer);
                    resendButton.disabled = false;
                    resendButton.textContent = "Resend code";
                    return;
                }
                resendButton.disabled = true;
                resendButton.textContent = `Resend code (${left}s)`;
                left -= 1;
            };

            tick();
            resendTimer = setInterval(tick, 1000);
        }

        function showCodePhase(data) {
            phase = "code";
            emailPart.hidden = true;
            codePart.hidden = false;
            links.hidden = false;
            title.textContent = "Check your email";
            text.textContent = `Enter the 6-digit code we sent to ${data.pending_email || "your email"}. `
                + `It expires in ${data.expires_in_minutes || 15} minutes. Check your spam folder if you don't see it.`;
            note.textContent = "";
            button.textContent = "Verify and Continue";
            codeInput.value = "";
            waitToResend(data.resend_after || 60);
            setTimeout(() => codeInput.focus(), 50);
        }

        function showEmailPhase() {
            phase = "email";
            clearInterval(resendTimer);
            emailPart.hidden = false;
            codePart.hidden = true;
            links.hidden = true;
            title.textContent = "Add your email address";
            text.textContent = "It is used to send you a code if you forget your password, and to tell you about new announcements. "
                + "We will send a code to it to make sure it is really yours.";
            note.textContent = "";
            button.textContent = "Send Verification Code";
            setTimeout(() => input.focus(), 50);
        }

        codeInput.addEventListener("input", () => {
            codeInput.value = codeInput.value.replace(/\D/g, "").slice(0, 6);
        });

        changeButton.addEventListener("click", () => {
            setError("");
            showEmailPhase();
        });

        resendButton.addEventListener("click", async () => {
            setError("");
            resendButton.disabled = true;
            try {
                const data = await post("/account/email/resend");
                note.textContent = data.message || "A new code was sent.";
                codeInput.value = "";
                waitToResend(data.resend_after || 60);
            } catch (resendError) {
                setError(resendError.message);
                waitToResend(resendError.data?.resend_after || 0);
            }
        });

        step.addEventListener("submit", async event => {
            event.preventDefault();
            setError("");

            if (phase === "email") {
                const email = input.value.trim();

                if (!email) {
                    setError("Please enter your email address.");
                    input.focus();
                    return;
                }
                if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                    setError("Please enter a valid email address.");
                    input.focus();
                    return;
                }

                button.disabled = true;
                button.textContent = "Sending code...";

                try {
                    const data = await post("/account/email", { email });
                    showCodePhase(data);
                    note.textContent = data.message || "";
                } catch (sendError) {
                    setError(sendError.message);
                    button.textContent = "Send Verification Code";
                } finally {
                    button.disabled = false;
                }
                return;
            }

            const code = codeInput.value.trim();

            if (!/^\d{6}$/.test(code)) {
                setError("Please enter the 6-digit code from the email.");
                codeInput.focus();
                return;
            }

            button.disabled = true;
            button.textContent = "Verifying...";

            try {
                const data = await post("/account/email/verify", { code });

                clearInterval(resendTimer);
                try {
                    sessionStorage.setItem("user", JSON.stringify({ ...user, email: data.user?.email || user.email }));
                } catch (storageError) { /* ignore */ }

                button.textContent = "Email Confirmed";
                links.hidden = true;
                showMessage("Your email address has been confirmed.", "success");
                onDone(data);
            } catch (verifyError) {
                setError(verifyError.message);
                button.disabled = false;
                button.textContent = "Verify and Continue";

                // The request was cancelled or expired: start again with the email.
                if (/enter your email again|expired/i.test(verifyError.message)) {
                    showEmailPhase();
                    setError(verifyError.message);
                }
            }
        });
    }

    function requested() {
        return new URLSearchParams(window.location.search).get("step") === "email";
    }

    window.SiknayanEmailStep = { start, requested };
})();
