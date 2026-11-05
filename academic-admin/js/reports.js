/* =========================================================
SIKNAYAN - ACADEMIC ADMIN
reports.js
Frontend reporting workspace backed by the authenticated
Laravel reports API.
========================================================= */

(function initReportsPage() {

    "use strict";


    /* =====================================================
       PAGE CHECK
    ===================================================== */

    const page =
        document.querySelector(".reports-page");

    if (!page) {
        return;
    }


    /* =====================================================
       REPORT CONFIGURATION
    ===================================================== */

    const REPORTS = {

        learner: {

            cardTitle:
                "Learner Progress",

            title:
                "Learner Progress Report",

            subtitle:
                "Overview of learner progress, module completion, and current status."

        },


        classes: {

            cardTitle:
                "Class Enrollment",

            title:
                "Class Enrollment & Roster Report",

            subtitle:
                "Class membership, instructor assignments, and learner enrollment."

        },


        modules: {

            cardTitle:
                "Module & Submission",

            title:
                "Module & Submission Status Report",

            subtitle:
                "Module distribution with submitted, awaiting-grade, and completed activity."

        },


        instructors: {

            cardTitle:
                "Instructor Workload",

            title:
                "Instructor Workload Report",

            subtitle:
                "Instructor assignments, classes, learner load, and grading queue."

        },


        programs: {

            cardTitle:
                "Program Overview",

            title:
                "Program Overview Report",

            subtitle:
                "Program-level learners, classes, module activity, and progress."

        }

    };


    /* =====================================================
       SHORT DOM HELPER
    ===================================================== */

    const $ =
        id => document.getElementById(id);


    /* =====================================================
       DOM REFERENCES
    ===================================================== */

    const el = {

        updated:
            $("reportUpdated"),

        cards:
            [
                ...document.querySelectorAll(
                    "[data-report]"
                )
            ],

        filters:
            $("reportFilters"),

        summary:
            $("reportSummary"),

        tableTitle:
            $("reportTableTitle"),

        tableSubtitle:
            $("reportTableSubtitle"),

        tableHead:
            $("reportTableHead"),

        tableBody:
            $("reportTableBody"),

        count:
            $("reportCount"),

        empty:
            $("reportEmpty"),

        emptyText:
            $("reportEmptyText"),

        pagination:
            $("reportPagination"),

        previous:
            $("reportPreviousPage"),

        next:
            $("reportNextPage"),

        pageNumbers:
            $("reportPageNumbers"),

        export:
            $("exportReportBtn"),

        print:
            $("printReportBtn"),

        refresh:
            $("refreshReportBtn")

    };


    /* =====================================================
       REPORT STATE
    ===================================================== */

    const PAGE_SIZE = 10;

    let currentReport =
        "learner";

    let currentPage =
        1;

    let rows =
        [];

    let columns =
        [];

    let lastReportData =
        null;


    let reportData = null;
    let reportLoadPromise = null;

    function getApiToken() {
        return (
            window.SIKNAYAN_API_TOKEN ||
            sessionStorage.getItem("authToken") ||
            sessionStorage.getItem("token") ||
            localStorage.getItem("siknayan_api_token") ||
            localStorage.getItem("token") ||
            localStorage.getItem("access_token") ||
            ""
        );
    }

    async function fetchReportData() {
        const token = getApiToken();

        if (!token) {
            const missing = new Error("Your login session is missing. Please log in again.");
            missing.sessionExpired = true;
            throw missing;
        }

        if (!window.SIKNAYAN_API_ROOT) {
            throw new Error("The Laravel API is not configured for this page.");
        }

        const response = await fetch(
            `${window.SIKNAYAN_API_ROOT}/admin/reports`,
            {
                headers: {
                    Accept: "application/json",
                    Authorization: `Bearer ${token}`
                }
            }
        );

        const payload = await response.json().catch(() => null);

        // The sign-in has expired (8 hours) or was ended elsewhere.
        if (response.status === 401) {
            const expired = new Error("Your session has ended. Please log in again.");
            expired.sessionExpired = true;
            throw expired;
        }

        if (response.status === 403) {
            throw new Error("This account cannot view Academic Admin reports. Please log in with an Academic Admin account.");
        }

        if (!response.ok) {
            throw new Error(
                payload?.message ||
                `Unable to load report data (HTTP ${response.status}).`
            );
        }

        if (
            !payload?.success ||
            !Array.isArray(payload.learners) ||
            !Array.isArray(payload.classes) ||
            !Array.isArray(payload.instructors) ||
            !Array.isArray(payload.libraryModules) ||
            !payload.modules ||
            typeof payload.modules !== "object"
        ) {
            throw new Error(
                payload?.message ||
                "The Laravel API returned an invalid reports response."
            );
        }

        return payload;
    }

    function setReportStatus(message, updatedText) {
        el.tableBody.replaceChildren();
        el.tableHead.replaceChildren();
        el.summary.replaceChildren();
        el.empty.hidden = false;
        el.emptyText.textContent = message;
        el.updated.textContent = updatedText;
        el.count.textContent = "0 records";
        el.pagination.hidden = true;

        const footerCount = document.getElementById("reportFooterCount");
        if (footerCount) {
            footerCount.textContent = "Showing 0 of 0 records";
        }
    }

    async function refreshReportData() {
        if (reportLoadPromise) {
            return reportLoadPromise;
        }

        setReportStatus("Loading report data...", "Loading reports...");

        reportLoadPromise = (async () => {
            try {
                reportData = await fetchReportData();
                renderFilters();
                renderReport();
            } catch (error) {
                console.error("Reports: failed to load current database data.", error);
                reportData = null;

                if (error.sessionExpired) {
                    setReportStatus(
                        "Your session has ended. Taking you to the login page so you can log in again...",
                        "Session ended"
                    );
                    setTimeout(() => {
                        if (typeof window.siknayanLogout === "function") {
                            window.siknayanLogout("../../index.html");
                        } else {
                            window.location.replace("../../index.html");
                        }
                    }, 2500);
                    return;
                }

                setReportStatus(
                    `Report data could not be loaded. ${error.message}`,
                    "Reports unavailable"
                );
            } finally {
                reportLoadPromise = null;
            }
        })();

        return reportLoadPromise;
    }


    /* =====================================================
       GENERAL HELPERS
    ===================================================== */

    const text =
        value =>
            String(
                value ?? ""
            ).trim();


    const norm =
        value =>
            text(value)
                .toLowerCase()
                .replace(
                    /[_-]+/g,
                    " "
                )
                .replace(
                    /\s+/g,
                    " "
                );


    function escapeHtml(value) {

        return text(value)

            .replace(
                /&/g,
                "&amp;"
            )

            .replace(
                /</g,
                "&lt;"
            )

            .replace(
                />/g,
                "&gt;"
            )

            .replace(
                /"/g,
                "&quot;"
            )

            .replace(
                /'/g,
                "&#039;"
            );
    }


    function statusKey(value) {

        const status =
            norm(value);


        if (
            status.includes(
                "completed"
            )
        ) {

            return "completed";
        }


        if (
            status.includes(
                "inactive"
            )
        ) {

            return "inactive";
        }


        if (
            status.includes(
                "archived"
            )
        ) {

            return "archived";
        }


        if (
            status.includes(
                "awaiting"
            )
        ) {

            return "awaiting";
        }


        if (
            status.includes(
                "active"
            )
        ) {

            return "active";
        }


        if (
            status.includes(
                "submitted"
            )
        ) {

            return "submitted";
        }


        return "other";
    }


    function displayStatus(value) {

        const status =
            norm(value);


        if (!status) {
            return "Unknown";
        }


        return status

            .split(" ")

            .map(
                word =>
                    word.charAt(0).toUpperCase() +
                    word.slice(1)
            )

            .join(" ");
    }


    function statusBadge(value) {

        const key =
            statusKey(value);

        const label =
            displayStatus(value);


        const supported =
            [
                "active",
                "completed",
                "inactive",
                "archived"
            ];


        const className =
            supported.includes(key)
                ? key
                : "other";


        return `
            <span
                class="reports-status-badge ${className}"
            >
                ${escapeHtml(label)}
            </span>
        `;
    }


    function percent(value) {

        const number =
            Number(value);


        if (
            !Number.isFinite(number)
        ) {

            return null;
        }


        return Math.round(
            Math.max(
                0,
                Math.min(
                    100,
                    number
                )
            )
        );
    }


    function percentText(value) {

        const number =
            percent(value);


        return number === null
            ? "—"
            : `${number}%`;
    }


    /* =====================================================
       LEARNER MODULE HELPERS
    ===================================================== */

    function learnerModules(
        learner,
        modules
    ) {

        const learnerId =
            text(
                learner?.id
            );


        if (
            Array.isArray(
                modules[
                    learnerId
                ]
            )
        ) {

            return modules[
                learnerId
            ];
        }


        if (
            Array.isArray(
                learner?.modules
            )
        ) {

            return learner.modules;
        }


        return [];
    }


    function moduleCounts(
        learner,
        modules
    ) {

        const list =
            learnerModules(
                learner,
                modules
            );


        const result = {

            assigned:
                list.length,

            completed:
                0,

            submitted:
                0,

            awaiting:
                0

        };


        for (
            const item of list
        ) {

            const status =
                norm(
                    item?.status
                );


            const completed =
                status.includes(
                    "completed"
                );


            const awaiting =
                status.includes(
                    "awaiting grade"
                );


            const submitted =
                status.includes(
                    "submitted"
                ) ||
                awaiting;


            if (completed) {
                result.completed++;
            }


            if (submitted) {
                result.submitted++;
            }


            if (awaiting) {
                result.awaiting++;
            }
        }


        if (
            !result.assigned &&
            Number.isFinite(
                Number(
                    learner?.modulesAssigned
                )
            )
        ) {

            result.assigned =
                Math.max(
                    0,
                    Number(
                        learner.modulesAssigned
                    )
                );
        }


        return result;
    }


    function learnerProgress(
        learner,
        modules
    ) {

        const explicit =
            percent(
                learner?.progress
            );


        if (
            explicit !== null
        ) {

            return explicit;
        }


        const counts =
            moduleCounts(
                learner,
                modules
            );


        if (
            counts.assigned === 0
        ) {

            return null;
        }


        return (
            counts.completed /
            counts.assigned
        ) * 100;
    }


    /* =====================================================
       CLASS HELPERS
    ===================================================== */

    function enrollmentCount(
        classItem
    ) {

        if (
            Array.isArray(
                classItem?.learnerIds
            )
        ) {

            return classItem.learnerIds.length;
        }


        const legacy =
            Number(
                classItem?.learners
            );


        return Number.isFinite(
            legacy
        )

            ? Math.max(
                0,
                legacy
            )

            : 0;
    }


    function unique(values) {

        return [

            ...new Set(

                values

                    .map(text)

                    .filter(Boolean)

            )

        ].sort(

            (
                a,
                b
            ) =>

                a.localeCompare(
                    b,
                    undefined,
                    {
                        numeric: true,
                        sensitivity: "base"
                    }
                )

        );
    }


    /* Every program: the Module Library (default + added
       programs) plus any program typed on a learner, class
       or instructor record. */
    function programs(data) {

        const libraryCodes =
            window.SiknayanPrograms &&
            typeof window.SiknayanPrograms.getCodes === "function"
                ? window.SiknayanPrograms.getCodes()
                : [];

        const seen = new Set();

        return unique(

            [

                ...libraryCodes,

                ...(data.learners || []).map(
                    item =>
                        item?.program
                ),

                ...(data.classes || []).map(
                    item =>
                        item?.program
                ),

                ...(data.instructors || []).map(
                    item =>
                        item?.program
                )

            ]

        ).filter(code => {
            const key = code.toLowerCase();
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }


    function courses(data) {

        return unique(

            data.classes.map(
                item =>
                    item?.courseCode ||
                    item?.courseName
            )

        );
    }


    /* =====================================================
       INSTRUCTOR HELPERS
    ===================================================== */

    function instructorRecords(data) {

        const map =
            new Map();


        data.instructors.forEach(
            instructor => {

                if (
                    !instructor?.id
                ) {

                    return;
                }


                map.set(

                    text(
                        instructor.id
                    ),

                    {

                        ...instructor,

                        id:
                            text(
                                instructor.id
                            )

                    }

                );
            }
        );


        data.classes.forEach(
            classItem => {

                const instructorId =
                    text(
                        classItem?.instructorId
                    );


                if (
                    !instructorId
                ) {

                    return;
                }


                if (
                    map.has(
                        instructorId
                    )
                ) {

                    return;
                }


                map.set(

                    instructorId,

                    {

                        id:
                            instructorId,

                        name:
                            text(
                                classItem?.instructorName
                            ) ||
                            "Unnamed Instructor",

                        status:
                            "Active"

                    }

                );
            }
        );


        return [
            ...map.values()
        ];
    }


    /* =====================================================
       FILTER HELPERS
    ===================================================== */

    function getFilters() {

        const result =
            {};


        el.filters

            .querySelectorAll(
                "[data-filter]"
            )

            .forEach(
                field => {

                    result[
                        field.dataset.filter
                    ] =
                        field.value;
                }
            );


        return result;
    }


    function selectOptions(
        values,
        allLabel
    ) {

        return `

            <option value="all">

                ${escapeHtml(
                    allLabel
                )}

            </option>

            ${values.map(
                value => `

                    <option
                        value="${escapeHtml(
                            value
                        )}"
                    >
                        ${escapeHtml(
                            value
                        )}
                    </option>

                `
            ).join("")}

        `;
    }


    /* =====================================================
       FILTER PANEL
    ===================================================== */

    function renderFilters() {

        const data =
            reportData || {
                learners: [],
                classes: []
            };


        const programList =
            programs(data);


        const courseList =
            courses(data);


        let html =
            "";


        /* -------------------------------------------------
           LEARNER
        ------------------------------------------------- */

        if (
            currentReport ===
            "learner"
        ) {

            html = `

                <div
                    class="reports-filter-heading"
                >

                    <div>

                        <h3>
                            Filters
                        </h3>

                        <p>
                            Filter learner progress records.
                        </p>

                    </div>

                </div>


                <div
                    class="
                        reports-filter-grid
                        reports-filter-grid-learner
                    "
                >

                    <label
                        class="reports-field"
                    >

                        <span>
                            Program
                        </span>

                        <select
                            data-filter="program"
                        >

                            ${selectOptions(
                                programList,
                                "All Programs"
                            )}

                        </select>

                    </label>


                    <label
                        class="reports-field"
                    >

                        <span>
                            Status
                        </span>

                        <select
                            data-filter="status"
                        >

                            <option value="all">
                                All Statuses
                            </option>

                            <option value="active">
                                Active
                            </option>

                            <option value="completed">
                                Completed
                            </option>

                            <option value="inactive">
                                Inactive
                            </option>

                        </select>

                    </label>


                    <label
                        class="
                            reports-field
                            reports-field-search
                        "
                    >

                        <span>
                            Search Learner
                        </span>

                        <div
                            class="reports-search-field"
                        >

                            <i
                                data-lucide="search"
                            ></i>

                            <input
                                type="search"
                                data-filter="search"
                                placeholder="Search by name or student ID..."
                            >

                        </div>

                    </label>

                </div>
            `;
        }


        /* -------------------------------------------------
           CLASSES
        ------------------------------------------------- */

        else if (
            currentReport ===
            "classes"
        ) {

            html = `

                <div
                    class="reports-filter-heading"
                >

                    <div>

                        <h3>
                            Filters
                        </h3>

                        <p>
                            Filter classes and enrollment records.
                        </p>

                    </div>

                </div>


                <div
                    class="
                        reports-filter-grid
                        reports-filter-grid-class
                    "
                >

                    <label
                        class="reports-field"
                    >

                        <span>
                            Program
                        </span>

                        <select
                            data-filter="program"
                        >

                            ${selectOptions(
                                programList,
                                "All Programs"
                            )}

                        </select>

                    </label>


                    <label
                        class="reports-field"
                    >

                        <span>
                            Course
                        </span>

                        <select
                            data-filter="course"
                        >

                            ${selectOptions(
                                courseList,
                                "All Courses"
                            )}

                        </select>

                    </label>


                    <label
                        class="reports-field"
                    >

                        <span>
                            Status
                        </span>

                        <select
                            data-filter="status"
                        >

                            <option value="all">
                                All Statuses
                            </option>

                            <option value="active">
                                Active
                            </option>

                            <option value="inactive">
                                Inactive
                            </option>

                            <option value="archived">
                                Archived
                            </option>

                        </select>

                    </label>


                    <label
                        class="
                            reports-field
                            reports-field-search
                        "
                    >

                        <span>
                            Search Class
                        </span>

                        <div
                            class="reports-search-field"
                        >

                            <i
                                data-lucide="search"
                            ></i>

                            <input
                                type="search"
                                data-filter="search"
                                placeholder="Search class code or instructor..."
                            >

                        </div>

                    </label>

                </div>
            `;
        }


        /* -------------------------------------------------
           MODULES
        ------------------------------------------------- */

        else if (
            currentReport ===
            "modules"
        ) {

            html = `

                <div
                    class="reports-filter-heading"
                >

                    <div>

                        <h3>
                            Filters
                        </h3>

                        <p>
                            Filter module activity and
                            submission status.
                        </p>

                    </div>

                </div>


                <div
                    class="
                        reports-filter-grid
                        reports-filter-grid-module
                    "
                >

                    <label
                        class="reports-field"
                    >

                        <span>
                            Program
                        </span>

                        <select
                            data-filter="program"
                        >

                            ${selectOptions(
                                programList,
                                "All Programs"
                            )}

                        </select>

                    </label>


                    <label
                        class="reports-field"
                    >

                        <span>
                            Course
                        </span>

                        <select
                            data-filter="course"
                        >

                            ${selectOptions(
                                courseList,
                                "All Courses"
                            )}

                        </select>

                    </label>


                    <label
                        class="reports-field"
                    >

                        <span>
                            Status
                        </span>

                        <select
                            data-filter="status"
                        >

                            <option value="all">
                                All Statuses
                            </option>

                            <option value="active">
                                Active Activity
                            </option>

                            <option value="awaiting">
                                Awaiting Grade
                            </option>

                            <option value="completed">
                                Completed
                            </option>

                        </select>

                    </label>


                    <label
                        class="
                            reports-field
                            reports-field-search
                        "
                    >

                        <span>
                            Search Module
                        </span>

                        <div
                            class="reports-search-field"
                        >

                            <i
                                data-lucide="search"
                            ></i>

                            <input
                                type="search"
                                data-filter="search"
                                placeholder="Search module or course..."
                            >

                        </div>

                    </label>

                </div>
            `;
        }


        /* -------------------------------------------------
           INSTRUCTORS
        ------------------------------------------------- */

        else if (
            currentReport ===
            "instructors"
        ) {

            html = `

                <div
                    class="reports-filter-heading"
                >

                    <div>

                        <h3>
                            Filters
                        </h3>

                        <p>
                            Filter instructor workload records.
                        </p>

                    </div>

                </div>


                <div
                    class="
                        reports-filter-grid
                        reports-filter-grid-instructor
                    "
                >

                    <label
                        class="reports-field"
                    >

                        <span>
                            Status
                        </span>

                        <select
                            data-filter="status"
                        >

                            <option value="all">
                                All Statuses
                            </option>

                            <option value="active">
                                Active
                            </option>

                            <option value="inactive">
                                Inactive
                            </option>

                        </select>

                    </label>


                    <label
                        class="
                            reports-field
                            reports-field-search
                            reports-field-wide
                        "
                    >

                        <span>
                            Search Instructor
                        </span>

                        <div
                            class="reports-search-field"
                        >

                            <i
                                data-lucide="search"
                            ></i>

                            <input
                                type="search"
                                data-filter="search"
                                placeholder="Search by instructor name or ID..."
                            >

                        </div>

                    </label>

                </div>
            `;
        }


        /* -------------------------------------------------
           PROGRAMS
        ------------------------------------------------- */

        else {

            html = `

                <div
                    class="reports-filter-heading"
                >

                    <div>

                        <h3>
                            Filters
                        </h3>

                        <p>
                            Filter the program-level
                            administrative summary.
                        </p>

                    </div>

                </div>


                <div
                    class="
                        reports-filter-grid
                        reports-filter-grid-program
                    "
                >

                    <label
                        class="
                            reports-field
                            reports-field-wide
                        "
                    >

                        <span>
                            Search Program
                        </span>

                        <div
                            class="reports-search-field"
                        >

                            <i
                                data-lucide="search"
                            ></i>

                            <input
                                type="search"
                                data-filter="search"
                                placeholder="Search by program code..."
                            >

                        </div>

                    </label>

                </div>
            `;
        }


        el.filters.innerHTML = `

            ${html}


            <div
                class="reports-filter-actions"
            >

                <!-- Filters apply as soon as they change; Reset clears them. -->
                <button
                    type="button"
                    class="reports-secondary-button"
                    id="resetReportFilters"
                    title="Clear all filters"
                >

                    <i
                        data-lucide="rotate-ccw"
                    ></i>

                    Reset

                </button>

            </div>

        `;


        refreshIcons();


        /* Filters apply right away: dropdowns when changed, search
           while typing (after a short pause). */
        const applyFilters = () => {
            currentPage = 1;
            renderReport();
        };

        let searchTimer = null;

        el.filters
            .querySelectorAll("select[data-filter]")
            .forEach(select => select.addEventListener("change", applyFilters));

        el.filters
            .querySelectorAll("input[data-filter='search']")
            .forEach(input => input.addEventListener("input", () => {
                clearTimeout(searchTimer);
                searchTimer = setTimeout(applyFilters, 250);
            }));


        $("resetReportFilters")
            ?.addEventListener(
                "click",
                () => {

                    renderFilters();

                    currentPage =
                        1;

                    renderReport();
                }
            );


        el.filters

            .querySelectorAll(
                "input[data-filter='search']"
            )

            .forEach(
                input => {

                    input.addEventListener(
                        "keydown",
                        event => {

                            if (
                                event.key !==
                                "Enter"
                            ) {

                                return;
                            }


                            event.preventDefault();


                            currentPage =
                                1;


                            renderReport();

                        }
                    );

                }
            );
    }


    /* =====================================================
       SUMMARY CARD
    ===================================================== */

    function card(
        icon,
        label,
        value,
        detail
    ) {

        return `

            <div
                class="reports-summary-card"
            >

                <div
                    class="reports-summary-icon"
                >

                    <i
                        data-lucide="${escapeHtml(
                            icon
                        )}"
                    ></i>

                </div>


                <div
                    class="reports-summary-content"
                >

                    <span>
                        ${escapeHtml(label)}
                    </span>

                    <strong>
                        ${escapeHtml(value)}
                    </strong>

                    <small>
                        ${escapeHtml(detail)}
                    </small>

                </div>

            </div>

        `;
    }


    function progressCell(value) {

        const number =
            percent(value);


        return `

            <div
                class="reports-progress-cell"
            >

                <div
                    class="reports-progress-track"
                >

                    <span
                        style="
                            width:${number === null ? 0 : number}%;
                        "
                    ></span>

                </div>


                <strong>
                    ${percentText(value)}
                </strong>

            </div>

        `;
    }


    /* =====================================================
       LEARNER REPORT
    ===================================================== */

    function buildLearnerReport(
        filterValues,
        data
    ) {

        const items =

            data.learners

                .map(
                    learner => {

                        const counts =
                            moduleCounts(
                                learner,
                                data.modules
                            );


                        return {

                            id:
                                text(
                                    learner?.id
                                ),

                            studentId:
                                text(
                                    learner?.school_id ??
                                    learner?.schoolId
                                ) ||
                                "—",

                            name:
                                text(
                                    learner?.name
                                ) ||
                                "Unnamed Learner",

                            program:
                                text(
                                    learner?.program
                                ) ||
                                "—",

                            assigned:
                                counts.assigned,

                            completed:
                                counts.completed,

                            submitted:
                                counts.submitted,

                            awaiting:
                                counts.awaiting,

                            progress:
                                learnerProgress(
                                    learner,
                                    data.modules
                                ),

                            status:
                                text(
                                    learner?.status
                                ) ||
                                "Unknown"

                        };

                    }
                )

                .filter(
                    row => {

                        const programMatch =

                            filterValues.program ===
                            "all"

                                ? true

                                : norm(
                                    row.program
                                ) ===
                                    norm(
                                        filterValues.program
                                    );


                        const statusMatch =

                            filterValues.status ===
                            "all"

                                ? true

                                : statusKey(
                                    row.status
                                ) ===
                                    filterValues.status;


                        const query =
                            norm(
                                filterValues.search
                            );


                        const searchMatch =

                            !query ||

                            norm(
                                row.name
                            ).includes(
                                query
                            ) ||

                            norm(
                                row.studentId
                            ).includes(
                                query
                            ) ||

                            norm(
                                row.program
                            ).includes(
                                query
                            );


                        return (
                            programMatch &&
                            statusMatch &&
                            searchMatch
                        );

                    }
                )

                .sort(
                    (
                        a,
                        b
                    ) =>

                        (
                            b.progress ?? -1
                        ) -
                        (
                            a.progress ?? -1
                        )
                );


        return {

            title:
                REPORTS.learner.title,

            subtitle:
                REPORTS.learner.subtitle,

            columns: [

                "#",
                "Student ID",
                "Learner",
                "Program",
                "Assigned",
                "Completed",
                "Submitted",
                "Awaiting Grade",
                "Progress",
                "Status",
                "Action"

            ],

            rows:
                items,

            // No summary cards: the table already shows these numbers.
            summary: [],

            render:

                (
                    row,
                    index
                ) => `

                    <tr>

                        <td>
                            ${index + 1}
                        </td>


                        <td
                            class="reports-mono"
                        >
                            ${escapeHtml(
                                row.studentId
                            )}
                        </td>


                        <td>

                            <a
                                class="reports-record-link"
                                href="
                                    learner-details.html?id=${encodeURIComponent(
                                        row.id
                                    )}&from=reports
                                "
                            >

                                ${escapeHtml(
                                    row.name
                                )}

                            </a>

                        </td>


                        <td>
                            ${escapeHtml(
                                row.program
                            )}
                        </td>


                        <td>
                            ${row.assigned}
                        </td>


                        <td>
                            ${row.completed}
                        </td>


                        <td>
                            ${row.submitted}
                        </td>


                        <td>
                            ${row.awaiting}
                        </td>


                        <td>
                            ${progressCell(
                                row.progress
                            )}
                        </td>


                        <td>
                            ${statusBadge(
                                row.status
                            )}
                        </td>


                        <td>

                            <a
                                class="reports-icon-action"
                                href="
                                    learner-details.html?id=${encodeURIComponent(
                                        row.id
                                    )}&from=reports
                                "
                                title="View learner"
                                aria-label="View learner"
                            >

                                <i
                                    data-lucide="eye"
                                ></i>

                            </a>

                        </td>

                    </tr>

                `

        };
    }


    /* =====================================================
       CLASS REPORT
    ===================================================== */

    function buildClassReport(
        filterValues,
        data
    ) {

        const items =

            data.classes

                .map(
                    classItem => ({

                        id:
                            text(
                                classItem?.id
                            ),

                        classCode:
                            text(
                                classItem?.classCode
                            ) ||
                            "—",

                        courseCode:
                            text(
                                classItem?.courseCode
                            ),

                        courseName:
                            text(
                                classItem?.courseName
                            ),

                        program:
                            text(
                                classItem?.program
                            ) ||
                            "—",

                        instructor:
                            text(
                                classItem?.instructorName
                            ) ||
                            "Unassigned",

                        learners:
                            enrollmentCount(
                                classItem
                            ),

                        status:
                            text(
                                classItem?.status
                            ) ||
                            "Unknown"

                    })
                )

                .filter(
                    row => {

                        const programMatch =

                            filterValues.program ===
                            "all"

                                ? true

                                : norm(
                                    row.program
                                ) ===
                                    norm(
                                        filterValues.program
                                    );


                        const courseValue =
                            row.courseCode ||
                            row.courseName;


                        const courseMatch =

                            filterValues.course ===
                            "all"

                                ? true

                                : norm(
                                    courseValue
                                ) ===
                                    norm(
                                        filterValues.course
                                    );


                        const statusMatch =

                            filterValues.status ===
                            "all"

                                ? true

                                : statusKey(
                                    row.status
                                ) ===
                                    filterValues.status;


                        const query =
                            norm(
                                filterValues.search
                            );


                        const searchMatch =

                            !query ||

                            norm(
                                row.classCode
                            ).includes(
                                query
                            ) ||

                            norm(
                                row.courseCode
                            ).includes(
                                query
                            ) ||

                            norm(
                                row.courseName
                            ).includes(
                                query
                            ) ||

                            norm(
                                row.instructor
                            ).includes(
                                query
                            );


                        return (
                            programMatch &&
                            courseMatch &&
                            statusMatch &&
                            searchMatch
                        );

                    }
                )

                .sort(
                    (
                        a,
                        b
                    ) =>
                        a.classCode.localeCompare(
                            b.classCode,
                            undefined,
                            {
                                numeric: true,
                                sensitivity: "base"
                            }
                        )
                );


        return {

            title:
                REPORTS.classes.title,

            subtitle:
                REPORTS.classes.subtitle,

            columns: [

                "#",
                "Class Code",
                "Course",
                "Program",
                "Instructor",
                "Learners",
                "Status",
                "Action"

            ],

            rows:
                items,

            // No summary cards: the table already shows these numbers.
            summary: [],

            render:

                (
                    row,
                    index
                ) => `

                    <tr>

                        <td>
                            ${index + 1}
                        </td>


                        <td>

                            <a
                                class="
                                    reports-record-link
                                    reports-mono
                                "
                                href="
                                    class-details.html?id=${encodeURIComponent(
                                        row.id
                                    )}
                                "
                            >

                                ${escapeHtml(
                                    row.classCode
                                )}

                            </a>

                        </td>


                        <td>

                            <div
                                class="reports-primary-text"
                            >
                                ${escapeHtml(
                                    row.courseCode ||
                                    "—"
                                )}
                            </div>


                            <div
                                class="reports-secondary-text"
                            >
                                ${escapeHtml(
                                    row.courseName
                                )}
                            </div>

                        </td>


                        <td>
                            ${escapeHtml(
                                row.program
                            )}
                        </td>


                        <td>
                            ${escapeHtml(
                                row.instructor
                            )}
                        </td>


                        <td>
                            <strong>
                                ${row.learners}
                            </strong>
                        </td>


                        <td>
                            ${statusBadge(
                                row.status
                            )}
                        </td>


                        <td>

                            <a
                                class="reports-icon-action"
                                href="
                                    class-details.html?id=${encodeURIComponent(
                                        row.id
                                    )}
                                "
                                title="View class"
                                aria-label="View class"
                            >

                                <i
                                    data-lucide="eye"
                                ></i>

                            </a>

                        </td>

                    </tr>

                `

        };
    }


    /* =====================================================
    MODULE REPORT
    ===================================================== */

    function buildModuleReport(
        filterValues,
        data
    ) {

        const moduleMap =
            new Map();


        /* =================================================
        STEP 1
        BUILD MODULE CATALOG FROM MODULE LIBRARY
        ================================================= */

        data.libraryModules.forEach(
            module => {

                const id =
                    text(
                        module?.id
                    );

                if (!id) {
                    return;
                }


                if (
                    moduleMap.has(id)
                ) {
                    return;
                }


                moduleMap.set(
                    id,
                    {

                        id,

                        title:
                            text(
                                module?.title ||
                                module?.name
                            ) ||
                            "Untitled Module",

                        course:
                            text(
                                module?.course ||
                                module?.courseId
                            ) ||
                            "—",

                        program:
                            text(
                                module?.program
                            ) ||
                            "—",

                        assigned:
                            0,

                        submitted:
                            0,

                        awaiting:
                            0,

                        completed:
                            0

                    }
                );

            }
        );


        /* =================================================
        STEP 2
        ADD MODULES FROM CLASS ASSIGNMENTS

        class.moduleIds[]
        +
        class.learnerIds[]

        This makes a module appear in Reports even when
        learners have not submitted anything yet.
        ================================================= */

        const countedAssignments =
            new Set();


        data.classes.forEach(
            classItem => {

                const classId =
                    text(
                        classItem?.id
                    );


                const learnerIds =
                    Array.isArray(
                        classItem?.learnerIds
                    )
                        ? classItem.learnerIds
                            .map(
                                learnerId =>
                                    text(
                                        learnerId
                                    )
                            )
                            .filter(Boolean)
                        : [];


                const moduleIds =
                    Array.isArray(
                        classItem?.moduleIds
                    )
                        ? classItem.moduleIds
                            .map(
                                moduleId =>
                                    text(
                                        moduleId
                                    )
                            )
                            .filter(Boolean)
                        : [];


                moduleIds.forEach(
                    moduleId => {

                        /*
                        Make sure the module exists in
                        the report even if it is not found
                        in the current library.
                        */

                        if (
                            !moduleMap.has(
                                moduleId
                            )
                        ) {

                            moduleMap.set(
                                moduleId,
                                {

                                    id:
                                        moduleId,

                                    title:
                                        "Unknown Module",

                                    course:
                                        text(
                                            classItem?.courseCode ||
                                            classItem?.courseName
                                        ) ||
                                        "—",

                                    program:
                                        text(
                                            classItem?.program
                                        ) ||
                                        "—",

                                    assigned:
                                        0,

                                    submitted:
                                        0,

                                    awaiting:
                                        0,

                                    completed:
                                        0

                                }
                            );

                        }


                        const row =
                            moduleMap.get(
                                moduleId
                            );


                        /*
                        Each learner in the class receives
                        one assignment for this class/module
                        relationship.

                        Prevent duplicate counting if the same
                        relationship is encountered again.
                        */

                        learnerIds.forEach(
                            learnerId => {

                                const assignmentKey =
                                    [
                                        classId,
                                        learnerId,
                                        moduleId
                                    ].join("|");


                                if (
                                    countedAssignments.has(
                                        assignmentKey
                                    )
                                ) {

                                    return;

                                }


                                countedAssignments.add(
                                    assignmentKey
                                );


                                row.assigned++;

                            }
                        );

                    }
                );

            }
        );


        /* =================================================
        STEP 3
        OVERLAY ACTUAL LEARNER MODULE ACTIVITY
        ================================================= */

        data.learners.forEach(
            learner => {

                const learnerId =
                    text(
                        learner?.id
                    );


                learnerModules(
                    learner,
                    data.modules
                ).forEach(
                    module => {

                        const moduleId =
                            text(
                                module?.moduleId ||
                                module?.id
                            );


                        if (!moduleId) {
                            return;
                        }


                        /*
                        If this module exists only in the
                        learner record, create a report row
                        for it.
                        */

                        if (
                            !moduleMap.has(
                                moduleId
                            )
                        ) {

                            moduleMap.set(
                                moduleId,
                                {

                                    id:
                                        moduleId,

                                    title:
                                        text(
                                            module?.title ||
                                            module?.name
                                        ) ||
                                        "Untitled Module",

                                    course:
                                        text(
                                            module?.course ||
                                            module?.courseId
                                        ) ||
                                        "—",

                                    program:
                                        text(
                                            learner?.program
                                        ) ||
                                        "—",

                                    assigned:
                                        0,

                                    submitted:
                                        0,

                                    awaiting:
                                        0,

                                    completed:
                                        0

                                }
                            );

                        }


                        const row =
                            moduleMap.get(
                                moduleId
                            );


                        /*
                        If the class relationship has not
                        already counted this learner/module,
                        count the learner record as an
                        assignment.

                        This also keeps legacy learner module
                        records visible.
                        */

                        const classId =
                            text(
                                module?.classId
                            );


                        const assignmentKey =
                            [
                                classId,
                                learnerId,
                                moduleId
                            ].join("|");


                        if (
                            !countedAssignments.has(
                                assignmentKey
                            )
                        ) {

                            /*
                            Only count the learner record
                            automatically when there is no
                            class relationship already
                            accounting for it.
                            */

                            if (
                                !classId
                            ) {

                                row.assigned++;

                            }

                        }


                        /* ---------------------------------
                        ACTIVITY STATUS
                        --------------------------------- */

                        const status =
                            norm(
                                module?.status ||
                                module?.state
                            );


                        if (
                            status.includes(
                                "completed"
                            )
                        ) {

                            row.completed++;

                        }


                        if (
                            status.includes(
                                "awaiting grade"
                            )
                        ) {

                            row.awaiting++;

                        }


                        if (
                            status.includes(
                                "submitted"
                            ) ||
                            status.includes(
                                "awaiting grade"
                            )
                        ) {

                            row.submitted++;

                        }

                    }
                );

            }
        );


        /* =================================================
        STEP 4
        FILTER REPORT ROWS
        ================================================= */

        const items =

            [
                ...moduleMap.values()
            ]

                .filter(
                    row => {

                        /* -------------------------------
                        PROGRAM FILTER
                        ------------------------------- */

                        const programMatch =

                            filterValues.program ===
                            "all"

                                ? true

                                : norm(
                                    row.program
                                ) ===
                                    norm(
                                        filterValues.program
                                    );


                        /* -------------------------------
                        COURSE FILTER
                        ------------------------------- */

                        const selectedCourse =
                            norm(
                                filterValues.course
                            );


                        const courseMatch =

                            filterValues.course ===
                            "all"

                                ? true

                                :

                                    norm(
                                        row.course
                                    ) ===
                                        selectedCourse ||

                                    norm(
                                        row.course
                                    ).includes(
                                        selectedCourse
                                    );


                        /* -------------------------------
                        SEARCH FILTER
                        ------------------------------- */

                        const query =
                            norm(
                                filterValues.search
                            );


                        const searchMatch =

                            !query ||

                            norm(
                                row.title
                            ).includes(
                                query
                            ) ||

                            norm(
                                row.course
                            ).includes(
                                query
                            ) ||

                            norm(
                                row.program
                            ).includes(
                                query
                            );


                        /* -------------------------------
                        STATUS FILTER
                        ------------------------------- */

                        let statusMatch =
                            true;


                        if (
                            filterValues.status !==
                            "all"
                        ) {

                            if (
                                filterValues.status ===
                                "awaiting"
                            ) {

                                statusMatch =
                                    row.awaiting >
                                    0;

                            }

                            else if (
                                filterValues.status ===
                                "completed"
                            ) {

                                statusMatch =
                                    row.completed >
                                    0;

                            }

                            else if (
                                filterValues.status ===
                                "active"
                            ) {

                                statusMatch =
                                    row.assigned >
                                    0;

                            }

                        }


                        return (

                            programMatch &&
                            courseMatch &&
                            searchMatch &&
                            statusMatch

                        );

                    }
                )

                .sort(
                    (
                        a,
                        b
                    ) =>

                        b.awaiting -
                        a.awaiting ||

                        b.assigned -
                        a.assigned ||

                        a.title.localeCompare(
                            b.title,
                            undefined,
                            {
                                sensitivity:
                                    "base"
                            }
                        )
                );


        /* =================================================
        STEP 5
        SUMMARY TOTALS
        ================================================= */

        const assigned =
            items.reduce(
                (
                    total,
                    row
                ) =>

                    total +
                    row.assigned,

                0
            );


        const submitted =
            items.reduce(
                (
                    total,
                    row
                ) =>

                    total +
                    row.submitted,

                0
            );


        const awaiting =
            items.reduce(
                (
                    total,
                    row
                ) =>

                    total +
                    row.awaiting,

                0
            );


        const completed =
            items.reduce(
                (
                    total,
                    row
                ) =>

                    total +
                    row.completed,

                0
            );


        /* =================================================
        RETURN REPORT
        ================================================= */

        return {

            title:
                REPORTS.modules.title,

            subtitle:
                REPORTS.modules.subtitle,


            columns: [

                "#",

                "Module",

                "Course",

                "Program",

                "Assigned",

                "Submitted",

                "Awaiting Grade",

                "Completed"

            ],


            rows:
                items,


            // No summary cards: the table already shows these numbers.
            summary: [],


            render:

                (
                    row,
                    index
                ) => `

                    <tr>

                        <td>
                            ${index + 1}
                        </td>


                        <td>

                            <div
                                class="
                                    reports-primary-text
                                "
                            >

                                ${escapeHtml(
                                    row.title
                                )}

                            </div>

                        </td>


                        <td>
                            ${escapeHtml(
                                row.course
                            )}
                        </td>


                        <td>
                            ${escapeHtml(
                                row.program
                            )}
                        </td>


                        <td>
                            ${row.assigned}
                        </td>


                        <td>
                            ${row.submitted}
                        </td>


                        <td>

                            <span
                                class="
                                    reports-number-emphasis
                                    ${row.awaiting > 0
                                        ? "has-warning"
                                        : ""
                                    }
                                "
                            >

                                ${row.awaiting}

                            </span>

                        </td>


                        <td>
                            ${row.completed}
                        </td>

                    </tr>

                `

        };

    }


    /* =====================================================
    INSTRUCTOR WORKLOAD REPORT
    ===================================================== */

    function buildInstructorReport(
        filterValues,
        data
    ) {

        const instructorMap =
            new Map();


        /* =================================================
        STEP 1
        CREATE INSTRUCTOR RECORDS
        ================================================= */

        data.instructors.forEach(
            instructor => {

                const instructorId =
                    text(
                        instructor?.id
                    );

                if (!instructorId) {
                    return;
                }


                instructorMap.set(
                    instructorId,
                    {
                        id:
                            instructorId,

                        name:
                            text(
                                instructor?.name ||
                                instructor?.fullName
                            ) ||
                            "Unknown Instructor",

                        program:
                            text(
                                instructor?.program
                            ) ||
                            "—",

                        status:
                            text(
                                instructor?.status
                            ) ||
                            "Active",

                        classes: 0,
                        learners: 0,
                        modules: 0,
                        awaiting: 0
                    }
                );

            }
        );


        /* =================================================
        STEP 2
        PROCESS CLASSES

        Only classes actually assigned to an instructor
        are included.
        ================================================= */

        data.classes.forEach(
            classItem => {

                const instructorId =
                    text(
                        classItem?.instructorId
                    );


                if (!instructorId) {
                    return;
                }


                /*
                * If the instructor is not present in the
                * instructor storage, create a fallback
                * record from the class itself.
                */

                if (
                    !instructorMap.has(
                        instructorId
                    )
                ) {

                    instructorMap.set(
                        instructorId,
                        {
                            id:
                                instructorId,

                            name:
                                text(
                                    classItem?.instructorName
                                ) ||
                                "Unknown Instructor",

                            program:
                                text(
                                    classItem?.program
                                ) ||
                                "—",

                            status:
                                "Active",

                            classes: 0,
                            learners: 0,
                            modules: 0,
                            awaiting: 0
                        }
                    );

                }


                const row =
                    instructorMap.get(
                        instructorId
                    );


                /* =========================================
                CLASS COUNT
                ========================================= */

                row.classes++;


                /* =========================================
                LEARNER COUNT

                Uses the class roster source of truth.
                ========================================= */

                const learnerIds =
                    Array.isArray(
                        classItem?.learnerIds
                    )
                        ? classItem.learnerIds
                            .map(
                                learnerId =>
                                    text(
                                        learnerId
                                    )
                            )
                            .filter(Boolean)

                        : [];


                row.learners +=
                    learnerIds.length;


                /* =========================================
                MODULE COUNT

                Uses class.moduleIds[].
                ========================================= */

                const moduleIds =
                    Array.isArray(
                        classItem?.moduleIds
                    )
                        ? classItem.moduleIds
                            .map(
                                moduleId =>
                                    text(
                                        moduleId
                                    )
                            )
                            .filter(Boolean)

                        : [];


                row.modules +=
                    moduleIds.length;


                /* =========================================
                AWAITING-GRADE COUNT

                Only inspect modules assigned to this
                instructor's current class.
                ========================================= */

                if (
                    moduleIds.length === 0 ||
                    learnerIds.length === 0
                ) {
                    return;
                }


                learnerIds.forEach(
                    learnerId => {

                        const learner =
                            data.learners.find(
                                item =>
                                    text(
                                        item?.id
                                    ) ===
                                    learnerId
                            );


                        if (!learner) {
                            return;
                        }


                        const learnerModuleRecords =
                            learnerModules(
                                learner,
                                data.modules
                            );


                        learnerModuleRecords.forEach(
                            module => {

                                const moduleId =
                                    text(
                                        module?.moduleId ||
                                        module?.id
                                    );


                                /*
                                * Ignore modules that are not
                                * assigned to this class.
                                */

                                if (
                                    !moduleIds.includes(
                                        moduleId
                                    )
                                ) {
                                    return;
                                }


                                /*
                                * If the learner module record
                                * contains a class ID, make sure
                                * it belongs to this class.
                                */

                                const recordClassId =
                                    text(
                                        module?.classId
                                    );


                                const currentClassId =
                                    text(
                                        classItem?.id
                                    );


                                if (
                                    recordClassId &&
                                    currentClassId &&
                                    recordClassId !==
                                        currentClassId
                                ) {
                                    return;
                                }


                                const status =
                                    norm(
                                        module?.status ||
                                        module?.state
                                    );


                                if (
                                    status.includes(
                                        "awaiting grade"
                                    )
                                ) {

                                    row.awaiting++;

                                }

                            }
                        );

                    }
                );

            }
        );


        /* =================================================
        STEP 3
        FILTER

        IMPORTANT:
        This report does NOT have a Program filter.
        Only Status + Search Instructor are used.
        ================================================= */

        const items =

            [
                ...instructorMap.values()
            ]

                .filter(
                    row => {

                        /* -------------------------------------
                        STATUS FILTER
                        ------------------------------------- */

                        const selectedStatus =
                            text(
                                filterValues.status
                            ) ||
                            "all";


                        const statusMatch =

                            selectedStatus ===
                            "all"

                                ? true

                                :

                            statusKey(
                                row.status
                            ) ===
                            selectedStatus;


                        /* -------------------------------------
                        SEARCH FILTER
                        ------------------------------------- */

                        const query =
                            norm(
                                filterValues.search
                            );


                        const searchMatch =

                            !query ||

                            norm(
                                row.name
                            ).includes(
                                query
                            ) ||

                            norm(
                                row.id
                            ).includes(
                                query
                            ) ||

                            norm(
                                row.program
                            ).includes(
                                query
                            );


                        return (
                            statusMatch &&
                            searchMatch
                        );

                    }
                )

                .sort(
                    (
                        a,
                        b
                    ) =>

                        b.awaiting -
                        a.awaiting ||

                        b.classes -
                        a.classes ||

                        a.name.localeCompare(
                            b.name,
                            undefined,
                            {
                                sensitivity:
                                    "base"
                            }
                        )
                );


        /* =================================================
        STEP 4
        SUMMARY TOTALS
        ================================================= */

        const classes =
            items.reduce(
                (
                    total,
                    row
                ) =>
                    total +
                    row.classes,

                0
            );


        const learners =
            items.reduce(
                (
                    total,
                    row
                ) =>
                    total +
                    row.learners,

                0
            );


        const modules =
            items.reduce(
                (
                    total,
                    row
                ) =>
                    total +
                    row.modules,

                0
            );


        const awaiting =
            items.reduce(
                (
                    total,
                    row
                ) =>
                    total +
                    row.awaiting,

                0
            );


        /* =================================================
        RETURN REPORT
        ================================================= */

        return {

            title:
                REPORTS.instructors.title,


            subtitle:
                REPORTS.instructors.subtitle,


            columns: [

                "#",

                "Instructor",

                "Program",

                "Classes",

                "Learners",

                "Modules",

                "Awaiting Grade"

            ],


            rows:
                items,


            // No summary cards: the table already shows these numbers.
            summary: [],


            render:

                (
                    row,
                    index
                ) => `

                    <tr>

                        <td>
                            ${index + 1}
                        </td>


                        <td>

                            <div
                                class="
                                    reports-primary-text
                                "
                            >

                                ${escapeHtml(
                                    row.name
                                )}

                            </div>

                        </td>


                        <td>
                            ${escapeHtml(
                                row.program
                            )}
                        </td>


                        <td>
                            ${row.classes}
                        </td>


                        <td>
                            ${row.learners}
                        </td>


                        <td>
                            ${row.modules}
                        </td>


                        <td>

                            <span
                                class="
                                    reports-number-emphasis
                                    ${row.awaiting > 0
                                        ? "has-warning"
                                        : ""
                                    }
                                "
                            >

                                ${row.awaiting}

                            </span>

                        </td>

                    </tr>

                `

        };

    }


    /* =====================================================
    PROGRAM REPORT
    ===================================================== */

    function buildProgramReport(
        filterValues,
        data
    ) {

        const programList =
            programs(data);


        const items =

            programList

                .map(
                    program => {

                        /* =========================================
                        LEARNERS

                        Learners remain the source of truth for
                        program-level learner totals.
                        ========================================= */

                        const learners =
                            data.learners.filter(
                                learner =>
                                    norm(
                                        learner?.program
                                    ) ===
                                    norm(
                                        program
                                    )
                            );


                        /* =========================================
                        CLASSES

                        Classes remain the source of truth for
                        program-level class totals.
                        ========================================= */

                        const classes =
                            data.classes.filter(
                                classItem =>
                                    norm(
                                        classItem?.program
                                    ) ===
                                    norm(
                                        program
                                    )
                            );


                        /* =========================================
                        PROGRESS

                        Keep the existing learner progress
                        calculation.
                        ========================================= */

                        const progressValues =

                            learners

                                .map(
                                    learner =>
                                        learnerProgress(
                                            learner,
                                            data.modules
                                        )
                                )

                                .filter(
                                    value =>
                                        value !==
                                        null
                                );


                        const average =

                            progressValues.length

                                ?

                                    progressValues.reduce(
                                        (
                                            total,
                                            value
                                        ) =>
                                            total +
                                            value,
                                        0
                                    ) /
                                    progressValues.length

                                :

                                    null;


                        /* =========================================
                        MODULES

                        NEW SOURCE OF TRUTH:

                        Class.moduleIds[]

                        A module is counted once per program,
                        regardless of how many learners are
                        enrolled in the class.

                        This means a module assigned to a class
                        appears in Program Overview even when
                        learners have not submitted anything yet.
                        ========================================= */

                        const moduleIds =
                            new Set();


                        classes.forEach(
                            classItem => {

                                const classModuleIds =

                                    Array.isArray(
                                        classItem?.moduleIds
                                    )

                                        ?

                                            classItem.moduleIds
                                                .map(
                                                    moduleId =>
                                                        text(
                                                            moduleId
                                                        )
                                                )
                                                .filter(Boolean)

                                        :

                                            [];


                                classModuleIds.forEach(
                                    moduleId => {

                                        moduleIds.add(
                                            moduleId
                                        );

                                    }
                                );

                            }
                        );


                        /* =========================================
                        LEGACY / ACTIVITY FALLBACK

                        If no class module assignments exist for
                        this program yet, retain module records
                        already represented on learners.

                        This prevents older prototype data from
                        suddenly disappearing from the report.
                        ========================================= */

                        if (
                            moduleIds.size === 0
                        ) {

                            learners.forEach(
                                learner => {

                                    learnerModules(
                                        learner,
                                        data.modules
                                    ).forEach(
                                        module => {

                                            const id =
                                                text(
                                                    module?.moduleId ||
                                                    module?.id ||
                                                    module?.title
                                                );


                                            if (id) {

                                                moduleIds.add(
                                                    id
                                                );

                                            }

                                        }
                                    );

                                }
                            );

                        }


                        return {

                            program,

                            learners:
                                learners.length,

                            classes:
                                classes.length,

                            modules:
                                moduleIds.size,

                            progress:
                                average

                        };

                    }
                )


                /* =============================================
                SEARCH FILTER
                ============================================= */

                .filter(
                    row => {

                        const query =
                            norm(
                                filterValues.search
                            );


                        return (

                            !query ||

                            norm(
                                row.program
                            ).includes(
                                query
                            )

                        );

                    }
                )


                /* =============================================
                SORT
                ============================================= */

                .sort(
                    (
                        a,
                        b
                    ) =>

                        b.learners -
                        a.learners ||

                        a.program.localeCompare(
                            b.program,
                            undefined,
                            {
                                sensitivity:
                                    "base"
                            }
                        )

                );


        /* =================================================
        SUMMARY TOTALS
        ================================================= */

        const progressValues =

            items

                .map(
                    row =>
                        row.progress
                )

                .filter(
                    value =>
                        value !==
                        null
                );


        const average =

            progressValues.length

                ?

                    progressValues.reduce(
                        (
                            total,
                            value
                        ) =>
                            total +
                            value,

                        0
                    ) /
                    progressValues.length

                :

                    null;


        /* =================================================
        RETURN REPORT
        ================================================= */

        return {

            title:
                REPORTS.programs.title,


            subtitle:
                REPORTS.programs.subtitle,


            columns: [

                "#",

                "Program",

                "Learners",

                "Classes",

                "Modules",

                "Average Progress"

            ],


            rows:
                items,


            // No summary cards: the table already shows these numbers.
            summary: [],


            render:

                (
                    row,
                    index
                ) => `

                    <tr>

                        <td>
                            ${index + 1}
                        </td>


                        <td>

                            <strong>
                                ${escapeHtml(
                                    row.program
                                )}
                            </strong>

                        </td>


                        <td>
                            ${row.learners}
                        </td>


                        <td>
                            ${row.classes}
                        </td>


                        <td>
                            ${row.modules}
                        </td>


                        <td>
                            ${progressCell(
                                row.progress
                            )}
                        </td>

                    </tr>

                `

        };

    }


    /* =====================================================
       REPORT BUILDER
    ===================================================== */

    function buildReport(
        filterValues,
        data
    ) {

        switch (
            currentReport
        ) {

            case "classes":

                return buildClassReport(
                    filterValues,
                    data
                );


            case "modules":

                return buildModuleReport(
                    filterValues,
                    data
                );


            case "instructors":

                return buildInstructorReport(
                    filterValues,
                    data
                );


            case "programs":

                return buildProgramReport(
                    filterValues,
                    data
                );


            default:

                return buildLearnerReport(
                    filterValues,
                    data
                );

        }
    }


    /* =====================================================
       SUMMARY
    ===================================================== */

    function renderSummary(
        summaryItems
    ) {

        el.summary.innerHTML =
            summaryItems.join(
                ""
            );

        // Reports without summary cards leave no empty space.
        el.summary.style.display =
            summaryItems.length
                ? ""
                : "none";


        refreshIcons();
    }


    /* =====================================================
       PAGINATION
    ===================================================== */

    function renderPagination(
        totalRows
    ) {

        const pageCount =

            Math.max(
                1,
                Math.ceil(
                    totalRows /
                    PAGE_SIZE
                )
            );


        currentPage =

            Math.min(
                currentPage,
                pageCount
            );


        el.pagination.hidden =
            totalRows === 0;


        el.previous.disabled =
            currentPage <= 1;


        el.next.disabled =
            currentPage >=
            pageCount;


        el.pageNumbers.innerHTML =
            "";


        for (
            let i = 1;
            i <= pageCount;
            i++
        ) {

            if (

                pageCount > 7 &&

                i !== 1 &&

                i !== pageCount &&

                Math.abs(
                    i -
                    currentPage
                ) > 1

            ) {

                if (
                    i === 2 ||
                    i === pageCount - 1
                ) {

                    el.pageNumbers.insertAdjacentHTML(

                        "beforeend",

                        `
                            <span
                                class="
                                    reports-page-ellipsis
                                "
                            >
                                …
                            </span>
                        `
                    );
                }

                continue;
            }


            const button =
                document.createElement(
                    "button"
                );


            button.type =
                "button";


            button.className =

                "reports-page-number" +

                (
                    i === currentPage
                        ? " active"
                        : ""
                );


            button.textContent =
                String(i);


            button.addEventListener(
                "click",
                () => {

                    currentPage =
                        i;

                    renderRows();

                }
            );


            el.pageNumbers.appendChild(
                button
            );

        }

    }


    /* =====================================================
    TABLE ROWS
    ===================================================== */

    function renderRows() {

        const start =
            (
                currentPage -
                1
            ) *
            PAGE_SIZE;


        const visibleRows =

            rows.slice(
                start,
                start +
                PAGE_SIZE
            );


        el.tableBody.innerHTML =

            visibleRows

                .map(
                    lastReportData.render
                )

                .join(
                    ""
                );


        /* -------------------------------------------------
        EMPTY STATE
        ------------------------------------------------- */

        el.empty.hidden =
            rows.length >
            0;


        if (
            !rows.length
        ) {

            el.emptyText.textContent =
                "No records match the current filters.";

        }


        /* -------------------------------------------------
        HEADER RECORD COUNT
        ------------------------------------------------- */

        el.count.textContent =
            `${rows.length} ${
                rows.length === 1
                    ? "record"
                    : "records"
            }`;


        /* -------------------------------------------------
        FOOTER RESULT RANGE
        ------------------------------------------------- */

        const displayStart =
            rows.length === 0
                ? 0
                : start + 1;


        const displayEnd =
            Math.min(
                start +
                visibleRows.length,
                rows.length
            );


        const reportLabel = {

            learner:
                "learners",

            classes:
                "classes",

            modules:
                "modules",

            instructors:
                "instructors",

            programs:
                "programs"

        }[
            currentReport
        ] ||
        "records";


        const footerCount =
            document.getElementById(
                "reportFooterCount"
            );


        if (footerCount) {

            footerCount.textContent =

                rows.length === 0

                    ? `Showing 0 of 0 ${reportLabel}`

                    : `Showing ${displayStart}–${displayEnd} of ${rows.length} ${reportLabel}`;

        }


        /* -------------------------------------------------
        PAGINATION
        ------------------------------------------------- */

        renderPagination(
            rows.length
        );


        /* -------------------------------------------------
        REFRESH ICONS
        ------------------------------------------------- */

        refreshIcons();

    }
    /* =====================================================
       MAIN REPORT RENDER
    ===================================================== */

    function renderReport() {

        if (!reportData) {
            return;
        }


        const report =
            buildReport(
                getFilters(),
                reportData
            );


        lastReportData =
            report;


        rows =
            report.rows;


        columns =
            report.columns;


        el.tableTitle.textContent =
            report.title;


        el.tableSubtitle.textContent =
            report.subtitle;


        el.tableHead.innerHTML =

            report.columns

                .map(
                    column => `

                        <th>
                            ${escapeHtml(
                                column
                            )}
                        </th>

                    `
                )

                .join(
                    ""
                );


        renderSummary(
            report.summary
        );


        renderRows();


        const updated =
            new Intl.DateTimeFormat(
                "en-PH",
                {
                    dateStyle:
                        "medium",

                    timeStyle:
                        "short"
                }
            ).format(
                new Date()
            );


        el.updated.textContent =
            `Updated ${updated}`;


        refreshIcons();
    }


    /* =====================================================
       REPORT SWITCHING
    ===================================================== */

    function switchReport(
        reportKey
    ) {

        if (
            !REPORTS[
                reportKey
            ]
        ) {

            return;
        }


        currentReport =
            reportKey;


        currentPage =
            1;


        el.cards.forEach(
            card => {

                const active =

                    card.dataset.report ===
                    reportKey;


                card.classList.toggle(
                    "active",
                    active
                );


                card.setAttribute(
                    "aria-selected",
                    String(active)
                );

            }
        );


        renderFilters();

        renderReport();
    }


    /* =====================================================
       EXCEL (.xls) EXPORT
    ===================================================== */

    function exportReport() {

        if (
            !lastReportData ||
            !rows.length
        ) {

            return;
        }

        if (!window.XLSX) {
            alert("The Excel exporter is still loading. Please try again in a moment.");
            return;
        }


        const exportColumns =

            lastReportData.columns
                .filter(
                    column =>
                        column !==
                        "Action"
                );


        const lines = [

            exportColumns

        ];


        rows.forEach(
            (
                row,
                index
            ) => {

                const values =

                    exportColumns.map(
                        column => {

                            const key =
                                norm(
                                    column
                                );


                            let value =
                                "";


                            if (
                                key ===
                                "#"
                            ) {

                                value =
                                    index +
                                    1;
                            }


                            else if (
                                key ===
                                "student id"
                            ) {

                                // The School ID (e.g. 23-00001), not the
                                // internal record number.
                                value =
                                    row.studentId ||
                                    "";
                            }


                            else if (
                                key ===
                                "learner"
                            ) {

                                value =
                                    row.name;
                            }


                            else if (
                                key ===
                                "program"
                            ) {

                                value =
                                    row.program;
                            }


                            else if (
                                key ===
                                "class code"
                            ) {

                                value =
                                    row.classCode;
                            }


                            else if (
                                key ===
                                "course"
                            ) {

                                value =

                                    row.courseCode ||
                                    row.courseName ||
                                    row.course;
                            }


                            else if (
                                key ===
                                "instructor"
                            ) {

                                value =
                                    row.name;
                            }


                            else if (
                                key ===
                                "instructor id"
                            ) {

                                value =
                                    row.id;
                            }


                            else if (
                                key ===
                                "assigned"
                            ) {

                                value =
                                    row.assigned;
                            }


                            else if (
                                key ===
                                "completed"
                            ) {

                                value =
                                    row.completed;
                            }


                            else if (
                                key ===
                                "submitted"
                            ) {

                                value =
                                    row.submitted;
                            }


                            else if (
                                key ===
                                "awaiting grade"
                            ) {

                                value =

                                    row.awaiting ??
                                    row.awaitingGrade;
                            }


                            else if (
                                key ===
                                "learners"
                            ) {

                                value =
                                    row.learners;
                            }


                            else if (
                                key ===
                                "status"
                            ) {

                                value =
                                    row.status;
                            }


                            else if (
                                key ===
                                "module"
                            ) {

                                value =
                                    row.title;
                            }


                            else if (
                                key ===
                                "average progress" ||
                                key ===
                                "progress"
                            ) {

                                value =
                                    percentText(
                                        row.progress
                                    );
                            }


                            else if (
                                key ===
                                "classes"
                            ) {

                                value =
                                    row.classes;
                            }


                            else if (
                                key ===
                                "assigned classes"
                            ) {

                                value =
                                    row.assignedClasses;
                            }


                            else if (
                                key ===
                                "modules"
                            ) {

                                value =
                                    row.modules;
                            }


                            // IDs stay text, so Excel doesn't turn
                            // 23-00001 into a date or a number.
                            if (
                                key === "student id" ||
                                key === "instructor id"
                            ) {
                                return text(value);
                            }

                            return value ?? "";

                        }
                    );


                lines.push(
                    values
                );

            }
        );


        const worksheet =
            window.XLSX.utils.aoa_to_sheet(
                lines
            );

        const workbook =
            window.XLSX.utils.book_new();

        window.XLSX.utils.book_append_sheet(
            workbook,
            worksheet,
            "Report"
        );

        // "biff8" is the classic Excel .xls format.
        const blob =

            new Blob(
                [
                    window.XLSX.write(
                        workbook,
                        {
                            bookType: "biff8",
                            type: "array"
                        }
                    )
                ],
                {
                    type:
                        "application/vnd.ms-excel"
                }
            );


        const url =
            URL.createObjectURL(
                blob
            );


        const link =
            document.createElement(
                "a"
            );


        link.href =
            url;


        link.download =
            `${currentReport}-report.xls`;


        document.body.appendChild(
            link
        );


        link.click();


        link.remove();


        URL.revokeObjectURL(
            url
        );

    }


    /* =====================================================
       PRINT
    ===================================================== */

    function printReport() {

        if (
            !lastReportData
        ) {

            return;
        }


        const title =
            lastReportData.title;


        const tableCard =
            document.querySelector(
                ".reports-table-card"
            );


        if (!tableCard) {
            return;
        }


        const clone =
            tableCard.cloneNode(
                true
            );


        clone

            .querySelectorAll(
                "button, .reports-icon-action"
            )

            .forEach(
                element =>
                    element.remove()
            );


        const printWindow =
            window.open(
                "",
                "_blank",
                "width=1200,height=800"
            );


        if (!printWindow) {

            return;
        }


        printWindow.document.write(`

            <!DOCTYPE html>

            <html>

                <head>

                    <title>
                        ${escapeHtml(
                            title
                        )}
                    </title>


                    <style>

                        body {

                            font-family:
                                Arial,
                                sans-serif;

                            padding:
                                24px;

                            color:
                                #222;

                        }


                        h1 {

                            margin:
                                0 0 6px;

                        }


                        p {

                            color:
                                #666;

                        }


                        .reports-table {

                            width:
                                100%;

                            border-collapse:
                                collapse;

                            margin-top:
                                20px;

                        }


                        .reports-table th,
                        .reports-table td {

                            border:
                                1px solid #ddd;

                            padding:
                                8px;

                            text-align:
                                left;

                            font-size:
                                12px;

                        }


                        .reports-table th {

                            background:
                                #f2f2f2;

                        }


                        .reports-status-badge {

                            padding:
                                3px 7px;

                            border-radius:
                                12px;

                        }


                        .reports-progress-track {

                            display:
                                none;

                        }

                    </style>

                </head>


                <body>

                    <h1>
                        ${escapeHtml(
                            title
                        )}
                    </h1>


                    <p>
                        ${escapeHtml(
                            lastReportData.subtitle
                        )}
                    </p>


                    ${clone.outerHTML}

                </body>

            </html>

        `);


        printWindow.document.close();


        printWindow.focus();


        printWindow.print();


        printWindow.close();

    }


    /* =====================================================
       EVENT HANDLERS
    ===================================================== */

    el.cards.forEach(
        card => {

            card.addEventListener(
                "click",
                () => {

                    switchReport(
                        card.dataset.report
                    );

                }
            );

        }
    );


    el.previous.addEventListener(
        "click",
        () => {

            if (
                currentPage >
                1
            ) {

                currentPage--;

                renderRows();
            }

        }
    );


    el.next.addEventListener(
        "click",
        () => {

            const pageCount =

                Math.ceil(
                    rows.length /
                    PAGE_SIZE
                );


            if (
                currentPage <
                pageCount
            ) {

                currentPage++;

                renderRows();
            }

        }
    );


    el.export.addEventListener(
        "click",
        exportReport
    );


    el.print.addEventListener(
        "click",
        printReport
    );


    el.refresh.addEventListener(
        "click",
        () => {

            refreshReportData();

        }
    );


    /* =====================================================
       INITIAL LOAD
    ===================================================== */

    renderFilters();

    refreshReportData();

})();