/* =========================================================
   SIKNAYAN - INSTRUCTOR PORTAL
   LOGOUT CONFIRMATION (logout.js)

   The same "Confirm Logout" box as the other portals, on every
   Instructor page. Clicking Logout in the sidebar opens it; Logout ends
   the sign-in on the server (window.siknayanLogout in api-config.js)
   and returns to the login page.

   The pages' own logout handlers (browser confirm boxes, some of which
   didn't end the sign-in on the server) are bypassed.
========================================================= */

(function () {
    "use strict";

    const LOGIN_PAGE = "../index.html";
    const onLogoutPage = /\/logout(\.html)?$/i.test(window.location.pathname);

    const dialog = document.createElement("div");
    dialog.className = "logout-confirm-overlay";
    dialog.id = "logoutConfirm";
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-labelledby", "logoutConfirmTitle");
    dialog.setAttribute("aria-describedby", "logoutConfirmMessage");
    dialog.innerHTML = `
        <section class="logout-confirm-box">
            <h2 id="logoutConfirmTitle">Confirm Logout</h2>
            <p id="logoutConfirmMessage">Are you sure you want to log out?</p>
            <div class="logout-confirm-actions">
                <button type="button" class="logout-cancel" data-logout-cancel>Cancel</button>
                <button type="button" class="logout-confirm" data-logout-confirm>
                    <i class="fa-solid fa-right-from-bracket" aria-hidden="true"></i>
                    Logout
                </button>
            </div>
        </section>`;
    document.body.appendChild(dialog);

    const cancel = dialog.querySelector("[data-logout-cancel]");
    const confirm = dialog.querySelector("[data-logout-confirm]");
    let previousFocus = null;
    let leaving = false;

    function open() {
        previousFocus = document.activeElement;
        dialog.classList.add("open");
        document.body.style.overflow = "hidden";
        cancel.focus();
    }

    function close() {
        dialog.classList.remove("open");
        document.body.style.overflow = "";
        // The old Logout page has nothing behind the box: go back.
        if (onLogoutPage && !leaving) {
            window.location.replace("./");
            return;
        }
        if (previousFocus && previousFocus.isConnected) previousFocus.focus();
    }

    // Runs before the pages' own handlers and stops them.
    document.addEventListener("click", event => {
        const link = event.target.closest && event.target.closest(".sidebar .logout-bottom");
        if (!link) return;
        event.preventDefault();
        event.stopPropagation();
        if (!dialog.classList.contains("open")) open();
    }, true);

    cancel.addEventListener("click", close);

    dialog.addEventListener("click", event => {
        if (event.target === dialog) close();
    });

    document.addEventListener("keydown", event => {
        if (event.key === "Escape" && dialog.classList.contains("open")) close();
    });

    confirm.addEventListener("click", () => {
        leaving = true;
        confirm.disabled = true;
        cancel.disabled = true;

        if (window.siknayanLogout) {
            window.siknayanLogout(LOGIN_PAGE);
            return;
        }

        try {
            sessionStorage.clear();
        } catch (error) {}
        window.location.replace(LOGIN_PAGE);
    });

    // The old Logout page opens the box straight away.
    if (onLogoutPage) open();
})();
