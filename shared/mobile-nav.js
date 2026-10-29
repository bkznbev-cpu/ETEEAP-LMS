/* =========================================================
   SIKNAYAN - PHONE AND TABLET MENU (mobile-nav.js + mobile-nav.css)

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

    function start() {
        const sidebar = document.getElementById("sidebar") || document.querySelector("aside.sidebar");
        const header = document.querySelector("header.topbar, header.header");
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
