/* =========================================================
   SIKNAYAN - SYSTEM ADMINISTRATOR
   MY PROFILE POP-UP (profile-modal.js)

   Same layout as the Academic Admin's and learners' profile pop-up:
   green cover with photo, Profile Picture upload, Personal Information,
   Account & Security, and Edit Profile / Change Password. Opens from
   the name or photo in the header (or the sidebar profile).

   Saves with POST /api/system-admin/profile (name, photo) and
   PUT /api/account/password. The email changes only through the
   verified "Change Email" row (shared/email-change.js).
   Uses the profile helpers in shared.js.
========================================================= */

(function () {
    "use strict";

    const EMAIL_CHANGE_SRC = document.currentScript
        ? new URL("../../shared/email-change.js", document.currentScript.src).href
        : "../shared/email-change.js";

    const MIN_PASSWORD = 15;
    const MAX_PHOTO = 25 * 1024 * 1024; // the server shrinks it
    const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];

    const svg = inner =>
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
        'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' +
        inner + "</svg>";

    const ICON = {
        x: svg('<path d="M18 6 6 18"></path><path d="m6 6 12 12"></path>'),
        user: svg('<circle cx="12" cy="8" r="5"></circle><path d="M20 21a8 8 0 0 0-16 0"></path>'),
        shield: svg('<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"></path><path d="m9 12 2 2 4-4"></path>'),
        key: svg('<path d="M2.586 17.414A2 2 0 0 0 2 18.828V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h.172a2 2 0 0 0 1.414-.586l.814-.814a6.5 6.5 0 1 0-4-4z"></path><circle cx="16.5" cy="7.5" r=".5" fill="currentColor"></circle>'),
        lock: svg('<circle cx="12" cy="16" r="1"></circle><rect x="3" y="10" width="18" height="12" rx="2"></rect><path d="M7 10V7a5 5 0 0 1 10 0v3"></path>'),
        pencil: svg('<path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"></path><path d="m15 5 4 4"></path>'),
        check: svg('<path d="M20 6 9 17l-5-5"></path>'),
        eye: svg('<path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"></path><circle cx="12" cy="12" r="3"></circle>'),
        eyeOff: svg('<path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49"></path><path d="M14.084 14.158a3 3 0 0 1-4.242-4.242"></path><path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143"></path><path d="m2 2 20 20"></path>')
    };

    let profile = window.getSiknayanSystemAdminProfile
        ? window.getSiknayanSystemAdminProfile()
        : { fullName: "System Administrator", username: "", email: "", photo: "" };
    let editing = false;
    let chosenPhoto = null;
    let lastFocus = null;

    const overlay = document.createElement("div");
    overlay.className = "sa-profile-overlay";
    overlay.id = "profileOverlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-labelledby", "saProfileName");
    overlay.innerHTML = `
        <section class="sa-profile-modal">
            <button type="button" class="sa-profile-close" id="saProfileClose" aria-label="Close profile">${ICON.x}</button>

            <header class="sa-profile-cover">
                <div class="sa-profile-photo-wrap">
                    <div class="sa-profile-photo" id="saProfilePhoto" aria-hidden="true">${ICON.user}</div>
                    <label class="sa-photo-edit" title="Change profile picture">
                        ${ICON.pencil}
                        <span class="sa-visually-hidden">Change profile picture</span>
                        <input type="file" id="saPhotoInput" class="sa-visually-hidden"
                            accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp">
                    </label>
                </div>
                <div>
                    <h2 id="saProfileName">System Administrator</h2>
                    <p>Mountain Province State University</p>
                    <div class="sa-profile-role">${ICON.shield}<span>System Administrator</span></div>
                </div>
            </header>

            <!-- Shown only after choosing a picture (or for a message) -->
            <div class="sa-profile-photo-upload" id="saPhotoStrip" hidden>
                <div class="sa-profile-photo-actions">
                    <span class="sa-photo-name" id="saPhotoName"></span>
                    <button type="button" class="sa-upload-photo" id="saUploadPhoto" hidden>Upload Photo</button>
                    <button type="button" class="sa-btn" id="saCancelPhoto" hidden>Cancel</button>
                </div>
                <p class="sa-message" id="saPhotoMessage" role="status" aria-live="polite"></p>
            </div>

            <div class="sa-profile-body">
                <p class="sa-message" id="saProfileMessage" role="status" aria-live="polite"></p>

                <form id="saProfileForm" novalidate>
                    <h3>Personal Information</h3>
                    <div class="sa-profile-grid">
                        <div class="sa-profile-field">
                            <label for="saNameInput">Full Name</label>
                            <p id="saFullName">—</p>
                            <input id="saNameInput" type="text" maxlength="80" autocomplete="name" hidden>
                        </div>
                        <div class="sa-profile-field">
                            <span class="sa-label">Username</span>
                            <p id="saUsername">—</p>
                        </div>
                        <div class="sa-profile-field">
                            <span class="sa-label">Email Address</span>
                            <p id="saEmail">—</p>
                        </div>
                        <div class="sa-profile-field">
                            <span class="sa-label">Account Role</span>
                            <p>System Administrator</p>
                        </div>
                    </div>
                    <p class="sa-profile-note" id="saEditNote" hidden>
                        Username and role are managed by the system. To change your email, use “Change Email” under Account &amp; Security.
                    </p>
                </form>

                <section class="sa-profile-security">
                    <h3>Account &amp; Security</h3>

                    <div class="sa-security-row">
                        <div class="sa-security-icon">${ICON.key}</div>
                        <div class="sa-security-info">
                            <h4>Password</h4>
                            <p>Keep your account secure.</p>
                        </div>
                        <button type="button" class="sa-profile-change" data-sa-action="password"
                            aria-controls="saPasswordForm" aria-expanded="false">Change</button>
                    </div>

                    <form class="sa-password-form" id="saPasswordForm" novalidate hidden>
                        ${["Current", "New", "Confirm"].map(kind => `
                            <div>
                                <label for="sa${kind}Password">${kind === "Confirm" ? "Confirm New Password" : `${kind} Password`}</label>
                                <div class="sa-password-input">
                                    <input id="sa${kind}Password" type="password"
                                        autocomplete="${kind === "Current" ? "current-password" : "new-password"}" required>
                                    <button type="button" class="sa-password-toggle" data-sa-toggle="sa${kind}Password"
                                        aria-label="Show password" title="Show password">${ICON.eye}</button>
                                </div>
                            </div>`).join("")}
                        <p class="sa-message" id="saPasswordMessage" role="status" aria-live="polite"></p>
                        <div class="sa-password-buttons">
                            <span>At least ${MIN_PASSWORD} characters. Long passphrases and spaces are allowed.</span>
                            <div>
                                <button type="button" class="sa-btn" id="saCancelPassword">Cancel</button>
                                <button type="submit" class="sa-btn primary" id="saSavePassword">Update Password</button>
                            </div>
                        </div>
                    </form>

                </section>

                <div class="sa-profile-actions" id="saViewActions">
                    <button type="button" class="sa-profile-button primary" data-sa-action="edit">${ICON.pencil} Edit Profile</button>
                </div>

                <div class="sa-profile-actions" id="saEditActions" hidden>
                    <button type="submit" form="saProfileForm" class="sa-profile-button primary" id="saSaveProfile">${ICON.check} Save Changes</button>
                    <button type="button" class="sa-profile-button" id="saCancelEdit">${ICON.x} Cancel</button>
                </div>
            </div>
        </section>`;
    document.body.appendChild(overlay);

    let emailChangeMounted = false;

    // The verified "Change Email" row in Account & Security.
    function mountEmailChange() {
        if (emailChangeMounted) return;
        emailChangeMounted = true;

        const start = () => window.SiknayanEmailChange.mount(overlay.querySelector(".sa-profile-security"), {
            email: profile && profile.email,
            onChanged: email => {
                if (profile) profile.email = email;
                $("saEmail").textContent = email || "Not provided";
                if (window.setSiknayanSystemAdminProfile && profile) window.setSiknayanSystemAdminProfile(profile);
            }
        });

        if (window.SiknayanEmailChange) return start();

        const script = document.createElement("script");
        script.src = EMAIL_CHANGE_SRC;
        script.onload = start;
        document.head.appendChild(script);
    }

    const $ = id => document.getElementById(id);

    function message(id, text, type) {
        const element = $(id);
        element.textContent = text || "";
        element.className = `sa-message${type ? ` ${type}` : ""}`;
    }

    function getToken() {
        try {
            return sessionStorage.getItem("authToken") || localStorage.getItem("siknayan_api_token") || "";
        } catch (error) {
            return "";
        }
    }

    async function request(path, options = {}) {
        let response;
        try {
            response = await fetch(`${window.SIKNAYAN_API_ROOT}${path}`, {
                ...options,
                headers: { Accept: "application/json", Authorization: `Bearer ${getToken()}`, ...(options.headers || {}) }
            });
        } catch (error) {
            throw new Error("Cannot reach the server. Please check that it is running.");
        }

        if (response.status === 401) {
            window.location.replace("../index.html");
            throw new Error("Your session has ended. Please log in again.");
        }

        const data = await response.json().catch(() => null);
        if (!response.ok || !data || data.success === false) {
            const firstError = data?.errors ? Object.values(data.errors)[0]?.[0] : null;
            throw new Error(firstError || data?.message || `The server returned an error (${response.status}).`);
        }
        return data;
    }

    function fill(next) {
        profile = next;
        const name = profile.fullName || "System Administrator";
        $("saProfileName").textContent = name;
        $("saFullName").textContent = name;
        $("saUsername").textContent = profile.username || "Not provided";
        $("saEmail").textContent = profile.email || "Not provided";

        const photo = $("saProfilePhoto");
        if (profile.photo) {
            photo.innerHTML = '<img alt="">';
            photo.querySelector("img").src = profile.photo;
            photo.querySelector("img").addEventListener("error", () => { photo.innerHTML = ICON.user; });
        } else {
            photo.innerHTML = ICON.user;
        }
    }

    // Saves the name (and a photo, if given) and updates the header.
    async function saveProfile({ name, photo }) {
        const body = new FormData();
        body.append("name", name);
        if (photo) body.append("photo", photo);

        const data = await request("/system-admin/profile", { method: "POST", body });
        const saved = window.toSiknayanSystemAdminProfile
            ? window.toSiknayanSystemAdminProfile(data.profile)
            : { fullName: data.profile?.name, username: data.profile?.school_id, email: data.profile?.email, photo: data.profile?.profile_photo_url };

        if (window.setSiknayanSystemAdminProfile) window.setSiknayanSystemAdminProfile(saved);
        fill(saved);
    }

    /* ---------- Open and close ---------- */

    function open() {
        lastFocus = document.activeElement;
        fill(profile);
        overlay.classList.add("open");
        document.body.style.overflow = "hidden";
        $("saProfileClose").focus();
        mountEmailChange();
    }

    function close() {
        setEditing(false);
        setPasswordOpen(false);
        resetPhoto();
        message("saProfileMessage", "");
        overlay.classList.remove("open");
        document.body.style.overflow = "";
        if (lastFocus && typeof lastFocus.focus === "function" && lastFocus.isConnected) lastFocus.focus();
        overlay.dispatchEvent(new Event("profileclose"));
    }

    document.addEventListener("click", event => {
        const trigger = event.target.closest && event.target.closest(".topbar .profile, .sidebar-profile");
        if (!trigger || overlay.contains(trigger)) return;
        event.preventDefault();
        open();
    });

    $("saProfileClose").addEventListener("click", close);
    overlay.addEventListener("click", event => {
        if (event.target === overlay) close();
    });
    document.addEventListener("keydown", event => {
        if (event.key === "Escape" && overlay.classList.contains("open")) close();
    });

    // Show the real profile when shared.js has loaded it (unless editing).
    window.addEventListener("siknayan:profile-updated", event => {
        if (!editing) fill(event.detail);
        else profile = event.detail;
    });

    /* ---------- Edit Profile (name in place) ---------- */

    function setEditing(on) {
        editing = on;
        $("saFullName").hidden = on;
        $("saNameInput").hidden = !on;
        $("saEditNote").hidden = !on;
        $("saViewActions").hidden = on;
        $("saEditActions").hidden = !on;

        if (on) {
            $("saNameInput").value = profile.fullName || "";
            $("saNameInput").focus();
        }
    }

    function setPasswordOpen(on) {
        $("saPasswordForm").hidden = !on;
        overlay.querySelectorAll('[aria-controls="saPasswordForm"]').forEach(button =>
            button.setAttribute("aria-expanded", String(on)));
        if (!on) $("saPasswordForm").reset();
        message("saPasswordMessage", "");
        if (on) $("saCurrentPassword").focus();
    }

    overlay.querySelectorAll("[data-sa-action]").forEach(button => button.addEventListener("click", () => {
        message("saProfileMessage", "");
        if (button.dataset.saAction === "edit") {
            setPasswordOpen(false);
            setEditing(true);
        } else {
            setEditing(false);
            setPasswordOpen(true);
        }
    }));

    $("saCancelEdit").addEventListener("click", () => setEditing(false));
    $("saCancelPassword").addEventListener("click", () => setPasswordOpen(false));

    $("saProfileForm").addEventListener("submit", async event => {
        event.preventDefault();
        const name = $("saNameInput").value.trim();

        if (!name) {
            message("saProfileMessage", "Please enter your full name.", "error");
            $("saNameInput").focus();
            return;
        }

        $("saSaveProfile").disabled = true;
        $("saCancelEdit").disabled = true;
        try {
            await saveProfile({ name });
            setEditing(false);
            message("saProfileMessage", "Your profile was updated.", "success");
        } catch (error) {
            message("saProfileMessage", error.message, "error");
        } finally {
            $("saSaveProfile").disabled = false;
            $("saCancelEdit").disabled = false;
        }
    });

    overlay.querySelectorAll("[data-sa-toggle]").forEach(button => button.addEventListener("click", () => {
        const input = $(button.dataset.saToggle);
        const show = input.type === "password";
        input.type = show ? "text" : "password";
        button.setAttribute("aria-label", show ? "Hide password" : "Show password");
        button.title = show ? "Hide password" : "Show password";
        button.innerHTML = show ? ICON.eyeOff : ICON.eye;
    }));

    $("saPasswordForm").addEventListener("submit", async event => {
        event.preventDefault();
        const current = $("saCurrentPassword").value;
        const next = $("saNewPassword").value;
        const confirmation = $("saConfirmPassword").value;

        if (!current || !next || !confirmation) return message("saPasswordMessage", "Please fill in all three password fields.", "error");
        if (Array.from(next).length < MIN_PASSWORD) return message("saPasswordMessage", `Use at least ${MIN_PASSWORD} characters. Long passphrases and spaces are allowed.`, "error");
        if (next !== confirmation) return message("saPasswordMessage", "The new passwords do not match.", "error");
        if (next === current) return message("saPasswordMessage", "The new password must be different from your current one.", "error");

        $("saSavePassword").disabled = true;
        try {
            await request("/account/password", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ current_password: current, password: next, password_confirmation: confirmation })
            });
            setPasswordOpen(false);
            message("saProfileMessage", "Your password was changed. Other sessions were signed out.", "success");
        } catch (error) {
            message("saPasswordMessage", error.message, "error");
        } finally {
            $("saSavePassword").disabled = false;
        }
    });

    /* ---------- Profile Picture ---------- */

    function resetPhoto() {
        chosenPhoto = null;
        $("saPhotoInput").value = "";
        $("saPhotoName").textContent = "";
        $("saUploadPhoto").hidden = true;
        $("saCancelPhoto").hidden = true;
        $("saPhotoStrip").hidden = true;
        message("saPhotoMessage", "");
    }

    $("saCancelPhoto").addEventListener("click", resetPhoto);

    $("saPhotoInput").addEventListener("change", event => {
        const file = event.target.files[0];
        resetPhoto();
        if (!file) return;
        $("saPhotoStrip").hidden = false;
        if (!PHOTO_TYPES.includes(file.type)) return message("saPhotoMessage", "Please choose a JPG, PNG or WEBP image.", "error");
        if (file.size > MAX_PHOTO) return message("saPhotoMessage", "The photo must be 25 MB or smaller.", "error");
        chosenPhoto = file;
        $("saPhotoName").textContent = file.name;
        $("saUploadPhoto").hidden = false;
        $("saCancelPhoto").hidden = false;
    });

    $("saUploadPhoto").addEventListener("click", async () => {
        if (!chosenPhoto) return;
        const button = $("saUploadPhoto");
        button.disabled = true;
        button.textContent = "Uploading...";
        try {
            await saveProfile({ name: profile.fullName || "System Administrator", photo: chosenPhoto });
            resetPhoto();
            $("saPhotoStrip").hidden = false;
            message("saPhotoMessage", "Profile picture updated.", "success");
        } catch (error) {
            message("saPhotoMessage", error.message, "error");
        } finally {
            button.disabled = false;
            button.textContent = "Upload Photo";
        }
    });

    window.openSiknayanSystemAdminProfile = open;
    window.siknayanSystemAdminProfileOverlay = overlay;

    // The old My Profile page opens the pop-up straight away.
    if (/\/profile(\.html)?$/i.test(window.location.pathname)) open();
})();
