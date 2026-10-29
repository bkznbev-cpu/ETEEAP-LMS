(function initializeAcademicAdministrators(window, document) {
    "use strict";

    const API_ROOT = window.SIKNAYAN_API_ROOT;
    const tableBody = document.getElementById("administratorsTableBody");
    const countLabel = document.querySelector(".administrator-count");
    const searchInput = document.getElementById("administratorSearch");
    const statusMessage = document.getElementById("administratorStatusMessage");
    const createButton = document.getElementById("createAdministratorButton");
    const form = document.getElementById("administratorForm");
    const modalOverlay = document.getElementById("administratorModalOverlay");
    const viewOverlay = document.getElementById("viewAdministratorModalOverlay");
    const deleteOverlay = document.getElementById("deleteAdministratorModalOverlay");
    const idInput = document.getElementById("administratorId");
    const schoolIdInput = document.getElementById("administratorSchoolId");
    const firstNameInput = document.getElementById("administratorFirstName");
    const lastNameInput = document.getElementById("administratorLastName");
    const emailInput = document.getElementById("administratorEmail");
    const photoInput = document.getElementById("administratorPhoto");
    const passwordInput = document.getElementById("administratorPassword");
    const confirmPasswordInput = document.getElementById("administratorConfirmPassword");
    const statusInput = document.getElementById("administratorStatus");
    const saveButton = document.getElementById("saveAdministratorButton");
    const saveButtonText = document.getElementById("saveAdministratorButtonText");
    const pendingDeleteName = document.getElementById("deleteAdministratorName");
    const pendingDeleteEmail = document.getElementById("deleteAdministratorEmail");
    const deleteButton = document.getElementById("confirmDeleteAdministratorButton");
    const generatePasswordInput = document.getElementById("generatePassword");
    const generatePasswordGroup = document.getElementById("generatePasswordGroup");
    const typedPasswordFields = document.getElementById("typedPasswordFields");
    const resetOverlay = document.getElementById("resetPasswordModalOverlay");
    const resetButton = document.getElementById("confirmResetPasswordButton");
    const temporaryOverlay = document.getElementById("temporaryPasswordModalOverlay");
    const temporaryValue = document.getElementById("temporaryPasswordValue");
    const copyTemporaryButton = document.getElementById("copyTemporaryPasswordButton");

    let administrators = [];
    let pendingDeleteAdministrator = null;
    let pendingResetAdministrator = null;
    let requestInProgress = false;
    let removeExistingPhoto = false;
    let previousFocus = null;

    function getToken() {
        return sessionStorage.getItem("authToken")
            || localStorage.getItem("siknayan_api_token");
    }

    async function apiRequest(path, options = {}) {
        if (!API_ROOT || !getToken()) {
            throw new Error("System Admin authentication is unavailable. Sign in again.");
        }

        const headers = new Headers(options.headers || {});
        headers.set("Accept", "application/json");
        headers.set("Authorization", `Bearer ${getToken()}`);
        if (!(options.body instanceof FormData)) {
            headers.set("Content-Type", "application/json");
        }

        const response = await fetch(`${API_ROOT}${path}`, {
            ...options,
            headers
        });
        const payload = await response.json().catch(() => ({}));

        if (response.status === 401 || response.status === 403) {
            window.location.replace("../index.html");
            throw new Error("Your System Admin session is no longer authorized.");
        }

        if (!response.ok) {
            const validationMessage = payload.errors
                ? Object.values(payload.errors).flat().join(" ")
                : "";
            throw new Error(
                validationMessage || payload.message || `Request failed (${response.status}).`
            );
        }

        return payload;
    }

    function setMessage(message, type = "success") {
        if (!statusMessage) return;
        statusMessage.textContent = message;
        statusMessage.dataset.type = type;
        statusMessage.hidden = !message;
    }

    function escapeHtml(value) {
        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function initials(name) {
        return String(name || "—")
            .trim()
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 2)
            .map(part => part[0])
            .join("")
            .toUpperCase();
    }

    function formatDate(value) {
        if (!value) return "—";
        const date = new Date(value);
        return Number.isNaN(date.getTime())
            ? "—"
            : date.toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric"
            });
    }

    function renderAdministrators() {
        if (!tableBody) return;
        const query = searchInput?.value.trim().toLowerCase() || "";
        const filtered = administrators.filter(item =>
            [item.name, item.school_id, item.email]
                .some(value => String(value || "").toLowerCase().includes(query))
        );

        if (countLabel) {
            countLabel.textContent = `Showing ${filtered.length} administrator${filtered.length === 1 ? "" : "s"}`;
        }

        if (filtered.length === 0) {
            tableBody.innerHTML = `
                <tr class="empty-row">
                    <td colspan="5">
                        <div class="empty-state">
                            <i data-lucide="users"></i>
                            <strong>No academic administrators</strong>
                            <span>${query ? "No administrators match your search." : "Create an administrator account to get started."}</span>
                        </div>
                    </td>
                </tr>`;
            window.refreshIcons?.();
            return;
        }

        tableBody.innerHTML = filtered.map(item => `
            <tr>
                <td>${escapeHtml(item.name)}</td>
                <td>${escapeHtml(item.school_id)}</td>
                <td>${escapeHtml(item.email || "—")}</td>
                <td>
                    <span class="status-badge ${item.is_active ? "active" : "inactive"}">
                        ${item.is_active ? "Active" : "Inactive"}
                    </span>
                </td>
                <td>
                    <div class="action-buttons">
                        <button type="button" class="table-action" data-action="view" data-id="${item.id}" aria-label="View ${escapeHtml(item.name)}">
                            <i data-lucide="eye"></i><span>View</span>
                        </button>
                        <button type="button" class="table-action" data-action="edit" data-id="${item.id}" aria-label="Edit ${escapeHtml(item.name)}">
                            <i data-lucide="pencil"></i><span>Edit</span>
                        </button>
                        <button type="button" class="table-action" data-action="toggle" data-id="${item.id}" aria-label="${item.is_active ? "Deactivate" : "Activate"} ${escapeHtml(item.name)}">
                            <i data-lucide="${item.is_active ? "user-round-x" : "user-round-check"}"></i>
                            <span>${item.is_active ? "Deactivate" : "Activate"}</span>
                        </button>
                        <button type="button" class="table-action delete icon-only" data-action="delete" data-id="${item.id}" aria-label="Delete ${escapeHtml(item.name)}" title="Delete">
                            <i data-lucide="trash-2"></i>
                        </button>
                    </div>
                </td>
            </tr>`).join("");
        window.refreshIcons?.();
    }

    async function loadAdministrators() {
        setMessage("Loading Academic Admin accounts...", "loading");
        try {
            const payload = await apiRequest("/system-admin/academic-administrators");
            if (!payload.success || !Array.isArray(payload.administrators)) {
                throw new Error("The server returned an invalid account list.");
            }
            administrators = payload.administrators;
            renderAdministrators();
            setMessage("");
        } catch (error) {
            console.error("Unable to load Academic Admin accounts:", error);
            administrators = [];
            renderAdministrators();
            setMessage(error.message || "Unable to load Academic Admin accounts.", "error");
        }
    }

    function openModal(overlay, focusTarget) {
        previousFocus = document.activeElement;
        overlay.hidden = false;
        focusTarget?.focus();
    }

    function closeModal(overlay) {
        if (overlay) overlay.hidden = true;
        previousFocus?.focus?.();
    }

    function getPhotoPreview() {
        let preview = document.getElementById("administratorPhotoPreview");
        if (!preview && photoInput?.parentElement) {
            preview = document.createElement("div");
            preview.id = "administratorPhotoPreview";
            preview.style.cssText = "display:flex;align-items:center;gap:12px;margin-top:10px";
            photoInput.parentElement.appendChild(preview);
        }
        return preview;
    }

    function renderPhotoPreview(url, editing) {
        const preview = getPhotoPreview();
        if (!preview) return;
        preview.replaceChildren();
        if (!url) return;

        const image = document.createElement("img");
        image.src = url;
        image.alt = "Academic Admin profile photo";
        image.style.cssText = "width:52px;height:52px;object-fit:cover;border-radius:50%;border:2px solid var(--green)";
        preview.appendChild(image);

        const label = document.createElement("span");
        label.textContent = editing ? "Current profile photo" : "Selected profile photo";
        preview.appendChild(label);

        if (editing) {
            const remove = document.createElement("button");
            remove.type = "button";
            remove.className = "secondary-button";
            remove.textContent = "Remove Photo";
            remove.addEventListener("click", () => {
                removeExistingPhoto = true;
                preview.replaceChildren();
            }, { once: true });
            preview.appendChild(remove);
        }
    }

    // Create form: either the server generates the temporary password
    // (default) or the System Admin types one.
    function syncPasswordMode() {
        const creating = !idInput.value;
        const generate = generatePasswordInput ? generatePasswordInput.checked : false;

        if (generatePasswordGroup) generatePasswordGroup.hidden = !creating;
        if (typedPasswordFields) typedPasswordFields.hidden = !creating || generate;

        // Status and photo are set when creating; when editing, the table's
        // Activate / Deactivate changes the status and Reset Password is here.
        const photoGroup = document.getElementById("administratorPhotoGroup");
        const statusGroup = document.getElementById("administratorStatusGroup");
        const resetGroup = document.getElementById("administratorResetGroup");
        if (photoGroup) photoGroup.hidden = !creating;
        if (statusGroup) statusGroup.hidden = !creating;
        if (resetGroup) resetGroup.hidden = creating;

        const typed = creating && !generate;
        passwordInput.required = typed;
        confirmPasswordInput.required = typed;
        if (!typed) {
            passwordInput.value = "";
            confirmPasswordInput.value = "";
        }
    }

    function openCreateModal() {
        form.reset();
        idInput.value = "";
        removeExistingPhoto = false;
        document.getElementById("administratorSchoolId").readOnly = false;
        photoInput.value = "";
        renderPhotoPreview(null, false);
        statusInput.value = "active";
        if (generatePasswordInput) generatePasswordInput.checked = true;
        syncPasswordMode();
        document.getElementById("administratorModalTitle").textContent = "Create Academic Administrator";
        document.getElementById("administratorModalDescription").textContent = "Enter the account details below.";
        document.getElementById("passwordHint").textContent = "Minimum of 8 characters. They must change it at first login.";
        saveButtonText.textContent = "Create Account";
        openModal(modalOverlay, schoolIdInput);
    }

    let editingAdministrator = null;

    function openEditModal(administrator) {
        editingAdministrator = administrator;
        form.reset();
        idInput.value = administrator.id;
        const nameParts = String(administrator.name || "").trim().split(/\s+/);
        lastNameInput.value = nameParts.length > 1 ? nameParts.pop() : "";
        firstNameInput.value = nameParts.join(" ");
        schoolIdInput.value = administrator.school_id || "";
        schoolIdInput.readOnly = true;
        emailInput.value = administrator.email || "";
        statusInput.value = administrator.is_active ? "active" : "inactive";
        removeExistingPhoto = false;
        photoInput.value = "";
        // Passwords aren't edited here; use Reset Password in the table.
        syncPasswordMode();
        document.getElementById("administratorModalTitle").textContent = "Edit Academic Administrator";
        document.getElementById("administratorModalDescription").textContent = "Update the account details below. To give a new password, use Reset Password.";
        window.refreshIcons?.();
        saveButtonText.textContent = "Save Changes";
        renderPhotoPreview(administrator.profile_photo_url, true);
        openModal(modalOverlay, firstNameInput);
    }

    function closeEditModal() {
        modalOverlay.hidden = true;
        form.reset();
        idInput.value = "";
        schoolIdInput.readOnly = false;
        passwordInput.required = false;
        confirmPasswordInput.required = false;
        removeExistingPhoto = false;
        renderPhotoPreview(null, false);
        previousFocus?.focus?.();
    }

    function requestBody() {
        const data = new FormData();
        const name = `${firstNameInput.value.trim()} ${lastNameInput.value.trim()}`.trim();
        data.append("name", name);
        data.append("email", emailInput.value.trim().toLowerCase());
        data.append("is_active", statusInput.value === "active" ? "1" : "0");
        if (photoInput.files[0]) data.append("profile_photo", photoInput.files[0]);
        if (removeExistingPhoto) data.append("remove_profile_photo", "1");

        if (!idInput.value) {
            data.append("school_id", schoolIdInput.value.trim());

            // Leaving the password out asks the server to generate one.
            if (!generatePasswordInput?.checked) {
                data.append("password", passwordInput.value);
                data.append("password_confirmation", confirmPasswordInput.value);
            }
        }
        return data;
    }

    async function saveAdministrator(event) {
        event.preventDefault();
        if (requestInProgress) return;

        const typingPassword = !idInput.value && !generatePasswordInput?.checked;

        if (typingPassword && passwordInput.value !== confirmPasswordInput.value) {
            setMessage("Passwords do not match.", "error");
            return;
        }

        requestInProgress = true;
        saveButton.disabled = true;
        try {
            const editing = Boolean(idInput.value);
            const path = editing
                ? `/system-admin/academic-administrators/${encodeURIComponent(idInput.value)}`
                : "/system-admin/academic-administrators";
            const body = requestBody();
            if (editing) body.append("_method", "PUT");
            const payload = await apiRequest(path, {
                method: "POST",
                body
            });
            if (!payload.success) throw new Error("The account change was not confirmed.");
            closeEditModal();
            await loadAdministrators();
            setMessage(editing ? "Academic Admin account updated." : "Academic Admin account created.");

            if (!editing && payload.temporary_password) {
                showTemporaryPassword(
                    payload.administrator,
                    payload.temporary_password,
                    "Account created. Give this temporary password to the new Academic Admin."
                );
            }
        } catch (error) {
            setMessage(error.message || "Unable to save the account.", "error");
        } finally {
            requestInProgress = false;
            saveButton.disabled = false;
        }
    }

    function openViewModal(administrator) {
        document.getElementById("viewAdministratorName").textContent = administrator.name || "—";
        document.getElementById("viewAdministratorStatus").textContent = administrator.is_active ? "Active" : "Inactive";
        document.getElementById("viewAdministratorUsername").textContent = administrator.school_id || "—";
        document.getElementById("viewAdministratorEmail").textContent = administrator.email || "—";
        document.getElementById("viewAdministratorCreated").textContent = formatDate(administrator.created_at);
        document.getElementById("viewAdministratorUpdated").textContent = formatDate(administrator.updated_at);
        const photo = document.getElementById("viewAdministratorPhoto");
        const initialsElement = document.getElementById("viewAdministratorInitials");
        photo.onerror = () => {
            photo.hidden = true;
            initialsElement.hidden = false;
            initialsElement.textContent = initials(administrator.name);
        };
        if (administrator.profile_photo_url) {
            photo.src = administrator.profile_photo_url;
            photo.alt = `${administrator.name} profile photo`;
            photo.hidden = false;
            initialsElement.hidden = true;
        } else {
            photo.removeAttribute("src");
            photo.hidden = true;
            initialsElement.textContent = initials(administrator.name);
            initialsElement.hidden = false;
        }
        openModal(viewOverlay, document.getElementById("closeViewAdministratorButton"));
    }

    function openDeleteModal(administrator) {
        pendingDeleteAdministrator = administrator;
        pendingDeleteName.textContent = administrator.name || "—";
        pendingDeleteEmail.textContent = administrator.email || administrator.school_id || "—";
        openModal(deleteOverlay, document.getElementById("cancelDeleteAdministratorButton"));
    }

    async function deleteAdministrator() {
        if (!pendingDeleteAdministrator || requestInProgress) return;
        requestInProgress = true;
        deleteButton.disabled = true;
        try {
            await apiRequest(
                `/system-admin/academic-administrators/${encodeURIComponent(pendingDeleteAdministrator.id)}`,
                { method: "DELETE" }
            );
            deleteOverlay.hidden = true;
            pendingDeleteAdministrator = null;
            await loadAdministrators();
            setMessage("Academic Admin account deleted.");
        } catch (error) {
            setMessage(error.message || "Unable to delete the account.", "error");
        } finally {
            requestInProgress = false;
            deleteButton.disabled = false;
        }
    }

    /* Reset password: confirm, then show the new temporary password once. */

    function openResetModal(administrator) {
        pendingResetAdministrator = administrator;
        document.getElementById("resetPasswordName").textContent = administrator.name || "—";
        document.getElementById("resetPasswordSchoolId").textContent = administrator.school_id || "—";
        openModal(resetOverlay, document.getElementById("cancelResetPasswordButton"));
    }

    function closeResetModal() {
        pendingResetAdministrator = null;
        closeModal(resetOverlay);
    }

    async function resetPassword() {
        if (!pendingResetAdministrator || requestInProgress) return;
        const administrator = pendingResetAdministrator;
        requestInProgress = true;
        resetButton.disabled = true;
        try {
            const payload = await apiRequest(
                `/system-admin/academic-administrators/${encodeURIComponent(administrator.id)}/reset-password`,
                { method: "POST" }
            );
            if (!payload.success || !payload.temporary_password) {
                throw new Error("The password reset was not confirmed.");
            }
            resetOverlay.hidden = true;
            pendingResetAdministrator = null;
            await loadAdministrators();
            setMessage(`Password reset for ${administrator.name}.`);
            showTemporaryPassword(
                payload.administrator || administrator,
                payload.temporary_password,
                `New temporary password for ${administrator.name}. Their old password no longer works.`
            );
        } catch (error) {
            setMessage(error.message || "Unable to reset the password.", "error");
        } finally {
            requestInProgress = false;
            resetButton.disabled = false;
        }
    }

    function showTemporaryPassword(administrator, password, intro) {
        document.getElementById("temporaryPasswordIntro").textContent = intro;
        document.getElementById("temporaryPasswordSchoolId").textContent = administrator?.school_id || "—";
        temporaryValue.value = password;
        copyTemporaryButton.querySelector("span").textContent = "Copy";
        previousFocus = document.activeElement;
        temporaryOverlay.hidden = false;
        temporaryValue.focus();
        temporaryValue.select();
        window.refreshIcons?.();
    }

    function closeTemporaryPassword() {
        // Clear it from the page so it isn't left on screen.
        temporaryValue.value = "";
        closeModal(temporaryOverlay);
    }

    async function copyTemporaryPassword() {
        const label = copyTemporaryButton.querySelector("span");
        try {
            await navigator.clipboard.writeText(temporaryValue.value);
            label.textContent = "Copied";
        } catch (error) {
            // Clipboard blocked: leave it selected so Ctrl+C works.
            temporaryValue.focus();
            temporaryValue.select();
            label.textContent = "Press Ctrl+C";
        }
    }

    async function toggleStatus(administrator) {
        if (requestInProgress) return;
        requestInProgress = true;
        try {
            await apiRequest(
                `/system-admin/academic-administrators/${encodeURIComponent(administrator.id)}`,
                {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ is_active: !administrator.is_active })
                }
            );
            await loadAdministrators();
            setMessage(administrator.is_active ? "Academic Admin account deactivated." : "Academic Admin account activated.");
        } catch (error) {
            setMessage(error.message || "Unable to update account status.", "error");
        } finally {
            requestInProgress = false;
        }
    }

    createButton?.addEventListener("click", openCreateModal);
    form?.addEventListener("submit", saveAdministrator);
    searchInput?.addEventListener("input", renderAdministrators);
    photoInput?.addEventListener("change", () => {
        const file = photoInput.files[0];
        if (!file) return;
        if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 25 * 1024 * 1024) {
            photoInput.value = "";
            setMessage("Choose a JPG, PNG or WEBP photo of 25 MB or smaller.", "error");
            return;
        }
        removeExistingPhoto = false;
        renderPhotoPreview(URL.createObjectURL(file), Boolean(idInput.value));
    });

    tableBody?.addEventListener("click", event => {
        const button = event.target.closest("[data-action]");
        if (!button || requestInProgress) return;
        const administrator = administrators.find(item => String(item.id) === button.dataset.id);
        if (!administrator) return;

        switch (button.dataset.action) {
            case "view":
                openViewModal(administrator);
                break;
            case "edit":
                openEditModal(administrator);
                break;
            case "reset":
                openResetModal(administrator);
                break;
            case "toggle":
                void toggleStatus(administrator);
                break;
            case "delete":
                openDeleteModal(administrator);
                break;
        }
    });

    document.getElementById("editResetPasswordButton")?.addEventListener("click", () => {
        const administrator = editingAdministrator;
        if (!administrator || requestInProgress) return;
        closeEditModal();
        openResetModal(administrator);
    });

    document.getElementById("closeAdministratorModal")?.addEventListener("click", closeEditModal);
    document.getElementById("cancelAdministratorButton")?.addEventListener("click", closeEditModal);
    document.getElementById("closeViewAdministratorModal")?.addEventListener("click", () => closeModal(viewOverlay));
    document.getElementById("closeViewAdministratorButton")?.addEventListener("click", () => closeModal(viewOverlay));
    document.getElementById("closeDeleteAdministratorModal")?.addEventListener("click", () => {
        pendingDeleteAdministrator = null;
        closeModal(deleteOverlay);
    });
    document.getElementById("cancelDeleteAdministratorButton")?.addEventListener("click", () => {
        pendingDeleteAdministrator = null;
        closeModal(deleteOverlay);
    });
    deleteButton?.addEventListener("click", () => void deleteAdministrator());
    generatePasswordInput?.addEventListener("change", syncPasswordMode);
    document.getElementById("closeResetPasswordModal")?.addEventListener("click", closeResetModal);
    document.getElementById("cancelResetPasswordButton")?.addEventListener("click", closeResetModal);
    resetButton?.addEventListener("click", () => void resetPassword());
    copyTemporaryButton?.addEventListener("click", () => void copyTemporaryPassword());
    document.getElementById("closeTemporaryPasswordButton")?.addEventListener("click", closeTemporaryPassword);

    document.addEventListener("keydown", event => {
        if (event.key !== "Escape") return;
        // The temporary password dialog closes only with Done, so it
        // isn't dismissed by accident before it's been copied.
        if (!temporaryOverlay.hidden) return;
        if (!resetOverlay.hidden) {
            closeResetModal();
            return;
        }
        if (!modalOverlay.hidden) closeEditModal();
        else if (!viewOverlay.hidden) closeModal(viewOverlay);
        else if (!deleteOverlay.hidden) {
            pendingDeleteAdministrator = null;
            closeModal(deleteOverlay);
        }
    });

    void loadAdministrators();
})(window, document);
