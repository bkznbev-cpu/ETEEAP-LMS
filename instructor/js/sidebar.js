/* =========================================================
   SIKNAYAN - INSTRUCTOR PORTAL
   SIDEBAR TOGGLE (sidebar.js)

   Makes the sidebar toggle work like the Academic Admin portal's:
   a "View" label, the same panel icon in both states, and the
   collapsed/expanded choice is remembered from page to page.

   Load it after the page's own scripts. On wide screens (over 1100px)
   it handles the toggle; narrower screens keep each page's own
   slide-in menu behaviour.
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


(function () {
    "use strict";

    const STORAGE_KEY = "siknayan_instructor_sidebar_collapsed";
    const WIDE_SCREEN = "(min-width: 1101px)";

    // Same drawing as the admin's Lucide "panel-left" icon.
    const PANEL_ICON =
        '<svg class="panel-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" ' +
        'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" ' +
        'stroke-linejoin="round" aria-hidden="true" focusable="false">' +
        '<rect width="18" height="18" x="3" y="3" rx="2"></rect>' +
        '<path d="M9 3v18"></path></svg>';

    const sidebar = document.querySelector(".sidebar");
    const toggle = sidebar && sidebar.querySelector(".view-header .view-toggle-btn");
    if (!sidebar || !toggle) return;

    const label = sidebar.querySelector(".view-header .view-label");
    const mainContent = document.querySelector(".main-content");

    function isWide() {
        return window.matchMedia(WIDE_SCREEN).matches;
    }

    function readSaved() {
        try {
            return localStorage.getItem(STORAGE_KEY) === "true";
        } catch (error) {
            return false;
        }
    }

    function save(collapsed) {
        try {
            localStorage.setItem(STORAGE_KEY, String(collapsed));
        } catch (error) {
            // Not remembered, but the toggle still works.
        }
    }

    function setCollapsed(collapsed) {
        sidebar.classList.toggle("collapsed", collapsed);
        // Pages shift their content with one of these two hooks.
        if (mainContent) mainContent.classList.toggle("expanded", collapsed);
        document.body.classList.toggle("sidebar-collapsed", collapsed);

        const text = collapsed ? "Expand sidebar" : "Collapse sidebar";
        toggle.setAttribute("aria-label", text);
        toggle.setAttribute("aria-expanded", String(!collapsed));
        toggle.title = text;
    }

    // Look: "View" label and the panel icon. The page's old arrow icon is
    // kept (hidden by shell.css) because some page scripts still update it.
    if (label) label.textContent = "View";
    if (!toggle.querySelector(".panel-icon")) {
        toggle.insertAdjacentHTML("afterbegin", PANEL_ICON);
    }
    toggle.type = "button";

    // Runs before the page's own click handler; on wide screens it
    // handles the click and stops the page's handler from also running.
    document.addEventListener("click", event => {
        if (!isWide() || !event.target.closest || event.target.closest(".view-toggle-btn") !== toggle) {
            return;
        }

        event.stopPropagation();
        event.preventDefault();

        const collapsed = !sidebar.classList.contains("collapsed");
        setCollapsed(collapsed);
        save(collapsed);
    }, true);

    // Apply the remembered choice without the slide animation.
    if (isWide()) {
        sidebar.style.transition = "none";
        if (mainContent) mainContent.style.transition = "none";
        setCollapsed(readSaved());
        window.requestAnimationFrame(() => {
            window.requestAnimationFrame(() => {
                sidebar.style.transition = "";
                if (mainContent) mainContent.style.transition = "";
            });
        });
    }

    // Going from a narrow to a wide window: restore the remembered choice.
    window.matchMedia(WIDE_SCREEN).addEventListener("change", event => {
        if (event.matches) {
            setCollapsed(readSaved());
        } else {
            // Narrow screens use the page's slide-in menu instead.
            sidebar.classList.remove("collapsed");
            if (mainContent) mainContent.classList.remove("expanded");
            document.body.classList.remove("sidebar-collapsed");
        }
    });
})();
