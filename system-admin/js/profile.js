/* =========================================================
   SIKNAYAN - SYSTEM ADMINISTRATOR PROFILE
   Profile changes are saved to the server
   (POST /api/system-admin/profile); passwords are changed with
   PUT /api/account/password.
========================================================= */

const editProfileButton = document.getElementById("editProfileButton");
const profileEditForm = document.getElementById("profileEditForm");
const cancelProfileEditButton = document.getElementById("cancelProfileEditButton");
const profileFullNameInput = document.getElementById("profileFullNameInput");
const profileUsernameInput = document.getElementById("profileUsernameInput");
const profileEmailInput = document.getElementById("profileEmailInput");
const profileDetails = document.getElementById("profileDetails");
const profileDisplayName = document.getElementById("profileDisplayName");
const profileDisplayUsername = document.getElementById("profileDisplayUsername");
const profileDisplayEmail = document.getElementById("profileDisplayEmail");
const profilePageAvatar = document.getElementById("profilePageAvatar");
const profilePhotoInput = document.getElementById("profilePhotoInput");
const chooseProfilePhotoButton = document.getElementById("chooseProfilePhotoButton");
const profileEditStatus = document.getElementById("profileEditStatus");
const passwordChangeForm = document.getElementById("passwordChangeForm");
const passwordFormStatus = document.getElementById("passwordFormStatus");

const MIN_NEW_PASSWORD_LENGTH = 15;

let currentProfile = window.getSiknayanSystemAdminProfile
    ? window.getSiknayanSystemAdminProfile()
    : { fullName: "System Administrator", username: "", email: "", photo: "" };
let pendingPhotoFile = null;
let pendingPhotoPreview = "";
let editingProfile = false;

function showProfileStatus(element, message, type = "info") {
    if (!element) return;
    element.textContent = message;
    element.dataset.status = type;
    element.hidden = false;
}

function clearProfileStatus(element) {
    if (!element) return;
    element.textContent = "";
    element.hidden = true;
    delete element.dataset.status;
}

function getApiToken() {
    try {
        return sessionStorage.getItem("authToken") ||
            localStorage.getItem("siknayan_api_token") ||
            "";
    } catch (error) {
        return "";
    }
}

// Sends a request and returns the JSON body; throws with the server's
// first validation message when the request is refused.
async function profileApi(path, options = {}) {
    const response = await fetch(`${window.SIKNAYAN_API_ROOT}${path}`, {
        ...options,
        headers: {
            Accept: "application/json",
            Authorization: `Bearer ${getApiToken()}`,
            ...(options.headers || {})
        }
    });

    if (response.status === 401) {
        window.location.replace("../index.html");
        throw new Error("Your session has ended. Please log in again.");
    }

    const data = await response.json().catch(() => null);

    if (!response.ok || !data || data.success === false) {
        const firstError = data?.errors
            ? Object.values(data.errors)[0]?.[0]
            : null;
        throw new Error(firstError || data?.message || `The server returned an error (${response.status}).`);
    }

    return data;
}

function safeApplyProfile(profile) {
    if (typeof window.applySiknayanSystemAdminProfile === "function") {
        window.applySiknayanSystemAdminProfile(profile);
    }
    if (profileDisplayName) {
        profileDisplayName.textContent = profile.fullName || "System Administrator";
    }
    if (profileDisplayUsername) {
        profileDisplayUsername.textContent = profile.username || "—";
    }
    if (profileDisplayEmail) {
        profileDisplayEmail.textContent = profile.email || "Not set";
    }
    if (profileUsernameInput) {
        profileUsernameInput.value = profile.username || "";
    }
    if (profilePageAvatar) {
        profilePageAvatar.src = profile.photo || profilePageAvatar.dataset.defaultSrc || "../images/macross.jpg";
    }
}

function setEditMode(enabled) {
    editingProfile = enabled;
    if (profileEditForm) profileEditForm.hidden = !enabled;
    if (profileDetails) profileDetails.hidden = enabled;
    if (editProfileButton) editProfileButton.hidden = enabled;
    if (chooseProfilePhotoButton) chooseProfilePhotoButton.hidden = !enabled;

    if (enabled) {
        profileFullNameInput.value = currentProfile.fullName || "";
        profileEmailInput.value = currentProfile.email || "";
        if (profileUsernameInput) profileUsernameInput.value = currentProfile.username || "";
        pendingPhotoFile = null;
        pendingPhotoPreview = "";
        clearProfileStatus(profileEditStatus);
        profileFullNameInput.focus();
    }
}

safeApplyProfile(currentProfile);

// The header script loads the real profile; show it when it arrives,
// unless the form is open (don't overwrite what's being typed).
window.addEventListener("siknayan:profile-updated", (event) => {
    currentProfile = event.detail;
    if (!editingProfile) {
        safeApplyProfile(currentProfile);
    }
});

window.SIKNAYAN_SYSTEM_ADMIN_PROFILE_READY?.catch((error) => {
    showProfileStatus(profileEditStatus, `Unable to load your profile: ${error.message}`, "error");
});

if (editProfileButton) {
    editProfileButton.addEventListener("click", () => setEditMode(true));
}

if (cancelProfileEditButton) {
    cancelProfileEditButton.addEventListener("click", () => {
        profileEditForm.reset();
        pendingPhotoFile = null;
        pendingPhotoPreview = "";
        if (profilePhotoInput) profilePhotoInput.value = "";
        safeApplyProfile(currentProfile);
        setEditMode(false);
        clearProfileStatus(profileEditStatus);
    });
}

if (chooseProfilePhotoButton && profilePhotoInput) {
    chooseProfilePhotoButton.addEventListener("click", () => profilePhotoInput.click());
}

if (profilePhotoInput && profilePageAvatar) {
    profilePhotoInput.addEventListener("change", () => {
        const file = profilePhotoInput.files && profilePhotoInput.files[0];
        if (!file) return;

        const acceptedTypes = ["image/jpeg", "image/png", "image/webp"];

        if (!acceptedTypes.includes(file.type)) {
            showProfileStatus(profileEditStatus, "Choose a JPG, PNG, or WebP image.", "error");
            profilePhotoInput.value = "";
            return;
        }

        if (file.size > 25 * 1024 * 1024) {
            showProfileStatus(profileEditStatus, "The photo must be 25 MB or smaller.", "error");
            profilePhotoInput.value = "";
            return;
        }

        pendingPhotoFile = file;

        const reader = new FileReader();
        reader.addEventListener("load", () => {
            pendingPhotoPreview = String(reader.result || "");
            profilePageAvatar.src = pendingPhotoPreview;
            showProfileStatus(profileEditStatus, "Photo selected. Choose Save Changes to keep it.", "info");
        });
        reader.addEventListener("error", () => {
            showProfileStatus(profileEditStatus, "The selected image could not be read.", "error");
        });
        reader.readAsDataURL(file);
    });
}

if (profileEditForm) {
    profileEditForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        clearProfileStatus(profileEditStatus);

        const fullName = profileFullNameInput.value.trim();
        const email = profileEmailInput.value.trim();

        if (!fullName) {
            profileFullNameInput.setCustomValidity("Enter your full name.");
            profileFullNameInput.reportValidity();
            profileFullNameInput.setCustomValidity("");
            return;
        }

        if (!profileEditForm.reportValidity()) return;

        const body = new FormData();
        body.append("name", fullName);
        body.append("email", email);
        if (pendingPhotoFile) body.append("photo", pendingPhotoFile);

        const submitButton = profileEditForm.querySelector('[type="submit"]');
        if (submitButton) submitButton.disabled = true;
        showProfileStatus(profileEditStatus, "Saving...", "info");

        try {
            const data = await profileApi("/system-admin/profile", {
                method: "POST",
                body
            });

            currentProfile = window.toSiknayanSystemAdminProfile
                ? window.toSiknayanSystemAdminProfile(data.profile)
                : currentProfile;

            pendingPhotoFile = null;
            pendingPhotoPreview = "";
            if (profilePhotoInput) profilePhotoInput.value = "";

            setEditMode(false);

            if (window.setSiknayanSystemAdminProfile) {
                window.setSiknayanSystemAdminProfile(currentProfile);
            }
            safeApplyProfile(currentProfile);

            showProfileStatus(profileEditStatus, "Profile saved.", "success");
        } catch (error) {
            showProfileStatus(profileEditStatus, `Couldn't save your profile: ${error.message}`, "error");
        } finally {
            if (submitButton) submitButton.disabled = false;
        }
    });
}

/* Password visibility toggles */
document.querySelectorAll("[data-password-toggle]").forEach((button) => {
    button.addEventListener("click", () => {
        const input = document.getElementById(button.dataset.passwordToggle);
        if (!input) return;
        const reveal = input.type === "password";
        input.type = reveal ? "text" : "password";
        button.setAttribute("aria-label", `${reveal ? "Hide" : "Show"} ${input.labels?.[0]?.textContent?.toLowerCase() || "password"}`);
        button.title = reveal ? "Hide password" : "Show password";
        button.innerHTML = `<i data-lucide="${reveal ? "eye-off" : "eye"}"></i>`;
        if (typeof refreshIcons === "function") refreshIcons();
    });
});

if (passwordChangeForm) {
    passwordChangeForm.addEventListener("reset", () => {
        window.setTimeout(() => {
            document.querySelectorAll("[data-password-toggle]").forEach((button) => {
                const input = document.getElementById(button.dataset.passwordToggle);
                if (input) input.type = "password";
                button.title = "Show password";
                button.innerHTML = '<i data-lucide="eye"></i>';
            });
            clearProfileStatus(passwordFormStatus);
            if (typeof refreshIcons === "function") refreshIcons();
        }, 0);
    });

    passwordChangeForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        clearProfileStatus(passwordFormStatus);

        const currentPassword = document.getElementById("currentPassword").value;
        const newPassword = document.getElementById("newPassword").value;
        const confirmNewPassword = document.getElementById("confirmNewPassword").value;

        if (!currentPassword || !newPassword || !confirmNewPassword) {
            showProfileStatus(passwordFormStatus, "Complete all password fields.", "error");
            return;
        }

        if (Array.from(newPassword).length < MIN_NEW_PASSWORD_LENGTH) {
            showProfileStatus(passwordFormStatus, `Use at least ${MIN_NEW_PASSWORD_LENGTH} characters. Long passphrases and spaces are allowed.`, "error");
            return;
        }

        if (newPassword !== confirmNewPassword) {
            showProfileStatus(passwordFormStatus, "The new password and confirmation do not match.", "error");
            return;
        }

        if (newPassword === currentPassword) {
            showProfileStatus(passwordFormStatus, "The new password must be different from the current one.", "error");
            return;
        }

        const submitButton = passwordChangeForm.querySelector('[type="submit"]');
        if (submitButton) submitButton.disabled = true;
        showProfileStatus(passwordFormStatus, "Changing password...", "info");

        try {
            await profileApi("/account/password", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    current_password: currentPassword,
                    password: newPassword,
                    password_confirmation: confirmNewPassword
                })
            });

            passwordChangeForm.reset();
            // reset clears the status shortly after; show success after that.
            window.setTimeout(() => {
                showProfileStatus(passwordFormStatus, "Password changed. Your other sessions were logged out.", "success");
            }, 10);
        } catch (error) {
            showProfileStatus(passwordFormStatus, error.message, "error");
        } finally {
            if (submitButton) submitButton.disabled = false;
        }
    });
}

if (typeof refreshIcons === "function") refreshIcons();
