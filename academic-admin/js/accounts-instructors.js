/* =========================================================
   SIKNAYAN - INSTRUCTOR ACCOUNTS
   ---------------------------------------------------------
   Instructor-centered account management.

   One instructor is the primary record.
   Account information is attached to that instructor when
   access has been created.
========================================================= */

(
    function initInstructorAccountsPage() {

    const page =
        document.querySelector(
            ".instructor-accounts-page"
        );

    if (!page) {
        return;
    }



    /* =====================================================
       STORAGE
    ===================================================== */

    const INSTRUCTOR_STORAGE_KEY =
        "siknayan_academic_admin_instructors";

    const CLASS_STORAGE_KEY =
        "siknayan_academic_admin_classes";

    const ACCOUNT_STORAGE_KEY =
        "siknayan_academic_admin_instructor_accounts";


const INSTRUCTOR_API_BASE_URL =
    window.SIKNAYAN_API_ROOT;

const INSTRUCTOR_API_TOKEN_KEY =
    "siknayan_api_token";

function getInstructorApiToken() {
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

async function instructorApiRequest(path, options = {}) {
    const token = getInstructorApiToken();

    if (!token) {
        throw new Error(
            "No API token found. Please log in again."
        );
    }

    const headers = {
        Accept: "application/json",
        ...(options.headers || {}),
        Authorization: `Bearer ${token}`
    };

    if (options.body instanceof FormData) {
        delete headers["Content-Type"];
    } else {
        headers["Content-Type"] = "application/json";
    }

    const response = await fetch(
        `${INSTRUCTOR_API_BASE_URL}${path}`,
        {
            ...options,
            headers
        }
    );

    let payload = null;

    try {
        payload = await response.json();
    } catch {
        payload = null;
    }

    if (!response.ok) {
        const validationErrors = Array.isArray(payload?.errors)
            ? payload.errors.map(item =>
                `${item.sheet ? `Sheet "${item.sheet}", row` : "Row"} ${item.row ?? "?"}: ${item.message || "Invalid data."}`
            ).join(" ")
            : payload?.errors
                ? Object.values(payload.errors).flat().join(" ")
                : "";

        throw new Error(
            validationErrors ||
            payload?.message ||
            `API request failed (${response.status}).`
        );
    }

    return payload;
}
    /* =====================================================
       ELEMENTS
    ===================================================== */

    const tableBody =
        document.getElementById(
            "instructorAccountsTableBody"
        );

    const emptyState =
        document.getElementById(
            "instructorAccountsEmpty"
        );

    const searchInput =
        document.getElementById(
            "instructorAccountSearch"
        );

    const statusFilter =
        document.getElementById(
            "instructorAccountStatusFilter"
        );

    const addButton =
        document.getElementById(
            "addInstructorAccountBtn"
        );

const importInstructorsExcelBtn =
    document.getElementById("importInstructorsExcelBtn");


    const instructorsExcelFile =
    document.getElementById("instructorsExcelFile");

const downloadInstructorCredentialsBtn =
    document.getElementById("downloadInstructorCredentialsBtn");

const downloadInstructorCredentialsPdfBtn =
    document.getElementById("downloadInstructorCredentialsPdfBtn");

let latestInstructorCredentials = [];
let instructorCredentialsExpiryTimer = null;

    /* =====================================================
       ADD / EDIT MODAL
    ===================================================== */

    const accountModal =
        document.getElementById(
            "instructorAccountModal"
        );

    const accountModalTitle =
        document.getElementById(
            "instructorAccountModalTitle"
        );

    const accountModalDescription =
        document.getElementById(
            "instructorAccountModalDescription"
        );

    const closeAccountModalButton =
        document.getElementById(
            "closeInstructorAccountModal"
        );

    const cancelAccountButton =
        document.getElementById(
            "cancelInstructorAccount"
        );

    const accountForm =
        document.getElementById(
            "instructorAccountForm"
        );

    const accountEditId =
        document.getElementById(
            "instructorAccountEditId"
        );

    const instructorIdInput =
        document.getElementById(
            "instructorAccountId"
        );

    const instructorNameInput =
        document.getElementById(
            "instructorAccountName"
        );

    // The form has no email field (people add their own after first
    // login); this blank stand-in keeps the old form code working.
    const emailInput =
        document.getElementById(
            "instructorAccountEmail"
        ) ||
        document.createElement("input");

    const passwordInput =
        document.getElementById(
            "instructorAccountPassword"
        );

    const generatePasswordButton =
        document.getElementById(
            "generateInstructorPasswordBtn"
        );




    /* =====================================================
       RESET PASSWORD MODAL
    ===================================================== */

    const resetPasswordModal =
        document.getElementById(
            "resetInstructorPasswordModal"
        );

    const resetPasswordDescription =
        document.getElementById(
            "resetInstructorPasswordDescription"
        );

    const closeResetPasswordButton =
        document.getElementById(
            "closeResetInstructorPasswordModal"
        );

    const cancelResetPasswordButton =
        document.getElementById(
            "cancelResetInstructorPassword"
        );

    const resetPasswordValue =
        document.getElementById(
            "resetInstructorPasswordValue"
        );

    const regenerateResetPasswordButton =
        document.getElementById(
            "regenerateResetInstructorPassword"
        );
        
    const confirmResetPasswordButton =
    document.getElementById(
        "confirmResetInstructorPassword"
    );

    /* =====================================================
       DELETE MODAL
    ===================================================== */

    const deleteAccountModal =
        document.getElementById(
            "deleteInstructorAccountModal"
        );

    const deleteAccountMessage =
        document.getElementById(
            "deleteInstructorAccountMessage"
        );

    const closeDeleteAccountButton =
        document.getElementById(
            "closeDeleteInstructorAccountModal"
        );

    const cancelDeleteAccountButton =
        document.getElementById(
            "cancelDeleteInstructorAccount"
        );

    const confirmDeleteCheckbox =
        document.getElementById(
            "confirmDeleteInstructorAccount"
        );

    const confirmDeleteButton =
        document.getElementById(
            "confirmDeleteInstructorAccountBtn"
        );



    /* =====================================================
       STATE
    ===================================================== */

    let editingId =
        null;

    let resetAccountId =
        null;

    let deleteInstructorId =
        null;



    /* =====================================================
       HELPERS
    ===================================================== */

    function escapeHtml(
        value
    ) {

        return String(
            value ?? ""
        )
            .replaceAll(
                "&",
                "&amp;"
            )
            .replaceAll(
                "<",
                "&lt;"
            )
            .replaceAll(
                ">",
                "&gt;"
            )
            .replaceAll(
                '"',
                "&quot;"
            )
            .replaceAll(
                "'",
                "&#039;"
            );

    }



    function refreshPageIcons() {

        if (
            typeof lucide !==
            "undefined"
        ) {

            lucide.createIcons();

        }

    }

    async function syncInstructorsFromApi() {

        const payload =
            await instructorApiRequest(
                "/admin/instructors"
            );

        const apiInstructors =
            Array.isArray(payload?.instructors)
                ? payload.instructors
                : [];

        const instructors =
            apiInstructors.map(
                instructor => ({

                    id:
                        instructor.school_id ||
                        instructor.id,

                    backendId:
                        instructor.id,

                    name:
                        instructor.name ||
                        "Unnamed Instructor",

                    email:
                        instructor.email ||
                        "",

                    schoolId:
                        instructor.school_id ||
                        "",

                    program:
                        instructor.program ||
                        "",

                    contact:
                        instructor.contact ||
                        "",

                    status:
                        !instructor.password_setup_complete
                            ? "not-set-up"
                            : instructor.is_active === false
                                ? "inactive"
                                : "active",

                    passwordSetupComplete:
                        Boolean(
                            instructor.password_setup_complete
                        ),

                    // Set up once: the server refuses to delete it.
                    accountSetUp:
                        Boolean(instructor.account_set_up),

                    isActive:
                        instructor.is_active !== false

                })
            );

        saveInstructors(
            instructors
        );

        /*
         * Build the account view from the
         * Laravel instructor records.
         *
         * Do NOT store passwords.
         */
        const accounts =
            apiInstructors.map(
                instructor => ({

                    id:
                        `instructor-account-${instructor.id}`,

                    instructorId:
                        instructor.school_id ||
                        instructor.id,

                    backendId:
                        instructor.id,

                    email:
                        instructor.email ||
                        "",

                    lastLogin:
                        "Never",

                    status:
                        !instructor.password_setup_complete
                            ? "not-set-up"
                            : instructor.is_active === false
                                ? "inactive"
                                : "active",

                    isActive:
                        instructor.is_active !== false,

                    passwordSetupComplete:
                        Boolean(instructor.password_setup_complete),

                    accountSetUp:
                        Boolean(instructor.account_set_up),

                    backendManaged:
                        true

                })
            );

        saveAccounts(
            accounts
        );

        return instructors;

    }
    


    function generateTemporaryPassword() {

        // 8 characters, no look-alikes (0/O/o, 1/l/I), secure random.
        const characters =
            "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";

        const random = new Uint32Array(8);
        window.crypto.getRandomValues(random);

        let password =
            "";

        random.forEach(value => {
            password += characters[value % characters.length];
        });


        return password;

    }



    /* =====================================================
       INSTRUCTOR STORAGE
    ===================================================== */

    function loadInstructors() {

        try {

            const stored =
                localStorage.getItem(
                    INSTRUCTOR_STORAGE_KEY
                );


            if (stored) {

                const parsed =
                    JSON.parse(
                        stored
                    );


                if (
                    Array.isArray(
                        parsed
                    )
                ) {

                    return parsed;

                }

            }

        } catch (error) {

            console.error(
                "Instructor storage error:",
                error
            );

        }


        /*
         * Only use class data as a fallback
         * when instructor records do not exist.
         */

        const classes =
            loadClasses();

        const instructors =
            [];


        classes.forEach(
            classItem => {

                if (
                    !classItem.instructorId
                ) {

                    return;

                }


                const exists =
                    instructors.some(
                        instructor =>
                            String(
                                instructor.id
                            ) ===
                            String(
                                classItem.instructorId
                            )
                    );


                if (exists) {

                    return;

                }


                instructors.push({

                    id:
                        classItem.instructorId,

                    name:
                        classItem.instructorName ||
                        "Unnamed Instructor",

                    status:
                        "active"

                });

            }
        );


        if (
            instructors.length
        ) {

            saveInstructors(
                instructors
            );

        }


        return instructors;

    }



    function saveInstructors(
        instructors
    ) {

        localStorage.setItem(
            INSTRUCTOR_STORAGE_KEY,
            JSON.stringify(
                instructors
            )
        );

    }



    /* =====================================================
       CLASS STORAGE
    ===================================================== */

    function loadClasses() {

        try {

            const stored =
                localStorage.getItem(
                    CLASS_STORAGE_KEY
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
                "Class storage error:",
                error
            );

            return [];

        }

    }



    function saveClasses(
        classes
    ) {

        localStorage.setItem(
            CLASS_STORAGE_KEY,
            JSON.stringify(
                classes
            )
        );

    }



    /* =====================================================
       ACCOUNT STORAGE
    ===================================================== */

    function getAccounts() {

        try {

            const stored =
                localStorage.getItem(
                    ACCOUNT_STORAGE_KEY
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
                "Instructor account storage error:",
                error
            );

            return [];

        }

    }



    function saveAccounts(
        accounts
    ) {

        const safeAccounts =
            accounts.map(account => {
                const safeAccount = { ...account };
                delete safeAccount.password;
                return safeAccount;
            });

        localStorage.setItem(
            ACCOUNT_STORAGE_KEY,
            JSON.stringify(
                safeAccounts
            )
        );

    }



    function getAccountById(
        accountId
    ) {

        return getAccounts().find(
            account =>
                account.id ===
                accountId
        );

    }



    function getAccountForInstructor(
        instructorId
    ) {

        return getAccounts().find(
            account =>
                String(
                    account.instructorId
                ) ===
                String(
                    instructorId
                )
        );

    }



    function getInstructorById(
        instructorId
    ) {

        return loadInstructors().find(
            instructor =>
                String(
                    instructor.id
                ) ===
                String(
                    instructorId
                )
        );

    }



    /* =====================================================
       CLASS RELATIONSHIP HELPERS
    ===================================================== */

    function getAssignedClasses(
        instructorId
    ) {

        return loadClasses().filter(
            classItem =>
                String(
                    classItem.instructorId
                ) ===
                String(
                    instructorId
                )
        );

    }



    function removeInstructorFromClasses(
        classes,
        instructorId
    ) {

        return classes.map(
            classItem => {

                if (
                    String(
                        classItem.instructorId
                    ) !==
                    String(
                        instructorId
                    )
                ) {

                    return classItem;

                }


                return {

                    ...classItem,

                    instructorId:
                        "",

                    instructorName:
                        "Unassigned"

                };

            }
        );

    }



    function getClassDisplayName(
        classItem
    ) {

        return (
            classItem.classCode ||
            classItem.courseCode ||
            classItem.name ||
            classItem.title ||
            "Unnamed Class"
        );

    }



    /* =====================================================
       DISPLAY HELPERS
    ===================================================== */

    function getDisplayStatus(
        status
    ) {

        const normalized =
            String(
                status ||
                ""
            ).toLowerCase();


        if (
            normalized ===
            "active"
        ) {

            return "Active";

        }


        if (
            normalized ===
            "inactive"
        ) {

            return "Inactive";

        }


        return "Not Set Up";

    }



    function getStatusClass(
        status
    ) {

        const normalized = String(status || "").toLowerCase();

        if (normalized === "active") {
            return "status-active";
        }

        if (normalized === "inactive") {
            return "status-inactive";
        }

        return "status-pending";

    }



    function getInstructorName(
        account
    ) {

        const instructor =
            getInstructorById(
                account.instructorId
            );


        return (
            instructor?.name ||
            account.instructorName ||
            "Unknown Instructor"
        );

    }



    function createAccountId(
        instructorId
    ) {

        return (
            `instructor-account-${String(
                instructorId
            ).replace(
                /[^a-zA-Z0-9_-]/g,
                "-"
            )}`
        );

    }



    /* =====================================================
       OPEN ADD MODAL
    ===================================================== */

    function openAddModal() {

        editingId =
            null;


        accountEditId.value =
            "";


        accountModalTitle.textContent =
            "Add Instructor Account";


        accountModalDescription.textContent =
            "Create a new instructor and account.";


        // The admin types the Instructor ID (no automatic INS-number).
        instructorIdInput.value =
            "";


        instructorNameInput.value =
            "";


        emailInput.value =
            "";


        passwordInput.value =
            generateTemporaryPassword();
        passwordInput.required = true;
        passwordInput.placeholder = "";




        instructorIdInput.readOnly =
            false;


        instructorNameInput.readOnly =
            false;


        emailInput.readOnly =
            false;


        instructorIdInput.classList.remove(
            "readonly"
        );


        instructorNameInput.classList.remove(
            "readonly"
        );




        accountModal.hidden =
            false;


        refreshPageIcons();


        instructorNameInput.focus();

    }



    /* =====================================================
       CREATE ACCOUNT FOR EXISTING INSTRUCTOR
    ===================================================== */

    function openAddModalForInstructor(
        instructorId
    ) {

        const instructor =
            getInstructorById(
                instructorId
            );


        if (!instructor) {

            return;

        }


        if (
            getAccountForInstructor(
                instructor.id
            )
        ) {

            return;

        }


        editingId =
            null;


        accountEditId.value =
            "";


        accountModalTitle.textContent =
            "Create Instructor Account";


        accountModalDescription.textContent =
            `Create an account for ${instructor.name}.`;


        instructorIdInput.value =
            instructor.id;


        instructorNameInput.value =
            instructor.name;


        emailInput.value =
            "";


        passwordInput.value =
            generateTemporaryPassword();
        passwordInput.required = true;
        passwordInput.placeholder = "";




        instructorIdInput.readOnly =
            true;


        instructorNameInput.readOnly =
            true;


        emailInput.readOnly =
            false;




        accountModal.hidden =
            false;


        refreshPageIcons();


        emailInput.focus();

    }



    /* =====================================================
       OPEN EDIT MODAL
    ===================================================== */

    function openEditModal(
        accountId
    ) {

        const account =
            getAccountById(
                accountId
            );


        if (!account) {

            return;

        }


        const instructor =
            getInstructorById(
                account.instructorId
            );


        if (!instructor) {

            return;

        }


        editingId =
            account.id;


        accountEditId.value =
            account.id;


        accountModalTitle.textContent =
            "Edit Instructor Account";


        accountModalDescription.textContent =
            "Update the instructor account details.";


        instructorIdInput.value =
            instructor.id;


        instructorNameInput.value =
            instructor.name;


        emailInput.value =
            account.email ||
            "";


        passwordInput.value = "";
        passwordInput.required = false;
        passwordInput.placeholder = "Leave blank to keep the current password";

        // The admin can change the Instructor ID and the name.
        instructorIdInput.readOnly =
            false;


        instructorNameInput.readOnly =
            false;


        emailInput.readOnly =
            false;




        accountModal.hidden =
            false;


        refreshPageIcons();

    }



    /* =====================================================
       CLOSE ACCOUNT MODAL
    ===================================================== */

    function closeAccountModal() {

        accountModal.hidden =
            true;


        editingId =
            null;


        if (
            accountForm
        ) {

            accountForm.reset();

        }


        accountEditId.value =
            "";


        instructorIdInput.readOnly =
            false;


        instructorNameInput.readOnly =
            false;



    }



    /* =====================================================
       SAVE ACCOUNT
    ===================================================== */

       async function saveAccount(
        event
    ) {

        event.preventDefault();

        const instructorId =
            instructorIdInput.value
                .trim();

        const instructorName =
            instructorNameInput.value
                .trim();

        const email =
            emailInput.value
                .trim()
                .toLowerCase();

        const password =
            passwordInput.value
                .trim();

        // New accounts start active; Activate/Deactivate is in the table.
        const status = "active";

        const isEditing =
            Boolean(editingId);


        /*
         * Instructor ID and name are always required; email is
         * optional. Password is required only when creating a new
         * instructor account. Laravel handles hashing.
         */
        if (
            !instructorId ||
            !instructorName ||
            (!isEditing && !password)
        ) {

            alert(
                "Please complete all required fields."
            );

            return;

        }


        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            alert("Please enter a valid email address, or leave it blank.");
            return;
        }


        if (
            !isEditing &&
            password.length < 8
        ) {

            alert(
                "Password must be at least 8 characters."
            );

            return;

        }


        /*
         * Prevent duplicate email addresses in the
         * currently synchronized instructor records.
         * A blank email is never a duplicate (many
         * instructors have no email).
         */
        const accounts =
            getAccounts();

        const duplicateEmail =
            Boolean(email) &&
            accounts.some(
                account =>
                    String(
                        account.email ||
                        ""
                    ).toLowerCase() ===
                    email &&
                    account.id !==
                    editingId
            );


        if (
            duplicateEmail
        ) {

            alert(
                "That email address is already being used by another instructor account."
            );

            return;

        }


        let savedToApi = false;

        try {

            /* =================================================
               EDIT EXISTING INSTRUCTOR
            ================================================== */

            if (
                isEditing
            ) {

                const account =
                    accounts.find(
                        item =>
                            item.id ===
                            editingId
                    );


                const backendId =
                    account?.backendId;


                if (
                    !backendId
                ) {

                    throw new Error(
                        "This instructor is not linked to a Laravel account. Refresh the page and try again."
                    );

                }


                const requestData = {
                    school_id:
                        instructorId,

                    // No email: only the instructor can set it.
                    name:
                        instructorName
                };


                /*
                 * Only send a password when the administrator
                 * actually entered one during editing.
                 */
                if (
                    password
                ) {

                    if (
                        password.length < 8
                    ) {

                        alert(
                            "Password must be at least 8 characters."
                        );

                        return;

                    }

                    requestData.password =
                        password;

                }


                const payload =
                    await instructorApiRequest(
                        `/admin/instructors/${backendId}`,
                        {
                            method:
                                "PUT",

                            body:
                                JSON.stringify(
                                    requestData
                                )
                        }
                    );

                savedToApi = true;

                /*
                 * Re-sync from Laravel so the UI reflects
                 * the actual database state.
                 */
                await syncInstructorsFromApi();

                closeAccountModal();

                renderTable();

                refreshPageIcons();

                alert(
                    payload?.message ||
                    "Instructor updated successfully."
                );

                return;

            }


            /* =================================================
               CREATE NEW INSTRUCTOR
            ================================================== */

            const payload =
                await instructorApiRequest(
                    "/admin/instructors",
                    {
                        method:
                            "POST",

                        body:
                            JSON.stringify({
                                name:
                                    instructorName,

                                school_id:
                                    instructorId,

                                password:
                                    password,

                                is_active:
                                    status === "active"
                            })
                    }
                );

                savedToApi = true;

                /*
                 * Laravel is now the source of truth.
             * Do not store the submitted password.
             */
            await syncInstructorsFromApi();

            closeAccountModal();

            renderTable();

            refreshPageIcons();


            alert(
                payload?.message ||
                `Instructor account created for ${instructorName}.`
            );

        } catch (
            error
        ) {

            console.error(
                "Instructor save failed:",
                error
            );

            alert(
                savedToApi
                    ? "The instructor account was saved, but the list could not be refreshed. Reload the page to verify the latest data."
                    : error.message || "Unable to save instructor."
            );

        }

    }


    async function toggleAccountStatus(accountId) {
        const accounts = getAccounts();
        const account = accounts.find(item => item.id === accountId);

        if (!account) {
            return;
        }

        if (!account.backendId) {
            alert("This instructor is not linked to a saved account. Refresh the page and try again.");
            return;
        }

        const deactivate = account.isActive !== false;
        const instructorName = getInstructorName(account);
        const confirmed = await window.SiknayanDialog.confirm(
            deactivate
                ? `Deactivate the account for ${instructorName}? They will not be able to sign in until it is activated again.`
                : `Activate the account for ${instructorName}? They will be able to sign in again.`,
            {
                title: deactivate ? "Deactivate account" : "Activate account",
                confirmText: deactivate ? "Deactivate" : "Activate",
                danger: deactivate
            }
        );

        if (!confirmed) {
            return;
        }

        try {
            const payload = await instructorApiRequest(
                `/admin/instructors/${encodeURIComponent(account.backendId)}`,
                {
                    method: "PUT",
                    body: JSON.stringify({ is_active: !deactivate })
                }
            );

            if (!payload?.success) {
                throw new Error(payload?.message || "The account status was not updated.");
            }

            account.isActive = payload.instructor?.is_active !== false;
            account.status = account.isActive ? "active" : "inactive";
            saveAccounts(accounts);
            renderTable();

            alert(
                account.isActive
                    ? `The account for ${instructorName} was activated.`
                    : `The account for ${instructorName} was deactivated.`
            );
        } catch (error) {
            console.error("Instructor account status update failed:", error);
            alert(error.message || "Unable to update the instructor account status.");
        }
    }



    /* =====================================================
       RENDER TABLE
    ===================================================== */

    function renderTable() {

        if (!tableBody) {

            return;

        }


        const instructors =
            loadInstructors();


        const query =
            searchInput?.value
                .trim()
                .toLowerCase() ||
            "";


        const selectedStatus =
            statusFilter?.value ||
            "all";


        const rows =
            [];


        /*
         * The instructor is the row entity.
         * Account data is attached to the instructor
         * when access has been created.
         */

        instructors.forEach(
            instructor => {

                const account =
                    getAccountForInstructor(
                        instructor.id
                    );


                const assignedClasses =
                    getAssignedClasses(
                        instructor.id
                    );


                const accountStatus =
                    account
                        ? String(
                            account.status ||
                            "active"
                        ).toLowerCase()
                        : "not-set-up";


                const searchableText = [

                    instructor.id,

                    instructor.name,

                    account?.email,

                    ...assignedClasses.map(
                        getClassDisplayName
                    )

                ]
                    .join(" ")
                    .toLowerCase();


                if (
                    query &&
                    !searchableText.includes(
                        query
                    )
                ) {

                    return;

                }


                if (
                    selectedStatus !==
                    "all" &&
                    accountStatus !==
                    selectedStatus
                ) {

                    return;

                }


                rows.push({

                    instructor,

                    account,

                    assignedClasses,

                    accountStatus

                });

            }
        );


        tableBody.innerHTML =
            "";


        if (
            emptyState
        ) {

            emptyState.hidden =
                rows.length !==
                0;

        }



        /* =================================================
           RENDER EACH INSTRUCTOR
        ================================================== */

        rows.forEach(
            ({
                instructor,
                account,
                assignedClasses,
                accountStatus
            }, rowIndex) => {

                const row =
                    document.createElement(
                        "tr"
                    );


                row.className =
                    "learner-account-row";


                const rowNumberCell =
                    document.createElement(
                        "td"
                    );

                rowNumberCell.className =
                    "row-number";

                rowNumberCell.textContent =
                    String(rowIndex + 1);



                /* -----------------------------------------
                   INSTRUCTOR ID
                ----------------------------------------- */

                const instructorIdCell =
                    document.createElement(
                        "td"
                    );

                instructorIdCell.className =
                    "student-id";


               instructorIdCell.textContent =
                    instructor.schoolId ||
                    instructor.id;


                /* -----------------------------------------
                   INSTRUCTOR
                ----------------------------------------- */

                const instructorCell =
                    document.createElement(
                        "td"
                    );


                instructorCell.className =
                    "learner-account-name";


                instructorCell.innerHTML =
                    `
                    <strong>
                        ${escapeHtml(
                            instructor.name
                        )}
                    </strong>
                    `;



                /* -----------------------------------------
                   EMAIL
                ----------------------------------------- */

                const emailCell =
                    document.createElement(
                        "td"
                    );


                emailCell.className =
                    "learner-account-email";


                // Blank when the instructor has no email.
                emailCell.textContent =
                    account?.email ||
                    "";



                /* -----------------------------------------
                   ASSIGNED CLASSES
                ----------------------------------------- */

                const classesCell =
                    document.createElement(
                        "td"
                    );


                if (
                    assignedClasses.length ===
                    0
                ) {

                    classesCell.textContent =
                        "No classes";

                } else if (
                    assignedClasses.length ===
                    1
                ) {

                    classesCell.textContent =
                        getClassDisplayName(
                            assignedClasses[0]
                        );

                } else {

                    classesCell.textContent =
                        `${assignedClasses.length} classes`;

                }


                /* -----------------------------------------
                   STATUS
                ----------------------------------------- */

                const statusCell =
                    document.createElement(
                        "td"
                    );


                const statusBadge =
                    document.createElement(
                        "span"
                    );


                statusBadge.className =
                    `status-badge ${getStatusClass(
                        accountStatus
                    )}`;


                statusBadge.textContent =
                    getDisplayStatus(
                        accountStatus
                    );


                statusCell.appendChild(
                    statusBadge
                );



                /* -----------------------------------------
                   ACTIONS
                ----------------------------------------- */

                const actionsCell =
                    document.createElement(
                        "td"
                    );


                actionsCell.className =
                    "learner-account-actions";



                /*
                 * No account yet.
                 */

                if (
                    !account
                ) {

                    actionsCell.appendChild(

                        createActionButton(

                            "Create Account",

                            "user-plus",

                            () =>
                                openAddModalForInstructor(
                                    instructor.id
                                )

                        )

                    );


                    actionsCell.appendChild(

                        createActionButton(

                            "Delete",

                            "trash-2",

                            () =>
                                openDeleteInstructorModal(
                                    instructor.id
                                ),

                            true,

                            true

                        )

                    );

                }



                /*
                 * Existing account.
                 */

                else {

                    actionsCell.appendChild(

                        createActionButton(

                            "Edit",

                            "pencil",

                            () =>
                                openEditModal(
                                    account.id
                                ),

                            false,

                            true

                        )

                    );


                    // Same as the learner table:
                    //   Inactive   -> Activate
                    //   Not Set Up -> nothing extra
                    //   Active     -> Deactivate
                    // A new password can be set in Edit (Temporary Password).
                    if (account.isActive === false) {
                        actionsCell.appendChild(
                            createActionButton(
                                "Activate",
                                "user-check",
                                () => toggleAccountStatus(account.id)
                            )
                        );
                    } else if (account.passwordSetupComplete === true) {
                        actionsCell.appendChild(
                            createActionButton(
                                "Deactivate",
                                "user-x",
                                () => toggleAccountStatus(account.id)
                            )
                        );
                    }


                    // Every account can be deleted, set up or not. The server
                    // still refuses when the instructor has classes or grades.
                    {

                        actionsCell.appendChild(

                            createActionButton(

                                "Delete",

                                "trash-2",

                                () =>
                                    openDeleteInstructorModal(
                                        instructor.id
                                    ),

                                true,

                                true

                            )

                        );

                    }

                }



                /* -----------------------------------------
                   APPEND CELLS
                ----------------------------------------- */

                row.appendChild(
                    rowNumberCell
                );

                row.appendChild(
                    instructorIdCell
                );

                row.appendChild(
                    instructorCell
                );

                row.appendChild(
                    emailCell
                );

                row.appendChild(
                    classesCell
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

            }
        );


        refreshPageIcons();

    }



    /* =====================================================
       ACTION BUTTON
    ===================================================== */

    function createActionButton(
        label,
        icon,
        handler,
        danger = false,
        iconOnly = false
    ) {

        const button =
            document.createElement(
                "button"
            );


        button.type =
            "button";


        button.className =
            danger
                ? "table-action-button danger"
                : "table-action-button";


        button.innerHTML = iconOnly
            ? `<i data-lucide="${escapeHtml(icon)}"></i>`
            : `
            <i data-lucide="${escapeHtml(
                icon
            )}"></i>

            <span>
                ${escapeHtml(
                    label
                )}
            </span>
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



    /* =====================================================
       RESET PASSWORD
    ===================================================== */

    function openResetPasswordModal(
        accountId
    ) {

        const account =
            getAccountById(
                accountId
            );


        if (!account) {

            return;

        }


        resetAccountId =
            accountId;


        const instructorName =
            getInstructorName(
                account
            );


        resetPasswordDescription.textContent =
            `Generate a new temporary password for ${instructorName}.`;

        // Wording follows the account's state.
        const resetHeading = resetPasswordModal.querySelector("h2, h3");
        if (resetHeading) {
            resetHeading.textContent = account.passwordSetupComplete === true
                ? "Reset Password"
                : "New Temporary Password";
        }


        resetPasswordValue.value =
            generateTemporaryPassword();


        resetPasswordModal.hidden =
            false;


        refreshPageIcons();

    }



    function closeResetPasswordModal() {

        resetPasswordModal.hidden =
            true;


        resetAccountId =
            null;


        resetPasswordValue.value =
            "";

    }



 async function confirmResetPassword() {

    if (!resetAccountId) {
        return;
    }

    const accounts =
        getAccounts();

    const account =
        accounts.find(
            item =>
                item.id ===
                resetAccountId
        );

    if (!account) {
        alert(
            "Instructor account not found. Please refresh the page and try again."
        );
        return;
    }

    const password =
        resetPasswordValue.value.trim();

    if (!password) {
        alert(
            "Please generate a temporary password first."
        );
        return;
    }

    if (password.length < 8) {
        alert(
            "The temporary password must be at least 8 characters."
        );
        return;
    }

    const backendId =
        account.backendId;

    if (!backendId) {
        alert(
            "This instructor is not linked to a saved account. Refresh the page and try again."
        );
        return;
    }

    confirmResetPasswordButton.disabled =
        true;

    confirmResetPasswordButton.innerHTML = `
        <i data-lucide="loader-circle"></i>
        <span>Resetting...</span>
    `;

    refreshPageIcons();

    try {

        const payload =
            await instructorApiRequest(
                `/admin/instructors/${backendId}`,
                {
                    method: "PUT",

                    body: JSON.stringify({
                        password: password
                    })
                }
            );

        console.log(
            "Instructor password reset response:",
            payload
        );

        closeResetPasswordModal();

        confirmResetPasswordButton.disabled =
            false;

        confirmResetPasswordButton.innerHTML = `
            <i data-lucide="key-round"></i>
            <span>Reset Password</span>
        `;

        renderTable();
        refreshPageIcons();

        alert(
            payload?.message ||
            `The temporary password has been reset successfully.\n\nNew password: ${password}`
        );

    } catch (error) {

        console.error(
            "Instructor password reset failed:",
            error
        );

        confirmResetPasswordButton.disabled =
            false;

        confirmResetPasswordButton.innerHTML = `
            <i data-lucide="key-round"></i>
            <span>Reset Password</span>
        `;

        refreshPageIcons();

        alert(
            error.message ||
            "Unable to reset the instructor password."
        );
    }
}

    /* =====================================================
       DELETE INSTRUCTOR
    ===================================================== */

    function openDeleteInstructorModal(
        instructorId
    ) {

        const instructor =
            getInstructorById(
                instructorId
            );


        if (!instructor) {

            return;

        }


        const account =
            getAccountForInstructor(
                instructor.id
            );


        const assignedClasses =
            getAssignedClasses(
                instructor.id
            );


        deleteInstructorId =
            instructor.id;


        const instructorName =
            instructor.name ||
            "this instructor";



        /* -----------------------------------------
           NO CLASS ASSIGNMENTS
        ----------------------------------------- */

        if (
            assignedClasses.length ===
            0
        ) {

            deleteAccountMessage.textContent =
                account

                    ? `Delete ${instructorName} and the associated account?`

                    : `Delete instructor ${instructorName}?`;

        }



        /* -----------------------------------------
           HAS CLASS ASSIGNMENTS
        ----------------------------------------- */

        else {

            const classList =
                assignedClasses
                    .map(
                        getClassDisplayName
                    )
                    .join(
                        ", "
                    );


            deleteAccountMessage.innerHTML =
                `
                <strong>
                    ${escapeHtml(
                        instructorName
                    )}
                </strong>

                is assigned to

                <strong>
                    ${assignedClasses.length}

                    ${
                        assignedClasses.length ===
                        1
                            ? "class"
                            : "classes"
                    }
                </strong>.

                <br><br>

                Deleting this instructor will also
                unassign them from:

                <br><br>

                <span class="delete-warning-list">
                    ${escapeHtml(
                        classList
                    )}
                </span>

                <br><br>

                The instructor
                ${
                    account
                        ? "and associated account"
                        : ""
                }
                will then be permanently deleted.
                `;

        }


        confirmDeleteCheckbox.checked =
            false;


        confirmDeleteButton.disabled =
            true;


        confirmDeleteButton.innerHTML =
            `
            <i data-lucide="trash-2"></i>

            <span>
                Delete Instructor
            </span>
            `;


        deleteAccountModal.hidden =
            false;


        refreshPageIcons();

    }



    function closeDeleteAccountModal() {

        deleteAccountModal.hidden =
            true;


        deleteInstructorId =
            null;


        confirmDeleteCheckbox.checked =
            false;


        confirmDeleteButton.disabled =
            true;

    }


async function confirmDeleteAccount() {

    if (
        !deleteInstructorId ||
        !confirmDeleteCheckbox.checked
    ) {
        return;
    }

    const instructor =
        getInstructorById(
            deleteInstructorId
        );

    if (!instructor) {

        closeDeleteAccountModal();
        renderTable();

        return;
    }

    const instructorId =
        instructor.id;

    const instructorName =
        instructor.name ||
        "The instructor";

    /*
     * Find the Laravel instructor ID.
     *
     * The frontend instructor.id may be
     * INS-001, INS-002, etc., while
     * backendId is the actual users.id.
     */
    const account =
        getAccountForInstructor(
            instructor.id
        );

    const backendId =
        instructor.backendId ||
        account?.backendId;

    if (!backendId) {

        alert(
            "This instructor is not linked to a Laravel account. Refresh the page and try again."
        );

        return;
    }

    /*
     * Prevent duplicate clicks while
     * the DELETE request is running.
     */
    confirmDeleteButton.disabled =
        true;

    confirmDeleteButton.innerHTML =
        `
        <i data-lucide="loader-circle"></i>

        <span>
            Deleting...
        </span>
        `;

    refreshPageIcons();

    try {

        /*
         * Delete the actual instructor
         * from Laravel/MySQL.
         */
        const payload =
            await instructorApiRequest(
                `/admin/instructors/${backendId}`,
                {
                    method:
                        "DELETE"
                }
            );

        /*
         * Only synchronize local state
         * after Laravel confirms success.
         * The delete already worked, so a failed
         * refresh is not reported as a failed delete.
         */
        try {
            await syncInstructorsFromApi();
        } catch (syncError) {
            console.error("Instructor list refresh failed after delete:", syncError);
        }

        /*
         * Keep the local class state
         * compatible with the deleted
         * instructor.
         */
        const classes =
            loadClasses();

        const updatedClasses =
            removeInstructorFromClasses(
                classes,
                instructorId
            );

        saveClasses(
            updatedClasses
        );

        /*
         * Remove any legacy local
         * account data associated with
         * this instructor.
         */
        const accounts =
            getAccounts();

        const remainingAccounts =
            accounts.filter(
                item =>
                    String(
                        item.instructorId
                    ) !==
                    String(
                        instructorId
                    )
            );

        saveAccounts(
            remainingAccounts
        );

        closeDeleteAccountModal();

        renderTable();

        refreshPageIcons();

        alert(`${instructorName} was deleted successfully.`);

    } catch (
        error
    ) {

        console.error(
            "Instructor deletion failed:",
            error
        );

        /*
         * Keep the instructor in the
         * frontend because the backend
         * deletion did not succeed.
         */
        confirmDeleteButton.disabled =
            false;

        confirmDeleteButton.innerHTML =
            `
            <i data-lucide="trash-2"></i>

            <span>
                Delete Instructor
            </span>
            `;

        refreshPageIcons();

        alert(
            error.message ||
            "Unable to delete instructor."
        );
    }
}
function clearInstructorCredentialExports() {
    if (instructorCredentialsExpiryTimer) {
        clearTimeout(instructorCredentialsExpiryTimer);
        instructorCredentialsExpiryTimer = null;
    }

    latestInstructorCredentials = [];

    document.getElementById("credentialFormatMenu")?.setAttribute("hidden", "");

    if (downloadInstructorCredentialsBtn) {
        downloadInstructorCredentialsBtn.disabled = true;
    }

    if (downloadInstructorCredentialsPdfBtn) {
        downloadInstructorCredentialsPdfBtn.disabled = true;
    }
}

function enableInstructorCredentialExports(credentials) {
    clearInstructorCredentialExports();

    latestInstructorCredentials = credentials;

    if (downloadInstructorCredentialsBtn) {
        downloadInstructorCredentialsBtn.disabled = false;
    }

    if (downloadInstructorCredentialsPdfBtn) {
        downloadInstructorCredentialsPdfBtn.disabled = false;
    }

    instructorCredentialsExpiryTimer = setTimeout(() => {
        clearInstructorCredentialExports();

        alert(
            "The temporary credential download period has expired. " +
            "Import the instructor accounts again if you need a new credential export."
        );
    }, 120000);
}

async function saveInstructorCredentialFile(
    blob,
    defaultName,
    mimeType,
    extension
) {
    if ("showSaveFilePicker" in window) {
        try {
            const handle = await window.showSaveFilePicker({
                suggestedName: defaultName,
                types: [{
                    description: extension.toUpperCase() + " file",
                    accept: {
                        [mimeType]: ["." + extension]
                    }
                }]
            });

            const writable = await handle.createWritable();
            await writable.write(blob);
            await writable.close();

            return true;
        } catch (error) {
            if (error.name === "AbortError") {
                return false;
            }

            console.error("Save As failed:", error);
            alert("Unable to save using the file picker. Trying a browser download instead.");
        }
    }

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = defaultName;

    document.body.appendChild(link);
    link.click();
    link.remove();

    setTimeout(() => URL.revokeObjectURL(url), 1000);

    return true;
}

function getInstructorCredentialRows() {
    return latestInstructorCredentials.map(item => ({
        "Instructor Name": item.name || "",
        "School ID": item.school_id || "",
        "Email": item.email || "",
        "Temporary Password": item.temporary_password || ""
    }));
}

async function downloadInstructorCredentials() {
    if (!latestInstructorCredentials.length) {
        alert("No temporary credentials are available to download.");
        return;
    }

    if (!window.XLSX) {
        alert("The Excel library did not load. Check your internet connection and reload the page.");
        return;
    }

    const worksheet = window.XLSX.utils.json_to_sheet(
        getInstructorCredentialRows()
    );

    worksheet["!cols"] = [
        { wch: 28 },
        { wch: 18 },
        { wch: 32 },
        { wch: 24 }
    ];

    const workbook = window.XLSX.utils.book_new();

    window.XLSX.utils.book_append_sheet(
        workbook,
        worksheet,
        "Instructor Credentials"
    );

    const excelData = window.XLSX.write(workbook, {
        bookType: "xlsx",
        type: "array"
    });

    const blob = new Blob([excelData], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    });

    await saveInstructorCredentialFile(
        blob,
        "siknayan-instructor-credentials.xlsx",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "xlsx"
    );
}

async function downloadInstructorCredentialsPdf() {
    if (!latestInstructorCredentials.length) {
        alert("No temporary credentials are available to download.");
        return;
    }

    if (!window.jspdf?.jsPDF) {
        alert("The PDF library did not load. Check your internet connection and reload the page.");
        return;
    }

    const { jsPDF } = window.jspdf;

    const pdf = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4"
    });

    const rows = getInstructorCredentialRows();
    const headers = Object.keys(rows[0]);
    const widths = [48, 28, 65, 45];
    const margin = 10;
    let y = 29;

    function drawTitle() {
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(14);
        pdf.text("Instructor Temporary Credentials", margin, 14);

        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(8);
        pdf.text(
            "Confidential - distribute credentials securely.",
            margin,
            20
        );
    }

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

    drawTitle();
    drawHeader();

    pdf.setFontSize(7.5);

    rows.forEach(row => {
        const cells = headers.map((header, index) =>
            pdf.splitTextToSize(
                String(row[header] ?? ""),
                widths[index] - 4
            )
        );

        const lineCount = Math.max(
            ...cells.map(lines => lines.length)
        );

        const rowHeight = Math.max(9, lineCount * 3.5 + 6);

        if (y + rowHeight > 190) {
            pdf.addPage();
            y = 14;
            drawHeader();
            pdf.setFontSize(7.5);
        }

        let x = margin;

        cells.forEach((lines, index) => {
            pdf.rect(x, y, widths[index], rowHeight);
            pdf.text(lines, x + 2, y + 5.5);
            x += widths[index];
        });

        y += rowHeight;
    });

    const pdfBlob = pdf.output("blob");

    await saveInstructorCredentialFile(
        pdfBlob,
        "siknayan-instructor-credentials.pdf",
        "application/pdf",
        "pdf"
    );
}

async function importInstructorsFromExcel() {
    const file = instructorsExcelFile?.files?.[0];

    if (!file) {
        alert("Please select an Excel (.xlsx) file first.");
        return;
    }

    if (!file.name.toLowerCase().endsWith(".xlsx")) {
        alert("Please select an .xlsx Excel file.");
        return;
    }
    // Several worksheets: let the admin choose which to import.
    let sheets = [];

    try {
        sheets = await window.chooseWorkbookSheets(file, {
            help:
                "This workbook has more than one worksheet. Choose the ones with " +
                "instructor records. Each needs the headers Instructor Name and School ID."
        });
    } catch (error) {
        alert(error.message || "Could not read the workbook.");
        instructorsExcelFile.value = "";
        return;
    }

    if (sheets === null) {
        instructorsExcelFile.value = ""; // cancelled
        return;
    }

    clearInstructorCredentialExports();

    const formData = new FormData();
    formData.append("file", file);
    sheets.forEach(name => formData.append("sheets[]", name));

    importInstructorsExcelBtn.disabled = true;
    importInstructorsExcelBtn.textContent = "Importing...";

    try {
        const payload = await instructorApiRequest(
            "/admin/instructors/import",
            {
                method: "POST",
                body: formData
            }
        );

        const instructors = Array.isArray(payload?.instructors)
            ? payload.instructors
            : [];

        const credentials = instructors.filter(item =>
            item.name &&
            item.school_id &&
            item.temporary_password
        );

        if (
            !payload?.success ||
            instructors.length === 0 ||
            credentials.length !== instructors.length
        ) {
            latestInstructorCredentials = [];
            downloadInstructorCredentialsBtn.disabled = true;

            alert(
                "The server response did not include complete temporary credentials. " +
                "Please check the import response before retrying."
            );
            return;
        }

        enableInstructorCredentialExports(credentials);

        if (typeof syncInstructorsFromApi === "function") {
            await syncInstructorsFromApi();
        }

        if (typeof renderTable === "function") {
            renderTable();
        }

        alert(
    `${payload.count ?? credentials.length} instructor account(s) imported successfully. ` +
    "Choose Excel or PDF to download the temporary credentials within two minutes."
);
    } catch (error) {
        console.error("Instructor Excel import failed:", error);

        if (latestInstructorCredentials.length > 0) {
            alert(
                "Instructor accounts were imported, but the table could not be refreshed. " +
                "The temporary credential download remains available; reload the page to refresh the list."
            );
        } else {
            clearInstructorCredentialExports();
            alert(error.message || "Unable to import instructor accounts.");
        }
    } finally {
        importInstructorsExcelBtn.disabled = false;
        importInstructorsExcelBtn.innerHTML =
            '<i data-lucide="file-spreadsheet"></i><span>Import Instructors from Excel</span>';

        if (instructorsExcelFile) {
            instructorsExcelFile.value = "";
        }

        refreshPageIcons();
    }
}
    /* =====================================================
       EVENTS
    ===================================================== */
if (importInstructorsExcelBtn && instructorsExcelFile) {
    importInstructorsExcelBtn.addEventListener("click", () => {
        instructorsExcelFile.click();
    });

    instructorsExcelFile.addEventListener("change", importInstructorsFromExcel);
}

// One "Download Credentials" button opens a menu: Excel or PDF.
const credentialFormatMenu =
    document.getElementById("credentialFormatMenu");

function setCredentialMenuOpen(open) {
    if (!credentialFormatMenu || !downloadInstructorCredentialsBtn) return;
    credentialFormatMenu.hidden = !open;
    downloadInstructorCredentialsBtn.setAttribute("aria-expanded", String(open));
    if (open) {
        credentialFormatMenu.querySelector("button")?.focus();
    }
}

if (downloadInstructorCredentialsBtn && credentialFormatMenu) {
    downloadInstructorCredentialsBtn.addEventListener("click", event => {
        event.stopPropagation();
        setCredentialMenuOpen(credentialFormatMenu.hidden);
    });

    credentialFormatMenu.addEventListener("click", event => {
        const option = event.target.closest("[data-credential-format]");
        if (!option) return;
        setCredentialMenuOpen(false);

        if (option.dataset.credentialFormat === "pdf") {
            downloadInstructorCredentialsPdf();
        } else {
            downloadInstructorCredentials();
        }
    });

    document.addEventListener("click", event => {
        if (!credentialFormatMenu.hidden && !event.target.closest(".credential-download")) {
            setCredentialMenuOpen(false);
        }
    });

    document.addEventListener("keydown", event => {
        if (event.key === "Escape" && !credentialFormatMenu.hidden) {
            setCredentialMenuOpen(false);
            downloadInstructorCredentialsBtn.focus();
        }
    });
}
    if (
        addButton
    ) {

        addButton.addEventListener(
            "click",
            openAddModal
        );

    }



    if (
        accountForm
    ) {

        accountForm.addEventListener(
            "submit",
            saveAccount
        );

    }



    if (
        generatePasswordButton
    ) {

        generatePasswordButton.addEventListener(
            "click",
            () => {

                passwordInput.value =
                    generateTemporaryPassword();

            }
        );

    }



    if (
        closeAccountModalButton
    ) {

        closeAccountModalButton.addEventListener(
            "click",
            closeAccountModal
        );

    }



    if (
        cancelAccountButton
    ) {

        cancelAccountButton.addEventListener(
            "click",
            closeAccountModal
        );

    }



    if (
        accountModal
    ) {

        accountModal.addEventListener(
            "click",
            event => {

                if (
                    event.target ===
                    accountModal
                ) {

                    closeAccountModal();

                }

            }
        );

    }



    if (
        searchInput
    ) {

        searchInput.addEventListener(
            "input",
            renderTable
        );

    }



    if (
        statusFilter
    ) {

        statusFilter.addEventListener(
            "change",
            renderTable
        );

    }



    if (
        closeResetPasswordButton
    ) {

        closeResetPasswordButton.addEventListener(
            "click",
            closeResetPasswordModal
        );

    }



    if (
        cancelResetPasswordButton
    ) {

        cancelResetPasswordButton.addEventListener(
            "click",
            closeResetPasswordModal
        );

    }



    if (
        regenerateResetPasswordButton
    ) {

        regenerateResetPasswordButton.addEventListener(
            "click",
            () => {

                resetPasswordValue.value =
                    generateTemporaryPassword();

            }
        );

    }



    if (
        confirmResetPasswordButton
    ) {

        confirmResetPasswordButton.addEventListener(
            "click",
            confirmResetPassword
        );

    }



    if (
        resetPasswordModal
    ) {

        resetPasswordModal.addEventListener(
            "click",
            event => {

                if (
                    event.target ===
                    resetPasswordModal
                ) {

                    closeResetPasswordModal();

                }

            }
        );

    }



    if (
        closeDeleteAccountButton
    ) {

        closeDeleteAccountButton.addEventListener(
            "click",
            closeDeleteAccountModal
        );

    }



    if (
        cancelDeleteAccountButton
    ) {

        cancelDeleteAccountButton.addEventListener(
            "click",
            closeDeleteAccountModal
        );

    }



    if (
        confirmDeleteCheckbox
    ) {

        confirmDeleteCheckbox.addEventListener(
            "change",
            () => {

                confirmDeleteButton.disabled =
                    !confirmDeleteCheckbox.checked;

            }
        );

    }



    if (
        confirmDeleteButton
    ) {

        confirmDeleteButton.addEventListener(
            "click",
            confirmDeleteAccount
        );

    }



    if (
        deleteAccountModal
    ) {

        deleteAccountModal.addEventListener(
            "click",
            event => {

                if (
                    event.target ===
                    deleteAccountModal
                ) {

                    closeDeleteAccountModal();

                }

            }
        );

    }



    /* =====================================================
       ESCAPE KEY
    ===================================================== */

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



/* =====================================================
   INITIALIZE
===================================================== */

if (statusFilter) {
    statusFilter.value = "all";
}

syncInstructorsFromApi()
    .then(() => {

        if (statusFilter) {
            statusFilter.value = "all";
        }

        renderTable();
        refreshPageIcons();

    })
    .catch(error => {

        console.error(
            "Instructor API initialization failed:",
            error
        );

        if (statusFilter) {
            statusFilter.value = "all";
        }

        renderTable();
        refreshPageIcons();

        alert(
            error.message ||
            "Unable to load instructors from Laravel."
        );

    });


})();
