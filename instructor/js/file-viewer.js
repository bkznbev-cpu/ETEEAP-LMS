/* =========================================================
   SIKNAYAN - FILE VIEWER (file-viewer.js)
   Used by every portal (learner, instructor, Academic Admin).

   "View" shows a file in a new tab instead of downloading it. The tab
   looks like a phone document reader: a white top bar with a Back
   arrow (closes the tab, or returns to the page the file was opened
   from), the file name and a Download button, then the file:
   - PDF: each page is drawn on the page (PDF.js library), so it also
     works on phones, whose browsers often can't show PDFs themselves.
     The first pages are drawn at once, the rest as they scroll near;
   - images, videos and audio are shown on the page;
   - Word .docx is turned into a readable page (mammoth library);
   - other files (for example old .doc) can't be shown by a browser,
     so the tab says so and offers the Download button.
   Converted Word content is shown in a sandboxed frame where nothing
   can run, so links or code inside a learner's file can't reach this
   signed-in page.

   To open faster, a page can call
     const tab = SiknayanFileViewer.openTab(fileName);
   instead of window.open("about:blank", "_blank"): the tab shows a
   loading screen at once and the PDF/Word reader starts loading while
   the file downloads.

   SiknayanFileViewer.show(blob, fileName, tab)
     tab: the window from openTab() (or window.open("about:blank")),
     opened before the download started so the browser doesn't block it.
========================================================= */

(function () {
    "use strict";

    const CDN = "https://cdnjs.cloudflare.com";
    const MAMMOTH_URL = `${CDN}/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js`;
    const PDFJS_URL = `${CDN}/ajax/libs/pdf.js/3.11.174/pdf.min.js`;
    const PDFJS_WORKER_URL = `${CDN}/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;

    const TYPES = {
        pdf: "application/pdf",
        png: "image/png",
        jpg: "image/jpeg",
        jpeg: "image/jpeg",
        gif: "image/gif",
        webp: "image/webp",
        // Videos and audio play in the browser.
        mp4: "video/mp4",
        m4v: "video/mp4",
        webm: "video/webm",
        mov: "video/quicktime",
        mp3: "audio/mpeg",
        wav: "audio/wav"
    };

    const scriptsLoading = {};

    // Connect to the library site early, so a reader loads quicker.
    try {
        if (!document.querySelector(`link[rel="preconnect"][href="${CDN}"]`)) {
            const link = document.createElement("link");
            link.rel = "preconnect";
            link.href = CDN;
            link.crossOrigin = "anonymous";
            document.head.appendChild(link);
        }
    } catch (error) { /* not needed to work */ }

    function escapeHtml(value) {
        return String(value ?? "").replace(/[&<>"']/g, character => ({
            "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
        }[character]));
    }

    function extensionOf(fileName) {
        const match = String(fileName || "").toLowerCase().match(/\.([a-z0-9]+)$/);
        return match ? match[1] : "";
    }

    /** Loads a library once; resolves with window[globalName]. */
    function loadScript(url, globalName, failMessage) {
        if (window[globalName]) return Promise.resolve(window[globalName]);

        scriptsLoading[url] = scriptsLoading[url] || new Promise((resolve, reject) => {
            const script = document.createElement("script");
            script.src = url;
            script.onload = () => (window[globalName] ? resolve(window[globalName]) : reject(new Error(failMessage)));
            script.onerror = () => {
                delete scriptsLoading[url];
                reject(new Error(failMessage));
            };
            document.head.appendChild(script);
        });

        return scriptsLoading[url];
    }

    function loadMammoth() {
        return loadScript(MAMMOTH_URL, "mammoth", "The Word viewer could not be loaded. Check the internet connection.");
    }

    async function loadPdfJs() {
        const message = "The PDF viewer could not be loaded. Check the internet connection.";

        // Both files download at the same time.
        const [pdfjsLib] = await Promise.all([
            loadScript(PDFJS_URL, "pdfjsLib", message),
            // The worker code is loaded into this page too, so PDF.js reads
            // the file here instead of starting a background worker from
            // another site (which some browsers block).
            loadScript(PDFJS_WORKER_URL, "pdfjsWorker", message)
        ]);
        pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL;

        return pdfjsLib;
    }

    /** Starts loading the reader a file will need, ignoring failures. */
    function preload(fileName) {
        const extension = extensionOf(fileName);
        const loading = extension === "pdf" ? loadPdfJs() : extension === "docx" ? loadMammoth() : null;
        if (loading) loading.catch(() => {});
    }

    const ICON_BACK = `<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" fill="currentColor"/></svg>`;
    const ICON_DOWNLOAD = `<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M5 20h14v-2H5v2zM19 9h-4V3H9v6H5l7 7 7-7z" fill="currentColor"/></svg>`;

    function loadingHtml(text) {
        return `<div class="loading"><span class="spinner" aria-hidden="true"></span><p>${escapeHtml(text)}</p></div>`;
    }

    /**
     * Writes the viewer page into the tab once: the top bar and an empty
     * body. Later steps only change the body and the Download button.
     */
    function writeShell(tab, fileName, returnUrl) {
        tab.document.open();
        tab.document.write(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(fileName)}</title>
<style>
    * { box-sizing: border-box; }
    html, body { margin: 0; }
    body { min-height: 100vh; background: #eceff1; color: #1f2a24; font-family: "Segoe UI", Roboto, Arial, sans-serif; }
    .bar { position: sticky; top: 0; z-index: 2; display: flex; align-items: center; gap: 8px; height: 60px; padding: 0 8px;
           background: #fff; box-shadow: 0 1px 4px rgba(0, 0, 0, 0.16); }
    .bar .icon { display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; gap: 6px;
                 min-width: 44px; height: 44px; padding: 0 10px; border: 0; border-radius: 22px; background: transparent;
                 color: #3c4043; font: inherit; font-size: 14px; font-weight: 600; text-decoration: none; cursor: pointer; }
    .bar .icon:hover, .bar .icon:focus-visible { background: #f1f3f4; outline: none; }
    .bar .title { flex: 1; min-width: 0; margin: 0 4px; font-size: 18px; font-weight: 500; color: #202124;
                  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .bar .download { color: #08683c; }
    .bar .download[hidden] { display: none; }
    main { padding: 24px 16px 40px; }
    .loading { display: flex; flex-direction: column; align-items: center; gap: 14px; margin: 18vh auto 0; color: #5f6368; font-size: 15px; }
    .loading p { margin: 0; }
    .spinner { width: 40px; height: 40px; border: 4px solid #d7e4dc; border-top-color: #08683c; border-radius: 50%;
               animation: spin 0.8s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .paper { max-width: 850px; margin: 0 auto; background: #fff; box-shadow: 0 1px 6px rgba(0, 0, 0, 0.15); }
    .paper iframe { display: block; width: 100%; min-height: 70vh; border: 0; }
    .media { display: flex; justify-content: center; }
    .media img, .media video { display: block; max-width: 100%; max-height: calc(100vh - 110px); height: auto;
                               background: #fff; box-shadow: 0 1px 6px rgba(0, 0, 0, 0.15); }
    .media audio { width: min(600px, 100%); margin-top: 40px; }
    .pdf-pages { display: flex; flex-direction: column; align-items: center; gap: 14px; }
    .pdf-page { position: relative; max-width: 100%; background: #fff; box-shadow: 0 1px 6px rgba(0, 0, 0, 0.15); }
    .pdf-page canvas { display: block; width: 100%; height: 100%; }
    .pdf-frame { display: block; width: 100%; height: calc(100vh - 60px); border: 0; }
    main.full { padding: 0; }
    .message { max-width: 520px; margin: 12vh auto 0; padding: 28px; background: #fff; border-radius: 10px;
               text-align: center; box-shadow: 0 1px 6px rgba(0, 0, 0, 0.12); line-height: 1.6; }
    .message a { display: inline-block; margin-top: 12px; padding: 10px 20px; border-radius: 6px;
                 background: #08683c; color: #fff; font-weight: 700; text-decoration: none; }
    @media (max-width: 600px) {
        .bar { height: 56px; padding: 0 4px; }
        .bar .title { font-size: 16px; }
        .bar .download span { display: none; }
        .bar .download { padding: 0; }
        main { padding: 12px 0 24px; }
        .pdf-pages { gap: 8px; }
        .media { padding: 0 8px; }
        .message { margin: 10vh 12px 0; }
    }
</style>
</head>
<body>
<header class="bar">
    <button type="button" class="icon" id="viewerBack" aria-label="Back" title="Back">${ICON_BACK}</button>
    <h1 class="title" id="viewerTitle">${escapeHtml(fileName)}</h1>
    <a class="icon download" id="viewerDownload" hidden aria-label="Download" title="Download">${ICON_DOWNLOAD}<span>Download</span></a>
</header>
<main id="viewerBody">${loadingHtml("Opening the file...")}</main>
<script>
    // Back: close this tab; if the browser keeps it open, go back to
    // the page the file was opened from.
    document.getElementById("viewerBack").addEventListener("click", function () {
        window.close();
        setTimeout(function () {
            if (!window.closed) {
                window.location.href = ${JSON.stringify(returnUrl).replace(/</g, "\\u003c")};
            }
        }, 300);
    });

    // A Word document is as tall as its content, so the whole tab
    // scrolls like one page (no small scrolling box inside it).
    window.fitFrame = function (frame) {
        function fit() {
            try {
                var doc = frame.contentDocument;
                if (doc && doc.documentElement) {
                    frame.style.height = doc.documentElement.scrollHeight + "px";
                }
            } catch (error) { /* leave the default height */ }
        }
        function watch() {
            fit();
            try {
                var doc = frame.contentDocument;
                if (window.ResizeObserver && doc && doc.body) {
                    new ResizeObserver(fit).observe(doc.body);
                }
                // Pictures in the document change its height as they load.
                Array.prototype.forEach.call(doc.images, function (image) {
                    image.addEventListener("load", fit);
                });
            } catch (error) { /* leave the default height */ }
        }
        frame.addEventListener("load", watch);
        if (frame.contentDocument && frame.contentDocument.readyState === "complete") watch();
        window.addEventListener("resize", fit);
    };
<\/script>
</body>
</html>`);
        tab.document.close();
    }

    function body(tab) {
        return tab.document.getElementById("viewerBody");
    }

    function setBody(tab, html, full) {
        const main = body(tab);
        if (!main) return null;
        main.className = full ? "full" : "";
        main.innerHTML = html;
        return main;
    }

    function setDownload(tab, url, fileName) {
        const link = tab.document.getElementById("viewerDownload");
        if (!link) return;
        link.href = url;
        link.setAttribute("download", fileName);
        link.hidden = false;
    }

    /**
     * Opens the viewer tab at once with a loading screen, and starts
     * loading the reader the file needs. Returns the tab (null when
     * the browser blocks it).
     */
    function openTab(fileName) {
        const tab = window.open("about:blank", "_blank");
        if (!tab) return null;

        const name = fileName || "file";

        try {
            writeShell(tab, name, window.location.href);
        } catch (error) { /* show() writes it later */ }

        preload(name);
        return tab;
    }

    function documentFrame(html) {
        const page = `<!DOCTYPE html><html><head><meta charset="UTF-8"><base target="_blank"><style>
            html { overflow: hidden; }
            body { margin: 0; padding: 56px 64px; font-family: Calibri, Carlito, "Segoe UI", Arial, sans-serif; font-size: 15px;
                   line-height: 1.55; color: #111; overflow-wrap: anywhere; }
            img { max-width: 100%; height: auto; }
            table { border-collapse: collapse; margin: 12px 0; max-width: 100%; }
            td, th { border: 1px solid #ccc; padding: 6px 8px; vertical-align: top; }
            h1, h2, h3 { line-height: 1.3; }
            ul, ol { padding-left: 28px; }
            @media (max-width: 600px) { body { padding: 28px 20px; font-size: 14px; } }
        </style></head><body>${html || "<p><em>This document has no text.</em></p>"}</body></html>`;

        // No allow-scripts: nothing inside the learner's file can run.
        // allow-same-origin only lets this tab measure the page's height.
        return `<div class="paper"><iframe id="docFrame" sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox" srcdoc="${escapeHtml(page)}" title="Document"></iframe></div>`;
    }

    /**
     * Draws the PDF into the tab: the first pages at once, the others
     * when they scroll near, so a long file opens quickly.
     */
    async function renderPdf(tab, data) {
        const pdfjsLib = await loadPdfJs();
        const pdf = await pdfjsLib.getDocument({ data }).promise;

        if (tab.closed) return;

        const container = tab.document.getElementById("pdfPages");
        if (!container) return;

        // Sharp on phones without drawing huge pictures.
        const ratio = Math.min(tab.devicePixelRatio || 1, 2);
        const available = () => Math.min(tab.document.documentElement.clientWidth - (tab.innerWidth <= 600 ? 0 : 32), 900);

        const first = await pdf.getPage(1);
        const firstSize = first.getViewport({ scale: 1 });

        const slots = [];
        const fragment = tab.document.createDocumentFragment();

        for (let number = 1; number <= pdf.numPages; number++) {
            const slot = tab.document.createElement("div");
            slot.className = "pdf-page";
            slot.dataset.page = String(number);
            slot.setAttribute("aria-label", `Page ${number} of ${pdf.numPages}`);
            // Room for the page until it is drawn (most PDFs have one page size).
            const width = Math.max(available(), 200);
            slot.style.width = `${width}px`;
            slot.style.height = `${Math.round(width * firstSize.height / firstSize.width)}px`;
            slots.push(slot);
            fragment.appendChild(slot);
        }

        container.innerHTML = "";
        container.appendChild(fragment);

        const drawn = new Set();

        async function draw(number) {
            if (drawn.has(number) || tab.closed) return;
            drawn.add(number);

            const page = number === 1 ? first : await pdf.getPage(number);
            const width = Math.max(available(), 200);
            const scale = width / page.getViewport({ scale: 1 }).width;
            const viewport = page.getViewport({ scale: scale * ratio });

            const slot = slots[number - 1];
            const canvas = tab.document.createElement("canvas");
            canvas.width = Math.floor(viewport.width);
            canvas.height = Math.floor(viewport.height);

            slot.style.width = `${Math.floor(viewport.width / ratio)}px`;
            slot.style.height = `${Math.floor(viewport.height / ratio)}px`;
            slot.appendChild(canvas);

            await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
        }

        // The first two pages right away.
        await draw(1);
        if (pdf.numPages > 1) draw(2).catch(() => {});

        const Observer = tab.IntersectionObserver;

        if (!Observer) {
            // Old browser: draw the rest one after another.
            for (let number = 3; number <= pdf.numPages; number++) {
                await draw(number);
            }
            return;
        }

        const observer = new Observer(entries => {
            entries.forEach(entry => {
                if (!entry.isIntersecting) return;
                observer.unobserve(entry.target);
                draw(Number(entry.target.dataset.page)).catch(() => {});
            });
        }, { rootMargin: "1200px 0px" });

        slots.slice(2).forEach(slot => observer.observe(slot));
    }

    async function show(blob, fileName, tab) {
        const name = fileName || "file";
        let extension = extensionOf(name);

        // Where Back goes if the browser won't close the tab.
        const returnUrl = window.location.href;

        // No usable extension in the name: use the type the server sent.
        if (!TYPES[extension] && extension !== "docx" && extension !== "doc") {
            const fromType = Object.keys(TYPES).find(key => TYPES[key] === String(blob.type).toLowerCase());
            if (fromType) extension = fromType;
            else if (/wordprocessingml/.test(blob.type)) extension = "docx";
        }

        if (!tab) {
            throw new Error("The browser blocked the new tab. Allow pop-ups for this site and try again.");
        }

        // The new tab must not be able to reach this page.
        try { tab.opener = null; } catch (error) { /* ignore */ }

        // The viewer page was already written by openTab(), or is written now.
        if (!body(tab)) writeShell(tab, name, returnUrl);

        const title = tab.document.getElementById("viewerTitle");
        if (title) title.textContent = name;
        tab.document.title = name;

        const downloadUrl = URL.createObjectURL(blob);
        setTimeout(() => URL.revokeObjectURL(downloadUrl), 600000);
        setDownload(tab, downloadUrl, name);

        const downloadButton = `<a href="${downloadUrl}" download="${escapeHtml(name)}">Download</a>`;

        // PDF: draw its pages; if that fails, let the browser try.
        if (extension === "pdf") {
            setBody(tab, `<div class="pdf-pages" id="pdfPages">${loadingHtml("Opening the PDF...")}</div>`);

            try {
                const data = new Uint8Array(await blob.arrayBuffer());

                // Give up after 20 seconds without the first page.
                await Promise.race([
                    renderPdf(tab, data),
                    new Promise((resolve, reject) => setTimeout(() => {
                        if (!tab.closed && !tab.document.querySelector("#pdfPages canvas")) {
                            reject(new Error("The PDF took too long to open."));
                        }
                    }, 20000))
                ]);
            } catch (error) {
                if (tab.closed) return;
                const url = URL.createObjectURL(new Blob([blob], { type: TYPES.pdf }));
                setTimeout(() => URL.revokeObjectURL(url), 600000);
                setBody(tab, `<iframe class="pdf-frame" src="${url}" title="${escapeHtml(name)}"></iframe>`, true);
            }
            return;
        }

        // Images, videos and audio: shown on the page.
        if (TYPES[extension]) {
            const url = URL.createObjectURL(new Blob([blob], { type: TYPES[extension] }));
            setTimeout(() => URL.revokeObjectURL(url), 600000);

            const kind = TYPES[extension].split("/")[0];
            const media = kind === "image"
                ? `<img src="${url}" alt="${escapeHtml(name)}">`
                : kind === "video"
                    ? `<video src="${url}" controls playsinline></video>`
                    : `<audio src="${url}" controls></audio>`;

            setBody(tab, `<div class="media">${media}</div>`);
            return;
        }

        if (extension === "docx") {
            setBody(tab, loadingHtml("Opening the document..."));

            try {
                const [mammoth, arrayBuffer] = await Promise.all([loadMammoth(), blob.arrayBuffer()]);
                const result = await mammoth.convertToHtml({ arrayBuffer });

                if (tab.closed) return;
                setBody(tab, documentFrame(result.value));

                const frame = tab.document.getElementById("docFrame");
                if (frame && typeof tab.fitFrame === "function") tab.fitFrame(frame);
            } catch (error) {
                if (tab.closed) return;
                setBody(tab, `<div class="message"><p>${escapeHtml(error.message || "This document could not be shown.")}</p>
                    <p>You can download it and open it in Word instead.</p>${downloadButton}</div>`);
            }
            return;
        }

        // Old .doc and other types: browsers can't show them.
        setBody(tab, `<div class="message">
                <p><strong>This file can't be shown in the browser.</strong></p>
                <p>${extension === "doc"
                    ? "It is an older Word (.doc) file. Download it and open it in Word."
                    : "Download it and open it on your computer."}</p>
                ${downloadButton}
            </div>`);
    }

    window.SiknayanFileViewer = { show, openTab, preload };
})();
