/* =========================================================
   SIKNAYAN - PHONE AND TABLET MENU (mobile-nav.js + mobile-nav.css)
   and the header logo link to the dashboard (every screen size).

   On screens 900px wide or narrower, each portal's sidebar becomes a
   slide-in menu opened with a menu button in the header. Wider
   screens are not touched: the desktop sidebar works as before.

   Loaded by each portal's shared script (Academic Admin and System
   Admin js/shared.js, Instructor js/sidebar.js), so pages need no
   extra tags. Pages with their own phone menu opt out with
   data-sk-native-menu on the menu button (the Instructor dashboard)
   or by not loading it (the Learner portal).
========================================================= */
(function () {
    "use strict";

    if (window.SiknayanMobileNav) return;
    window.SiknayanMobileNav = true;

    const PHONE = window.matchMedia("(max-width: 900px)");
    const script = document.currentScript;

    // The styles live next to this script.
    if (script && !document.querySelector('link[data-sk-mobile-nav]')) {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = new URL("mobile-nav.css", script.src).href;
        link.setAttribute("data-sk-mobile-nav", "");
        document.head.appendChild(link);
    }

    const MENU_ICON =
        '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" ' +
        'stroke-width="2.2" stroke-linecap="round" aria-hidden="true" focusable="false">' +
        '<path d="M4 7h16M4 12h16M4 17h16"/></svg>';
    const CLOSE_ICON =
        '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" ' +
        'stroke-width="2.2" stroke-linecap="round" aria-hidden="true" focusable="false">' +
        '<path d="M6 6l12 12M18 6L6 18"/></svg>';

    // The logo and the "MPSU ETEEAP LMS" title in the header open this
    // portal's dashboard, on every page and every screen size.
    const DASHBOARDS = ["academic-admin", "system-admin", "instructor"];

    function linkLogoToDashboard(header) {
        if (!script) return;
        const portal = DASHBOARDS.find(name =>
            location.pathname.split("/").includes(name));
        if (!portal) return;
        const dashboard = new URL("../" + portal + "/", script.src).href;

        const targets = header.querySelectorAll(".brand, .logo-box, .header-titles");
        targets.forEach(target => {
            if (target.closest("a, button")) return;
            target.classList.add("sk-home-link");
            target.setAttribute("role", "link");
            target.setAttribute("tabindex", "0");
            target.setAttribute("aria-label", "Go to the dashboard");
            target.title = "Dashboard";
            target.addEventListener("click", function () {
                location.href = dashboard;
            });
            target.addEventListener("keydown", function (event) {
                if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    location.href = dashboard;
                }
            });
        });
    }


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

    // A header or sidebar photo that can't be loaded (a file missing on the
    // server) shows the person's initials instead of a broken image.
    function nameFor(image) {
        const alt = String(image.alt || "").replace(/\s*profile (photo|picture)\s*$/i, "").trim();
        const header = document.querySelector("#topbarAdminName, #headerInstructorName, #headerName, .profile-info strong");
        const fromHeader = header ? header.textContent.trim() : "";
        return /avatar|logo|profile|picture/i.test(alt) || !alt ? fromHeader : alt;
    }

    function fixBrokenAvatar(image) {
        if (!image || image.dataset.skInitials === "1") return;
        image.dataset.skInitials = "1";
        image.src = initialsAvatar(nameFor(image));
        image.style.visibility = "visible";
    }

    const AVATARS = "header img.profile-avatar, header #headerAvatar, header .avatar-ring img, .sidebar-avatar, #sidebarAdminAvatar";

    document.addEventListener("error", function (event) {
        const image = event.target;
        if (image && image.tagName === "IMG" && image.matches(AVATARS)) fixBrokenAvatar(image);
    }, true);

    // A new photo (after an upload) may be tried again.
    document.addEventListener("load", function (event) {
        const image = event.target;
        if (image && image.tagName === "IMG" && image.matches(AVATARS) && !String(image.src).startsWith("data:")) {
            delete image.dataset.skInitials;
        }
    }, true);

    function start() {
        document.querySelectorAll(AVATARS).forEach(image => {
            if (image.complete && image.getAttribute("src") && image.naturalWidth === 0) fixBrokenAvatar(image);
        });

        const header = document.querySelector("header.topbar, header.header");
        if (header) linkLogoToDashboard(header);

        const sidebar = document.getElementById("sidebar") || document.querySelector("aside.sidebar");
        if (!sidebar || !header) return;

        let button = header.querySelector("#menuToggle");
        if (button && button.hasAttribute("data-sk-native-menu")) return;

        if (!button) {
            button = document.createElement("button");
            button.type = "button";
            header.insertBefore(button, header.firstElementChild);
        }
        button.classList.add("sk-menu-btn");
        if (!sidebar.id) sidebar.id = "sidebar";
        button.setAttribute("aria-controls", sidebar.id);

        sidebar.classList.add("sk-drawer");
        header.classList.add("sk-header");
        const main = document.querySelector(".main-content");
        if (main) main.classList.add("sk-main");

        const backdrop = document.createElement("div");
        backdrop.className = "sk-backdrop";
        backdrop.setAttribute("aria-hidden", "true");
        document.body.appendChild(backdrop);

        const root = document.documentElement;

        function headerBottom() {
            // The menu opens just below the header, wherever it is now.
            const bottom = Math.max(0, Math.round(header.getBoundingClientRect().bottom));
            root.style.setProperty("--sk-header-h", bottom + "px");
        }

        function setOpen(open) {
            if (open) headerBottom();
            root.classList.toggle("sk-nav-open", open);
            button.setAttribute("aria-expanded", String(open));
            const text = open ? "Close menu" : "Open menu";
            button.setAttribute("aria-label", text);
            button.title = text;
            button.innerHTML = open ? CLOSE_ICON : MENU_ICON;
            // Keyboard users can't tab into the hidden menu.
            if (PHONE.matches) sidebar.toggleAttribute("inert", !open);
        }

        function applyMode() {
            root.classList.toggle("sk-nav", PHONE.matches);
            if (!PHONE.matches) sidebar.removeAttribute("inert");
            setOpen(false);
        }

        // Capture phase, so page scripts that also listen to this button
        // (some Instructor pages had an unconnected one) don't interfere.
        button.addEventListener("click", function (event) {
            if (!PHONE.matches) return;
            event.preventDefault();
            event.stopImmediatePropagation();
            setOpen(!root.classList.contains("sk-nav-open"));
        }, true);

        backdrop.addEventListener("click", function () { setOpen(false); });

        document.addEventListener("keydown", function (event) {
            if (event.key === "Escape" && root.classList.contains("sk-nav-open")) {
                setOpen(false);
                button.focus();
            }
        });

        // Choosing a page closes the menu.
        sidebar.addEventListener("click", function (event) {
            if (PHONE.matches && event.target.closest("a[href]")) setOpen(false);
        });

        if (PHONE.addEventListener) PHONE.addEventListener("change", applyMode);
        else PHONE.addListener(applyMode);
        window.addEventListener("resize", function () {
            if (root.classList.contains("sk-nav-open")) headerBottom();
        });

        applyMode();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", start);
    } else {
        start();
    }
})();
