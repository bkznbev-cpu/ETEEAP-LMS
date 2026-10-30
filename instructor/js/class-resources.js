/* =========================================================
   SIKNAYAN - INSTRUCTOR PORTAL
   CLASS LEARNING RESOURCES (class-resources.js)

   The "Learning Resources" tab on class-content.html. The instructor
   adds links (e.g. YouTube), PowerPoint, video and other files to
   support the lessons. Learners in the class see them on their class
   page.

   Uses from class-content.html: API_BASE_URL, courseId, courseData,
   apiRequest, getAuthHeaders, handleUnauthorized, showToast,
   escapeHtml.
========================================================= */

(function () {
    "use strict";

    const el = id => document.getElementById(id);
    const MAX_FILE_BYTES = 100 * 1024 * 1024;

    let resources = [];
    let returnFocus = null;

    function resourcesUrl() {
        return `${API_BASE_URL}/instructor/classes/${encodeURIComponent(courseId)}/resources`;
    }

    function extensionOf(name) {
        const match = String(name || "").toLowerCase().match(/\.([a-z0-9]+)$/);
        return match ? match[1] : "";
    }

    /* Icon and label for each kind of resource */
    function describe(resource) {
        if (resource.type === "link") {
            const isVideo = /youtube\.com|youtu\.be|vimeo\.com|drive\.google\.com\/file/i.test(resource.url || "");
            return isVideo
                ? { icon: "fa-brands fa-youtube", label: "Video link", tone: "video" }
                : { icon: "fa-solid fa-link", label: "Link", tone: "link" };
        }

        const ext = extensionOf(resource.file_name);
        if (["ppt", "pptx"].includes(ext)) return { icon: "fa-solid fa-file-powerpoint", label: "PowerPoint", tone: "ppt" };
        if (["mp4", "webm", "mov", "m4v"].includes(ext)) return { icon: "fa-solid fa-file-video", label: "Video", tone: "video" };
        if (["mp3", "wav"].includes(ext)) return { icon: "fa-solid fa-file-audio", label: "Audio", tone: "video" };
        if (ext === "pdf") return { icon: "fa-solid fa-file-pdf", label: "PDF", tone: "pdf" };
        if (["doc", "docx"].includes(ext)) return { icon: "fa-solid fa-file-word", label: "Word", tone: "link" };
        if (["xls", "xlsx"].includes(ext)) return { icon: "fa-solid fa-file-excel", label: "Excel", tone: "excel" };
        if (["png", "jpg", "jpeg", "gif"].includes(ext)) return { icon: "fa-solid fa-file-image", label: "Image", tone: "link" };
        return { icon: "fa-solid fa-file", label: "File", tone: "link" };
    }

    function formatSize(bytes) {
        const size = Number(bytes) || 0;
        if (size >= 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
        if (size >= 1024) return `${Math.round(size / 1024)} KB`;
        return size ? `${size} B` : "";
    }

    function formatDate(value) {
        const date = new Date(value);
        return Number.isNaN(date.getTime())
            ? ""
            : date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    }

    function render() {
        const list = el("resourceList");
        if (!list) return;

        el("resourcesBadge").textContent = resources.length;
        // The count is on the Learning Resources tab; this line is only for errors.
        el("resourceSummary").textContent = "";

        if (resources.length === 0) {
            list.innerHTML = `
                <div class="empty-state">
                    <i class="fa-solid fa-photo-film"></i>
                    <h3>No learning resources yet</h3>
                    <p>Add links, PowerPoint slides or videos to support your lessons.</p>
                </div>`;
            return;
        }

        list.innerHTML = resources.map(resource => {
            const kind = describe(resource);
            const meta = [
                kind.label,
                resource.module_title ? `Module: ${escapeHtml(resource.module_title)}` : "",
                resource.type === "file" ? escapeHtml(formatSize(resource.file_size)) : "",
                escapeHtml(formatDate(resource.created_at))
            ].filter(Boolean).join(" · ");

            const actions = resource.type === "link"
                ? `<a class="resource-btn" href="${escapeHtml(resource.url)}" target="_blank" rel="noopener noreferrer">
                       <i class="fa-solid fa-arrow-up-right-from-square" aria-hidden="true"></i> Open
                   </a>`
                : `<button type="button" class="resource-btn" data-resource-action="view" data-resource-id="${escapeHtml(resource.id)}">
                       <i class="fa-solid fa-eye" aria-hidden="true"></i> View
                   </button>
                   <button type="button" class="resource-btn" data-resource-action="download" data-resource-id="${escapeHtml(resource.id)}">
                       <i class="fa-solid fa-download" aria-hidden="true"></i> Download
                   </button>`;

            return `
                <article class="resource-item">
                    <span class="resource-icon resource-${kind.tone}"><i class="${kind.icon}" aria-hidden="true"></i></span>
                    <div class="resource-info">
                        <h3>${escapeHtml(resource.title)}</h3>
                        <p class="resource-meta">${meta}</p>
                        ${resource.description ? `<p class="resource-description">${escapeHtml(resource.description)}</p>` : ""}
                        ${resource.type === "file" ? `<p class="resource-file">${escapeHtml(resource.file_name || "")}</p>` : ""}
                    </div>
                    <div class="resource-actions">
                        ${actions}
                        <button type="button" class="resource-btn resource-remove" data-resource-action="remove"
                            data-resource-id="${escapeHtml(resource.id)}" aria-label="Remove ${escapeHtml(resource.title)}">
                            <i class="fa-solid fa-trash-can" aria-hidden="true"></i>
                        </button>
                    </div>
                </article>`;
        }).join("");
    }

    async function load() {
        if (!courseId) return;

        try {
            const data = await apiRequest(resourcesUrl(), { headers: getAuthHeaders() });
            resources = Array.isArray(data.resources) ? data.resources : [];
            render();
        } catch (error) {
            if (error.message === "Unauthorized") return;
            el("resourceSummary").textContent = "Unable to load resources.";
            el("resourceList").innerHTML = `
                <div class="empty-state">
                    <i class="fa-solid fa-triangle-exclamation"></i>
                    <h3>Unable to load resources</h3>
                    <p>${escapeHtml(error.message)}</p>
                </div>`;
        }
    }

    /* ---------- Add Resource pop-up ---------- */

    function selectedType() {
        return document.querySelector('input[name="resourceType"]:checked')?.value || "link";
    }

    function showTypeFields() {
        const isLink = selectedType() === "link";
        el("resourceLinkField").hidden = !isLink;
        el("resourceFileField").hidden = isLink;
        el("resourceUrl").required = isLink;
        el("resourceFile").required = !isLink;
    }

    function fillModuleOptions() {
        const select = el("resourceModule");
        const modules = Array.isArray(courseData?.modules) ? courseData.modules : [];

        select.innerHTML = '<option value="">Whole class (no specific module)</option>' +
            modules.map(module =>
                `<option value="${escapeHtml(module.id)}">${escapeHtml(module.title || module.name || "Module")}</option>`
            ).join("");
    }

    function showError(message) {
        const box = el("resourceError");
        box.textContent = message;
        box.hidden = !message;
    }

    function openModal() {
        el("resourceForm").reset();
        showError("");
        fillModuleOptions();
        showTypeFields();

        returnFocus = document.activeElement;
        el("resourceModal").hidden = false;
        document.body.classList.add("announcement-modal-open");
        el("resourceTitle").focus();
    }

    function closeModal() {
        el("resourceModal").hidden = true;
        document.body.classList.remove("announcement-modal-open");
        el("resourceForm").reset();
        showError("");
        returnFocus?.focus?.();
        returnFocus = null;
    }

    async function submit(event) {
        event.preventDefault();
        showError("");

        const type = selectedType();
        const title = el("resourceTitle").value.trim();
        const url = el("resourceUrl").value.trim();
        const file = el("resourceFile").files?.[0];

        if (!title) return showError("Please enter a title.");
        if (type === "link" && !/^https?:\/\/\S+$/i.test(url)) {
            return showError("Please enter a full link that starts with http:// or https://.");
        }
        if (type === "file" && !file) return showError("Please choose a file to upload.");
        if (type === "file" && file.size > MAX_FILE_BYTES) return showError("The file may not be larger than 100 MB.");

        const body = new FormData();
        body.append("type", type);
        body.append("title", title);
        body.append("description", el("resourceDescription").value.trim());
        if (el("resourceModule").value) body.append("module_id", el("resourceModule").value);
        if (type === "link") body.append("url", url);
        else body.append("file", file);

        const button = el("resourceSubmit");
        button.disabled = true;
        button.querySelector("span").textContent = type === "file" ? "Uploading..." : "Adding...";

        try {
            const data = await apiRequest(resourcesUrl(), {
                method: "POST",
                headers: getAuthHeaders(),
                body
            });

            resources.unshift(data.resource);
            render();
            closeModal();
            showToast("Resource added.");
        } catch (error) {
            if (error.message !== "Unauthorized") showError(error.message);
        } finally {
            button.disabled = false;
            button.querySelector("span").textContent = "Add Resource";
        }
    }

    /* ---------- View / download / remove ---------- */

    async function fetchFile(id, inline) {
        let response;
        try {
            response = await fetch(
                `${API_BASE_URL}/instructor/resources/${encodeURIComponent(id)}/file` + (inline ? "?disposition=inline" : ""),
                { headers: { ...getAuthHeaders(), "Accept": "*/*" } }
            );
        } catch (error) {
            throw new Error("Cannot connect to the server. Check that your API is running.");
        }

        if (response.status === 401) {
            handleUnauthorized();
            throw new Error("Unauthorized");
        }

        if (!response.ok) {
            const data = await response.json().catch(() => null);
            throw new Error(data?.message || "The file could not be opened.");
        }

        return response.blob();
    }

    async function onListClick(event) {
        const button = event.target.closest("[data-resource-action]");
        if (!button) return;

        const id = button.dataset.resourceId;
        const resource = resources.find(item => String(item.id) === String(id));
        if (!resource) return;

        const action = button.dataset.resourceAction;

        if (action === "remove") {
            if (!(await window.SiknayanDialog.confirm(`Remove "${resource.title}" from this class?`, { title: "Remove resource", confirmText: "Remove", danger: true }))) return;

            button.disabled = true;
            try {
                await apiRequest(`${API_BASE_URL}/instructor/resources/${encodeURIComponent(id)}`, {
                    method: "DELETE",
                    headers: getAuthHeaders()
                });
                resources = resources.filter(item => String(item.id) !== String(id));
                render();
                showToast("Resource removed.");
            } catch (error) {
                button.disabled = false;
                if (error.message !== "Unauthorized") showToast(error.message, "error");
            }
            return;
        }

        const isView = action === "view";
        // Open the tab right away so the browser doesn't block it.
        const tab = isView ? window.open("about:blank", "_blank") : null;
        button.disabled = true;

        try {
            const blob = await fetchFile(id, isView);
            const fileName = resource.file_name || resource.title || "resource";

            if (isView) {
                await window.SiknayanFileViewer.show(blob, fileName, tab);
            } else {
                const url = URL.createObjectURL(blob);
                const link = document.createElement("a");
                link.href = url;
                link.download = fileName;
                document.body.appendChild(link);
                link.click();
                link.remove();
                setTimeout(() => URL.revokeObjectURL(url), 300000);
            }
        } catch (error) {
            tab?.close();
            if (error.message !== "Unauthorized") showToast(error.message, "error");
        } finally {
            button.disabled = false;
        }
    }

    document.addEventListener("DOMContentLoaded", () => {
        if (!el("resourcesPanel")) return;

        el("addResourceButton").addEventListener("click", openModal);
        el("resourceCancel").addEventListener("click", closeModal);
        el("resourceForm").addEventListener("submit", submit);
        el("resourceList").addEventListener("click", onListClick);

        document.querySelectorAll('input[name="resourceType"]').forEach(input =>
            input.addEventListener("change", showTypeFields));

        el("resourceModal").addEventListener("click", event => {
            if (event.target === el("resourceModal")) closeModal();
        });

        document.addEventListener("keydown", event => {
            if (event.key === "Escape" && !el("resourceModal").hidden) closeModal();
        });

        load();
    });
})();
