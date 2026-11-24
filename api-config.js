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
        if (redirecting || /\/setup(\.html)?$/i.test(window.location.pathname)) return;

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

    /*
     * Upload screen: while a file is being sent to the server, a
     * "Uploading..." box covers the page so the user knows to wait.
     * It appears for any request whose body (FormData) holds a file,
     * so every upload in every portal gets it without extra code.
     */
    const upload = {
        count: 0,
        timer: null,
        overlay: null,

        filesIn(body) {
            if (typeof FormData === "undefined" || !(body instanceof FormData)) return [];
            const files = [];
            body.forEach(value => {
                if (typeof File !== "undefined" && value instanceof File && value.size > 0) files.push(value);
            });
            return files;
        },

        build() {
            if (this.overlay) return this.overlay;

            const style = document.createElement("style");
            style.textContent = `
                .sik-upload { position: fixed; inset: 0; z-index: 2147483000; display: flex; align-items: center; justify-content: center;
                              padding: 20px; background: rgba(15, 30, 22, 0.55); font-family: "Segoe UI", Roboto, Arial, sans-serif; }
                .sik-upload[hidden] { display: none; }
                .sik-upload-box { width: min(360px, 100%); padding: 28px 24px; border-radius: 14px; background: #fff;
                                  text-align: center; box-shadow: 0 12px 40px rgba(0, 0, 0, 0.25); }
                .sik-upload-spinner { width: 46px; height: 46px; margin: 0 auto 16px; border: 4px solid #d7e4dc;
                                      border-top-color: #08683c; border-radius: 50%; animation: sik-upload-spin 0.8s linear infinite; }
                .sik-upload-title { margin: 0 0 6px; color: #1f2a24; font-size: 18px; font-weight: 700; }
                .sik-upload-file { margin: 0 0 10px; color: #08683c; font-size: 14px; font-weight: 600; overflow-wrap: anywhere; }
                .sik-upload-note { margin: 0; color: #5f6368; font-size: 13px; line-height: 1.5; }
                .sik-upload-bar { height: 4px; margin: 16px 0 0; border-radius: 4px; background: #e6efe9; overflow: hidden; }
                .sik-upload-bar span { display: block; width: 40%; height: 100%; border-radius: 4px; background: #08683c;
                                       animation: sik-upload-slide 1.2s ease-in-out infinite; }
                @keyframes sik-upload-spin { to { transform: rotate(360deg); } }
                @keyframes sik-upload-slide { from { transform: translateX(-100%); } to { transform: translateX(250%); } }`;
            document.head.appendChild(style);

            const overlay = document.createElement("div");
            overlay.className = "sik-upload";
            overlay.hidden = true;
            overlay.setAttribute("role", "alertdialog");
            overlay.setAttribute("aria-modal", "true");
            overlay.setAttribute("aria-live", "polite");
            overlay.setAttribute("aria-label", "Uploading");
            overlay.innerHTML = `
                <div class="sik-upload-box">
                    <div class="sik-upload-spinner" aria-hidden="true"></div>
                    <p class="sik-upload-title">Uploading...</p>
                    <p class="sik-upload-file"></p>
                    <p class="sik-upload-note">Please wait and don't close this page.</p>
                    <div class="sik-upload-bar" aria-hidden="true"><span></span></div>
                </div>`;
            document.body.appendChild(overlay);

            this.overlay = overlay;
            return overlay;
        },

        // Leaving the page would stop the upload: ask first.
        warnOnLeave(event) {
            event.preventDefault();
            event.returnValue = "";
        },

        start(files) {
            this.count += 1;
            if (this.count > 1) return;

            const label = files.length === 1 ? files[0].name : `${files.length} files`;

            // Quick uploads (a small photo) finish before the box would
            // flash on screen, so wait a moment before showing it.
            this.timer = setTimeout(() => {
                if (!document.body || this.count === 0) return;
                const overlay = this.build();
                overlay.querySelector(".sik-upload-file").textContent = label;
                overlay.hidden = false;
            }, 300);

            window.addEventListener("beforeunload", this.warnOnLeave);
        },

        finish() {
            this.count = Math.max(0, this.count - 1);
            if (this.count > 0) return;

            clearTimeout(this.timer);
            if (this.overlay) this.overlay.hidden = true;
            window.removeEventListener("beforeunload", this.warnOnLeave);
        }
    };

    if (originalFetch) {
        window.fetch = async function siknayanFetch(input, init) {
            const files = upload.filesIn(init && init.body);
            if (files.length) upload.start(files);

            let response;
            try {
                response = await originalFetch(input, init);
            } finally {
                if (files.length) upload.finish();
            }

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
        // Wait at most 4 seconds for the server, so a slow or unreachable
        // server never leaves the Logout button stuck.
        const controller =
            typeof AbortController === "function" ? new AbortController() : null;
        const timer = controller ? setTimeout(() => controller.abort(), 4000) : null;

        try {
            await fetch(`${window.SIKNAYAN_API_ROOT}/logout`, {
                method: "POST",
                headers: {
                    Accept: "application/json",
                    Authorization: `Bearer ${token}`
                },
                signal: controller ? controller.signal : undefined
            });
        } catch (error) {
            // Offline, server down or too slow: still clear local credentials below.
        } finally {
            if (timer) clearTimeout(timer);
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
