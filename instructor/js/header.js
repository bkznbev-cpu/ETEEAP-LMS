/* =========================================================
   SIKNAYAN - INSTRUCTOR PORTAL
   HEADER (header.js)

   Loaded on every Instructor page so the header matches the Academic
   Admin portal's (same outlined bell and chevron icons). It:
   - adds the bell to the header where a page doesn't have one,
   - opens the Notifications page when the bell is clicked,
   - shows a red dot while there are unread notifications.
========================================================= */

(function () {
    "use strict";

    const API_BASE_URL = window.SIKNAYAN_API_ROOT;
    const onNotificationsPage = /\/notification(\.html)?$/i.test(window.location.pathname);

    function getToken() {
        try {
            // This tab's own sign-in first (see the Academic Admin fix).
            return sessionStorage.getItem("authToken") ||
                sessionStorage.getItem("token") ||
                "";
        } catch (error) {
            return "";
        }
    }

    // Same drawings as the admin's Lucide "bell" and "chevron-down" icons.
    const BELL_ICON =
        '<svg class="header-svg bell-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" ' +
        'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" ' +
        'stroke-linejoin="round" aria-hidden="true" focusable="false">' +
        '<path d="M10.268 21a2 2 0 0 0 3.464 0"></path>' +
        '<path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326"></path></svg>';

    const CHEVRON_ICON =
        '<svg class="header-svg profile-chevron" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" ' +
        'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" ' +
        'stroke-linejoin="round" aria-hidden="true" focusable="false">' +
        '<path d="m6 9 6 6 6-6"></path></svg>';

    function addChevron() {
        const profile = document.querySelector(".header .user-profile");
        if (profile && !profile.querySelector(".profile-chevron")) {
            profile.insertAdjacentHTML("beforeend", CHEVRON_ICON);
        }
    }

    function createBell() {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "icon-btn";
        button.id = "notificationsBtn";
        button.title = "Notifications";
        button.setAttribute("aria-label", "Notifications");
        button.innerHTML = BELL_ICON;
        return button;
    }

    function setUpBell() {
        const headerRight = document.querySelector(".header .header-right");
        if (!headerRight) return null;

        let bell = document.getElementById("notificationsBtn");

        if (!bell) {
            bell = createBell();
            headerRight.insertBefore(bell, headerRight.firstChild);
        }

        // Outlined bell like the admin's (the page's solid icon is removed).
        bell.querySelectorAll("i").forEach(icon => icon.remove());
        if (!bell.querySelector(".bell-icon")) {
            bell.insertAdjacentHTML("afterbegin", BELL_ICON);
        }

        if (!bell.querySelector(".notification-dot")) {
            const dot = document.createElement("span");
            dot.className = "notification-dot";
            dot.hidden = true;
            dot.setAttribute("aria-hidden", "true");
            bell.appendChild(dot);
        }

        if (onNotificationsPage) {
            bell.setAttribute("aria-current", "page");
        }

        bell.addEventListener("click", () => {
            if (onNotificationsPage) {
                window.scrollTo({ top: 0, behavior: "smooth" });
            } else {
                window.location.href = "notification.html";
            }
        });

        return bell;
    }

    async function refreshUnread(bell) {
        const token = getToken();
        if (!bell || !token || !API_BASE_URL) return;

        try {
            const response = await fetch(`${API_BASE_URL}/instructor/notifications`, {
                headers: {
                    Accept: "application/json",
                    Authorization: `Bearer ${token}`
                }
            });

            if (!response.ok) return;

            const data = await response.json();
            const list = Array.isArray(data.notifications) ? data.notifications : [];
            const unread = list.filter(item => !item.is_read).length;

            const dot = bell.querySelector(".notification-dot");
            if (dot) dot.hidden = unread === 0;

            const label = unread === 0
                ? "Notifications"
                : `Notifications, ${unread} unread`;
            bell.setAttribute("aria-label", label);
            bell.title = label;
        } catch (error) {
            // The bell still works as a link if the count can't be loaded.
        }
    }

    function start() {
        addChevron();
        const bell = setUpBell();
        if (!bell) return;

        refreshUnread(bell);

        // Keep the dot current: every minute, when the tab is shown
        // again, and after reading notifications on the Notifications page.
        window.setInterval(() => refreshUnread(bell), 60000);
        document.addEventListener("visibilitychange", () => {
            if (!document.hidden) refreshUnread(bell);
        });

        if (onNotificationsPage) {
            document.addEventListener("click", event => {
                if (event.target.closest("#notificationsBtn")) return;
                window.setTimeout(() => refreshUnread(bell), 800);
            });
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", start);
    } else {
        start();
    }
})();
