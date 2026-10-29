/* =========================================================
   SIKNAYAN - LEARNER PORTAL
   MY PROFILE POP-UP (profile-modal.js)

   Same layout as the Academic Admin's profile pop-up: green cover with
   photo, Profile Picture upload, Personal Information, Account &
   Security, and Edit Profile / Change Password. Opens when the learner
   clicks their name or photo in the header. Loaded by js/portal.js.
========================================================= */

(function () {
    "use strict";

    // shared/email-change.js: the verified "Change Email" row.
    const EMAIL_CHANGE_SRC = document.currentScript
        ? new URL("../../shared/email-change.js", document.currentScript.src).href
        : "../shared/email-change.js";

    const Portal = window.Portal;
    if (!Portal) return;

    const { api, escape, setUserName } = Portal;
    const MAX_PHOTO = 25 * 1024 * 1024; // the server shrinks it
    const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
    let profile = null;
    let loading = null;
    let chosenPhoto = null;
    let lastFocus = null;

    const overlay = document.createElement("div");
    overlay.className = "lp-profile-overlay";
    overlay.id = "profileOverlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-labelledby", "lpProfileName");
    overlay.innerHTML = `
        <section class="lp-profile-modal">
            <button type="button" class="lp-profile-close" id="lpProfileClose" aria-label="Close profile">
                <i class="fa-solid fa-xmark" aria-hidden="true"></i>
            </button>

            <header class="lp-profile-cover">
                <div class="lp-photo-wrap">
                    <div class="lp-profile-photo" id="lpProfilePhoto" aria-hidden="true">
                        <i class="fa-regular fa-user"></i>
                    </div>
                    <!-- Pen on the photo: choose a new profile picture -->
                    <label class="lp-photo-edit" title="Change profile picture">
                        <i class="fa-solid fa-pen" aria-hidden="true"></i>
                        <span class="visually-hidden">Change profile picture</span>
                        <input type="file" id="lpPhotoInput" class="visually-hidden"
                            accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp">
                    </label>
                </div>
                <div>
                    <h2 id="lpProfileName">Loading...</h2>
                    <p>Mountain Province State University</p>
                    <div class="lp-profile-tags">
                        <span class="lp-profile-role">
                            <i class="fa-solid fa-user-graduate" aria-hidden="true"></i>
                            <span>Learner</span>
                        </span>
                        <!-- Program (e.g. BSIT) -->
                        <span class="lp-profile-role lp-profile-program" id="lpProgramTag" hidden>
                            <i class="fa-solid fa-graduation-cap" aria-hidden="true"></i>
                            <span id="lpProgram"></span>
                        </span>
                    </div>
                </div>
            </header>

            <!-- Shown only after choosing a picture (or for a message) -->
            <div class="lp-profile-photo-upload" id="lpPhotoStrip" hidden>
                <div class="lp-profile-photo-actions">
                    <span class="lp-photo-name" id="lpPhotoName" hidden></span>
                    <button type="button" class="lp-upload-photo" id="lpUploadPhoto" hidden>Upload Photo</button>
                    <button type="button" class="lp-cancel-photo" id="lpCancelPhoto" hidden>Cancel</button>
                </div>
                <p class="lp-message" id="lpPhotoMessage" role="status" aria-live="polite"></p>
            </div>

            <div class="lp-profile-body">
                <p class="lp-message" id="lpProfileMessage" role="status" aria-live="polite"></p>

                <form id="lpProfileForm" novalidate>
                    <h3>Personal Information</h3>
                    <div class="lp-profile-grid">
                        <div class="lp-profile-field">
                            <span class="label">School ID</span>
                            <p id="lpSchoolId">—</p>
                        </div>
                        <div class="lp-profile-field">
                            <span class="label">Email Address</span>
                            <p id="lpEmail">—</p>
                        </div>
                    </div>
                    <p class="lp-profile-note" id="lpEditNote" hidden>
                        To change your email, use “Change Email” under Account &amp; Security. Your name, school ID and program are managed by your administrator.
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
                                <button type="button" class="btn plain small" id="lpCancelPassword">Cancel</button>
                                <button type="submit" class="btn small" id="lpSavePassword">Update Password</button>
                            </div>
                        </div>
                    </form>
                </section>

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

    // There is no "Edit Profile" or big "Change Password" button: the email
    // is changed in Account & Security (verified with a code) and the
    // password with "Change" on the Password row.

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
            .map(part => part.charAt(0).toUpperCase()).join("") || "L";
    }

    /** The photo (or initials) in the header and in the pop-up cover. */
    function showPhoto(url, name) {
        const header = document.querySelector(".topbar .profile-avatar");
        [header, $("lpProfilePhoto")].forEach(element => {
            if (!element) return;
            if (url) {
                element.innerHTML = `<img src="${escape(url)}" alt="">`;
                element.querySelector("img").addEventListener("error", () => {
                    element.textContent = initials(name);
                });
            } else {
                element.textContent = initials(name);
            }
        });
    }

    function fill(user) {
        profile = user;
        $("lpProfileName").textContent = user.name;
        $("lpSchoolId").textContent = shown(user.school_id);
        $("lpEmail").textContent = shown(user.email);
        $("lpProgram").textContent = user.program || "";
        $("lpProgramTag").hidden = !user.program;
        showPhoto(user.profile_photo_url, user.name);
        setUserName(user.name);
    }

    function load() {
        loading = loading || api("/student/profile")
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
        overlay.dispatchEvent(new Event("profileclose"));
    }

    document.addEventListener("click", event => {
        const trigger = event.target.closest && event.target.closest(".topbar .profile");
        if (!trigger) return;
        event.preventDefault();
        open();
    });

    $("lpProfileClose").addEventListener("click", close);
    overlay.addEventListener("click", event => {
        if (event.target === overlay) close();
    });
    document.addEventListener("keydown", event => {
        if (event.key === "Escape" && overlay.classList.contains("open")) close();
    });

    /* ---------- Edit Profile (email in place) ---------- */

    // Smaller header and spacing while editing or changing the password,
    // so the whole card fits without a scroll bar.
    function compact() {
        const busy = !$("lpPasswordForm").hidden || !$("lpEditActions").hidden;
        overlay.querySelector(".lp-profile-modal").classList.toggle("lp-compact", busy);
    }

    function setEditing(editing) {
        $("lpEditNote").hidden = !editing;
        $("lpEditActions").hidden = !editing;
        compact();
    }

    /* ---------- Change Password (inline under the Password row) ---------- */

    function setPasswordOpen(isOpen) {
        $("lpPasswordForm").hidden = !isOpen;
        compact();
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
        // The contact number is no longer shown; keep the saved one.
        const contact = profile?.contact || "";


        $("lpSaveProfile").disabled = true;
        $("lpCancelEdit").disabled = true;
        try {
            const data = await api("/student/profile", { method: "PUT", body: { contact } });
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

    let previewUrl = null;
    let stripTimer = null;

    function photoMessage(text, type) {
        message("lpPhotoMessage", text, type);
        clearTimeout(stripTimer);
        $("lpPhotoStrip").hidden = !text && !chosenPhoto;
    }

    function resetPhoto() {
        chosenPhoto = null;
        $("lpPhotoInput").value = "";
        $("lpPhotoName").textContent = "";
        $("lpUploadPhoto").hidden = true;
        $("lpCancelPhoto").hidden = true;
        if (previewUrl) {
            URL.revokeObjectURL(previewUrl);
            previewUrl = null;
            // Back to the saved photo.
            showPhoto(profile?.profile_photo_url, profile?.name);
        }
        photoMessage("");
    }

    $("lpPhotoInput").addEventListener("change", event => {
        const file = event.target.files[0];
        resetPhoto();
        if (!file) return;

        if (!PHOTO_TYPES.includes(file.type)) {
            photoMessage("Please choose a JPG, PNG or WEBP image.", "error");
            return;
        }
        if (file.size > MAX_PHOTO) {
            photoMessage("The photo must be 25 MB or smaller.", "error");
            return;
        }

        chosenPhoto = file;

        // Preview the new picture in the photo circle until it is uploaded.
        previewUrl = URL.createObjectURL(file);
        $("lpProfilePhoto").innerHTML = `<img src="${previewUrl}" alt="">`;

        $("lpPhotoName").textContent = file.name;
        $("lpUploadPhoto").hidden = false;
        $("lpCancelPhoto").hidden = false;
        photoMessage("");
    });

    $("lpCancelPhoto").addEventListener("click", resetPhoto);

    $("lpUploadPhoto").addEventListener("click", async () => {
        if (!chosenPhoto) return;
        const button = $("lpUploadPhoto");
        button.disabled = true;
        button.textContent = "Uploading...";

        const form = new FormData();
        form.append("photo", chosenPhoto);

        try {
            const data = await api("/student/profile/photo", { method: "POST", body: form });
            if (previewUrl) {
                URL.revokeObjectURL(previewUrl);
                previewUrl = null;
            }
            fill(data.user);
            resetPhoto();
            photoMessage("Profile picture updated.", "success");
            stripTimer = setTimeout(() => photoMessage(""), 4000);
        } catch (error) {
            photoMessage(error.message, "error");
        } finally {
            button.disabled = false;
            button.textContent = "Upload Photo";
        }
    });

    /* ---------- Start ---------- */

    // Load once so the header shows the learner's photo on every page.
    load();

    Portal.openProfile = open;
    Portal.profileOverlay = overlay;

    // The old profile.html opens the pop-up straight away.
    if (document.body.dataset.page === "profile") open();
})();
