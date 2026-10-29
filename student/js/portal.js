/* =========================================================
   SIKNAYAN - LEARNER PORTAL (portal.js)

   Loaded on every learner page (after ../api-config.js, before the
   page's own script). It:
   - sends anyone who isn't a signed-in learner back to the login page,
   - draws the header and sidebar (same as the other portals),
   - runs the bell (red dot for unread), sidebar toggle (remembered),
     phone menu and profile shortcut,
   - gives the page helpers: Portal.api, Portal.openFile, Portal.toast,
     Portal.escape, Portal.formatDate, Portal.user.

   Pages mark their sidebar link with <body data-page="...">.
========================================================= */

/* Readable sidebar hover for every portal (shared/sidebar-hover.js). */
(function () {
    const current = document.currentScript;
    if (!current || window.SiknayanSidebarHover) return;
    const script = document.createElement("script");
    script.src = new URL("../../shared/sidebar-hover.js", current.src).href;
    document.head.appendChild(script);
})();


(function () {
    "use strict";

    const LOGIN_PAGE = "../index.html";
    const SIDEBAR_KEY = "siknayan_learner_sidebar_collapsed";

    /* ---------------- SIGN-IN ---------------- */

    function read(storage, key) {
        try {
            return storage.getItem(key);
        } catch (error) {
            return null;
        }
    }

    const token = read(sessionStorage, "authToken") || read(sessionStorage, "token") || "";
    let user = null;

    try {
        user = JSON.parse(read(sessionStorage, "user") || "null");
    } catch (error) {
        user = null;
    }

    if (!token || !user || user.role !== "learner") {
        window.location.replace(LOGIN_PAGE);
        return;
    }

    if (read(sessionStorage, "firstLogin") === "true") {
        window.location.replace("setup.html");
        return;
    }

    /* ---------------- HELPERS ---------------- */

    const API_ROOT = window.SIKNAYAN_API_ROOT;

    function escape(value) {
        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function formatDate(value, withTime = true) {
        if (!value) return "";
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return "";
        const options = { month: "short", day: "numeric", year: "numeric" };
        if (withTime) Object.assign(options, { hour: "numeric", minute: "2-digit" });
        return date.toLocaleString("en-PH", options);
    }

    function initials(name) {
        return String(name || "L")
            .trim()
            .split(/\s+/)
            .slice(0, 2)
            .map(part => part.charAt(0).toUpperCase())
            .join("") || "L";
    }

    function signOutExpired() {
        try {
            sessionStorage.clear();
        } catch (error) {}
        toast("Your session has ended. Please log in again.", "error");
        window.setTimeout(() => window.location.replace(LOGIN_PAGE), 1200);
    }

    /**
     * Calls the API and returns its JSON. Throws an Error with the
     * server's message when the request fails.
     */
    async function api(path, options = {}) {
        const headers = {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
            ...(options.headers || {})
        };

        let body = options.body;
        if (body && !(body instanceof FormData) && typeof body !== "string") {
            body = JSON.stringify(body);
            headers["Content-Type"] = "application/json";
        }

        let response;
        try {
            response = await fetch(`${API_ROOT}${path}`, { ...options, headers, body });
        } catch (error) {
            throw new Error("Cannot reach the server. Please check your connection and try again.");
        }

        if (response.status === 401) {
            signOutExpired();
            throw new Error("Your session has ended.");
        }

        const data = await response.json().catch(() => ({}));

        if (!response.ok || data.success === false) {
            const firstError = data.errors ? Object.values(data.errors)[0]?.[0] : null;
            throw new Error(firstError || data.message || "Something went wrong. Please try again.");
        }

        return data;
    }

    /**
     * Opens (View) or saves (Download) a private file. Files need the
     * sign-in token, so they are fetched first and then handed to the
     * browser.
     */
    async function openFile(path, { inline = false, fileName = "file" } = {}) {
        // Open the tab right away so the browser doesn't block it.
        const tab = inline ? window.open("about:blank", "_blank") : null;

        try {
            let response;
            try {
                response = await fetch(
                    `${API_ROOT}${path}${inline ? (path.includes("?") ? "&" : "?") + "disposition=inline" : ""}`,
                    { headers: { Accept: "*/*", Authorization: `Bearer ${token}` } }
                );
            } catch (error) {
                throw new Error("Cannot reach the server. Please check your connection and try again.");
            }

            if (response.status === 401) {
                signOutExpired();
                throw new Error("Your session has ended.");
            }

            if (!response.ok) {
                const data = await response.json().catch(() => null);
                throw new Error(data?.message || "The file could not be opened.");
            }

            const blob = await response.blob();

            // View: show it in the tab (PDF, images, Word .docx).
            if (inline && window.SiknayanFileViewer) {
                await window.SiknayanFileViewer.show(blob, fileName, tab);
                return;
            }

            const url = URL.createObjectURL(blob);

            if (inline) {
                if (tab) tab.location.href = url;
                else window.location.href = url;
            } else {
                const link = document.createElement("a");
                link.href = url;
                link.download = fileName;
                document.body.appendChild(link);
                link.click();
                link.remove();
            }

            window.setTimeout(() => URL.revokeObjectURL(url), 300000);
        } catch (error) {
            tab?.close();
            toast(error.message, "error");
        }
    }

    let toastArea = null;

    function toast(message, type = "success") {
        if (!toastArea) return;
        const item = document.createElement("div");
        item.className = `toast${type === "error" ? " error" : ""}`;
        item.setAttribute("role", type === "error" ? "alert" : "status");
        item.textContent = message;
        toastArea.appendChild(item);
        window.setTimeout(() => item.remove(), 4000);
    }

    /* ---------------- CONFIRM DIALOG ----------------
       In-page Yes/No box. Used instead of window.confirm(), which
       shows the site address (e.g. "127.0.0.1:5501 says").
       Returns a Promise: true for the confirm button, false otherwise. */

    function confirmDialog(message, { title = "Please confirm", confirmText = "Confirm", danger = false } = {}) {
        return new Promise(resolve => {
            if (!document.getElementById("portalConfirmStyle")) {
                const style = document.createElement("style");
                style.id = "portalConfirmStyle";
                style.textContent = `
                    .portal-confirm-overlay { position: fixed; inset: 0; z-index: 5000; display: flex; align-items: center;
                        justify-content: center; padding: 16px; background: rgba(15, 23, 42, .45);
                        backdrop-filter: blur(5px); -webkit-backdrop-filter: blur(5px); }
                    .portal-confirm { width: 100%; max-width: 420px; padding: 22px; border-top: 4px solid #e2ac2f;
                        border-radius: 14px; background: #fff; box-shadow: 0 22px 60px rgba(0,0,0,.28); }
                    .portal-confirm h3 { margin: 0 0 8px; color: #08683c; font-size: 18px; }
                    .portal-confirm p { margin: 0; color: #333; font-size: 14px; line-height: 1.55; overflow-wrap: anywhere; }
                    .portal-confirm-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px; }
                    .portal-confirm-actions button { min-height: 38px; padding: 0 16px; border-radius: 8px; font: inherit;
                        font-size: 14px; font-weight: 600; cursor: pointer; }
                    .portal-confirm-cancel { border: 1px solid #d0d5dd; background: #fff; color: #333; }
                    .portal-confirm-ok { border: 1px solid #08683c; background: #08683c; color: #fff; }
                    .portal-confirm-ok.danger { border-color: #b42318; background: #b42318; }`;
                document.head.appendChild(style);
            }

            const lastFocus = document.activeElement;
            const overlay = document.createElement("div");
            overlay.className = "portal-confirm-overlay";
            overlay.innerHTML = `
                <div class="portal-confirm" role="alertdialog" aria-modal="true" aria-labelledby="portalConfirmTitle" aria-describedby="portalConfirmText">
                    <h3 id="portalConfirmTitle">${escape(title)}</h3>
                    <p id="portalConfirmText">${escape(message)}</p>
                    <div class="portal-confirm-actions">
                        <button type="button" class="portal-confirm-cancel">Cancel</button>
                        <button type="button" class="portal-confirm-ok${danger ? " danger" : ""}">${escape(confirmText)}</button>
                    </div>
                </div>`;

            function finish(answer) {
                document.removeEventListener("keydown", onKey, true);
                overlay.remove();
                if (lastFocus && typeof lastFocus.focus === "function") lastFocus.focus();
                resolve(answer);
            }

            function onKey(event) {
                if (event.key === "Escape") {
                    event.preventDefault();
                    finish(false);
                }
            }

            overlay.querySelector(".portal-confirm-cancel").addEventListener("click", () => finish(false));
            overlay.querySelector(".portal-confirm-ok").addEventListener("click", () => finish(true));
            overlay.addEventListener("click", event => { if (event.target === overlay) finish(false); });
            document.addEventListener("keydown", onKey, true);

            document.body.appendChild(overlay);
            overlay.querySelector(".portal-confirm-ok").focus();
        });
    }

    /* ---------------- HEADER AND SIDEBAR ---------------- */

    // Same drawings as the admin's Lucide icons.
    const svg = inner =>
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
        'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' +
        inner + "</svg>";

    const ICONS = {
        bell: svg('<path d="M10.268 21a2 2 0 0 0 3.464 0"></path><path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326"></path>'),
        chevron: svg('<path d="m6 9 6 6 6-6"></path>'),
        panel: svg('<rect width="18" height="18" x="3" y="3" rx="2"></rect><path d="M9 3v18"></path>')
    };

    const NAV = [
        { page: "classes", href: "./", icon: "fa-solid fa-book", label: "Classes" },
        { page: "grades", href: "grades.html", icon: "fa-solid fa-chart-column", label: "Grades" },
        { page: "notifications", href: "notification.html", icon: "fa-solid fa-bell", label: "Notifications" }
    ];
    // My Profile opens from the name in the header, like the other portals.

    function navLink(item, current, extra = "") {
        const active = item.page === current;
        return `
            <a href="${item.href}" class="nav-item${active ? " active" : ""}"${active ? ' aria-current="page"' : ""} title="${item.label}"${extra}>
                <i class="${item.icon}" aria-hidden="true"></i>
                <span class="nav-label">${item.label}</span>
            </a>`;
    }

    function drawShell() {
        const current = document.body.dataset.page || "";
        const name = user.name || "Learner";

        const shell = document.createElement("div");
        shell.innerHTML = `
            <header class="topbar">
                <div class="brand">
                    <button class="icon-button menu-button" id="menuButton" type="button"
                        aria-label="Open menu" aria-expanded="false" aria-controls="sidebar">
                        <i class="fa-solid fa-bars" aria-hidden="true"></i>
                    </button>
                    <a class="brand-home" href="index.html" title="My Classes" aria-label="MPSU ETEEAP LMS: go to My Classes">
                        <img src="../images/logo.png" alt="" class="brand-logo">
                        <div class="brand-text">
                            <h1>MPSU ETEEAP LMS</h1>
                            <p>Mountain Province State University</p>
                        </div>
                    </a>
                </div>

                <div class="topbar-right">
                    <a class="icon-button" id="notificationsButton" href="notification.html"
                        title="Notifications" aria-label="Notifications"${current === "notifications" ? ' aria-current="page"' : ""}>
                        ${ICONS.bell}
                        <span class="notification-dot" hidden></span>
                    </a>

                    <a class="profile" href="profile.html" title="My Profile" aria-label="Open My Profile: ${escape(name)}"${current === "profile" ? ' aria-current="page"' : ""}>
                        <span class="profile-avatar" aria-hidden="true">${escape(initials(name))}</span>
                        <span class="profile-info">
                            <strong id="headerName">${escape(name)}</strong>
                            <span>Learner</span>
                        </span>
                        <span class="profile-chevron">${ICONS.chevron}</span>
                    </a>
                </div>
            </header>

            <aside class="sidebar" id="sidebar" aria-label="Learner menu">
                <div class="sidebar-top">
                    <span class="sidebar-view-text">View</span>
                    <button class="sidebar-toggle" id="sidebarToggle" type="button"
                        aria-label="Collapse sidebar" aria-expanded="true" title="Collapse sidebar">
                        ${ICONS.panel}
                    </button>
                </div>

                <nav class="sidebar-nav">
                    ${NAV.map(item => navLink(item, current)).join("")}
                </nav>

                <div class="sidebar-bottom">
                    ${navLink({ page: "logout", href: LOGIN_PAGE, icon: "fa-solid fa-right-from-bracket", label: "Logout" }, current, " data-learner-logout")}
                </div>
            </aside>

            <div class="sidebar-backdrop" id="sidebarBackdrop"></div>

            <dialog class="logout-dialog" id="logoutDialog" aria-labelledby="logoutTitle" aria-describedby="logoutMessage">
                <h2 id="logoutTitle">Confirm Logout</h2>
                <p id="logoutMessage">Are you sure you want to log out?</p>
                <div class="logout-actions">
                    <button type="button" class="btn plain" data-logout-cancel>Cancel</button>
                    <button type="button" class="btn danger" data-logout-confirm>
                        <i class="fa-solid fa-right-from-bracket" aria-hidden="true"></i> Logout
                    </button>
                </div>
            </dialog>
            <div class="toast-area" id="toastArea" aria-live="polite"></div>`;

        document.body.prepend(...shell.children);
        toastArea = document.getElementById("toastArea");
    }

    function setUpSidebar() {
        const sidebar = document.getElementById("sidebar");
        const toggle = document.getElementById("sidebarToggle");
        const menuButton = document.getElementById("menuButton");
        const backdrop = document.getElementById("sidebarBackdrop");

        function setCollapsed(collapsed) {
            sidebar.classList.toggle("collapsed", collapsed);
            const text = collapsed ? "Expand sidebar" : "Collapse sidebar";
            toggle.setAttribute("aria-label", text);
            toggle.setAttribute("aria-expanded", String(!collapsed));
            toggle.title = text;
        }

        // Remembered from page to page, like the other portals.
        sidebar.style.transition = "none";
        setCollapsed(read(localStorage, SIDEBAR_KEY) === "true");
        window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
            sidebar.style.transition = "";
        }));

        toggle.addEventListener("click", () => {
            const collapsed = !sidebar.classList.contains("collapsed");
            setCollapsed(collapsed);
            try {
                localStorage.setItem(SIDEBAR_KEY, String(collapsed));
            } catch (error) {}
        });

        // Phones and tablets: the menu button slides the sidebar in.
        function setOpen(open) {
            sidebar.classList.toggle("open", open);
            backdrop.classList.toggle("open", open);
            menuButton.setAttribute("aria-expanded", String(open));
            menuButton.setAttribute("aria-label", open ? "Close menu" : "Open menu");
            menuButton.innerHTML = `<i class="fa-solid ${open ? "fa-xmark" : "fa-bars"}" aria-hidden="true"></i>`;
        }

        menuButton.addEventListener("click", () => setOpen(!sidebar.classList.contains("open")));
        backdrop.addEventListener("click", () => setOpen(false));
        document.addEventListener("keydown", event => {
            if (event.key === "Escape" && sidebar.classList.contains("open")) setOpen(false);
        });
        window.matchMedia("(min-width: 901px)").addEventListener("change", event => {
            if (event.matches) setOpen(false);
        });
    }

    /* ---------------- LOGOUT (confirm dialog, like the System Admin) ---------------- */

    function setUpLogout() {
        const dialog = document.getElementById("logoutDialog");
        const cancel = dialog.querySelector("[data-logout-cancel]");
        const confirm = dialog.querySelector("[data-logout-confirm]");

        function open() {
            if (typeof dialog.showModal === "function") {
                if (!dialog.open) dialog.showModal();
                cancel.focus();
            } else if (window.confirm("Are you sure you want to log out?")) {
                window.siknayanLogout(LOGIN_PAGE);
            }
        }

        document.addEventListener("click", event => {
            const link = event.target.closest && event.target.closest("[data-learner-logout]");
            if (!link) return;
            event.preventDefault();
            open();
        });

        cancel.addEventListener("click", () => dialog.close());

        // Clicking the dark area outside the box closes it.
        dialog.addEventListener("click", event => {
            if (event.target === dialog) dialog.close();
        });

        confirm.addEventListener("click", () => {
            confirm.disabled = true;
            cancel.disabled = true;
            // Ends the sign-in on the server too, then returns to login.
            window.siknayanLogout(LOGIN_PAGE);
        });

        return open;
    }

    /* ---------------- BELL ---------------- */

    async function refreshBell() {
        const bell = document.getElementById("notificationsButton");
        if (!bell) return;

        try {
            const data = await api("/student/notifications");
            const unread = (data.notifications || []).filter(item => !item.is_read).length;
            bell.querySelector(".notification-dot").hidden = unread === 0;
            const label = unread ? `Notifications, ${unread} unread` : "Notifications";
            bell.setAttribute("aria-label", label);
            bell.title = label;
        } catch (error) {
            // The bell still works as a link.
        }
    }

    /* ---------------- START ---------------- */

    drawShell();
    setUpSidebar();
    const openLogout = setUpLogout();
    refreshBell();
    window.setInterval(refreshBell, 60000);
    document.addEventListener("visibilitychange", () => {
        if (!document.hidden) refreshBell();
    });

    window.Portal = {
        user,
        api,
        openFile,
        toast,
        confirmDialog,
        escape,
        formatDate,
        refreshBell,
        openLogout,
        /** Updates the name shown in the header (after a profile change). */
        setUserName(name) {
            if (!name) return;
            user.name = name;
            try {
                sessionStorage.setItem("user", JSON.stringify(user));
            } catch (error) {}
            const element = document.getElementById("headerName");
            if (element) element.textContent = name;
        }
    };
})();
