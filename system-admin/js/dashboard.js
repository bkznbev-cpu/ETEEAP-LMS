(function initializeSystemAdminDashboard(window, document) {
    "use strict";

    if (window.SIKNAYAN_SYSTEM_ADMIN_DASHBOARD_REQUEST) {
        return;
    }

    const statisticElements = {
        total_users: document.getElementById("totalUsersCount"),
        learners: document.getElementById("learnersCount"),
        instructors: document.getElementById("instructorsCount"),
        academic_admins: document.getElementById(
            "academicAdministratorsCount"
        ),
        system_admins: document.getElementById(
            "systemAdministratorsCount"
        ),
        active_accounts: document.getElementById("activeAccountsCount"),
        inactive_accounts: document.getElementById("inactiveAccountsCount")
    };

    const dashboardStatus = document.getElementById("dashboardStatus");
    const recentActivityBody = document.getElementById("recentActivityBody");
    const attentionList = document.getElementById("attentionList");

    function setStatus(message, type) {
        if (!dashboardStatus) {
            return;
        }

        dashboardStatus.textContent = message;
        dashboardStatus.dataset.status = type;
        dashboardStatus.hidden = !message;
    }

    function setStatisticValues(value) {
        Object.values(statisticElements).forEach((element) => {
            if (element) {
                element.textContent = value;
            }
        });
    }

    function escapeHtml(value) {
        return String(value ?? "").replace(/[&<>"']/g, (character) => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        })[character]);
    }

    const ROLE_LABELS = {
        system_admin: "System Admin",
        academic_admin: "Academic Admin",
        instructor: "Instructor",
        learner: "Learner"
    };

    function renderActivityMessage(icon, title, text) {
        if (!recentActivityBody) {
            return;
        }

        recentActivityBody.innerHTML = `
            <tr>
                <td colspan="4">
                    <div class="dashboard-activity-empty">
                        <i data-lucide="${icon}"></i>
                        <strong>${escapeHtml(title)}</strong>
                        <span>${escapeHtml(text)}</span>
                    </div>
                </td>
            </tr>
        `;

        if (typeof window.refreshIcons === "function") {
            window.refreshIcons();
        }
    }

    function renderActivityUnavailable() {
        renderActivityMessage(
            "info",
            "Activity could not be loaded",
            "Open Audit Logs to see recorded system activity."
        );
    }

    /* The newest audit log entries. On phones the time and actor are
       shown under the activity (see .dashboard-activity-meta). */
    function renderActivity(entries) {
        if (!recentActivityBody) {
            return;
        }

        if (!Array.isArray(entries) || entries.length === 0) {
            renderActivityMessage(
                "inbox",
                "No recent activity",
                "Actions such as sign-ins and account changes will appear here."
            );
            return;
        }

        recentActivityBody.innerHTML = entries.map((entry) => {
            const role = ROLE_LABELS[entry.actor_role] || "";
            const failed = entry.result === "failed"
                ? ' <em class="dashboard-activity-failed">Failed</em>'
                : "";

            return `
                <tr>
                    <td class="dashboard-activity-time">${escapeHtml(entry.created_at_manila)}</td>
                    <td class="dashboard-activity-actor">
                        ${escapeHtml(entry.actor_name)}
                        ${role ? `<small>${escapeHtml(role)}</small>` : ""}
                    </td>
                    <td class="dashboard-activity-action">
                        <strong>${escapeHtml(entry.action_label)}${failed}</strong>
                        ${entry.details ? `<span>${escapeHtml(entry.details)}</span>` : ""}
                        <span class="dashboard-activity-meta">
                            ${escapeHtml(entry.created_at_manila)} · ${escapeHtml(entry.actor_name)} · ${escapeHtml(entry.module)}
                        </span>
                    </td>
                    <td class="dashboard-activity-module">${escapeHtml(entry.module)}</td>
                </tr>
            `;
        }).join("");

        if (typeof window.refreshIcons === "function") {
            window.refreshIcons();
        }
    }

    /* Attention: items the server worked out from the audit log, the
       saved backups and the accounts (see SystemAdminController). */
    const ATTENTION_LEVELS = ["danger", "warning", "success"];

    function renderAttention(items) {
        if (!attentionList) {
            return;
        }

        if (!Array.isArray(items) || items.length === 0) {
            attentionList.innerHTML = `
                <div class="dashboard-activity-empty">
                    <i data-lucide="info"></i>
                    <strong>Could not check for problems</strong>
                    <span>Refresh the page to try again.</span>
                </div>
            `;
        } else {
            attentionList.innerHTML = items.map((item) => {
                const level = ATTENTION_LEVELS.includes(item.level) ? item.level : "warning";
                const href = /^[a-z-]+\.html(\?[^"<>]*)?$/.test(item.link || "") ? item.link : "audit-logs.html";

                return `
                    <a class="attention-item ${level}" href="${escapeHtml(href)}">
                        <div class="attention-icon">
                            <i data-lucide="${escapeHtml(item.icon || "info")}"></i>
                        </div>
                        <div class="attention-content">
                            <strong>${escapeHtml(item.title)}</strong>
                            <span>${escapeHtml(item.text)}</span>
                            <span class="attention-action">
                                ${escapeHtml(item.link_label || "Open")}
                                <i data-lucide="arrow-right"></i>
                            </span>
                        </div>
                    </a>
                `;
            }).join("");
        }

        if (typeof window.refreshIcons === "function") {
            window.refreshIcons();
        }
    }

    async function loadDashboard() {
        setStatisticValues("...");
        setStatus("Loading dashboard data...", "loading");

        try {
            if (!window.SIKNAYAN_API_ROOT) {
                throw new Error("System Admin API configuration is unavailable.");
            }

            if (!window.SIKNAYAN_SYSTEM_ADMIN_AUTH_READY) {
                throw new Error("System Admin authentication is unavailable.");
            }

            const authorized =
                await window.SIKNAYAN_SYSTEM_ADMIN_AUTH_READY;

            if (!authorized) {
                throw new Error(
                    "System Admin access could not be verified. Refresh the page or sign in again."
                );
            }

            const token =
                window.sessionStorage.getItem("authToken") ||
                window.localStorage.getItem("siknayan_api_token");

            if (!token) {
                throw new Error("Your authentication token is missing.");
            }

            const response = await window.fetch(
                `${window.SIKNAYAN_API_ROOT}/system-admin/dashboard`,
                {
                    headers: {
                        Accept: "application/json",
                        Authorization: `Bearer ${token}`
                    }
                }
            );

            if (response.status === 401 || response.status === 403) {
                window.location.replace("../index.html");
                return;
            }

            if (!response.ok) {
                throw new Error(
                    `Dashboard request failed (${response.status}).`
                );
            }

            const payload = await response.json();
            const statistics = payload && payload.statistics;

            if (!payload || payload.success !== true || !statistics) {
                throw new Error("The server returned invalid dashboard data.");
            }

            for (const [key, element] of Object.entries(statisticElements)) {
                const count = statistics[key];

                if (
                    !element ||
                    !Number.isSafeInteger(count) ||
                    count < 0
                ) {
                    throw new Error(
                        `The server returned an invalid ${key} statistic.`
                    );
                }

                element.textContent = count.toLocaleString();
            }

            renderActivity(payload.recent_activity);
            renderAttention(payload.attention);
            setStatus("", "");
        } catch (error) {
            console.error("Unable to load System Admin dashboard:", error);
            setStatisticValues("—");
            setStatus(
                error instanceof Error
                    ? `Dashboard data could not be loaded: ${error.message}`
                    : "Dashboard data could not be loaded. Please try again.",
                "error"
            );
            renderActivityUnavailable();
            renderAttention([]);
        }
    }

    window.SIKNAYAN_SYSTEM_ADMIN_DASHBOARD_REQUEST = loadDashboard();
})(window, document);
