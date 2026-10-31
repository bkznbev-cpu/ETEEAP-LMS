/* =========================================================
   SIKNAYAN - ACADEMIC ADMIN
   CLASSES
   ---------------------------------------------------------
   Handles:
   - Class list
   - Search
   - Program / Course / Status filters
   - Add Class
   - Edit Class
   - Delete Class
   - View Class Details
   - Instructor assignment
   - learnerIds[] relationship
   - moduleIds[] relationship
   - localStorage persistence
   ========================================================= */

(function () {

    "use strict";


    /* =====================================================
       STORAGE KEYS
       ===================================================== */

    const CLASSES_STORAGE_KEY =
        "siknayan_academic_admin_classes";

    const INSTRUCTORS_STORAGE_KEY =
        "siknayan_academic_admin_instructors";

    const LEARNERS_STORAGE_KEY =
        "siknayan_academic_admin_learners";


        /* =====================================================
   LARAVEL API
   ===================================================== */

const API_BASE_URL =
    window.SIKNAYAN_API_ROOT;

const API_TOKEN_STORAGE_KEY =
    "siknayan_api_token";



function getApiToken() {
    return (
        sessionStorage.getItem("authToken") ||
        window.SIKNAYAN_API_TOKEN ||
        localStorage.getItem("siknayan_api_token") ||
        localStorage.getItem("token") ||
        localStorage.getItem("access_token") ||
        ""
    );
}



async function apiRequest(
    path,
    options = {}
) {

    const token =
        getApiToken();

    if (!token) {

        window.handleAdminSessionExpired?.();
        throw new Error(
            "Your session has ended. Please log in again."
        );
    }


    const response =
        await fetch(
            `${API_BASE_URL}${path}`,
            {
                ...options,

                headers: {
                    "Accept":
                        "application/json",

                    "Content-Type":
                        "application/json",

                    ...(options.headers || {}),

                    "Authorization":
                        `Bearer ${token}`
                }
            }
        );


    let payload = null;

    try {

        payload =
            await response.json();

    } catch {

        payload = null;

    }


    if (!response.ok) {

        const message =
            payload?.message ||
            `API request failed (${response.status}).`;


        if (
            response.status ===
            401
        ) {

            window.handleAdminSessionExpired?.();
            throw new Error(
                "Your session has ended. Please log in again."
            );
        }


        if (
            response.status ===
                422 &&
            payload?.errors
        ) {

            const firstError =
                Object.values(
                    payload.errors
                )
                    .flat()[0];

            throw new Error(
                firstError ||
                message
            );
        }


        throw new Error(
            message
        );
    }


    return payload;
}


    /* =====================================================
       CENTRALIZED PROGRAM / COURSE DATA
       -----------------------------------------------------
       Programs:
           program-data.js
           window.SiknayanPrograms

       Courses:
           module-library-data.js
           window.SiknayanModuleLibraryData

       There is intentionally NO duplicate PROGRAMS
       object in this file.
       ===================================================== */

    function getProgramSource() {

        if (
            window.SiknayanPrograms &&
            typeof window.SiknayanPrograms.getAll ===
                "function"
        ) {

            return window.SiknayanPrograms;
        }

        console.error(
            "Classes: program-data.js was not loaded."
        );

        return null;
    }


    function getModuleLibrarySource() {

        if (
            window.SiknayanModuleLibraryData &&
            typeof window.SiknayanModuleLibraryData.getProgram ===
                "function"
        ) {

            return window.SiknayanModuleLibraryData;
        }

        console.error(
            "Classes: module-library-data.js was not loaded."
        );

        return null;
    }


    function getAllPrograms() {

        const source =
            getProgramSource();

        if (!source) {
            return [];
        }

        const programs =
            source.getAll();

        return Array.isArray(programs)
            ? programs
            : [];
    }


    function getProgramCode(
        program
    ) {

        if (!program) {
            return "";
        }

        return String(
            program.code ||
            program.id ||
            program.programCode ||
            ""
        ).trim();
    }


    function getProgramName(
        program
    ) {

        if (!program) {
            return "";
        }

        return String(
            program.name ||
            program.title ||
            getProgramCode(program)
        ).trim();
    }


    function getCourseCode(
        course
    ) {

        if (!course) {
            return "";
        }

        return String(
            course.code ||
            course.id ||
            course.courseCode ||
            ""
        ).trim();
    }


    function getCourseName(
        course
    ) {

        if (!course) {
            return "";
        }

        return String(
            course.name ||
            course.courseName ||
            course.title ||
            getCourseCode(course)
        ).trim();
    }


    function getProgramByCode(
        programCode
    ) {

        const source =
            getProgramSource();

        if (!source) {
            return null;
        }


        if (
            typeof source.getByCode ===
            "function"
        ) {

            return source.getByCode(
                programCode
            );
        }


        const normalizedCode =
            String(
                programCode || ""
            )
                .trim()
                .toLowerCase();


        return (
            getAllPrograms().find(
                program =>
                    getProgramCode(
                        program
                    )
                        .toLowerCase() ===
                    normalizedCode
            ) ||
            null
        );
    }


    function getProgramCourses(
        programCode
    ) {

        const source =
            getModuleLibrarySource();

        if (!source) {
            return [];
        }


        const program =
            source.getProgram(
                programCode
            );

        if (!program) {
            return [];
        }


        if (
            Array.isArray(
                program.courses
            )
        ) {

            return program.courses;
        }


        if (
            program.courses &&
            typeof program.courses ===
                "object"
        ) {

            return Object.values(
                program.courses
            );
        }


        return [];
    }


    function findCourse(
        programCode,
        courseCode
    ) {

        const normalizedCourseCode =
            String(
                courseCode || ""
            )
                .trim()
                .toUpperCase();


        if (!normalizedCourseCode) {
            return null;
        }


        return (
            getProgramCourses(
                programCode
            ).find(
                course =>
                    getCourseCode(
                        course
                    )
                        .toUpperCase() ===
                    normalizedCourseCode
            ) ||
            null
        );
    }


    /* =====================================================
       DEFAULT INSTRUCTORS
       ===================================================== */

    const DEFAULT_INSTRUCTORS = [

        {
            id: "INS-001",
            name: "Maria Santos"
        },

        {
            id: "INS-002",
            name: "Juan Dela Cruz"
        },

        {
            id: "INS-003",
            name: "Leon Ramos"
        },

        {
            id: "INS-004",
            name: "Anna Garcia"
        }

    ];


    /* =====================================================
       DEFAULT CLASSES
       ===================================================== */

    const DEFAULT_CLASSES = [

        {
            id: "class-crim101-a",
            classCode: "CRIM 101-A",
            program: "BSCRIM",
            courseCode: "CRIM 101",
            courseName: "Criminal Law Fundamentals",
            instructorId: "INS-001",
            instructorName: "Maria Santos",
            learnerIds: [],
            moduleIds: [],
            learners: 24,
            status: "active"
        },

        {
            id: "class-crim102-a",
            classCode: "CRIM 102-A",
            program: "BSCRIM",
            courseCode: "CRIM 102",
            courseName: "Forensic Science",
            instructorId: "INS-002",
            instructorName: "Juan Dela Cruz",
            learnerIds: [],
            moduleIds: [],
            learners: 18,
            status: "active"
        },

        {
            id: "class-crim103-a",
            classCode: "CRIM 103-A",
            program: "BSCRIM",
            courseCode: "CRIM 103",
            courseName: "Criminal Investigation",
            instructorId: "INS-003",
            instructorName: "Leon Ramos",
            learnerIds: [],
            moduleIds: [],
            learners: 21,
            status: "active"
        },

        {
            id: "class-oadm101-a",
            classCode: "OADM 101-A",
            program: "BSOA",
            courseCode: "OADM 101",
            courseName: "Office Administration Fundamentals",
            instructorId: "INS-004",
            instructorName: "Anna Garcia",
            learnerIds: [],
            moduleIds: [],
            learners: 16,
            status: "active"
        },

        {
            id: "class-nurs101-a",
            classCode: "NURS 101-A",
            program: "BSN",
            courseCode: "NURS 101",
            courseName: "Fundamentals of Nursing",
            instructorId: "INS-001",
            instructorName: "Maria Santos",
            learnerIds: [],
            moduleIds: [],
            learners: 27,
            status: "active"
        }

    ];


    /* =====================================================
       PAGE STATE
       ===================================================== */

    let classes = [];

    let instructors = [];

    let learners = [];


    /* =====================================================
       INITIALIZATION
       ===================================================== */

    document.addEventListener(
        "DOMContentLoaded",
        initializeClassesPage
    );


  async function initializeClassesPage() {

    const classesPage =
        document.querySelector(
            ".classes-page"
        );

    if (!classesPage) {
        return;
    }

    try {

        await migrateAndLoadData();

    } catch (error) {

        console.error(
            "Classes API initialization failed:",
            error
        );

        window.alert(
            error.message ||
            "Unable to load classes from the backend."
        );

        return;
    }

    bindPageControls();

    populateProgramFilter();

    updateCourseFilter();

    renderClasses();

    handleEditQuery();

    refreshIcons();
}
/* =====================================================
   DELETE CLASS
   ===================================================== */

function openDeleteClassModal(
    classItem
) {

    return;
}


/* =====================================================
   LOAD FROM LARAVEL API
   ===================================================== */

async function migrateAndLoadData() {

    const [
        instructorPayload,
        learnerPayload,
        classPayload
    ] = await Promise.all([

        apiRequest(
            "/admin/instructors"
        ),

        apiRequest(
            "/admin/learners"
        ),

        apiRequest(
            "/admin/classes"
        )

    ]);


    instructors =
        Array.isArray(
            instructorPayload?.instructors
        )
            ? instructorPayload.instructors
            : [];


    learners =
        Array.isArray(
            learnerPayload?.learners
        )
            ? learnerPayload.learners
            : [];


    classes =
        Array.isArray(
            classPayload?.classes
        )
            ? classPayload.classes.map(
                normalizeApiClass
            )
            : [];
}


function normalizeApiClass(
    classItem
) {

    const apiLearners =
        Array.isArray(
            classItem.learners
        )
            ? classItem.learners
            : [];


    const instructor =
        classItem.instructor ||
        null;


    return {

        id:
            classItem.id,


        /*
         * Laravel Course currently has
         * one "code" field.
         *
         * The existing frontend has
         * classCode + courseCode.
         *
         * Map both to the backend code
         * without changing the UI.
         */

        classCode:
            classItem.code || "",


        program:
            classItem.program || "",


        courseCode:
    classItem.subject_code ||
    classItem.code ||
    "",


        courseName:
            classItem.name || "",


        instructorId:
            classItem.instructor_id ?? "",


        instructorName:
            instructor?.name ||
            "Unassigned",


        learnerIds:
            apiLearners.map(
                learner =>
                    learner.id
            ),


        moduleIds: [],


        learners:
            Number(
                classItem.learners_count ??
                apiLearners.length ??
                0
            ),


        modules:
            Number(
                classItem.modules_count ??
                0
            ),


        description:
            classItem.description ||
            "",


        status:
            classItem.is_active
                ? "active"
                : "inactive"

    };
}


/*
 * These are retained so older code
 * doesn't break, but Laravel is now
 * the source of truth.
 */

function saveInstructors(
    data
) {

    return data;
}


function saveClasses(
    data
) {

    return data;
}


function cloneArray(
    data
) {

    return JSON.parse(
        JSON.stringify(data)
    );
}


    function saveInstructors(
        data
    ) {

        localStorage.setItem(
            INSTRUCTORS_STORAGE_KEY,
            JSON.stringify(
                data
            )
        );
    }


    function loadLearners() {

        try {

            const stored =
                localStorage.getItem(
                    LEARNERS_STORAGE_KEY
                );


            if (!stored) {
                return [];
            }


            const parsed =
                JSON.parse(
                    stored
                );


            return Array.isArray(
                parsed
            )
                ? parsed
                : [];

        } catch (error) {

            console.error(
                "Unable to load learners:",
                error
            );

            return [];
        }
    }


    function loadClasses() {

        try {

            const stored =
                localStorage.getItem(
                    CLASSES_STORAGE_KEY
                );


            /*
             * FIRST LOAD
             */

            if (!stored) {

                const fresh =
                    cloneArray(
                        DEFAULT_CLASSES
                    );


                fresh.forEach(
                    classItem => {

                        if (
                            !Array.isArray(
                                classItem.learnerIds
                            )
                        ) {

                            classItem.learnerIds =
                                [];
                        }


                        if (
                            !Array.isArray(
                                classItem.moduleIds
                            )
                        ) {

                            classItem.moduleIds =
                                [];
                        }


                        classItem.learners =
                            classItem.learnerIds.length;
                    }
                );


                saveClasses(
                    fresh
                );


                return fresh;
            }


            /*
             * EXISTING DATA
             */

            const parsed =
                JSON.parse(
                    stored
                );


            if (
                !Array.isArray(
                    parsed
                )
            ) {

                return cloneArray(
                    DEFAULT_CLASSES
                );
            }


            const migrated =
                parsed.map(
                    classItem => {

                        const instructor =
                            instructors.find(
                                item =>
                                    item.id ===
                                    classItem.instructorId
                            );


                        const existingLearnerIds =
                            Array.isArray(
                                classItem.learnerIds
                            )
                                ? classItem.learnerIds
                                : [];


                        const existingModuleIds =
                            Array.isArray(
                                classItem.moduleIds
                            )
                                ? classItem.moduleIds
                                : [];


                        /* -------------------------------------------------
                        LEGACY BSOA COURSE MIGRATION
                        -------------------------------------------------
                        Older prototype data used OADM course codes.

                        Current centralized course data uses:
                        BSOA 101
                        BSOA 102
                        BSOA 103
                        BSOA 104

                        Convert old stored records automatically.
                        ------------------------------------------------- */

                        let migratedCourseCode =
                            String(
                                classItem.courseCode ||
                                ""
                            ).trim();

                        let migratedClassCode =
                            String(
                                classItem.classCode ||
                                ""
                            ).trim();


                        const legacyCourseMap = {
                            "OADM 101": "BSOA 101",
                            "OADM 102": "BSOA 102",
                            "OADM 103": "BSOA 103"
                        };


                        const normalizedLegacyCourse =
                            migratedCourseCode.toUpperCase();


                        if (
                            legacyCourseMap[
                                normalizedLegacyCourse
                            ]
                        ) {

                            migratedCourseCode =
                                legacyCourseMap[
                                    normalizedLegacyCourse
                                ];


                            /* Also update the class code prefix. */

                            migratedClassCode =
                                migratedClassCode.replace(
                                    /^OADM\s+/i,
                                    "BSOA "
                                );

                        }


                        /* -------------------------------------------------
                        GET THE CURRENT COURSE FROM THE
                        CENTRALIZED MODULE LIBRARY
                        ------------------------------------------------- */

                        const currentCourse =
                            findCourse(
                                classItem.program,
                                migratedCourseCode
                            );


                        const migratedCourseName =
                            currentCourse
                                ? getCourseName(
                                    currentCourse
                                )
                                : (
                                    classItem.courseName ||
                                    migratedCourseCode
                                );


                        return {

                            ...classItem,

                            classCode:
                                migratedClassCode,

                            courseCode:
                                migratedCourseCode,

                            courseName:
                                migratedCourseName,

                            learnerIds:
                                existingLearnerIds,

                            moduleIds:
                                existingModuleIds,

                            learners:
                                existingLearnerIds.length,

                            instructorName:
                                classItem.instructorName ||
                                instructor?.name ||
                                "Unassigned",

                            status:
                                normalizeStatus(
                                    classItem.status
                                )

                        };

                    }
                );


            saveClasses(
                migrated
            );


            return migrated;

        } catch (error) {

            console.error(
                "Unable to load classes:",
                error
            );

            return cloneArray(
                DEFAULT_CLASSES
            );
        }
    }


    function saveClasses(
        data
    ) {

        localStorage.setItem(
            CLASSES_STORAGE_KEY,
            JSON.stringify(
                data
            )
        );
    }


    function cloneArray(
        data
    ) {

        return JSON.parse(
            JSON.stringify(
                data
            )
        );
    }


    /* =====================================================
       DOM HELPERS
       ===================================================== */

    function getFirstElement(
        selectors
    ) {

        for (
            const selector of selectors
        ) {

            const element =
                document.querySelector(
                    selector
                );


            if (element) {
                return element;
            }
        }


        return null;
    }


    function getClassesTableBody() {

        return getFirstElement([
            "#classTableBody",
            "#classesTableBody",
            ".classes-table tbody"
        ]);
    }


    function getSearchInput() {

        return getFirstElement([
            "#classSearch",
            "#classesSearch",
            ".classes-search-box input",
            ".classes-search-input"
        ]);
    }


    function getProgramFilter() {

        return getFirstElement([
            "#programFilter",
            "#classProgramFilter"
        ]);
    }


    function getCourseFilter() {

        return getFirstElement([
            "#courseFilter",
            "#classCourseFilter"
        ]);
    }


    function getStatusFilter() {

        return getFirstElement([
            "#statusFilter",
            "#classStatusFilter"
        ]);
    }


    function getAddClassButton() {

        return getFirstElement([
            "#addClassButton",
            ".classes-add-button"
        ]);
    }


    function getEmptyState() {

        return getFirstElement([
            "#classesEmptyState",
            "#classEmptyState",
            ".classes-empty-state"
        ]);
    }


    /* =====================================================
       PAGE CONTROLS
       ===================================================== */

    function bindPageControls() {

        const searchInput =
            getSearchInput();

        const programFilter =
            getProgramFilter();

        const courseFilter =
            getCourseFilter();

        const statusFilter =
            getStatusFilter();

        const addClassButton =
            getAddClassButton();


        if (searchInput) {

            searchInput.addEventListener(
                "input",
                renderClasses
            );
        }


        if (programFilter) {

            programFilter.addEventListener(
                "change",
                () => {

                    updateCourseFilter();

                    renderClasses();
                }
            );
        }


        if (courseFilter) {

            courseFilter.addEventListener(
                "change",
                renderClasses
            );
        }


        if (statusFilter) {

            statusFilter.addEventListener(
                "change",
                renderClasses
            );
        }


        if (addClassButton) {

            addClassButton.addEventListener(
                "click",
                openAddClassModal
            );
        }


        const tableBody =
            getClassesTableBody();


        if (tableBody) {

            tableBody.addEventListener(
                "click",
                handleTableAction
            );
        }


        document.addEventListener(
            "click",
            handleDocumentClick
        );


        document.addEventListener(
            "keydown",
            event => {

                if (
                    event.key ===
                    "Escape"
                ) {

                    closeDynamicModal();
                }
            }
        );
    }


    /* =====================================================
       PROGRAM FILTER
       ===================================================== */

    function populateProgramFilter() {

        const programFilter =
            getProgramFilter();

        if (!programFilter) {
            return;
        }


        const currentValue =
            programFilter.value ||
            "all";


        programFilter.innerHTML =
            "";


        const allOption =
            document.createElement(
                "option"
            );


        allOption.value =
            "all";


        allOption.textContent =
            "All Programs";


        programFilter.appendChild(
            allOption
        );


        getAllPrograms().forEach(
            program => {

                const programCode =
                    getProgramCode(
                        program
                    );


                if (!programCode) {
                    return;
                }


                const option =
                    document.createElement(
                        "option"
                    );


                option.value =
                    programCode;


                const programName =
                    getProgramName(
                        program
                    );


                option.textContent =
                    programName &&
                    programName !==
                        programCode
                        ? `${programCode} — ${programName}`
                        : programCode;


                programFilter.appendChild(
                    option
                );
            }
        );


        const matchingOption =
            Array.from(
                programFilter.options
            ).find(
                option =>
                    option.value ===
                    currentValue
            );


        programFilter.value =
            matchingOption
                ? currentValue
                : "all";
    }


    /* =====================================================
       COURSE FILTER
       ===================================================== */

    function updateCourseFilter() {

        const programFilter =
            getProgramFilter();

        const courseFilter =
            getCourseFilter();


        if (
            !programFilter ||
            !courseFilter
        ) {

            return;
        }


        const selectedProgram =
            programFilter.value;


        const currentValue =
            courseFilter.value;


        courseFilter.innerHTML =
            "";


        const allOption =
            document.createElement(
                "option"
            );


        allOption.value =
            "all";


        allOption.textContent =
            "All Courses";


        courseFilter.appendChild(
            allOption
        );


        /*
         * ALL PROGRAMS
         */

        if (
            selectedProgram === "all" ||
            !selectedProgram
        ) {

            getAllPrograms().forEach(
                program => {

                    const programCode =
                        getProgramCode(
                            program
                        );


                    if (!programCode) {
                        return;
                    }


                    getProgramCourses(
                        programCode
                    ).forEach(
                        course => {

                            addCourseOption(
                                courseFilter,
                                course
                            );
                        }
                    );
                }
            );

        } else {

            /*
             * SPECIFIC PROGRAM
             */

            getProgramCourses(
                selectedProgram
            ).forEach(
                course => {

                    addCourseOption(
                        courseFilter,
                        course
                    );
                }
            );
        }


        const existingOption =
            Array.from(
                courseFilter.options
            ).find(
                option =>
                    option.value ===
                    currentValue
            );


        courseFilter.value =
            existingOption
                ? currentValue
                : "all";
    }


    function addCourseOption(
        select,
        course
    ) {

        const courseCode =
            getCourseCode(
                course
            );


        const courseName =
            getCourseName(
                course
            );


        if (!courseCode) {
            return;
        }


        const exists =
            Array.from(
                select.options
            ).some(
                option =>
                    option.value ===
                    courseCode
            );


        if (exists) {
            return;
        }


        const option =
            document.createElement(
                "option"
            );


        option.value =
            courseCode;


        option.textContent =
            `${courseName} (${courseCode})`;


        select.appendChild(
            option
        );
    }


    /* =====================================================
       RENDER CLASSES
       ===================================================== */

    function renderClasses() {

        const tableBody =
            getClassesTableBody();


        if (!tableBody) {

            console.error(
                "Classes table body was not found."
            );

            return;
        }


        tableBody.innerHTML =
            "";


        const searchQuery =
            (
                getSearchInput()?.value ||
                ""
            )
                .trim()
                .toLowerCase();


        const program =
            getProgramFilter()?.value ||
            "all";


        const course =
            getCourseFilter()?.value ||
            "all";


        const status =
            getStatusFilter()?.value ||
            "all";


        const filtered =
            classes.filter(
                classItem => {

                    const classCode =
                        String(
                            classItem.classCode ||
                            ""
                        )
                            .toLowerCase();


                    const courseName =
                        String(
                            classItem.courseName ||
                            ""
                        )
                            .toLowerCase();


                    const courseCode =
                        String(
                            classItem.courseCode ||
                            ""
                        )
                            .toLowerCase();


                    const instructorName =
                        String(
                            classItem.instructorName ||
                            ""
                        )
                            .toLowerCase();


                    const matchesSearch =
                        !searchQuery ||
                        classCode.includes(
                            searchQuery
                        ) ||
                        courseName.includes(
                            searchQuery
                        ) ||
                        courseCode.includes(
                            searchQuery
                        ) ||
                        instructorName.includes(
                            searchQuery
                        );


                    const matchesProgram =
                        program === "all" ||
                        classItem.program ===
                            program;


                    const matchesCourse =
                        course === "all" ||
                        classItem.courseCode ===
                            course;


                    const matchesStatus =
                        status === "all" ||
                        classItem.status ===
                            status;


                    return (
                        matchesSearch &&
                        matchesProgram &&
                        matchesCourse &&
                        matchesStatus
                    );
                }
            );


        filtered.forEach(
            classItem => {

                tableBody.appendChild(
                    createClassRow(
                        classItem
                    )
                );
            }
        );


        updateEmptyState(
            filtered.length === 0
        );


        refreshIcons();
    }


    /* =====================================================
       CREATE CLASS ROW
       ===================================================== */

    function createClassRow(
        classItem
    ) {

        const row =
            document.createElement(
                "tr"
            );


        row.className =
            "class-row";


        row.dataset.classId =
            classItem.id;


        const learnerCount =
            getDisplayedLearnerCount(
                classItem
            );


        row.innerHTML = `

            <td>
                <strong class="class-code">
                    ${escapeHtml(
                        classItem.classCode
                    )}
                </strong>

                <small class="class-mobile-extra">
                    ${escapeHtml(
                        classItem.program
                    )}
                </small>
            </td>

            <td>
                ${escapeHtml(
                    classItem.program
                )}
            </td>

            <td>
                <div class="class-course-name">
                    ${escapeHtml(
                        classItem.courseName
                    )}
                </div>

                <small>
                    ${escapeHtml(
                        classItem.courseCode
                    )}
                </small>

                <small class="class-mobile-extra class-mobile-instructor">
                    ${escapeHtml(
                        classItem.instructorName ||
                        "Unassigned"
                    )}
                </small>
            </td>

            <td>
                <span class="class-instructor-name">
                    ${escapeHtml(
                        classItem.instructorName ||
                        "Unassigned"
                    )}
                </span>
            </td>

            <td>
                <span class="class-learner-count">
                    ${learnerCount}
                </span>
            </td>

            <td>
                <span
                    class="classes-status-badge ${escapeHtml(
                        normalizeStatus(
                            classItem.status
                        )
                    )}"
                >
                    ${escapeHtml(
                        formatStatus(
                            classItem.status
                        )
                    )}
                </span>
            </td>

            <td>

                <div class="class-actions">

                    <button
                        type="button"
                        class="class-action-button edit-class"
                        data-action="edit"
                        data-class-id="${escapeHtml(
                            classItem.id
                        )}"
                        title="Edit Class"
                        aria-label="Edit class"
                    >
                        <i data-lucide="pencil"></i>
                    </button>

                    <button
                        type="button"
                        class="class-action-button delete-class"
                        data-action="delete"
                        data-class-id="${escapeHtml(
                            classItem.id
                        )}"
                        title="Delete Class"
                        aria-label="Delete class"
                    >
                        <i data-lucide="trash-2"></i>
                    </button>

                </div>

            </td>

        `;


        return row;
    }


    /* =====================================================
       LEARNER COUNT
       ===================================================== */

    function getDisplayedLearnerCount(
        classItem
    ) {

        if (
            Array.isArray(
                classItem?.learnerIds
            )
        ) {

            return classItem.learnerIds.length;
        }


        return 0;
    }


    /* =====================================================
       EMPTY STATE
       ===================================================== */

    function updateEmptyState(
        isEmpty
    ) {

        const emptyState =
            getEmptyState();


        if (!emptyState) {
            return;
        }


        emptyState.hidden =
            !isEmpty;


        emptyState.style.display =
            isEmpty
                ? "flex"
                : "none";
    }


    /* =====================================================
       TABLE ACTIONS
       ===================================================== */

    function handleTableAction(
        event
    ) {

        const button =
            event.target.closest(
                "[data-action]"
            );


        if (button) {

            const action =
                button.dataset.action;


            const classId =
                button.dataset.classId;


            const classItem =
                findClass(
                    classId
                );


            if (!classItem) {
                return;
            }


            if (
                action ===
                "edit"
            ) {

                openEditClassModal(
                    classItem
                );

                return;
            }


            if (
                action ===
                "delete"
            ) {

                openDeleteClassModal(
                    classItem
                );

                return;
            }
        }


        const row =
            event.target.closest(
                ".class-row"
            );


        if (
            row &&
            !event.target.closest(
                ".class-actions"
            )
        ) {

            const classId =
                row.dataset.classId;


            const classItem =
                findClass(
                    classId
                );


            if (!classItem) {
                return;
            }


            openClassDetails(
                classItem
            );
        }
    }


    /* =====================================================
       CLASS DETAILS
       ===================================================== */

    function openClassDetails(
        classItem
    ) {

        window.location.href =
            `class-details.html?id=${encodeURIComponent(
                classItem.id
            )}`;
    }


    /* =====================================================
       ADD CLASS
       ===================================================== */

    function openAddClassModal() {

        const programs =
            getAllPrograms();


        const firstProgram =
            programs[0];


        const firstProgramCode =
            getProgramCode(
                firstProgram
            );


        const firstCourse =
            getProgramCourses(
                firstProgramCode
            )[0];


        createClassModal({

            mode: "add",

            classItem: {

                program:
                    firstProgramCode,

                courseCode:
                    getCourseCode(
                        firstCourse
                    ),

                classCode: "",

                instructorId:
                    instructors[0]?.id ||
                    "",

                status:
                    "active",

                learnerIds: [],

                moduleIds: []
            }

        });
    }


    /* =====================================================
       EDIT CLASS
       ===================================================== */

    function openEditClassModal(
        classItem
    ) {

        createClassModal({

            mode: "edit",

            classItem

        });
    }


    /* =====================================================
       CLASS FORM MODAL
       ===================================================== */

    function createClassModal({
        mode,
        classItem
    }) {

        closeDynamicModal();


        const isEdit =
            mode === "edit";


        const overlay =
            document.createElement(
                "div"
            );


        overlay.className =
            "modal-overlay active";


        overlay.id =
            "dynamicClassModal";


        overlay.setAttribute(
            "aria-hidden",
            "false"
        );


        overlay.innerHTML = `

            <div
                class="modal-card"
                role="dialog"
                aria-modal="true"
                aria-labelledby="dynamicClassModalTitle"
            >

                <div class="modal-header">

                    <h3 id="dynamicClassModalTitle">
                        ${
                            isEdit
                                ? "Edit Class"
                                : "Add Class"
                        }
                    </h3>

                    <p>
                        ${
                            isEdit
                                ? "Update the class information and assigned instructor."
                                : "Create a class and assign one instructor."
                        }
                    </p>

                </div>


                <form id="dynamicClassForm">

                    <div class="form-group">

                        <label for="dynamicClassProgram">
                            Program
                        </label>

                        <select
                            id="dynamicClassProgram"
                            class="form-select"
                            required
                        >
                        </select>

                        <div
                            class="form-error"
                            id="dynamicClassProgramError"
                        >
                            Please select a program.
                        </div>

                    </div>


                    <div class="form-group">

                        <label for="dynamicClassCourse">
                            Course
                        </label>

                        <select
                            id="dynamicClassCourse"
                            class="form-select"
                            required
                        >
                        </select>

                        <div
                            class="form-error"
                            id="dynamicClassCourseError"
                        >
                            Please select a course.
                        </div>

                    </div>


                    <div class="form-group">

                        <label for="dynamicClassCode">
                            Class Code
                        </label>

                        <input
                            type="text"
                            id="dynamicClassCode"
                            class="form-input"
                            maxlength="50"
                            placeholder="e.g. CRIM 101-A"
                            value="${escapeHtml(
                                classItem.classCode ||
                                ""
                            )}"
                            required
                        >

                        <div
                            class="form-error"
                            id="dynamicClassCodeError"
                        >
                            Please enter a class code.
                        </div>

                    </div>


                    <div class="form-group">

                        <label for="dynamicClassInstructor">
                            Instructor
                        </label>

                        <select
                            id="dynamicClassInstructor"
                            class="form-select"
                            required
                        >
                        </select>

                        <div class="field-help">
                            Each class can have exactly one instructor.
                        </div>

                        <div
                            class="form-error"
                            id="dynamicClassInstructorError"
                        >
                            Please select an instructor.
                        </div>

                    </div>


                    ${
                        isEdit
                            ? `

                                <div class="form-group">

                                    <label for="dynamicClassStatus">
                                        Status
                                    </label>

                                    <select
                                        id="dynamicClassStatus"
                                        class="form-select"
                                    >

                                        <option value="active">
                                            Active
                                        </option>

                                        <option value="inactive">
                                            Inactive
                                        </option>

                                    </select>

                                </div>

                              `
                            : ""
                    }


                    <div
                        class="form-error"
                        id="dynamicClassDuplicateError"
                    >
                        A class with this class code already exists.
                    </div>

                    <div class="modal-actions">

                        <button
                            type="button"
                            class="modal-button cancel"
                            id="dynamicClassCancel"
                        >
                            Cancel
                        </button>


                        <button
                            type="submit"
                            class="modal-button primary"
                        >
                            ${
                                isEdit
                                    ? "Save Changes"
                                    : "Create Class"
                            }
                        </button>

                    </div>

                </form>

            </div>

        `;


        document.body.appendChild(
            overlay
        );


        const programSelect =
            overlay.querySelector(
                "#dynamicClassProgram"
            );


        const courseSelect =
            overlay.querySelector(
                "#dynamicClassCourse"
            );


        const instructorSelect =
            overlay.querySelector(
                "#dynamicClassInstructor"
            );


        const statusSelect =
            overlay.querySelector(
                "#dynamicClassStatus"
            );


        populateProgramSelect(
            programSelect,
            classItem.program
        );


        populateCourseSelect(
            courseSelect,
            classItem.program,
            classItem.courseCode
        );


        populateInstructorSelect(
            instructorSelect,
            classItem.instructorId
        );


        if (statusSelect) {

            statusSelect.value =
                normalizeStatus(
                    classItem.status
                );
        }


        programSelect.addEventListener(
            "change",
            () => {

                populateCourseSelect(
                    courseSelect,
                    programSelect.value,
                    ""
                );
            }
        );


        overlay.querySelector(
            "#dynamicClassCancel"
        ).addEventListener(
            "click",
            closeDynamicModal
        );


        overlay.querySelector(
            "#dynamicClassForm"
        ).addEventListener(
            "submit",
            event => {

                event.preventDefault();

                saveClassFromForm(
                    overlay,
                    isEdit,
                    classItem
                );
            }
        );


        refreshIcons();
    }


    /* =====================================================
       PROGRAM SELECT
       ===================================================== */

    function populateProgramSelect(
        select,
        selectedValue
    ) {

        if (!select) {
            return;
        }


        select.innerHTML =
            `<option value="">
                Select program
            </option>`;


        getAllPrograms().forEach(
            program => {

                const programCode =
                    getProgramCode(
                        program
                    );


                if (!programCode) {
                    return;
                }


                const option =
                    document.createElement(
                        "option"
                    );


                option.value =
                    programCode;


                const programName =
                    getProgramName(
                        program
                    );


                option.textContent =
                    programName &&
                    programName !==
                        programCode
                        ? `${programCode} — ${programName}`
                        : programCode;


                if (
                    programCode ===
                    selectedValue
                ) {

                    option.selected =
                        true;
                }


                select.appendChild(
                    option
                );
            }
        );
    }


    /* =====================================================
       COURSE SELECT
       ===================================================== */

    function populateCourseSelect(
        select,
        programCode,
        selectedCourse
    ) {

        if (!select) {
            return;
        }


        select.innerHTML =
            `<option value="">
                Select course
            </option>`;


        getProgramCourses(
            programCode
        ).forEach(
            course => {

                const courseCode =
                    getCourseCode(
                        course
                    );


                const courseName =
                    getCourseName(
                        course
                    );


                if (!courseCode) {
                    return;
                }


                const option =
                    document.createElement(
                        "option"
                    );


                option.value =
                    courseCode;


                option.textContent =
                    `${courseName} (${courseCode})`;


                if (
                    courseCode ===
                    selectedCourse
                ) {

                    option.selected =
                        true;
                }


                select.appendChild(
                    option
                );
            }
        );
    }


    /* =====================================================
       INSTRUCTOR SELECT
       ===================================================== */

    function populateInstructorSelect(
        select,
        selectedInstructor
    ) {

        if (!select) {
            return;
        }


        select.innerHTML =
            `<option value="">
                Select instructor
            </option>`;


        instructors.forEach(
            instructor => {

                const option =
                    document.createElement(
                        "option"
                    );


                option.value =
                    instructor.id;


                option.textContent =
                    `${instructor.name} (${instructor.id})`;


                if (
                    instructor.id ===
                    selectedInstructor
                ) {

                    option.selected =
                        true;
                }


                select.appendChild(
                    option
                );
            }
        );
    }


  async function saveClassFromForm(
    overlay,
    isEdit,
    existingClass
) {
    const program =
        overlay.querySelector(
            "#dynamicClassProgram"
        ).value;

    const courseCode =
        overlay.querySelector(
            "#dynamicClassCourse"
        ).value;

    const classCode =
        overlay.querySelector(
            "#dynamicClassCode"
        ).value
            .trim()
            .toUpperCase();

    const instructorId =
        overlay.querySelector(
            "#dynamicClassInstructor"
        ).value;

    const statusElement =
        overlay.querySelector(
            "#dynamicClassStatus"
        );

    const status =
        statusElement
            ? statusElement.value
            : "active";

    clearClassFormErrors(overlay);

    let valid = true;

    if (!program) {
        showFormError(
            overlay,
            "#dynamicClassProgramError"
        );
        valid = false;
    }

    if (!courseCode) {
        showFormError(
            overlay,
            "#dynamicClassCourseError"
        );
        valid = false;
    }

    if (!classCode) {
        showFormError(
            overlay,
            "#dynamicClassCodeError"
        );
        valid = false;
    }

    if (!instructorId) {
        showFormError(
            overlay,
            "#dynamicClassInstructorError"
        );
        valid = false;
    }

    if (!valid) {
        return;
    }

    const selectedCourse = findCourse(
        program,
        courseCode
    );

    if (!selectedCourse) {
        showFormError(
            overlay,
            "#dynamicClassCourseError",
            "The selected course is invalid for the selected program."
        );
        return;
    }

    const courseName =
        getCourseName(selectedCourse);
const payload = {
    name: courseName,
    code: classCode,
    subject_code: courseCode,
    program: program,
    description:
        existingClass?.description || "",
    instructor_id:
        Number(instructorId),
    is_active:
        status === "active"
};

    try {
        let result;

        if (isEdit) {
            result = await apiRequest(
                `/admin/classes/${encodeURIComponent(
                    existingClass.id
                )}`,
                {
                    method: "PUT",
                    body: JSON.stringify(payload)
                }
            );
        } else {
            result = await apiRequest(
                "/admin/classes",
                {
                    method: "POST",
                    body: JSON.stringify(payload)
                }
            );
        }

        if (!result || !result.class) {
            throw new Error(
                "The backend did not return the saved class."
            );
        }

        const savedClass =
            normalizeApiClass(result.class);

        if (isEdit) {
            const index =
                classes.findIndex(
                    item =>
                        String(item.id) ===
                        String(existingClass.id)
                );

            if (index !== -1) {
                classes[index] =
                    savedClass;
            }
        } else {
            classes.push(savedClass);
        }

        closeDynamicModal();
        renderClasses();
        refreshIcons();

    } catch (error) {
        console.error(
            "Unable to save class:",
            error
        );

        showFormError(
            overlay,
            "#dynamicClassDuplicateError",
            error.message
        );
    }
}



    /* =====================================================
       DELETE CLASS
       ===================================================== */

    function openDeleteClassModal(
        classItem
    ) {

        closeDynamicModal();


        const learnerCount =
            getActualLearnerCount(
                classItem
            );


        const moduleCount =
            getActualModuleCount(
                classItem
            );


        const overlay =
            document.createElement(
                "div"
            );


        overlay.className =
            "modal-overlay active";


        overlay.id =
            "dynamicDeleteClassModal";


        overlay.innerHTML = `

            <div
                class="modal-card delete-modal"
                role="dialog"
                aria-modal="true"
            >

                <div class="modal-header">

                    <h3>
                        Delete Class
                    </h3>

                    <p>
                        Are you sure you want to delete
                        <strong>
                            ${escapeHtml(
                                classItem.classCode
                            )}
                        </strong>?
                    </p>

                </div>


                ${
                    learnerCount > 0
                        ? `
                            <div class="field-help">

                                This class currently has
                                ${learnerCount}
                                enrolled learner${
                                    learnerCount === 1
                                        ? ""
                                        : "s"
                                }.

                                Removing the class will remove
                                the class record, but learner
                                records will not be deleted.

                            </div>
                          `
                        : ""
                }


                ${
                    moduleCount > 0
                        ? `
                            <div class="field-help">

                                This class currently has
                                ${moduleCount}
                                assigned module${
                                    moduleCount === 1
                                        ? ""
                                        : "s"
                                }.

                                Removing the class will remove
                                the class record and its
                                class-module assignments,
                                but will not delete the modules
                                from the Module Library.

                            </div>
                          `
                        : ""
                }

                <div
                    class="form-error"
                    id="dynamicDeleteError"
                    role="alert"
                ></div>

                <div class="modal-actions">

                    <button
                        type="button"
                        class="modal-button cancel"
                        id="dynamicDeleteCancel"
                    >
                        Cancel
                    </button>


                    <button
                        type="button"
                        class="modal-button delete-confirm-button"
                        id="dynamicDeleteConfirm"
                    >
                        Delete
                    </button>

                </div>

            </div>

        `;


        document.body.appendChild(
            overlay
        );


        overlay.querySelector(
            "#dynamicDeleteCancel"
        ).addEventListener(
            "click",
            closeDynamicModal
        );


        overlay.querySelector(
            "#dynamicDeleteConfirm"
        ).addEventListener(
            "click",
            () => {

                deleteClass(
                    classItem.id
                );
            }
        );


        refreshIcons();
    }


    async function deleteClass(
        classId
    ) {

        const overlay =
            document.getElementById(
                "dynamicDeleteClassModal"
            );

        const confirmButton =
            overlay?.querySelector(
                "#dynamicDeleteConfirm"
            );

        if (!overlay || !confirmButton || confirmButton.disabled) {
            return;
        }

        confirmButton.disabled = true;
        confirmButton.textContent = "Deleting...";
        overlay.querySelector("#dynamicDeleteCancel").disabled = true;

        try {
            const payload = await apiRequest(
                `/admin/classes/${encodeURIComponent(classId)}`,
                {
                    method: "DELETE"
                }
            );

            if (!payload?.success) {
                throw new Error(
                    payload?.message || "The class could not be deleted."
                );
            }

            classes = classes.filter(
                classItem =>
                    String(classItem.id) !== String(classId)
            );

            saveClasses(classes);
            closeDynamicModal();
            renderClasses();
        } catch (error) {
            console.error("Unable to delete class:", error);
            confirmButton.disabled = false;
            confirmButton.textContent = "Delete";
            overlay.querySelector("#dynamicDeleteCancel").disabled = false;
            showFormError(
                overlay,
                "#dynamicDeleteError",
                error.message || "Unable to delete this class. Please try again."
            );
        }
    }


    /* =====================================================
       COUNTS
       ===================================================== */

    function getActualLearnerCount(
        classItem
    ) {

        if (
            Array.isArray(
                classItem.learnerIds
            )
        ) {

            return classItem.learnerIds.length;
        }


        return 0;
    }


    function getActualModuleCount(
        classItem
    ) {

        if (
            Array.isArray(
                classItem?.moduleIds
            )
        ) {

            return classItem.moduleIds.length;
        }


        return 0;
    }


    /* =====================================================
       EDIT QUERY
       ===================================================== */

    function handleEditQuery() {

        const params =
            new URLSearchParams(
                window.location.search
            );


        const editId =
            params.get(
                "edit"
            );


        if (!editId) {
            return;
        }


        const classItem =
            findClass(
                editId
            );


        if (!classItem) {
            return;
        }


        openEditClassModal(
            classItem
        );


        const cleanUrl =
            window.location.pathname;


        window.history.replaceState(
            {},
            document.title,
            cleanUrl
        );
    }


    /* =====================================================
       FIND CLASS
       ===================================================== */

    function findClass(
        classId
    ) {

        return classes.find(
            classItem =>
                String(
                    classItem.id
                ) ===
                String(
                    classId
                )
        );
    }


    /* =====================================================
       DOCUMENT CLICK
       ===================================================== */

    function handleDocumentClick(
        event
    ) {

        const overlay =
            event.target.closest(
                ".modal-overlay"
            );


        if (
            overlay &&
            event.target === overlay &&
            overlay.id.startsWith(
                "dynamic"
            )
        ) {

            closeDynamicModal();
        }
    }


    /* =====================================================
       CLOSE DYNAMIC MODALS
       ===================================================== */

    function closeDynamicModal() {

        const overlays =
            document.querySelectorAll(
                ".modal-overlay[id^='dynamic']"
            );


        overlays.forEach(
            overlay =>
                overlay.remove()
        );
    }


    /* =====================================================
       FORM ERRORS
       ===================================================== */

    function clearClassFormErrors(
        overlay
    ) {

        overlay
            .querySelectorAll(
                ".form-error"
            )
            .forEach(
                error => {

                    error.classList.remove(
                        "visible"
                    );
                }
            );
    }


    function showFormError(
        overlay,
        selector,
        customMessage
    ) {

        const error =
            overlay.querySelector(
                selector
            );


        if (!error) {
            return;
        }


        if (customMessage) {

            error.textContent =
                customMessage;
        }


        error.classList.add(
            "visible"
        );
    }


    /* =====================================================
       STATUS
       ===================================================== */

    function normalizeStatus(
        status
    ) {

        const value =
            String(
                status ||
                "active"
            )
                .trim()
                .toLowerCase();


        return value ===
            "inactive"
            ? "inactive"
            : "active";
    }


    function formatStatus(
        status
    ) {

        return normalizeStatus(
            status
        ) === "inactive"
            ? "Inactive"
            : "Active";
    }


    /* =====================================================
       ESCAPE HTML
       ===================================================== */

    function escapeHtml(
        value
    ) {

        return String(
            value ?? ""
        )
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


    /* =====================================================
       LUCIDE
       ===================================================== */

    function refreshIcons() {

        if (
            typeof lucide !==
                "undefined" &&
            typeof lucide.createIcons ===
                "function"
        ) {

            lucide.createIcons();
        }
    }


})();