/* =========================================================
   SIKNAYAN - SYSTEM ADMIN
   AUDIT LOGS (audit-logs.js)

   Read-only view of the audit trail (table audit_logs). The server
   filters and pages the entries (GET /api/system-admin/audit-logs);
   Export downloads an Excel (.xlsx) file of every entry that matches the filters
   (GET /api/system-admin/audit-logs/export) and is logged itself.
   Times are stored in UTC and shown in Philippine time.
========================================================= */

(function () {
    "use strict";

    const $ = id => document.getElementById(id);
    if (!$("auditLogBody")) return;

    const TIMEZONE = "Asia/Manila";
    const ROLE_LABELS = {
        system_admin: "System Admin",
        academic_admin: "Academic Admin",
        instructor: "Instructor",
        learner: "Learner"
    };

    const state = { page: 1, perPage: 25, lastPage: 1, optionsLoaded: false };

    function token() {
        return sessionStorage.getItem("authToken") || localStorage.getItem("siknayan_api_token") || "";
    }

    function escapeHtml(value) {
        return String(value ?? "").replace(/[&<>"']/g, character => ({
            "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
        }[character]));
    }

    function icons() {
        if (window.lucide && typeof window.lucide.createIcons === "function") window.lucide.createIcons();
    }

    function status(text, isError = false) {
        const box = $("auditStatus");
        box.textContent = text || "";
        box.className = `audit-status${isError ? " error" : ""}`;
    }

    /* ---------------- Filters ---------------- */

    function filters() {
        const values = {
            from: $("auditDateFrom").value,
            to: $("auditDateTo").value,
            actor: $("auditActor").value,
            actor_role: $("auditRole").value,
            action: $("auditAction").value,
            module: $("auditModule").value,
            result: $("auditResult").value,
            q: $("auditSearch").value.trim()
        };

        return Object.fromEntries(Object.entries(values).filter(([, value]) => value !== ""));
    }

    function queryString(extra = {}) {
        return new URLSearchParams({ ...filters(), ...extra }).toString();
    }

    async function request(path, raw = false) {
        let response;
        try {
            response = await fetch(`${window.SIKNAYAN_API_ROOT}/system-admin${path}`, {
                headers: { Accept: raw ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/json" : "application/json", Authorization: `Bearer ${token()}` }
            });
        } catch (error) {
            throw new Error("Cannot reach the server. Check that the backend is running.");
        }

        if (response.status === 401 || response.status === 403) {
            if (typeof redirectToLogin === "function") redirectToLogin();
            throw new Error("Your session has ended. Please log in again.");
        }

        if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            const firstError = data.errors && Object.values(data.errors)[0];
            throw new Error((Array.isArray(firstError) ? firstError[0] : firstError) || data.message || "The audit log could not be loaded.");
        }

        return raw ? response : response.json();
    }

    function fillSelect(select, items, allLabel) {
        const current = select.value;
        select.innerHTML = `<option value="">${escapeHtml(allLabel)}</option>` + items;
        if ([...select.options].some(option => option.value === current)) select.value = current;
    }

    function fillOptions(options) {
        const actors = Array.isArray(options.actors) ? options.actors : [];
        const byRole = {};
        actors.forEach(actor => {
            const role = ROLE_LABELS[actor.role] || "Other";
            (byRole[role] = byRole[role] || []).push(actor);
        });

        fillSelect($("auditActor"),
            '<option value="unknown">Unknown (failed sign-ins)</option>' +
            Object.keys(byRole).sort().map(role => `
                <optgroup label="${escapeHtml(role)}">
                    ${byRole[role].map(actor => `<option value="${escapeHtml(actor.id)}">${escapeHtml(actor.name)}</option>`).join("")}
                </optgroup>`).join(""),
            "All Actors");

        fillSelect($("auditRole"),
            (options.roles || []).map(role => `<option value="${escapeHtml(role)}">${escapeHtml(ROLE_LABELS[role] || role)}</option>`).join(""),
            "All Roles");

        fillSelect($("auditAction"),
            (options.actions || []).map(action => `<option value="${escapeHtml(action.value)}">${escapeHtml(action.label)}</option>`).join(""),
            "All Actions");

        fillSelect($("auditModule"),
            (options.modules || []).map(module => `<option value="${escapeHtml(module)}">${escapeHtml(module)}</option>`).join(""),
            "All Modules");
    }

    /* ---------------- Table ---------------- */

    function when(entry) {
        const date = new Date(entry.created_at);
        if (Number.isNaN(date.getTime())) return { day: entry.created_at_manila || "—", time: "" };

        return {
            day: date.toLocaleDateString("en-US", { timeZone: TIMEZONE, year: "numeric", month: "short", day: "numeric" }),
            time: date.toLocaleTimeString("en-US", { timeZone: TIMEZONE, hour: "numeric", minute: "2-digit", second: "2-digit" })
        };
    }

    function show(value) {
        if (value === null || value === undefined || value === "") return "—";
        if (typeof value === "boolean") return value ? "Yes" : "No";
        if (typeof value === "object") return JSON.stringify(value);
        return String(value);
    }

    function changes(entry) {
        const oldValues = entry.old_values || {};
        const newValues = entry.new_values || {};
        const keys = [...new Set([...Object.keys(oldValues), ...Object.keys(newValues)])];
        if (!keys.length) return "";

        const both = Object.keys(oldValues).length && Object.keys(newValues).length;

        return `
            <details class="audit-changes">
                <summary>${both ? "Old → new" : (Object.keys(newValues).length ? "Values" : "Previous values")}</summary>
                <table>
                    <thead><tr><th>Field</th>${Object.keys(oldValues).length ? "<th>Old</th>" : ""}${Object.keys(newValues).length ? "<th>New</th>" : ""}</tr></thead>
                    <tbody>
                        ${keys.map(key => `
                            <tr>
                                <td>${escapeHtml(key.replace(/_/g, " "))}</td>
                                ${Object.keys(oldValues).length ? `<td class="old">${escapeHtml(show(oldValues[key]))}</td>` : ""}
                                ${Object.keys(newValues).length ? `<td class="new">${escapeHtml(show(newValues[key]))}</td>` : ""}
                            </tr>`).join("")}
                    </tbody>
                </table>
            </details>`;
    }

    function render(logs, pagination) {
        const body = $("auditLogBody");

        if (!logs.length) {
            body.innerHTML = '<tr><td colspan="8" class="audit-empty-state">No audit entries match these filters.</td></tr>';
        } else {
            body.innerHTML = logs.map(entry => {
                const time = when(entry);
                const target = entry.target_type
                    ? `${escapeHtml(entry.target_type)} ${escapeHtml(entry.target_id || "")}`
                    : "—";

                return `
                    <tr>
                        <td class="audit-when"><strong>${escapeHtml(time.day)}</strong><small>${escapeHtml(time.time)}</small></td>
                        <td class="audit-actor">${escapeHtml(entry.actor_name || "Unknown")}<small>${escapeHtml(ROLE_LABELS[entry.actor_role] || entry.actor_role || "—")}</small></td>
                        <td>${escapeHtml(entry.action_label || entry.action)}</td>
                        <td>${escapeHtml(entry.module)}</td>
                        <td class="audit-target">${target}${entry.target_label && entry.target_label !== entry.target_id ? `<small>${escapeHtml(entry.target_label)}</small>` : ""}</td>
                        <td><span class="audit-result ${entry.result === "failed" ? "failed" : "success"}">${escapeHtml(entry.result)}</span></td>
                        <td class="audit-ip">${escapeHtml(entry.ip_address || "—")}</td>
                        <td>${escapeHtml(entry.details)}${changes(entry)}</td>
                    </tr>`;
            }).join("");
        }

        state.page = pagination.page || 1;
        state.lastPage = pagination.last_page || 1;

        const total = pagination.total || 0;
        const start = total ? (state.page - 1) * state.perPage + 1 : 0;
        const end = Math.min(total, state.page * state.perPage);
        $("auditRecordCount").textContent = `Showing ${start}–${end} of ${total} record${total === 1 ? "" : "s"}`;
        $("auditPageIndicator").textContent = `Page ${state.page} of ${state.lastPage}`;
        $("auditPreviousPage").disabled = state.page <= 1;
        $("auditNextPage").disabled = state.page >= state.lastPage;
        icons();
    }

    async function load(page = 1) {
        status("Loading audit logs...");

        try {
            const data = await request(`/audit-logs?${queryString({ page, per_page: state.perPage })}`);
            if (data.options) fillOptions(data.options);
            render(Array.isArray(data.logs) ? data.logs : [], data.pagination || {});
            status("");
        } catch (error) {
            status(error.message, true);
            $("auditLogBody").innerHTML = `<tr><td colspan="8" class="audit-empty-state">${escapeHtml(error.message)}</td></tr>`;
        }
    }

    /* ---------------- Export ---------------- */

    async function exportExcel() {
        const button = $("exportAuditLog");
        button.disabled = true;
        status("Preparing the Excel file...");

        try {
            const response = await request(`/audit-logs/export?${queryString()}`, true);
            const disposition = response.headers.get("Content-Disposition") || "";
            const match = disposition.match(/filename="?([^";]+)"?/i);
            const url = URL.createObjectURL(await response.blob());
            const link = document.createElement("a");
            link.href = url;
            link.download = match ? match[1] : "siknayan-audit-log.xlsx";
            document.body.appendChild(link);
            link.click();
            link.remove();
            setTimeout(() => URL.revokeObjectURL(url), 60000);
            status("Excel file downloaded. The export was recorded in the audit log.");
            load(1);
        } catch (error) {
            status(error.message, true);
        } finally {
            button.disabled = false;
        }
    }

    /* ---------------- Events ---------------- */

    $("auditFilterForm").addEventListener("submit", event => {
        event.preventDefault();
        load(1);
    });

    $("clearAuditFilters").addEventListener("click", () => {
        $("auditFilterForm").reset();
        load(1);
    });

    $("auditPageSize").addEventListener("change", () => {
        state.perPage = Number($("auditPageSize").value) || 25;
        load(1);
    });

    $("auditPreviousPage").addEventListener("click", () => {
        if (state.page > 1) load(state.page - 1);
    });

    $("auditNextPage").addEventListener("click", () => {
        if (state.page < state.lastPage) load(state.page + 1);
    });

    $("exportAuditLog").addEventListener("click", exportExcel);

    /* Filters in the page address, e.g. from a dashboard Attention link:
       audit-logs.html?action=account_locked&from=2026-11-05. A placeholder
       option keeps a menu choice until the real choices load. */
    function applyLinkFilters() {
        const params = new URLSearchParams(window.location.search);
        const dates = { from: "auditDateFrom", to: "auditDateTo" };
        const menus = { action: "auditAction", module: "auditModule", result: "auditResult", actor_role: "auditRole" };

        Object.entries(dates).forEach(([key, id]) => {
            const value = params.get(key);
            if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) $(id).value = value;
        });

        Object.entries(menus).forEach(([key, id]) => {
            const value = params.get(key);
            if (!value) return;
            const select = $(id);
            if (![...select.options].some(option => option.value === value)) {
                select.add(new Option(value, value));
            }
            select.value = value;
        });

        const search = params.get("q");
        if (search) $("auditSearch").value = search.slice(0, 200);
    }

    applyLinkFilters();
    load(1);
})();
