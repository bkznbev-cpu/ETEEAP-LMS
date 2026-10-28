(function (window) {
    // Where the API is, worked out from the page's own address, so nothing
    // has to be edited per server:
    // - Hosted (docker-compose.prod.yml): the site is on the normal web port
    //   (https://lms.school.edu) and the web server passes /api to Laravel,
    //   so the API is the same address: https://lms.school.edu/api.
    // - Development (Live Server, XAMPP, docker-compose.yml): the API runs
    //   on port 8000 of the same computer.
    //   "127.0.0.1" is used instead of "localhost": on Windows, "localhost"
    //   first tries IPv6 and adds about 0.2 s to every request.
    // Set window.SIKNAYAN_API_ORIGIN before this file to use another address.
    function defaultOrigin() {
        const { protocol, hostname, port, origin } = window.location;

        if (protocol !== "http:" && protocol !== "https:") {
            return "http://127.0.0.1:8000";
        }

        const local = hostname === "localhost" || hostname === "127.0.0.1" || hostname === "";

        // Normal web port on a real server: same address as the site.
        if (!local && port === "") {
            return origin;
        }

        const host = local ? "127.0.0.1" : hostname;
        const name = host.includes(":") ? `[${host}]` : host;

        return `${protocol}//${name}:8000`;
    }

    const apiOrigin = (
        window.SIKNAYAN_API_ORIGIN || defaultOrigin()
    ).replace(/\/+$/, "");

    window.SIKNAYAN_API_ORIGIN = apiOrigin;
    window.SIKNAYAN_API_ROOT = `${apiOrigin}/api`;

    /*
     * Unfinished account setup: when the server answers "set a new
     * password first" or "add and confirm your email first", go to the
     * setup page instead of showing that error on whatever page is open.
     * (Sign-in already does this; this also covers people who were signed
     * in before the rule applied to them.)
     */
    const siteRoot = (document.currentScript && document.currentScript.src)
        ? new URL(".", document.currentScript.src)
        : new URL("/", window.location.href);

    const setupPages = {
        learner: "student/setup.html",
        instructor: "instructor/setup.html",
        academic_admin: "academic-admin/setup.html"
    };

    const originalFetch = window.fetch ? window.fetch.bind(window) : null;
    let redirecting = false;

    function setupRedirect(code) {
        if (redirecting || /\/setup\.html$/i.test(window.location.pathname)) return;

        let role = "";
        try {
            role = (JSON.parse(sessionStorage.getItem("user") || "{}") || {}).role || "";
        } catch (error) {
            role = "";
        }

        redirecting = true;

        if (!setupPages[role]) {
            // Unknown account: sign in again; sign-in sends them to setup.
            window.location.replace(new URL("index.html", siteRoot).href);
            return;
        }

        if (code === "password_setup_required") {
            try { sessionStorage.setItem("firstLogin", "true"); } catch (error) {}
            window.location.replace(new URL(setupPages[role], siteRoot).href);
            return;
        }

        window.location.replace(new URL(setupPages[role] + "?step=email", siteRoot).href);
    }

    if (originalFetch) {
        window.fetch = async function siknayanFetch(input, init) {
            const response = await originalFetch(input, init);

            if (response.status === 403) {
                const url = typeof input === "string" ? input : (input && input.url) || "";

                if (url.indexOf(window.SIKNAYAN_API_ROOT) === 0) {
                    response.clone().json().then(data => {
                        if (data && (data.code === "email_required" || data.code === "password_setup_required")) {
                            setupRedirect(data.code);
                        }
                    }).catch(() => {});
                }
            }

            return response;
        };
    }
})(window);

/*
 * Shared logout for every portal.
 * Revokes the token on the server, clears what this browser stored, then
 * returns to the login page. Works even if the server cannot be reached.
 */
window.siknayanLogout = async function siknayanLogout(redirectUrl) {
    let token = "";

    try {
        token =
            sessionStorage.getItem("authToken") ||
            sessionStorage.getItem("token") ||
            localStorage.getItem("siknayan_api_token") ||
            "";
    } catch (error) {
        token = "";
    }

    if (token && window.SIKNAYAN_API_ROOT) {
        try {
            await fetch(`${window.SIKNAYAN_API_ROOT}/logout`, {
                method: "POST",
                headers: {
                    Accept: "application/json",
                    Authorization: `Bearer ${token}`
                }
            });
        } catch (error) {
            // Offline or server down: still clear local credentials below.
        }
    }

    try {
        sessionStorage.clear();
    } catch (error) {}

    try {
        ["siknayan_api_token", "token", "access_token", "isLoggedIn"].forEach(
            (key) => localStorage.removeItem(key)
        );
    } catch (error) {}

    window.location.replace(redirectUrl || "index.html");
};
