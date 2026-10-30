/* =====================================================
   SIKNAYAN INSTRUCTOR DASHBOARD
   Learner Progress
===================================================== */

/*
 * API URL
 * Change this URL if your backend uses a different
 * address, such as a GitHub Codespaces forwarded URL.
 */
const API_BASE_URL = window.SIKNAYAN_API_ROOT;


/* =====================================================
   GET AUTH TOKEN
===================================================== */

const token =
    sessionStorage.getItem("token") ||
    sessionStorage.getItem("authToken");


/* =====================================================
   GET DOM ELEMENTS
===================================================== */

const totalLearners =
    document.getElementById("totalLearners");

const totalClasses =
    document.getElementById("totalClasses");

const totalModules =
    document.getElementById("totalModules");

const pendingSubmissions =
    document.getElementById("pendingSubmissions");

const learnersTableBody =
    document.getElementById("learnersTableBody");

const learnerSearch =
    document.getElementById("learnerSearch");

const emptyMessage =
    document.getElementById("emptyMessage");

const headerName =
    document.getElementById("headerName");

const headerAvatar =
    document.getElementById("headerAvatar");

const sidebar =
    document.getElementById("sidebar");

const viewToggleButton =
    document.getElementById("viewToggleButton");

const mobileMenuButton =
    document.getElementById("mobileMenuButton");

const logoutLink =
    document.getElementById("logoutLink");


/* =====================================================
   LEARNER DATA
===================================================== */

let learners = [];


/* =====================================================
   CHECK LOGIN
===================================================== */

if (!token) {
    console.warn("No authentication token found.");
    window.location.href = "/index.html";
}


/* =====================================================
   LOAD DASHBOARD
===================================================== */

async function loadDashboard() {
    if (!token) {
        return;
    }

    try {
        const response = await fetch(
            `${API_BASE_URL}/instructor/dashboard`,
            {
                method: "GET",
                headers: {
                    "Accept": "application/json",
                    "Authorization": `Bearer ${token}`
                }
            }
        );

        /*
         * Read the response safely.
         */
        const data = await response.json().catch(() => ({}));

        console.log("Instructor dashboard:", data);

        /* =============================================
           AUTHENTICATION ERROR
        ============================================= */

        if (response.status === 401) {
            console.warn(
                "Authentication token is invalid or expired."
            );

            clearLoginSession();
            window.location.href = "/index.html";
            return;
        }

        /* =============================================
           PERMISSION ERROR
        ============================================= */

        if (response.status === 403) {
            showDashboardError(
                "You do not have permission to view this dashboard."
            );
            return;
        }

        /* =============================================
           API ERROR
        ============================================= */

        if (!response.ok || !data.success) {
            throw new Error(
                data.message || "Unable to load dashboard."
            );
        }

        /* =============================================
           INSTRUCTOR INFORMATION
        ============================================= */

        updateInstructorInformation(data.instructor);

        /* =============================================
           STATISTICS
        ============================================= */

        updateStatistics(data.statistics);

        /* =============================================
           LEARNERS
        ============================================= */

        learners = Array.isArray(data.learners)
            ? data.learners
            : [];

        fillClassFilter(
            Array.isArray(data.courses) ? data.courses : []
        );

        applyLearnerFilters();

    } catch (error) {
        console.error("Dashboard error:", error);

        showDashboardError(
            error.message ||
            "Unable to connect to the server. Please try again."
        );
    }
}


/* =====================================================
   UPDATE INSTRUCTOR INFORMATION
===================================================== */

function updateInstructorInformation(instructor) {
    if (!instructor) {
        return;
    }

    /* Header name */

    if (headerName) {
        headerName.textContent =
            instructor.name || "Instructor";
    }

    /* Header avatar initials */

    if (headerAvatar) {
        const name = instructor.name || "Instructor";

        const initials = name
            .trim()
            .split(/\s+/)
            .filter(Boolean)
            .map(word => word.charAt(0))
            .join("")
            .substring(0, 2)
            .toUpperCase();

        headerAvatar.textContent = initials || "I";
    }

    /* Update stored user information */

    const storedUser = sessionStorage.getItem("user");

    if (storedUser) {
        try {
            const user = JSON.parse(storedUser);

            sessionStorage.setItem(
                "user",
                JSON.stringify({
                    ...user,
                    ...instructor
                })
            );

        } catch (error) {
            console.warn(
                "Unable to update stored user.",
                error
            );
        }
    }
}


/* =====================================================
   UPDATE STATISTICS
===================================================== */

function updateStatistics(statistics) {
    if (!statistics) {
        return;
    }

    if (totalLearners) {
        totalLearners.textContent =
            statistics.total_learners ?? 0;
    }

    if (totalClasses) {
        totalClasses.textContent =
            statistics.total_classes ?? 0;
    }

    if (totalModules) {
        totalModules.textContent =
            statistics.total_modules ?? 0;
    }

    if (pendingSubmissions) {
        pendingSubmissions.textContent =
            statistics.pending_submissions ?? 0;
    }
}


/* =====================================================
   RENDER LEARNERS
===================================================== */

function renderLearners(learnerList) {
    if (!learnersTableBody) {
        return;
    }

    learnersTableBody.innerHTML = "";

    const learnerCount = document.getElementById("learnerCount");
    const count = Array.isArray(learnerList) ? learnerList.length : 0;

    if (learnerCount) {
        learnerCount.textContent =
            `Showing ${count} learner record${count === 1 ? "" : "s"}`;
    }

    /* Show empty message if there are no learners */

    if (count === 0) {
        if (emptyMessage) {
            emptyMessage.style.display = "block";
        }

        return;
    }

    if (emptyMessage) {
        emptyMessage.style.display = "none";
    }

    /* One row per learner, in the same order as the table headings:
       Learner | Class | Modules | Progress | Pending | Status */

    learnerList.forEach(learner => {
        const row = document.createElement("tr");

        /* Learner: name with the School ID under it */

        const learnerCell = document.createElement("td");

        const learnerBox = document.createElement("div");
        learnerBox.className = "learner-cell";

        // The learner's own profile picture, or their initials.
        const photo = document.createElement("span");
        photo.className = "learner-photo";
        photo.setAttribute("aria-hidden", "true");
        const initials = String(learner.name || "?").trim().split(/\s+/).slice(0, 2)
            .map(part => part.charAt(0).toUpperCase()).join("");
        if (learner.profile_photo_url) {
            const img = document.createElement("img");
            img.src = learner.profile_photo_url;
            img.alt = "";
            img.addEventListener("error", () => { photo.textContent = initials; });
            photo.appendChild(img);
        } else {
            photo.textContent = initials;
        }

        const nameBox = document.createElement("div");

        const name = document.createElement("div");
        name.className = "learner-name";
        name.textContent = learner.name || "Unknown Learner";

        const schoolId = document.createElement("div");
        schoolId.className = "learner-id";
        schoolId.textContent = learner.school_id || "No School ID";

        nameBox.append(name, schoolId);
        learnerBox.append(photo, nameBox);
        learnerCell.appendChild(learnerBox);

        /* Class codes */

        // Each row is one learner in one class.
        const classCell = document.createElement("td");
        classCell.className = "class-cell";

        const classCode = document.createElement("strong");
        classCode.textContent =
            learner.class_code ||
            (Array.isArray(learner.class_codes) ? learner.class_codes.join(", ") : "") ||
            "No class";
        classCell.appendChild(classCode);

        if (learner.class_name) {
            const className = document.createElement("span");
            className.textContent = learner.class_name;
            classCell.appendChild(className);
        }

        /* Modules */

        const modulesCell = document.createElement("td");

        modulesCell.textContent =
            Number(learner.modules_assigned) || 0;

        /* Progress bar */

        const progressCell = document.createElement("td");
        progressCell.className = "progress-cell";

        let progress = Number(learner.progress);

        if (!Number.isFinite(progress)) {
            progress = 0;
        }

        progress = Math.max(0, Math.min(100, Math.round(progress)));

        const progressTop = document.createElement("div");
        progressTop.className = "progress-top";

        const progressLabel = document.createElement("span");
        progressLabel.textContent = "Overall";

        const progressValue = document.createElement("span");
        progressValue.textContent = `${progress}%`;

        progressTop.append(progressLabel, progressValue);

        const progressTrack = document.createElement("div");
        progressTrack.className = "progress-track";
        progressTrack.setAttribute("role", "progressbar");
        progressTrack.setAttribute("aria-label", `${learner.name || "Learner"} progress`);
        progressTrack.setAttribute("aria-valuemin", "0");
        progressTrack.setAttribute("aria-valuemax", "100");
        progressTrack.setAttribute("aria-valuenow", String(progress));

        const progressFill = document.createElement("div");
        progressFill.className = "progress-fill";
        progressFill.style.width = `${progress}%`;

        progressTrack.appendChild(progressFill);
        progressCell.append(progressTop, progressTrack);

        /* Pending: submissions waiting for a grade */

        const pendingCell = document.createElement("td");
        const pending = Number(learner.pending_submissions) || 0;

        pendingCell.textContent = pending;

        if (pending > 0) {
            pendingCell.className = "pending-count";
        }

        /* Status */

        const statusCell = document.createElement("td");

        // Older servers sent "Pending Plan"; it is shown as "Pending".
        const rawStatus = learner.status || "Pending";
        const status = String(rawStatus).toLowerCase() === "pending plan" ? "Pending" : rawStatus;
        const normalizedStatus = String(status).toLowerCase();

        const statusBadge = document.createElement("span");
        statusBadge.className = "status";

        if (normalizedStatus === "completed") {
            statusBadge.classList.add("completed");
        } else if (normalizedStatus === "active") {
            statusBadge.classList.add("active");
        } else if (normalizedStatus === "inactive") {
            statusBadge.classList.add("inactive");
        } else {
            statusBadge.classList.add("pending");
        }

        statusBadge.textContent = status;
        statusCell.appendChild(statusBadge);

        row.append(
            learnerCell,
            classCell,
            modulesCell,
            progressCell,
            pendingCell,
            statusCell
        );

        learnersTableBody.appendChild(row);
    });
}


/* =====================================================
   SEARCH LEARNERS
===================================================== */

/* Class filter: one class, or all */
const classFilter =
    document.getElementById("classFilter");

function fillClassFilter(courses) {
    if (!classFilter) {
        return;
    }

    const current = classFilter.value;

    classFilter.innerHTML = '<option value="all">All classes</option>';

    courses.forEach(course => {
        const option = document.createElement("option");
        option.value = String(course.id);
        option.textContent = [course.code, course.name].filter(Boolean).join(" | ") || "Class";
        classFilter.appendChild(option);
    });

    if ([...classFilter.options].some(option => option.value === current)) {
        classFilter.value = current;
    }
}

/* Class filter and search together */
function applyLearnerFilters() {
    const classId = classFilter ? classFilter.value : "all";
    const searchTerm = learnerSearch
        ? learnerSearch.value.trim().toLowerCase()
        : "";

    const filtered = learners.filter(learner => {
        if (classId !== "all" && String(learner.class_id) !== classId) {
            return false;
        }

        if (!searchTerm) {
            return true;
        }

        return [
            learner.name,
            learner.school_id,
            learner.class_code,
            learner.class_name
        ].some(value => String(value || "").toLowerCase().includes(searchTerm));
    });

    renderLearners(filtered);
}

if (classFilter) {
    classFilter.addEventListener("change", applyLearnerFilters);
}

if (learnerSearch) {
    learnerSearch.addEventListener("input", applyLearnerFilters);
}



/* =====================================================
   SIDEBAR TOGGLE
===================================================== */

if (viewToggleButton && sidebar) {
    viewToggleButton.addEventListener("click", function () {
        sidebar.classList.toggle("collapsed");
    });
}


/* =====================================================
   MOBILE SIDEBAR
===================================================== */

if (mobileMenuButton && sidebar) {
    mobileMenuButton.addEventListener("click", function () {
        sidebar.classList.toggle("mobile-open");
    });
}


/* =====================================================
   CLOSE MOBILE SIDEBAR
   WHEN NAVIGATION IS CLICKED
===================================================== */

const navigationLinks = document.querySelectorAll(".nav-item");

navigationLinks.forEach(link => {
    link.addEventListener("click", function () {
        if (window.innerWidth <= 750 && sidebar) {
            sidebar.classList.remove("mobile-open");
        }
    });
});


/* =====================================================
   CLEAR LOGIN SESSION
===================================================== */

function clearLoginSession() {
    sessionStorage.removeItem("token");
    sessionStorage.removeItem("authToken");
    sessionStorage.removeItem("user");
    sessionStorage.removeItem("role");
    sessionStorage.removeItem("firstLogin");
}


/* =====================================================
   LOGOUT
===================================================== */

if (logoutLink) {
    logoutLink.addEventListener("click", async function (event) {
        event.preventDefault();

        const confirmLogout = await window.SiknayanDialog.confirm("Are you sure you want to log out?", { title: "Log out", confirmText: "Log out" });

        if (!confirmLogout) {
            return;
        }

        clearLoginSession();

        window.location.href = "/index.html";
    });
}


/* =====================================================
   SHOW DASHBOARD ERROR
===================================================== */

function showDashboardError(message) {
    if (!learnersTableBody) {
        return;
    }

    learnersTableBody.innerHTML = "";

    const row = document.createElement("tr");
    const cell = document.createElement("td");

    cell.colSpan = 6;
    cell.className = "error-cell";
    cell.textContent =
        message || "Unable to load learner information.";

    row.appendChild(cell);
    learnersTableBody.appendChild(row);

    if (emptyMessage) {
        emptyMessage.style.display = "none";
    }
}


/* =====================================================
   START DASHBOARD
===================================================== */

if (token) {
    loadDashboard();
}
