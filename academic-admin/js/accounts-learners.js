/* =========================================================
   SIKNAYAN - LEARNER ACCOUNTS
   Learner-centered account management.
   Frontend prototype only.
========================================================= */

(function initLearnerAccountsPage() {
    const page = document.querySelector(".learner-accounts-page");
    if (!page) return;

    /* ---------------- STORAGE ---------------- */

    const LEARNER_STORAGE_KEY =
        "siknayan_academic_admin_learners";
    const CLASS_STORAGE_KEY =
        "siknayan_academic_admin_classes";
    const ACCOUNT_STORAGE_KEY =
        "siknayan_academic_admin_learner_accounts";
    const ACCOUNT_STORAGE_VERSION = "v1";

    /* ---------------- ELEMENTS ---------------- */

    const tableBody =
        document.getElementById("learnerAccountsTableBody");
    const emptyState =
        document.getElementById("learnerAccountsEmpty");
    const searchInput =
        document.getElementById("learnerAccountSearch");
    const statusFilter =
        document.getElementById("learnerAccountStatusFilter");
    const addButton =
        document.getElementById("addLearnerAccountBtn");

    const accountModal =
        document.getElementById("learnerAccountModal");
    const accountModalTitle =
        document.getElementById("learnerAccountModalTitle");
    const accountModalDescription =
        document.getElementById("learnerAccountModalDescription");
    const closeAccountModalButton =
        document.getElementById("closeLearnerAccountModal");
    const cancelAccountButton =
        document.getElementById("cancelLearnerAccount");
    const accountForm =
        document.getElementById("learnerAccountForm");
    const accountEditId =
        document.getElementById("accountEditId");
    const studentIdInput =
        document.getElementById("accountStudentId");
    const fullNameInput =
        document.getElementById("accountFullName");
    const programInput =
        document.getElementById("accountProgram");
    // The form has no email field (people add their own after first
    // login); this blank stand-in keeps the old form code working.
    const emailInput =
        document.getElementById("accountEmail") ||
        document.createElement("input");
    const passwordInput =
        document.getElementById("accountPassword");
    const generatePasswordButton =
        document.getElementById("generatePasswordBtn");
    const saveLearnerAccountButton =
        document.getElementById("saveLearnerAccountBtn");

    const resetPasswordModal =
        document.getElementById("resetPasswordModal");
    const resetPasswordDescription =
        document.getElementById("resetPasswordDescription");
    const closeResetPasswordButton =
        document.getElementById("closeResetPasswordModal");
    const cancelResetPasswordButton =
        document.getElementById("cancelResetPassword");
    const resetPasswordValue =
        document.getElementById("resetPasswordValue");
    const regenerateResetPasswordButton =
        document.getElementById("regenerateResetPassword");
    const confirmResetPasswordButton =
        document.getElementById("confirmResetPassword");

    const deleteAccountModal =
        document.getElementById("deleteAccountModal");
    const deleteAccountMessage =
        document.getElementById("deleteAccountMessage");
    const closeDeleteAccountButton =
        document.getElementById("closeDeleteAccountModal");
    const cancelDeleteAccountButton =
        document.getElementById("cancelDeleteAccount");
    const confirmDeleteCheckbox =
        document.getElementById("confirmDeleteAccount");
    const confirmDeleteButton =
        document.getElementById("confirmDeleteAccountBtn");

    let resetAccountId = null;
    let deleteLearnerId = null;

    /* ---------------- HELPERS ---------------- */

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

    /* ---------------- PROGRAMS ---------------- */

    function initializeProgramOptions() {
        if (!programInput) return;

        if (
            window.SiknayanPrograms &&
            typeof window.SiknayanPrograms.renderOptions === "function"
        ) {
            window.SiknayanPrograms.renderOptions(
                programInput,
                {
                    includePlaceholder: true,
                    placeholder: "Select program",
                    preserveValue: true
                }
            );
            return;
        }

        const programs = [
            "BSIT",
            "BSCRIM",
            "BSEEd",
            "BSOA",
            "BSN",
            "BSTM"
        ];

        const previousValue = programInput.value;

        programInput.innerHTML = `
            <option value="">Select program</option>
            ${programs
                .map(
                    program =>
                        `<option value="${program}">${program}</option>`
                )
                .join("")}
        `;

        programInput.value = programs.includes(previousValue)
            ? previousValue
            : "";
    }

    /* ---------------- LEARNER STORAGE ---------------- */

    function loadLearnerState() {
        try {
            const stored =
                localStorage.getItem(LEARNER_STORAGE_KEY);

            if (!stored) {
                return {
                    version: "v5",
                    learners: [],
                    modules: {}
                };
            }

            const parsed = JSON.parse(stored);

            if (
                parsed &&
                Array.isArray(parsed.learners)
            ) {
                return {
                    version: parsed.version || "v5",
                    learners: parsed.learners,
                    modules:
                        parsed.modules &&
                        typeof parsed.modules === "object"
                            ? parsed.modules
                            : {}
                };
            }

            if (Array.isArray(parsed)) {
                return {
                    version: "v5",
                    learners: parsed,
                    modules: {}
                };
            }

        } catch (error) {
            console.error(
                "Learner Accounts: unable to load learner data.",
                error
            );
        }

        return {
            version: "v5",
            learners: [],
            modules: {}
        };
    }

    function saveLearnerState(state) {
        localStorage.setItem(
            LEARNER_STORAGE_KEY,
            JSON.stringify({
                version: state.version || "v5",
                learners: Array.isArray(state.learners)
                    ? state.learners
                    : [],
                modules:
                    state.modules &&
                    typeof state.modules === "object"
                        ? state.modules
                        : {}
            })
        );
    }

    function getLearners() {
        return loadLearnerState().learners;
    }

    function getLearnerById(learnerId) {
        return getLearners().find(
            learner =>
                String(learner.id) === String(learnerId)
        );
    }

    /* ---------------- CLASS RELATIONSHIPS ---------------- */

    function loadClassRecords() {
        try {
            const stored =
                localStorage.getItem(CLASS_STORAGE_KEY);

            if (!stored) return [];

            const parsed = JSON.parse(stored);
            if (!Array.isArray(parsed)) return [];

            return parsed.map(classItem => ({
                ...classItem,
                learnerIds: Array.isArray(classItem?.learnerIds)
                    ? classItem.learnerIds
                    : []
            }));
        } catch (error) {
            console.error(
                "Learner Accounts: unable to load class data.",
                error
            );
            return [];
        }
    }

    function saveClassRecords(classes) {
        localStorage.setItem(
            CLASS_STORAGE_KEY,
            JSON.stringify(classes)
        );
    }

    function getClassesForLearner(learnerId) {
        const id = String(learnerId);

        return loadClassRecords().filter(
            classItem =>
                Array.isArray(classItem.learnerIds) &&
                classItem.learnerIds.some(
                    learnerIdValue =>
                        String(learnerIdValue) === id
                )
        );
    }

    function removeLearnerFromClasses(classes, learnerId) {
        const id = String(learnerId);

        return classes.map(classItem => {
            const learnerIds = Array.isArray(
                classItem?.learnerIds
            )
                ? classItem.learnerIds
                : [];

            const updatedLearnerIds =
                learnerIds.filter(
                    learnerIdValue =>
                        String(learnerIdValue) !== id
                );

            return {
                ...classItem,
                learnerIds: updatedLearnerIds,
                learners: updatedLearnerIds.length
            };
        });
    }

    /* ---------------- ACCOUNT STORAGE ---------------- */

    function loadAccounts() {
        try {
            const stored =
                localStorage.getItem(ACCOUNT_STORAGE_KEY);

            if (!stored) {
                return {
                    version: ACCOUNT_STORAGE_VERSION,
                    accounts: []
                };
            }

            const parsed = JSON.parse(stored);

            if (
                parsed &&
                Array.isArray(parsed.accounts)
            ) {
                return {
                    version:
                        parsed.version ||
                        ACCOUNT_STORAGE_VERSION,
                    accounts: parsed.accounts
                };
            }

            /* Backward compatibility with direct-array storage. */
            if (Array.isArray(parsed)) {
                return {
                    version: ACCOUNT_STORAGE_VERSION,
                    accounts: parsed
                };
            }

        } catch (error) {
            console.error(
                "Learner Accounts: unable to load account data.",
                error
            );
        }

        return {
            version: ACCOUNT_STORAGE_VERSION,
            accounts: []
        };
    }

    function saveAccounts(accounts) {
        const safeAccounts = accounts.map(account => {
            const safeAccount = { ...account };
            delete safeAccount.password;
            return safeAccount;
        });
        localStorage.setItem(
            ACCOUNT_STORAGE_KEY,
            JSON.stringify({
                version: ACCOUNT_STORAGE_VERSION,
                accounts: safeAccounts
            })
        );
    }

    function getAccounts() {
        return loadAccounts().accounts;
    }

    function getAccountById(accountId) {
        return getAccounts().find(
            account =>
                String(account.id) === String(accountId)
        );
    }

    function getAccountForLearner(learnerId) {
        return getAccounts().find(
            account =>
                String(account.learnerId) ===
                String(learnerId)
        );
    }

    function getLearnerName(account) {
        const learner =
            getLearnerById(account?.learnerId);

        return learner
            ? learner.name
            : "Unknown Learner";
    }

    function getDisplayStatus(status) {
        if (status === "active") return "Active";
        if (status === "inactive") return "Inactive";
        return "Not Set Up";
    }

    function getStatusClass(status) {
        if (status === "active") return "status-active";
        if (status === "inactive") return "status-inactive";
        return "status-pending";
    }

    /* ---------------- ACCOUNT UTILITIES ---------------- */

    function generateTemporaryPassword() {
        const characters =
            "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

        let password = "";

        for (let index = 0; index < 9; index++) {
            password += characters.charAt(
                Math.floor(
                    Math.random() *
                    characters.length
                )
            );
        }

        return password;
    }

    function createAccountId(learnerId) {
        return (
            `learner-account-${String(learnerId).replace(
                /[^a-zA-Z0-9]/g,
                "-"
            )}`
        );
    }

    /* ---------------- ACCOUNT MODAL MODES ---------------- */

    function setCreateMode() {
        accountModalTitle.textContent =
            "Create Learner Account";

        accountModalDescription.textContent =
            "Create a new learner record and login account.";

        studentIdInput.readOnly = false;
        fullNameInput.readOnly = false;
        programInput.disabled = false;
        emailInput.readOnly = false;
        passwordInput.readOnly = false;
        passwordInput.required = true;
        passwordInput.placeholder = "";

        saveLearnerAccountButton.innerHTML = `
            <i data-lucide="user-plus"></i>
            <span>Create Account</span>
        `;
    }

    function setEditMode() {
        accountModalTitle.textContent =
            "Edit Learner Account";

        accountModalDescription.textContent =
            "Update this learner's login account information.";

        studentIdInput.readOnly = false;
        fullNameInput.readOnly = false;
        programInput.disabled = true;
        emailInput.readOnly = false;
        passwordInput.readOnly = false;
        passwordInput.required = false;
        passwordInput.placeholder = "Leave blank to keep the current password";

        saveLearnerAccountButton.innerHTML = `
            <i data-lucide="save"></i>
            <span>Save Changes</span>
        `;
    }

    function resetAccountFormState() {
        if (accountForm) {
            accountForm.reset();
        }

        accountEditId.value = "";
        studentIdInput.readOnly = false;
        fullNameInput.readOnly = false;
        programInput.disabled = false;
        emailInput.readOnly = false;
        passwordInput.readOnly = false;
        passwordInput.required = true;
        passwordInput.placeholder = "";
    }

    /* ---------------- OPEN CREATE ---------------- */

    function openAddModal() {
        resetAccountFormState();
        setCreateMode();
        initializeProgramOptions();

        passwordInput.value =
            generateTemporaryPassword();

        accountModal.hidden = false;

        setTimeout(
            () => studentIdInput.focus(),
            50
        );

        refreshIcons();
    }

    /* ---------------- OPEN CREATE FOR EXISTING LEARNER ---------------- */

    function openAddModalForLearner(learnerId) {
        const learner =
            getLearnerById(learnerId);

        if (!learner) return;

        if (
            getAccountForLearner(
                learner.id
            )
        ) {
            alert(
                "This learner already has an account."
            );
            return;
        }

        resetAccountFormState();
        setCreateMode();
        initializeProgramOptions();

        studentIdInput.value =
            learner.id;

        fullNameInput.value =
            learner.name;

        programInput.value =
            learner.program || "";

        emailInput.value = "";
        passwordInput.value =
            generateTemporaryPassword();

        studentIdInput.readOnly = true;
        fullNameInput.readOnly = true;
        programInput.disabled = true;

        accountModalTitle.textContent =
            "Create Learner Account";

        accountModalDescription.textContent =
            `Create a login account for ${learner.name}.`;

        saveLearnerAccountButton.innerHTML = `
            <i data-lucide="user-plus"></i>
            <span>Create Account</span>
        `;

        accountModal.hidden = false;

        setTimeout(
            () => emailInput.focus(),
            50
        );

        refreshIcons();
    }

    /* ---------------- EDIT ACCOUNT ---------------- */

    function openEditModal(accountId) {
        const account =
            getAccountById(accountId);

        if (!account) return;

        const learner =
            getLearnerById(
                account.learnerId
            );

        if (!learner) {
            alert(
                "The learner associated with this account no longer exists."
            );
            return;
        }

        initializeProgramOptions();

        accountEditId.value =
            account.id;

        // The school ID (e.g. 23-00013), not the database number.
        studentIdInput.value =
            learner.schoolId || "";

        fullNameInput.value =
            learner.name;

        programInput.value =
            learner.program || "";

        emailInput.value =
            account.email || "";

        passwordInput.value = "";

        setEditMode();

        accountModal.hidden = false;

        setTimeout(
            () => studentIdInput.focus(),
            50
        );

        refreshIcons();
    }

    function closeAccountModal() {
        accountModal.hidden = true;
        resetAccountFormState();
    }

    /* ---------------- LEARNER CREATION ---------------- */

    function getOrCreateLearner(
        studentId,
        fullName,
        program
    ) {
        const state =
            loadLearnerState();

        const normalizedId =
            studentId.trim();

        const normalizedName =
            fullName.trim();

        const normalizedProgram =
            program.trim();

        const existingLearner =
            state.learners.find(
                learner =>
                    String(learner.id)
                        .toLowerCase() ===
                    normalizedId.toLowerCase()
            );

        if (existingLearner) {
            if (
                String(
                    existingLearner.name || ""
                )
                    .trim()
                    .toLowerCase() !==
                normalizedName.toLowerCase()
            ) {
                alert(
                    "That Student ID already belongs to another learner."
                );
                return null;
            }

            if (
                String(
                    existingLearner.program || ""
                )
                    .trim()
                    .toLowerCase() !==
                normalizedProgram.toLowerCase()
            ) {
                alert(
                    "The selected Student ID already belongs to a learner in another program."
                );
                return null;
            }

            if (
                !state.modules[
                    existingLearner.id
                ]
            ) {
                state.modules[
                    existingLearner.id
                ] = [];

                saveLearnerState(state);
            }

            return existingLearner;
        }

        const newLearner = {
            id: normalizedId,
            name: normalizedName,
            program: normalizedProgram,
            status: "ACTIVE",
            modulesAssigned: 0,
            progress: 0,
            lastLogin: "Never",
            modules: []
        };

        state.learners.push(
            newLearner
        );

        state.modules[
            normalizedId
        ] = [];

        saveLearnerState(state);

        return newLearner;
    }

    /* ---------------- SAVE ACCOUNT ---------------- */

    async function saveAccount(event) {
        event.preventDefault();

        const accounts =
            getAccounts();

        const editingId =
            accountEditId.value.trim();

        const studentId =
            studentIdInput.value.trim();

        const fullName =
            fullNameInput.value.trim();

        const program =
            programInput.value.trim();

        const email =
            emailInput.value
                .trim()
                .toLowerCase();

        const password =
            passwordInput.value.trim();

        // New accounts start active; Activate/Deactivate is in the table.
        const status = "active";

        if (!studentId) {
            alert("Please enter a Student ID.");
            studentIdInput.focus();
            return;
        }

        if (!/^\d{2}-\d{5}$/.test(studentId)) {
            alert("Student ID must use the format 00-00000 (two digits, a hyphen, and five digits).");
            studentIdInput.focus();
            return;
        }

        if (!fullName) {
            alert(
                "Please enter the learner's full name."
            );
            fullNameInput.focus();
            return;
        }

        if (!program) {
            alert("Please select a program.");
            programInput.focus();
            return;
        }

  if (email && !emailInput.checkValidity()) {
    alert("Please enter a valid email address.");
    emailInput.focus();
    return;
}
        if (!editingId && !password) {
            alert(
                "Please provide a temporary password."
            );
            passwordInput.focus();
            return;
        }

        const duplicateEmail =
    email !== "" &&
    accounts.some(
        account =>
            String(account.email || "").toLowerCase() === email &&
            String(account.id) !== String(editingId)
    );

        if (duplicateEmail) {
            alert(
                "That email address is already being used by another learner account."
            );
            return;
        }

        /* EDIT EXISTING ACCOUNT */

        if (editingId) {
            const accountIndex =
                accounts.findIndex(
                    account =>
                        String(account.id) ===
                        String(editingId)
                );

            if (accountIndex === -1) {
                alert(
                    "The learner account could not be found."
                );
                return;
            }

            const account = accounts[accountIndex];

            if (!account.backendId) {
                alert("This learner account is not linked to Laravel. Refresh the page and try again.");
                return;
            }

            if (password && password.length < 8) {
                alert("The password must be at least 8 characters.");
                passwordInput.focus();
                return;
            }

            saveLearnerAccountButton.disabled = true;
            saveLearnerAccountButton.textContent = "Saving changes...";

            try {
                // No email: only the learner can set it.
                const requestData = {
                    school_id: studentId,
                    name: fullName
                };

                if (password) {
                    requestData.password = password;
                }

                const payload = await learnerAccountsApiRequest(
                    `/admin/learners/${encodeURIComponent(account.backendId)}`,
                    {
                        method: "PUT",
                        body: JSON.stringify(requestData)
                    }
                );

                if (!payload?.success || !payload?.learner) {
                    throw new Error(payload?.message || "The server returned an unexpected learner response.");
                }

                accounts[accountIndex] = {
                    ...account,
                    email: payload.learner.email || "",
                    isActive: payload.learner.is_active !== false,
                    status: payload.learner.is_active === false ? "inactive" : "active"
                };
                saveAccounts(accounts);

                // Show the new school ID and name in the table.
                const learnerState = loadLearnerState();
                const savedLearner = learnerState.learners.find(
                    item => String(item.id) === String(account.learnerId)
                );
                if (savedLearner) {
                    savedLearner.schoolId = payload.learner.school_id || studentId;
                    savedLearner.name = payload.learner.name || fullName;
                    savedLearner.email = payload.learner.email || "";
                    saveLearnerState(learnerState);
                }
                closeAccountModal();
                renderTable();
                alert(payload.message || "Learner account updated successfully.");
            } catch (error) {
                console.error("Learner account update failed:", error);
                alert(error.message || "Unable to update the learner account.");
            } finally {
                saveLearnerAccountButton.disabled = false;
                refreshIcons();
            }
            return;
        }

      
        /* CREATE ACCOUNT THROUGH LARAVEL */

        const token = getImportApiToken();

        if (!token) {
            alert("Your API token is missing. Please sign in again.");
            return;
        }

        const apiBase =
            typeof LEARNER_API_BASE_URL !== "undefined"
                ? LEARNER_API_BASE_URL
                : window.SIKNAYAN_API_ROOT;

        const originalButtonHTML =
            saveLearnerAccountButton.innerHTML;

        saveLearnerAccountButton.disabled = true;
        saveLearnerAccountButton.textContent = "Creating account...";

        try {
            const response = await fetch(
                `${apiBase}/admin/learners`,
                {
                    method: "POST",
                    headers: {
                        "Accept": "application/json",
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        name: fullName,
                        school_id: studentId,
                        program: program,
                        password: password,
                        is_active: status === "active"
                    })
                }
            );

            let payload = null;

            try {
                payload = await response.json();
            } catch {
                payload = null;
            }

            if (!response.ok || !payload?.success || !payload?.learner?.id) {
                let details = "";

                if (
                    payload?.errors &&
                    typeof payload.errors === "object"
                ) {
                    details = Object.entries(payload.errors)
                        .map(([field, messages]) =>
                            `${field}: ${
                                Array.isArray(messages)
                                    ? messages.join(", ")
                                    : String(messages)
                            }`
                        )
                        .join("\n");
                }

                throw new Error(
                    [
                        payload?.message ||
                            `Unable to create learner (${response.status}).`,
                        details
                    ].filter(Boolean).join("\n")
                );
            }

            const created = payload.learner;
            const backendId = String(created.id);
            const schoolId = String(created.school_id || studentId);

            /*
             * Update the local display cache using the database ID
             * returned by Laravel, not the Student ID.
             */
            const state = loadLearnerState();

            const legacyLearners = state.learners.filter(learner =>
                String(learner.schoolId || "").trim().toLowerCase() ===
                    schoolId.toLowerCase() ||
                String(learner.id).trim().toLowerCase() ===
                    schoolId.toLowerCase() ||
                String(learner.id) === backendId
            );

            const legacyIds = new Set(
                legacyLearners.map(learner => String(learner.id))
            );

            const previousLearner = legacyLearners[0] || {};

            let previousModules = [];

            for (const legacyId of legacyIds) {
                if (Array.isArray(state.modules[legacyId])) {
                    previousModules = state.modules[legacyId];
                    break;
                }
            }

            state.learners = state.learners.filter(learner =>
                !legacyIds.has(String(learner.id)) &&
                String(learner.id) !== backendId
            );

            state.learners.push({
                ...previousLearner,
                id: backendId,
                schoolId: schoolId,
                name: created.name || fullName,
                email: created.email || email || "",
                program: created.program || program,
                modulesAssigned: Number(
                    previousLearner.modulesAssigned || 0
                ),
                progress: previousLearner.progress ?? 0,
                status: created.password_setup_complete
                    ? "Active"
                    : "Not Set Up",
                passwordSetupComplete:
                    Boolean(created.password_setup_complete),
                isActive:
                    created.is_active !== false,
                lastActivity: previousLearner.lastActivity || "Never",
                backendAccount: true
            });

            if (!Array.isArray(state.modules[backendId])) {
                state.modules[backendId] = previousModules;
            }

            for (const legacyId of legacyIds) {
                if (legacyId !== backendId) {
                    delete state.modules[legacyId];
                }
            }

            saveLearnerState(state);

            /*
             * Keep locally stored account details linked to the
             * canonical learner ID returned by Laravel.
             */
            const updatedAccounts = accounts.filter(account =>
                !legacyIds.has(String(account.learnerId)) &&
                String(account.learnerId) !== backendId &&
                String(account.learnerId) !== schoolId
            );

            updatedAccounts.push({
                id: createAccountId(backendId),
                learnerId: backendId,
                backendId,
                email: created.email || email,
                lastLogin: "Never",
                status: status,
                isActive: created.is_active !== false,
                passwordSetupComplete:
                    Boolean(created.password_setup_complete),
                backendManaged: true,
                createdAt: created.created_at ||
                    new Date().toISOString()
            });

            saveAccounts(updatedAccounts);

            /*
             * Update class references if this learner previously
             * existed in local storage under the Student ID.
             */
            if (legacyIds.size > 0) {
                const classes = loadClassRecords();

                const updatedClasses = classes.map(classItem => {
                    const learnerIds = [
                        ...new Set(
                            classItem.learnerIds.map(id =>
                                legacyIds.has(String(id))
                                    ? backendId
                                    : String(id)
                            )
                        )
                    ];

                    return {
                        ...classItem,
                        learnerIds,
                        learners: learnerIds.length
                    };
                });

                saveClassRecords(updatedClasses);
            }

            closeAccountModal();
            renderTable();

            alert(
                `Learner account created successfully for ${created.name || fullName}.`
            );
        } catch (error) {
            console.error("Create learner account failed:", error);

            alert(
                error.message ||
                "Unable to create the learner account. Please try again."
            );
        } finally {
            saveLearnerAccountButton.disabled = false;
            saveLearnerAccountButton.innerHTML = originalButtonHTML;
            refreshIcons();
        }
    }


    /* ---------------- ACTION BUTTON ---------------- */

    function createActionButton(
        label,
        icon,
        handler,
        danger = false,
        iconOnly = false
    ) {
        const button =
            document.createElement("button");

        button.type = "button";

        button.className =
            danger
                ? "table-action-button danger"
                : "table-action-button";

        button.innerHTML = iconOnly
            ? `<i data-lucide="${icon}"></i>`
            : `
            <i data-lucide="${icon}"></i>
            <span>${escapeHtml(label)}</span>
        `;

        if (iconOnly) {
            button.classList.add("icon-only");
            button.title = label;
            button.setAttribute("aria-label", label);
        }

        button.addEventListener(
            "click",
            handler
        );

        return button;
    }

    /* ---------------- RENDER TABLE ---------------- */

    function renderTable() {
        if (!tableBody) return;

        const learners =
            getLearners();

        const accounts =
            getAccounts();

        const query =
            searchInput
                ? searchInput.value
                    .trim()
                    .toLowerCase()
                : "";

        const selectedStatus =
            statusFilter
                ? statusFilter.value
                : "all";

        tableBody.innerHTML = "";

        let visibleRows = 0;

        learners.forEach(learner => {
            const account =
                accounts.find(
                    item =>
                        String(
                            item.learnerId
                        ) ===
                        String(
                            learner.id
                        )
                ) || null;

            /*
             * This is the important learner-centered rule:
             * every learner gets a row, even without an account.
             */

            const passwordSetupComplete = account
                ? account.passwordSetupComplete !== false
                : learner.passwordSetupComplete === true;
            const isActive = account
                ? account.isActive !== false
                : learner.isActive !== false;
            const accountStatus = !passwordSetupComplete
                ? "not-set-up"
                : isActive
                    ? "active"
                    : "inactive";

            const searchableText = [
                learner.id,
                learner.name,
                learner.program,
                account
                    ? account.email
                    : (learner.email || "")
            ]
                .join(" ")
                .toLowerCase();

            const matchesSearch =
                !query ||
                searchableText.includes(
                    query
                );

            const matchesStatus =
                selectedStatus ===
                    "all" ||
                accountStatus ===
                    selectedStatus;

            if (
                !matchesSearch ||
                !matchesStatus
            ) {
                return;
            }

            visibleRows++;

            const row =
                document.createElement("tr");

            row.className =
                "learner-account-row";

            const rowNumberCell =
                document.createElement("td");

            rowNumberCell.className =
                "row-number";

            rowNumberCell.textContent =
                String(visibleRows);

            const studentIdCell =
                document.createElement("td");

            studentIdCell.className =
                "student-id";

            studentIdCell.textContent =
                learner.schoolId || "—";

            const learnerCell =
                document.createElement("td");

            learnerCell.className =
                "learner-account-name";

            learnerCell.innerHTML = `
                <strong>
                    ${escapeHtml(
                        learner.name
                    )}
                </strong>
            `;

            const emailCell =
                document.createElement("td");

            emailCell.className =
                "learner-account-email";

            emailCell.textContent =
                (account && account.email) ||
                learner.email ||
                "—";

            const programCell =
                document.createElement("td");

            programCell.textContent =
                learner.program ||
                "—";
            const statusCell =
                document.createElement("td");

            const statusBadge =
                document.createElement("span");

            statusBadge.className =
                `status-badge ${
                    getStatusClass(
                        accountStatus
                    )
                }`;

            statusBadge.textContent =
                getDisplayStatus(
                    accountStatus
                );

            statusCell.appendChild(
                statusBadge
            );

            const actionsCell =
                document.createElement("td");

            actionsCell.className =
                "learner-account-actions";

if (account) {
    actionsCell.appendChild(
        createActionButton(
            "Edit",
            "pencil",
            () => openEditModal(account.id),
            false,
            true
        )
    );

    // Actions depend on the account's state:
    //   Inactive   -> Activate
    //   Not Set Up -> nothing extra
    //   Active     -> Deactivate
    // A new password can be set in Edit (Temporary Password).
    if (!isActive) {
        actionsCell.appendChild(
            createActionButton(
                "Activate",
                "user-check",
                () => toggleAccountStatus(account.id)
            )
        );
    } else if (passwordSetupComplete) {
        actionsCell.appendChild(
            createActionButton(
                "Deactivate",
                "user-x",
                () => toggleAccountStatus(account.id)
            )
        );
    }
} else if (!learner.backendAccount) {
    actionsCell.appendChild(
        createActionButton(
            "Create Account",
            "user-plus",
            () => openAddModalForLearner(learner.id)
        )
    );
}

            // Accounts that were set up are never deleted (deactivate instead).
            const setUp = Boolean(account?.accountSetUp || learner.accountSetUp);
            if (!setUp) {
                actionsCell.appendChild(
                    createActionButton(
                        "Delete",
                        "trash-2",
                        () =>
                            openDeleteAccountModal(
                                learner.id
                            ),
                        true,
                        true
                    )
                );
            }

            row.appendChild(
                rowNumberCell
            );

            row.appendChild(
                studentIdCell
            );

            row.appendChild(
                learnerCell
            );

            row.appendChild(
                emailCell
            );

            row.appendChild(
                programCell
            );
            row.appendChild(
                statusCell
            );

            row.appendChild(
                actionsCell
            );

            tableBody.appendChild(
                row
            );
        });

        emptyState.hidden =
            visibleRows !== 0;

        refreshIcons();
    }

    /* ---------------- RESET PASSWORD ---------------- */

    function openResetPasswordModal(
        accountId
    ) {
        const account =
            getAccountById(accountId);

        if (!account) return;

        resetAccountId =
            account.id;

        resetPasswordDescription.textContent =
            `Generate a new temporary password for ${getLearnerName(account)}.`;

        // Wording follows the account's state.
        const resetHeading = resetPasswordModal.querySelector("h2, h3");
        if (resetHeading) {
            resetHeading.textContent = account.passwordSetupComplete === true
                ? "Reset Password"
                : "New Temporary Password";
        }

        resetPasswordValue.value =
            generateTemporaryPassword();

        resetPasswordModal.hidden = false;

        refreshIcons();
    }

    function closeResetPasswordModal() {
        resetPasswordModal.hidden = true;
        resetAccountId = null;
        resetPasswordValue.value = "";
    }

    async function confirmResetPassword() {
        if (!resetAccountId) return;

        const accounts =
            getAccounts();

        const account =
            accounts.find(
                item =>
                    String(item.id) ===
                    String(resetAccountId)
            );

        if (!account) return;

        if (!account.backendId) {
            alert("This learner is not linked to a saved account. Refresh the page and try again.");
            return;
        }

        const newPassword =
            resetPasswordValue.value.trim();

        if (newPassword.length < 8) {
            alert("The temporary password must be at least 8 characters.");
            return;
        }

        confirmResetPasswordButton.disabled = true;

        try {
            const payload = await learnerAccountsApiRequest(
                `/admin/learners/${encodeURIComponent(account.backendId)}`,
                {
                    method: "PUT",
                    body: JSON.stringify({ password: newPassword })
                }
            );

            closeResetPasswordModal();
            alert(
                `${payload?.message || "The temporary password has been reset."}\n\nNew password: ${newPassword}`
            );
        } catch (error) {
            console.error("Learner password reset failed:", error);
            alert(error.message || "Unable to reset the learner password.");
        } finally {
            confirmResetPasswordButton.disabled = false;
        }
    }

    /* ---------------- TOGGLE ACCOUNT STATUS ---------------- */

    async function toggleAccountStatus(
        accountId
    ) {
        const accounts =
            getAccounts();

        const account =
            accounts.find(
                item =>
                    String(item.id) ===
                    String(accountId)
            );

        if (!account) return;

        const learnerName =
            getLearnerName(account);

        if (!account.backendId) {
            alert("This learner is not linked to a saved account. Refresh the page and try again.");
            return;
        }

        const goingInactive = account.isActive !== false;

        const confirmed =
            window.confirm(
                goingInactive
                    ? `Deactivate the account for ${learnerName}?`
                    : `Activate the account for ${learnerName}?`
            );

        if (!confirmed) return;

        try {
            const payload = await learnerAccountsApiRequest(
                `/admin/learners/${encodeURIComponent(account.backendId)}`,
                {
                    method: "PUT",
                    body: JSON.stringify({ is_active: !goingInactive })
                }
            );

            if (!payload?.success) {
                throw new Error(payload?.message || "The account status was not updated.");
            }

            account.isActive = payload.learner?.is_active !== false;
            account.status = account.isActive ? "active" : "inactive";
            saveAccounts(accounts);
            renderTable();
        } catch (error) {
            console.error("Learner account status update failed:", error);
            alert(error.message || "Unable to update the learner account status.");
        }
    }

    /* ---------------- DELETE LEARNER ---------------- */

    function openDeleteAccountModal(
        learnerId
    ) {
        const learner =
            getLearnerById(learnerId);

        if (!learner) return;

        const account =
            getAccountForLearner(
                learner.id
            );

        deleteLearnerId =
            learner.id;

        const assignedClasses =
            getClassesForLearner(
                learner.id
            );

        const classNames =
            assignedClasses.map(
                classItem =>
                    classItem.classCode ||
                    classItem.name ||
                    "Unnamed Class"
            );

        if (assignedClasses.length === 0) {
            deleteAccountMessage.textContent =
                account
                    ? `Delete the learner record for ${learner.name}? The linked login account will also be deleted.`
                    : `Delete the learner record for ${learner.name}?`;
        } else {
            const classLabel =
                assignedClasses.length ===
                    1
                    ? "class"
                    : "classes";

            deleteAccountMessage.textContent =
                account
                    ? `Delete the learner record for ${learner.name}? The linked login account will also be deleted. This learner is currently assigned to ${assignedClasses.length} ${classLabel}: ${classNames.join(", ")}. Their class memberships will also be removed.`
                    : `Delete the learner record for ${learner.name}? This learner is currently assigned to ${assignedClasses.length} ${classLabel}: ${classNames.join(", ")}. Their class memberships will also be removed.`;
        }

        confirmDeleteCheckbox.checked =
            false;

        confirmDeleteButton.disabled =
            true;

        confirmDeleteButton.innerHTML = `
            <i data-lucide="trash-2"></i>
            <span>Delete Learner</span>
        `;

        deleteAccountModal.hidden =
            false;

        refreshIcons();
    }

    function closeDeleteAccountModal() {
        deleteAccountModal.hidden = true;
        deleteLearnerId = null;
        confirmDeleteCheckbox.checked = false;
        confirmDeleteButton.disabled = true;
    }

    async function confirmDeleteAccount() {
        if (
            !deleteLearnerId ||
            !confirmDeleteCheckbox.checked
        ) {
            return;
        }

        const learnerId =
            deleteLearnerId;

        const learner =
            getLearnerById(
                learnerId
            );

        const accounts =
            getAccounts();

        if (!learner) {
            /*
             * Clean up any orphaned account linked
             * to the learner ID, then refresh.
             */
            saveAccounts(
                accounts.filter(
                    account =>
                        String(
                            account.learnerId
                        ) !==
                        String(
                            learnerId
                        )
                )
            );

            closeDeleteAccountModal();
            renderTable();
            return;
        }

        if (learner.backendAccount) {
            const token = getImportApiToken();

            if (!token) {
                alert("Cannot delete this learner from the server: please sign in again.");
                return;
            }

            const apiBase =
                typeof LEARNER_API_BASE_URL !== "undefined"
                    ? LEARNER_API_BASE_URL
                    : window.SIKNAYAN_API_ROOT;

            try {
                const response = await fetch(
                    `${apiBase}/admin/learners/${encodeURIComponent(learnerId)}`,
                    {
                        method: "DELETE",
                        headers: {
                            "Accept": "application/json",
                            "Authorization": `Bearer ${token}`
                        }
                    }
                );

                let payload = null;
                try {
                    payload = await response.json();
                } catch {
                    payload = null;
                }

                if (!response.ok || payload?.success === false) {
                    throw new Error(
                        payload?.message || `Server deletion failed (${response.status}).`
                    );
                }
            } catch (error) {
                alert(error.message || "The learner could not be deleted.");
                return;
            }
        }


        /* Remove learner from every assigned class. */
        const assignedClasses =
            getClassesForLearner(
                learnerId
            );

        if (assignedClasses.length > 0) {
            saveClassRecords(
                removeLearnerFromClasses(
                    loadClassRecords(),
                    learnerId
                )
            );
        }

        /* Remove learner record + module records. */
        const learnerState =
            loadLearnerState();

        learnerState.learners =
            learnerState.learners.filter(
                item =>
                    String(item.id) !==
                    String(learnerId)
            );

        if (
            learnerState.modules &&
            typeof learnerState.modules ===
                "object"
        ) {
            delete learnerState.modules[
                learnerId
            ];
        }

        saveLearnerState(
            learnerState
        );

        /* Remove all linked accounts. */
        saveAccounts(
            accounts.filter(
                account =>
                    String(
                        account.learnerId
                    ) !==
                    String(
                        learnerId
                    )
            )
        );

        closeDeleteAccountModal();
        renderTable();

        window.showAdminToast("Deleted successfully.");
    }

    /* ---------------- MODAL OUTSIDE CLICK ---------------- */

    [
        accountModal,
        resetPasswordModal,
        deleteAccountModal
    ].forEach(modal => {
        if (!modal) return;

        modal.addEventListener(
            "click",
            event => {
                if (event.target !== modal) return;

                if (
                    modal ===
                    accountModal
                ) {
                    closeAccountModal();
                } else if (
                    modal ===
                    resetPasswordModal
                ) {
                    closeResetPasswordModal();
                } else if (
                    modal ===
                    deleteAccountModal
                ) {
                    closeDeleteAccountModal();
                }
            }
        );
    });

    /* ---------------- EVENTS ---------------- */

    addButton?.addEventListener(
        "click",
        openAddModal
    );

    accountForm?.addEventListener(
        "submit",
        saveAccount
    );

    closeAccountModalButton?.addEventListener(
        "click",
        closeAccountModal
    );

    cancelAccountButton?.addEventListener(
        "click",
        closeAccountModal
    );

    generatePasswordButton?.addEventListener(
        "click",
        () => {
            passwordInput.value =
                generateTemporaryPassword();
        }
    );

    closeResetPasswordButton?.addEventListener(
        "click",
        closeResetPasswordModal
    );

    cancelResetPasswordButton?.addEventListener(
        "click",
        closeResetPasswordModal
    );

    regenerateResetPasswordButton?.addEventListener(
        "click",
        () => {
            resetPasswordValue.value =
                generateTemporaryPassword();
        }
    );

    confirmResetPasswordButton?.addEventListener(
        "click",
        confirmResetPassword
    );

    closeDeleteAccountButton?.addEventListener(
        "click",
        closeDeleteAccountModal
    );

    cancelDeleteAccountButton?.addEventListener(
        "click",
        closeDeleteAccountModal
    );

    confirmDeleteCheckbox?.addEventListener(
        "change",
        () => {
            confirmDeleteButton.disabled =
                !confirmDeleteCheckbox.checked;
        }
    );

    confirmDeleteButton?.addEventListener(
        "click",
        confirmDeleteAccount
    );

    searchInput?.addEventListener(
        "input",
        renderTable
    );

    statusFilter?.addEventListener(
        "change",
        renderTable
    );

    document.addEventListener(
        "keydown",
        event => {
            if (
                event.key !==
                "Escape"
            ) {
                return;
            }

            if (
                accountModal &&
                !accountModal.hidden
            ) {
                closeAccountModal();
            }

            if (
                resetPasswordModal &&
                !resetPasswordModal.hidden
            ) {
                closeResetPasswordModal();
            }

            if (
                deleteAccountModal &&
                !deleteAccountModal.hidden
            ) {
                closeDeleteAccountModal();
            }
        }
    );

    /* Refresh this table when the import handler syncs backend learners. */
    window.addEventListener("siknayan:learners-refreshed", () => {
        syncLearnerAccountCacheFromState();
        renderTable();
        refreshIcons();
    });

    window.addEventListener("siknayan:learners-api-error", event => {
        alert(
            event.detail?.message ||
            "Unable to load learner accounts from Laravel."
        );
    });

    /* ---------------- INITIAL RENDER ---------------- */

    initializeProgramOptions();
    syncLearnerAccountCacheFromState();
    renderTable();
    refreshIcons();

    // learners.js only loads the list from Laravel on the Learners page
    // (it needs that page's table). Load it here too, or this page would
    // show nothing on a browser that never opened the Learners page.
    // The "siknayan:learners-refreshed" listener above re-renders the table.
    if (
        !document.getElementById("learnerTableBody") &&
        typeof syncLearnersFromApi === "function"
    ) {
        syncLearnersFromApi().catch(error => {
            console.error("Learner accounts API load failed:", error);
            window.dispatchEvent(
                new CustomEvent("siknayan:learners-api-error", {
                    detail: { message: error.message }
                })
            );
        });
    }


    /* ---------------- EXCEL LEARNER IMPORT ---------------- */

    const importLearnersExcelButton =
        document.getElementById("importLearnersExcelBtn");
    const learnersExcelFile =
        document.getElementById("learnersExcelFile");
    const downloadLearnerCredentialsAgainButton =
        document.getElementById("downloadLearnerCredentialsAgainBtn");
    const learnerExcelImportStatus =
        document.getElementById("learnerExcelImportStatus");
    const learnerCredentialDownloadDialog =
        document.getElementById("learnerCredentialDownloadDialog");
    const exportLearnerCredentialsExcelButton =
        document.getElementById("exportLearnerCredentialsExcelBtn");
    const exportLearnerCredentialsPdfButton =
        document.getElementById("exportLearnerCredentialsPdfBtn");
    const closeLearnerCredentialDownloadDialogButton =
        document.getElementById("closeLearnerCredentialDownloadDialogBtn");

 let latestImportedLearners = [];
let credentialButtonTimer = null;

if (downloadLearnerCredentialsAgainButton) {
    downloadLearnerCredentialsAgainButton.disabled = true;
}

function enableCredentialDownloadForTwoMinutes() {
    if (!downloadLearnerCredentialsAgainButton) return;

    clearTimeout(credentialButtonTimer);

    downloadLearnerCredentialsAgainButton.disabled = false;

    credentialButtonTimer = setTimeout(() => {
        downloadLearnerCredentialsAgainButton.disabled = true;
        latestImportedLearners = [];
    }, 2 * 60 * 1000);
}

    function getImportApiToken() {
    return (
        sessionStorage.getItem("authToken") ||
        sessionStorage.getItem("token") ||
        localStorage.getItem("siknayan_api_token") ||
        localStorage.getItem("token") ||
        localStorage.getItem("access_token") ||
        window.SIKNAYAN_API_TOKEN ||
        ""
    );
}

    async function learnerAccountsApiRequest(path, options = {}) {
        const token = getImportApiToken();

        if (!token) {
            throw new Error("Your session has expired. Please sign in again.");
        }

        const apiBase =
            typeof LEARNER_API_BASE_URL !== "undefined"
                ? LEARNER_API_BASE_URL
                : window.SIKNAYAN_API_ROOT;
        const headers = {
            Accept: "application/json",
            Authorization: "Bearer " + token,
            ...(options.headers || {})
        };

        if (options.body instanceof FormData) {
            delete headers["Content-Type"];
        } else if (options.body) {
            headers["Content-Type"] = "application/json";
        }

        const response = await fetch(`${apiBase}${path}`, {
            ...options,
            headers
        });

        let payload = null;
        try {
            payload = await response.json();
        } catch {
            payload = null;
        }

        if (!response.ok) {
            const validationErrors = payload?.errors
                ? Object.values(payload.errors).flat().join(" ")
                : "";
            throw new Error(
                validationErrors ||
                payload?.message ||
                `Account request failed (${response.status}).`
            );
        }

        return payload;
    }

    function syncLearnerAccountCacheFromState() {
        const backendLearners = getLearners().filter(
            learner => learner.backendAccount && learner.id
        );
        const backendIds = new Set();
        backendLearners.forEach(learner => {
            backendIds.add(String(learner.id));
            if (learner.schoolId) {
                backendIds.add(String(learner.schoolId));
            }
        });
        const localAccounts = getAccounts().filter(account =>
            !account.backendManaged &&
            !account.backendId &&
            !backendIds.has(String(account.learnerId))
        );
        const backendAccounts = backendLearners.map(learner => ({
            id: createAccountId(learner.id),
            learnerId: String(learner.id),
            backendId: learner.backendId || learner.id,
            email: learner.email || "",
            lastLogin: "Never",
            status: learner.isActive === false ? "inactive" : "active",
            isActive: learner.isActive !== false,
            passwordSetupComplete: learner.passwordSetupComplete === true,
            accountSetUp: learner.accountSetUp === true,
            backendManaged: true
        }));

        saveAccounts([...localAccounts, ...backendAccounts]);
    }

    let learnerExcelImportStatusTimer;

function setExcelImportStatus(message, isError = false) {
    if (!learnerExcelImportStatus) return;

    clearTimeout(learnerExcelImportStatusTimer);

    learnerExcelImportStatus.className =
        `import-status show ${isError ? "error" : "success"}`;

    learnerExcelImportStatus.replaceChildren();

    const icon = document.createElement("span");
    icon.className = "import-status-icon";
    icon.textContent = isError ? "⚠" : "✓";
    icon.setAttribute("aria-hidden", "true");

    const text = document.createElement("span");
    text.textContent = message;

    learnerExcelImportStatus.append(icon, text);
    learnerExcelImportStatus.setAttribute("role", "status");

    learnerExcelImportStatusTimer = setTimeout(() => {
        learnerExcelImportStatus.classList.remove("show");
        learnerExcelImportStatus.replaceChildren();
    }, isError ? 10000 : 5000);
}
    function getCredentialRows() {
        return latestImportedLearners.map(learner => ({
            "Student Name": learner.name ?? "",
            "School ID": learner.school_id ?? "",
            "Email": learner.email ?? "",
            "Program": learner.program ?? "",
            "Temporary Password": learner.temporary_password ?? ""
        }));
    }

    function closeLearnerCredentialDownloadDialog() {
        if (learnerCredentialDownloadDialog) {
            learnerCredentialDownloadDialog.hidden = true;
        }
        // Credentials remain in page memory until a new import or page reload.
    }

    function openLearnerCredentialDownloadDialog() {
        if (
            !learnerCredentialDownloadDialog ||
            !latestImportedLearners.length
        ) {
            return;
        }

        learnerCredentialDownloadDialog.hidden = false;
        refreshIcons();
        closeLearnerCredentialDownloadDialogButton?.focus();
    }
    async function saveCredentialFile(blob, suggestedName, mimeType, extension) {
    const fileName = prompt(
        "Enter a filename for the credentials file:",
        suggestedName.replace(/\.[^.]+$/, "")
    );

    if (fileName === null || !fileName.trim()) return;

    const safeName = fileName.trim().replace(/[<>:"/\\|?*]/g, "_");
    const finalName = safeName.endsWith(`.${extension}`)
        ? safeName
        : `${safeName}.${extension}`;

    // Use Save As to choose both filename and destination folder.
    if (window.showSaveFilePicker) {
        try {
            const handle = await window.showSaveFilePicker({
                suggestedName: finalName,
                types: [{
                    description: `${extension.toUpperCase()} file`,
                    accept: { [mimeType]: [`.${extension}`] }
                }]
            });

            const writable = await handle.createWritable();
            await writable.write(blob);
            await writable.close();
            return true;
        } catch (error) {
            if (error.name === "AbortError") return false;
            throw error;
        }
    }

    // Fallback for browsers without Save As API.
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = finalName;
    link.click();

    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return true;
}
    async function downloadImportedCredentialsExcel() {
        if (!latestImportedLearners.length) {
            setExcelImportStatus("No imported credentials are available to export.", true);
            return;
        }

        if (!window.XLSX) {
            setExcelImportStatus(
                "The Excel export library did not load. Check your internet connection and reload the page.",
                true
            );
            return;
        }

        const worksheet = window.XLSX.utils.json_to_sheet(getCredentialRows());
        worksheet["!cols"] = [
            { wch: 28 },
            { wch: 18 },
            { wch: 32 },
            { wch: 24 },
            { wch: 24 }
        ];

        const workbook = window.XLSX.utils.book_new();
        window.XLSX.utils.book_append_sheet(workbook, worksheet, "Learner Credentials");
        const excelData = window.XLSX.write(workbook, {
    bookType: "xlsx",
    type: "array"
});

const blob = new Blob([excelData], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
});

await saveCredentialFile(
    blob,
    "siknayan-learner-credentials.xlsx",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "xlsx"
);
        closeLearnerCredentialDownloadDialog();
        setExcelImportStatus(
            "Excel credentials file downloaded. Store it securely and share temporary passwords privately."
        );
    }

    async function downloadImportedCredentialsPdf() {
        if (!latestImportedLearners.length) {
            setExcelImportStatus("No imported credentials are available to export.", true);
            return;
        }

        if (!window.jspdf?.jsPDF) {
            setExcelImportStatus(
                "The PDF export library did not load. Check your internet connection and reload the page.",
                true
            );
            return;
        }

        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
        const rows = getCredentialRows();
        const headers = Object.keys(rows[0]);
        const pageWidth = pdf.internal.pageSize.getWidth();
        const margin = 10;
        const widths = [48, 28, 55, 40, 85];
        const rowPadding = 3;
        let y = 29;

        function drawHeader() {
            pdf.setFont("helvetica", "bold");
            pdf.setFontSize(8);
            let x = margin;

            headers.forEach((header, index) => {
                pdf.rect(x, y, widths[index], 9);
                pdf.text(header, x + 2, y + 5.8);
                x += widths[index];
            });

            y += 9;
            pdf.setFont("helvetica", "normal");
        }

        function drawTitle() {
            pdf.setFont("helvetica", "bold");
            pdf.setFontSize(14);
            pdf.text("Learner Temporary Credentials", margin, 14);
            pdf.setFont("helvetica", "normal");
            pdf.setFontSize(8);
            pdf.text(
                "Confidential - distribute credentials securely.",
                margin,
                20
            );
        }

        drawTitle();
        drawHeader();
        pdf.setFontSize(7.5);

        rows.forEach(row => {
            const cells = headers.map((header, index) =>
                pdf.splitTextToSize(String(row[header] ?? ""), widths[index] - 4)
            );
            const lineCount = Math.max(...cells.map(lines => lines.length));
            const rowHeight = Math.max(9, lineCount * 3.5 + rowPadding * 2);

            if (y + rowHeight > 195) {
                pdf.addPage();
                y = 14;
                drawHeader();
                pdf.setFontSize(7.5);
            }

            let x = margin;

            cells.forEach((lines, index) => {
                pdf.rect(x, y, widths[index], rowHeight);
                pdf.text(lines, x + 2, y + rowPadding + 2.5);
                x += widths[index];
            });

            y += rowHeight;
        });

        const pdfBlob = pdf.output("blob");

await saveCredentialFile(
    pdfBlob,
    "Learner-credentials.pdf",
    "application/pdf",
    "pdf"
);
        closeLearnerCredentialDownloadDialog();
        setExcelImportStatus(
            "PDF credentials file downloaded. Store it securely and share temporary passwords privately."
        );
    }

    downloadLearnerCredentialsAgainButton?.addEventListener("click", () => {
        if (!latestImportedLearners.length) {
            setExcelImportStatus(
                "No credentials are available in this page session. Import learners again to generate new credentials.",
                true
            );
            return;
        }
        openLearnerCredentialDownloadDialog();
    });

    importLearnersExcelButton?.addEventListener("click", () => {
        if (learnersExcelFile) learnersExcelFile.click();
    });

    exportLearnerCredentialsExcelButton?.addEventListener(
        "click",
        downloadImportedCredentialsExcel
    );

    exportLearnerCredentialsPdfButton?.addEventListener(
        "click",
        downloadImportedCredentialsPdf
    );

    closeLearnerCredentialDownloadDialogButton?.addEventListener(
        "click",
        closeLearnerCredentialDownloadDialog
    );

    learnerCredentialDownloadDialog?.addEventListener("click", event => {
        if (event.target === learnerCredentialDownloadDialog) {
            closeLearnerCredentialDownloadDialog();
        }
    });

    document.addEventListener("keydown", event => {
        if (
            event.key === "Escape" &&
            learnerCredentialDownloadDialog &&
            !learnerCredentialDownloadDialog.hidden
        ) {
            closeLearnerCredentialDownloadDialog();
        }
    });

    learnersExcelFile?.addEventListener("change", async () => {
        const file = learnersExcelFile.files?.[0];
        if (!file) return;

        closeLearnerCredentialDownloadDialog();
        latestImportedLearners = [];
        if (downloadLearnerCredentialsAgainButton) {
            downloadLearnerCredentialsAgainButton.disabled = true;
        }

        if (!file.name.toLowerCase().endsWith(".xlsx")) {
            setExcelImportStatus(
                "Please select an Excel .xlsx file.",
                true
            );
            learnersExcelFile.value = "";
            return;
        }

        const token = getImportApiToken();

        if (!token) {
            setExcelImportStatus(
                "No API token found. Please sign in again, then retry the import.",
                true
            );
            learnersExcelFile.value = "";
            return;
        }

        if (!window.XLSX) {
            setExcelImportStatus(
                "The Excel library did not load. Check your connection and reload the page.",
                true
            );
            learnersExcelFile.value = "";
            return;
        }

        let importFile = file;
        try {
            const sourceWorkbook = window.XLSX.read(
                await file.arrayBuffer(),
                { type: "array" }
            );
            const sheetNames = sourceWorkbook.SheetNames || [];
            if (!sheetNames.length) {
                throw new Error("The workbook does not contain any worksheets.");
            }

            let selectedNames = [sheetNames[0]];

            if (sheetNames.length > 1) {
                selectedNames = await new Promise(resolve => {
                    const overlay = document.createElement("div");
                    overlay.setAttribute("role", "dialog");
                    overlay.setAttribute("aria-modal", "true");
                    overlay.setAttribute("aria-labelledby", "learnerSheetSelectorTitle");
                    Object.assign(overlay.style, {
                        position: "fixed",
                        inset: "0",
                        zIndex: "10000",
                        background: "rgba(0,0,0,.55)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: "20px"
                    });

                    const panel = document.createElement("div");
                    Object.assign(panel.style, {
                        background: "var(--card-bg, #fff)",
                        color: "var(--text-color, #222)",
                        width: "min(560px, 100%)",
                        maxHeight: "85vh",
                        overflowY: "auto",
                        padding: "24px",
                        borderRadius: "12px",
                        boxShadow: "0 12px 40px rgba(0,0,0,.25)"
                    });

                    const title = document.createElement("h2");
                    title.id = "learnerSheetSelectorTitle";
                    title.textContent = "Choose worksheets to import";

                    const help = document.createElement("p");
                    help.textContent =
                        "Select the worksheets containing learner records. " +
                        "The original workbook will not be changed.";

                    const selectAllLabel = document.createElement("label");
                    Object.assign(selectAllLabel.style, {
                        display: "flex",
                        gap: "10px",
                        alignItems: "center",
                        padding: "10px 0",
                        fontWeight: "600"
                    });

                    const selectAll = document.createElement("input");
                    selectAll.type = "checkbox";
                    selectAllLabel.append(selectAll, document.createTextNode("Select All Worksheets"));

                    const list = document.createElement("div");
                    Object.assign(list.style, {
                        borderTop: "1px solid #ddd",
                        borderBottom: "1px solid #ddd",
                        margin: "8px 0 18px",
                        padding: "8px 0"
                    });

                    const sheetCheckboxes = sheetNames.map(name => {
                        const label = document.createElement("label");
                        Object.assign(label.style, {
                            display: "flex",
                            gap: "10px",
                            alignItems: "center",
                            padding: "9px 0",
                            overflowWrap: "anywhere"
                        });

                        const checkbox = document.createElement("input");
                        checkbox.type = "checkbox";
                        checkbox.checked = true;
                        checkbox.value = name;
                        checkbox.dataset.learnerSheet = "true";

                        label.append(checkbox, document.createTextNode(name));
                        list.append(label);
                        return checkbox;
                    });

                    const actions = document.createElement("div");
                    Object.assign(actions.style, {
                        display: "flex",
                        flexWrap: "wrap",
                        gap: "10px",
                        justifyContent: "flex-end"
                    });

                    const makeButton = (label, primary = false) => {
                        const button = document.createElement("button");
                        button.type = "button";
                        button.textContent = label;
                        Object.assign(button.style, {
                            padding: "10px 14px",
                            borderRadius: "6px",
                            border: "1px solid #aaa",
                            cursor: "pointer",
                            background: primary ? "#2457a7" : "transparent",
                            color: primary ? "#fff" : "inherit"
                        });
                        actions.append(button);
                        return button;
                    };

                    const cancelButton = makeButton("Cancel");
                    const selectedButton = makeButton("Import Selected Sheets", true);
                    const allButton = makeButton("Import All Workbook Sheets");

                    const finish = value => {
                        document.removeEventListener("keydown", onKeydown);
                        overlay.remove();
                        resolve(value);
                    };

                    const syncSelectAll = () => {
                        const checkedCount = sheetCheckboxes.filter(box => box.checked).length;
                        selectAll.checked = checkedCount === sheetCheckboxes.length;
                        selectAll.indeterminate =
                            checkedCount > 0 && checkedCount < sheetCheckboxes.length;
                        selectedButton.disabled = checkedCount === 0;
                    };

                    const onKeydown = event => {
                        if (event.key === "Escape") finish(null);
                    };

                    selectAll.addEventListener("change", () => {
                        sheetCheckboxes.forEach(box => {
                            box.checked = selectAll.checked;
                        });
                        syncSelectAll();
                    });

                    sheetCheckboxes.forEach(box =>
                        box.addEventListener("change", syncSelectAll)
                    );

                    cancelButton.addEventListener("click", () => finish(null));
                    selectedButton.addEventListener("click", () => {
                        finish(sheetCheckboxes.filter(box => box.checked).map(box => box.value));
                    });
                    allButton.addEventListener("click", () => finish([...sheetNames]));
                    overlay.addEventListener("click", event => {
                        if (event.target === overlay) finish(null);
                    });

                    panel.append(title, help, selectAllLabel, list, actions);
                    overlay.append(panel);
                    document.body.append(overlay);
                    document.addEventListener("keydown", onKeydown);
                    syncSelectAll();
                    sheetCheckboxes[0]?.focus();
                });

                if (selectedNames === null) {
                    setExcelImportStatus("Learner import cancelled.");
                    learnersExcelFile.value = "";
                    return;
                }
            }

            if (!selectedNames.length) {
                throw new Error("Select at least one worksheet to import.");
            }

            // Combine selected worksheets into one temporary upload sheet.
            // Header names are matched case-insensitively, so column order
            // can differ between worksheets.
            const normalizeHeader = value =>
                String(value ?? "").trim().replace(/\s+/g, " ").toLowerCase();

            const sheetRows = selectedNames.map(name => {
                const sheet = sourceWorkbook.Sheets[name];
                if (!sheet) {
                    throw new Error(`Could not read worksheet "${name}".`);
                }

                const rows = window.XLSX.utils.sheet_to_json(sheet, {
                    header: 1,
                    defval: "",
                    raw: false
                });

                return { name, rows };
            });

            const headersByKey = new Map();

            sheetRows.forEach(({ rows }) => {
                const headers = rows[0] || [];
                headers.forEach(header => {
                    const key = normalizeHeader(header);
                    if (key && !headersByKey.has(key)) {
                        headersByKey.set(key, String(header).trim());
                    }
                });
            });

            const combinedHeaders = [...headersByKey.values()];
            if (!combinedHeaders.length) {
                throw new Error("The selected worksheets do not contain a header row.");
            }

            const combinedRows = [combinedHeaders];

            sheetRows.forEach(({ name, rows }) => {
                if (rows.length < 2) return;

                const sourceHeaders = rows[0] || [];
                const sourceIndexByKey = new Map();

                sourceHeaders.forEach((header, index) => {
                    const key = normalizeHeader(header);
                    if (key && !sourceIndexByKey.has(key)) {
                        sourceIndexByKey.set(key, index);
                    }
                });

                const sourceHasName = sourceIndexByKey.has("student name");
                const sourceHasSchoolId = sourceIndexByKey.has("school id");

                if (!sourceHasName || !sourceHasSchoolId) {
                    throw new Error(
                        `Worksheet "${name}" must have "Student Name" and "School ID" headers.`
                    );
                }

                rows.slice(1).forEach(row => {
                    if (!row || row.every(value => String(value ?? "").trim() === "")) {
                        return;
                    }

                    combinedRows.push(combinedHeaders.map(header => {
                        const sourceIndex = sourceIndexByKey.get(normalizeHeader(header));
                        return sourceIndex === undefined ? "" : (row[sourceIndex] ?? "");
                    }));
                });
            });

            if (combinedRows.length < 2) {
                throw new Error("The selected worksheets contain no learner records.");
            }

            const selectedWorkbook = window.XLSX.utils.book_new();
            const combinedSheet = window.XLSX.utils.aoa_to_sheet(combinedRows);
            window.XLSX.utils.book_append_sheet(selectedWorkbook, combinedSheet, "Learners");

            const selectedData = window.XLSX.write(selectedWorkbook, {
                bookType: "xlsx",
                type: "array"
            });

            importFile = new File(
                [new Blob([selectedData], {
                    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                })],
                `${file.name.replace(/\.xlsx$/i, "")}-selected-sheets.xlsx`,
                { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }
            );
        } catch (error) {
            console.error("Could not prepare selected worksheet:", error);
            setExcelImportStatus(error.message || "Could not read the selected worksheet.", true);
            learnersExcelFile.value = "";
            return;
        }

        const formData = new FormData();
        formData.append("file", importFile);

        importLearnersExcelButton.disabled = true;
        importLearnersExcelButton.textContent = "Importing...";
        setExcelImportStatus("Uploading and validating the selected worksheet...");

        try {
            const apiBase =
                typeof LEARNER_API_BASE_URL !== "undefined"
                    ? LEARNER_API_BASE_URL
                    : window.SIKNAYAN_API_ROOT;

            const response = await fetch(
                `${apiBase}/admin/learners/import`,
                {
                    method: "POST",
                    headers: {
                        "Accept": "application/json",
                        "Authorization": `Bearer ${token}`
                    },
                    body: formData
                }
            );

            let payload = null;
            try {
                payload = await response.json();
            } catch {
                payload = null;
            }

 if (!response.ok || !payload?.success) {
    let details = "";

    if (Array.isArray(payload?.errors)) {
        details = payload.errors.map(error =>
            `Row ${error.row ?? "?"}: ${error.message ?? "Invalid data."}`
        ).join("\n");
    } else if (payload?.errors && typeof payload.errors === "object") {
        details = Object.entries(payload.errors)
            .map(([field, messages]) =>
                `${field}: ${
                    Array.isArray(messages)
                        ? messages.join(", ")
                        : String(messages)
                }`
            )
            .join("\n");
    }

    throw new Error(
        [
            payload?.message || `Import failed (${response.status}).`,
            details
        ].filter(Boolean).join("\n")
    );
}

            latestImportedLearners = Array.isArray(payload.learners)
                ? payload.learners
                : [];

            // Make credentials available before refreshing the display list.
            // This prevents a refresh failure from stranding valid credentials.
            const credentialsAreComplete =
                latestImportedLearners.length > 0 &&
                latestImportedLearners.every(learner =>
                    String(learner?.temporary_password ?? "").trim().length > 0
                );

            if (credentialsAreComplete) {
                if (downloadLearnerCredentialsAgainButton) {
                    downloadLearnerCredentialsAgainButton.disabled = false;
                }

                const emailSummary = payload.email_summary ?? {};
                const emailMessage = [
                    `Email transport accepted: ${Number(emailSummary.sent ?? 0)}`,
                    `Skipped (no email): ${Number(emailSummary.skipped_no_email ?? 0)}`,
                    `Failed: ${Number(emailSummary.failed ?? 0)}`,
                    `Not configured: ${Number(emailSummary.not_configured ?? 0)}`
                ].join(" | ");

                setExcelImportStatus(
    `${payload.imported_count ?? latestImportedLearners.length} learner account(s) imported successfully.`
);
                enableCredentialDownloadForTwoMinutes();
                openLearnerCredentialDownloadDialog();
            } else {
                latestImportedLearners = [];

                if (downloadLearnerCredentialsAgainButton) {
                    downloadLearnerCredentialsAgainButton.disabled = true;
                }

                setExcelImportStatus(
                    "The import response did not include complete temporary credentials. No credential download is available.",
                    true
                );
            }

            /*
             * Refresh the display list from Laravel.
             * Temporary passwords are deliberately excluded from storage.
             */
            const learnersResponse = await fetch(
                `${apiBase}/admin/learners`,
                {
                    method: "GET",
                    headers: {
                        "Accept": "application/json",
                        "Authorization": `Bearer ${token}`
                    }
                }
            );

            if (!learnersResponse.ok) {
                throw new Error(
                    "Import succeeded, but refreshing the Learners table failed. Reload the page and check the backend connection."
                );
            }

            const learnersPayload = await learnersResponse.json();

            if (!Array.isArray(learnersPayload?.learners)) {
                throw new Error(
                    "Import succeeded, but the backend returned an unexpected learner list."
                );
            }

            const learnerStorageKey =
                "siknayan_academic_admin_learners";

            let storedState = {
                version: "v5",
                learners: [],
                modules: {}
            };

            try {
                const storedValue = localStorage.getItem(learnerStorageKey);
                if (storedValue) {
                    const parsed = JSON.parse(storedValue);
                    if (Array.isArray(parsed?.learners)) {
                        storedState = {
                            version: parsed.version || "v5",
                            learners: parsed.learners,
                            modules: parsed.modules || {}
                        };
                    } else if (Array.isArray(parsed)) {
                        storedState.learners = parsed;
                    }
                }
            } catch (storageError) {
                console.warn("Could not read previous learner display data.", storageError);
            }

            const backendLearners = learnersPayload.learners.map(learner => ({
                id: String(learner.id),
                name: learner.name || "Unnamed Learner",
                email: learner.email || "",
                schoolId: learner.school_id || "",
                program: learner.program || "",
                modulesAssigned: Number(learner.modules_assigned || 0),
                progress: learner.progress ?? null,
                status: learner.status || "Active",
                passwordSetupComplete:
                    Boolean(learner.password_setup_complete),
                // Set up once: the server refuses to delete it.
                accountSetUp:
                    Boolean(learner.account_set_up),
                isActive:
                    learner.is_active !== false,
                lastActivity: learner.last_activity || "Never",
                backendAccount: true
            }));

            const backendIds = new Set(
                backendLearners.map(learner => String(learner.id))
            );

            const localOnlyLearners = storedState.learners.filter(
                learner => !backendIds.has(String(learner.id))
            );

            localStorage.setItem(
                learnerStorageKey,
                JSON.stringify({
                    version: storedState.version || "v5",
                    learners: [...backendLearners, ...localOnlyLearners],
                    modules: storedState.modules || {}
                })
            );

            window.dispatchEvent(
                new Event("siknayan:learners-refreshed")
            );

        } catch (error) {
            console.error("Excel learner import failed:", error);
            setExcelImportStatus(
                error.message || "Unable to import the spreadsheet.",
                true
            );
        } finally {
            importLearnersExcelButton.disabled = false;
            importLearnersExcelButton.innerHTML =
                '<i data-lucide="file-spreadsheet"></i> Import Learners from Excel';
            learnersExcelFile.value = "";
            refreshIcons();
        }
    });


})();
