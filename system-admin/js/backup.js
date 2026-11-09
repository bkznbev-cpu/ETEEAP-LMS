/* =========================================================
   SIKNAYAN - SYSTEM ADMIN
   DATA BACKUP (backup.js)

   Make a backup (database + uploaded files in one zip, optionally
   password-protected), list saved backups, download or delete them.
   API: /api/system-admin/backups (System Admin only).
========================================================= */

(function () {
    "use strict";

    const $ = id => document.getElementById(id);
    if (!$("backupForm")) return;

    function token() {
        return sessionStorage.getItem("authToken") ||
            localStorage.getItem("siknayan_api_token") || "";
    }

    function escapeHtml(value) {
        return String(value ?? "").replace(/[&<>"']/g, character => ({
            "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
        }[character]));
    }

    async function api(path, options = {}) {
        const headers = { Accept: "application/json", Authorization: `Bearer ${token()}` };
        if (options.body) headers["Content-Type"] = "application/json";

        let response;
        try {
            response = await fetch(`${window.SIKNAYAN_API_ROOT}/system-admin${path}`, {
                method: options.method || "GET",
                headers,
                // A file upload sends FormData (the browser sets its type).
                body: options.form || (options.body ? JSON.stringify(options.body) : undefined)
            });
        } catch (error) {
            throw new Error("Cannot reach the server. Check that the backend is running.");
        }

        if (response.status === 401 || response.status === 403) {
            if (typeof redirectToLogin === "function") redirectToLogin();
            throw new Error("Your session has ended. Please log in again.");
        }

        if (options.raw) {
            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                throw new Error(data.message || "The backup could not be downloaded.");
            }
            return response;
        }

        const data = await response.json().catch(() => ({}));

        if (!response.ok || data.success === false) {
            const firstError = data.errors && Object.values(data.errors)[0];
            throw new Error((Array.isArray(firstError) ? firstError[0] : firstError) || data.message || "Something went wrong.");
        }

        return data;
    }

    function size(bytes) {
        const value = Number(bytes) || 0;
        if (value >= 1024 * 1024 * 1024) return `${(value / 1024 / 1024 / 1024).toFixed(2)} GB`;
        if (value >= 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} MB`;
        return `${Math.max(1, Math.round(value / 1024))} KB`;
    }

    function when(value) {
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return { day: "—", time: "" };
        return {
            day: date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }),
            time: date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
        };
    }

    // "5 minutes", "3 hours", "2 days" since the given time.
    function age(value) {
        const minutes = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60000));
        if (!Number.isFinite(minutes)) return "unknown time";
        if (minutes < 60) return minutes <= 1 ? "1 minute" : `${minutes} minutes`;
        const hours = Math.round(minutes / 60);
        if (hours < 24) return hours === 1 ? "1 hour" : `${hours} hours`;
        const days = Math.round(hours / 24);
        return days === 1 ? "1 day" : `${days} days`;
    }

    function message(text, type = "") {
        const box = $("backupMessage");
        box.textContent = text || "";
        box.className = `backup-message${type ? ` ${type}` : ""}`;
    }

    function icons() {
        if (window.lucide && typeof window.lucide.createIcons === "function") window.lucide.createIcons();
    }

    /* ---------------- Saved backups ---------------- */

    // Saved backups by name (for the restore window).
    let backupsByName = {};

    function savedMessage(text, type = "") {
        const box = $("savedMessage");
        box.textContent = text || "";
        box.className = `backup-message${type ? ` ${type}` : ""}`;
    }

    async function loadBackups() {
        const rows = $("backupRows");

        try {
            const data = await api("/backups");
            const backups = Array.isArray(data.backups) ? data.backups : [];
            backupsByName = Object.fromEntries(backups.map(item => [item.name, item]));

            if (!backups.length) {
                rows.innerHTML = '<tr><td colspan="6" class="backup-empty">No backups yet. Click <strong>Run backup now</strong> above. Each backup will appear here with its own <strong>Restore</strong> button.</td></tr>';
                return;
            }

            rows.innerHTML = backups.map((item, index) => {
                const date = when(item.created_at);
                const counts = item.counts || {};
                const files = item.files || {};
                const contents = [
                    counts.users !== undefined ? `${counts.users} accounts` : "",
                    counts.submissions !== undefined ? `${counts.submissions} submissions` : "",
                    files.count !== undefined ? `${files.count} files` : ""
                ].filter(Boolean).join(" · ") || "—";

                // Labels: newest backup, and safety backups (restoring one
                // undoes the restore it was made for).
                const tags = [
                    index === 0 ? '<span class="backup-tag latest">Latest</span>' : "",
                    item.safety_for
                        ? `<span class="backup-tag safety" title="Made automatically before restoring ${escapeHtml(item.safety_for)}. Restore this to undo that restore.">Safety backup</span>`
                        : "",
                    item.uploaded ? '<span class="backup-uploaded">Uploaded</span>' : ""
                ].join("");

                return `
                    <tr data-backup-name="${escapeHtml(item.name)}">
                        <td data-label="Date"><strong>${escapeHtml(date.day)}</strong><small>${escapeHtml(date.time)} · ${escapeHtml(age(item.created_at))} ago</small>${tags ? `<div class="backup-tags">${tags}</div>` : ""}</td>
                        <td data-label="Size">${escapeHtml(size(item.size))}</td>
                        <td data-label="Contents">${escapeHtml(contents)}${item.safety_for ? `<small class="backup-safety-note">Undoes the restore of ${escapeHtml(item.safety_for)}</small>` : ""}<small>${escapeHtml(item.name)}</small></td>
                        <td data-label="Password">${item.encrypted
                            ? '<span class="backup-lock yes"><i data-lucide="lock"></i> Protected</span>'
                            : '<span class="backup-lock no">None</span>'}</td>
                        <td data-label="Made by">${escapeHtml(item.created_by || "—")}</td>
                        <td>
                            <div class="backup-row-actions">
                                <button type="button" class="restore-button" data-backup-restore>
                                    <i data-lucide="rotate-ccw"></i> Restore
                                </button>
                                <button type="button" class="secondary-button" data-backup-download>
                                    <i data-lucide="download"></i> Download
                                </button>
                                <button type="button" class="danger-button" data-backup-delete>
                                    <i data-lucide="trash-2"></i> Delete
                                </button>
                            </div>
                        </td>
                    </tr>`;
            }).join("");

            icons();
        } catch (error) {
            rows.innerHTML = `<tr><td colspan="6" class="backup-empty">${escapeHtml(error.message)}</td></tr>`;
        }
    }

    $("backupRows").addEventListener("click", async event => {
        const row = event.target.closest("[data-backup-name]");
        if (!row) return;
        const name = row.dataset.backupName;

        if (event.target.closest("[data-backup-restore]")) {
            openRestore(name);
            return;
        }

        const download = event.target.closest("[data-backup-download]");
        if (download) {
            download.disabled = true;
            try {
                const response = await api(`/backups/${encodeURIComponent(name)}/download`, { raw: true });
                const url = URL.createObjectURL(await response.blob());
                const link = document.createElement("a");
                link.href = url;
                link.download = name;
                document.body.appendChild(link);
                link.click();
                link.remove();
                setTimeout(() => URL.revokeObjectURL(url), 60000);
            } catch (error) {
                message(error.message, "error");
            } finally {
                download.disabled = false;
            }
            return;
        }

        const remove = event.target.closest("[data-backup-delete]");
        if (remove) {
            const confirmed = await window.SiknayanDialog.confirm(
                `Delete the backup ${name}?\n\nOnly do this if you have a copy elsewhere. This can't be undone.`,
                { title: "Delete backup", confirmText: "Delete", danger: true }
            );
            if (!confirmed) return;
            remove.disabled = true;
            try {
                await api(`/backups/${encodeURIComponent(name)}`, { method: "DELETE" });
                message("Backup deleted.", "success");
                alert(`The backup ${name} was deleted successfully.`);
                await loadBackups();
            } catch (error) {
                message(error.message, "error");
                alert(error.message || "Unable to delete the backup.");
                remove.disabled = false;
            }
        }
    });

    /* ---------------- Make a backup ---------------- */

    // Eye button: show or hide a password field.
    function setPasswordVisible(button, visible) {
        const input = $(button.dataset.toggleFor);
        if (!input) return;
        input.type = visible ? "text" : "password";
        button.setAttribute("aria-pressed", String(visible));
        button.setAttribute("aria-label", button.getAttribute("aria-label").replace(/^(Show|Hide)/, visible ? "Hide" : "Show"));
        button.title = visible ? "Hide password" : "Show password";
        button.querySelector(".icon-show").hidden = visible;
        button.querySelector(".icon-hide").hidden = !visible;
    }

    function hideAllPasswords() {
        document.querySelectorAll(".password-toggle").forEach(button => setPasswordVisible(button, false));
    }

    document.querySelectorAll(".password-toggle").forEach(button => {
        button.addEventListener("click", () => {
            const input = $(button.dataset.toggleFor);
            setPasswordVisible(button, input.type === "password");
            input.focus();
        });
    });

    $("backupProtect").addEventListener("change", () => {
        const on = $("backupProtect").checked;
        $("backupPasswordFields").hidden = !on;
        if (on) $("backupPassword").focus();
        else {
            $("backupPassword").value = "";
            $("backupPasswordConfirm").value = "";
            hideAllPasswords();
        }
    });

    $("backupForm").addEventListener("submit", async event => {
        event.preventDefault();
        message("");

        const protect = $("backupProtect").checked;
        const password = $("backupPassword").value;
        const confirmation = $("backupPasswordConfirm").value;

        if (protect) {
            if (password.length < 8) return message("The backup password must be at least 8 characters.", "error");
            if (password !== confirmation) return message("The two backup passwords do not match.", "error");
        }

        const button = $("runBackupButton");
        button.disabled = true;
        button.querySelector("span").textContent = "Making the backup...";
        message("Saving the database and uploaded files. This can take a minute.");

        try {
            const data = await api("/backups", {
                method: "POST",
                body: protect ? { password, password_confirmation: confirmation } : {}
            });

            $("backupPassword").value = "";
            $("backupPasswordConfirm").value = "";
            hideAllPasswords();
            message(
                `Backup ready (${size(data.backup?.size)}). Download it and keep a copy away from this computer.` +
                (protect ? " Remember: it opens only with the password you just typed." : ""),
                "success"
            );
            await loadBackups();
        } catch (error) {
            message(error.message, "error");
        } finally {
            button.disabled = false;
            button.querySelector("span").textContent = "Run backup now";
        }
    });

    /* ---------------- Upload a backup file ---------------- */

    $("backupUploadButton").addEventListener("click", () => $("backupUploadInput").click());

    $("backupUploadInput").addEventListener("change", async () => {
        const file = $("backupUploadInput").files[0];
        $("backupUploadInput").value = "";
        if (!file) return;

        if (!/\.zip$/i.test(file.name)) {
            savedMessage("Choose a Siknayan backup .zip file.", "error");
            return;
        }

        const button = $("backupUploadButton");
        button.disabled = true;
        button.querySelector("span").textContent = "Uploading...";
        savedMessage(`Uploading ${file.name} (${size(file.size)})...`);

        try {
            const form = new FormData();
            form.append("backup", file);
            const data = await api("/backups/upload", { method: "POST", form });
            savedMessage(`${data.message} It is listed as ${data.backup?.name || "a new backup"}.`, "success");
            await loadBackups();
        } catch (error) {
            savedMessage(error.message, "error");
        } finally {
            button.disabled = false;
            button.querySelector("span").textContent = "Upload a backup file";
        }
    });

    /* ---------------- Restore ---------------- */

    const dialog = $("restoreDialog");
    let restoring = null;

    function restoreMessage(text, type = "") {
        const box = $("restoreMessage");
        box.textContent = text || "";
        box.className = `backup-message${type ? ` ${type}` : ""}`;
    }

    function openRestore(name) {
        const item = backupsByName[name] || { name };
        const date = when(item.created_at);
        restoring = item;

        $("restoreWhich").textContent =
            `Backup made ${date.day}${date.time ? ` at ${date.time}` : ""}` +
            (item.created_by ? ` by ${item.created_by}` : "") + ` (${item.name}).`;

        // What will be lost, in plain words.
        $("restoreWarning").innerHTML =
            `This backup is <strong>${escapeHtml(age(item.created_at))} old</strong>. ` +
            `Everything added or changed after <strong>${escapeHtml(date.day)}${date.time ? `, ${escapeHtml(date.time)}` : ""}</strong> ` +
            "(accounts, classes, submissions, grades and uploaded files) will be lost.";

        const undo = $("restoreUndo");
        undo.hidden = !item.safety_for;
        undo.textContent = item.safety_for
            ? `This is a safety backup. Restoring it undoes the restore of ${item.safety_for}.`
            : "";

        $("restoreZipField").hidden = !item.encrypted;
        $("restoreNoPassword").hidden = Boolean(item.encrypted);
        $("restoreZipPassword").value = "";
        $("restorePassword").value = "";
        hideAllPasswords();
        restoreMessage("");
        updateRestoreButton();

        if (typeof dialog.showModal === "function") dialog.showModal();
        else dialog.setAttribute("open", "");
        icons();
        (item.encrypted ? $("restoreZipPassword") : $("restorePassword")).focus();
    }

    function closeRestore() {
        if (typeof dialog.close === "function") dialog.close();
        else dialog.removeAttribute("open");
        $("restorePassword").value = "";
        $("restoreZipPassword").value = "";
        hideAllPasswords();
        restoring = null;
    }

    $("restoreCancel").addEventListener("click", closeRestore);

    // The Restore button turns on once every password box is filled in.
    function updateRestoreButton() {
        const ready = Boolean(restoring)
            && (!restoring.encrypted || $("restoreZipPassword").value !== "")
            && $("restorePassword").value !== "";
        $("restoreSubmit").disabled = !ready;
    }

    $("restorePassword").addEventListener("input", updateRestoreButton);
    $("restoreZipPassword").addEventListener("input", updateRestoreButton);

    $("restoreForm").addEventListener("submit", async event => {
        event.preventDefault();
        if (!restoring) return;

        const zipPassword = $("restoreZipPassword").value;
        const password = $("restorePassword").value;

        if (restoring.encrypted && !zipPassword) {
            restoreMessage("Enter the backup password.", "error");
            return $("restoreZipPassword").focus();
        }
        if (!password) {
            restoreMessage("Enter your own password to confirm.", "error");
            return $("restorePassword").focus();
        }

        const submit = $("restoreSubmit");
        submit.disabled = true;
        $("restoreCancel").disabled = true;
        submit.querySelector("span").textContent = "Restoring...";
        restoreMessage("Making a safety backup, then restoring. This can take a few minutes. Please keep this page open.");

        try {
            const data = await api(`/backups/${encodeURIComponent(restoring.name)}/restore`, {
                method: "POST",
                body: {
                    password,
                    ...(restoring.encrypted ? { zip_password: zipPassword } : {})
                }
            });

            restoreMessage(`${data.message} Taking you to the login page...`, "success");

            // The restore signed everyone out (sign-in tokens are not in backups).
            setTimeout(() => {
                try {
                    sessionStorage.clear();
                    localStorage.removeItem("siknayan_api_token");
                } catch (error) { /* ignore */ }
                window.location.href = "../index.html";
            }, 4000);
        } catch (error) {
            restoreMessage(error.message, "error");
            $("restoreCancel").disabled = false;
            submit.querySelector("span").textContent = "Restore backup";
            $("restorePassword").value = "";
            updateRestoreButton();
        }
    });

    loadBackups();
})();
