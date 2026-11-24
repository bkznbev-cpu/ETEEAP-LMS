/* =========================================================
   SIKNAYAN - MODULE LIBRARY LANDING PAGE
========================================================= */

(function initModuleLibrary() {

    "use strict";


    const page =
        document.querySelector(
            ".module-library-page"
        );


    if (!page) {
        return;
    }


    const data =
        window.SiknayanModuleLibraryData;


    if (!data) {

        console.error(
            "Module Library: module-library-data.js must load first."
        );

        return;

    }


    const programGrid =
        document.getElementById(
            "programGrid"
        );


    const librarySummary =
        document.getElementById(
            "librarySummary"
        );


    const addProgramModal =
        document.getElementById(
            "addProgramModal"
        );


    const openAddProgramButton =
        document.getElementById(
            "openAddProgramBtn"
        );


    const cancelAddProgramButton =
        document.getElementById(
            "cancelAddProgramBtn"
        );


    const addProgramForm =
        document.getElementById(
            "addProgramForm"
        );


    const programNameInput =
        document.getElementById(
            "programName"
        );


    const programCodeInput =
        document.getElementById(
            "programCode"
        );


    const iconChoices =
        document.querySelectorAll(
            ".icon-choice"
        );


    if (
        !programGrid ||
        !librarySummary ||
        !addProgramModal ||
        !addProgramForm ||
        !programNameInput ||
        !programCodeInput
    ) {

        console.error(
            "Module Library: required elements are missing."
        );

        return;

    }


    let selectedIcon =
        "monitor-up";


    function refreshIcons() {

        if (
            window.lucide &&
            typeof window.lucide.createIcons ===
                "function"
        ) {

            window.lucide.createIcons();

        }

    }


    function escapeHtml(
        value
    ) {

        return String(
            value ??
            ""
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


    /* Every program has its own color so the cards are easy to tell apart.
       Programs added later get a color no other card on the page is using. */
    const PROGRAM_THEMES = {
        BSIT:   { accent: "#1d4ed8", soft: "#e8efff" },  // blue
        BSCRIM: { accent: "#b91c1c", soft: "#fde8e8" },  // red
        BSEED:  { accent: "#ea580c", soft: "#fff0e6" },  // orange
        BSED:   { accent: "#a21caf", soft: "#fbe8fd" },  // magenta
        BSNED:  { accent: "#4d7c0f", soft: "#eef6e0" },  // olive
        BSOA:   { accent: "#4338ca", soft: "#eceafe" },  // indigo
        BSN:    { accent: "#db2777", soft: "#fde7f1" },  // pink
        BSBA:   { accent: "#7c3aed", soft: "#f1eafe" },  // violet
        BSA:    { accent: "#a16207", soft: "#fdf4dc" },  // gold
        BAPS:   { accent: "#334155", soft: "#eef1f5" },  // slate
        BSHM:   { accent: "#15803d", soft: "#e5f5ea" },  // green
        BSTM:   { accent: "#0284c7", soft: "#e0f2fe" }   // sky blue
    };

    const FALLBACK_THEMES = [
        { accent: "#9f1239", soft: "#fde8ee" },  // crimson
        { accent: "#1e3a8a", soft: "#e6ecfa" },  // navy
        { accent: "#701a75", soft: "#f8e6f8" },  // plum
        { accent: "#0f766e", soft: "#e2f4f2" },  // teal
        { accent: "#78350f", soft: "#f6ece2" },  // coffee
        { accent: "#0e7490", soft: "#e0f5f8" },  // cyan
        { accent: "#3f3f46", soft: "#efeff1" },  // gray
        { accent: "#65a30d", soft: "#f0f8e2" }   // lime
    ];

    /* Small icons drawn faintly on each card, picked to match
       the program's field. */
    const EDUCATION_MOTIF = ["graduation-cap", "pencil", "book-open", "apple"];

    const PROGRAM_MOTIFS = {
        BSIT:   ["code", "cpu", "wifi", "database"],
        BSCRIM: ["fingerprint", "scale", "siren", "shield-check"],
        BSEED:  EDUCATION_MOTIF,
        BSED:   EDUCATION_MOTIF,
        BSNED:  EDUCATION_MOTIF,
        BSOA:   ["printer", "folder-open", "calendar-days", "keyboard"],
        BSN:    ["stethoscope", "syringe", "pill", "hospital"],
        BSBA:   ["trending-up", "handshake", "store", "megaphone"],
        BSA:    ["calculator", "coins", "receipt", "pie-chart"],
        BAPS:   ["landmark", "vote", "gavel", "megaphone"],
        BSHM:   ["chef-hat", "utensils", "concierge-bell", "bed-double"],
        BSTM:   ["plane", "map-pin", "luggage", "tree-palm"]
    };

    function programKey(code) {
        return String(code || "").trim().toUpperCase();
    }

    function getProgramMotif(code, icon) {
        // New programs reuse their own icon next to general school icons.
        return PROGRAM_MOTIFS[programKey(code)] || [icon, "book-open", "graduation-cap", "pencil"];
    }

    /* Gives every program on the page a color, so no two cards match.
       Known programs keep their own color; new ones take an unused
       color, starting from one picked by their code so it stays the same. */
    function assignProgramThemes(programs) {
        const themes = new Map();
        const used = new Set();

        programs.forEach(program => {
            const theme = PROGRAM_THEMES[programKey(program.code)];
            if (theme) used.add(theme.accent);
        });

        const palette = [
            ...FALLBACK_THEMES,
            ...Object.values(PROGRAM_THEMES)
        ].filter((theme, index, list) =>
            list.findIndex(other => other.accent === theme.accent) === index
        );

        programs.forEach(program => {
            const key = programKey(program.code);

            if (PROGRAM_THEMES[key]) {
                themes.set(key, PROGRAM_THEMES[key]);
                return;
            }

            let hash = 0;
            for (const char of key) {
                hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
            }

            let theme = palette[hash % palette.length];
            for (let step = 0; step < palette.length; step++) {
                const option = palette[(hash + step) % palette.length];
                if (!used.has(option.accent)) {
                    theme = option;
                    break;
                }
            }

            used.add(theme.accent);
            themes.set(key, theme);
        });

        return themes;
    }


    /* A card is a link to the program's page, with a separate
       delete button in its corner (not inside the link). */
    function createProgramCard(
        program,
        theme
    ) {

        const wrap = document.createElement("div");
        wrap.className = "program-card-wrap";
        wrap.style.setProperty("--program-accent", theme.accent);
        wrap.style.setProperty("--program-soft", theme.soft);

        const code = escapeHtml(program.code);
        const icon = escapeHtml(program.icon || "monitor-up");

        const subjects = Array.isArray(program.courses) ? program.courses.length : 0;
        const modules = Array.isArray(program.modules) ? program.modules.length : 0;

        const majors =
            Array.isArray(program.majors) && program.majors.length
                ? `<p class="program-card-majors">Majors: ${program.majors
                    .map(major => escapeHtml(major))
                    .join(" · ")}</p>`
                : "";

        wrap.innerHTML = `
            <a
                class="program-card"
                data-program="${code}"
                href="module-library-program.html?program=${encodeURIComponent(program.code)}"
            >
                <span class="program-card-art" aria-hidden="true"></span>

                <span class="program-card-motif" aria-hidden="true">
                    ${getProgramMotif(program.code, icon)
                        .map(name => `<i data-lucide="${escapeHtml(name)}"></i>`)
                        .join("")}
                </span>

                <div class="program-card-top">
                    <span class="program-icon-badge">
                        <i data-lucide="${icon}" class="program-icon"></i>
                    </span>

                    <div class="program-card-title">
                        <h3>${code}</h3>
                        <p class="program-card-name">${escapeHtml(program.name || "")}</p>
                    </div>
                </div>

                ${majors}

                <div class="program-card-stats">
                    <span class="program-stat">
                        <i data-lucide="book-open"></i>
                        <strong>${subjects}</strong>
                        ${subjects === 1 ? "Subject" : "Subjects"}
                    </span>

                    <span class="program-stat">
                        <i data-lucide="layers"></i>
                        <strong>${modules}</strong>
                        ${modules === 1 ? "Module" : "Modules"}
                    </span>
                </div>
            </a>

            <button
                type="button"
                class="program-delete-btn"
                data-delete-program="${code}"
                aria-label="Delete ${code}"
                title="Delete ${code}"
            >
                <i data-lucide="trash-2"></i>
            </button>
        `;

        return wrap;

    }


    function renderPrograms() {

        const programs =
            data.getPrograms();


        let moduleTotal =
            0;


        programGrid.innerHTML =
            "";


        const themes =
            assignProgramThemes(
                programs
            );


        programs.forEach(
            program => {

                moduleTotal +=
                    Array.isArray(
                        program.modules
                    )
                        ? program.modules.length
                        : 0;


                programGrid.appendChild(
                    createProgramCard(
                        program,
                        themes.get(programKey(program.code))
                    )
                );

            }
        );


        librarySummary.textContent =
            `${moduleTotal} modules across ${programs.length} programs`;


        refreshIcons();

    }


    function openAddProgramModal() {

        addProgramModal.classList.add(
            "active"
        );


        addProgramModal.setAttribute(
            "aria-hidden",
            "false"
        );


        setTimeout(
            () => {

                programNameInput.focus();

            },
            50
        );

    }


    function closeAddProgramModal() {

        addProgramModal.classList.remove(
            "active"
        );


        addProgramModal.setAttribute(
            "aria-hidden",
            "true"
        );


        resetAddProgramForm();

    }


    function resetAddProgramForm() {

        addProgramForm.reset();


        iconChoices.forEach(
            choice => {

                choice.classList.remove(
                    "selected"
                );

            }
        );


        const firstChoice =
            document.querySelector(
                ".icon-choice"
            );


        if (
            firstChoice
        ) {

            firstChoice.classList.add(
                "selected"
            );


            selectedIcon =
                firstChoice.dataset.icon ||
                "monitor-up";

        }

    }


    iconChoices.forEach(
        choice => {

            choice.addEventListener(
                "click",
                () => {

                    iconChoices.forEach(
                        item => {

                            item.classList.remove(
                                "selected"
                            );

                        }
                    );


                    choice.classList.add(
                        "selected"
                    );


                    selectedIcon =
                        choice.dataset.icon ||
                        "monitor-up";

                }
            );

        }
    );


    openAddProgramButton?.addEventListener(
        "click",
        openAddProgramModal
    );


    cancelAddProgramButton?.addEventListener(
        "click",
        closeAddProgramModal
    );


    addProgramModal.addEventListener(
        "click",
        event => {

            if (
                event.target ===
                addProgramModal
            ) {

                closeAddProgramModal();

            }

        }
    );


    addProgramForm.addEventListener(
        "submit",
        event => {

            event.preventDefault();


            const name =
                programNameInput
                    .value
                    .trim();


            const code =
                data.normalizeCode(
                    programCodeInput.value
                );


            if (
                !name
            ) {

                alert(
                    "Please enter a program name."
                );


                programNameInput.focus();

                return;

            }


            if (
                !code
            ) {

                alert(
                    "Please enter a program code."
                );


                programCodeInput.focus();

                return;

            }


            const duplicate =
                data
                    .getPrograms()
                    .some(
                        program =>

                            data.normalizeCode(
                                program.code
                            ) ===
                            code

                            ||

                            String(
                                program.name ||
                                ""
                            )
                                .trim()
                                .toLowerCase() ===
                            name.toLowerCase()
                    );


            if (
                duplicate
            ) {

                alert(
                    "A program with this name or program code already exists."
                );

                return;

            }


            data.addProgram({

                name,

                code,

                icon:
                    selectedIcon

            });


            closeAddProgramModal();

            renderPrograms();

        }
    );


    document.addEventListener(
        "keydown",
        event => {

            if (
                event.key ===
                "Escape" &&

                addProgramModal.classList.contains(
                    "active"
                )
            ) {

                closeAddProgramModal();

            }

        }
    );


    /* =====================================================
       DELETE PROGRAM
       A program with modules cannot be deleted (the button
       stays off and the reason is shown).
    ===================================================== */

    const deleteProgramModal = document.getElementById("deleteProgramModal");
    const deleteProgramMessage = document.getElementById("deleteProgramMessage");
    const deleteProgramError = document.getElementById("deleteProgramError");
    const cancelDeleteProgramButton = document.getElementById("cancelDeleteProgramBtn");
    const confirmDeleteProgramButton = document.getElementById("confirmDeleteProgramBtn");

    let programToDelete = null;
    let deleteOpener = null;

    function showDeleteError(message) {
        deleteProgramError.textContent = message;
        deleteProgramError.hidden = !message;
    }

    function openDeleteProgramModal(code, opener) {
        const program = data
            .getPrograms()
            .find(item => data.normalizeCode(item.code) === data.normalizeCode(code));

        if (!program || !deleteProgramModal) return;

        programToDelete = program.code;
        deleteOpener = opener || null;

        const subjects = Array.isArray(program.courses) ? program.courses.length : 0;
        const modules = Array.isArray(program.modules) ? program.modules.length : 0;

        deleteProgramMessage.textContent =
            `${program.code} (${program.name || program.code}) will be removed from the Module Library` +
            (subjects ? `, together with its ${subjects} ${subjects === 1 ? "subject" : "subjects"}` : "") +
            ". This cannot be undone.";

        if (modules) {
            showDeleteError(
                `This program still has ${modules} ${modules === 1 ? "module" : "modules"}. ` +
                "Open the program and remove its modules first, then delete it."
            );
            confirmDeleteProgramButton.disabled = true;
        } else {
            showDeleteError("");
            confirmDeleteProgramButton.disabled = false;
        }

        deleteProgramModal.classList.add("active");
        deleteProgramModal.setAttribute("aria-hidden", "false");
        refreshIcons();

        setTimeout(
            () => (modules ? cancelDeleteProgramButton : confirmDeleteProgramButton).focus(),
            50
        );
    }

    function closeDeleteProgramModal() {
        if (!deleteProgramModal) return;

        deleteProgramModal.classList.remove("active");
        deleteProgramModal.setAttribute("aria-hidden", "true");
        programToDelete = null;

        if (deleteOpener && document.body.contains(deleteOpener)) {
            deleteOpener.focus();
        }
        deleteOpener = null;
    }

    programGrid.addEventListener("click", event => {
        const button = event.target.closest("[data-delete-program]");
        if (!button) return;

        event.preventDefault();
        openDeleteProgramModal(button.dataset.deleteProgram, button);
    });

    cancelDeleteProgramButton?.addEventListener("click", closeDeleteProgramModal);

    deleteProgramModal?.addEventListener("click", event => {
        if (event.target === deleteProgramModal) closeDeleteProgramModal();
    });

    confirmDeleteProgramButton?.addEventListener("click", async () => {
        if (!programToDelete || confirmDeleteProgramButton.disabled) return;

        const result = data.deleteProgram(programToDelete);

        if (!result.ok) {
            showDeleteError(result.reason);
            confirmDeleteProgramButton.disabled = true;
            return;
        }

        deleteOpener = null;
        closeDeleteProgramModal();
        renderPrograms();
        openAddProgramButton?.focus();
    });

    document.addEventListener("keydown", event => {
        if (
            event.key === "Escape" &&
            deleteProgramModal?.classList.contains("active")
        ) {
            closeDeleteProgramModal();
        }
    });


    data.load();

    resetAddProgramForm();

    renderPrograms();

})();