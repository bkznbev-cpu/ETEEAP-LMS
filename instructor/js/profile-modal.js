/* =========================================================
   SIKNAYAN - INSTRUCTOR PORTAL
   MY PROFILE POP-UP (profile-modal.js)

   Same structure as the Academic Admin profile: green cover with the
   photo (pen on the photo to change it), Personal Information, Account &
   Security (Password), and Edit Profile / Change Password. Opens when the instructor clicks their
   name or photo in the header (#userProfileBtn) on any instructor page.
   Styles: CSS/profile-modal.css.
========================================================= */

(function () {
    "use strict";

    // shared/email-change.js: the verified "Change Email" row.
    const EMAIL_CHANGE_SRC = document.currentScript
        ? new URL("../../shared/email-change.js", document.currentScript.src).href
        : "../shared/email-change.js";

    const API_ROOT = window.SIKNAYAN_API_ROOT;
    const token = sessionStorage.getItem("authToken") || sessionStorage.getItem("token");
    if (!API_ROOT || !token) return;

    const MAX_PHOTO = 25 * 1024 * 1024; // the server shrinks it
    const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
    let profile = null;
    let loading = null;
    let chosenPhoto = null;
    let lastFocus = null;

    function escape(value) {
        return String(value ?? "").replace(/[&<>"']/g, character => ({
            "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
        }[character]));
    }

    /** Calls the API with the sign-in token; throws with the server's message. */
    async function api(path, options = {}) {
        const headers = { Accept: "application/json", Authorization: `Bearer ${token}` };
        let body = options.body;

        if (body && !(body instanceof FormData)) {
            body = JSON.stringify(body);
            headers["Content-Type"] = "application/json";
        }

        let response;
        try {
            response = await fetch(`${API_ROOT}${path}`, { method: options.method || "GET", headers, body });
        } catch (error) {
            throw new Error("Cannot reach the server. Please check your connection and try again.");
        }

        const data = await response.json().catch(() => ({}));

        if (!response.ok || data.success === false) {
            const firstError = data.errors && Object.values(data.errors)[0];
            throw new Error((Array.isArray(firstError) ? firstError[0] : firstError) || data.message || "Something went wrong. Please try again.");
        }

        return data;
    }

    const overlay = document.createElement("div");
    overlay.className = "lp-profile-overlay";
    overlay.id = "instructorProfileOverlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-labelledby", "lpProfileName");
    overlay.innerHTML = `
        <section class="lp-profile-modal">
            <button type="button" class="lp-profile-close" id="lpProfileClose" aria-label="Close profile">
                <i class="fa-solid fa-xmark" aria-hidden="true"></i>
            </button>

            <!-- Same structure as the Academic Admin profile -->
            <header class="lp-profile-cover">
                <div class="lp-photo-wrap">
                    <div class="lp-profile-photo" id="lpProfilePhoto" aria-hidden="true">
                        <i class="fa-regular fa-user"></i>
                    </div>
                    <!-- Pen on the photo: choose a new profile picture -->
                    <label for="lpPhotoInput" class="lp-photo-edit" title="Change profile picture">
                        <i class="fa-solid fa-pen" aria-hidden="true"></i>
                        <span class="visually-hidden">Change profile picture</span>
                    </label>
                </div>
                <div>
                    <h2 id="lpProfileName">Loading...</h2>
                    <p>Mountain Province State University</p>
                    <div class="lp-profile-role">
                        <i class="fa-solid fa-chalkboard-user" aria-hidden="true"></i>
                        <span>Instructor</span>
                    </div>
                </div>
            </header>

            <!-- Shown after a picture is chosen with the pen -->
            <div class="lp-profile-photo-upload" id="lpPhotoUpload" hidden>
                <div class="lp-profile-photo-actions">
                    <input type="file" id="lpPhotoInput" class="visually-hidden"
                        accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp">
                    <span class="lp-photo-name" id="lpPhotoName"></span>
                    <button type="button" class="lp-upload-photo" id="lpUploadPhoto" hidden>Upload Photo</button>
                    <button type="button" class="lp-btn plain" id="lpCancelPhoto">Cancel</button>
                </div>
                <p class="lp-message" id="lpPhotoMessage" role="status" aria-live="polite"></p>
            </div>

            <div class="lp-profile-body">
                <p class="lp-message" id="lpProfileMessage" role="status" aria-live="polite"></p>

                <form id="lpProfileForm" novalidate>
                    <h3>Personal Information</h3>
                    <div class="lp-profile-grid">
                        <div class="lp-profile-field">
                            <span class="label">Full Name</span>
                            <p id="lpFullName">—</p>
                        </div>
                        <div class="lp-profile-field">
                            <span class="label">Instructor ID</span>
                            <p id="lpSchoolId">—</p>
                        </div>
                        <div class="lp-profile-field">
                            <span class="label">Email Address</span>
                            <p id="lpEmail">—</p>
                        </div>
                    </div>
                    <p class="lp-profile-note" id="lpEditNote" hidden>
                        To change your email, use “Change Email” under Account &amp; Security. Your name and instructor ID are managed by your administrator.
                    </p>
                </form>

                <section class="lp-profile-security">
                    <h3>Account &amp; Security</h3>

                    <div class="lp-profile-security-row">
                        <div class="lp-profile-security-icon"><i class="fa-solid fa-key" aria-hidden="true"></i></div>
                        <div class="lp-profile-security-info">
                            <h4>Password</h4>
                            <p>Keep your account secure.</p>
                        </div>
                        <button type="button" class="lp-profile-change" data-lp-action="password"
                            aria-controls="lpPasswordForm" aria-expanded="false">Change</button>
                    </div>

                    <form class="lp-password-form" id="lpPasswordForm" novalidate hidden>
                        <div>
                            <label for="lpCurrentPassword">Current Password</label>
                            <div class="lp-password-input">
                                <input id="lpCurrentPassword" type="password" autocomplete="current-password" required>
                                <button type="button" class="lp-password-toggle" data-lp-toggle="lpCurrentPassword" aria-label="Show current password">
                                    <i class="fa-regular fa-eye" aria-hidden="true"></i>
                                </button>
                            </div>
                        </div>
                        <div>
                            <label for="lpNewPassword">New Password</label>
                            <div class="lp-password-input">
                                <input id="lpNewPassword" type="password" autocomplete="new-password" minlength="8" required>
                                <button type="button" class="lp-password-toggle" data-lp-toggle="lpNewPassword" aria-label="Show new password">
                                    <i class="fa-regular fa-eye" aria-hidden="true"></i>
                                </button>
                            </div>
                        </div>
                        <div>
                            <label for="lpConfirmPassword">Confirm New Password</label>
                            <div class="lp-password-input">
                                <input id="lpConfirmPassword" type="password" autocomplete="new-password" minlength="8" required>
                                <button type="button" class="lp-password-toggle" data-lp-toggle="lpConfirmPassword" aria-label="Show password confirmation">
                                    <i class="fa-regular fa-eye" aria-hidden="true"></i>
                                </button>
                            </div>
                        </div>
                        <p class="lp-message" id="lpPasswordMessage" role="status" aria-live="polite"></p>
                        <div class="lp-password-buttons">
                            <span>At least 8 characters. Other devices will be signed out.</span>
                            <div>
                                <button type="button" class="lp-btn plain" id="lpCancelPassword">Cancel</button>
                                <button type="submit" class="lp-btn" id="lpSavePassword">Update Password</button>
                            </div>
                        </div>
                    </form>
                </section>

                <div class="lp-profile-actions" id="lpViewActions">
                    <button type="button" class="lp-profile-button primary" data-lp-action="edit">
                        <i class="fa-solid fa-pen" aria-hidden="true"></i> Edit Profile
                    </button>
                    <button type="button" class="lp-profile-button" data-lp-action="password">
                        <i class="fa-solid fa-lock" aria-hidden="true"></i> Change Password
                    </button>
                </div>

                <div class="lp-profile-actions" id="lpEditActions" hidden>
                    <button type="submit" form="lpProfileForm" class="lp-profile-button primary" id="lpSaveProfile">
                        <i class="fa-solid fa-check" aria-hidden="true"></i> Save Changes
                    </button>
                    <button type="button" class="lp-profile-button" id="lpCancelEdit">
                        <i class="fa-solid fa-xmark" aria-hidden="true"></i> Cancel
                    </button>
                </div>
            </div>
        </section>`;
    document.body.appendChild(overlay);

    // The email is changed in Account & Security (verified with a code),
    // so "Edit Profile" has nothing left to edit here.
    overlay.querySelectorAll('[data-lp-action="edit"]').forEach(button => { button.hidden = true; });

    let emailChangeMounted = false;

    function mountEmailChange() {
        if (emailChangeMounted) return;
        emailChangeMounted = true;

        const start = () => window.SiknayanEmailChange.mount(overlay.querySelector(".lp-profile-security"), {
            email: profile?.email,
            onChanged: email => {
                if (profile) profile.email = email;
                $("lpEmail").textContent = email || "—";
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
        element.className = `lp-message${type ? ` ${type}` : ""}`;
    }

    const shown = value => (value === null || value === undefined || value === "" ? "Not provided" : String(value));

    function initials(name) {
        return String(name || "").trim().split(/\s+/).filter(Boolean).slice(0, 2)
            .map(part => part.charAt(0).toUpperCase()).join("") || "I";
    }

    /** The photo in the header and in the pop-up cover (initials when none). */
    function showPhoto(url, name) {
        const cover = $("lpProfilePhoto");
        const headerPhoto = $("headerAvatar");

        if (url) {
            cover.innerHTML = `<img src="${escape(url)}" alt="">`;
            cover.querySelector("img").addEventListener("error", () => {
                cover.textContent = initials(name);
            });
            if (headerPhoto && headerPhoto.tagName === "IMG") headerPhoto.src = url;
        } else {
            cover.textContent = initials(name);
        }
    }

    function fill(user) {
        profile = user;
        $("lpProfileName").textContent = user.name;
        $("lpFullName").textContent = shown(user.name);
        $("lpSchoolId").textContent = shown(user.school_id);
        $("lpEmail").textContent = shown(user.email);
        showPhoto(user.profile_photo_url, user.name);

        const headerName = $("headerInstructorName");
        if (headerName && user.name) headerName.textContent = user.name;
    }

    function load() {
        loading = loading || api("/instructor/profile")
            .then(data => fill(data.user))
            .catch(error => {
                loading = null;
                message("lpProfileMessage", error.message, "error");
            });
        return loading;
    }

    /* ---------- Open and close ---------- */

    function open() {
        lastFocus = document.activeElement;
        overlay.classList.add("open");
        document.body.style.overflow = "hidden";
        $("lpProfileClose").focus();
        load();
        mountEmailChange();
    }

    function close() {
        setEditing(false);
        setPasswordOpen(false);
        resetPhoto();
        message("lpProfileMessage", "");
        overlay.classList.remove("open");
        document.body.style.overflow = "";
        if (lastFocus && typeof lastFocus.focus === "function") lastFocus.focus();
    }

    // Capture phase: this pop-up replaces the older per-page profile forms.
    document.addEventListener("click", event => {
        const trigger = event.target.closest && event.target.closest("#userProfileBtn");
        if (!trigger) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        open();
    }, true);

    $("lpProfileClose").addEventListener("click", close);
    overlay.addEventListener("click", event => {
        if (event.target === overlay) close();
    });
    document.addEventListener("keydown", event => {
        if (event.key === "Escape" && overlay.classList.contains("open")) close();
    });

    /* ---------- Edit Profile (email and contact in place) ---------- */

    function setEditing(editing) {
        $("lpEditNote").hidden = !editing;
        $("lpViewActions").hidden = editing;
        $("lpEditActions").hidden = !editing;
    }

    /* ---------- Change Password (inline under the Password row) ---------- */

    function setPasswordOpen(isOpen) {
        $("lpPasswordForm").hidden = !isOpen;
        // Like the admin profile: compact card, big buttons hidden while open.
        overlay.querySelector(".lp-profile-modal").classList.toggle("lp-compact", isOpen);
        if (isOpen) $("lpViewActions").hidden = true;
        else if ($("lpEditActions").hidden) $("lpViewActions").hidden = false;
        overlay.querySelectorAll('[aria-controls="lpPasswordForm"]').forEach(button =>
            button.setAttribute("aria-expanded", String(isOpen)));
        if (!isOpen) $("lpPasswordForm").reset();
        message("lpPasswordMessage", "");
        if (isOpen) $("lpCurrentPassword").focus();
    }

    overlay.querySelectorAll("[data-lp-action]").forEach(button => button.addEventListener("click", () => {
        message("lpProfileMessage", "");
        if (button.dataset.lpAction === "edit") {
            setPasswordOpen(false);
            setEditing(true);
        } else {
            setEditing(false);
            setPasswordOpen(true);
        }
    }));

    $("lpCancelEdit").addEventListener("click", () => setEditing(false));
    $("lpCancelPassword").addEventListener("click", () => setPasswordOpen(false));

    $("lpProfileForm").addEventListener("submit", async event => {
        event.preventDefault();
        // Contact number is no longer shown; keep whatever is saved.
        const contact = profile?.contact || "";


        $("lpSaveProfile").disabled = true;
        $("lpCancelEdit").disabled = true;
        try {
            const data = await api("/instructor/profile", { method: "PUT", body: { contact } });
            fill(data.user);
            setEditing(false);
            message("lpProfileMessage", "Your profile was updated.", "success");
        } catch (error) {
            message("lpProfileMessage", error.message, "error");
        } finally {
            $("lpSaveProfile").disabled = false;
            $("lpCancelEdit").disabled = false;
        }
    });

    overlay.querySelectorAll("[data-lp-toggle]").forEach(button => button.addEventListener("click", () => {
        const input = $(button.dataset.lpToggle);
        const show = input.type === "password";
        input.type = show ? "text" : "password";
        button.setAttribute("aria-label", button.getAttribute("aria-label").replace(show ? "Show" : "Hide", show ? "Hide" : "Show"));
        button.innerHTML = `<i class="fa-regular ${show ? "fa-eye-slash" : "fa-eye"}" aria-hidden="true"></i>`;
    }));

    $("lpPasswordForm").addEventListener("submit", async event => {
        event.preventDefault();
        const current = $("lpCurrentPassword").value;
        const next = $("lpNewPassword").value;
        const confirmation = $("lpConfirmPassword").value;

        if (!current || !next || !confirmation) return message("lpPasswordMessage", "Please fill in all three password fields.", "error");
        if (next.length < 8) return message("lpPasswordMessage", "The new password must be at least 8 characters.", "error");
        if (next !== confirmation) return message("lpPasswordMessage", "The new passwords do not match.", "error");
        if (next === current) return message("lpPasswordMessage", "The new password must be different from your current one.", "error");

        $("lpSavePassword").disabled = true;
        try {
            await api("/account/password", {
                method: "PUT",
                body: { current_password: current, password: next, password_confirmation: confirmation }
            });
            setPasswordOpen(false);
            message("lpProfileMessage", "Your password was changed.", "success");
        } catch (error) {
            message("lpPasswordMessage", error.message, "error");
        } finally {
            $("lpSavePassword").disabled = false;
        }
    });

    /* ---------- Profile Picture ---------- */

    function resetPhoto() {
        chosenPhoto = null;
        $("lpPhotoInput").value = "";
        $("lpPhotoName").textContent = "";
        $("lpUploadPhoto").hidden = true;
        $("lpPhotoUpload").hidden = true;
        message("lpPhotoMessage", "");
    }

    $("lpCancelPhoto").addEventListener("click", resetPhoto);

    $("lpPhotoInput").addEventListener("change", event => {
        const file = event.target.files[0];
        resetPhoto();
        if (!file) return;

        $("lpPhotoUpload").hidden = false;

        if (!PHOTO_TYPES.includes(file.type)) {
            message("lpPhotoMessage", "Please choose a JPG, PNG or WEBP image.", "error");
            return;
        }
        if (file.size > MAX_PHOTO) {
            message("lpPhotoMessage", "The photo must be 25 MB or smaller.", "error");
            return;
        }

        chosenPhoto = file;
        $("lpPhotoName").textContent = file.name;
        $("lpUploadPhoto").hidden = false;
    });

    $("lpUploadPhoto").addEventListener("click", async () => {
        if (!chosenPhoto) return;
        const button = $("lpUploadPhoto");
        button.disabled = true;
        button.textContent = "Uploading...";

        const form = new FormData();
        form.append("photo", chosenPhoto);

        try {
            const data = await api("/instructor/profile/photo", { method: "POST", body: form });
            fill(data.user);
            resetPhoto();
            message("lpProfileMessage", "Profile picture updated.", "success");
        } catch (error) {
            message("lpPhotoMessage", error.message, "error");
        } finally {
            button.disabled = false;
            button.textContent = "Upload Photo";
        }
    });

    /* ---------- Start ---------- */

    // Load once so the header shows the instructor's photo on every page.
    load();

    window.SiknayanInstructorProfile = { open, close, overlay };
})();
