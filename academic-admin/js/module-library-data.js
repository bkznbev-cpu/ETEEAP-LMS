/* =========================================================
   SIKNAYAN - SHARED MODULE LIBRARY DATA
========================================================= */

(function () {

    "use strict";


    const STORAGE_KEY =
        "siknayan_academic_admin_module_library_v3";


    const LEGACY_STORAGE_KEY =
        "siknayan_academic_admin_module_library_v2";


    const LEARNER_STORAGE_KEY =
        "siknayan_academic_admin_learners";


    /* The database holds the real Module Library, shared by every
       Academic Admin. localStorage is a fast copy the pages read from.
       REVISION_KEY: the database version this copy matches (missing =
       this browser has never been synced). PENDING_KEY: a change made
       here that hasn't reached the database yet. */
    const REVISION_KEY =
        STORAGE_KEY + "_revision";

    const PENDING_KEY =
        STORAGE_KEY + "_pending";

    const RELOAD_GUARD_KEY =
        STORAGE_KEY + "_reloaded_at";

    let initialSync = null;
    let pushing = false;
    let pushAgain = false;


    /* =====================================================
       PROGRAM SEEDS
       -----------------------------------------------------
       These are prototype course seeds for the Module
       Library. Actual approved curriculum data can replace
       these later without changing the storage structure.
    ===================================================== */

    const PROGRAM_SEEDS = {

        BSIT: {

            code:
                "BSIT",

            name:
                "Bachelor of Science in Information Technology",

            courses: [

                [
                    "bsit-intro-computing",
                    "Introduction to Computing",
                    "IT 101"
                ],

                [
                    "bsit-programming-1",
                    "Computer Programming 1",
                    "IT 102"
                ],

                [
                    "bsit-programming-2",
                    "Computer Programming 2",
                    "IT 103"
                ],

                [
                    "bsit-data-structures",
                    "Data Structures and Algorithms",
                    "IT 104"
                ],

                [
                    "bsit-web-systems",
                    "Web Systems and Technologies",
                    "IT 105"
                ]

            ],

            modules: []

        },


        BSCRIM: {

            code:
                "BSCRIM",

            name:
                "Bachelor of Science in Criminology",

            courses: [

                [
                    "criminal-law",
                    "Criminal Law Fundamentals",
                    "CRIM 101"
                ],

                [
                    "forensic-science",
                    "Forensic Science",
                    "CRIM 102"
                ],

                [
                    "criminal-investigation",
                    "Criminal Investigation",
                    "CRIM 103"
                ],

                [
                    "correctional-administration",
                    "Correctional Administration",
                    "CRIM 104"
                ],

                [
                    "criminalistics",
                    "Criminalistics",
                    "CRIM 105"
                ],

                [
                    "evidence-handling",
                    "Evidence Handling",
                    "CRIM 106"
                ],

                [
                    "criminal-procedure",
                    "Criminal Procedure",
                    "CRIM 107"
                ]

            ],

            modules: [

                {
                    id:
                        "criminal-law-introduction",

                    courseId:
                        "criminal-law",

                    title:
                        "Introduction to Criminal Law",

                    uploaded:
                        "June 12",

                    assigned:
                        0,

                    status:
                        "active",

                    fileName:
                        "",

                    fileSize:
                        0,

                    fileType:
                        "",

                    version:
                        1
                },


                {
                    id:
                        "criminal-law-terminology",

                    courseId:
                        "criminal-law",

                    title:
                        "Legal Terminology Basics",

                    uploaded:
                        "June 12",

                    assigned:
                        0,

                    status:
                        "active",

                    fileName:
                        "",

                    fileSize:
                        0,

                    fileType:
                        "",

                    version:
                        1
                }

            ]

        },


        BSEED: {

            code:
                "BSEEd",

            name:
                "Bachelor of Elementary Education",

            courses: [

                [
                    "bseed-child-adolescent",
                    "The Child and Adolescent Learner",
                    "BEEd 101"
                ],

                [
                    "bseed-teaching-profession",
                    "The Teaching Profession",
                    "BEEd 102"
                ],

                [
                    "bseed-learner-centered",
                    "Facilitating Learner-Centered Teaching",
                    "BEEd 103"
                ],

                [
                    "bseed-assessment",
                    "Assessment in Learning",
                    "BEEd 104"
                ],

                [
                    "bseed-new-literacies",
                    "Building and Enhancing New Literacies",
                    "BEEd 105"
                ]

            ],

            modules: []

        },


        BSOA: {

            code:
                "BSOA",

            name:
                "Bachelor of Science in Office Administration",

            courses: [

                [
                    "bsoa-business-communication",
                    "Business Communication",
                    "BSOA 101"
                ],

                [
                    "bsoa-office-procedures",
                    "Office Procedures and Systems",
                    "BSOA 102"
                ],

                [
                    "bsoa-records-management",
                    "Records Management",
                    "BSOA 103"
                ],

                [
                    "bsoa-office-management",
                    "Administrative Office Management",
                    "BSOA 104"
                ]

            ],

            modules: []

        },


        BSN: {

            code:
                "BSN",

            name:
                "Bachelor of Science in Nursing",

            courses: [

                [
                    "bsn-anatomy",
                    "Anatomy and Physiology",
                    "NURS 101"
                ],

                [
                    "bsn-fundamentals",
                    "Fundamentals of Nursing Practice",
                    "NURS 102"
                ],

                [
                    "bsn-health-assessment",
                    "Health Assessment",
                    "NURS 103"
                ],

                [
                    "bsn-pharmacology",
                    "Pharmacology",
                    "NURS 104"
                ],

                [
                    "bsn-community-health",
                    "Community Health Nursing",
                    "NURS 105"
                ],

                [
                    "bsn-maternal-child",
                    "Maternal and Child Nursing",
                    "NURS 106"
                ],

                [
                    "bsn-medical-surgical",
                    "Medical-Surgical Nursing",
                    "NURS 107"
                ],

                [
                    "bsn-nursing-informatics",
                    "Nursing Informatics",
                    "NURS 108"
                ]

            ],

            modules: []

        },


        BSBA: {

            code:
                "BSBA",

            name:
                "Bachelor of Science in Business Administration",

            majors: [
                "Financial Management",
                "Marketing Management"
            ],

            courses: [

                [
                    "bsba-principles-management",
                    "Principles of Management",
                    "BSBA 101"
                ],

                [
                    "bsba-financial-management",
                    "Financial Management",
                    "BSBA 102"
                ],

                [
                    "bsba-marketing-management",
                    "Marketing Management",
                    "BSBA 103"
                ]

            ],

            modules: []

        },


        BSA: {

            code:
                "BSA",

            name:
                "Bachelor of Science in Accountancy",

            courses: [

                [
                    "bsa-financial-accounting",
                    "Financial Accounting and Reporting",
                    "ACCT 101"
                ],

                [
                    "bsa-cost-accounting",
                    "Cost Accounting",
                    "ACCT 102"
                ],

                [
                    "bsa-auditing",
                    "Auditing Theory",
                    "ACCT 103"
                ],

                [
                    "bsa-taxation",
                    "Taxation",
                    "ACCT 104"
                ],

                [
                    "bsa-accounting-information",
                    "Accounting Information Systems",
                    "ACCT 105"
                ]

            ],

            modules: []

        },


        BAPS: {

            code:
                "BAPS",

            name:
                "Bachelor of Arts in Political Science",

            courses: [

                [
                    "baps-intro-political-science",
                    "Introduction to Political Science",
                    "POLS 101"
                ],

                [
                    "baps-philippine-government",
                    "Philippine Government and Constitution",
                    "POLS 102"
                ],

                [
                    "baps-comparative-politics",
                    "Comparative Politics",
                    "POLS 103"
                ]

            ],

            modules: []

        },


        /* Added programs: courses are added by the Academic Admin
           on each program's page (+ Add Course). */

        BSNED: {

            code:
                "BSNED",

            name:
                "Bachelor of Special Needs Education",

            courses: [],

            modules: []

        },


        BSED: {

            code:
                "BSED",

            name:
                "Bachelor of Science in Secondary Education",

            majors: [
                "English",
                "Mathematics",
                "Science",
                "Social Studies"
            ],

            courses: [],

            modules: []

        },


        BSHM: {

            code:
                "BSHM",

            name:
                "Bachelor of Science in Hospitality Management",

            courses: [],

            modules: []

        },


        BSTM: {

            code:
                "BSTM",

            name:
                "Bachelor of Science in Tourism Management",

            // Default first-year courses: [id, name, code]
            courses: [
                ["bstm-gec-11", "Understanding the Self", "GEC 11"],
                ["bstm-cordi-101", "Cordillera: History and Socio-Cultural Heritage", "CORDI 101"],
                ["bstm-thc-111", "Macro Perspective of Tourism and Hospitality", "THC 111"],
                ["bstm-thc-112", "Risk Management as Applied to Safety, Security", "THC 112"],
                ["bstm-tpc-113-a", "Global Culture and Tourism Geography", "TPC 113-A"],
                ["bstm-tpc-113l", "Global Culture and Tourism Geography", "TPC 113L"],
                ["bstm-tmpe-114", "Specialized Food and Beverage Service", "TMPE 114"],
                ["bstm-tmpe-114l", "Specialized Food and Beverage Service", "TMPE 114L"],
                ["bstm-soc-or-11", "Social Orientation", "SOC OR 11"],
                ["bstm-pathfit-1", "Movement Competency Training", "PATHFIT 1"],
                ["bstm-nstp-11", "National Service Training Program", "NSTP 11"]
            ],

            modules: []

        }

    };


    /* Programs whose default courses were added after admins had
       already saved their Module Library. Their defaults are added
       to saved data once (see normalizeProgram). */
    const NEWLY_SEEDED_PROGRAMS = new Set([
        "BSTM"
    ]);


    const DEFAULT_ICONS = {

        BSIT:
            "monitor-up",

        BSCRIM:
            "clock-3",

        BSEEd:
            "feather",

        BSOA:
            "briefcase",

        BSN:
            "heart",

        BSBA:
            "tag",

        BSA:
            "dollar-sign",

        BAPS:
            "bar-chart-3",

        BSNED:
            "accessibility",

        BSED:
            "school",

        BSHM:
            "chef-hat",

        BSTM:
            "plane"

    };


    /* =====================================================
       HELPERS
    ===================================================== */

    function clone(
        value
    ) {

        return JSON.parse(
            JSON.stringify(
                value
            )
        );

    }


    function normalizeCode(
        value
    ) {

        const code =
            String(
                value ||
                ""
            )
                .trim();


        if (
            code.toUpperCase() ===
            "BSEED"
        ) {

            return "BSEEd";

        }


        return code.toUpperCase();

    }


    function seedProgram(
        code,
        custom
    ) {

        const normalized =
            normalizeCode(
                code
            );


        let seed =
            PROGRAM_SEEDS[
                normalized
            ];


        if (
            !seed
        ) {

            seed =
                PROGRAM_SEEDS[
                    normalized.toUpperCase()
                ];

        }


        if (
            !seed
        ) {

            return {

                code:
                    normalized,

                name:
                    custom?.name ||
                    normalized,

                icon:
                    custom?.icon ||
                    "monitor-up",

                majors:
                    Array.isArray(custom?.majors)
                        ? custom.majors
                        : [],

                courses:
                    [],

                modules:
                    []

            };

        }


        return {

            code:
                seed.code,

            name:
                seed.name,

            icon:
                custom?.icon ||
                DEFAULT_ICONS[
                    seed.code
                ] ||
                "monitor-up",

            majors:
                clone(
                    seed.majors ||
                    []
                ),

            courses:
                clone(
                    seed.courses
                ).map(
                    item => ({

                        id:
                            item[0],

                        name:
                            item[1],

                        code:
                            item[2]

                    })
                ),

            modules:
                clone(
                    seed.modules
                ).map(
                    module => ({

                        ...module,

                        program:
                            seed.code

                    })
                )

        };

    }


    function normalizeProgram(
        program,
        code
    ) {

        const normalizedCode =
            normalizeCode(
                code ||
                program?.code
            );


        const fallback =
            seedProgram(
                normalizedCode
            );


        /* Default courses are added to saved data only once, so a
           default the admin later deletes does not come back.
           defaultCourseIdsAdded remembers which defaults were added. */
        const defaultIds =
            fallback.courses.map(
                course => course.id
            );

        let courses =
            Array.isArray(
                program?.courses
            )
                ? program.courses
                : fallback.courses;

        if (
            Array.isArray(
                program?.courses
            )
        ) {

            const alreadySeeded =
                Array.isArray(
                    program?.defaultCourseIdsAdded
                )
                    ? program.defaultCourseIdsAdded
                    : NEWLY_SEEDED_PROGRAMS.has(
                        String(normalizedCode).toUpperCase()
                    )
                        ? []
                        : defaultIds;

            const missing =
                fallback.courses.filter(
                    course =>
                        !alreadySeeded.includes(course.id) &&
                        !courses.some(
                            existing =>
                                String(existing?.id) === course.id ||
                                String(existing?.code || "").toLowerCase() ===
                                    String(course.code).toLowerCase()
                        )
                );

            if (missing.length) {
                courses = [
                    ...courses,
                    ...missing
                ];
            }

        }


        return {

            defaultCourseIdsAdded:
                Array.from(
                    new Set([
                        ...(Array.isArray(program?.defaultCourseIdsAdded)
                            ? program.defaultCourseIdsAdded
                            : []),
                        ...defaultIds
                    ])
                ),

            code:
                normalizedCode,

            name:
                program?.name ||
                fallback.name,

            icon:
                program?.icon ||
                fallback.icon,

            majors:
                Array.isArray(
                    program?.majors
                ) &&
                program.majors.length
                    ? program.majors
                    : fallback.majors,

            courses,

            modules:
                (
                    Array.isArray(
                        program?.modules
                    )
                        ? program.modules
                        : fallback.modules
                ).filter(
                    module =>
                        !REMOVED_SAMPLE_MODULE_IDS.has(
                            String(module?.id)
                        )
                )

        };

    }


    /* Sample BSCRIM modules that were removed from the defaults.
       They are also taken out of Module Libraries already saved. */
    const REMOVED_SAMPLE_MODULE_IDS = new Set([
        "forensic-science-basics",
        "crime-scene-analysis",
        "dna-analysis"
    ]);


    /* =====================================================
       LOAD
    ===================================================== */

    function readRaw() {

        try {

            const current =
                localStorage.getItem(
                    STORAGE_KEY
                );


            if (
                current
            ) {

                return JSON.parse(
                    current
                );

            }


            const legacy =
                localStorage.getItem(
                    LEGACY_STORAGE_KEY
                );


            if (
                legacy
            ) {

                return JSON.parse(
                    legacy
                );

            }

        } catch (
            error
        ) {

            console.error(
                "Module Library Data: unable to read storage.",
                error
            );

        }


        return null;

    }


    /* Programs that used to be defaults. They are taken out of saved
       Module Libraries once, but only when still empty (no subjects
       and no modules), so an admin's own work is never lost. */
    const RETIRED_DEFAULT_PROGRAMS = new Set([
        "BECED",
        "AAHM"
    ]);


    function isEmptyProgram(
        program
    ) {

        return (
            !(Array.isArray(program?.courses) && program.courses.length) &&
            !(Array.isArray(program?.modules) && program.modules.length)
        );

    }


    function load() {

        const raw =
            readRaw();


        const programs =
            {};


        /* Programs the admin deleted. Default programs on this list
           are not added back. */
        const deletedPrograms =
            Array.isArray(
                raw?.deletedPrograms
            )
                ? raw.deletedPrograms.map(normalizeCode)
                : [];


        Object.keys(
            PROGRAM_SEEDS
        ).forEach(
            key => {

                const seed =
                    PROGRAM_SEEDS[
                        key
                    ];


                if (
                    deletedPrograms.includes(
                        normalizeCode(seed.code)
                    )
                ) {

                    return;

                }


                programs[
                    seed.code
                ] =
                    seedProgram(
                        seed.code
                    );

            }
        );


        if (
            raw?.programs &&
            typeof raw.programs ===
                "object"
        ) {

            Object.values(
                raw.programs
            ).forEach(
                storedProgram => {

                    const code =
                        normalizeCode(
                            storedProgram?.code
                        );


                    if (
                        !code ||
                        deletedPrograms.includes(code)
                    ) {

                        return;

                    }


                    if (
                        !raw.retiredDefaultsRemoved &&
                        RETIRED_DEFAULT_PROGRAMS.has(code) &&
                        isEmptyProgram(storedProgram)
                    ) {

                        return;

                    }


                    programs[
                        code
                    ] =
                        normalizeProgram(
                            storedProgram,
                            code
                        );

                }
            );

        }


        const state = {

            version:
                "v3",

            retiredDefaultsRemoved:
                true,

            deletedPrograms,

            programs

        };


        localStorage.setItem(

            STORAGE_KEY,

            JSON.stringify(
                state
            )

        );


        return state;

    }


    function save(
        state
    ) {

        state.version =
            "v3";


        const before =
            readLocalState();


        localStorage.setItem(

            STORAGE_KEY,

            JSON.stringify(
                state
            )

        );


        // "assigned" counts are worked out on each computer from its own
        // data, so a save that only updates them stays on this computer.
        if (
            before &&
            libraryContent(before) ===
                libraryContent(state)
        ) {
            return;
        }


        // Send the change to the database (shared by every Academic Admin).
        storageSet(
            PENDING_KEY,
            "1"
        );

        queuePush();

    }


    function getProgram(
        code
    ) {

        const state =
            load();


        const normalized =
            normalizeCode(
                code
            );


        if (
            !state.programs[
                normalized
            ]
        ) {

            // A deleted program is not brought back just by being looked up.
            if (
                state.deletedPrograms.includes(
                    normalized
                )
            ) {

                return seedProgram(
                    normalized
                );

            }


            state.programs[
                normalized
            ] =
                seedProgram(
                    normalized
                );


            save(
                state
            );

        }


        return state.programs[
            normalized
        ];

    }


    function saveProgram(
        program
    ) {

        const state =
            load();


        const code =
            normalizeCode(
                program.code
            );


        state.programs[
            code
        ] =
            normalizeProgram(
                program,
                code
            );


        save(
            state
        );

    }


    function getPrograms() {

        return Object.values(
            load().programs
        );

    }


    /* =====================================================
       ACTUAL LEARNER ASSIGNMENT COUNTS
    ===================================================== */

    function getLearnerState() {

        try {

            const raw =
                localStorage.getItem(
                    LEARNER_STORAGE_KEY
                );


            if (
                !raw
            ) {

                return {

                    learners:
                        [],

                    modules:
                        {}

                };

            }


            const parsed =
                JSON.parse(
                    raw
                );


            return {

                learners:
                    Array.isArray(
                        parsed?.learners
                    )
                        ? parsed.learners
                        : [],

                modules:
                    parsed?.modules &&
                    typeof parsed.modules ===
                        "object"

                        ? parsed.modules

                        : {}

            };

        } catch (
            error
        ) {

            console.error(
                "Module Library Data: unable to read learner assignments.",
                error
            );


            return {

                learners:
                    [],

                modules:
                    {}

            };

        }

    }


    function getLearnerModuleRecords() {

        const state =
            getLearnerState();


        const records =
            [];


        Object.entries(
            state.modules
        ).forEach(
            (
                [
                    learnerId,
                    moduleList
                ]
            ) => {

                if (
                    !Array.isArray(
                        moduleList
                    )
                ) {

                    return;

                }


                moduleList.forEach(
                    record => {

                        records.push({

                            ...record,

                            learnerId

                        });

                    }
                );

            }
        );


        return records;

    }


    function countAssigned(
        module
    ) {

        const records =
            getLearnerModuleRecords();


        const state =
            getLearnerState();


        const targetId =
            String(
                module.id
            );


        const targetTitle =
            String(
                module.title ||
                ""
            )
                .trim()
                .toLowerCase();


        const targetProgram =
            String(
                module.program ||
                ""
            )
                .trim()
                .toLowerCase();


        const program =
            getProgram(
                module.program ||
                ""
            );


        const course =
            program.courses.find(
                item =>
                    String(
                        item.id
                    ).toLowerCase() ===
                    String(
                        module.courseId ||
                        ""
                    ).toLowerCase()
            );


        const targetCourseName =
            String(
                course?.name ||
                ""
            )
                .trim()
                .toLowerCase();


        const matchedLearners =
            new Set();


        records.forEach(
            record => {

                const learner =
                    state.learners.find(
                        item =>
                            String(
                                item.id
                            ) ===
                            String(
                                record.learnerId
                            )
                    );


                const learnerProgram =
                    String(
                        learner?.program ||
                        ""
                    )
                        .trim()
                        .toLowerCase();


                const recordId =
                    String(
                        record.libraryModuleId ||
                        record.moduleId ||
                        ""
                    );


                const recordTitle =
                    String(
                        record.title ||
                        ""
                    )
                        .trim()
                        .toLowerCase();


                const recordCourse =
                    String(
                        record.courseId ||
                        record.course ||
                        ""
                    )
                        .trim()
                        .toLowerCase();


                const idMatch =
                    recordId ===
                    targetId;


                const titleMatch =
                    recordTitle ===
                    targetTitle;


                const courseMatch =

                    !recordCourse ||

                    recordCourse ===
                    String(
                        module.courseId ||
                        ""
                    )
                        .trim()
                        .toLowerCase() ||

                    recordCourse ===
                    targetCourseName;


                const programMatch =
                    !learnerProgram ||
                    learnerProgram ===
                    targetProgram;


                if (
                    (
                        idMatch ||
                        (
                            titleMatch &&
                            courseMatch
                        )
                    ) &&
                    programMatch
                ) {

                    matchedLearners.add(
                        String(
                            record.learnerId
                        )
                    );

                }

            }
        );


        return matchedLearners.size;

    }


    function syncAssignedCounts(
        code
    ) {

        const program =
            getProgram(
                code
            );


        program.modules.forEach(
            module => {

                module.assigned =
                    countAssigned(
                        module
                    );

            }
        );


        saveProgram(
            program
        );


        return program;

    }


    /* =====================================================
       ADD PROGRAM
    ===================================================== */

    function addProgram(
        program
    ) {

        const state =
            load();


        const code =
            normalizeCode(
                program.code
            );


        if (
            state.programs[
                code
            ]
        ) {

            return null;

        }


        // Adding a program again undoes an earlier delete.
        state.deletedPrograms =
            state.deletedPrograms.filter(
                deleted => deleted !== code
            );


        state.programs[
            code
        ] = {

            code,

            name:
                program.name ||
                code,

            icon:
                program.icon ||
                "monitor-up",

            majors:
                [],

            courses:
                [],

            modules:
                []

        };


        save(
            state
        );


        return state.programs[
            code
        ];

    }


    /* =====================================================
       DELETE PROGRAM
       -----------------------------------------------------
       Like the other safe deletes in the portal, a program
       that still has modules cannot be deleted; its modules
       must be removed first. Returns { ok, reason }.
    ===================================================== */

    function deleteProgram(
        code
    ) {

        const state =
            load();


        const normalized =
            normalizeCode(
                code
            );


        const program =
            state.programs[
                normalized
            ];


        if (
            !program
        ) {

            return {
                ok: false,
                reason: "This program no longer exists."
            };

        }


        if (
            Array.isArray(program.modules) &&
            program.modules.length
        ) {

            return {
                ok: false,
                reason:
                    `${normalized} still has ${program.modules.length} ` +
                    `${program.modules.length === 1 ? "module" : "modules"}. ` +
                    "Remove its modules first, then delete the program."
            };

        }


        delete state.programs[
            normalized
        ];


        if (
            !state.deletedPrograms.includes(
                normalized
            )
        ) {

            state.deletedPrograms.push(
                normalized
            );

        }


        save(
            state
        );


        return {
            ok: true
        };

    }


    /* =====================================================
       DATABASE SYNC
    ===================================================== */

    function storageGet(key) {
        try {
            return localStorage.getItem(key);
        } catch (error) {
            return null;
        }
    }

    function storageSet(key, value) {
        try {
            localStorage.setItem(key, value);
        } catch (error) {
            // Storage full or blocked: the database still has the change.
        }
    }

    function storageRemove(key) {
        try {
            localStorage.removeItem(key);
        } catch (error) {
            // Nothing to do.
        }
    }

    function apiToken() {
        return (
            sessionStorage.getItem("authToken") ||
            window.SIKNAYAN_API_TOKEN ||
            localStorage.getItem("siknayan_api_token") ||
            ""
        );
    }

    function localRevision() {
        const value = storageGet(REVISION_KEY);

        if (value === null) {
            return null;
        }

        const number = parseInt(value, 10);

        return Number.isFinite(number) ? number : null;
    }

    function readLocalState() {
        try {
            return JSON.parse(storageGet(STORAGE_KEY) || "null");
        } catch (error) {
            return null;
        }
    }

    // The library without the per-computer "assigned" counts.
    function libraryContent(state) {
        return JSON.stringify(
            state,
            (key, value) =>
                key === "assigned"
                    ? undefined
                    : value
        );
    }

    async function libraryRequest(method, body) {
        const response = await fetch(
            `${window.SIKNAYAN_API_ROOT}/admin/module-library`,
            {
                method,
                headers: {
                    Accept: "application/json",
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${apiToken()}`
                },
                body: body ? JSON.stringify(body) : undefined
            }
        );

        const payload = await response.json().catch(() => null);

        return {
            ok: response.ok,
            status: response.status,
            payload
        };
    }

    function parseLibrary(text) {
        try {
            const library = JSON.parse(text);
            return library && typeof library === "object" ? library : null;
        } catch (error) {
            return null;
        }
    }

    /* Puts the database's library in this browser's copy. Returns true
       when that changed what the page shows. */
    function applyServerLibrary(library, revision) {
        const before = readLocalState();

        storageSet(STORAGE_KEY, JSON.stringify(library));
        storageSet(REVISION_KEY, String(revision));
        storageRemove(PENDING_KEY);

        // Tidy it the same way every page does.
        const after = load();

        return !before || libraryContent(before) !== libraryContent(after);
    }

    /* Shows the database's library: pages read it when they start, so
       reload once (not again within a few seconds, to avoid loops). */
    function refreshPage() {
        let last = 0;

        try {
            last = Number(sessionStorage.getItem(RELOAD_GUARD_KEY)) || 0;
        } catch (error) {
            last = 0;
        }

        if (Date.now() - last < 5000) {
            return;
        }

        try {
            sessionStorage.setItem(RELOAD_GUARD_KEY, String(Date.now()));
        } catch (error) {
            return;
        }

        window.location.reload();
    }

    /* The first time a browser connects, programs, courses and modules
       it had that the database doesn't are added (nothing is removed). */
    function mergeLibraries(server, local) {
        const merged = clone(server);

        if (
            !merged.programs ||
            typeof merged.programs !== "object" ||
            Array.isArray(merged.programs)
        ) {
            merged.programs = {};
        }

        const deleted = new Set(
            (Array.isArray(merged.deletedPrograms) ? merged.deletedPrograms : [])
                .map(normalizeCode)
        );

        Object.entries(local?.programs || {}).forEach(([key, localProgram]) => {
            const code = normalizeCode(localProgram?.code || key);

            if (!code || deleted.has(code)) {
                return;
            }

            const existingKey = Object.keys(merged.programs).find(
                serverKey =>
                    normalizeCode(merged.programs[serverKey]?.code || serverKey) === code
            );

            if (!existingKey) {
                merged.programs[key] = clone(localProgram);
                return;
            }

            const serverProgram = merged.programs[existingKey];

            ["courses", "modules"].forEach(listName => {
                if (!Array.isArray(localProgram[listName])) {
                    return;
                }

                if (!Array.isArray(serverProgram[listName])) {
                    serverProgram[listName] = [];
                }

                const ids = new Set(
                    serverProgram[listName].map(item => item && item.id)
                );

                localProgram[listName].forEach(item => {
                    if (item && item.id != null && !ids.has(item.id)) {
                        serverProgram[listName].push(clone(item));
                        ids.add(item.id);
                    }
                });
            });
        });

        return merged;
    }

    /* Sends this browser's library to the database. If another admin
       saved first, their version is loaded instead. */
    async function pushNow() {
        if (pushing) {
            pushAgain = true;
            return;
        }

        pushing = true;

        try {
            do {
                pushAgain = false;

                const state = readLocalState();

                if (!state) {
                    break;
                }

                const result = await libraryRequest("PUT", {
                    library: JSON.stringify(state),
                    revision: localRevision() ?? 0
                });

                if (result.ok && result.payload?.success) {
                    storageSet(REVISION_KEY, String(result.payload.revision));

                    if (!pushAgain) {
                        storageRemove(PENDING_KEY);
                    }

                    continue;
                }

                if (result.status === 409 && result.payload) {
                    const latest = parseLibrary(result.payload.library);

                    pushAgain = false;

                    if (latest) {
                        applyServerLibrary(latest, result.payload.revision);
                    }

                    alert(
                        (result.payload.message ||
                            "Another Academic Admin changed the Module Library.") +
                        " Please make your last change again."
                    );

                    refreshPage();
                    break;
                }

                throw new Error(
                    result.payload?.message ||
                    `Request failed (${result.status}).`
                );
            } while (pushAgain);
        } catch (error) {
            console.error("Module Library: unable to save to the server.", error);

            alert(
                "Your Module Library change is saved on this computer but could not " +
                "reach the server. It will be sent again the next time you open an " +
                "Academic Admin page."
            );
        } finally {
            pushing = false;
        }
    }

    function queuePush() {
        if (!window.SIKNAYAN_API_ROOT || !apiToken()) {
            return;
        }

        Promise.resolve(initialSync)
            .then(pushNow);
    }

    /* Runs once per page: brings this browser's copy in line with the
       database. Returns { push, changed }. */
    async function syncFromServer() {
        const result = await libraryRequest("GET");

        if (!result.ok || !result.payload?.success) {
            return { push: false, changed: false };
        }

        const server = result.payload.library
            ? parseLibrary(result.payload.library)
            : null;

        const revision = Number(result.payload.revision) || 0;
        const local = readLocalState();

        // Nothing in the database yet: this browser's library is the first.
        if (!server) {
            if (local) {
                storageSet(REVISION_KEY, "0");
                return { push: true, changed: false };
            }

            return { push: false, changed: false };
        }

        // This browser's first connection: keep what only it had.
        if (localRevision() === null) {
            const merged = local
                ? mergeLibraries(server, local)
                : server;

            const added =
                libraryContent(merged) !== libraryContent(server);

            const changed = applyServerLibrary(merged, revision);

            return { push: added, changed };
        }

        // A change made here that didn't reach the database last time.
        if (storageGet(PENDING_KEY) === "1") {
            if (localRevision() === revision) {
                return { push: true, changed: false };
            }

            alert(
                "Another Academic Admin changed the Module Library before your " +
                "last change reached the server. The latest version has been loaded."
            );
        }

        return {
            push: false,
            changed: applyServerLibrary(server, revision)
        };
    }

    function startSync() {
        if (!window.SIKNAYAN_API_ROOT || !apiToken()) {
            return;
        }

        initialSync = syncFromServer()
            .then(async outcome => {
                if (outcome.push) {
                    if (outcome.changed) {
                        storageSet(PENDING_KEY, "1");
                    }

                    await pushNow();
                }

                if (outcome.changed) {
                    refreshPage();
                }
            })
            .catch(error => {
                console.error("Module Library: unable to load from the server.", error);
            });
    }


    /* =====================================================
       PUBLIC API
    ===================================================== */

    window.SiknayanModuleLibraryData = {

        STORAGE_KEY,

        PROGRAM_SEEDS,

        normalizeCode,

        load,

        save,

        getProgram,

        saveProgram,

        getPrograms,

        countAssigned,

        syncAssignedCounts,

        addProgram,

        deleteProgram

    };


    // Bring this browser's copy in line with the database.
    startSync();


})();