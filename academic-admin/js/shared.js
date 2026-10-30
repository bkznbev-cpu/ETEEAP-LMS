/* =========================================================
   SIKNAYAN - ACADEMIC ADMIN
   shared.js
========================================================= */

/* Readable sidebar hover for every portal (shared/sidebar-hover.js). */
(function () {
    const current = document.currentScript;

    // Where the verified "Change Email" row lives (used by the profile pop-up).
    if (current) {
        window.SIKNAYAN_EMAIL_CHANGE_SRC = new URL("../../shared/email-change.js", current.src).href;
    }

    if (!current || window.SiknayanSidebarHover) return;
    const script = document.createElement("script");
    script.src = new URL("../../shared/sidebar-hover.js", current.src).href;
    document.head.appendChild(script);
})();

/* =========================================================
   MESSAGES IN THE PAGE
   The browser's own alert box shows the site address first
   ("mediumblue-dragonfly-....hostingersite.com says"). Every message on
   the Academic Admin pages (for example "Learner account created
   successfully.") is shown in an LMS-styled window instead, with OK.
========================================================= */
(function () {
    if (window.SiknayanNotice) return;

    const SUCCESS = /\b(success|successfully|created|updated|saved|deleted|removed|reset|added|imported|published|sent|activated|deactivated|changed)\b/i;
    const PROBLEM = /\b(unable|cannot|can't|could not|failed|error|invalid|please|missing|not |must|denied|expired)\b/i;
    const queue = [];
    let box = null;

    function build() {
        const style = document.createElement("style");
        style.textContent = `
            .sik-notice-overlay { position: fixed; inset: 0; z-index: 99999; display: none;
                align-items: center; justify-content: center; padding: 16px;
                background: rgba(10, 20, 15, 0.45); }
            .sik-notice-overlay.open { display: flex; }
            .sik-notice { width: min(380px, 100%); padding: 24px 22px 18px; border-radius: 16px;
                background: #ffffff; box-shadow: 0 24px 60px rgba(0, 0, 0, 0.28); text-align: center;
                font-family: inherit; animation: sik-notice-in 0.16s ease-out; }
            @keyframes sik-notice-in { from { transform: translateY(8px) scale(0.98); opacity: 0; } }
            .sik-notice-icon { width: 52px; height: 52px; margin: 0 auto 12px; display: grid;
                place-items: center; border-radius: 50%; background: #e7f4ed; color: #087443; }
            .sik-notice.problem .sik-notice-icon { background: #fdecec; color: #9b1c22; }
            .sik-notice-icon svg { width: 26px; height: 26px; }
            .sik-notice p { margin: 0 0 18px; color: #1f2a24; font-size: 16px; line-height: 1.5;
                white-space: pre-line; overflow-wrap: anywhere; }
            .sik-notice button { min-width: 110px; min-height: 44px; padding: 0 22px; border: 0;
                border-radius: 10px; background: #087443; color: #ffffff; font: inherit;
                font-size: 15px; font-weight: 600; cursor: pointer; }
            .sik-notice button:hover { background: #065c36; }
            .sik-notice button:focus-visible { outline: 3px solid #f3cd6b; outline-offset: 2px; }
            @media (prefers-reduced-motion: reduce) { .sik-notice { animation: none; } }`;
        document.head.appendChild(style);

        box = document.createElement("div");
        box.className = "sik-notice-overlay";
        box.innerHTML = `
            <div class="sik-notice" role="alertdialog" aria-modal="true" aria-labelledby="sikNoticeText">
                <div class="sik-notice-icon" aria-hidden="true"></div>
                <p id="sikNoticeText"></p>
                <button type="button" id="sikNoticeOk">OK</button>
            </div>`;
        document.body.appendChild(box);

        box.querySelector("#sikNoticeOk").addEventListener("click", next);
        box.addEventListener("keydown", event => {
            if (event.key === "Escape" || event.key === "Enter") {
                event.preventDefault();
                next();
            }
        });
    }

    const ICON_OK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';
    const ICON_PROBLEM = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M12 8v5M12 16.5v.5"/><circle cx="12" cy="12" r="9.5" stroke-width="2"/></svg>';

    let lastFocus = null;

    function show(text) {
        if (!box) build();
        const problem = PROBLEM.test(text) && !SUCCESS.test(text) || /\b(unable|cannot|could not|failed|error)\b/i.test(text);
        const card = box.querySelector(".sik-notice");
        card.classList.toggle("problem", problem);
        box.querySelector(".sik-notice-icon").innerHTML = problem ? ICON_PROBLEM : ICON_OK;
        box.querySelector("#sikNoticeText").textContent = text;
        if (!box.classList.contains("open")) lastFocus = document.activeElement;
        box.classList.add("open");
        box.querySelector("#sikNoticeOk").focus();
    }

    function next() {
        queue.shift();
        if (queue.length) {
            show(queue[0]);
            return;
        }
        box.classList.remove("open");
        if (lastFocus && typeof lastFocus.focus === "function" && document.contains(lastFocus)) lastFocus.focus();
    }

    function notice(message) {
        const text = String(message === undefined ? "" : message);
        queue.push(text);
        if (queue.length > 1) return;
        if (document.body) show(text);
        else document.addEventListener("DOMContentLoaded", () => show(queue[0]), { once: true });
    }

    window.SiknayanNotice = notice;
    window.alert = notice;
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
   PER-ADMIN BROWSER STORAGE
   ---------------------------------------------------------
   Each Academic Admin manages their own learners, classes and
   module library. Pages keep copies of these in the browser under
   keys starting with "siknayan_academic_admin_". Those keys are
   stored separately for each signed-in admin (key + "::admin-<id>"),
   so another admin using the same browser starts with their own,
   empty data, and nothing is deleted at logout.

   Data saved before this change belongs to ADMIN-001 (the account
   that created it) and is moved to that admin's storage the first
   time ADMIN-001 signs in on this browser.
========================================================= */

(function separateAdminBrowserStorage() {
    const PREFIX = "siknayan_academic_admin_";
    const NOT_SEPARATED = new Set([
        "siknayan_academic_admin_sidebar_collapsed" // a display preference
    ]);
    const LEGACY_OWNER_SCHOOL_ID = "ADMIN-001";

    let user = null;
    try {
        user = JSON.parse(sessionStorage.getItem("user") || "null");
    } catch (error) {
        user = null;
    }

    if (!user || !user.id) {
        return;
    }

    const store = window.localStorage;
    const proto = Object.getPrototypeOf(store);
    const original = {
        getItem: proto.getItem,
        setItem: proto.setItem,
        removeItem: proto.removeItem,
        key: proto.key
    };
    const suffix = `::admin-${user.id}`;

    const isSeparated = (key) =>
        typeof key === "string" &&
        key.startsWith(PREFIX) &&
        !key.includes("::admin-") &&
        !NOT_SEPARATED.has(key);

    // One-time move of pre-separation data to its owner.
    if (user.school_id === LEGACY_OWNER_SCHOOL_ID) {
        const legacyKeys = [];
        for (let i = 0; i < store.length; i++) {
            const key = original.key.call(store, i);
            if (isSeparated(key)) {
                legacyKeys.push(key);
            }
        }
        legacyKeys.forEach((key) => {
            if (original.getItem.call(store, key + suffix) === null) {
                original.setItem.call(store, key + suffix, original.getItem.call(store, key));
            }
            original.removeItem.call(store, key);
        });
    }

    proto.getItem = function (key) {
        return original.getItem.call(this, this === store && isSeparated(key) ? key + suffix : key);
    };
    proto.setItem = function (key, value) {
        return original.setItem.call(this, this === store && isSeparated(key) ? key + suffix : key, value);
    };
    proto.removeItem = function (key) {
        return original.removeItem.call(this, this === store && isSeparated(key) ? key + suffix : key);
    };
})();


/* =========================================================
   ICONS
========================================================= */

function refreshIcons() {

    if (typeof lucide !== "undefined") {

        lucide.createIcons();

    }

}


/* =========================================================
   SIDEBAR
========================================================= */

const sidebar =
    document.getElementById(
        "sidebar"
    );

const sidebarToggle =
    document.getElementById(
        "sidebarToggle"
    );


const SIDEBAR_STORAGE_KEY =
    "siknayan_academic_admin_sidebar_collapsed";


function applySidebarState() {

    if (!sidebar) {
        return;
    }


    const collapsed =
        localStorage.getItem(
            SIDEBAR_STORAGE_KEY
        ) === "true";


    sidebar.classList.toggle(
        "collapsed",
        collapsed
    );

}


applySidebarState();


if (
    sidebar &&
    sidebarToggle
) {

    sidebarToggle.addEventListener(
        "click",
        () => {

            const collapsed =
                sidebar.classList.toggle(
                    "collapsed"
                );


            localStorage.setItem(
                SIDEBAR_STORAGE_KEY,
                String(collapsed)
            );

        }
    );

}


/* =========================================================
   SIDEBAR PAGE DETECTION
========================================================= */

const currentPath =
    window.location.pathname
        .toLowerCase();


const insidePagesFolder =
    currentPath.includes(
        "/pages/"
    );


const currentFile =
    currentPath
        .split("/")
        .pop()
        .toLowerCase();


/* =========================================================
   ACCOUNTS SIDEBAR NAVIGATION
   ---------------------------------------------------------
   Root:
       academic-admin/index.html

   Pages:
       academic-admin/pages/*.html
========================================================= */

document.querySelectorAll(
    ".sidebar-nav .nav-item"
).forEach(
    link => {

        const label =
            link.querySelector(
                ".nav-label"
            );


        if (!label) {
            return;
        }


        const labelText =
            label.textContent
                .trim()
                .toLowerCase();


        /* -------------------------------------------------
           ACCOUNTS
        ------------------------------------------------- */

        if (
            labelText ===
            "accounts"
        ) {

            link.href =
                insidePagesFolder
                    ? "accounts.html"
                    : "pages/accounts.html";


            if (
                currentFile ===
                "accounts.html"
            ) {

                link.classList.add(
                    "active"
                );


                link.setAttribute(
                    "aria-current",
                    "page"
                );

            }


            return;
        }


        /* -------------------------------------------------
           REPORTS
        ------------------------------------------------- */

        if (
            labelText ===
            "reports"
        ) {

            link.href =
                insidePagesFolder
                    ? "reports.html"
                    : "pages/reports.html";


            if (
                currentFile ===
                "reports.html"
            ) {

                link.classList.add(
                    "active"
                );


                link.setAttribute(
                    "aria-current",
                    "page"
                );

            }


            return;
        }

    }
);

/* =========================================================
   NOTIFICATIONS SIDEBAR NAVIGATION
   ---------------------------------------------------------
   Keeps Notifications navigation working from both:
       academic-admin/index.html
       academic-admin/pages/*.html
========================================================= */

document.querySelectorAll(
    ".sidebar-nav .nav-item"
).forEach(
    link => {

        const label =
            link.querySelector(
                ".nav-label"
            );


        if (!label) {
            return;
        }


        const labelText =
            label.textContent
                .trim()
                .toLowerCase();


        if (
            labelText !==
            "notifications"
        ) {

            return;

        }


        const currentPath =
            window.location.pathname
                .toLowerCase();


        const insidePagesFolder =
            currentPath.includes(
                "/pages/"
            );


        link.href =
            insidePagesFolder
                ? "notifications.html"
                : "pages/notifications.html";


        const currentFile =
            window.location.pathname
                .split("/")
                .pop()
                .toLowerCase();


        if (
            currentFile ===
            "notifications.html"
        ) {

            link.classList.add(
                "active"
            );

            link.setAttribute(
                "aria-current",
                "page"
            );

        }

    }
);


/* =========================================================
   TOPBAR NOTIFICATION BUTTON
   ---------------------------------------------------------
   Clicking the bell opens the Notifications workspace.
========================================================= */

document.querySelectorAll(
    ".notification-button"
).forEach(
    button => {

        button.addEventListener(
            "click",
            () => {

                const currentPath =
                    window.location.pathname
                        .toLowerCase();


                const insidePagesFolder =
                    currentPath.includes(
                        "/pages/"
                    );


                window.location.href =
                    insidePagesFolder
                        ? "notifications.html"
                        : "pages/notifications.html";

            }
        );

    }
);

/* =========================================================
   INITIAL ICON RENDER
========================================================= */

refreshIcons();

/* =========================================
   ACADEMIC ADMIN LOGOUT CONFIRMATION
   Reusable across Academic Admin pages
========================================= */

(function () {
    // Prevent duplicate initialization.
    if (window.siknayanLogoutInitialized) return;
    window.siknayanLogoutInitialized = true;

    // Add the confirmation card styles.
    const logoutStyle = document.createElement("style");

    logoutStyle.textContent = `
        #sikLogoutOverlay {
            position: fixed;
            inset: 0;
            z-index: 100000;
            display: none;
            align-items: center;
            justify-content: center;
            padding: 20px;
            background: rgba(0, 0, 0, 0.45);
        }

        #sikLogoutOverlay.open {
            display: flex;
        }

        /* Same box as the System Admin and learner portals. */
        .sik-logout-card {
            width: min(100% - 32px, 420px);
            padding: 24px;
            border: 1px solid #d8d8d8;
            border-radius: 10px;
            background: #ffffff;
            color: #181818;
            text-align: left;
            box-shadow: 0 12px 40px rgba(0, 0, 0, 0.18);
            font-family: Arial, Helvetica, sans-serif;
            animation: sikLogoutAppear 0.2s ease-out;
        }

        @keyframes sikLogoutAppear {
            from {
                opacity: 0;
                transform: translateY(10px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }

        .sik-logout-card h2 {
            margin: 0;
            font-size: 20px;
            font-weight: 700;
        }

        .sik-logout-card p {
            margin: 10px 0 0;
            color: #696969;
            font-size: 14px;
        }

        .sik-logout-actions {
            display: flex;
            justify-content: flex-end;
            gap: 10px;
            margin-top: 24px;
        }

        .sik-logout-actions button {
            min-height: 40px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 7px;
            padding: 0 15px;
            border-radius: 6px;
            font: inherit;
            font-size: 13px;
            font-weight: 600;
            cursor: pointer;
        }

        .sik-logout-actions svg {
            width: 16px;
            height: 16px;
        }

        #sikLogoutCancel {
            border: 1px solid #d8d8d8;
            background: #ffffff;
            color: #444444;
        }

        #sikLogoutCancel:hover {
            border-color: #c4cbc7;
            background: #f7f9f8;
        }

        #sikLogoutConfirm {
            border: 1px solid #a32929;
            background: #a32929;
            color: #ffffff;
        }

        #sikLogoutConfirm:hover {
            border-color: #8c2020;
            background: #8c2020;
        }

        #sikLogoutConfirm:disabled,
        #sikLogoutCancel:disabled {
            cursor: wait;
            opacity: 0.65;
        }
    `;

    document.head.appendChild(logoutStyle);

    // Create the confirmation card once.
    const logoutOverlay = document.createElement("div");

    logoutOverlay.id = "sikLogoutOverlay";
    logoutOverlay.setAttribute("role", "dialog");
    logoutOverlay.setAttribute("aria-modal", "true");
    logoutOverlay.setAttribute(
        "aria-labelledby",
        "sikLogoutTitle"
    );
    logoutOverlay.setAttribute("aria-describedby", "sikLogoutMessage");

    logoutOverlay.innerHTML = `
        <section class="sik-logout-card">
            <h2 id="sikLogoutTitle">Confirm Logout</h2>

            <p id="sikLogoutMessage">Are you sure you want to log out?</p>

            <div class="sik-logout-actions">
                <button type="button" id="sikLogoutCancel">
                    Cancel
                </button>

                <button type="button" id="sikLogoutConfirm">
                    <i data-lucide="log-out"></i>
                    Logout
                </button>
            </div>
        </section>
    `;

    document.body.appendChild(logoutOverlay);

    const cancelButton =
        document.getElementById("sikLogoutCancel");

    const confirmButton =
        document.getElementById("sikLogoutConfirm");

    let previousFocus = null;

    function openLogoutConfirmation() {
        previousFocus = document.activeElement;

        logoutOverlay.classList.add("open");
        document.body.style.overflow = "hidden";

        if (window.lucide) {
            window.lucide.createIcons();
        }

        cancelButton.focus();
    }

    function closeLogoutConfirmation() {
        logoutOverlay.classList.remove("open");
        document.body.style.overflow = "";

        if (previousFocus && previousFocus.isConnected) {
            previousFocus.focus();
        }
    }

    // Listen for the logout button on every page: the one with
    // id="academicAdminLogoutBtn" or any "Logout" link in the sidebar
    // (some pages, such as Learner Accounts, have no id on it).
    document.addEventListener("click", function (event) {
        const logoutButton = event.target.closest(
            "#academicAdminLogoutBtn, .sidebar .nav-item.logout"
        );

        if (!logoutButton) return;

        event.preventDefault();
        openLogoutConfirmation();
    });

    // Cancel logout.
    cancelButton.addEventListener("click", function () {
        closeLogoutConfirmation();
    });

    // Clicking the shaded background closes the card.
    logoutOverlay.addEventListener("click", function (event) {
        if (event.target === logoutOverlay) {
            closeLogoutConfirmation();
        }
    });

    // Escape closes the confirmation card.
    document.addEventListener("keydown", function (event) {
        if (
            event.key === "Escape" &&
            logoutOverlay.classList.contains("open")
        ) {
            closeLogoutConfirmation();
        }
    });

    // Confirm logout and clear saved authentication information.
    confirmButton.addEventListener("click", function () {
        confirmButton.disabled = true;
        cancelButton.disabled = true;

        // Revoke the token on the server first (api-config.js provides this).
        if (window.siknayanLogout) {
            const earlyPath = window.location.pathname.toLowerCase();

            window.siknayanLogout(
                earlyPath.includes("/academic-admin/pages/")
                    ? "../../index.html"
                    : "../index.html"
            );

            return;
        }

        sessionStorage.removeItem("isLoggedIn");
        sessionStorage.removeItem("studentId");
        sessionStorage.removeItem("userRole");
        sessionStorage.removeItem("userName");
        sessionStorage.removeItem("authToken");
        sessionStorage.removeItem("token");
        sessionStorage.removeItem("firstLogin");

        localStorage.removeItem("siknayan_api_token");
        localStorage.removeItem("token");
        localStorage.removeItem("access_token");

       

        // Redirect to the main login page outside academic-admin.
        const path = window.location.pathname.toLowerCase();

        const loginUrl = path.includes("/academic-admin/pages/")
            ? "../../index.html"
            : "../index.html";

        window.location.href = loginUrl;
    });


    // Render the logout icon.
    if (window.lucide) {
        window.lucide.createIcons();
    }
})();

    
/* ==========================================================
   SIKNAYAN LMS - ACADEMIC ADMIN PROFILE MODAL
   Opens when the admin clicks the header or sidebar profile.
   ========================================================== */

(() => {
    if (window.siknayanProfileModalInitialized) return;
    window.siknayanProfileModalInitialized = true;

    const API_URL = `${window.SIKNAYAN_API_ROOT}/admin/profile`;

    const style = document.createElement("style");
    style.textContent = `
        #sikProfileOverlay {
            position: fixed;
            inset: 0;
            z-index: 99999;
            display: none;
            align-items: center;
            justify-content: center;
            padding: 20px;
            background: rgba(15, 23, 42, .45);
            backdrop-filter: blur(7px);
            -webkit-backdrop-filter: blur(7px);
            overflow-y: auto;
        }

        #sikProfileOverlay.open {
            display: flex;
        }

        .sik-profile-modal {
            position: relative;
            width: 100%;
            max-width: 650px;
            max-height: calc(100vh - 40px);
            overflow-y: auto;
            border-radius: 18px;
            background: #fff;
            box-shadow: 0 20px 65px rgba(0,0,0,.25);
            animation: sikProfileIn .2s ease-out;
        }

        @keyframes sikProfileIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }

        .sik-profile-cover {
            display: flex;
            align-items: center;
            gap: 20px;
            padding: 28px;
            padding-right: 60px;
            color: #fff;
            background: linear-gradient(125deg, #0a7549, #075b3b);
        }

       

.sik-profile-avatar,
button.sik-profile-avatar {
    width: 90px;
    height: 90px;
    min-width: 90px;
    min-height: 90px;
    flex: 0 0 90px;
    box-sizing: border-box;
    display: block;
    padding: 0;
    overflow: hidden;
    border: none;
    border-radius: 50%;
    background: transparent;
    appearance: none;
    -webkit-appearance: none;
    cursor: pointer;
}

.sik-profile-avatar img,
.sik-profile-avatar img:not([hidden]) {
    display: block;
    width: 100%;
    height: 100%;
    margin: 0;
    padding: 0;
    border: none;
    border-radius: 50%;
    object-fit: cover;
    object-position: center;
}

        
/* Hide the fallback icon whenever the profile photo is visible. */
.sik-profile-avatar:has(img:not([hidden])) svg,
.sik-profile-avatar:has(img:not([hidden])) i {
    display: none !important;
}


        
.sik-profile-avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    border-radius: 50%;
}

        .sik-profile-cover h2 {
            margin: 0 0 8px;
            font-size: 23px;
            overflow-wrap: anywhere;
        }

        .sik-profile-cover p {
            margin: 0 0 10px;
            color: #e0f2e9;
            line-height: 1.5;
        }

        .sik-profile-role {
            display: flex;
            align-items: center;
            gap: 7px;
            font-size: 14px;
            color: #e0f2e9;
        }

        .sik-profile-close {
            position: absolute;
            top: 13px;
            right: 13px;
            z-index: 2;
            width: 36px;
            height: 36px;
            display: grid;
            place-items: center;
            border: 0;
            border-radius: 50%;
            background: #fff;
            color: #333;
            cursor: pointer;
        }

        .sik-profile-body {
            padding: 26px 28px;
        }

        .sik-profile-body h3 {
            margin: 0 0 20px;
            font-size: 19px;
        }

        .sik-profile-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 22px 25px;
        }

        .sik-profile-field label {
            display: block;
            margin-bottom: 7px;
            color: #667085;
            font-size: 14px;
        }

        .sik-profile-field p {
            margin: 0;
            font-size: 16px;
            font-weight: 600;
            overflow-wrap: anywhere;
        }

        .sik-profile-security {
            margin-top: 26px;
            padding-top: 24px;
            border-top: 1px solid #e5e7eb;
        }

        .sik-profile-security-row {
            display: flex;
            align-items: center;
            gap: 14px;
            margin-bottom: 20px;
        }

        .sik-profile-security-icon {
            width: 46px;
            height: 46px;
            flex-shrink: 0;
            display: grid;
            place-items: center;
            border-radius: 12px;
            background: #f2f4f7;
        }

        .sik-profile-security-icon svg {
            width: 22px;
            height: 22px;
        }

        .sik-profile-security-info {
            flex: 1;
            min-width: 0;
        }

        .sik-profile-security-info h4 {
            margin: 0 0 5px;
            font-size: 16px;
        }

        .sik-profile-security-info p {
            margin: 0;
            color: #667085;
            font-size: 14px;
            line-height: 1.5;
        }

        .sik-profile-change {
            padding: 8px;
            border: 0;
            background: transparent;
            color: #086642;
            font: inherit;
            font-weight: 600;
            cursor: pointer;
        }

        .sik-profile-status {
            color: #087443;
            font-weight: 600;
        }

        .sik-profile-actions {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 12px;
            margin-top: 24px;
            padding-top: 22px;
            border-top: 1px solid #e5e7eb;
        }

        .sik-profile-button {
            min-height: 52px;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 9px;
            padding: 12px;
            border: 1px solid #d0d5dd;
            border-radius: 11px;
            background: #fff;
            color: #202124;
            font: inherit;
            cursor: pointer;
        }

        .sik-profile-button:hover {
            border-color: #086642;
            background: #f8fbf9;
        }

        #sikProfileMessage {
            margin: 0 0 16px;
            color: #667085;
            font-size: 14px;
        }

        #sikProfileMessage.error {
            color: #b42318;
        }

        @media (max-width: 600px) {
            #sikProfileOverlay {
                padding: 12px;
            }

            .sik-profile-modal {
                max-height: calc(100vh - 24px);
            }

            .sik-profile-cover {
                gap: 13px;
                padding: 22px 16px;
                padding-right: 44px;
            }

            .sik-profile-avatar {
                width: 65px;
                height: 65px;
            }

            .sik-profile-cover h2 {
                font-size: 18px;
            }

            .sik-profile-cover p {
                font-size: 13px;
            }

            .sik-profile-body {
                padding: 22px 17px;
            }

            .sik-profile-grid {
                gap: 20px 12px;
            }

            .sik-profile-field p {
                font-size: 14px;
            }

            .sik-profile-actions {
                grid-template-columns: 1fr;
            }
        }

       
        @media (max-width: 360px) {
            .sik-profile-cover {
                align-items: flex-start;
                flex-direction: column;
            }

            .sik-profile-grid {
                grid-template-columns: 1fr;
            }
        }

        /* Profile photo upload */
        .sik-profile-photo-upload {
            padding: 16px 28px;
            border-bottom: 1px solid #e5e7eb;
            background: #f8fbf9;
        }

        #sikProfilePhotoMessage {
            margin: 10px 0 0;
            color: #667085;
            font-size: 14px;
        }

        #sikProfilePhotoMessage.error {
            color: #b42318;
        }

        .sik-profile-photo-upload > label {
            display: block;
            margin-bottom: 10px;
            color: #344054;
            font-size: 14px;
            font-weight: 600;
        }

        .sik-profile-photo-actions {
            display: flex;
            align-items: center;
            flex-wrap: wrap;
            gap: 12px;
        }

        #sikProfilePhotoInput {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
}

.sik-profile-photo-actions .sik-change-profile-photo {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: auto;
    margin: 0;
    padding: 10px 16px;
    border: none;
    border-radius: 8px;
    background: #087443;
    color: #fff;
    font-size: 14px;
    font-weight: 600;
    line-height: 1.2;
    cursor: pointer;
    transition: background 0.2s ease;
}

.sik-profile-photo-actions .sik-change-profile-photo:hover {
    background: #065c36;
}

        #sikUploadProfilePhoto {
            padding: 9px 15px;
            border: 0;
            border-radius: 8px;
            background: #087443;
            color: #fff;
            font: inherit;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
        }

        #sikUploadProfilePhoto:hover {
            background: #065c36;
        }

        #sikUploadProfilePhoto:disabled {
            opacity: .6;
            cursor: not-allowed;
        }

        /* Primary action button */
        .sik-profile-button.primary {
            border-color: #087443;
            background: #087443;
            color: #fff;
            font-weight: 600;
        }

        .sik-profile-button.primary:hover {
            border-color: #065c36;
            background: #065c36;
        }

        .sik-profile-button[hidden] {
            display: none !important;
        }

        /* ===== Same look as the learner's profile pop-up ===== */
        .sik-visually-hidden {
            position: absolute;
            width: 1px;
            height: 1px;
            overflow: hidden;
            clip: rect(0, 0, 0, 0);
            white-space: nowrap;
        }

        .sik-photo-wrap {
            position: relative;
            flex: 0 0 auto;
        }

        .sik-profile-avatar {
            display: grid !important;
            place-items: center;
            background: #e7f4ed !important;
            color: #086642;
            cursor: default !important;
        }

        .sik-profile-avatar svg {
            width: 38px;
            height: 38px;
        }

        .sik-photo-edit {
            position: absolute;
            right: -2px;
            bottom: -2px;
            width: 32px;
            height: 32px;
            display: grid;
            place-items: center;
            border: 3px solid #fff;
            border-radius: 50%;
            background: #e2ac2f;
            color: #3d0a0d;
            cursor: pointer;
            box-shadow: 0 3px 10px rgba(0, 0, 0, .25);
            transition: transform .15s ease, background .15s ease;
        }

        .sik-photo-edit:hover {
            background: #f2cf74;
            transform: scale(1.08);
        }

        .sik-photo-edit svg {
            width: 14px;
            height: 14px;
        }

        .sik-profile-tags {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
        }

        .sik-profile-tags .sik-profile-role {
            display: inline-flex;
            padding: 4px 11px;
            border-radius: 999px;
            background: rgba(255, 255, 255, .14);
        }

        .sik-profile-role svg {
            width: 16px;
            height: 16px;
        }

        /* Upload strip: only after a picture is chosen (or for a message) */
        .sik-profile-photo-upload {
            padding: 10px 28px;
        }

        .sik-profile-photo-upload:not(:has(#sikUploadProfilePhoto:not([hidden]))):not(:has(#sikProfilePhotoMessage:not(:empty))) {
            display: none;
        }

        .sik-profile-photo-actions {
            justify-content: flex-end;
            gap: 8px;
        }

        .sik-profile-photo-actions:not(:has(#sikUploadProfilePhoto:not([hidden]))) {
            display: none;
        }

        #sikUploadProfilePhoto,
        #sikCancelProfilePhoto {
            min-width: 96px;
            height: 34px;
            padding: 0 14px;
            border-radius: 8px;
            font: inherit;
            font-size: 13px;
            font-weight: 600;
            cursor: pointer;
        }

        #sikCancelProfilePhoto {
            border: 1px solid #d0d5dd;
            background: #fff;
            color: #344054;
        }

        #sikProfilePhotoMessage {
            margin: 6px 0 0;
            text-align: right;
        }

        #sikProfilePhotoMessage:empty {
            display: none;
        }

        #sikProfileMessage:empty {
            display: none;
        }

        /* Password form */
        #sikChangePasswordForm {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 12px 14px;
            margin: -4px 0 0;
            padding: 16px;
            border: 1px solid #e5e7eb;
            border-radius: 12px;
            background: #fafbfa;
        }

        #sikChangePasswordForm .sik-pw-wide {
            grid-column: 1 / -1;
        }

        #sikChangePasswordForm label {
            display: block;
            margin-bottom: 6px;
            color: #344054;
            font-size: 13px;
            font-weight: 600;
        }

        #sikChangePasswordForm input {
            width: 100%;
            box-sizing: border-box;
            padding: 9px 12px;
            border: 1px solid #d0d5dd;
            border-radius: 8px;
            font: inherit;
        }

        #sikChangePasswordForm input:focus {
            outline: 2px solid rgba(8, 116, 67, .2);
            border-color: #087443;
        }

        #sikChangePasswordMessage {
            margin: 0;
            font-size: 13px;
        }

        #sikChangePasswordMessage:empty {
            display: none;
        }

        .sik-pw-buttons {
            display: flex;
            flex-wrap: wrap;
            align-items: center;
            justify-content: space-between;
            gap: 10px;
        }

        .sik-pw-buttons span {
            color: #667085;
            font-size: 12px;
        }

        .sik-pw-buttons div {
            display: flex;
            gap: 10px;
        }

        #sikCancelPasswordChange,
        #sikSubmitPasswordChange {
            height: 36px;
            padding: 0 14px;
            border-radius: 8px;
            font: inherit;
            font-size: 13px;
            font-weight: 600;
            cursor: pointer;
        }

        #sikCancelPasswordChange {
            border: 1px solid #d0d5dd;
            background: #fff;
            color: #344054;
        }

        #sikSubmitPasswordChange {
            border: 1px solid #087443;
            background: #087443;
            color: #fff;
        }

        #sikChangePasswordForm #sikCancelPasswordChange,
        #sikChangePasswordForm #sikSubmitPasswordChange {
            box-sizing: border-box;
            width: auto;
            height: 36px !important;
            min-height: 0;
            margin: 0;
            padding: 0 14px !important;
            line-height: 1;
        }

        /* No photo: show the icon, never a broken image */
        .sik-profile-avatar img[hidden] {
            display: none !important;
        }

        #sikSubmitPasswordChange:disabled {
            opacity: .6;
        }

        .sik-profile-actions[hidden] {
            display: none;
        }

        /* Compact card while changing the password, so it fits */
        .sik-compact .sik-profile-cover {
            padding-top: 18px;
            padding-bottom: 18px;
        }

        .sik-compact .sik-profile-avatar {
            width: 68px;
            height: 68px;
            min-width: 68px;
            min-height: 68px;
            flex-basis: 68px;
        }

        .sik-compact .sik-profile-cover h2 {
            margin-bottom: 4px;
            font-size: 20px;
        }

        .sik-compact .sik-profile-cover p {
            margin-bottom: 6px;
        }

        .sik-compact .sik-profile-body {
            padding-top: 16px;
            padding-bottom: 18px;
        }

        .sik-compact .sik-profile-body h3 {
            margin-bottom: 10px;
            font-size: 17px;
        }

        .sik-compact .sik-profile-grid {
            gap: 10px 25px;
        }

        .sik-compact .sik-profile-security {
            margin-top: 14px;
            padding-top: 14px;
        }

        .sik-compact .sik-profile-security-row {
            margin-bottom: 12px;
        }

        @media (max-width: 600px) {
            #sikChangePasswordForm {
                grid-template-columns: 1fr;
            }
        }

        /* Responsive photo upload spacing */
        @media (max-width: 600px) {
            .sik-profile-photo-upload {
                padding: 16px;
            }

            .sik-profile-photo-actions {
                align-items: flex-start;
                flex-direction: column;
            }
        }

        /* Wider card: Full Name, School ID and Email on one row,
           and the password fields side by side, so changing the
           password fits without a scroll bar. */
        .sik-profile-modal {
            max-width: 880px;
        }

        .sik-profile-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
        }

        #sikChangePasswordForm {
            grid-template-columns: repeat(3, minmax(0, 1fr));
        }

        #sikChangePasswordForm .sik-pw-field.sik-pw-wide {
            grid-column: auto;
        }

        @media (max-width: 760px) {
            .sik-profile-grid,
            #sikChangePasswordForm {
                grid-template-columns: repeat(2, minmax(0, 1fr));
            }

            #sikChangePasswordForm .sik-pw-field.sik-pw-wide {
                grid-column: 1 / -1;
            }
        }

        @media (max-width: 600px) {
            #sikChangePasswordForm {
                grid-template-columns: 1fr;
            }
        }

        @media (max-width: 360px) {
            .sik-profile-grid {
                grid-template-columns: 1fr;
            }
        }

        /* Phones: tidy profile pop-up. Smaller photo, the X sits in the
           corner without covering the name, Upload/Cancel side by side,
           and the email gets its own full-width line. */
        @media (max-width: 600px) {
            .sik-profile-close {
                top: 10px;
                right: 10px;
                width: 32px;
                height: 32px;
            }

            .sik-profile-close svg {
                width: 18px;
                height: 18px;
            }

            .sik-profile-cover {
                align-items: center;
                gap: 14px;
                padding: 20px 50px 20px 16px;
            }

            .sik-profile-avatar,
            button.sik-profile-avatar {
                width: 72px;
                height: 72px;
                min-width: 72px;
                min-height: 72px;
                flex-basis: 72px;
            }

            .sik-photo-edit {
                width: 28px;
                height: 28px;
                right: -4px;
                bottom: -4px;
            }

            .sik-photo-edit svg {
                width: 12px;
                height: 12px;
            }

            .sik-profile-cover h2 {
                margin-bottom: 4px;
                font-size: 18px;
                line-height: 1.25;
                overflow-wrap: normal;
            }

            .sik-profile-cover p {
                margin-bottom: 8px;
                font-size: 13px;
                line-height: 1.35;
            }

            .sik-profile-tags .sik-profile-role {
                padding: 3px 10px;
                font-size: 12.5px;
            }

            .sik-profile-role svg {
                width: 14px;
                height: 14px;
            }

            .sik-profile-photo-upload {
                padding: 12px 16px;
            }

            .sik-profile-photo-actions {
                flex-direction: row;
                align-items: center;
                justify-content: flex-start;
                gap: 10px;
            }

            #sikUploadProfilePhoto,
            #sikCancelProfilePhoto {
                flex: 1 1 0;
                min-width: 0;
                height: 38px;
                margin: 0;
                padding: 0 12px;
                font-size: 14px;
            }

            #sikProfilePhotoMessage {
                text-align: left;
            }

            .sik-profile-body {
                padding: 20px 16px;
            }

            .sik-profile-body h3 {
                margin-bottom: 14px;
                font-size: 17px;
            }

            .sik-profile-grid {
                grid-template-columns: repeat(2, minmax(0, 1fr));
                gap: 14px 12px;
            }

            /* Email on its own line so it never breaks mid-word */
            .sik-profile-grid > .sik-profile-field:nth-child(3) {
                grid-column: 1 / -1;
            }

            .sik-profile-field label {
                margin-bottom: 4px;
                font-size: 13px;
            }

            .sik-profile-field p {
                font-size: 14.5px;
                overflow-wrap: break-word;
            }

            .sik-profile-security {
                margin-top: 18px;
                padding-top: 16px;
            }

            .sik-profile-security-row {
                gap: 12px;
            }

            .sik-profile-security-icon {
                width: 40px;
                height: 40px;
            }
        }

    `;
    document.head.appendChild(style);

    const overlay = document.createElement("div");
    overlay.id = "sikProfileOverlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-label", "Profile settings");

    overlay.innerHTML = `
        <section class="sik-profile-modal">
            <button type="button" class="sik-profile-close"
                    id="sikProfileClose" aria-label="Close profile">
                <i data-lucide="x"></i>
            </button>

<header class="sik-profile-cover">
    <div class="sik-photo-wrap">
        <div class="sik-profile-avatar" id="sikOpenPhotoViewer">
            <img
                id="sikProfileCoverPhoto"
                src=""
                alt="Administrator profile picture"
                hidden
            >
            <i data-lucide="user-round" id="sikProfileCoverIcon"></i>
        </div>
        <!-- Pen on the photo: choose a new profile picture -->
        <label for="sikProfilePhotoInput" class="sik-photo-edit" title="Change profile picture">
            <i data-lucide="pencil"></i>
            <span class="sik-visually-hidden">Change profile picture</span>
        </label>
    </div>

    <div>
        <h2 id="sikProfileName"></h2>
        <p>Mountain Province State University</p>
        <div class="sik-profile-tags">
            <span class="sik-profile-role">
                <i data-lucide="shield-check"></i>
                <span id="sikProfileRole">Academic Administrator</span>
            </span>
        </div>
    </div>
</header>


<div class="sik-profile-photo-upload">
    <div class="sik-profile-photo-actions">
        <input
            id="sikProfilePhotoInput"
            class="sik-profile-photo-file-input"
            type="file"
            accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
        >

        <button
            type="button"
            id="sikUploadProfilePhoto"
            hidden
        >
            Upload Photo
        </button>
        <button type="button" id="sikCancelProfilePhoto">Cancel</button>
    </div>
    <p id="sikProfilePhotoMessage" role="status" aria-live="polite"></p>
</div>


            <div class="sik-profile-body">
                <p id="sikProfileMessage" role="status" aria-live="polite">
                </p>

                

<section>
    <h3>Personal Information</h3>

    <div class="sik-profile-grid">
        <div class="sik-profile-field">
            <label>Full Name</label>
            <p id="sikProfileFullName">—</p>
            <input
                id="sikProfileNameInput"
                type="text"
                value=""
                maxlength="255"
                autocomplete="name"
                hidden
            >
        </div>

        <div class="sik-profile-field">
            <label>School ID</label>
            <p id="sikProfileSchoolId">—</p>
        </div>

        <div class="sik-profile-field">
            <label>Email Address</label>
            <p id="sikProfileEmail">—</p>
        </div>

        <p id="sikProfileRoleDetail" hidden></p>
    </div>
</section>


                <section class="sik-profile-security">
                    <h3>Account &amp; Security</h3>

                    <div class="sik-profile-security-row">
                        <div class="sik-profile-security-icon">
                            <i data-lucide="key-round"></i>
                        </div>
                        <div class="sik-profile-security-info">
                            <h4>Password</h4>
                            <p>Keep your account secure.</p>
                        </div>
                        <button type="button" class="sik-profile-change"
                                data-sik-action="password">
                            Change
                        </button>
                    </div>
                </section>

                
<div class="sik-profile-actions" id="sikProfileActions">
    <button
        type="button"
        class="sik-profile-button primary"
        id="sikEditProfile"
    >
        <i data-lucide="pencil"></i>
        Edit Profile
    </button>

    <button
        type="button"
        class="sik-profile-button primary"
        id="sikSaveProfile"
        hidden
    >
        <i data-lucide="check"></i>
        Save Changes
    </button>

    <button
        type="button"
        class="sik-profile-button"
        id="sikCancelProfileEdit"
        hidden
    >
        <i data-lucide="x"></i>
        Cancel
    </button>
</div>

        </section>
    `;

    document.body.appendChild(overlay);

    const $ = id => document.getElementById(id);

    function refreshIcons() {
        if (window.lucide) window.lucide.createIcons();
    }

    const coverPhoto = $("sikProfileCoverPhoto");
    const coverIcon = $("sikProfileCoverIcon");

    if (coverPhoto && coverIcon) {
        coverPhoto.addEventListener("error", () => {
            coverPhoto.hidden = true;
            coverIcon.style.display = "";
        });
    }

    // Shown in the header and sidebar when there is no profile photo
    // (or it fails to load), so the profile button is never blank.
    const DEFAULT_AVATAR =
        "data:image/svg+xml," + encodeURIComponent(
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">' +
            '<circle cx="24" cy="24" r="24" fill="#e7f4ed"/>' +
            '<circle cx="24" cy="19" r="8" fill="none" stroke="#086642" stroke-width="2.6"/>' +
            '<path d="M11 39c2-7 7-10 13-10s11 3 13 10" fill="none" stroke="#086642" stroke-width="2.6" stroke-linecap="round"/>' +
            '</svg>'
        );

    function showDefaultAvatar(img) {
        delete img.dataset.profilePhotoUrl;

        if (img.tagName !== "IMG") {
            img.style.visibility = "hidden";
            return;
        }

        img.src = DEFAULT_AVATAR;
        img.alt = "No profile picture";
        img.style.visibility = "visible";
    }

    function setPageAvatar(img, photoUrl, profileName = "") {
        if (!photoUrl) {
            showDefaultAvatar(img);
            return;
        }

        img.alt = profileName
            ? `${profileName}'s profile picture`
            : "Administrator profile picture";
        img.src = photoUrl;
        img.dataset.profilePhotoUrl = img.src;
    }

    const pageAvatars = document.querySelectorAll(
        ".profile-avatar, .sidebar-avatar"
    );

    pageAvatars.forEach((img) => {
        img.addEventListener("error", () => {
            if (
                !img.dataset.profilePhotoUrl ||
                (img.currentSrc && img.currentSrc !== img.dataset.profilePhotoUrl)
            ) {
                return;
            }

            showDefaultAvatar(img);
        });

        img.addEventListener("load", () => {
            if (
                img.dataset.profilePhotoUrl &&
                (!img.currentSrc || img.currentSrc === img.dataset.profilePhotoUrl)
            ) {
                img.style.visibility = "visible";
            }
        });
    });

    function setProfileNames(name) {
        const displayName = String(name || "").trim();
        const firstName = displayName.split(/\s+/)[0] || "";

        document.querySelectorAll("#topbarAdminName").forEach((element) => {
            element.textContent = displayName;
        });

        document.querySelectorAll(
            "#sidebarAdminName, .sidebar-profile-name"
        ).forEach((element) => {
            element.textContent = firstName;
        });
    }

    function currentAcademicAdmin() {
        try {
            const user = JSON.parse(sessionStorage.getItem("user") || "null");
            if (user && user.role === "academic_admin") {
                return user;
            }

            if (sessionStorage.getItem("userRole") === "academic_admin") {
                return {
                    role: "academic_admin",
                    name: sessionStorage.getItem("userName") || "",
                    school_id: sessionStorage.getItem("studentId") || ""
                };
            }

            return null;
        } catch (error) {
            console.error("Unable to read the signed-in user profile:", error);
            return null;
        }
    }

    function updateSessionUser(updates) {
        try {
            const currentUser = JSON.parse(
                sessionStorage.getItem("user") || "{}"
            );

            sessionStorage.setItem(
                "user",
                JSON.stringify({
                    ...currentUser,
                    ...updates
                })
            );
        } catch (error) {
            console.error("Unable to update the signed-in user profile:", error);
        }
    }

    function cacheProfile(profile) {
        const userId = profile.id;

        if (userId === null || userId === undefined) return;

        try {
            sessionStorage.setItem(
                `siknayan_academic_admin_profile_${userId}`,
                JSON.stringify({
                    id: userId,
                    name: profile.name || "",
                    email: profile.email || "",
                    school_id: profile.school_id || "",
                    role: profile.role || "",
                    profile_photo_url: profile.profile_photo_url || ""
                })
            );
        } catch (error) {
            console.error("Unable to cache the Academic Admin profile:", error);
        }
    }

    function updateCachedProfile(updates) {
        const user = currentAcademicAdmin();

        if (!user || user.id === null || user.id === undefined) return;

        let cachedProfile = {};

        try {
            cachedProfile = JSON.parse(
                sessionStorage.getItem(
                    `siknayan_academic_admin_profile_${user.id}`
                ) || "{}"
            );
        } catch (error) {
            console.error("Unable to update the cached Academic Admin profile:", error);
        }

        cacheProfile({
            id: user.id,
            name: updates.name ?? cachedProfile.name ?? user.name ?? "",
            email: cachedProfile.email ?? "",
            school_id: cachedProfile.school_id ?? "",
            role: cachedProfile.role ?? user.role ?? "",
            profile_photo_url:
                updates.profile_photo_url ??
                cachedProfile.profile_photo_url ??
                ""
        });
        window.siknayanAdminProfile = {
            ...(window.siknayanAdminProfile || {}),
            ...updates
        };
    }

    function restoreCachedProfile() {
        const user = currentAcademicAdmin();

        if (!user) return;

        let cachedProfile = null;

        try {
            if (user.id !== null && user.id !== undefined) {
                cachedProfile = JSON.parse(
                    sessionStorage.getItem(
                        `siknayan_academic_admin_profile_${user.id}`
                    ) || "null"
                );
            } else if (user.school_id) {
                for (let index = 0; index < sessionStorage.length; index++) {
                    const key = sessionStorage.key(index);
                    if (!key?.startsWith("siknayan_academic_admin_profile_")) {
                        continue;
                    }

                    const profile = JSON.parse(
                        sessionStorage.getItem(key) || "null"
                    );
                    if (
                        profile &&
                        String(profile.school_id) === String(user.school_id)
                    ) {
                        cachedProfile = profile;
                        break;
                    }
                }
            }
        } catch (error) {
            console.error("Unable to read the cached Academic Admin profile:", error);
        }

        const matchesUser =
            cachedProfile &&
            (
                user.id !== null && user.id !== undefined
                    ? String(cachedProfile.id) === String(user.id)
                    : String(cachedProfile.school_id) === String(user.school_id)
            );
        const name = matchesUser && cachedProfile.name
            ? cachedProfile.name
            : user.name;
        const photoUrl = matchesUser
            ? cachedProfile.profile_photo_url
            : "";

        setProfileNames(name);
        pageAvatars.forEach((img) => setPageAvatar(img, photoUrl, name));

        const role = String(
            matchesUser && cachedProfile.role
                ? cachedProfile.role
                : user.role || "academic_admin"
        )
            .replaceAll("_", " ")
            .replace(/\b\w/g, letter => letter.toUpperCase());

        setText("sikProfileName", name);
        setText("sikProfileFullName", name);
        setText(
            "sikProfileEmail",
            matchesUser ? cachedProfile.email : ""
        );
        setText(
            "sikProfileSchoolId",
            matchesUser ? cachedProfile.school_id : ""
        );
        setText("sikProfileRole", role);
        setText("sikProfileRoleDetail", role);

        if (coverPhoto && coverIcon) {
            if (photoUrl) {
                coverPhoto.src = photoUrl;
                coverPhoto.hidden = false;
                coverIcon.style.display = "none";
            } else {
                coverPhoto.removeAttribute("src");
                coverPhoto.hidden = true;
                coverIcon.style.display = "";
            }
        }
    }

    function clearProfileDisplay() {
        setProfileNames("");
        pageAvatars.forEach((img) => setPageAvatar(img, ""));

        if (coverPhoto && coverIcon) {
            coverPhoto.removeAttribute("src");
            coverPhoto.hidden = true;
            coverIcon.style.display = "";
        }
    }

    function getToken() {
        return (
            window.SIKNAYAN_API_TOKEN ||
            sessionStorage.getItem("authToken") ||
            sessionStorage.getItem("token") ||
            localStorage.getItem("siknayan_api_token") ||
            localStorage.getItem("token") ||
            localStorage.getItem("access_token") ||
            ""
        );
    }

    function setText(id, value) {
        $(id).textContent =
            value === null || value === undefined || value === ""
                ? "Not provided"
                : String(value);
    }

    let profileLoaded = false;
    let profileLoadPromise = null;

    function loadProfile() {
        if (profileLoaded) {
            return Promise.resolve(window.siknayanAdminProfile);
        }

        if (profileLoadPromise) {
            return profileLoadPromise;
        }

        profileLoadPromise = loadProfileRequest().finally(() => {
            profileLoadPromise = null;
        });
        window.siknayanAdminProfilePromise = profileLoadPromise;
        return profileLoadPromise;
    }

    async function loadProfileRequest() {
        $("sikProfileMessage").classList.remove("error");
        $("sikProfileMessage").textContent = "";

        window.siknayanAdminProfileError = "";
        restoreCachedProfile();
        const token = getToken();

        if (!token) {
            clearProfileDisplay();
            window.siknayanAdminProfileError =
                "No login token found. Please sign in again.";
            $("sikProfileMessage").classList.add("error");
            $("sikProfileMessage").textContent = window.siknayanAdminProfileError;
            return null;
        }

        try {
            const response = await fetch(API_URL, {
                method: "GET",
                headers: {
                    Accept: "application/json",
                    Authorization: `Bearer ${token}`
                }
            });

            const data = await response.json().catch(() => ({}));

            if (!response.ok || !data.success || !data.profile) {
                throw new Error(
                    response.status === 401 || response.status === 403
                        ? "Your session is not authorized. Please sign in again."
                        : data.message || `Unable to load profile (HTTP ${response.status}).`
                );
            }

        
const profile = data.profile;

const role = String(profile.role || "academic_admin")
    .replaceAll("_", " ")
    .replace(/\b\w/g, letter => letter.toUpperCase());

const savedName = String(profile.name || "").trim();
const savedPhotoUrl = String(profile.profile_photo_url || "").trim();
window.siknayanAdminSavedPhotoUrl = savedPhotoUrl;
updateSessionUser({
    id: profile.id,
    name: profile.name || "",
    email: profile.email || "",
    school_id: profile.school_id || "",
    role: profile.role || "academic_admin"
});
cacheProfile(profile);
profileLoaded = true;
window.siknayanAdminProfile = profile;

// Update every shared profile picture on the current page.
pageAvatars.forEach((img) => {
    setPageAvatar(img, savedPhotoUrl, savedName);
});

// Update names everywhere the shared profile is displayed.
const displayName = savedName;
setProfileNames(displayName);

// Update the profile modal details.
setText("sikProfileName", displayName);
setText("sikProfileFullName", displayName);
setText("sikProfileSchoolId", profile.school_id);
setText("sikProfileEmail", profile.email);
setText("sikProfileRole", role);
setText("sikProfileRoleDetail", role);

// Keep the saved name available for existing session-dependent UI.
if (savedName) {
    sessionStorage.setItem("userName", savedName);
}

// Update the large photo preview in the profile modal.
const coverPhoto = $("sikProfileCoverPhoto");
const coverIcon = $("sikProfileCoverIcon");

if (coverPhoto && coverIcon) {
    if (savedPhotoUrl) {
        coverPhoto.src = savedPhotoUrl;

        coverPhoto.hidden = false;
        coverIcon.style.display = "none";
    } else {
        coverPhoto.removeAttribute("src");
        coverPhoto.hidden = true;
        coverIcon.style.display = "";
    }
    
}

                return profile;

            } catch (error) {
            console.error("Load profile error:", error);
            window.siknayanAdminProfileError =
                error.message || "Could not load your profile.";
            $("sikProfileMessage").classList.add("error");
            $("sikProfileMessage").textContent =
                window.siknayanAdminProfileError;
            return null;
        }
    }


    // Restore profile modal open and close behavior.
   
function openProfileModal() {
    overlay.classList.add("open");
    document.body.style.overflow = "hidden";
    refreshIcons();

    if (!profileLoaded) {
        loadProfile();
    }

    $("sikProfileClose").focus();

    mountEmailChange();
}


// The verified "Change Email" row in Account & Security
// (shared/email-change.js); added the first time the pop-up opens.
let emailChangeMounted = false;

function mountEmailChange() {
    if (emailChangeMounted) return;
    emailChangeMounted = true;

    const start = () => window.SiknayanEmailChange.mount(overlay.querySelector(".sik-profile-security"), {
        email: window.siknayanAdminProfile && window.siknayanAdminProfile.email,
        onChanged: email => {
            if (window.siknayanAdminProfile) {
                window.siknayanAdminProfile.email = email;
                cacheProfile(window.siknayanAdminProfile);
            }
            setText("sikProfileEmail", email);
        }
    });

    if (window.SiknayanEmailChange) return start();

    const script = document.createElement("script");
    script.src = window.SIKNAYAN_EMAIL_CHANGE_SRC || "../shared/email-change.js";
    script.onload = start;
    document.head.appendChild(script);
}


    function closeProfileModal() {
        overlay.classList.remove("open");
        document.body.style.overflow = "";
    }

    document.addEventListener("click", (event) => {
    const trigger = event.target.closest(
        ".profile-avatar, .sidebar-avatar, #profileHeaderButton, .topbar-profile, #sidebarAdminProfile, .sidebar-user"
    );

    if (!trigger) return;
    if (overlay.contains(trigger)) return;

    event.preventDefault();
    openProfileModal();
});

    $("sikProfileClose").addEventListener("click", closeProfileModal);

    overlay.addEventListener("click", event => {
        if (event.target === overlay) closeProfileModal();
    });

       document.addEventListener("keydown", event => {
        if (
            event.key === "Escape" &&
            overlay.classList.contains("open")
        ) {
            closeProfileModal();
        }
    });
    
        // Profile editing: keep a snapshot so Cancel can discard changes.
    let originalProfileValues = { name: "", email: "" };


function setProfileEditMode(editing) {
    $("sikProfileFullName").hidden = editing;
    $("sikProfileNameInput").hidden = !editing;

    $("sikEditProfile").hidden = editing;
    $("sikSaveProfile").hidden = !editing;
    $("sikCancelProfileEdit").hidden = !editing;

    updateSaveButtonState();
}


function updateSaveButtonState() {
    const nameInput = $("sikProfileNameInput");
    const name = nameInput.value.trim();

    const originalName = originalProfileValues.name || "";
    const changed = name !== originalName;

    $("sikSaveProfile").disabled = !changed || !name;
}
$("sikProfileNameInput").addEventListener(
    "input",
    updateSaveButtonState
);

function startProfileEdit() {
    originalProfileValues = {
        name: $("sikProfileFullName").textContent === "Not provided"
            ? ""
            : $("sikProfileFullName").textContent
    };

    $("sikProfileNameInput").value = originalProfileValues.name;
    $("sikProfileNameInput").required = true;

    $("sikProfileMessage").classList.remove("error");
    $("sikProfileMessage").textContent = "";

    setProfileEditMode(true);
    $("sikProfileNameInput").focus();
}

    
function cancelProfileEdit() {
    $("sikProfileNameInput").value = originalProfileValues.name || "";

    setProfileEditMode(false);

    $("sikProfileMessage").classList.remove("error");
    $("sikProfileMessage").textContent = "";
}


    $("sikEditProfile").addEventListener("click", startProfileEdit);
    $("sikCancelProfileEdit").addEventListener("click", cancelProfileEdit);

    
$("sikSaveProfile").addEventListener("click", async () => {
    console.log("SAVE HANDLER STARTED");

    const nameInput = $("sikProfileNameInput");
    const saveButton = $("sikSaveProfile");
    const cancelButton = $("sikCancelProfileEdit");

    nameInput.value = nameInput.value.trim();

    if (!nameInput.reportValidity()) {
        return;
    }

    if (!nameInput.value) {
        nameInput.setCustomValidity("Full name is required.");
        nameInput.reportValidity();
        nameInput.setCustomValidity("");
        return;
    }

    const token = getToken();
    console.log("Save clicked. Token available:", Boolean(token));

    if (!token) {
        $("sikProfileMessage").classList.add("error");
        $("sikProfileMessage").textContent =
            "Your login session is missing. Please sign in again.";
        return;
    }

    saveButton.disabled = true;
    cancelButton.disabled = true;

    $("sikProfileMessage").classList.remove("error");
    $("sikProfileMessage").textContent = "Saving changes...";

    try {
        const response = await fetch(API_URL, {
            method: "PUT",
            headers: {
                Accept: "application/json",
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({
                name: nameInput.value
            })
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            throw new Error(
                data.message || `Unable to save changes (HTTP ${response.status}).`
            );
        }

        const updatedName =
            data.profile?.name ??
            data.data?.profile?.name ??
            data.name ??
            nameInput.value;

        $("sikProfileFullName").textContent = updatedName;
        $("sikProfileName").textContent = updatedName;
        nameInput.value = updatedName;
        sessionStorage.setItem("userName", updatedName);
        updateSessionUser({ name: updatedName });
        updateCachedProfile({ name: updatedName });
        setProfileNames(updatedName);

        cancelProfileEdit();

        $("sikProfileMessage").classList.remove("error");
        $("sikProfileMessage").textContent =
            "Profile updated successfully.";

    } catch (error) {
        console.error("Save profile error:", error);
        $("sikProfileMessage").classList.add("error");
        $("sikProfileMessage").textContent =
            error.message || "Could not save your profile.";
    } finally {
        saveButton.disabled = false;
        cancelButton.disabled = false;
    }
});


overlay.querySelectorAll('[data-sik-action="password"]').forEach(button => {
    button.addEventListener("click", () => {
        const message = $("sikProfileMessage");

        message.classList.remove("error");
        message.textContent = "";

        let form = $("sikChangePasswordForm");

        if (!form) {
            form = document.createElement("form");
            form.id = "sikChangePasswordForm";
            form.hidden = true;

            form.innerHTML = `
                <div class="sik-pw-field sik-pw-wide">
                    <label for="sikCurrentPassword">Current Password</label>
                    <input id="sikCurrentPassword"
                           name="current_password"
                           type="password"
                           autocomplete="current-password"
                           required>
                </div>

                <div class="sik-pw-field">
                    <label for="sikNewPassword">New Password</label>
                    <input id="sikNewPassword"
                           name="password"
                           type="password"
                           autocomplete="new-password"
                           minlength="8"
                           required>
                </div>

                <div class="sik-pw-field">
                    <label for="sikConfirmPassword">Confirm New Password</label>
                    <input id="sikConfirmPassword"
                           name="password_confirmation"
                           type="password"
                           autocomplete="new-password"
                           minlength="8"
                           required>
                </div>

                <p id="sikChangePasswordMessage"
                   class="sik-pw-wide"
                   role="status"
                   aria-live="polite"></p>

                <div class="sik-pw-buttons sik-pw-wide">
                    <span>At least 8 characters.</span>
                    <div>
                        <button id="sikCancelPasswordChange" type="button">Cancel</button>
                        <button id="sikSubmitPasswordChange" type="submit">Update Password</button>
                    </div>
                </div>
            `;

            form.addEventListener("submit", async event => {
                event.preventDefault();

                const result = $("sikChangePasswordMessage");
                const submitButton = $("sikSubmitPasswordChange");
                const currentPassword = $("sikCurrentPassword").value;
                const newPassword = $("sikNewPassword").value;
                const confirmPassword = $("sikConfirmPassword").value;

                result.style.color = "#b42318";

                if (newPassword !== confirmPassword) {
                    result.textContent = "The new passwords do not match.";
                    return;
                }

                if (currentPassword === newPassword) {
                    result.textContent =
                        "Your new password must differ from your current password.";
                    return;
                }

                const token = getToken();

                if (!token) {
                    result.textContent =
                        "No API token found. Please sign in again.";
                    return;
                }

                submitButton.disabled = true;
                submitButton.textContent = "Updating...";

                try {
                    const response = await fetch(
                        `${window.SIKNAYAN_API_ROOT}/admin/change-password`,
                        {
                            method: "PUT",
                            headers: {
                                "Accept": "application/json",
                                "Content-Type": "application/json",
                                "Authorization": `Bearer ${token}`
                            },
                            body: JSON.stringify({
                                current_password: currentPassword,
                                password: newPassword,
                                password_confirmation: confirmPassword
                            })
                        }
                    );

                    const data = await response.json();

                    if (!response.ok) {
                        const validationErrors = data.errors
                            ? Object.values(data.errors).flat().join(" ")
                            : "";

                        throw new Error(
                            validationErrors ||
                            data.message ||
                            "Unable to change password."
                        );
                    }

                    result.style.color = "#087443";
                    result.textContent =
                        data.message || "Password changed successfully.";

                    form.reset();
                } catch (error) {
                    result.textContent =
                        error.message || "An unexpected error occurred.";
                } finally {
                    submitButton.disabled = false;
                    submitButton.textContent = "Update Password";
                }
            });
        }

      // The form opens under the Password row (from either button).

if (!form.dataset.cancelReady) {
    form.dataset.cancelReady = "1";
    form.querySelector("#sikCancelPasswordChange").addEventListener("click", () => {
        form.hidden = true;
        form.style.removeProperty("display");
        form.reset();
        $("sikChangePasswordMessage").textContent = "";
        overlay.querySelector(".sik-profile-modal").classList.remove("sik-compact");
        $("sikProfileActions").hidden = false;
    });
}

const passwordRow = overlay.querySelector(
    ".sik-profile-security-row"
);

if (!passwordRow) {
    message.textContent = "Password section not found.";
    message.classList.add("error");
    return;
}

if (form.hidden) {
    passwordRow.insertAdjacentElement("afterend", form);
    form.hidden = false;
    form.style.display = "grid";
    // Compact card; the big buttons hide while the form is open.
    overlay.querySelector(".sik-profile-modal").classList.add("sik-compact");
    $("sikProfileActions").hidden = true;

    $("sikCurrentPassword")?.focus();
} else {
    form.querySelector("#sikCancelPasswordChange").click();
}
    });
});

   
    // Profile photo preview and upload
    const photoInput = $("sikProfilePhotoInput");
    const uploadPhotoButton = $("sikUploadProfilePhoto");
    const photoMessage = $("sikProfilePhotoMessage");

    let selectedProfilePhoto = null;
    let uploadInProgress = false;
    let currentSavedPhotoUrl = "";
    if (photoInput && uploadPhotoButton) {
        uploadPhotoButton.hidden = true;

        function restoreSavedPhoto() {
            if (!coverPhoto || !coverIcon) return;
            currentSavedPhotoUrl = currentSavedPhotoUrl || window.siknayanAdminSavedPhotoUrl || "";

            if (currentSavedPhotoUrl) {
                coverPhoto.src = currentSavedPhotoUrl;
                coverPhoto.hidden = false;
                coverIcon.style.display = "none";
            } else {
                coverPhoto.removeAttribute("src");
                coverPhoto.hidden = true;
                coverIcon.style.display = "";
            }
        }

        function rejectSelectedPhoto(message) {
            selectedProfilePhoto = null;
            photoInput.value = "";
            uploadPhotoButton.hidden = true;
            if (photoMessage) {
                photoMessage.classList.add("error");
                photoMessage.textContent = message;
            }
            restoreSavedPhoto();
        }

        photoInput.addEventListener("change", () => {
            const file = photoInput.files && photoInput.files[0];
            if (!file) return;

            const extension = file.name.split(".").pop().toLowerCase();
            const allowedExtensions = ["jpg", "jpeg", "png", "webp"];
            const allowedMimeTypes = [
                "image/jpeg",
                "image/png",
                "image/webp"
            ];

            if (
                !allowedExtensions.includes(extension) ||
                (file.type && !allowedMimeTypes.includes(file.type))
            ) {
                rejectSelectedPhoto(
                    "Choose a JPG, JPEG, PNG, or WEBP image."
                );
                return;
            }

            if (file.size > 25 * 1024 * 1024) {
                rejectSelectedPhoto("The photo must be 25 MB or smaller.");
                return;
            }

            selectedProfilePhoto = file;
            uploadPhotoButton.hidden = true;
            if (photoMessage) {
                photoMessage.classList.remove("error");
                photoMessage.textContent = "";
            }

            const reader = new FileReader();
            reader.onload = () => {
                if (
                    selectedProfilePhoto !== file ||
                    !coverPhoto ||
                    !coverIcon
                ) {
                    return;
                }

                coverPhoto.src = reader.result;
                coverPhoto.hidden = false;
                coverIcon.style.display = "none";
                coverIcon.setAttribute("aria-hidden", "true");
                uploadPhotoButton.hidden = false;
            };
            reader.onerror = () => {
                rejectSelectedPhoto(
                    "The selected image could not be previewed. Please try another file."
                );
            };
            reader.readAsDataURL(file);
        });

    $("sikCancelProfilePhoto").addEventListener("click", () => {
        selectedProfilePhoto = null;
        photoInput.value = "";
        uploadPhotoButton.hidden = true;
        if (photoMessage) {
            photoMessage.classList.remove("error");
            photoMessage.textContent = "";
        }
        restoreSavedPhoto();
    });

    uploadPhotoButton.addEventListener("click", async () => {
        if (!selectedProfilePhoto || uploadInProgress) return;

        const token = getToken();

        if (!token) {
            if (photoMessage) {
                photoMessage.classList.add("error");
                photoMessage.textContent =
                    "Your login session has expired. Please sign in again.";
            }
            return;
        }

        const photoToUpload = selectedProfilePhoto;
        const formData = new FormData();
        formData.append("photo", photoToUpload);

        uploadInProgress = true;
        photoInput.disabled = true;
        uploadPhotoButton.disabled = true;
        uploadPhotoButton.textContent = "Uploading...";
        if (photoMessage) {
            photoMessage.classList.remove("error");
            photoMessage.textContent = "Uploading photo...";
        }

        try {
            const response = await fetch(`${API_URL}/photo`, {
                method: "POST",
                headers: {
                    Accept: "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: formData
            });

            const data = await response.json().catch(() => ({}));

            if (!response.ok) {
                throw new Error(
                    data.message || `Upload failed (HTTP ${response.status}).`
                );
            }

            if (!data.profile_photo_url) {
                throw new Error(
                    "Upload succeeded, but the photo URL was not returned."
                );
            }

            const uploadedPhotoUrl = data.profile_photo_url;
            currentSavedPhotoUrl = uploadedPhotoUrl;
            updateCachedProfile({ profile_photo_url: uploadedPhotoUrl });
            window.siknayanAdminProfile = {
                ...(window.siknayanAdminProfile || {}),
                profile_photo_url: uploadedPhotoUrl
            };

            const refreshedPhotoUrl =
                uploadedPhotoUrl +
                (uploadedPhotoUrl.includes("?") ? "&" : "?") +
                "t=" + Date.now();

            pageAvatars.forEach((img) => {
                setPageAvatar(
                    img,
                    refreshedPhotoUrl,
                    $("topbarAdminName").textContent
                );
            });

            if (coverPhoto && coverIcon) {
                coverPhoto.src = refreshedPhotoUrl;
                coverPhoto.hidden = false;
                coverIcon.style.display = "none";
                coverIcon.setAttribute("aria-hidden", "true");
            }

            selectedProfilePhoto = null;
            photoInput.value = "";
            uploadPhotoButton.hidden = true;
            if (photoMessage) {
                photoMessage.classList.remove("error");
                photoMessage.textContent =
                    "Profile picture updated successfully.";
                setTimeout(() => {
                    if (photoMessage.textContent === "Profile picture updated successfully.") {
                        photoMessage.textContent = "";
                    }
                }, 4000);
            }
        } catch (error) {
            console.error("Profile photo upload error:", error);
            selectedProfilePhoto = null;
            photoInput.value = "";
            uploadPhotoButton.hidden = true;
            restoreSavedPhoto();
            if (photoMessage) {
                photoMessage.classList.add("error");
                photoMessage.textContent =
                    error.message || "Could not upload the profile picture.";
            }
        } finally {
            uploadInProgress = false;
            photoInput.disabled = false;
            uploadPhotoButton.disabled = false;
            uploadPhotoButton.textContent = "Upload Photo";
        }
    });

}
  // Load the saved admin profile when the page initializes.
  
    loadProfile();


    refreshIcons();
})();


/* =========================================================
   CHOOSE WORKSHEETS TO IMPORT
   ---------------------------------------------------------
   window.chooseWorkbookSheets(file, { title, help })
   Resolves with:
     []            the workbook has one sheet (nothing to choose)
     ["A", "B"]    the sheets the admin picked
     null          the admin cancelled
   Needs SheetJS (window.XLSX) to read the sheet names.
========================================================= */

window.chooseWorkbookSheets = async function chooseWorkbookSheets(file, options = {}) {
    if (!window.XLSX) {
        throw new Error("The Excel library did not load. Check your connection and reload the page.");
    }

    const workbook = window.XLSX.read(await file.arrayBuffer(), {
        type: "array",
        bookSheets: true // names only; faster than reading every cell
    });
    const sheetNames = workbook.SheetNames || [];

    if (!sheetNames.length) {
        throw new Error("The workbook does not contain any worksheets.");
    }

    if (sheetNames.length === 1) {
        return [];
    }

    return new Promise(resolve => {
        const green = "#086642";

        const overlay = document.createElement("div");
        overlay.setAttribute("role", "dialog");
        overlay.setAttribute("aria-modal", "true");
        overlay.setAttribute("aria-labelledby", "sheetChooserTitle");
        Object.assign(overlay.style, {
            position: "fixed", inset: "0", zIndex: "10000",
            background: "rgba(0,0,0,.55)", display: "flex",
            alignItems: "center", justifyContent: "center", padding: "20px"
        });

        const panel = document.createElement("div");
        Object.assign(panel.style, {
            background: "#fff", color: "#1f2937", width: "min(560px, 100%)",
            maxHeight: "85vh", overflowY: "auto", padding: "24px",
            borderRadius: "12px", boxShadow: "0 12px 40px rgba(0,0,0,.25)"
        });

        const title = document.createElement("h2");
        title.id = "sheetChooserTitle";
        title.textContent = options.title || "Choose worksheets to import";
        Object.assign(title.style, { margin: "0 0 6px", fontSize: "20px" });

        const help = document.createElement("p");
        help.textContent = options.help ||
            "This workbook has more than one worksheet. Choose the ones to import. " +
            "Each worksheet needs its own header row. The file itself is not changed.";
        Object.assign(help.style, { margin: "0 0 10px", color: "#4b5563", lineHeight: "1.5" });

        const selectAllLabel = document.createElement("label");
        Object.assign(selectAllLabel.style, {
            display: "flex", gap: "10px", alignItems: "center",
            padding: "10px 0", fontWeight: "600", cursor: "pointer"
        });
        const selectAll = document.createElement("input");
        selectAll.type = "checkbox";
        selectAllLabel.append(selectAll, document.createTextNode("Select all worksheets"));

        const list = document.createElement("div");
        Object.assign(list.style, {
            borderTop: "1px solid #e5e7eb", borderBottom: "1px solid #e5e7eb",
            margin: "4px 0 18px", padding: "6px 0"
        });

        const boxes = sheetNames.map(name => {
            const label = document.createElement("label");
            Object.assign(label.style, {
                display: "flex", gap: "10px", alignItems: "center",
                padding: "8px 0", overflowWrap: "anywhere", cursor: "pointer"
            });
            const box = document.createElement("input");
            box.type = "checkbox";
            box.checked = true;
            box.value = name;
            box.dataset.sheetChoice = "true";
            label.append(box, document.createTextNode(name));
            list.append(label);
            return box;
        });

        const actions = document.createElement("div");
        Object.assign(actions.style, {
            display: "flex", flexWrap: "wrap", gap: "10px", justifyContent: "flex-end"
        });

        const makeButton = (text, primary) => {
            const button = document.createElement("button");
            button.type = "button";
            button.textContent = text;
            Object.assign(button.style, {
                padding: "10px 14px", borderRadius: "8px", cursor: "pointer",
                fontWeight: "600", font: "inherit",
                border: `1px solid ${primary ? green : "#cbd5e1"}`,
                background: primary ? green : "#fff",
                color: primary ? "#fff" : "#1f2937"
            });
            actions.append(button);
            return button;
        };

        const cancelButton = makeButton("Cancel", false);
        const allButton = makeButton("Import all sheets", false);
        const selectedButton = makeButton("Import selected", true);
        selectedButton.dataset.sheetImportSelected = "true";
        allButton.dataset.sheetImportAll = "true";
        cancelButton.dataset.sheetCancel = "true";

        const sync = () => {
            const checked = boxes.filter(box => box.checked).length;
            selectAll.checked = checked === boxes.length;
            selectAll.indeterminate = checked > 0 && checked < boxes.length;
            selectedButton.disabled = checked === 0;
            selectedButton.style.opacity = checked === 0 ? "0.5" : "1";
            selectedButton.textContent = checked === boxes.length
                ? "Import selected"
                : `Import ${checked} selected`;
        };

        const finish = value => {
            document.removeEventListener("keydown", onKeydown);
            overlay.remove();
            resolve(value);
        };

        const onKeydown = event => {
            if (event.key === "Escape") finish(null);
        };

        selectAll.addEventListener("change", () => {
            boxes.forEach(box => { box.checked = selectAll.checked; });
            sync();
        });
        boxes.forEach(box => box.addEventListener("change", sync));
        cancelButton.addEventListener("click", () => finish(null));
        allButton.addEventListener("click", () => finish([...sheetNames]));
        selectedButton.addEventListener("click", () => {
            const chosen = boxes.filter(box => box.checked).map(box => box.value);
            if (chosen.length) finish(chosen);
        });
        overlay.addEventListener("click", event => {
            if (event.target === overlay) finish(null);
        });

        panel.append(title, help, selectAllLabel, list, actions);
        overlay.append(panel);
        document.body.append(overlay);
        document.addEventListener("keydown", onKeydown);
        sync();
        boxes[0]?.focus();
    });
};


/* =========================================================
   IN-PAGE TOAST
   ---------------------------------------------------------
   A small message in the corner of the page. Used instead of
   alert(), which shows the site address and port
   (e.g. "127.0.0.1:5501 says").
========================================================= */

window.showAdminToast = function showAdminToast(message, type = "success") {
    let stack = document.getElementById("adminToastStack");

    if (!stack) {
        stack = document.createElement("div");
        stack.id = "adminToastStack";
        stack.style.cssText =
            "position:fixed;top:84px;right:24px;z-index:10000;" +
            "display:flex;flex-direction:column;gap:10px;pointer-events:none;";
        document.body.appendChild(stack);
    }

    const toast = document.createElement("div");
    const isError = type === "error";

    toast.setAttribute("role", "status");
    toast.textContent = message;
    toast.style.cssText =
        "min-width:220px;max-width:360px;padding:12px 18px;border-radius:8px;" +
        "font-size:14px;font-weight:600;color:#fff;pointer-events:auto;" +
        "box-shadow:0 8px 24px rgba(0,0,0,.18);transition:opacity .3s,transform .3s;" +
        "opacity:0;transform:translateY(-6px);" +
        `background:${isError ? "#b42318" : "#1f7a3f"};`;

    stack.appendChild(toast);

    requestAnimationFrame(() => {
        toast.style.opacity = "1";
        toast.style.transform = "translateY(0)";
    });

    setTimeout(() => {
        toast.style.opacity = "0";
        toast.style.transform = "translateY(-6px)";
        setTimeout(() => toast.remove(), 300);
    }, 3000);
};


/* =========================================================
   SESSION ENDED
   ---------------------------------------------------------
   Sign-ins last 8 hours (and end after a password change).
   When the server says the sign-in is no longer valid, clear
   it and go back to the login page.
========================================================= */

window.handleAdminSessionExpired = function handleAdminSessionExpired() {
    ["authToken", "token", "isLoggedIn", "userRole", "userName"].forEach(key => {
        try { sessionStorage.removeItem(key); } catch (error) { /* ignore */ }
    });
    ["siknayan_api_token", "token", "access_token"].forEach(key => {
        try { localStorage.removeItem(key); } catch (error) { /* ignore */ }
    });

    if (window.showAdminToast) {
        window.showAdminToast("Your session has ended. Please log in again.", "error");
    }

    setTimeout(() => {
        window.location.replace("../../index.html");
    }, 1200);
};
