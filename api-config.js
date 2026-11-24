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
     * Upload screen: while a file is being sent to the server, a box
     * covers the page with a bar that fills as the file is sent. When
     * the server has saved it, the box shows a check and "Uploaded",
     * then "Done", and closes. It appears for any request whose body
     * (FormData) holds a file, so every upload in every portal gets it
     * without extra code.
     *
     * fetch() can't report how much of a file has been sent, so these
     * requests are sent with XMLHttpRequest, which can; the page still
     * gets a normal fetch Response back.
     */
    const ICON_UPLOAD = '<svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true"><path fill="currentColor" d="M19.35 10.04A7.49 7.49 0 0 0 12 4C9.11 4 6.6 5.64 5.35 8.04A5.994 5.994 0 0 0 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM14 13v4h-4v-4H7l5-5 5 5h-3z"/></svg>';
    const ICON_CHECK = '<svg viewBox="0 0 24 24" width="34" height="34" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
    const ICON_FAIL = '<svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" d="M7 7l10 10M17 7L7 17"/></svg>';

    function formatSize(bytes) {
        if (!bytes) return "0 KB";
        if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }

    const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

    const upload = {
        jobs: new Map(),
        nextId: 1,
        overlay: null,
        closeTimer: null,

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
                .sik-upload-box { width: min(380px, 100%); padding: 28px 26px 24px; border-radius: 14px; background: #fff;
                                  text-align: center; box-shadow: 0 12px 40px rgba(0, 0, 0, 0.25); }
                .sik-upload-icon { display: flex; align-items: center; justify-content: center; width: 64px; height: 64px;
                                   margin: 0 auto 14px; border-radius: 50%; background: #e6f2eb; color: #08683c;
                                   transition: background 0.25s, color 0.25s; }
                .sik-upload.is-done .sik-upload-icon { background: #08683c; color: #fff; animation: sik-upload-pop 0.35s ease-out; }
                .sik-upload.is-failed .sik-upload-icon { background: #fdecea; color: #c0392b; }
                .sik-upload-title { margin: 0 0 4px; color: #1f2a24; font-size: 18px; font-weight: 700; }
                .sik-upload-file { margin: 0 0 16px; color: #5f6368; font-size: 13px; overflow-wrap: anywhere; }
                .sik-upload-bar { height: 10px; border-radius: 10px; background: #e6efe9; overflow: hidden; }
                .sik-upload-bar span { display: block; width: 0; height: 100%; border-radius: 10px; background: #08683c;
                                       transition: width 0.2s ease-out; }
                .sik-upload.is-failed .sik-upload-bar span { background: #c0392b; }
                .sik-upload-numbers { display: flex; justify-content: space-between; margin: 8px 0 0; color: #5f6368; font-size: 12px; }
                .sik-upload-numbers strong { color: #08683c; font-size: 13px; }
                .sik-upload-note { margin: 14px 0 0; color: #5f6368; font-size: 13px; line-height: 1.5; }
                .sik-upload.is-done .sik-upload-note { color: #08683c; font-weight: 700; font-size: 15px; }
                @keyframes sik-upload-pop { 0% { transform: scale(0.6); } 70% { transform: scale(1.12); } 100% { transform: scale(1); } }`;
            document.head.appendChild(style);

            const overlay = document.createElement("div");
            overlay.className = "sik-upload";
            overlay.hidden = true;
            overlay.setAttribute("role", "alertdialog");
            overlay.setAttribute("aria-modal", "true");
            overlay.setAttribute("aria-label", "File upload");
            overlay.innerHTML = `
                <div class="sik-upload-box">
                    <div class="sik-upload-icon"></div>
                    <p class="sik-upload-title" aria-live="polite"></p>
                    <p class="sik-upload-file"></p>
                    <div class="sik-upload-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><span></span></div>
                    <div class="sik-upload-numbers"><strong class="sik-upload-percent">0%</strong><span class="sik-upload-size"></span></div>
                    <p class="sik-upload-note"></p>
                </div>`;
            document.body.appendChild(overlay);

            this.overlay = overlay;
            return overlay;
        },

        part(name) {
            return this.overlay.querySelector(`.sik-upload-${name}`);
        },

        // Leaving the page would stop the upload: ask first.
        warnOnLeave(event) {
            event.preventDefault();
            event.returnValue = "";
        },

        start(files) {
            const id = this.nextId++;
            const total = files.reduce((sum, file) => sum + file.size, 0);
            this.jobs.set(id, { loaded: 0, total });

            if (!document.body) return id;

            clearTimeout(this.closeTimer);
            this.build();

            this.overlay.classList.remove("is-done", "is-failed");
            this.part("icon").innerHTML = ICON_UPLOAD;
            this.part("title").textContent = "Uploading...";
            this.part("file").textContent = this.jobs.size === 1
                ? (files.length === 1 ? files[0].name : `${files.length} files`)
                : `${this.jobs.size} uploads`;
            this.part("note").textContent = "Please wait and don't close this page.";
            this.overlay.hidden = false;
            this.draw();

            window.addEventListener("beforeunload", this.warnOnLeave);
            return id;
        },

        progress(id, loaded, total) {
            const job = this.jobs.get(id);
            if (!job) return;
            job.loaded = loaded;
            if (total) job.total = total;
            this.draw();
        },

        draw() {
            if (!this.overlay) return;

            let loaded = 0;
            let total = 0;
            this.jobs.forEach(job => {
                loaded += Math.min(job.loaded, job.total);
                total += job.total;
            });

            const percent = total ? Math.floor((loaded / total) * 100) : 0;

            this.part("bar").firstElementChild.style.width = `${percent}%`;
            this.part("bar").setAttribute("aria-valuenow", String(percent));
            this.part("percent").textContent = `${percent}%`;
            this.part("size").textContent = `${formatSize(loaded)} of ${formatSize(total)}`;

            // All sent: the server is still saving it.
            if (total && loaded >= total) {
                this.part("title").textContent = "Saving...";
            }
        },

        /** ok: the server saved it. Resolves when the result has been shown. */
        async finish(id, ok) {
            this.jobs.delete(id);
            if (this.jobs.size > 0 || !this.overlay) {
                if (!this.jobs.size) window.removeEventListener("beforeunload", this.warnOnLeave);
                return;
            }

            window.removeEventListener("beforeunload", this.warnOnLeave);

            if (!ok) {
                // The page shows why; close so its message can be read.
                this.overlay.classList.add("is-failed");
                this.part("icon").innerHTML = ICON_FAIL;
                this.part("title").textContent = "Upload failed";
                this.part("note").textContent = "";
                this.closeTimer = setTimeout(() => { this.overlay.hidden = true; }, 900);
                return;
            }

            // Full bar, check and "Uploaded", then "Done", then close.
            this.part("bar").firstElementChild.style.width = "100%";
            this.part("bar").setAttribute("aria-valuenow", "100");
            this.part("percent").textContent = "100%";
            this.overlay.classList.add("is-done");
            this.part("icon").innerHTML = ICON_CHECK;
            this.part("title").textContent = "Uploaded";
            this.part("note").textContent = "";

            await wait(700);
            if (this.jobs.size) return;
            this.part("note").textContent = "Done";

            await wait(600);
            if (this.jobs.size) return;
            this.overlay.hidden = true;
        }
    };

    /** fetch() for an upload, sent with XMLHttpRequest to follow its progress. */
    function sendWithProgress(input, init, onProgress) {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            const signal = init.signal;

            if (signal && signal.aborted) {
                reject(new DOMException("The upload was cancelled.", "AbortError"));
                return;
            }

            xhr.open(String(init.method || "POST").toUpperCase(), String(input), true);
            xhr.responseType = "blob";
            xhr.withCredentials = init.credentials === "include";

            new Headers(init.headers || {}).forEach((value, name) => {
                xhr.setRequestHeader(name, value);
            });

            xhr.upload.onprogress = event => {
                onProgress(event.loaded, event.lengthComputable ? event.total : 0);
            };

            xhr.onload = () => {
                const headers = new Headers();
                xhr.getAllResponseHeaders().trim().split(/[\r\n]+/).forEach(line => {
                    const at = line.indexOf(":");
                    if (at > 0) {
                        try { headers.append(line.slice(0, at).trim(), line.slice(at + 1).trim()); } catch (error) { /* skip */ }
                    }
                });

                const noBody = [101, 204, 205, 304].includes(xhr.status);

                try {
                    resolve(new Response(noBody ? null : xhr.response, {
                        status: xhr.status || 200,
                        statusText: xhr.statusText,
                        headers
                    }));
                } catch (error) {
                    reject(new TypeError("Failed to fetch"));
                }
            };

            xhr.onerror = () => reject(new TypeError("Failed to fetch"));
            xhr.ontimeout = () => reject(new TypeError("Failed to fetch"));
            xhr.onabort = () => reject(new DOMException("The upload was cancelled.", "AbortError"));

            if (signal) signal.addEventListener("abort", () => xhr.abort(), { once: true });

            xhr.send(init.body);
        });
    }

    if (originalFetch) {
        window.fetch = async function siknayanFetch(input, init) {
            const files = upload.filesIn(init && init.body);
            const canTrack = files.length > 0 &&
                typeof XMLHttpRequest !== "undefined" &&
                (typeof input === "string" || input instanceof URL);

            let response;

            if (canTrack) {
                const id = upload.start(files);
                let ok = false;

                try {
                    response = await sendWithProgress(input, init, (loaded, total) => upload.progress(id, loaded, total));
                    ok = response.ok;
                } finally {
                    // On success the check is shown before the page carries on.
                    await upload.finish(id, ok);
                }
            } else {
                response = await originalFetch(input, init);
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
