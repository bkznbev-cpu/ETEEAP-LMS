
/* =========================================================
   SIKNAYAN - SYSTEM ADMINISTRATOR
   GLOBAL JAVASCRIPT
========================================================= */

/* Readable sidebar hover for every portal (shared/sidebar-hover.js). */
(function () {
    const current = document.currentScript;
    if (!current || window.SiknayanSidebarHover) return;
    const script = document.createElement("script");
    script.src = new URL("../../shared/sidebar-hover.js", current.src).href;
    document.head.appendChild(script);
})();

/* Phone and tablet menu for every portal (shared/mobile-nav.js). */
(function () {
    const current = document.currentScript;
    if (!current || window.SiknayanMobileNav) return;
    const script = document.createElement("script");
    script.src = new URL("../../shared/mobile-nav.js", current.src).href;
    document.head.appendChild(script);
})();


/* =========================================================
   SYSTEM ADMIN API SESSION
========================================================= */

const systemAdminToken =
    sessionStorage.getItem("authToken") ||
    localStorage.getItem("siknayan_api_token");

function clearSiknayanAuthenticationState() {
    [
        "authToken",
        "token",
        "user",
        "isLoggedIn",
        "studentId",
        "userRole",
        "userName",
        "firstLogin",
        "firstLoginVerified",
        "siknayan_system_admin_profile_cache"
    ].forEach((key) => sessionStorage.removeItem(key));

    [
        "siknayan_api_token",
        "token",
        "access_token",
        "isLoggedIn"
    ].forEach((key) => localStorage.removeItem(key));
}

function redirectToLogin() {
    clearSiknayanAuthenticationState();
    window.location.replace("../index.html");
}

if (!systemAdminToken) {
    redirectToLogin();
} else if (!window.SIKNAYAN_API_ROOT) {
    console.error("System Admin API configuration is unavailable.");
} else {
    window.SIKNAYAN_SYSTEM_ADMIN_AUTH_READY = fetch(
        `${window.SIKNAYAN_API_ROOT}/system-admin/session`,
        {
            headers: {
                Accept: "application/json",
                Authorization: `Bearer ${systemAdminToken}`
            }
        }
    )
        .then((response) => {
            if (response.status === 401 || response.status === 403) {
                redirectToLogin();
                return false;
            }

            if (!response.ok) {
                throw new Error(
                    `System Admin session verification failed (${response.status}).`
                );
            }

            return response.json();
        })
        .then((data) => {
            if (data === false) {
                return false;
            }

            if (!data || data.success !== true) {
                throw new Error(
                    "The server did not confirm the System Admin session."
                );
            }

            return true;
        })
        .catch((error) => {
            console.error(
                "Unable to verify the System Admin session:",
                error
            );
            return false;
        });
}

const logoutDialog = document.createElement("dialog");
logoutDialog.className = "system-admin-logout-dialog";
logoutDialog.setAttribute("aria-labelledby", "systemAdminLogoutTitle");
logoutDialog.setAttribute("aria-describedby", "systemAdminLogoutMessage");
logoutDialog.innerHTML = `
    <h2 id="systemAdminLogoutTitle">Confirm Logout</h2>
    <p id="systemAdminLogoutMessage">Are you sure you want to log out?</p>
    <div class="system-admin-logout-actions">
        <button type="button" class="secondary-button" data-logout-cancel>
            Cancel
        </button>
        <button type="button" class="danger-button" data-logout-confirm>
            Yes, Log Out
        </button>
    </div>
`;
document.body.appendChild(logoutDialog);

let logoutInProgress = false;

logoutDialog.addEventListener("click", (event) => {
    if (event.target === logoutDialog) {
        logoutDialog.close();
    }
});

logoutDialog
    .querySelector("[data-logout-cancel]")
    .addEventListener("click", () => logoutDialog.close());

logoutDialog
    .querySelector("[data-logout-confirm]")
    .addEventListener("click", async (event) => {
        if (logoutInProgress) {
            return;
        }

        logoutInProgress = true;
        const confirmButton = event.currentTarget;
        const cancelButton = logoutDialog.querySelector("[data-logout-cancel]");
        confirmButton.disabled = true;
        cancelButton.disabled = true;

        try {
            if (systemAdminToken && window.SIKNAYAN_API_ROOT) {
                const response = await fetch(
                    `${window.SIKNAYAN_API_ROOT}/logout`,
                    {
                        method: "POST",
                        headers: {
                            Accept: "application/json",
                            Authorization: `Bearer ${systemAdminToken}`
                        }
                    }
                );

                if (!response.ok && response.status !== 401) {
                    throw new Error(
                        `Server logout failed (${response.status}).`
                    );
                }
            }
        } catch (error) {
            console.error(
                "Server logout could not be confirmed; clearing local credentials:",
                error
            );
        } finally {
            clearSiknayanAuthenticationState();
            const loginUrl = logoutDialog.dataset.loginUrl;
            window.location.replace(loginUrl || "../index.html");
        }
    });

document.addEventListener("click", (event) => {
    const logoutLink =
        event.target instanceof window.Element
            ? event.target.closest("[data-system-admin-logout]")
            : null;

    if (!logoutLink || logoutInProgress) {
        return;
    }

    event.preventDefault();
    logoutDialog.dataset.loginUrl = logoutLink.href;

    if (!logoutDialog.open) {
        logoutDialog.showModal();
        logoutDialog.querySelector("[data-logout-cancel]").focus();
    }
});


/* =========================================================
   LUCIDE ICONS
========================================================= */

function refreshIcons() {
    if (typeof lucide !== "undefined") {
        lucide.createIcons();
    }
}


/* =========================================================
   SIDEBAR
========================================================= */

const sidebar = document.getElementById("sidebar");
const sidebarToggle = document.getElementById("sidebarToggle");

const SIDEBAR_STORAGE_KEY =
    "siknayan_system_admin_sidebar_collapsed";

function applySidebarState() {
    if (!sidebar) return;

    const collapsed =
        localStorage.getItem(SIDEBAR_STORAGE_KEY) === "true";

    sidebar.classList.toggle("collapsed", collapsed);
}

applySidebarState();

if (sidebar && sidebarToggle) {
    sidebarToggle.addEventListener("click", () => {
        const collapsed =
            sidebar.classList.toggle("collapsed");

        localStorage.setItem(
            SIDEBAR_STORAGE_KEY,
            String(collapsed)
        );
    });
}


/* =========================================================
   SIDEBAR LABEL TOOLTIPS
========================================================= */

document
    .querySelectorAll(".sidebar-nav .nav-item")
    .forEach((link) => {
        const label = link.querySelector(".nav-label");

        if (!label) return;

        const fullLabel =
            label.textContent.trim().replace(/\s+/g, " ");

        link.setAttribute("title", fullLabel);
        link.setAttribute("aria-label", fullLabel);
    });

const sidebarProfileName =
    document.querySelector(".sidebar-profile-name");

if (sidebarProfileName) {
    sidebarProfileName.setAttribute(
        "title",
        sidebarProfileName.textContent.trim().replace(/\s+/g, " ")
    );
}


/* =========================================================
   PROFILE DISPLAY SYNC
   Demo persistence is browser-local until a backend exists.
========================================================= */

/*
   The profile comes from GET /api/system-admin/profile. A copy is kept
   in sessionStorage only so the header shows the right name instantly
   on the next page; the server is the source of truth.
*/

const SIKNAYAN_SYSTEM_ADMIN_PROFILE_CACHE_KEY =
    "siknayan_system_admin_profile_cache";

// Earlier versions saved an editable profile in the browser only.
try {
    localStorage.removeItem("siknayan_system_admin_profile");
} catch (error) {}

const SYSTEM_ADMIN_PROFILE_DEFAULTS = {
    fullName: "System Administrator",
    username: "",
    email: "",
    photo: ""
};

function toSystemAdminProfile(serverProfile) {
    return {
        fullName: serverProfile?.name || SYSTEM_ADMIN_PROFILE_DEFAULTS.fullName,
        username: serverProfile?.school_id || "",
        email: serverProfile?.email || "",
        photo: serverProfile?.profile_photo_url || ""
    };
}

function getSiknayanSystemAdminProfile() {
    try {
        const cached = JSON.parse(
            sessionStorage.getItem(SIKNAYAN_SYSTEM_ADMIN_PROFILE_CACHE_KEY) || "null"
        );

        if (cached && typeof cached === "object") {
            return { ...SYSTEM_ADMIN_PROFILE_DEFAULTS, ...cached };
        }
    } catch (error) {}

    // Fall back to the name stored at login.
    try {
        const user = JSON.parse(sessionStorage.getItem("user") || "null");

        if (user) {
            return toSystemAdminProfile(user);
        }
    } catch (error) {}

    return { ...SYSTEM_ADMIN_PROFILE_DEFAULTS };
}

function rememberSiknayanSystemAdminProfile(profile) {
    try {
        sessionStorage.setItem(
            SIKNAYAN_SYSTEM_ADMIN_PROFILE_CACHE_KEY,
            JSON.stringify(profile)
        );
    } catch (error) {}
}

function applySiknayanSystemAdminProfile(
    profile = getSiknayanSystemAdminProfile()
) {
    const name =
        String(profile.fullName || "").trim() ||
        SYSTEM_ADMIN_PROFILE_DEFAULTS.fullName;

    const photo =
        typeof profile.photo === "string" ? profile.photo : "";

    document
        .querySelectorAll(
            ".profile-info strong, " +
            ".sidebar-profile-name, " +
            ".profile-page-name"
        )
        .forEach((element) => {
            // Sidebar shows the first name, as in the Academic Admin portal.
            if (
                element.classList.contains("sidebar-profile-name")
            ) {
                element.textContent = name.split(/\s+/)[0] || name;
                element.setAttribute("title", name);
                return;
            }

            element.textContent = name;
        });


    // Initials in a circle, as a picture (used when there is no photo, or
    // the photo can't be loaded, instead of an empty ring or a broken image).
    function initialsAvatar(name) {
        const letters = String(name || "")
            .trim()
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 2)
            .map(word => word[0].toUpperCase())
            .join("") || "?";
        const svg =
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80">' +
            '<rect width="80" height="80" fill="#fbefd2"/>' +
            '<text x="40" y="40" dy=".35em" text-anchor="middle" ' +
            'font-family="Arial, sans-serif" font-size="32" font-weight="700" fill="#6f0d0d">' +
            letters.replace(/[<>&"']/g, "") + '</text></svg>';
        return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
    }

    // Header and sidebar: the uploaded photo, or the initials. A photo that
    // can't be loaded (for example a file missing on the server) also falls
    // back to the initials, instead of a broken image with its alt text.
    document
        .querySelectorAll(".profile-avatar, .sidebar-avatar")
        .forEach((image) => {
            image.onerror = () => {
                image.onerror = null;
                image.src = initialsAvatar(name);
            };
            image.src = photo || initialsAvatar(name);
            image.style.visibility = "visible";
            image.alt = `${name} profile photo`;
        });

    document
        .querySelectorAll(".profile-page-avatar")
        .forEach((image) => {
            if (!image.dataset.defaultSrc) {
                image.dataset.defaultSrc =
                    image.getAttribute("src") || "";
            }

            image.src = photo || image.dataset.defaultSrc;
            image.alt = `${name} profile photo`;
        });
}

// Loads the profile from the server, updates the header, and tells the
// page (siknayan:profile-updated). Resolves with the profile.
function loadSiknayanSystemAdminProfile() {
    if (!systemAdminToken || !window.SIKNAYAN_API_ROOT) {
        return Promise.reject(new Error("Not signed in."));
    }

    return fetch(`${window.SIKNAYAN_API_ROOT}/system-admin/profile`, {
        headers: {
            Accept: "application/json",
            Authorization: `Bearer ${systemAdminToken}`
        }
    })
        .then(async (response) => {
            const data = await response.json().catch(() => null);

            if (!response.ok || !data?.success) {
                throw new Error(
                    data?.message || `The server returned an error (${response.status}).`
                );
            }

            const profile = toSystemAdminProfile(data.profile);
            setSiknayanSystemAdminProfile(profile);
            return profile;
        });
}

function setSiknayanSystemAdminProfile(profile) {
    rememberSiknayanSystemAdminProfile(profile);
    applySiknayanSystemAdminProfile(profile);
    window.dispatchEvent(
        new CustomEvent("siknayan:profile-updated", { detail: profile })
    );
}

window.getSiknayanSystemAdminProfile =
    getSiknayanSystemAdminProfile;

window.applySiknayanSystemAdminProfile =
    applySiknayanSystemAdminProfile;

window.setSiknayanSystemAdminProfile =
    setSiknayanSystemAdminProfile;

window.toSiknayanSystemAdminProfile =
    toSystemAdminProfile;

window.SIKNAYAN_SYSTEM_ADMIN_PROFILE_READY =
    loadSiknayanSystemAdminProfile();

window.SIKNAYAN_SYSTEM_ADMIN_PROFILE_READY.catch((error) => {
    console.warn("Unable to load the System Admin profile.", error);
});

applySiknayanSystemAdminProfile();


/* =========================================================
   GLOBAL NOTIFICATION BELL
   Shows the System Admin's notifications from the server.
========================================================= */

(function initializeSystemAdminNotifications() {
    "use strict";

    // Earlier versions kept sample notifications in the browser.
    try {
        localStorage.removeItem("siknayan_system_admin_notifications");
    } catch (error) {}

    const NOTIFICATIONS_PAGE = "notifications.html";
    const MAX_DROPDOWN_ITEMS = 4;

    /*
       Notifications come from GET /api/system-admin/notifications.
       This store is shared with the Notifications page through
       window.SiknayanSystemAdminNotifications, so the bell and the page
       always agree.
    */

    const SERVER_TYPES = {
        account_locked: {
            category: "security",
            categoryLabel: "Security",
            severity: "High",
            icon: "shield-alert",
            href: "administrators.html",
            actionLabel: "Open Administrators",
            recommendation:
                "If the account owner didn't expect this, check with them. The account unlocks automatically after a minute."
        },
        admin_account: {
            category: "accounts",
            categoryLabel: "Accounts",
            severity: "Medium",
            icon: "user-cog",
            href: "audit-logs.html",
            actionLabel: "Open Audit Logs",
            recommendation:
                "Review the change in the Audit Logs if it needs to be verified."
        }
    };

    let cachedNotifications = [];
    let loadPromise = null;

    function toNotification(record) {
        const known = SERVER_TYPES[record.type] || {
            category: "system",
            categoryLabel: "System",
            severity: "Medium",
            icon: "bell",
            href: NOTIFICATIONS_PAGE,
            actionLabel: "View details",
            recommendation: ""
        };

        return {
            id: String(record.id),
            title: record.title || "Notification",
            message: record.message || "",
            description: record.message || "",
            timestamp: record.created_at,
            read: record.is_read === true,
            ...known
        };
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

    async function notificationApi(path, method = "GET") {
        const response = await fetch(
            `${window.SIKNAYAN_API_ROOT}/system-admin/notifications${path}`,
            {
                method,
                headers: {
                    Accept: "application/json",
                    Authorization: `Bearer ${getApiToken()}`
                }
            }
        );

        const data = await response.json().catch(() => null);

        if (!response.ok || !data || data.success === false) {
            throw new Error(
                data?.message || `The server returned an error (${response.status}).`
            );
        }

        return data;
    }

    function announceChange() {
        window.dispatchEvent(
            new CustomEvent("siknayan:notifications-updated")
        );
    }

    function loadFromServer() {
        loadPromise = notificationApi("")
            .then((data) => {
                cachedNotifications = Array.isArray(data.notifications)
                    ? data.notifications.map(toNotification)
                    : [];
                announceChange();
                return cachedNotifications;
            })
            .catch((error) => {
                console.warn("Unable to load System Admin notifications.", error);
                cachedNotifications = [];
                announceChange();
                throw error;
            });

        return loadPromise;
    }

    // Mark one notification read on screen, then on the server.
    async function markReadOnServer(id) {
        const notification = cachedNotifications.find(
            (item) => item.id === String(id)
        );

        if (!notification || notification.read) {
            return;
        }

        notification.read = true;
        announceChange();

        try {
            await notificationApi(`/${encodeURIComponent(id)}/read`, "PATCH");
        } catch (error) {
            console.warn("Unable to mark the notification as read.", error);
            notification.read = false;
            announceChange();
        }
    }

    async function markAllReadOnServer() {
        const changed = cachedNotifications.filter((item) => !item.read);

        if (changed.length === 0) {
            return;
        }

        changed.forEach((item) => { item.read = true; });
        announceChange();

        try {
            await notificationApi("/read-all", "POST");
        } catch (error) {
            console.warn("Unable to mark all notifications as read.", error);
            changed.forEach((item) => { item.read = false; });
            announceChange();
        }
    }

    window.SiknayanSystemAdminNotifications = {
        // Resolves with the list once loaded (rejects if loading failed).
        ready: () => loadPromise || loadFromServer(),
        getAll: () => cachedNotifications,
        markRead: markReadOnServer,
        markAllRead: markAllReadOnServer
    };

    let notificationWrapper = null;
    let notificationDropdown = null;
    let notificationList = null;
    let notificationSummary = null;
    let notificationViewAll = null;

    function getNotifications() {
        return cachedNotifications;
    }

    function isUnread(notification) {
        return notification.read !== true &&
            notification.isRead !== true;
    }

    function getUnreadCount(notifications) {
        return notifications.filter(isUnread).length;
    }

    function escapeHTML(value) {
        return String(value ?? "").replace(
            /[&<>"']/g,
            (character) => ({
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': "&quot;",
                "'": "&#39;"
            })[character]
        );
    }

    function getCategoryLabel(notification) {
        const labels = {
            security: "Security",
            backups: "Backups",
            accounts: "Accounts",
            system: "System"
        };

        const category =
            String(notification.category || "system").toLowerCase();

        return notification.categoryLabel ||
            labels[category] ||
            "System";
    }

    function getMessage(notification) {
        return notification.message ||
            notification.description ||
            notification.body ||
            notification.detail ||
            "Open Notifications to view this item.";
    }

    function getTimeLabel(notification) {
        const date = new Date(notification.timestamp);

        if (Number.isNaN(date.getTime())) {
            return "Recent";
        }

        const minutes = Math.round((Date.now() - date.getTime()) / 60000);

        if (minutes < 1) return "Just now";
        if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;

        const hours = Math.round(minutes / 60);
        if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;

        const days = Math.round(hours / 24);
        if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;

        return date.toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
            year: "numeric"
        });
    }

    function syncNotificationDots(notifications) {
        const unreadExists =
            getUnreadCount(notifications) > 0;

        document
            .querySelectorAll(".notification-dot")
            .forEach((dot) => {
                dot.hidden = !unreadExists;
            });

        document
            .querySelectorAll(
                ".notification-button, #notificationBell"
            )
            .forEach((button) => {
                button.setAttribute(
                    "aria-label",
                    unreadExists
                        ? `Notifications, ${getUnreadCount(notifications)} unread`
                        : "Notifications"
                );
            });
    }

    function createDropdown() {
        const bell = document.querySelector(
            ".notification-button, #notificationBell"
        );

        if (!bell || notificationWrapper) return;

        notificationWrapper =
            document.createElement("div");

        notificationWrapper.className =
            "notification-menu-wrapper";

        notificationWrapper.dataset.notificationMenu = "true";

        const originalParent = bell.parentElement;

        if (!originalParent) return;

        originalParent.insertBefore(
            notificationWrapper,
            bell
        );

        notificationWrapper.appendChild(bell);

        notificationDropdown =
            document.createElement("section");

        notificationDropdown.className =
            "notification-dropdown";

        notificationDropdown.id =
            "systemAdminNotificationDropdown";

        notificationDropdown.hidden = true;

        notificationDropdown.setAttribute("aria-label", "Notifications");

        notificationDropdown.innerHTML = `
            <div class="notification-dropdown-header">
                <div>
                    <h3>Notifications</h3>
                    <p class="notification-dropdown-summary"></p>
                </div>
            </div>

            <div class="notification-dropdown-list"></div>

            <a class="notification-dropdown-footer"
               href="${NOTIFICATIONS_PAGE}">
                View all notifications
                <span aria-hidden="true">→</span>
            </a>
        `;

        notificationWrapper.appendChild(
            notificationDropdown
        );

        notificationList =
            notificationDropdown.querySelector(
                ".notification-dropdown-list"
            );

        notificationSummary =
            notificationDropdown.querySelector(
                ".notification-dropdown-summary"
            );

        notificationViewAll =
            notificationDropdown.querySelector(
                ".notification-dropdown-footer"
            );

        // The bell opens the Notifications page (the red dot still shows
        // unread notifications). The dropdown is no longer opened.
        bell.setAttribute("title", "Open notifications");

        bell.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();

            const onNotificationsPage = /\/notifications(\.html)?$/i.test(
                window.location.pathname
            );

            if (onNotificationsPage) {
                window.scrollTo({ top: 0, behavior: "smooth" });
                return;
            }

            window.location.href = NOTIFICATIONS_PAGE;
        });

        notificationDropdown.addEventListener(
            "click",
            (event) => event.stopPropagation()
        );

        document.addEventListener("click", (event) => {
            if (
                notificationWrapper &&
                !notificationWrapper.contains(event.target)
            ) {
                setDropdownOpen(false);
            }
        });

        document.addEventListener("keydown", (event) => {
            if (event.key === "Escape") {
                setDropdownOpen(false);
            }
        });
    }

    function setDropdownOpen(open) {
        if (!notificationDropdown) return;

        notificationDropdown.hidden = !open;

        const bell = notificationWrapper.querySelector(
            ".notification-button, #notificationBell"
        );

        if (bell) {
            bell.setAttribute(
                "aria-expanded",
                String(open)
            );
        }

        if (open) {
            renderDropdown();
        }
    }

    function markNotificationRead(id) {
        markReadOnServer(id);
    }

    function renderDropdown() {
        if (
            !notificationList ||
            !notificationSummary
        ) {
            return;
        }

        const notifications = getNotifications();
        const unreadCount = getUnreadCount(notifications);
        const recentNotifications =
            notifications.slice(0, MAX_DROPDOWN_ITEMS);

        notificationSummary.textContent =
            unreadCount === 0
                ? "You're all caught up"
                : `${unreadCount} unread notification${unreadCount === 1 ? "" : "s"}`;

        if (recentNotifications.length === 0) {
            notificationList.innerHTML = `
                <div class="notification-dropdown-empty">
                    <span class="notification-empty-icon">
                        <i data-lucide="bell-ring"></i>
                    </span>
                    <strong>No notifications yet</strong>
                    <p>New notifications will appear here.</p>
                </div>
            `;

            refreshIcons();
            syncNotificationDots(notifications);
            return;
        }

        notificationList.innerHTML =
            recentNotifications.map((notification) => {
                const unread = isUnread(notification);
                const title =
                    escapeHTML(notification.title || "Notification");
                const message =
                    escapeHTML(getMessage(notification));
                const category =
                    escapeHTML(getCategoryLabel(notification));
                const time =
                    escapeHTML(getTimeLabel(notification));
                const icon =
                    escapeHTML(notification.icon || "bell");
                const id =
                    escapeHTML(notification.id || "");
                const unreadClass = unread ? " unread" : "";

                return `
                    <button
                        class="notification-dropdown-item${unreadClass}"
                        type="button"
                        data-notification-id="${id}"
                        aria-label="${title}"
                    >
                        <span class="notification-dropdown-icon">
                            <i data-lucide="${icon}"></i>
                        </span>

                        <span class="notification-dropdown-content">
                            <span class="notification-dropdown-item-heading">
                                <strong>${title}</strong>
                                ${unread
                                    ? '<span class="notification-unread-indicator" aria-label="Unread"></span>'
                                    : ""}
                            </span>

                            <span class="notification-dropdown-message">
                                ${message}
                            </span>

                            <span class="notification-dropdown-meta">
                                <span>${category}</span>
                                <span aria-hidden="true">·</span>
                                <span>${time}</span>
                            </span>
                        </span>
                    </button>
                `;
            }).join("");

        notificationList
            .querySelectorAll("[data-notification-id]")
            .forEach((button) => {
                button.addEventListener("click", () => {
                    const id =
                        button.dataset.notificationId;

                    const selected = getNotifications().find(
                        (item) => String(item.id) === String(id)
                    );

                    markNotificationRead(id);
                    setDropdownOpen(false);

                    const destination =
                        selected && typeof selected.href === "string"
                            ? selected.href.trim()
                            : "";

                    window.location.href =
                        destination || NOTIFICATIONS_PAGE;
                });
            });

        if (notificationViewAll) {
            notificationViewAll.href = NOTIFICATIONS_PAGE;
        }

        syncNotificationDots(notifications);
        refreshIcons();
    }

    function initialize() {
        createDropdown();

        // Load even when this page has no bell (the Notifications page
        // reads the same store).
        loadFromServer().catch(() => {});

        if (!notificationWrapper) return;

        renderDropdown();
    }


    /*
       Other page scripts may dispatch this event after changing
       notification state in the same tab.
    */

    window.addEventListener(
        "siknayan:notifications-updated",
        () => {
            const notifications = getNotifications();

            syncNotificationDots(notifications);
            renderDropdown();
        }
    );

    initialize();
})();
