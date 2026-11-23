/* =========================================================
   SIKNAYAN - PROGRAM MODULE LIBRARY
   ---------------------------------------------------------
   Program-aware Module Library.
   Uses window.SiknayanModuleLibraryData supplied by
   module-library-data.js.

   FRONTEND PROTOTYPE ONLY
========================================================= */

(function initProgramModuleLibrary() {

    "use strict";

    const page = document.querySelector(".program-library-page");
    if (!page) return;

    const data = window.SiknayanModuleLibraryData;

    if (!data) {
        console.error(
            "Module Library: module-library-data.js must load first."
        );
        return;
    }

    /* =====================================================
       PROGRAM
    ===================================================== */

    const params = new URLSearchParams(window.location.search);

    const requestedProgram =
        params.get("program") || "BSCRIM";

    const programCode =
        data.normalizeCode(requestedProgram) || "BSCRIM";

    let program = data.getProgram(programCode);

    /* =====================================================
       DOM
    ===================================================== */

    const courseList = document.getElementById("courseList");
    const moduleSections = document.getElementById("moduleSections");
    const searchInput = document.getElementById("moduleSearch");

    const addCourseButton =
        document.getElementById("addCourseButton");

    const courseModal =
        document.getElementById("courseModal");

    const courseModalTitle =
        document.getElementById("courseModalTitle");

    const addCourseForm =
        document.getElementById("addCourseForm");

    const courseNameInput =
        document.getElementById("courseName");

    const courseCodeInput =
        document.getElementById("courseCode");

    const courseNameError =
        document.getElementById("courseNameError");

    const courseCodeError =
        document.getElementById("courseCodeError");

    const duplicateCourseError =
        document.getElementById("duplicateCourseError");

    const cancelCourseButton =
        document.getElementById("cancelCourseButton");

    const uploadModuleButton =
        document.getElementById("uploadModuleButton");

    const moduleModal =
        document.getElementById("moduleModal");

    const moduleModalTitle =
        document.getElementById("moduleModalTitle");

    const addModuleForm =
        document.getElementById("addModuleForm");

    const moduleTitleInput =
        document.getElementById("moduleTitle");

    const moduleTitleError =
        document.getElementById("moduleTitleError");

    const moduleProgramInput =
        document.getElementById("moduleProgram");

    const moduleCourseSelect =
        document.getElementById("moduleCourse");

    const moduleCourseError =
        document.getElementById("moduleCourseError");

    const moduleFileInput =
        document.getElementById("moduleFileInput");

    const moduleFileError =
        document.getElementById("moduleFileError");

    const selectedFile =
        document.getElementById("selectedFile");

    const fileDropZone =
        document.getElementById("fileDropZone");

    const cancelModuleButton =
        document.getElementById("cancelModuleButton");

    const deleteModal =
        document.getElementById("deleteModal");

    const deleteModalTitle =
        document.getElementById("deleteModalTitle");

    const deleteModalText =
        document.getElementById("deleteModalText");

    const cancelDeleteButton =
        document.getElementById("cancelDeleteButton");

    const confirmDeleteButton =
        document.getElementById("confirmDeleteButton");

    const floatingMenu =
        document.getElementById("courseFloatingMenu");

    const courseEmptyState =
        document.getElementById("courseEmptyState");

    const courseEmptyTitle =
        document.getElementById("courseEmptyTitle");

    const courseEmptyText =
        document.getElementById("courseEmptyText");

    const modulesEmpty =
        document.getElementById("modulesEmpty");

    const heading =
        document.querySelector(".program-library-heading h2");

    const courseDescription =
        courseModal?.querySelector(".modal-header p");

    const moduleDescription =
        moduleModal?.querySelector(".modal-header p");

    if (!courseList || !moduleSections || !floatingMenu) {
        console.error(
            "Module Library: required program-page elements are missing."
        );
        return;
    }

    /* =====================================================
       STATE
    ===================================================== */

    let selectedCourse = "all";
    let editingModuleId = null;
    let deleteType = null;
    let deleteId = null;
    let floatingAnchor = null;

    /* =====================================================
       HELPERS
    ===================================================== */

    function refreshIcons() {
        if (
            window.lucide &&
            typeof window.lucide.createIcons === "function"
        ) {
            window.lucide.createIcons();
        }
    }

    function escapeHtml(value) {
        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function formatFileSize(bytes) {
        const size = Number(bytes || 0);

        if (!size) return "0 KB";

        if (size < 1024 * 1024) {
            return `${Math.max(
                1,
                Math.round(size / 1024)
            )} KB`;
        }

        return `${(
            size / (1024 * 1024)
        ).toFixed(1)} MB`;
    }

    function syncProgram() {
        program =
            data.syncAssignedCounts(programCode);
        return program;
    }

    function saveProgram() {
        data.saveProgram(program);
    }

    function getCourse(courseId) {
        return program.courses.find(
            course =>
                String(course.id) ===
                String(courseId)
        );
    }

    function getModule(moduleId) {
        return program.modules.find(
            module =>
                String(module.id) ===
                String(moduleId)
        );
    }

    function getCourseModuleCount(courseId) {
        return program.modules.filter(
            module =>
                String(module.courseId) ===
                String(courseId)
        ).length;
    }

    function openModal(modal) {
        if (!modal) return;

        modal.classList.add("active");
        modal.setAttribute("aria-hidden", "false");
    }

    function closeModal(modal) {
        if (!modal) return;

        modal.classList.remove("active");
        modal.setAttribute("aria-hidden", "true");
    }

    /* =====================================================
       SIDEBAR STYLE FALLBACK
       -----------------------------------------------------
       The existing stylesheet is supposed to provide these
       rules. This small fallback prevents browser-default
       button borders/padding from appearing if a competing
       rule overrides the sidebar.
    ===================================================== */

    function ensureCourseSidebarStyles() {
        const styleId =
            "siknayan-course-sidebar-style-fix";

        if (document.getElementById(styleId)) {
            return;
        }

        const style =
            document.createElement("style");

        style.id = styleId;

        style.textContent = `
            .program-library-page .course-list {
                display: flex;
                flex-direction: column;
                width: 100%;
                margin: 0;
                padding: 0 0 12px;
                box-sizing: border-box;
            }

            .program-library-page .course-item {
                position: relative;
                display: flex;
                align-items: center;
                width: 100%;
                min-height: 52px;
                margin: 0;
                padding: 6px 8px 6px 22px;
                box-sizing: border-box;
                background: transparent;
                border: none;
            }

            .program-library-page .course-item:hover,
            .program-library-page .course-item.active {
                background: #f3f8f5;
            }

            .program-library-page .course-select {
                flex: 1 1 auto;
                min-width: 0;
                width: 100%;
                min-height: 38px;
                margin: 0;
                padding: 2px 4px 2px 0;
                border: none !important;
                border-radius: 0;
                outline: none !important;
                box-shadow: none !important;
                background: transparent !important;
                color: #666;
                font-family: inherit;
                font-size: 13px;
                line-height: 1.25;
                text-align: left;
                cursor: pointer;
                appearance: none;
                -webkit-appearance: none;
            }

            .program-library-page .course-select:hover,
            .program-library-page .course-select:focus,
            .program-library-page .course-select:active {
                border: none !important;
                outline: none !important;
                box-shadow: none !important;
                background: transparent !important;
            }

            .program-library-page .course-item.active .course-select {
                color: #111;
                font-weight: 700;
            }

            .program-library-page .course-item:hover .course-select {
                color: #08733d;
            }

            .program-library-page .course-item-name {
                display: block;
                margin: 0;
                padding: 0;
            }

            .program-library-page .course-item-code {
                display: block;
                margin-top: 3px;
                color: #8a8a8a;
                font-size: 10px;
                font-weight: 500;
                line-height: 1.2;
            }

            .program-library-page .course-item.active .course-item-code {
                color: #6b766f;
            }

            .program-library-page .course-action-button {
                flex: 0 0 28px;
                width: 28px;
                height: 28px;
                display: grid;
                place-items: center;
                margin: 0;
                padding: 0;
                border: none !important;
                border-radius: 4px;
                outline: none !important;
                box-shadow: none !important;
                background: transparent !important;
                color: #555;
                cursor: pointer;
                opacity: 0;
                appearance: none;
                -webkit-appearance: none;
                transition:
                    opacity 0.15s ease,
                    background 0.15s ease;
            }

            .program-library-page .course-item:hover .course-action-button,
            .program-library-page .course-action-button:focus-visible,
            .program-library-page .course-action-button.menu-open {
                opacity: 1;
            }

            .program-library-page .course-action-button:hover,
            .program-library-page .course-action-button.menu-open {
                background: #e8efeb !important;
            }

            .program-library-page .course-action-button svg {
                width: 16px;
                height: 16px;
            }
        `;

        document.head.appendChild(style);
    }

    /* =====================================================
       PAGE LABELS
    ===================================================== */

    function updatePageLabels() {
        document.title =
            `${programCode} Modules - MPSU ETEEAP LMS`;

        // Only the current part changes; "Module Library" stays a link back.
        const breadcrumbProgram =
            document.getElementById("breadcrumbProgram");

        if (breadcrumbProgram) {
            breadcrumbProgram.textContent = programCode;
        }

        if (heading) {
            heading.textContent =
                `${programCode} Modules`;
        }

        if (courseDescription) {
            courseDescription.textContent =
                `Add a new course to the ${programCode} module library.`;
        }

        if (moduleDescription) {
            moduleDescription.textContent =
                `Publish a learning module to the ${programCode} module library.`;
        }

        if (moduleProgramInput) {
            moduleProgramInput.value =
                programCode;
        }
    }

    /* =====================================================
       COURSE SIDEBAR
    ===================================================== */

    function renderCourses() {
        syncProgram();

        courseList.innerHTML = "";

        /* ALL */
        const allRow =
            document.createElement("div");

        allRow.className =
            "course-item" +
            (
                selectedCourse === "all"
                    ? " active"
                    : ""
            );

        const allButton =
            document.createElement("button");

        allButton.type = "button";
        allButton.className = "course-select";

        const allName =
            document.createElement("span");

        allName.className =
            "course-item-name";

        allName.textContent =
            `All (${program.modules.length})`;

        allButton.appendChild(allName);

        allButton.addEventListener(
            "click",
            () => {
                closeFloatingMenu();

                selectedCourse = "all";

                renderCourses();
                populateCourseSelect("");
                applySearchFilter();
            }
        );

        allRow.appendChild(allButton);
        courseList.appendChild(allRow);

        /* INDIVIDUAL COURSES */
        program.courses.forEach(
            course => {

                const row =
                    document.createElement("div");

                row.className =
                    "course-item" +
                    (
                        selectedCourse === course.id
                            ? " active"
                            : ""
                    );

                row.dataset.course =
                    course.id;

                const selectButton =
                    document.createElement(
                        "button"
                    );

                selectButton.type =
                    "button";

                selectButton.className =
                    "course-select";

                const name =
                    document.createElement(
                        "span"
                    );

                name.className =
                    "course-item-name";

                name.textContent =
                    `${course.name} (${getCourseModuleCount(
                        course.id
                    )})`;

                selectButton.appendChild(name);

                if (course.code) {
                    const code =
                        document.createElement(
                            "span"
                        );

                    code.className =
                        "course-item-code";

                    code.textContent =
                        course.code;

                    selectButton.appendChild(code);
                }

                selectButton.addEventListener(
                    "click",
                    () => {

                        closeFloatingMenu();

                        selectedCourse =
                            course.id;

                        renderCourses();

                        populateCourseSelect(
                            course.id
                        );

                        applySearchFilter();
                    }
                );

                row.appendChild(selectButton);

                const actionButton =
                    document.createElement(
                        "button"
                    );

                actionButton.type =
                    "button";

                actionButton.className =
                    "course-action-button";

                actionButton.setAttribute(
                    "aria-label",
                    `Actions for ${course.name}`
                );

                actionButton.innerHTML =
                    `
                        <i
                            data-lucide="more-vertical"
                        ></i>
                    `;

                actionButton.addEventListener(
                    "click",
                    event => {

                        event.stopPropagation();

                        openCourseMenu(
                            course,
                            actionButton
                        );
                    }
                );

                row.appendChild(actionButton);
                courseList.appendChild(row);
            }
        );

        refreshIcons();
    }

    /* =====================================================
       FLOATING MENU
    ===================================================== */

    function closeFloatingMenu() {
        if (floatingAnchor) {
            floatingAnchor.classList.remove(
                "menu-open"
            );
        }

        floatingAnchor = null;

        floatingMenu.classList.remove("open");
        floatingMenu.innerHTML = "";
        floatingMenu.style.visibility = "hidden";
    }

    function positionFloatingMenu(button) {
        const rect =
            button.getBoundingClientRect();

        floatingMenu.classList.add("open");
        floatingMenu.style.visibility = "hidden";

        const menuRect =
            floatingMenu.getBoundingClientRect();

        let left =
            rect.right + 8;

        if (
            left + menuRect.width >
            window.innerWidth - 10
        ) {
            left =
                rect.left -
                menuRect.width -
                8;
        }

        let top =
            rect.top;

        if (
            top + menuRect.height >
            window.innerHeight - 10
        ) {
            top =
                window.innerHeight -
                menuRect.height -
                10;
        }

        floatingMenu.style.left =
            `${Math.max(10, left)}px`;

        floatingMenu.style.top =
            `${Math.max(10, top)}px`;

        floatingMenu.style.visibility =
            "visible";
    }

    function openFloatingMenu(
        button,
        actions
    ) {
        closeFloatingMenu();

        floatingAnchor =
            button;

        button.classList.add(
            "menu-open"
        );

        actions.forEach(
            action => {

                const item =
                    document.createElement(
                        "button"
                    );

                item.type = "button";

                item.textContent =
                    action.label;

                if (action.danger) {
                    item.className =
                        "delete-course-action";
                }

                if (action.disabled) {
                    item.disabled = true;
                }

                item.addEventListener(
                    "click",
                    event => {

                        event.stopPropagation();

                        closeFloatingMenu();

                        action.handler();
                    }
                );

                floatingMenu.appendChild(item);
            }
        );

        positionFloatingMenu(button);
    }

    function openCourseMenu(
        course,
        button
    ) {
        const count =
            getCourseModuleCount(
                course.id
            );

        openFloatingMenu(
            button,
            [
                {
                    label:
                        count > 0
                            ? `Delete (remove ${count} module${
                                count === 1
                                    ? ""
                                    : "s"
                              } first)`
                            : "Delete",

                    danger: true,

                    disabled:
                        count > 0,

                    handler:
                        () =>
                            openDelete(
                                "course",
                                course.id
                            )
                }
            ]
        );
    }

    function openModuleMenu(
        module,
        button
    ) {
        // Modules are not archived here. A module archived before keeps
        // Restore, so it can still be made active again. Delete works even
        // when the module is assigned: it is removed from those classes too.
        const actions = [
            {
                label: "Edit",

                handler:
                    () =>
                        openEditModule(
                            module.id
                        )
            },

            {
                label: "Delete",

                danger: true,

                handler:
                    () =>
                        openDelete(
                            "module",
                            module.id
                        )
            }
        ];

        if (module.status === "archived") {
            actions.unshift({
                label: "Restore",

                handler:
                    () =>
                        toggleArchive(
                            module.id
                        )
            });
        }

        openFloatingMenu(
            button,
            actions
        );
    }

    /* =====================================================
       MODULE CARDS
    ===================================================== */

    function createModuleCard(module) {
        const card =
            document.createElement("article");

        card.className =
            "module-card";

        card.dataset.moduleId =
            module.id;

        card.dataset.course =
            module.courseId;

        card.dataset.title =
            module.title || "";

        card.innerHTML =
            `
                <button
                    type="button"
                    class="module-menu-button"
                    aria-label="Module actions"
                >
                    <i
                        data-lucide="more-vertical"
                    ></i>
                </button>

                <h4
                    class="module-card-title"
                >
                    ${escapeHtml(
                        module.title
                    )}
                </h4>

                ${module.status === "archived"
                    ? `<span class="module-archived-label">
                           <i data-lucide="archive"></i>
                           Archived
                       </span>`
                    : ""}

                <div class="module-card-actions">
                    <button
                        type="button"
                        class="module-view-button"
                    >
                        <i
                            data-lucide="eye"
                        ></i>

                        <span>
                            View Module
                        </span>
                    </button>

                    <button
                        type="button"
                        class="module-view-button module-assign-button"
                        ${module.status === "archived"
                            ? `disabled title="Restore this module before assigning it."`
                            : `title="Create a class for this module and choose its instructor and learners."`}
                    >
                        <i
                            data-lucide="user-plus"
                        ></i>

                        <span>
                            Assign
                        </span>
                    </button>
                </div>
                `;

            card
                .querySelector(
                    ".module-assign-button"
                )
                .addEventListener(
                    "click",
                    () =>
                        openAssignModule(
                            module.id
                        )
                );

            card
                .querySelector(
                    ".module-menu-button"
                )
                .addEventListener(
                    "click",
                    event => {

                        event.stopPropagation();

                        openModuleMenu(
                            module,
                            event.currentTarget
                        );
                    }
                );

            card
                .querySelector(
                    ".module-view-button"
                )
                .addEventListener(
                    "click",
                    () =>
                        openViewModule(
                            module.id
                        )
                );

            return card;
    }

    function renderModules() {
        syncProgram();

        moduleSections.innerHTML = "";

        program.courses.forEach(
            course => {

                const section =
                    document.createElement(
                        "section"
                    );

                section.className =
                    "module-course-section";

                section.dataset.courseSection =
                    course.id;

                section.innerHTML =
                    `
                        <div
                            class="module-course-heading"
                        >
                            <h3
                                class="module-course-title"
                            >
                                ${escapeHtml(
                                    course.name
                                )}
                            </h3>

                            <span
                                class="module-course-code"
                            >
                                ${escapeHtml(
                                    course.code ||
                                    ""
                                )}
                            </span>
                        </div>

                        <div
                            class="module-grid"
                        ></div>
                    `;

                const grid =
                    section.querySelector(
                        ".module-grid"
                    );

                program.modules
                    .filter(
                        module =>
                            String(
                                module.courseId
                            ) ===
                            String(
                                course.id
                            )
                    )
                    .forEach(
                        module => {

                            grid.appendChild(
                                createModuleCard(
                                    module
                                )
                            );
                        }
                    );

                moduleSections.appendChild(
                    section
                );
            }
        );

        applySearchFilter();
        refreshIcons();
    }

    function applySearchFilter() {
        const query =
            searchInput?.value
                .trim()
                .toLowerCase() ||
            "";

        let visibleCount = 0;

        moduleSections
            .querySelectorAll(
                ".module-course-section"
            )
            .forEach(
                section => {

                    const courseMatch =
                        selectedCourse ===
                            "all" ||
                        String(
                            section.dataset.courseSection
                        ) ===
                        String(
                            selectedCourse
                        );

                    let sectionVisible = 0;

                    section
                        .querySelectorAll(
                            ".module-card"
                        )
                        .forEach(
                            card => {

                                const title =
                                    String(
                                        card.dataset.title ||
                                        ""
                                    )
                                        .toLowerCase();

                                const visible =
                                    courseMatch &&
                                    (
                                        !query ||
                                        title.includes(
                                            query
                                        )
                                    );

                                card.style.display =
                                    visible
                                        ? ""
                                        : "none";

                                if (visible) {
                                    visibleCount++;
                                    sectionVisible++;
                                }
                            }
                        );

                    section.style.display =
                        sectionVisible > 0
                            ? ""
                            : "none";
                }
            );

        if (courseEmptyState) {
            const selected =
                getCourse(
                    selectedCourse
                );

            const selectedModuleCount =
                selectedCourse === "all"
                    ? program.modules.length
                    : program.modules.filter(
                        module =>
                            String(
                                module.courseId
                            ) ===
                            String(
                                selectedCourse
                            )
                    ).length;

            if (
                selectedCourse !== "all" &&
                selected &&
                selectedModuleCount === 0 &&
                !query
            ) {

                courseEmptyState.classList.add(
                    "visible"
                );

                if (courseEmptyTitle) {
                    courseEmptyTitle.textContent =
                        `${selected.name} has no modules yet`;
                }

                if (courseEmptyText) {
                    courseEmptyText.textContent =
                        "Upload a module to add learning material to this course.";
                }

            } else {

                courseEmptyState.classList.remove(
                    "visible"
                );
            }
        }

        if (modulesEmpty) {
            modulesEmpty.classList.toggle(
                "visible",
                visibleCount === 0 &&
                query !== ""
            );
        }
    }

    /* =====================================================
       COURSE MODAL
    ===================================================== */

    function clearCourseErrors() {
        [
            courseNameError,
            courseCodeError,
            duplicateCourseError
        ].forEach(
            error => {
                error?.classList.remove(
                    "visible"
                );
            }
        );
    }

    addCourseButton?.addEventListener(
        "click",
        () => {

            clearCourseErrors();

            addCourseForm?.reset();

            if (courseModalTitle) {
                courseModalTitle.textContent =
                    "Add Course";
            }

            openModal(
                courseModal
            );

            setTimeout(
                () =>
                    courseNameInput?.focus(),
                40
            );
        }
    );

    cancelCourseButton?.addEventListener(
        "click",
        () => {
            closeModal(
                courseModal
            );

            clearCourseErrors();
            addCourseForm?.reset();
        }
    );

    addCourseForm?.addEventListener(
        "submit",
        event => {

            event.preventDefault();

            clearCourseErrors();

            const name =
                courseNameInput.value.trim();

            const code =
                courseCodeInput
                    .value
                    .trim()
                    .toUpperCase();

            if (!name) {
                courseNameError?.classList.add(
                    "visible"
                );
            }

            if (!code) {
                courseCodeError?.classList.add(
                    "visible"
                );
            }

            if (!name || !code) {
                return;
            }

            const duplicate =
                program.courses.some(
                    course =>
                        String(
                            course.name || ""
                        )
                            .trim()
                            .toLowerCase() ===
                            name.toLowerCase()
                        ||
                        String(
                            course.code || ""
                        )
                            .trim()
                            .toLowerCase() ===
                            code.toLowerCase()
                );

            if (duplicate) {
                duplicateCourseError?.classList.add(
                    "visible"
                );
                return;
            }

            const base =
                name
                    .toLowerCase()
                    .replace(
                        /[^a-z0-9]+/g,
                        "-"
                    )
                    .replace(
                        /^-+|-+$/g,
                        ""
                    ) ||
                "course";

            let id = base;
            let number = 2;

            while (
                program.courses.some(
                    course =>
                        course.id === id
                )
            ) {
                id =
                    `${base}-${number}`;
                number++;
            }

            program.courses.push({
                id,
                name,
                code
            });

            selectedCourse = id;

            saveProgram();

            closeModal(
                courseModal
            );

            addCourseForm.reset();

            renderAll();
        }
    );

    /* =====================================================
       MODULE FORM
    ===================================================== */

    function clearModuleErrors() {
        [
            moduleTitleError,
            moduleCourseError,
            moduleFileError
        ].forEach(
            error => {
                error?.classList.remove(
                    "visible"
                );
            }
        );
    }

    function resetModuleForm() {
        addModuleForm?.reset();

        editingModuleId = null;

        if (moduleModalTitle) {
            moduleModalTitle.textContent =
                "Add Module";
        }

        moduleCourseSelect.disabled =
            false;

        moduleProgramInput.value =
            programCode;

        populateCourseSelect(
            selectedCourse === "all"
                ? ""
                : selectedCourse
        );

        if (selectedFile) {
            selectedFile.textContent =
                "";

            selectedFile.classList.remove(
                "visible"
            );
        }

        moduleFileInput.value =
            "";

        clearModuleErrors();
    }

    function populateCourseSelect(
        selected = ""
    ) {

        moduleCourseSelect.innerHTML =
            `
                <option value="">
                    Select course
                </option>
            `;

        program.courses.forEach(
            course => {

                const option =
                    document.createElement(
                        "option"
                    );

                option.value =
                    course.id;

                option.textContent =
                    course.code
                        ? `${course.name} — ${course.code}`
                        : course.name;

                option.selected =
                    String(
                        course.id
                    ) ===
                    String(
                        selected
                    );

                moduleCourseSelect.appendChild(
                    option
                );
            }
        );
    }

    function allowedFile(file) {
        if (!file) return false;

        const name =
            String(
                file.name || ""
            ).toLowerCase();

        // PDF, an image, Word or Excel (the same list as the server).
        const extensionAllowed =
            [".pdf", ".jpg", ".jpeg", ".png", ".webp", ".doc", ".docx", ".xls", ".xlsx"]
                .some(extension => name.endsWith(extension));

        const sizeAllowed =
            Number(
                file.size || 0
            ) <=
            25 * 1024 * 1024;

        return (
            extensionAllowed &&
            sizeAllowed
        );
    }

    function displaySelectedFile(file) {
        clearModuleErrors();

        if (!file) {
            if (selectedFile) {
                selectedFile.textContent =
                    "";
                selectedFile.classList.remove(
                    "visible"
                );
            }
            return;
        }

        if (!allowedFile(file)) {
            moduleFileError?.classList.add(
                "visible"
            );

            moduleFileInput.value = "";

            return;
        }

        if (selectedFile) {
            selectedFile.textContent =
                `${file.name} (${formatFileSize(
                    file.size
                )})`;

            selectedFile.classList.add(
                "visible"
            );
        }
    }

    uploadModuleButton?.addEventListener(
        "click",
        () => {

            resetModuleForm();

            openModal(
                moduleModal
            );

            setTimeout(
                () =>
                    moduleTitleInput?.focus(),
                40
            );
        }
    );

    cancelModuleButton?.addEventListener(
        "click",
        () => {

            closeModal(
                moduleModal
            );

            resetModuleForm();
        }
    );

    moduleFileInput?.addEventListener(
        "change",
        () => {

            displaySelectedFile(
                moduleFileInput.files?.[0] ||
                null
            );
        }
    );

    fileDropZone?.addEventListener(
        "click",
        () => {
            moduleFileInput?.click();
        }
    );

    fileDropZone?.addEventListener(
        "dragover",
        event => {

            event.preventDefault();

            fileDropZone.classList.add(
                "dragover"
            );
        }
    );

    fileDropZone?.addEventListener(
        "dragleave",
        () => {

            fileDropZone.classList.remove(
                "dragover"
            );
        }
    );

    fileDropZone?.addEventListener(
        "drop",
        event => {

            event.preventDefault();

            fileDropZone.classList.remove(
                "dragover"
            );

            const file =
                event.dataTransfer
                    ?.files?.[0];

            if (!file) return;

            try {
                const transfer =
                    new DataTransfer();

                transfer.items.add(file);

                moduleFileInput.files =
                    transfer.files;

            } catch (error) {
                console.warn(
                    "Module Library: unable to set dropped file.",
                    error
                );
            }

            displaySelectedFile(
                file
            );
        }
    );

    addModuleForm?.addEventListener(
        "submit",
       async event => {

            event.preventDefault();

            clearModuleErrors();

            const title =
                moduleTitleInput
                    .value
                    .trim();

            const courseId =
                moduleCourseSelect.value;

            const file =
                moduleFileInput
                    .files?.[0] ||
                null;

            let valid = true;

            if (!title) {
                moduleTitleError?.classList.add(
                    "visible"
                );
                valid = false;
            }

            if (!courseId) {
                moduleCourseError?.classList.add(
                    "visible"
                );
                valid = false;
            }

            if (!editingModuleId && !file) {
                moduleFileError?.classList.add(
                    "visible"
                );
                valid = false;
            }

            if (
                file &&
                !allowedFile(file)
            ) {
                moduleFileError?.classList.add(
                    "visible"
                );
                valid = false;
            }

            if (!valid) {
                return;
            }

            const duplicate =
                program.modules.some(
                    module =>
                        String(
                            module.id
                        ) !==
                        String(
                            editingModuleId ||
                            ""
                        ) &&
                        String(
                            module.courseId
                        ) ===
                        String(
                            courseId
                        ) &&
                        String(
                            module.title || ""
                        )
                            .trim()
                            .toLowerCase() ===
                        title.toLowerCase()
                );

            if (duplicate) {
                moduleTitleError.textContent =
                    "A module with this title already exists in this course.";

                moduleTitleError.classList.add(
                    "visible"
                );

                return;
            }

            let uploadedFile = null;

if (file) {
    try {
        uploadedFile = await uploadModuleFile(file);
    } catch (error) {
        console.error("Module file upload failed:", error);

        if (moduleFileError) {
            moduleFileError.textContent =
                error.message || "Unable to upload the module file.";

            moduleFileError.classList.add("visible");
        }

        return;
    }
}
            if (editingModuleId) {

                const module =
                    getModule(
                        editingModuleId
                    );

                if (!module) {
                    return;
                }

                const assigned =
                    Number(
                        module.assigned ||
                        0
                    );

                module.title =
                    title;

                if (assigned === 0) {
                    module.courseId =
                        courseId;
                }

               if (file && uploadedFile) {
    module.fileObject = file;
    module.fileName = uploadedFile.file_name || file.name;
    module.fileSize = uploadedFile.file_size ?? file.size;
    module.fileType =
        uploadedFile.file_type ||
        file.name.split(".").pop().toLowerCase();

    module.filePath = uploadedFile.file_path;

    module.version = Number(module.version || 1) + 1;

    // Classes using this module switch to the new file too.
    try {
        await replaceFileInClasses(module);
    } catch (error) {
        alert(
            "The new file was saved in the library, but the classes using this module " +
            "could not be updated: " + error.message +
            " Open each class's Manage Modules and save to update them."
        );
    }
}

            } else {

                program.modules.push({

                    id:
                        `module-${Date.now()}-${Math.random()
                            .toString(36)
                            .slice(2, 8)}`,

                    program:
                        programCode,

                    courseId,

                    title,

                    uploaded:
                        new Date()
                            .toLocaleDateString(
                                "en-US",
                                {
                                    month: "short",
                                    day: "numeric",
                                    year: "numeric"
                                }
                            ),

                    assigned:
                        0,

                    status:
                        "active",
fileName: uploadedFile.file_name || file.name,
fileSize: uploadedFile.file_size ?? file.size,
fileType:
    uploadedFile.file_type ||
    file.name.split(".").pop().toLowerCase(),

filePath: uploadedFile.file_path,
fileObject: file,

version: 1
                });

                selectedCourse =
                    courseId;
            }

            saveProgram();

            closeModal(
                moduleModal
            );

            resetModuleForm();

            renderAll();
        }
    );

    /* =====================================================
       EDIT MODULE
    ===================================================== */

    function openEditModule(moduleId) {

        const module =
            getModule(
                moduleId
            );

        if (!module) {
            return;
        }

        editingModuleId =
            module.id;

        moduleModalTitle.textContent =
            "Edit Module";

        moduleProgramInput.value =
            programCode;

        moduleTitleInput.value =
            module.title || "";

        populateCourseSelect(
            module.courseId
        );

        moduleCourseSelect.disabled =
            Number(
                module.assigned ||
                0
            ) > 0;

        moduleFileInput.value =
            "";

        if (selectedFile) {

            if (module.fileName) {

                selectedFile.textContent =
                    `${module.fileName} (${formatFileSize(
                        module.fileSize
                    )})`;

            } else {

                selectedFile.textContent =
                    "No file attached";

            }

            selectedFile.classList.add(
                "visible"
            );
        }

        clearModuleErrors();

        openModal(
            moduleModal
        );

        refreshIcons();
    }

    const MODULE_FILE_API_BASE_URL = window.SIKNAYAN_API_ROOT;

function getModuleFileApiToken() {
    // This tab's own sign-in comes first: the shared copy is replaced
    // when someone signs in or out as another user in a different tab.
    return (
        sessionStorage.getItem("authToken") ||
        window.SIKNAYAN_API_TOKEN ||
        localStorage.getItem("siknayan_api_token") ||
        localStorage.getItem("token") ||
        localStorage.getItem("access_token") ||
        ""
    );
}

async function uploadModuleFile(file) {
    const token = getModuleFileApiToken();

    if (!token) {
        throw new Error("Your Laravel API token is missing. Please log in again.");
    }

    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch(
        `${MODULE_FILE_API_BASE_URL}/admin/module-files`,
        {
            method: "POST",
            headers: {
                Accept: "application/json",
                Authorization: `Bearer ${token}`
            },
            body: formData
        }
    );

    let payload = null;

    try {
        payload = await response.json();
    } catch {
        // Handle a non-JSON server response below.
    }

    if (!response.ok || !payload?.success || !payload?.file_path) {
        throw new Error(
            payload?.message || `File upload failed (${response.status}).`
        );
    }

    return payload;
}

// Point every class that uses this library module at its current file.
async function replaceFileInClasses(module) {
    if (!module?.filePath) {
        return;
    }

    const response = await fetch(
        `${MODULE_FILE_API_BASE_URL}/admin/module-library/${encodeURIComponent(module.id)}/material`,
        {
            method: "PUT",
            headers: {
                Accept: "application/json",
                "Content-Type": "application/json",
                Authorization: `Bearer ${getModuleFileApiToken()}`
            },
            body: JSON.stringify({
                material_path: module.filePath,
                material_name: module.fileName || null
            })
        }
    );

    const payload = await response.json().catch(() => null);

    if (!response.ok || !payload?.success) {
        throw new Error(payload?.message || `Request failed (${response.status}).`);
    }

    return payload.updated_classes;
}

// Save the stored file to this computer under its original name.
async function downloadStoredModuleFile(module) {
    if (!module?.filePath) {
        alert("This module has no saved file path. Please upload its file again.");
        return;
    }

    try {
        const query = new URLSearchParams({
            path: module.filePath,
            name: module.fileName || "module-file"
        });

        const response = await fetch(
            `${MODULE_FILE_API_BASE_URL}/admin/module-files?${query}`,
            {
                headers: {
                    Accept: "*/*",
                    Authorization: `Bearer ${getModuleFileApiToken()}`
                }
            }
        );

        if (!response.ok) {
            const payload = await response.json().catch(() => null);
            throw new Error(payload?.message || `Unable to download the file (${response.status}).`);
        }

        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = module.fileName || "module-file";
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
        alert(error.message || "Unable to download the module file.");
    }
}

async function openStoredModuleFile(module) {
    if (!module?.filePath) {
        alert("This module has no saved file path. Please upload its file again.");
        return;
    }

    const token = getModuleFileApiToken();

    if (!token) {
        alert("Your Laravel API token is missing. Please log in again.");
        return;
    }

    // Open the tab immediately to avoid the browser blocking it.
    const fileTab = window.open("about:blank", "_blank");

    if (!fileTab) {
        alert("Please allow pop-ups for this site to open module files.");
        return;
    }

    try {
        const query = new URLSearchParams({
            path: module.filePath,
            name: module.fileName || "module-file"
        });

        const response = await fetch(
            `${MODULE_FILE_API_BASE_URL}/admin/module-files?${query}`,
            {
                headers: {
                    Accept: "*/*",
                    Authorization: `Bearer ${token}`
                }
            }
        );

        if (!response.ok) {
            let message = `Unable to open file (${response.status}).`;

            try {
                const payload = await response.json();
                message = payload.message || message;
            } catch {
                // Keep the default error message.
            }

            throw new Error(message);
        }

        const blob = await response.blob();

        // Word and Excel can't be shown by the browser itself: the shared
        // viewer shows .docx as a page and offers a named download for the rest.
        if (window.SiknayanFileViewer) {
            await window.SiknayanFileViewer.show(blob, module.fileName || "module-file", fileTab);
            return;
        }

        const fileUrl = URL.createObjectURL(blob);

        fileTab.location.href = fileUrl;

        // Keep the URL available long enough for the browser viewer.
        setTimeout(() => URL.revokeObjectURL(fileUrl), 300000);
    } catch (error) {
        fileTab.close();
        alert(error.message || "Unable to open the uploaded module file.");
    }
}

    /* =====================================================
       VIEW MODULE
    ===================================================== */

    function openViewModule(moduleId) {

        const module =
            getModule(
                moduleId
            );

        if (!module) {
            return;
        }

        const course =
            getCourse(
                module.courseId
            );

        const file =
            module.fileObject instanceof Blob
                ? module.fileObject
                : null;

        const objectUrl =
            file
                ? URL.createObjectURL(file)
                : null;

        const overlay =
            document.createElement("div");

        overlay.className =
            "modal-overlay active";

        overlay.setAttribute(
            "aria-hidden",
            "false"
        );

        overlay.innerHTML =
            `
                <div
                    class="modal-card"
                    role="dialog"
                    aria-modal="true"
                >

                    <div
                        class="modal-header"
                    >

                        <h3>
                            ${escapeHtml(
                                module.title
                            )}
                        </h3>

                        <p>
                            ${escapeHtml(
                                course?.name ||
                                "Unknown Course"
                            )}

                            ${
                                course?.code
                                    ? ` · ${escapeHtml(
                                        course.code
                                    )}`
                                    : ""
                            }
                        </p>

                    </div>

                    <div
                        class="module-view-details"
                    >

                        <div
                            class="module-view-row"
                        >

                            <span>
                                Program
                            </span>

                            <strong>
                                ${escapeHtml(
                                    programCode
                                )}
                            </strong>

                        </div>

                        
<div class="module-view-row">
  <span>Status</span>
  <strong>
    ${escapeHtml(
      String(module.status || "active")
        .charAt(0).toUpperCase() +
      String(module.status || "active").slice(1)
    )}
  </strong>
</div>


                        <div class="module-view-row">

    <span>
        File
    </span>

    <strong>
        ${
            objectUrl
                ? `
                    <a
                        href="${objectUrl}"
                        target="_blank"
                        rel="noopener noreferrer"
                        style="color:#086642; text-decoration:underline; cursor:pointer;"
                    >${escapeHtml(module.fileName || "Open uploaded file")}</a>
                  `
                : module.filePath
                    ? `
                        <a
                            href="#"
                            data-open-module-file="true"
                            style="color:#086642; text-decoration:underline; cursor:pointer;"
                            title="View the file"
                        >${escapeHtml(module.fileName || "Open uploaded file")}</a>
                        <button
                            type="button"
                            data-download-module-file="true"
                            style="margin-left:10px; padding:3px 10px; border:1px solid #086642; border-radius:6px; background:#fff; color:#086642; font-weight:600; cursor:pointer;"
                        >Download</button>
                      `
                    : escapeHtml(module.fileName || "No file attached")
        }
    </strong>

</div>

                        <div
                            class="module-view-row"
                        >

                            <span>
                                Version
                            </span>

                            <strong>
                                v${Number(
                                    module.version ||
                                    1
                                )}
                            </strong>

                        </div>

                        <div
                            class="module-view-row"
                        >

                            <span>
                                Assigned to
                            </span>

                            <strong>
                                ${Number(
                                    module.assigned ||
                                    0
                                )}

                                learner${
                                    Number(
                                        module.assigned ||
                                        0
                                    ) === 1
                                        ? ""
                                        : "s"
                                }
                            </strong>

                        </div>

        

                    <div
                        class="modal-actions"
                    >

                        ${
                            objectUrl
                                ? `
                                    <a
                                        href="${objectUrl}"
                                        download="${escapeHtml(
                                            module.fileName ||
                                            "module-file"
                                        )}"
                                        class="modal-button primary"
                                    >
                                        Download
                                    </a>
                                  `
                                : ""
                        }

                        <button
                            type="button"
                            class="modal-button cancel close-view"
                        >
                            Close
                        </button>

                    </div>

                </div>
            `;

        document.body.appendChild(
            overlay
        );

        const storedFileLink = overlay.querySelector(
    "[data-open-module-file]"
);

storedFileLink?.addEventListener("click", event => {
    event.preventDefault();
    openStoredModuleFile(module);
});

overlay.querySelector("[data-download-module-file]")?.addEventListener("click", event => {
    event.preventDefault();
    downloadStoredModuleFile(module);
});

        const close =
            () => {

                if (objectUrl) {
                    URL.revokeObjectURL(
                        objectUrl
                    );
                }

                overlay.remove();
            };

        overlay
            .querySelector(
                ".close-view"
            )
            .addEventListener(
                "click",
                close
            );

        overlay.addEventListener(
            "click",
            event => {

                if (
                    event.target ===
                    overlay
                ) {
                    close();
                }
            }
        );

        refreshIcons();
    }

    /* =====================================================
       ASSIGN MODULE
       -----------------------------------------------------
       One module in one subject: Assign creates a class for
       the module's course, with one instructor, the ticked
       learners of this program, and only this module.
    ===================================================== */

    async function assignApiRequest(path, options = {}) {
        const token = getModuleFileApiToken();

        if (!token) {
            window.handleAdminSessionExpired?.();
            throw new Error("Your session has ended. Please log in again.");
        }

        const response = await fetch(
            `${MODULE_FILE_API_BASE_URL}${path}`,
            {
                ...options,
                headers: {
                    Accept: "application/json",
                    "Content-Type": "application/json",
                    ...(options.headers || {}),
                    Authorization: `Bearer ${token}`
                }
            }
        );

        const payload = await response.json().catch(() => null);

        if (!response.ok || payload?.success === false) {
            const error = new Error(
                payload?.message || `Request failed (${response.status}).`
            );
            error.status = response.status;
            error.errors = payload?.errors || {};
            throw error;
        }

        return payload;
    }

    function inThisProgram(person) {
        return data.normalizeCode(person?.program || "") === programCode;
    }

    function isActiveAccount(person) {
        return person?.is_active !== false && person?.is_active !== 0;
    }

    async function openAssignModule(moduleId) {
        const module = getModule(moduleId);

        if (!module || module.status === "archived") {
            return;
        }

        const course = getCourse(module.courseId);

        if (!course?.code) {
            alert("This module's course has no course code, so it cannot be assigned.");
            return;
        }

        const overlay = document.createElement("div");
        overlay.className = "modal-overlay active";
        overlay.setAttribute("aria-hidden", "false");

        overlay.innerHTML = `
            <div class="modal-card module-assign-modal" role="dialog" aria-modal="true" aria-labelledby="assignModuleTitle">
                <div class="modal-header">
                    <h3 id="assignModuleTitle">Assign Module</h3>
                    <p>
                        ${escapeHtml(module.title)} ·
                        ${escapeHtml(course.name)} (${escapeHtml(course.code)})
                    </p>
                </div>

                <form id="assignModuleForm" novalidate>
                    <div class="form-group">
                        <label for="assignClassName">Name of Class</label>
                        <input
                            type="text"
                            id="assignClassName"
                            class="form-input"
                            maxlength="100"
                            placeholder="e.g. ${escapeHtml(course.code)}-A"
                            autocomplete="off"
                            required
                        >
                        <div class="field-help">
                            A new class is created for ${escapeHtml(course.code)} with this module only.
                        </div>
                        <div class="form-error" id="assignClassNameError">
                            Please enter the name of the class.
                        </div>
                    </div>

                    <div class="form-group">
                        <label>Instructor</label>
                        <div class="assign-pick-list" id="assignInstructorList">
                            <p class="assign-pick-empty">Loading instructors…</p>
                        </div>
                        <div class="form-error" id="assignInstructorError">
                            Please choose the instructor for this class.
                        </div>
                    </div>

                    <div class="form-group">
                        <div class="assign-learner-heading">
                            <label>Learners enrolled in ${escapeHtml(programCode)}</label>
                            <span class="assign-learner-count" id="assignLearnerCount"></span>
                        </div>
                        <input
                            type="search"
                            id="assignLearnerSearch"
                            class="form-input assign-learner-search"
                            placeholder="Search learners by name or ID"
                            autocomplete="off"
                        >
                        <label class="assign-pick-item assign-select-all">
                            <input type="checkbox" id="assignSelectAll">
                            <span>Select all</span>
                        </label>
                        <div class="assign-pick-list" id="assignLearnerList">
                            <p class="assign-pick-empty">Loading learners…</p>
                        </div>
                        <div class="form-error" id="assignLearnerError">
                            Please tick at least one learner.
                        </div>
                    </div>

                    <div class="form-error" id="assignGeneralError"></div>

                    <div class="modal-actions">
                        <button type="button" class="modal-button cancel" id="assignCancel">
                            Cancel
                        </button>
                        <button type="submit" class="modal-button primary" id="assignSubmit" disabled>
                            Assign
                        </button>
                    </div>
                </form>
            </div>
        `;

        document.body.appendChild(overlay);

        const form = overlay.querySelector("#assignModuleForm");
        const nameInput = overlay.querySelector("#assignClassName");
        const instructorList = overlay.querySelector("#assignInstructorList");
        const learnerList = overlay.querySelector("#assignLearnerList");
        const learnerSearch = overlay.querySelector("#assignLearnerSearch");
        const learnerCount = overlay.querySelector("#assignLearnerCount");
        const selectAll = overlay.querySelector("#assignSelectAll");
        const submitButton = overlay.querySelector("#assignSubmit");
        const generalError = overlay.querySelector("#assignGeneralError");

        let saving = false;

        const close = () => {
            if (!saving) {
                overlay.remove();
            }
        };

        overlay.querySelector("#assignCancel").addEventListener("click", close);
        overlay.addEventListener("click", event => {
            if (event.target === overlay) {
                close();
            }
        });

        const showError = (id, message) => {
            const element = overlay.querySelector(`#${id}`);
            if (!element) return;
            if (message) element.textContent = message;
            element.classList.add("visible");
        };

        const clearErrors = () => {
            overlay.querySelectorAll(".form-error").forEach(element => {
                element.classList.remove("visible");
            });
        };

        setTimeout(() => nameInput.focus(), 40);

        /* Load instructors and learners */

        let instructors = [];
        let learners = [];

        try {
            const [instructorResult, learnerResult] = await Promise.all([
                assignApiRequest("/admin/instructors"),
                assignApiRequest("/admin/learners")
            ]);

            const allInstructors = (instructorResult.instructors || []).filter(isActiveAccount);
            const programInstructors = allInstructors.filter(inThisProgram);

            // Instructors of this program first; if none are set to it, all of them.
            instructors = programInstructors.length ? programInstructors : allInstructors;

            learners = (learnerResult.learners || [])
                .filter(isActiveAccount)
                .filter(inThisProgram)
                .sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
        } catch (error) {
            instructorList.innerHTML = "";
            learnerList.innerHTML = "";
            showError("assignGeneralError", error.message || "Unable to load instructors and learners.");
            return;
        }

        if (!document.body.contains(overlay)) {
            return;
        }

        instructorList.innerHTML = instructors.length
            ? instructors.map(instructor => `
                <label class="assign-pick-item">
                    <input type="radio" name="assignInstructor" value="${escapeHtml(instructor.id)}">
                    <span>
                        <strong>${escapeHtml(instructor.name)}</strong>
                        <small>${escapeHtml(instructor.school_id || instructor.email || "")}</small>
                    </span>
                </label>
            `).join("")
            : `<p class="assign-pick-empty">No active instructors yet. Add one under Accounts first.</p>`;

        learnerList.innerHTML = learners.length
            ? learners.map(learner => `
                <label class="assign-pick-item" data-search="${escapeHtml(
                    `${learner.name || ""} ${learner.school_id || ""} ${learner.email || ""}`.toLowerCase()
                )}">
                    <input type="checkbox" name="assignLearner" value="${escapeHtml(learner.id)}">
                    <span>
                        <strong>${escapeHtml(learner.name)}</strong>
                        <small>${escapeHtml(learner.school_id || learner.email || "")}</small>
                    </span>
                </label>
            `).join("")
            : `<p class="assign-pick-empty">No active learners are enrolled in ${escapeHtml(programCode)} yet.</p>`;

        const learnerBoxes = () =>
            Array.from(learnerList.querySelectorAll('input[name="assignLearner"]'));

        const visibleBoxes = () =>
            learnerBoxes().filter(box => box.closest(".assign-pick-item").style.display !== "none");

        const updateLearnerState = () => {
            const boxes = visibleBoxes();
            const checkedVisible = boxes.filter(box => box.checked).length;
            const checkedAll = learnerBoxes().filter(box => box.checked).length;

            selectAll.checked = boxes.length > 0 && checkedVisible === boxes.length;
            selectAll.indeterminate = checkedVisible > 0 && checkedVisible < boxes.length;
            selectAll.disabled = boxes.length === 0;

            learnerCount.textContent = `${checkedAll} of ${learners.length} selected`;
        };

        learnerList.addEventListener("change", updateLearnerState);

        selectAll.addEventListener("change", () => {
            visibleBoxes().forEach(box => {
                box.checked = selectAll.checked;
            });
            updateLearnerState();
        });

        learnerSearch.addEventListener("input", () => {
            const query = learnerSearch.value.trim().toLowerCase();

            learnerList.querySelectorAll(".assign-pick-item").forEach(item => {
                item.style.display =
                    !query || String(item.dataset.search || "").includes(query) ? "" : "none";
            });

            updateLearnerState();
        });

        updateLearnerState();
        submitButton.disabled = false;

        /* Save */

        form.addEventListener("submit", async event => {
            event.preventDefault();

            if (saving) return;

            clearErrors();

            const className = nameInput.value.trim();
            const instructorId =
                overlay.querySelector('input[name="assignInstructor"]:checked')?.value || "";
            const learnerIds = learnerBoxes()
                .filter(box => box.checked)
                .map(box => Number(box.value));

            let valid = true;

            if (!className) {
                showError("assignClassNameError");
                valid = false;
            }

            if (!instructorId) {
                showError("assignInstructorError");
                valid = false;
            }

            if (learnerIds.length === 0) {
                showError("assignLearnerError");
                valid = false;
            }

            if (!valid) return;

            saving = true;
            submitButton.disabled = true;
            submitButton.textContent = "Assigning…";

            let createdClass = null;

            try {
                // 1. The class for this module's course, with its instructor.
                const classResult = await assignApiRequest("/admin/classes", {
                    method: "POST",
                    body: JSON.stringify({
                        name: course.name,
                        code: className,
                        subject_code: course.code,
                        program: programCode,
                        description: "",
                        instructor_id: Number(instructorId),
                        is_active: true
                    })
                });

                createdClass = classResult.class;

                // 2. This module only.
                await assignApiRequest(
                    `/admin/classes/${encodeURIComponent(createdClass.id)}/modules/sync`,
                    {
                        method: "PUT",
                        body: JSON.stringify({
                            modules: [{
                                library_key: String(module.id),
                                title: String(module.title || "Untitled Module"),
                                description: null,
                                material_path: module.filePath || null,
                                material_name: module.fileName || null,
                                module_order: 1,
                                is_published: module.status === "active"
                            }]
                        })
                    }
                );
            } catch (error) {
                // Don't leave an empty class behind when the module could not be added.
                if (createdClass) {
                    await assignApiRequest(
                        `/admin/classes/${encodeURIComponent(createdClass.id)}`,
                        { method: "DELETE" }
                    ).catch(() => null);
                }

                saving = false;
                submitButton.disabled = false;
                submitButton.textContent = "Assign";

                if (error.errors?.code) {
                    showError("assignClassNameError", "A class with this name already exists. Use a different name.");
                } else {
                    showError("assignGeneralError", error.message || "Unable to assign this module.");
                }
                return;
            }

            // 3. The ticked learners.
            const failed = [];

            for (const learnerId of learnerIds) {
                try {
                    await assignApiRequest(
                        `/admin/classes/${encodeURIComponent(createdClass.id)}/learners`,
                        {
                            method: "POST",
                            body: JSON.stringify({ learner_id: learnerId })
                        }
                    );
                } catch (error) {
                    const learner = learners.find(item => Number(item.id) === learnerId);
                    failed.push(`${learner?.name || learnerId}: ${error.message}`);
                }
            }

            saving = false;
            overlay.remove();

            const enrolled = learnerIds.length - failed.length;

            alert(
                `"${module.title}" is assigned to class ${className} ` +
                `with ${enrolled} learner${enrolled === 1 ? "" : "s"}.` +
                (failed.length
                    ? `\n\nThese learners could not be enrolled:\n${failed.join("\n")}`
                    : "")
            );

            renderAll();
        });
    }

    /* =====================================================
       ARCHIVE / RESTORE
    ===================================================== */

    function toggleArchive(moduleId) {

        const module =
            getModule(
                moduleId
            );

        if (!module) {
            return;
        }

        module.status =
            module.status ===
            "archived"
                ? "active"
                : "archived";

        saveProgram();

        renderAll();
    }

    /* =====================================================
       DELETE
    ===================================================== */

    function openDelete(type, id) {

        const item =
            type === "course"
                ? getCourse(id)
                : getModule(id);

        if (!item) {
            return;
        }

        if (
            type === "course" &&
            getCourseModuleCount(item.id) > 0
        ) {
            alert(
                "Cannot delete this course because it contains modules."
            );
            return;
        }

        deleteType = type;
        deleteId = id;

        if (type === "course") {

            deleteModalTitle.textContent =
                "Delete Course";

            deleteModalText.textContent =
                `Delete ${item.name} (${item.code})? This action cannot be undone.`;

            confirmDeleteButton.textContent =
                "Delete Course";

        } else {

            deleteModalTitle.textContent =
                "Delete Module";

            deleteModalText.textContent =
                `Delete the module "${item.title}"? It is also removed from every class it is assigned to. ` +
                "Learners' submissions and grades stay on record. This action cannot be undone.";

            confirmDeleteButton.textContent =
                "Delete Module";
        }

        openModal(
            deleteModal
        );

        // Password box above Cancel / Delete.
        const passwordField =
            window.SiknayanDialog.passwordField(confirmDeleteButton);

        passwordField.reset();
        passwordField.focus();
    }

    function closeDeleteModal() {

        deleteType = null;
        deleteId = null;

        closeModal(
            deleteModal
        );
    }

    cancelDeleteButton?.addEventListener(
        "click",
        closeDeleteModal
    );

    confirmDeleteButton?.addEventListener(
        "click",
        async () => {

            if (
                !deleteType ||
                !deleteId
            ) {
                return;
            }

            // The admin must enter their password before anything is deleted.
            const passwordField =
                window.SiknayanDialog.passwordField(confirmDeleteButton);

            confirmDeleteButton.disabled = true;
            const deletePassword = await passwordField.verify();
            confirmDeleteButton.disabled = false;

            if (!deletePassword) {
                return;
            }

            if (
                deleteType === "course"
            ) {

                const course =
                    getCourse(
                        deleteId
                    );

                if (!course) {
                    closeDeleteModal();
                    return;
                }

                if (
                    getCourseModuleCount(
                        course.id
                    ) > 0
                ) {
                    alert(
                        "Cannot delete this course because it contains modules."
                    );

                    closeDeleteModal();
                    return;
                }

                program.courses =
                    program.courses.filter(
                        item =>
                            item.id !==
                            course.id
                    );

                if (
                    selectedCourse ===
                    course.id
                ) {
                    selectedCourse =
                        "all";
                }

            } else {

                const module =
                    getModule(
                        deleteId
                    );

                if (!module) {
                    closeDeleteModal();
                    return;
                }

                // Take it out of the classes first, so no class keeps a
                // module that is no longer in the library.
                confirmDeleteButton.disabled = true;

                try {
                    await assignApiRequest(
                        `/admin/module-library/${encodeURIComponent(module.id)}/classes`,
                        {
                            method: "DELETE",
                            headers: { "X-Confirm-Password": deletePassword }
                        }
                    );
                } catch (error) {
                    alert(
                        "The module could not be removed from its classes, so it was not deleted: " +
                        (error.message || "Please try again.")
                    );

                    closeDeleteModal();
                    return;
                } finally {
                    confirmDeleteButton.disabled = false;
                }

                program.modules =
                    program.modules.filter(
                        item =>
                            item.id !==
                            module.id
                    );
            }

            saveProgram();

            closeDeleteModal();

            renderAll();
        }
    );


    /* =====================================================
       MODULE MENU EVENT
    ===================================================== */

    moduleSections.addEventListener(
        "click",
        event => {

            const button =
                event.target.closest(
                    ".module-menu-button"
                );

            if (!button) {
                return;
            }

            event.stopPropagation();

            const card =
                button.closest(
                    ".module-card"
                );

            const module =
                getModule(
                    card?.dataset.moduleId
                );

            if (module) {

                openModuleMenu(
                    module,
                    button
                );
            }
        }
    );
    
    
    /* =====================================================
       SEARCH
    ===================================================== */

    searchInput?.addEventListener(
        "input",
        applySearchFilter
    );

    /* =====================================================
       GENERAL CLICK
    ===================================================== */

    document.addEventListener(
        "click",
        event => {

            if (
                !event.target.closest(
                    ".course-action-button"
                ) &&
                !event.target.closest(
                    ".module-menu-button"
                ) &&
                !floatingMenu.contains(
                    event.target
                )
            ) {
                closeFloatingMenu();
            }
        }
    );

    /* =====================================================
       MODAL OUTSIDE CLICK
    ===================================================== */

    [
        courseModal,
        moduleModal,
        deleteModal
    ].forEach(
        modal => {

            modal?.addEventListener(
                "click",
                event => {

                    if (
                        event.target ===
                        modal
                    ) {
                        closeModal(
                            modal
                        );
                    }
                }
            );
        }
    );

    /* =====================================================
       ESCAPE
    ===================================================== */

    document.addEventListener(
        "keydown",
        event => {

            if (
                event.key !== "Escape"
            ) {
                return;
            }

            closeFloatingMenu();

            closeModal(
                courseModal
            );

            closeModal(
                moduleModal
            );

            closeDeleteModal();

            document
                .querySelectorAll(
                    "body > .modal-overlay"
                )
                .forEach(
                    overlay => {

                        if (
                            overlay !==
                            courseModal &&
                            overlay !==
                            moduleModal &&
                            overlay !==
                            deleteModal
                        ) {
                            overlay.remove();
                        }
                    }
                );
        }
    );

    /* =====================================================
       RESIZE
    ===================================================== */

    window.addEventListener(
        "resize",
        closeFloatingMenu
    );

    /* =====================================================
       INITIALIZE
    ===================================================== */

    function renderAll() {
        syncProgram();
        renderCourses();
        renderModules();
        populateCourseSelect(
            selectedCourse === "all"
                ? ""
                : selectedCourse
        );
        refreshIcons();
    }

    updatePageLabels();
    ensureCourseSidebarStyles();
    renderAll();


    
}

)
(
    
);