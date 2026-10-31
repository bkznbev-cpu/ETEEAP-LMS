/* =========================================================
   SIKNAYAN - ACADEMIC ADMIN
   learners.js

   Learner data model:

   Learner Status
       Active
       Completed
       Inactive

   Class Assignment
       Managed through the class.learnerIds[] relationship.

   Academic Progress
       Managed through learner module records.

   Legacy:
       Older versions used "Pending Plan" as a learner status.
       That status is migrated to "Active" so that class
       assignment is no longer conflated with learner status.
========================================================= */


/* =========================================================
   LEARNER STORAGE
========================================================= */

const LEARNER_STORAGE_KEY =
    "siknayan_academic_admin_learners";

const LEARNER_STORAGE_VERSION =
    "v5";

/* =========================================================
   LARAVEL API
========================================================= */

const LEARNER_API_BASE_URL =
    window.SIKNAYAN_API_ROOT;

const LEARNER_API_TOKEN_KEY =
    "siknayan_api_token";

function getLearnerApiToken() {

    return (
        window.SIKNAYAN_API_TOKEN ||
        sessionStorage.getItem("authToken") ||
        sessionStorage.getItem("token") ||
        localStorage.getItem(
            LEARNER_API_TOKEN_KEY
        ) ||
        localStorage.getItem("token") ||
        localStorage.getItem("access_token") ||
        ""
    );

}


async function fetchLearnersFromApi() {

    const token =
        getLearnerApiToken();

    if (!token) {

        throw new Error(
            "No API token found. Please sign in again."
        );

    }


    const response =
        await fetch(
            `${LEARNER_API_BASE_URL}/admin/learners`,
            {
                method: "GET",

                headers: {
                    "Accept":
                        "application/json",

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

        throw new Error(
            payload?.message ||
            `Unable to load learners (${response.status}).`
        );

    }


    return payload;

}
/* =========================================================
   API LEARNER NORMALIZATION
========================================================= */

function normalizeApiLearner(
    learner
) {

    return {

        id:
            String(
                learner.id
            ),

        name:
            learner.name ||
            "Unnamed Learner",

        email:
            learner.email ||
            "",

        schoolId:
            learner.school_id ||
            "",

        program:
            learner.program ||
            "",

        modulesAssigned:
            Number(
                learner.modules_assigned ||
                learner.modulesAssigned ||
                0
            ),

        progress:
            learner.progress ??
            null,

        status:
            learner.status ||
            "Active",

        passwordSetupComplete:
            Boolean(learner.password_setup_complete),

        // Set up once: can't be deleted (the Delete button is hidden).
        accountSetUp:
            Boolean(learner.account_set_up ?? learner.accountSetUp),

        isActive:
            learner.is_active !== false,

        lastActivity:
            learner.last_activity ||
            learner.lastActivity ||
            "Never",

        backendAccount: true

    };

}


async function syncLearnersFromApi() {

    const payload =
        await fetchLearnersFromApi();


    const apiLearners =
        Array.isArray(
            payload?.learners
        )
            ? payload.learners
            : [];


    const state =
        loadLearnerState();


    state.learners =
        apiLearners.map(
            normalizeApiLearner
        );


    /* Each learner's modules (from their classes) for Learner Details.
       The server's list replaces any older copy kept in this browser. */
    if (
        !state.modules ||
        typeof state.modules !== "object"
    ) {
        state.modules = {};
    }

    apiLearners.forEach(
        learner => {
            if (Array.isArray(learner?.modules)) {
                state.modules[String(learner.id)] =
                    learner.modules.map(module => ({
                        id: String(module.id),
                        title: module.title || "Untitled Module",
                        course: module.course || "",
                        courseCode: module.course_code || "",
                        state: module.state || "in-progress",
                        submittedAt: module.submitted_at || null,
                        score: module.score ?? null,
                        maxScore: module.max_score ?? null
                    }));
            }
        }
    );


    saveLearnerState(
        state
    );

    window.dispatchEvent(
        new Event("siknayan:learners-refreshed")
    );

    return state;

}


/* =========================================================
   LEARNER DEFAULT DATA
========================================================= */



const DEFAULT_LEARNERS = [

    {
        id: "23-00349",

        name: "Deck Son",

        program: "BSCRIM",

        modulesAssigned: 7,

        progress: 97,

    },


    {
        id: "23-00428",

        name: "Neo Camaa",

        program: "BSOA",

        modulesAssigned: 0,

        progress: null,

        /*
         * Neo is still an enrolled learner.
         *
         * He simply has no modules and, under the newer
         * class-based model, may not yet be assigned to a class.
         *
         * That is NOT a learner lifecycle status.
         */
        status: "Active",

        lastActivity: "Never"
    },


    {
        id: "23-00501",

        name: "Finger Maiden",

        program: "BSTM",

        modulesAssigned: 14,

        progress: 100,

        status: "Completed",

        lastActivity: "Aug 28, 2026"
    }

];


/* =========================================================
   LEARNER MODULE DATA
========================================================= */

const DEFAULT_LEARNER_MODULES = {

    "23-00349": [

        {
            id: "deck-module-1",

            title:
                "Introduction to Criminal Law",

            course:
                "Criminal Law Fundamentals",

            status:
                "COMPLETED"
        },


        {
            id: "deck-module-2",

            title:
                "Legal Terminology Basics",

            course:
                "Criminal Law Fundamentals",

            status:
                "COMPLETED"
        },


        {
            id: "deck-module-3",

            title:
                "Forensic Science Basics",

            course:
                "Forensic Science",

            status:
                "COMPLETED"
        },


        {
            id: "deck-module-4",

            title:
                "Crime Scene Analysis",

            course:
                "Forensic Science",

            status:
                "COMPLETED"
        },


        {
            id: "deck-module-5",

            title:
                "Criminal Investigation",

            course:
                "Criminal Investigation",

            status:
                "IN PROGRESS"
        },


        {
            id: "deck-module-6",

            title:
                "Evidence Handling",

            course:
                "Evidence Handling",

            status:
                "SUBMITTED — AWAITING GRADE"
        },


        {
            id: "deck-module-7",

            title:
                "Criminal Procedure",

            course:
                "Criminal Procedure",

            status:
                "COMPLETED"
        }

    ],



    "23-00412": [

        {
            id: "hideo-module-1",

            title:
                "Introduction to Criminal Law",

            course:
                "Criminal Law Fundamentals",

            status:
                "COMPLETED"
        },


        {
            id: "hideo-module-2",

            title:
                "Forensic Science Basics",

            course:
                "Forensic Science",

            status:
                "IN PROGRESS"
        },


        {
            id: "hideo-module-3",

            title:
                "Crime Scene Analysis",

            course:
                "Forensic Science",

            status:
                "SUBMITTED — AWAITING GRADE"
        }

    ],



    "23-00428": [],



    "23-00501": [

        {
            id: "finger-module-1",

            title:
                "Introduction to Criminal Law",

            course:
                "Criminal Law Fundamentals",

            status:
                "COMPLETED"
        },


        {
            id: "finger-module-2",

            title:
                "Legal Terminology Basics",

            course:
                "Criminal Law Fundamentals",

            status:
                "COMPLETED"
        },


        {
            id: "finger-module-3",

            title:
                "Forensic Science Basics",

            course:
                "Forensic Science",

            status:
                "COMPLETED"
        },


        {
            id: "finger-module-4",

            title:
                "Crime Scene Analysis",

            course:
                "Forensic Science",

            status:
                "COMPLETED"
        },


        {
            id: "finger-module-5",

            title:
                "DNA Analysis",

            course:
                "Forensic Science",

            status:
                "COMPLETED"
        },


        {
            id: "finger-module-6",

            title:
                "Criminal Investigation",

            course:
                "Criminal Investigation",

            status:
                "COMPLETED"
        },


        {
            id: "finger-module-7",

            title:
                "Correctional Administration",

            course:
                "Correctional Administration",

            status:
                "COMPLETED"
        },


        {
            id: "finger-module-8",

            title:
                "Criminalistics",

            course:
                "Criminalistics",

            status:
                "COMPLETED"
        },


        {
            id: "finger-module-9",

            title:
                "Evidence Handling",

            course:
                "Evidence Handling",

            status:
                "COMPLETED"
        },


        {
            id: "finger-module-10",

            title:
                "Criminal Procedure",

            course:
                "Criminal Procedure",

            status:
                "COMPLETED"
        },


        {
            id: "finger-module-11",

            title:
                "Advanced Investigation",

            course:
                "Criminal Investigation",

            status:
                "COMPLETED"
        },


        {
            id: "finger-module-12",

            title:
                "Criminalistics Applications",

            course:
                "Criminalistics",

            status:
                "COMPLETED"
        },


        {
            id: "finger-module-13",

            title:
                "Evidence Documentation",

            course:
                "Evidence Handling",

            status:
                "COMPLETED"
        },


        {
            id: "finger-module-14",

            title:
                "Case Processing",

            course:
                "Criminal Procedure",

            status:
                "COMPLETED"
        }

    ]

};


/* =========================================================
   LEARNER STORAGE HELPERS
========================================================= */

function cloneLearnerDefaults() {

    return JSON.parse(
        JSON.stringify(
            DEFAULT_LEARNERS
        )
    );

}


function cloneLearnerModuleDefaults() {

    return JSON.parse(
        JSON.stringify(
            DEFAULT_LEARNER_MODULES
        )
    );

}


/* =========================================================
   LEGACY STATUS MIGRATION
   ---------------------------------------------------------
   Older records used:

       status: "Pending Plan"
       planStatus: "Pending Plan"

   The newer model treats class assignment separately.

   Therefore:

       Pending Plan -> Active

   while preserving all other learner data.

   The old planStatus property is removed because it was
   being used as a duplicate learner lifecycle status.
========================================================= */

function migrateLegacyLearnerStatus(
    state
) {

    if (
        !state ||
        !Array.isArray(
            state.learners
        )
    ) {

        return false;

    }


    let changed =
        false;


    state.learners =
        state.learners.map(
            learner => {

                if (
                    !learner ||
                    typeof learner !==
                        "object"
                ) {

                    return learner;

                }


                const updated =
                    {
                        ...learner
                    };


                /* -----------------------------------------
                   PENDING PLAN -> ACTIVE
                ----------------------------------------- */

                if (
                    String(
                        updated.status ??
                        ""
                    )
                        .trim()
                        .toLowerCase() ===
                    "pending plan"
                ) {

                    updated.status =
                        "Active";

                    changed =
                        true;

                }


                /* -----------------------------------------
                   REMOVE LEGACY planStatus
                ----------------------------------------- */

                if (
                    Object.prototype.hasOwnProperty.call(
                        updated,
                        "planStatus"
                    )
                ) {

                    delete updated.planStatus;

                    changed =
                        true;

                }


                return updated;

            }
        );


    return changed;

}


/* =========================================================
   LEARNER STATE LOADING
========================================================= */

function loadLearnerState() {

    try {

        const stored =
            localStorage.getItem(
                LEARNER_STORAGE_KEY
            );


        /* ---------------------------------------------
           FIRST INITIALIZATION
        --------------------------------------------- */

        if (!stored) {

            const state = {

                version:
                    LEARNER_STORAGE_VERSION,

                learners:
                    cloneLearnerDefaults(),

                modules:
                    cloneLearnerModuleDefaults()

            };


            localStorage.setItem(

                LEARNER_STORAGE_KEY,

                JSON.stringify(
                    state
                )

            );


            return state;

        }


        const parsed =
            JSON.parse(
                stored
            );


        /* ---------------------------------------------
           INVALID STORAGE STRUCTURE
        --------------------------------------------- */

        if (
            !parsed ||
            typeof parsed !==
                "object"
        ) {

            const state = {

                version:
                    LEARNER_STORAGE_VERSION,

                learners:
                    cloneLearnerDefaults(),

                modules:
                    cloneLearnerModuleDefaults()

            };


            localStorage.setItem(

                LEARNER_STORAGE_KEY,

                JSON.stringify(
                    state
                )

            );


            return state;

        }


        /* ---------------------------------------------
           VERSION COMPATIBILITY

           We intentionally do NOT bump the version here.

           Bumping the version would reset the user's current
           local data.

           Instead, we migrate the relevant records in place.
        --------------------------------------------- */

        if (
            !parsed.version
        ) {

            parsed.version =
                LEARNER_STORAGE_VERSION;

        }


        /* ---------------------------------------------
           ENSURE LEARNER ARRAY
        --------------------------------------------- */

        if (
            !Array.isArray(
                parsed.learners
            )
        ) {

            parsed.learners =
                cloneLearnerDefaults();

        }


        /* ---------------------------------------------
           ENSURE MODULE OBJECT
        --------------------------------------------- */

        if (
            !parsed.modules ||
            typeof parsed.modules !==
                "object" ||
            Array.isArray(
                parsed.modules
            )
        ) {

            parsed.modules =
                cloneLearnerModuleDefaults();

        }


        /* ---------------------------------------------
           MIGRATE LEGACY STATUS
        --------------------------------------------- */

        const migrated =
            migrateLegacyLearnerStatus(
                parsed
            );


        /* ---------------------------------------------
           SAVE MIGRATION
        --------------------------------------------- */

        if (migrated) {

            saveLearnerState(
                parsed
            );

        }


        return parsed;

    } catch (error) {

        console.error(
            "Unable to load learner state:",
            error
        );


        return {

            version:
                LEARNER_STORAGE_VERSION,

            learners:
                cloneLearnerDefaults(),

            modules:
                cloneLearnerModuleDefaults()

        };

    }

}


/* =========================================================
   LEARNER STATE SAVING
========================================================= */

function saveLearnerState(
    state
) {

    try {

        localStorage.setItem(

            LEARNER_STORAGE_KEY,

            JSON.stringify(
                state
            )

        );

    } catch (error) {

        console.error(
            "Unable to save learner state:",
            error
        );

    }

}


/* =========================================================
   LEARNER HELPERS
========================================================= */

function getLearnerById(
    id
) {

    const state =
        loadLearnerState();


    return state.learners.find(

        learner =>
            learner.id ===
            id

    );

}


function getLearnerModulesById(
    id
) {

    const state =
        loadLearnerState();


    return (
        state.modules[id] ||
        []
    );

}


function updateLearnerRecord(
    learnerId,
    updates
) {

    const state =
        loadLearnerState();


    const learner =
        state.learners.find(

            item =>
                item.id ===
                learnerId

        );


    if (!learner) {

        return false;

    }


    Object.assign(

        learner,

        updates

    );


    /*
     * Never allow the old "Pending Plan"
     * value to become a learner lifecycle status again.
     */

    if (
        String(
            learner.status ??
            ""
        )
            .trim()
            .toLowerCase() ===
        "pending plan"
    ) {

        learner.status =
            "Active";

    }


    /*
     * Remove legacy duplicate plan status
     * if an old record still contains it.
     */

    if (
        Object.prototype.hasOwnProperty.call(
            learner,
            "planStatus"
        )
    ) {

        delete learner.planStatus;

    }


    saveLearnerState(
        state
    );


    return true;

}


function updateLearnerModules(
    learnerId,
    modules
) {

    const state =
        loadLearnerState();


    state.modules[
        learnerId
    ] =
        Array.isArray(
            modules
        )
            ? modules
            : [];


    saveLearnerState(
        state
    );


}



/* =========================================================
   LEARNERS PAGE RENDERING
========================================================= */

(function initLearnersPage() {

    "use strict";


    const tableBody =
        document.getElementById(
            "learnerTableBody"
        );


    const searchInput =
        document.getElementById(
            "learnerSearch"
        );


    const programFilter =
        document.getElementById(
            "programFilter"
        );


    const statusFilter =
        document.getElementById(
            "statusFilter"
        );


    const noResults =
        document.getElementById(
            "noResults"
        );


    const totalElement =
        document.getElementById(
            "learnerTotal"
        );


    if (!tableBody) {
        return;
    }


    /* =====================================================
       HTML ESCAPING
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
       STATUS HELPERS
    ===================================================== */

    function normalizeStatus(
        status
    ) {

        const value =
            String(
                status ?? ""
            )
                .trim()
                .toLowerCase();


        if (
            value === "completed"
        ) {

            return "Completed";

        }


        if (
            value === "inactive"
        ) {

            return "Inactive";

        }


        return "Active";

    }


    function statusClass(
        status
    ) {

        const value =
            normalizeStatus(
                status
            );


        if (
            value === "Completed"
        ) {

            return "status-completed";

        }


        if (
            value === "Inactive"
        ) {

            return "status-inactive";

        }


        return "status-active";

    }


    /* =====================================================
       PROGRESS
    ===================================================== */

    function normalizeProgress(
        value
    ) {

        if (
            value === null ||
            value === undefined ||
            value === ""
        ) {

            return null;

        }


        const number =
            Number(
                value
            );


        if (
            !Number.isFinite(
                number
            )
        ) {

            return null;

        }


        return Math.min(
            100,
            Math.max(
                0,
                number
            )
        );

    }


    function renderProgress(
        progress
    ) {

        const value =
            normalizeProgress(
                progress
            );


        if (
            value === null
        ) {

            return `
                <div class="progress-cell no-progress">
                    <span>—</span>
                </div>
            `;

        }


        return `
            <div class="progress-cell">

                <div class="progress-bar">

                    <span
                        style="width: ${value}%"
                    ></span>

                </div>

                <small>
                    ${value}%
                </small>

            </div>
        `;

    }


    /* =====================================================
       PROGRAM FILTER
    ===================================================== */

    function initializeProgramFilter() {

        if (
            !programFilter
        ) {

            return;

        }


        if (
            window.SiknayanPrograms
        ) {

            window.SiknayanPrograms.renderOptions(

                programFilter,

                {
                    includeAll:
                        true,

                    allLabel:
                        "All Programs",

                    preserveValue:
                        true
                }

            );

        }

    }


    /* =====================================================
       LEARNER ROW
    ===================================================== */

    function renderLearnerRow(
        learner,
        rowNumber
    ) {

        const id =
            String(
                learner?.id ?? ""
            );


        const name =
            String(
                learner?.name ?? ""
            );


        const program =
            String(
                learner?.program ?? "—"
            );


        const modulesAssigned =
            Number.isFinite(
                Number(
                    learner?.modulesAssigned
                )
            )
                ? Math.max(
                    0,
                    Number(
                        learner.modulesAssigned
                    )
                )
                : 0;


        const status =
            normalizeStatus(
                learner?.status
            );

        return `

            <tr
                class="learner-row"
                data-href="
                    learner-details.html?id=${encodeURIComponent(id)}
                "
            >

                <td class="row-number">
                    ${rowNumber}
                </td>

                <td class="student-id">
                    ${escapeHtml(learner.schoolId || "—")}
                </td>


                <td class="learner-name">

                    <strong>
                        ${escapeHtml(name)}
                    </strong>

                    <small class="learner-mobile-extra">
                        ${escapeHtml(learner.schoolId || "—")}
                        &middot;
                        ${escapeHtml(program)}
                    </small>

                </td>


                <td>
                    ${escapeHtml(program)}
                </td>


                <td>
                    ${modulesAssigned}
                </td>


                <td>
                    ${renderProgress(
                        Number(learner?.modulesAssigned) > 0
                            ? learner?.progress
                            : null
                    )}
                </td>


                <td>

                    <span
                        class="status-badge ${statusClass(status)}"
                    >
                        ${escapeHtml(status)}
                    </span>

                </td>
            </tr>

        `;

    }


    /* =====================================================
       FILTERING
    ===================================================== */

    function getFilteredLearners(
        learners
    ) {

        const query =
            String(
                searchInput?.value ??
                ""
            )
                .trim()
                .toLowerCase();


        const selectedProgram =
            String(
                programFilter?.value ??
                "all"
            )
                .trim()
                .toLowerCase();


        const selectedStatus =
            String(
                statusFilter?.value ??
                "all"
            )
                .trim()
                .toLowerCase();


        return learners.filter(
            learner => {

                const id =
                    String(
                        learner?.id ??
                        ""
                    )
                        .toLowerCase();


                const name =
                    String(
                        learner?.name ??
                        ""
                    )
                        .toLowerCase();


                const program =
                    String(
                        learner?.program ??
                        ""
                    )
                        .toLowerCase();


                const status =
                    normalizeStatus(
                        learner?.status
                    )
                        .toLowerCase();


                const searchMatch =
                    !query ||
                    id.includes(query) ||
                    name.includes(query);


                const programMatch =
                    selectedProgram ===
                    "all" ||
                    program ===
                    selectedProgram;


                const statusMatch =
                    selectedStatus ===
                    "all" ||
                    status ===
                    selectedStatus;


                return (
                    searchMatch &&
                    programMatch &&
                    statusMatch
                );

            }
        );

    }


    /* =====================================================
       MAIN RENDER
    ===================================================== */

    function render() {

        const state =
            loadLearnerState();


        const learners =
            Array.isArray(
                state?.learners
            )
                ? state.learners
                : [];


        /*
         * Header always reflects the actual
         * number of learner records.
         */

        if (
            totalElement
        ) {

            totalElement.textContent =
                `${learners.length} Learner${
                    learners.length === 1
                        ? ""
                        : "s"
                }`;

        }


        const filteredLearners =
            getFilteredLearners(
                learners
            );


        if (
            filteredLearners.length === 0
        ) {

            tableBody.innerHTML =
                "";


            if (
                noResults
            ) {

                noResults.hidden =
                    false;

            }


        } else {

            tableBody.innerHTML =
                filteredLearners
                    .map(
                        (learner, index) =>
                            renderLearnerRow(learner, index + 1)
                    )
                    .join(
                        ""
                    );


            if (
                noResults
            ) {

                noResults.hidden =
                    true;

            }

        }


        /*
         * Re-enable Lucide icons if the page
         * uses them after dynamic rendering.
         */

        if (
            window.lucide
        ) {

            window.lucide.createIcons();

        }

    }


    /* =====================================================
       ROW NAVIGATION
    ===================================================== */

    tableBody.addEventListener(
        "click",
        event => {

            const row =
                event.target.closest(
                    ".learner-row"
                );


            if (
                !row
            ) {

                return;

            }


            if (
                event.target.closest(
                    "button, a, input, select"
                )
            ) {

                return;

            }


            const href =
                row.dataset.href;


            if (
                href
            ) {

                window.location.href =
                    href;

            }

        }
    );


    /* =====================================================
       FILTER EVENTS
    ===================================================== */

    if (
        searchInput
    ) {

        searchInput.addEventListener(
            "input",
            render
        );

    }


    if (
        programFilter
    ) {

        programFilter.addEventListener(
            "change",
            render
        );

    }


    if (
        statusFilter
    ) {

        statusFilter.addEventListener(
            "change",
            render
        );

    }


    /* =====================================================
       INITIALIZE
    ===================================================== */
initializeProgramFilter();

render();

syncLearnersFromApi()
    .then(() => {

        render();

    })
    .catch(error => {

        console.error(
            "Learners API initialization failed:",
            error
        );

        if (document.querySelector(".learner-accounts-page")) {
            window.dispatchEvent(
                new CustomEvent("siknayan:learners-api-error", {
                    detail: {
                        message: error.message ||
                            "Unable to load learner accounts from Laravel."
                    }
                })
            );
        }

    });

})();


/* =========================================================
   LEARNERS PAGE SUMMARY + PROGRAM FILTER
========================================================= */

(function initLearnersPageSummary() {

    const totalElement =
        document.getElementById(
            "learnerTotal"
        );


    const programFilter =
        document.getElementById(
            "programFilter"
        );


    /*
     * Update total learner count from the
     * current learner state instead of using
     * a hardcoded prototype number.
     */

    if (totalElement) {

        const state =
            loadLearnerState();


        const total =
            Array.isArray(
                state.learners
            )
                ? state.learners.length
                : 0;


        totalElement.textContent =
            `${total} Learner${total === 1 ? "" : "s"}`;

    }


    /*
     * Populate the program filter from the
     * centralized program source.
     */

    if (
        programFilter &&
        window.SiknayanPrograms
    ) {

        window.SiknayanPrograms.renderOptions(

            programFilter,

            {
                includeAll:
                    true,

                allLabel:
                    "All Programs",

                preserveValue:
                    true
            }

        );

    }

})();