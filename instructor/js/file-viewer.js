/* =========================================================
   SIKNAYAN - FILE VIEWER (file-viewer.js)
   Used by every portal (learner, instructor, Academic Admin).

   "View" shows a file in the new tab instead of downloading it. Every
   file is shown on one page with a green bar holding a Back button
   (closes the tab, or returns to the page the file was opened from)
   and a Download link:
   - PDF: each page is drawn on the page (PDF.js library), so it also
     works on phones, whose browsers often can't show PDFs themselves;
   - images, videos and audio are shown on the page;
   - Word .docx is turned into a readable page (mammoth library);
   - other files (for example old .doc) can't be shown by a browser,
     so the tab says so and offers the Download link.
   Converted Word content is shown in a sandboxed frame, so links or
   code inside a learner's file can't reach this signed-in page.

   SiknayanFileViewer.show(blob, fileName, tab)
     tab: a window opened with window.open("about:blank") before the
     download started (so the browser doesn't block it).
========================================================= */

(function () {
    "use strict";

    const MAMMOTH_URL = "https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js";
    const PDFJS_URL = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
    const PDFJS_WORKER_URL = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

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
        const pdfjsLib = await loadScript(PDFJS_URL, "pdfjsLib", message);

        // The worker code is loaded into this page too, so PDF.js reads
        // the file here instead of starting a background worker from
        // another site (which some browsers block).
        await loadScript(PDFJS_WORKER_URL, "pdfjsWorker", message);
        pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL;

        return pdfjsLib;
    }

    /** The green bar: Back, the file name and (when given) Download. */
    function bar(fileName, downloadLink) {
        return `<div class="bar">
            <button type="button" class="back" id="viewerBack" aria-label="Back">&larr; Back</button>
            <strong>${escapeHtml(fileName)}</strong>${downloadLink || ""}
        </div>`;
    }

    /** A simple page in the new tab: the bar, then body HTML. */
    function writePage(tab, fileName, bodyHtml, returnUrl) {
        tab.document.open();
        tab.document.write(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(fileName)}</title>
<style>
    * { box-sizing: border-box; }
    body { margin: 0; background: #eef2ef; color: #1f2a24; font-family: "Segoe UI", Arial, sans-serif; }
    .bar { position: sticky; top: 0; z-index: 2; display: flex; align-items: center; gap: 12px; padding: 10px 16px;
           background: #08683c; color: #fff; border-bottom: 3px solid #e2ac2f; }
    .bar strong { min-width: 0; font-size: 15px; overflow-wrap: anywhere; }
    .bar a { margin-left: auto; padding: 7px 14px; border-radius: 6px; background: #fff; color: #08683c;
             font-size: 13px; font-weight: 700; text-decoration: none; white-space: nowrap; }
    .bar .back { flex-shrink: 0; padding: 7px 12px; border: 1px solid rgba(255, 255, 255, 0.7); border-radius: 6px;
                 background: transparent; color: #fff; font: inherit; font-size: 13px; font-weight: 700; cursor: pointer; }
    .bar .back:hover, .bar .back:focus-visible { background: rgba(255, 255, 255, 0.15); }
    .paper { max-width: 900px; margin: 24px auto; background: #fff; border-radius: 8px;
             box-shadow: 0 6px 24px rgba(0, 0, 0, 0.1); overflow: hidden; }
    .paper iframe { display: block; width: 100%; height: calc(100vh - 120px); border: 0; }
    .media { display: flex; justify-content: center; padding: 16px; }
    .media img, .media video { display: block; max-width: 100%; max-height: calc(100vh - 100px); height: auto;
                               background: #fff; box-shadow: 0 6px 24px rgba(0, 0, 0, 0.1); }
    .media audio { width: min(600px, 100%); margin-top: 40px; }
    .pdf-pages { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 12px; }
    .pdf-pages canvas { display: block; max-width: 100%; background: #fff; box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12); }
    .pdf-frame { display: block; width: 100%; height: calc(100vh - 60px); border: 0; }
    .message { max-width: 560px; margin: 60px auto; padding: 28px; background: #fff; border-radius: 10px;
               text-align: center; box-shadow: 0 6px 24px rgba(0, 0, 0, 0.08); line-height: 1.6; }
    .message a { display: inline-block; margin-top: 12px; padding: 9px 18px; border-radius: 6px;
                 background: #08683c; color: #fff; font-weight: 700; text-decoration: none; }
    @media (max-width: 600px) {
        .bar { gap: 8px; padding: 8px 10px; }
        .bar strong { font-size: 13px; }
        .bar a, .bar .back { padding: 6px 10px; font-size: 12px; }
    }
</style>
</head>
<body>${bodyHtml}
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
<\/script>
</body>
</html>`);
        tab.document.close();
    }

    function documentFrame(html) {
        const page = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
            body { margin: 0; padding: 40px 48px; font-family: Calibri, "Segoe UI", Arial, sans-serif; font-size: 15px; line-height: 1.6; color: #111; }
            img { max-width: 100%; height: auto; }
            table { border-collapse: collapse; margin: 12px 0; }
            td, th { border: 1px solid #ccc; padding: 6px 8px; vertical-align: top; }
            h1, h2, h3 { line-height: 1.3; }
        </style></head><body>${html || "<p><em>This document has no text.</em></p>"}</body></html>`;

        // No allow-scripts: nothing inside the learner's file can run.
        return `<div class="paper"><iframe sandbox="allow-popups allow-popups-to-escape-sandbox" srcdoc="${escapeHtml(page)}" title="Document"></iframe></div>`;
    }

    /** Draws each page of the PDF into the tab, sized to its width. */
    async function renderPdf(tab, url) {
        const pdfjsLib = await loadPdfJs();
        const pdf = await pdfjsLib.getDocument({ url }).promise;
        const container = tab.document.getElementById("pdfPages");

        if (!container) return;

        container.innerHTML = "";

        const ratio = tab.devicePixelRatio || 1;

        for (let number = 1; number <= pdf.numPages; number++) {
            // The tab was closed: stop drawing.
            if (tab.closed) return;

            const page = await pdf.getPage(number);
            const available = Math.min(tab.document.documentElement.clientWidth - 24, 900);
            const scale = Math.max(available, 200) / page.getViewport({ scale: 1 }).width;
            const viewport = page.getViewport({ scale: scale * ratio });

            const canvas = tab.document.createElement("canvas");
            canvas.width = Math.floor(viewport.width);
            canvas.height = Math.floor(viewport.height);
            canvas.style.width = `${Math.floor(viewport.width / ratio)}px`;
            canvas.setAttribute("aria-label", `Page ${number} of ${pdf.numPages}`);
            container.appendChild(canvas);

            await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
        }
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
        const downloadUrl = URL.createObjectURL(blob);
        const downloadLink = `<a href="${downloadUrl}" download="${escapeHtml(name)}">Download</a>`;

        setTimeout(() => URL.revokeObjectURL(downloadUrl), 600000);

        if (!tab) {
            throw new Error("The browser blocked the new tab. Allow pop-ups for this site and try again.");
        }

        // The new tab must not be able to reach this page.
        try { tab.opener = null; } catch (error) { /* ignore */ }

        // PDF: draw its pages; if that fails, let the browser try.
        if (extension === "pdf") {
            const url = URL.createObjectURL(new Blob([blob], { type: TYPES.pdf }));
            setTimeout(() => URL.revokeObjectURL(url), 600000);

            writePage(tab, name, `${bar(name, downloadLink)}
                <div class="pdf-pages" id="pdfPages"><div class="message">Opening the PDF...</div></div>`, returnUrl);

            try {
                // Give up after 20 seconds without the first page.
                await Promise.race([
                    renderPdf(tab, url),
                    new Promise((resolve, reject) => setTimeout(() => {
                        if (!tab.document.querySelector("#pdfPages canvas")) {
                            reject(new Error("The PDF took too long to open."));
                        }
                    }, 20000))
                ]);
            } catch (error) {
                const container = tab.document.getElementById("pdfPages");

                if (container) {
                    container.outerHTML = `<iframe class="pdf-frame" src="${url}" title="${escapeHtml(name)}"></iframe>`;
                }
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

            writePage(tab, name, `${bar(name, downloadLink)}<div class="media">${media}</div>`, returnUrl);
            return;
        }

        if (extension === "docx") {
            writePage(tab, name, `${bar(name, downloadLink)}
                <div class="message">Opening the document...</div>`, returnUrl);

            try {
                const mammoth = await loadMammoth();
                const result = await mammoth.convertToHtml({ arrayBuffer: await blob.arrayBuffer() });
                writePage(tab, name, `${bar(name, downloadLink)}${documentFrame(result.value)}`, returnUrl);
            } catch (error) {
                writePage(tab, name, `${bar(name)}
                    <div class="message"><p>${escapeHtml(error.message || "This document could not be shown.")}</p>
                    <p>You can download it and open it in Word instead.</p>${downloadLink}</div>`, returnUrl);
            }
            return;
        }

        // Old .doc and other types: browsers can't show them.
        writePage(tab, name, `${bar(name)}
            <div class="message">
                <p><strong>This file can't be shown in the browser.</strong></p>
                <p>${extension === "doc"
                    ? "It is an older Word (.doc) file. Download it and open it in Word."
                    : "Download it and open it on your computer."}</p>
                ${downloadLink}
            </div>`, returnUrl);
    }

    window.SiknayanFileViewer = { show };
})();
