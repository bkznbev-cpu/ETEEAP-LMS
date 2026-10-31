/* =========================================================
   SIKNAYAN - ACADEMIC ADMIN
   notifications.js

   Notification Center
   ---------------------------------------------------------

   CURRENT DATA FLOW:

       notification-events.js
               ↓
       localStorage event store
               ↓
       notifications.js
               ↓
       Notifications UI

   FUTURE DATA FLOW:

       Frontend
           ↓
       FastAPI
           ↓
       PostgreSQL
           ↓
       Notification events
           ↓
       Notifications UI

   IMPORTANT:

   Notifications represent meaningful EVENTS or CHANGES.

   They do NOT duplicate Dashboard state such as:

       - Learners Without Class
       - Classes Without Learners
       - Classes Without Instructor

   Those belong to the Dashboard work queue.
========================================================= */

(function initNotificationsPage() {

    "use strict";


    /* =====================================================
       PAGE CHECK
    ===================================================== */

    const page =
        document.querySelector(
            ".notifications-page"
        );


    if (!page) {
        return;
    }



    /* =====================================================
       NOTIFICATION EVENT SERVICE
    ===================================================== */

    const NotificationEvents =
        window.SiknayanNotificationEvents;


    if (
        !NotificationEvents ||
        typeof NotificationEvents.getAll !== "function"
    ) {

        console.error(
            "Siknayan Notifications: notification-events.js was not loaded."
        );

    }



    /* =====================================================
       STORAGE
    ===================================================== */

    const STATE_STORAGE_KEY =
        "siknayan_academic_admin_notification_state";



    /* =====================================================
       CONFIGURATION
    ===================================================== */

    const PAGE_SIZE = 5;



    /* =====================================================
       DOM REFERENCES
    ===================================================== */

    const searchInput =
        document.getElementById(
            "notificationSearch"
        );


    const tabButtons =
        Array.from(
            document.querySelectorAll(
                ".notification-tab"
            )
        );


    const notificationList =
        document.getElementById(
            "notificationList"
        );


    const notificationListEmpty =
        document.getElementById(
            "notificationListEmpty"
        );


    const selectAllCheckbox =
        document.getElementById(
            "selectAllNotifications"
        );


    const markSelectedReadButton =
        document.getElementById(
            "markSelectedReadButton"
        );


    const markAllReadButton =
        document.getElementById(
            "markAllReadButton"
        );


    const deleteSelectedButton =
        document.getElementById(
            "deleteSelectedButton"
        );


    const footerText =
        document.getElementById(
            "notificationFooterText"
        );


    const pagination =
        document.getElementById(
            "notificationPagination"
        );


    const preview =
        document.getElementById(
            "notificationPreview"
        );


    const previewEmpty =
        preview?.querySelector(
            ".notification-preview-empty"
        );


    const previewContent =
        document.getElementById(
            "notificationPreviewContent"
        );



    /* =====================================================
       INTERNAL STATE
    ===================================================== */

    let notifications =
        [];


    let currentTab =
        "all";


    let currentPage =
        1;


    let selectedIds =
        new Set();


    let selectedNotificationId =
        null;


    // Read/deleted flags for this page view. The server is the source of
    // truth; this mirrors it so the page can update instantly.
    let notificationState = {
        read: {},
        deleted: {}
    };


    /* =====================================================
       SERVER NOTIFICATIONS
       -----------------------------------------------------
       Loaded from GET /api/admin/notifications. Read,
       unread and delete are sent back to the server.
    ===================================================== */

    let serverEvents = [];

    const SERVER_TYPES = {
        grade: { category: "grading", icon: "clipboard-check" },
        account_locked: { category: "security", icon: "lock" }
    };

    function getApiToken() {
        try {
            return sessionStorage.getItem("authToken")
                || localStorage.getItem("siknayan_api_token")
                || "";
        } catch (error) {
            return "";
        }
    }

    async function notificationApi(path, method = "GET") {
        const response = await fetch(
            `${window.SIKNAYAN_API_ROOT}/admin/notifications${path}`,
            {
                method,
                headers: {
                    Accept: "application/json",
                    Authorization: `Bearer ${getApiToken()}`
                }
            }
        );

        if (response.status === 401) {
            window.location.replace("../../index.html");
            throw new Error("Your session has ended. Please log in again.");
        }

        const data = await response.json().catch(() => null);

        if (!response.ok || !data || data.success === false) {
            throw new Error(
                data?.message || `The server returned an error (${response.status}).`
            );
        }

        return data;
    }

    function toEvent(record) {
        const known = SERVER_TYPES[record.type] || { category: "system", icon: "bell" };

        return {
            id: String(record.id),
            type: record.type || "system",
            category: known.category,
            icon: known.icon,
            title: record.title,
            message: record.message,
            createdAt: record.created_at,
            priority: record.type === "account_locked" ? "high" : "normal"
        };
    }

    function showLoadError(message) {
        if (footerText) {
            footerText.textContent = message;
        }
    }

    // Change state on screen first, then tell the server. If the server
    // refuses, put the screen back the way it was.
    async function syncChange(ids, request, undo) {
        try {
            await Promise.all(ids.map(request));
        } catch (error) {
            console.error("Notifications: unable to save change.", error);
            undo();
            render();
            showLoadError(`Couldn't save that change: ${error.message}`);
        }
    }



    /* =====================================================
       GENERAL HELPERS
    ===================================================== */

    function text(
        value
    ) {

        return String(
            value ?? ""
        ).trim();

    }



    function norm(
        value
    ) {

        return text(
            value
        )

            .toLowerCase()

            .replace(
                /[_-]+/g,
                " "
            )

            .replace(
                /\s+/g,
                " "
            );

    }



    function escapeHtml(
        value
    ) {

        return text(
            value
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



    function escapeAttribute(
        value
    ) {

        return escapeHtml(
            value
        );

    }



    /* =====================================================
       STATE STORAGE
    ===================================================== */

    function readState() {

        try {

            const raw =
                localStorage.getItem(
                    STATE_STORAGE_KEY
                );


            if (!raw) {
                return null;
            }


            return JSON.parse(
                raw
            );

        } catch (error) {

            console.error(
                "Notifications: unable to read notification state.",
                error
            );

            return null;

        }

    }



    function saveNotificationState() {
        // Read/deleted state lives on the server now; nothing to store here.
    }



    function loadNotificationState() {

        const stored =
            readState();


        if (
            stored &&
            typeof stored === "object" &&
            !Array.isArray(stored)
        ) {

            /*
             * Current format:
             *
             * {
             *     read: {},
             *     deleted: {}
             * }
             */

            if (
                stored.read ||
                stored.deleted
            ) {

                return {

                    read:
                        stored.read || {},

                    deleted:
                        stored.deleted || {}

                };

            }


            /*
             * Migration from the earlier format:
             *
             * {
             *     notification-id: true
             * }
             */

            const migratedRead =
                {};


            Object.entries(
                stored
            ).forEach(
                (
                    [
                        id,
                        value
                    ]
                ) => {

                    if (
                        value === true
                    ) {

                        migratedRead[id] =
                            true;

                    }

                }
            );


            return {

                read:
                    migratedRead,

                deleted:
                    {}

            };

        }


        return {

            read:
                {},

            deleted:
                {}

        };

    }



    /* =====================================================
       PROTOTYPE EVENT DATA
       -----------------------------------------------------
       These records demonstrate the Notification Center
       until actual learner/instructor actions are connected.

       IMPORTANT:

       These are EVENTS, not Dashboard state conditions.
    ===================================================== */

    const DEMO_EVENTS = [

        /* =================================================
           SUBMISSION
        ================================================= */

        {

            id:
                "evt-20260927-001",

            type:
                "new-submission",

            category:
                "submission",

            title:
                "New Module Submission",

            message:
                "Deck Son submitted Research Methods.",

            sourceType:
                "module-submission",

            sourceId:
                "23-00349-research-methods",

            actorId:
                "23-00349",

            actorName:
                "Deck Son",

            recipientRole:
                "academic-admin",

            subjectType:
                "learner",

            subjectId:
                "23-00349",

            createdAt:
                "2026-09-27T14:02:00+08:00",

            priority:
                "normal",

            icon:
                "file-plus-2",

            actionLabel:
                "View Learner",

            actionHref:
                "learner-details.html?id=23-00349",

            metadata: {

                studentId:
                    "23-00349",

                learnerName:
                    "Deck Son",

                program:
                    "BSCRIM",

                module:
                    "Research Methods",

                event:
                    "Module submitted"

            }

        },


        /* =================================================
           GRADING
        ================================================= */

        {

            id:
                "evt-20260927-002",

            type:
                "awaiting-grade",

            category:
                "grading",

            title:
                "Awaiting Grade",

            message:
                "Hideo Kojima submitted IT Fundamentals and the submission is awaiting assessment.",

            sourceType:
                "module-submission",

            sourceId:
                "23-00412-it-fundamentals",

            actorId:
                "23-00412",

            actorName:
                "Hideo Kojima",

            recipientRole:
                "academic-admin",

            subjectType:
                "learner",

            subjectId:
                "23-00412",

            createdAt:
                "2026-09-27T12:10:00+08:00",

            priority:
                "high",

            icon:
                "file-clock",

            actionLabel:
                "View Learner",

            actionHref:
                "learner-details.html?id=23-00412",

            metadata: {

                studentId:
                    "23-00412",

                learnerName:
                    "Hideo Kojima",

                program:
                    "BSCRIM",

                module:
                    "IT Fundamentals",

                event:
                    "Submission awaiting assessment"

            }

        },


        /* =================================================
           GRADE POSTED
        ================================================= */

        {

            id:
                "evt-20260927-003",

            type:
                "grade-posted",

            category:
                "grading",

            title:
                "Grade Posted",

            message:
                "Quinlan Tarantino posted a grade for CRIM 101 - Module 1.",

            sourceType:
                "assessment",

            sourceId:
                "crim101-module1",

            actorId:
                "instructor-001",

            actorName:
                "Quinlan Tarantino",

            recipientRole:
                "academic-admin",

            subjectType:
                "learner",

            subjectId:
                "23-00349",

            createdAt:
                "2026-09-27T10:18:00+08:00",

            priority:
                "normal",

            icon:
                "clipboard-check",

            actionLabel:
                "View Learner",

            actionHref:
                "learner-details.html?id=23-00349",

            metadata: {

                instructor:
                    "Quinlan Tarantino",

                studentId:
                    "23-00349",

                learnerName:
                    "Deck Son",

                program:
                    "BSCRIM",

                module:
                    "CRIM 101 - Module 1",

                event:
                    "Grade posted"

            }

        },


        /* =================================================
           MODULE COMPLETION
        ================================================= */

        {

            id:
                "evt-20260927-004",

            type:
                "module-completed",

            category:
                "status",

            title:
                "Module Completed",

            message:
                "Deck Son completed Criminal Investigation.",

            sourceType:
                "learner-module",

            sourceId:
                "23-00349-criminal-investigation",

            actorId:
                "23-00349",

            actorName:
                "Deck Son",

            recipientRole:
                "academic-admin",

            subjectType:
                "learner",

            subjectId:
                "23-00349",

            createdAt:
                "2026-09-27T08:42:00+08:00",

            priority:
                "normal",

            icon:
                "circle-check",

            actionLabel:
                "View Learner",

            actionHref:
                "learner-details.html?id=23-00349",

            metadata: {

                studentId:
                    "23-00349",

                learnerName:
                    "Deck Son",

                program:
                    "BSCRIM",

                module:
                    "Criminal Investigation",

                event:
                    "Module completed"

            }

        },


        /* =================================================
           LEARNER ASSIGNED TO CLASS
        ================================================= */

        {

            id:
                "evt-20260926-005",

            type:
                "learner-class-assigned",

            category:
                "status",

            title:
                "Learner Assigned to Class",

            message:
                "Neo Camaa was assigned to BSOA-101.",

            sourceType:
                "class-membership",

            sourceId:
                "BSOA-101",

            actorId:
                "academic-admin",

            actorName:
                "Academic Administrator",

            recipientRole:
                "academic-admin",

            subjectType:
                "learner",

            subjectId:
                "23-00428",

            createdAt:
                "2026-09-26T15:05:00+08:00",

            priority:
                "normal",

            icon:
                "user-round-plus",

            actionLabel:
                "View Class",

            actionHref:
                "class-details.html?id=class-bsoa-101",

            metadata: {

                studentId:
                    "23-00428",

                learnerName:
                    "Neo Camaa",

                program:
                    "BSOA",

                classCode:
                    "BSOA-101",

                event:
                    "Learner assigned to class"

            }

        },


        /* =================================================
           INSTRUCTOR ASSIGNED
        ================================================= */

        {

            id:
                "evt-20260926-006",

            type:
                "instructor-assigned",

            category:
                "status",

            title:
                "Instructor Assigned",

            message:
                "Hidetaka Miyaazaki was assigned to BSCRIM-102.",

            sourceType:
                "class-instructor",

            sourceId:
                "BSCRIM-102",

            actorId:
                "academic-admin",

            actorName:
                "Academic Administrator",

            recipientRole:
                "academic-admin",

            subjectType:
                "class",

            subjectId:
                "BSCRIM-102",

            createdAt:
                "2026-09-26T11:35:00+08:00",

            priority:
                "normal",

            icon:
                "graduation-cap",

            actionLabel:
                "View Class",

            actionHref:
                "class-details.html?id=class-bscrim-102",

            metadata: {

                instructor:
                    "Hidetaka Miyaazaki",

                classCode:
                    "BSCRIM-102",

                event:
                    "Instructor assigned"

            }

        },


        /* =================================================
           LEARNER STATUS CHANGED
        ================================================= */

        {

            id:
                "evt-20260925-007",

            type:
                "learner-status-changed",

            category:
                "status",

            title:
                "Learner Status Changed",

            message:
                "Neo Camaa's status changed to Active.",

            sourceType:
                "learner",

            sourceId:
                "23-00428",

            actorId:
                "academic-admin",

            actorName:
                "Academic Administrator",

            recipientRole:
                "academic-admin",

            subjectType:
                "learner",

            subjectId:
                "23-00428",

            createdAt:
                "2026-09-25T16:20:00+08:00",

            priority:
                "normal",

            icon:
                "user-round-cog",

            actionLabel:
                "View Learner",

            actionHref:
                "learner-details.html?id=23-00428",

            metadata: {

                studentId:
                    "23-00428",

                learnerName:
                    "Neo Camaa",

                program:
                    "BSOA",

                newStatus:
                    "Active",

                event:
                    "Learner status changed"

            }

        },


        /* =================================================
           CLASS UPDATED
        ================================================= */

        {

            id:
                "evt-20260925-008",

            type:
                "class-updated",

            category:
                "status",

            title:
                "Class Updated",

            message:
                "BSCRIM-102 class information was updated.",

            sourceType:
                "class",

            sourceId:
                "class-bscrim-102",

            actorId:
                "academic-admin",

            actorName:
                "Academic Administrator",

            recipientRole:
                "academic-admin",

            subjectType:
                "class",

            subjectId:
                "class-bscrim-102",

            createdAt:
                "2026-09-25T13:14:00+08:00",

            priority:
                "normal",

            icon:
                "book-open-check",

            actionLabel:
                "View Class",

            actionHref:
                "class-details.html?id=class-bscrim-102",

            metadata: {

                classCode:
                    "BSCRIM-102",

                event:
                    "Class information updated"

            }

        },


        /* =================================================
           SYSTEM
        ================================================= */

        {

            id:
                "evt-20260924-009",

            type:
                "system-maintenance",

            category:
                "system",

            title:
                "System Notification",

            message:
                "Scheduled maintenance is planned for September 28, 2026 from 10:00 PM to 12:00 AM.",

            sourceType:
                "system",

            sourceId:
                "maintenance-20260928",

            actorId:
                "system",

            actorName:
                "Siknayan",

            recipientRole:
                "academic-admin",

            subjectType:
                "system",

            subjectId:
                "maintenance-20260928",

            createdAt:
                "2026-09-24T16:00:00+08:00",

            priority:
                "normal",

            icon:
                "settings",

            actionLabel:
                "",

            actionHref:
                "",

            metadata: {

                event:
                    "Scheduled system maintenance"

            }

        }

    ];



    /* =====================================================
       DEMO EVENT INITIALIZATION
       -----------------------------------------------------
       Only seeds the prototype dataset when the event store
       is empty.

       Once real producers are connected, this function can
       be removed without changing the notification UI.
    ===================================================== */

    function ensureDemoEvents() {
        // Demo notifications are no longer created; the page shows the
        // administrator's real notifications from the server.
    }



    /* =====================================================
       LOAD EVENTS
    ===================================================== */

    function loadEvents() {
        return serverEvents;
    }



    /* =====================================================
       NORMALIZE EVENT
    ===================================================== */

    function normalizeEvent(
        event
    ) {

        const metadata =
            event?.metadata &&
            typeof event.metadata ===
                "object"

                ? event.metadata

                : {};


        return {

            id:
                text(
                    event?.id
                ),

            type:
                text(
                    event?.type
                ) ||
                "system",

            category:
                text(
                    event?.category
                ) ||
                "system",

            title:
                text(
                    event?.title
                ) ||
                "Notification",

            message:
                text(
                    event?.message
                ),

            sourceType:
                text(
                    event?.sourceType
                ),

            sourceId:
                text(
                    event?.sourceId
                ),

            actorId:
                text(
                    event?.actorId
                ),

            actorName:
                text(
                    event?.actorName
                ),

            recipientRole:
                text(
                    event?.recipientRole
                ),

            recipientId:
                text(
                    event?.recipientId
                ),

            subjectType:
                text(
                    event?.subjectType
                ),

            subjectId:
                text(
                    event?.subjectId
                ),

            createdAt:
                event?.createdAt ||
                null,

            priority:
                text(
                    event?.priority
                ) ||
                "normal",

            icon:
                text(
                    event?.icon
                ) ||
                "bell",

            actionLabel:
                text(
                    event?.actionLabel
                ),

            actionHref:
                text(
                    event?.actionHref
                ),

            metadata

        };

    }



    /* =====================================================
       DATE HELPERS
    ===================================================== */

    function parseDate(
        value
    ) {

        if (!value) {
            return null;
        }


        const date =
            new Date(
                value
            );


        if (
            Number.isNaN(
                date.getTime()
            )
        ) {

            return null;

        }


        return date;

    }



    function formatAbsoluteDate(
        value
    ) {

        const date =
            parseDate(
                value
            );


        if (!date) {
            return "";
        }


        return new Intl.DateTimeFormat(
            "en-PH",
            {

                month:
                    "long",

                day:
                    "numeric",

                year:
                    "numeric",

                hour:
                    "numeric",

                minute:
                    "2-digit"

            }
        ).format(
            date
        );

    }



    function formatRelativeTime(
        value
    ) {

        const date =
            parseDate(
                value
            );


        if (!date) {

            return "Current";

        }


        const difference =
            Math.max(
                0,
                Date.now() -
                date.getTime()
            );


        const seconds =
            Math.floor(
                difference /
                1000
            );


        if (
            seconds < 60
        ) {

            return "Just now";

        }


        const minutes =
            Math.floor(
                seconds /
                60
            );


        if (
            minutes < 60
        ) {

            return `${minutes} ${
                minutes === 1
                    ? "minute"
                    : "minutes"
            } ago`;

        }


        const hours =
            Math.floor(
                minutes /
                60
            );


        if (
            hours < 24
        ) {

            return `${hours} ${
                hours === 1
                    ? "hour"
                    : "hours"
            } ago`;

        }


        const days =
            Math.floor(
                hours /
                24
            );


        if (
            days < 7
        ) {

            return `${days} ${
                days === 1
                    ? "day"
                    : "days"
            } ago`;

        }


        return formatAbsoluteDate(
            value
        );

    }



    /* =====================================================
       READ / DELETE STATE
    ===================================================== */

    function isRead(
        notification
    ) {

        return Boolean(
            notificationState.read[
                notification.id
            ]
        );

    }



    function isDeleted(
        notification
    ) {

        return Boolean(
            notificationState.deleted[
                notification.id
            ]
        );

    }



    function markRead(
        id
    ) {
        const wasRead = Boolean(notificationState.read[id]);
        notificationState.read[id] = true;
        render();

        syncChange(
            [id],
            item => notificationApi(`/${encodeURIComponent(item)}/read`, "PATCH"),
            () => {
                if (!wasRead) delete notificationState.read[id];
            }
        );
    }



    function markUnread(
        id
    ) {
        const wasRead = Boolean(notificationState.read[id]);
        delete notificationState.read[id];
        render();

        syncChange(
            [id],
            item => notificationApi(`/${encodeURIComponent(item)}/unread`, "PATCH"),
            () => {
                if (wasRead) notificationState.read[id] = true;
            }
        );
    }



    function deleteNotification(
        id
    ) {
        const wasPreviewed = selectedNotificationId === id;

        notificationState.deleted[id] = true;
        selectedIds.delete(id);

        if (wasPreviewed) {
            selectedNotificationId = null;
        }

        render();

        syncChange(
            [id],
            item => notificationApi(`/${encodeURIComponent(item)}`, "DELETE"),
            () => {
                delete notificationState.deleted[id];

                if (wasPreviewed) {
                    selectedNotificationId = id;
                }
            }
        );
    }



    /* =====================================================
       FILTER
    ===================================================== */

    function matchesCurrentTab(
        notification
    ) {

        if (
            currentTab ===
            "all"
        ) {

            return true;

        }


        if (
            currentTab ===
            "unread"
        ) {

            return !isRead(
                notification
            );

        }


        return (
            notification.category ===
            currentTab
        );

    }



    function getVisibleNotifications() {

        const search =
            norm(
                searchInput?.value
            );


        return notifications.filter(
            notification => {

                if (
                    !matchesCurrentTab(
                        notification
                    )
                ) {

                    return false;

                }


                if (!search) {

                    return true;

                }


                const searchableValues = [

                    notification.title,

                    notification.message,

                    notification.actorName,

                    notification.subjectId,

                    notification.sourceType,

                    notification.metadata?.learnerName,

                    notification.metadata?.studentId,

                    notification.metadata?.program,

                    notification.metadata?.module,

                    notification.metadata?.classCode,

                    notification.metadata?.course,

                    notification.metadata?.instructor,

                    notification.metadata?.event

                ];


                return searchableValues.some(
                    value =>

                        norm(
                            value
                        ).includes(
                            search
                        )

                );

            }
        );

    }



    /* =====================================================
       CATEGORY COUNTS
    ===================================================== */

    function countUnreadByCategory(
        category
    ) {

        return notifications.filter(
            notification =>

                notification.category ===
                    category &&

                !isRead(
                    notification
                )

        ).length;

    }



    function updateTabCounts() {

        const allCount =
            notifications.length;


        const unreadCount =
            notifications.filter(
                notification =>
                    !isRead(
                        notification
                    )
            ).length;


        const setCount =
            (
                elementId,
                value
            ) => {

                const element =
                    document.getElementById(
                        elementId
                    );


                if (!element) {
                    return;
                }


                element.textContent =
                    value;


                element.hidden =
                    value <= 0;

            };


        setCount(
            "tabAllCount",
            allCount
        );


        setCount(
            "tabUnreadCount",
            unreadCount
        );


        setCount(
            "tabSecurityCount",
            countUnreadByCategory(
                "security"
            )
        );


        setCount(
            "tabGradingCount",
            countUnreadByCategory(
                "grading"
            )
        );


        setCount(
            "tabStatusCount",
            countUnreadByCategory(
                "status"
            )
        );


        setCount(
            "tabSystemCount",
            countUnreadByCategory(
                "system"
            )
        );


        document
            .querySelectorAll(
                ".notification-dot"
            )
            .forEach(
                dot => {

                    dot.classList.toggle(
                        "is-hidden",
                        unreadCount === 0
                    );

                }
            );

    }



    /* =====================================================
       CATEGORY LABEL
    ===================================================== */

    function getCategoryLabel(
        category
    ) {

        switch (
            category
        ) {

            case "security":
                return "Security";

            case "grading":
                return "Grading";

            case "status":
                return "Status";

            case "system":
                return "System";

            default:
                return "Notification";

        }

    }



    /* =====================================================
       VISUAL CLASS
    ===================================================== */

    function getVisualClass(
        notification
    ) {

        switch (
            notification.category
        ) {

            case "security":
                return "notification-visual-system";

            case "grading":
                return "notification-visual-grading";

            case "system":
                return "notification-visual-system";

            case "status":
            default:
                return "notification-visual-status";

        }

    }



    /* =====================================================
       PAGINATION HELPERS
    ===================================================== */

    function getCurrentPageItems() {

        const visible =
            getVisibleNotifications();


        const start =
            (
                currentPage -
                1
            ) * PAGE_SIZE;


        return visible.slice(
            start,
            start +
            PAGE_SIZE
        );

    }



    /* =====================================================
       SELECTION CONTROLS
    ===================================================== */

    function syncSelectionControls() {

        const pageItems =
            getCurrentPageItems();


        const selectedOnPage =
            pageItems.filter(
                notification =>
                    selectedIds.has(
                        notification.id
                    )
            ).length;


        if (
            selectAllCheckbox
        ) {

            selectAllCheckbox.checked =
                pageItems.length > 0 &&
                selectedOnPage ===
                    pageItems.length;


            selectAllCheckbox.indeterminate =
                selectedOnPage > 0 &&
                selectedOnPage <
                    pageItems.length;

        }


        const hasSelection =
            selectedIds.size >
            0;


        if (
            markSelectedReadButton
        ) {

            markSelectedReadButton.disabled =
                !hasSelection;

        }


        if (
            deleteSelectedButton
        ) {

            deleteSelectedButton.disabled =
                !hasSelection;

        }

    }



    /* =====================================================
       RENDER NOTIFICATION LIST
    ===================================================== */

    function renderList() {

        const visible =
            getVisibleNotifications();


        const totalPages =
            Math.max(
                1,
                Math.ceil(
                    visible.length /
                    PAGE_SIZE
                )
            );


        if (
            currentPage >
            totalPages
        ) {

            currentPage =
                totalPages;

        }


        const start =
            (
                currentPage -
                1
            ) * PAGE_SIZE;


        const pageItems =
            visible.slice(
                start,
                start +
                PAGE_SIZE
            );


        if (
            footerText
        ) {

            const first =
                visible.length
                    ? start + 1
                    : 0;


            const last =
                visible.length
                    ? Math.min(
                        start +
                        PAGE_SIZE,
                        visible.length
                    )
                    : 0;


            footerText.textContent =
                `Showing ${first}–${last} of ${visible.length} notifications`;

        }


        if (
            !pageItems.length
        ) {

            notificationList.innerHTML =
                "";


            notificationListEmpty.hidden =
                false;


            renderPagination(
                totalPages
            );


            syncSelectionControls();

            return;

        }


        notificationListEmpty.hidden =
            true;


        notificationList.innerHTML =
            pageItems
                .map(
                    notification => {

                        const read =
                            isRead(
                                notification
                            );


                        const selected =
                            selectedIds.has(
                                notification.id
                            );


                        const active =
                            selectedNotificationId ===
                            notification.id;


                        return `

                            <article
                                class="
                                    notification-row
                                    ${
                                        read
                                            ? "is-read"
                                            : "is-unread"
                                    }
                                    ${
                                        active
                                            ? "is-selected"
                                            : ""
                                    }
                                "
                                data-notification-row="${escapeAttribute(
                                    notification.id
                                )}"
                            >

                                <label
                                    class="notification-row-checkbox"
                                >

                                    <input
                                        type="checkbox"
                                        data-select-notification="${escapeAttribute(
                                            notification.id
                                        )}"
                                        ${
                                            selected
                                                ? "checked"
                                                : ""
                                        }
                                    >

                                </label>


                                <button
                                    type="button"
                                    class="notification-row-main"
                                    data-open-notification="${escapeAttribute(
                                        notification.id
                                    )}"
                                >

                                    <span
                                        class="
                                            notification-row-icon
                                            ${getVisualClass(
                                                notification
                                            )}
                                        "
                                    >

                                        <i
                                            data-lucide="${escapeAttribute(
                                                notification.icon
                                            )}"
                                        ></i>

                                    </span>


                                    <span
                                        class="notification-row-copy"
                                    >

                                        <span
                                            class="
                                                notification-row-title-line
                                            "
                                        >

                                            <strong>
                                                ${escapeHtml(
                                                    notification.title
                                                )}
                                            </strong>


                                            ${
                                                !read
                                                    ? `
                                                        <span
                                                            class="
                                                                notification-row-unread
                                                            "
                                                            title="Unread"
                                                        ></span>
                                                    `
                                                    : ""
                                            }

                                        </span>


                                        <span
                                            class="
                                                notification-row-message
                                            "
                                        >

                                            ${escapeHtml(
                                                notification.message
                                            )}

                                        </span>

                                    </span>


                                    <span
                                        class="
                                            notification-row-meta
                                        "
                                    >

                                        ${escapeHtml(
                                            formatRelativeTime(
                                                notification.createdAt
                                            )
                                        )}

                                    </span>

                                </button>

                            </article>

                        `;

                    }
                )
                .join("");


        renderPagination(
            totalPages
        );


        syncSelectionControls();

        bindListEvents();

        refreshIcons();

    }



    /* =====================================================
       PAGINATION
    ===================================================== */

    function renderPagination(
        totalPages
    ) {

        if (!pagination) {
            return;
        }


        if (
            totalPages <=
            1
        ) {

            pagination.innerHTML =
                "";

            return;

        }


        let html = `

            <button
                type="button"
                class="notifications-page-button"
                data-page="${
                    Math.max(
                        1,
                        currentPage - 1
                    )
                }"
                ${
                    currentPage <= 1
                        ? "disabled"
                        : ""
                }
                aria-label="Previous page"
            >

                <i data-lucide="chevron-left"></i>

            </button>

        `;


        for (
            let pageNumber = 1;
            pageNumber <= totalPages;
            pageNumber++
        ) {

            html += `

                <button
                    type="button"
                    class="
                        notifications-page-number
                        ${
                            pageNumber ===
                            currentPage
                                ? "active"
                                : ""
                        }
                    "
                    data-page="${pageNumber}"
                >

                    ${pageNumber}

                </button>

            `;

        }


        html += `

            <button
                type="button"
                class="notifications-page-button"
                data-page="${
                    Math.min(
                        totalPages,
                        currentPage + 1
                    )
                }"
                ${
                    currentPage >= totalPages
                        ? "disabled"
                        : ""
                }
                aria-label="Next page"
            >

                <i data-lucide="chevron-right"></i>

            </button>

        `;


        pagination.innerHTML =
            html;


        pagination
            .querySelectorAll(
                "[data-page]"
            )
            .forEach(
                button => {

                    button.addEventListener(
                        "click",
                        () => {

                            currentPage =
                                Number(
                                    button.dataset.page
                                );


                            renderList();

                        }
                    );

                }
            );


        refreshIcons();

    }



    /* =====================================================
       PREVIEW
    ===================================================== */

    function renderPreview() {

        const notification =
            notifications.find(
                item =>
                    item.id ===
                    selectedNotificationId
            );


        if (!notification) {

            previewEmpty.hidden =
                false;


            previewContent.hidden =
                true;


            previewContent.innerHTML =
                "";


            return;

        }


        const read =
            isRead(
                notification
            );


        const metadata =
            notification.metadata ||
            {};


        const details =
            [];


        /* -------------------------------------------------
           DETAILS
        ------------------------------------------------- */

        if (
            metadata.studentId
        ) {

            details.push({

                label:
                    "Student ID",

                value:
                    metadata.studentId

            });

        }


        if (
            metadata.learnerName
        ) {

            details.push({

                label:
                    "Learner",

                value:
                    metadata.learnerName

            });

        }


        if (
            metadata.program
        ) {

            details.push({

                label:
                    "Program",

                value:
                    metadata.program

            });

        }


        if (
            metadata.module
        ) {

            details.push({

                label:
                    "Module",

                value:
                    metadata.module

            });

        }


        if (
            metadata.course
        ) {

            details.push({

                label:
                    "Course",

                value:
                    metadata.course

            });

        }


        if (
            metadata.classCode
        ) {

            details.push({

                label:
                    "Class",

                value:
                    metadata.classCode

            });

        }


        if (
            metadata.instructor
        ) {

            details.push({

                label:
                    "Instructor",

                value:
                    metadata.instructor

            });

        }


        if (
            metadata.event
        ) {

            details.push({

                label:
                    "Event",

                value:
                    metadata.event

            });

        }


        previewEmpty.hidden =
            true;


        previewContent.hidden =
            false;


        previewContent.innerHTML = `

            <div
                class="notification-preview-header"
            >

                <div
                    class="
                        notification-preview-icon
                        ${getVisualClass(
                            notification
                        )}
                    "
                >

                    <i
                        data-lucide="${escapeAttribute(
                            notification.icon
                        )}"
                    ></i>

                </div>


                <div
                    class="
                        notification-preview-heading
                    "
                >

                    <span
                        class="
                            notification-preview-category
                            ${escapeAttribute(
                                notification.category
                            )}
                        "
                    >

                        ${escapeHtml(
                            getCategoryLabel(
                                notification.category
                            )
                        )}

                    </span>


                    <h3>

                        ${escapeHtml(
                            notification.title
                        )}

                    </h3>

                </div>

            </div>


            <div
                class="
                    notification-preview-time
                "
            >

                ${
                    notification.createdAt

                        ? escapeHtml(
                            formatAbsoluteDate(
                                notification.createdAt
                            )
                        )

                        : "Notification event"
                }

            </div>


            ${
                notification.actorName

                    ? `
                        <div
                            class="
                                notification-preview-actor
                            "
                        >

                            <span>
                                Actor
                            </span>

                            <strong>
                                ${escapeHtml(
                                    notification.actorName
                                )}
                            </strong>

                        </div>
                    `

                    : ""
            }


            <p
                class="
                    notification-preview-message
                "
            >

                ${escapeHtml(
                    notification.message
                )}

            </p>


            ${
                details.length

                    ? `

                        <div
                            class="
                                notification-preview-details
                            "
                        >

                            ${details
                                .map(
                                    detail => `

                                        <div
                                            class="
                                                notification-detail-row
                                            "
                                        >

                                            <span>
                                                ${escapeHtml(
                                                    detail.label
                                                )}
                                            </span>

                                            <strong>
                                                ${escapeHtml(
                                                    detail.value
                                                )}
                                            </strong>

                                        </div>

                                    `
                                )
                                .join("")}

                        </div>

                    `

                    : ""
            }


            <div
                class="
                    notification-preview-actions
                "
            >

                ${
                    notification.actionHref

                        ? `

                            <a
                                href="${escapeAttribute(
                                    notification.actionHref
                                )}"
                                class="
                                    notification-preview-view
                                "
                            >

                                <i
                                    data-lucide="external-link"
                                ></i>

                                ${escapeHtml(
                                    notification.actionLabel ||
                                    "View"
                                )}

                            </a>

                        `

                        : ""
                }


                <button
                    type="button"
                    class="
                        notification-preview-action
                    "
                    id="previewReadButton"
                >

                    <i
                        data-lucide="${
                            read
                                ? "mail"
                                : "mail-open"
                        }"
                    ></i>

                    ${
                        read
                            ? "Mark as Unread"
                            : "Mark as Read"
                    }

                </button>



            </div>

        `;


        const previewReadButton =
            document.getElementById(
                "previewReadButton"
            );


        const previewDeleteButton =
            document.getElementById(
                "previewDeleteButton"
            );


        previewReadButton?.addEventListener(
            "click",
            () => {

                if (
                    read
                ) {

                    markUnread(
                        notification.id
                    );

                } else {

                    markRead(
                        notification.id
                    );

                }

            }
        );


        previewDeleteButton?.addEventListener(
            "click",
            () => {

                deleteNotification(
                    notification.id
                );

            }
        );


        refreshIcons();

    }



    /* =====================================================
       LIST EVENTS
    ===================================================== */

    function bindListEvents() {

        document
            .querySelectorAll(
                "[data-open-notification]"
            )
            .forEach(
                button => {

                    button.addEventListener(
                        "click",
                        () => {

                            const id =
                                button.dataset
                                    .openNotification;


                            selectedNotificationId =
                                id;


                            const notification =
                                notifications.find(
                                    item =>
                                        item.id ===
                                        id
                                );


                            if (
                                notification &&
                                !isRead(
                                    notification
                                )
                            ) {

                                notificationState
                                    .read[id] =
                                    true;


                                saveNotificationState();

                            }


                            render();


                            // Phones: the details show under the list,
                            // so scroll down to them.
                            if (
                                window.matchMedia(
                                    "(max-width: 640px)"
                                ).matches &&
                                previewContent &&
                                !previewContent.hidden
                            ) {
                                previewContent
                                    .closest(".notification-preview")
                                    ?.scrollIntoView({
                                        behavior: "smooth",
                                        block: "start"
                                    });
                            }

                        }
                    );

                }
            );


        document
            .querySelectorAll(
                "[data-select-notification]"
            )
            .forEach(
                checkbox => {

                    checkbox.addEventListener(
                        "click",
                        event => {

                            event.stopPropagation();

                        }
                    );


                    checkbox.addEventListener(
                        "change",
                        () => {

                            const id =
                                checkbox.dataset
                                    .selectNotification;


                            if (
                                checkbox.checked
                            ) {

                                selectedIds.add(
                                    id
                                );

                            } else {

                                selectedIds.delete(
                                    id
                                );

                            }


                            syncSelectionControls();

                        }
                    );

                }
            );

    }



    /* =====================================================
       TAB EVENTS
    ===================================================== */

    tabButtons.forEach(
        button => {

            button.addEventListener(
                "click",
                () => {

                    currentTab =
                        button.dataset.tab;


                    currentPage =
                        1;


                    selectedIds.clear();


                    tabButtons.forEach(
                        tab => {

                            const active =
                                tab ===
                                button;


                            tab.classList.toggle(
                                "active",
                                active
                            );


                            tab.setAttribute(
                                "aria-selected",
                                String(
                                    active
                                )
                            );

                        }
                    );


                    render();

                }
            );

        }
    );



    /* =====================================================
       SEARCH
    ===================================================== */

    searchInput?.addEventListener(
        "input",
        () => {

            currentPage =
                1;


            selectedIds.clear();


            render();

        }
    );



    /* =====================================================
       SELECT ALL
    ===================================================== */

    selectAllCheckbox?.addEventListener(
        "change",
        () => {

            const items =
                getCurrentPageItems();


            items.forEach(
                notification => {

                    if (
                        selectAllCheckbox.checked
                    ) {

                        selectedIds.add(
                            notification.id
                        );

                    } else {

                        selectedIds.delete(
                            notification.id
                        );

                    }

                }
            );


            renderList();

        }
    );



    /* =====================================================
       MARK SELECTED AS READ
    ===================================================== */

    markSelectedReadButton?.addEventListener(
        "click",
        () => {
            const ids = Array.from(selectedIds)
                .filter(id => !notificationState.read[id]);

            ids.forEach(id => {
                notificationState.read[id] = true;
            });

            selectedIds.clear();
            render();

            syncChange(
                ids,
                item => notificationApi(`/${encodeURIComponent(item)}/read`, "PATCH"),
                () => ids.forEach(id => delete notificationState.read[id])
            );
        }
    );



    /* =====================================================
       MARK ALL AS READ
    ===================================================== */

    markAllReadButton?.addEventListener(
        "click",
        () => {
            const ids = notifications
                .map(notification => notification.id)
                .filter(id => !notificationState.read[id]);

            ids.forEach(id => {
                notificationState.read[id] = true;
            });

            selectedIds.clear();
            render();

            if (ids.length) {
                syncChange(
                    ["all"],
                    () => notificationApi("/read-all", "POST"),
                    () => ids.forEach(id => delete notificationState.read[id])
                );
            }
        }
    );



    /* =====================================================
       DELETE SELECTED
    ===================================================== */

    deleteSelectedButton?.addEventListener(
        "click",
        () => {
            const ids = Array.from(selectedIds);

            ids.forEach(id => {
                notificationState.deleted[id] = true;
            });

            selectedIds.clear();

            if (
                selectedNotificationId &&
                notificationState.deleted[selectedNotificationId]
            ) {
                selectedNotificationId = null;
            }

            render();

            syncChange(
                ids,
                item => notificationApi(`/${encodeURIComponent(item)}`, "DELETE"),
                () => ids.forEach(id => delete notificationState.deleted[id])
            );
        }
    );



    /* =====================================================
       NEW NOTIFICATION EVENT
       -----------------------------------------------------
       Other parts of Siknayan can create an event:

       SiknayanNotificationEvents.create({...});

       The open Notifications page will update immediately.
    ===================================================== */

    window.addEventListener(
        "siknayan:notification-created",
        () => {

            currentPage =
                1;


            selectedIds.clear();


            render();

        }
    );



    /* =====================================================
       MAIN RENDER
    ===================================================== */

    function render() {

        notifications =
            loadEvents()

                .map(
                    normalizeEvent
                )

                .filter(
                    notification =>

                        notification.id &&

                        !isDeleted(
                            notification
                        )

                )

                .sort(
                    (
                        first,
                        second
                    ) => {

                        const firstTime =
                            parseDate(
                                first.createdAt
                            )?.getTime() ||
                            0;


                        const secondTime =
                            parseDate(
                                second.createdAt
                            )?.getTime() ||
                            0;


                        return (
                            secondTime -
                            firstTime
                        );

                    }
                );


        updateTabCounts();


        renderList();


        renderPreview();

    }



    /* =====================================================
       INITIALIZATION
    ===================================================== */

    async function initializeFromServer() {
        try {
            const data = await notificationApi("");
            const records = Array.isArray(data.notifications)
                ? data.notifications
                : [];

            // Account set-up (status) notices are not shown here.
            serverEvents = records
                .filter(record => record.type !== "account_setup")
                .map(toEvent);
            notificationState = { read: {}, deleted: {} };

            records.forEach(record => {
                if (record.is_read) {
                    notificationState.read[String(record.id)] = true;
                }
            });
        } catch (error) {
            console.error("Notifications: unable to load from the server.", error);
            serverEvents = [];
            render();
            showLoadError(`Unable to load notifications: ${error.message}`);
            return;
        }



        notifications =
            loadEvents()

                .map(
                    normalizeEvent
                )

                .filter(
                    notification =>

                        notification.id &&

                        !isDeleted(
                            notification
                        )

                )

                .sort(
                    (
                        first,
                        second
                    ) => {

                        const firstTime =
                            parseDate(
                                first.createdAt
                            )?.getTime() ||
                            0;


                        const secondTime =
                            parseDate(
                                second.createdAt
                            )?.getTime() ||
                            0;


                        return (
                            secondTime -
                            firstTime
                        );

                    }
                );


        if (
            notifications.length > 0
        ) {

            const firstUnread =
                notifications.find(
                    notification =>
                        !isRead(
                            notification
                        )
                );


            selectedNotificationId =
                (
                    firstUnread ||
                    notifications[0]
                ).id;

        }


        render();
    }


    initializeFromServer();

})();