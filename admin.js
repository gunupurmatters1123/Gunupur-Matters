/* =========================================================
   GUNUPUR MATTERS
   ADMIN DASHBOARD JAVASCRIPT

   Reports are loaded and updated through role-checked Supabase functions.
========================================================= */


/* =========================================================
   CONFIGURATION
========================================================= */

const ADMIN_CONFIG = {

    USE_API: true,

    STORAGE_KEY: "communityVoiceReports",

    REPORTS_PER_PAGE: 8

};


/* =========================================================
   GLOBAL STATE
========================================================= */

let reports = [];

let filteredReports = [];

let currentPage = 1;

let selectedReportId = null;

function safeGetStorageItem(key) {

    try {

        return localStorage.getItem(key);

    } catch (error) {

        console.warn("localStorage unavailable, falling back to sessionStorage:", error);

        try {

            return sessionStorage.getItem(key);

        } catch (fallbackError) {

            console.error("Storage unavailable in this browser:", fallbackError);

            return null;

        }

    }

}

function safeSetStorageItem(key, value) {

    try {

        localStorage.setItem(key, value);

        return true;

    } catch (error) {

        console.warn("localStorage write failed, falling back to sessionStorage:", error);

        try {

            sessionStorage.setItem(key, value);

            return true;

        } catch (fallbackError) {

            console.error("Storage write failed in this browser:", fallbackError);

            return false;

        }

    }

}


/* =========================================================
   DOM ELEMENTS
========================================================= */

const sidebar =
    document.getElementById("adminSidebar");

const sidebarToggle =
    document.getElementById("sidebarToggle");

const sidebarOverlay =
    document.getElementById("sidebarOverlay");

const reportsTableBody =
    document.getElementById("reportsTableBody");

const tableEmpty =
    document.getElementById("tableEmpty");

const tableSummary =
    document.getElementById("tableSummary");

const pagination =
    document.getElementById("pagination");

const reportDrawer =
    document.getElementById("reportDrawer");

const detailsOverlay =
    document.getElementById("detailsOverlay");

const drawerClose =
    document.getElementById("drawerClose");

const toast =
    document.getElementById("adminToast");

const toastClose =
    document.getElementById("toastClose");


/* =========================================================
   DATA SERVICE
========================================================= */


/*
    The production dashboard uses admin-gated Supabase RPCs.
    Local storage remains available only for development mode.
*/

async function getReports() {

    if (ADMIN_CONFIG.USE_API) {

        return await getReportsFromAPI();

    }

    return getReportsFromLocalStorage();

}


/* =========================================================
   LOCAL STORAGE
========================================================= */

function getReportsFromLocalStorage() {

    try {

        const stored =
            safeGetStorageItem(
                ADMIN_CONFIG.STORAGE_KEY
            );

        if (!stored) {

            return [];

        }

        const data =
            JSON.parse(stored);

        if (!Array.isArray(data)) {

            return [];

        }

        return data;

    } catch (error) {

        console.error(
            "Could not read reports:",
            error
        );

        return [];

    }

}


async function restoreArchivedReport(reportId) {
    try {
        if (await restoreAdminReportInSupabase(reportId) !== true) {
            throw new Error("The archived report was not found.");
        }
        showToast(
            "Report Restored",
            `Report ${reportId} has been restored to the active list.`,
            "success"
        );
        await loadDashboard();
    } catch (error) {
        console.error("Report restore failed:", error);
        showToast("Restore Failed", error.message || "Unable to restore the report.", "error");
    }
}


async function permanentlyDeleteArchivedReport(reportId) {
    try {
        const archivedReports = await getArchivedReportsFromSupabase();
        const report = archivedReports.find(item => String(item.id) === String(reportId));
        if (!report) {
            throw new Error("The archived report was not found.");
        }
        await removeArchivedReportFilesFromSupabase(report.attachments || []);
        if (await permanentlyDeleteAdminReportInSupabase(reportId) !== true) {
            throw new Error("The archived report was not found.");
        }
        showToast(
            "Archived Report Deleted",
            `${reportId} and its uploaded files have been permanently removed.`,
            "success"
        );
        await loadDashboard();
    } catch (error) {
        console.error("Permanent report deletion failed:", error);
        showToast("Delete Failed", error.message || "Unable to delete the archived report.", "error");
    }
}


async function renderArchive() {

    const archiveList =
        document.getElementById(
            "archiveList"
        );

    const archiveEmpty =
        document.getElementById(
            "archiveEmpty"
        );

    if (!archiveList || !archiveEmpty) {

        return;

    }

    let archivedReports;
    try {
        archivedReports = await getArchivedReportsFromSupabase();
        if (!Array.isArray(archivedReports)) {
            throw new Error("Supabase returned invalid archive data.");
        }
    } catch (error) {
        console.error("Could not load archived reports:", error);
        archiveList.replaceChildren();
        archiveEmpty.classList.remove("hidden");
        showToast("Archive Unavailable", error.message || "Unable to load archived reports.", "error");
        return;
    }

    archiveList.innerHTML = "";

    if (!archivedReports.length) {

        archiveEmpty.classList.remove("hidden");

        return;

    }

    archiveEmpty.classList.add("hidden");

    archivedReports
        .slice(0, 50)
        .forEach(report => {

            const item =
                document.createElement(
                    "div"
                );

            item.className = "archive-item";

            item.innerHTML = `

                <div class="archive-main">

                    <span class="archive-id">
                        ${escapeHtml(report.id || "—")}
                    </span>

                    <div class="archive-copy">
                        <strong>
                            ${escapeHtml(report.title || "Untitled report")}
                        </strong>

                        <span>
                            ${escapeHtml(report.category || "General")} • ${escapeHtml(report.location || "Unknown location")}
                        </span>
                    </div>

                </div>

                <div class="archive-meta">

                    <span class="status-badge ${statusClass(report.status)}">
                        ${escapeHtml(report.status || "Archived")}
                    </span>

                    <span class="priority-badge ${priorityClass(report.priority)}">
                        ${escapeHtml(report.priority || "—")}
                    </span>

                    <small>
                        ${escapeHtml(
                            new Date(
                                report.archivedAt || Date.now()
                            ).toLocaleString()
                        )}
                    </small>

                    <div class="archive-actions">
                        <button
                            class="archive-restore"
                            data-archive-id="${escapeHtml(report.id || "")}" 
                            type="button"
                        >
                            Restore
                        </button>

                        <button
                            class="archive-delete"
                            data-archive-id="${escapeHtml(report.id || "")}" 
                            type="button"
                        >
                            Delete
                        </button>
                    </div>

                </div>

            `;

            const restoreButton =
                item.querySelector(
                    ".archive-restore"
                );

            const deleteButton =
                item.querySelector(
                    ".archive-delete"
                );

            restoreButton.addEventListener(
                "click",
                async () => {

                    const id =
                        restoreButton.dataset.archiveId;

                    if (id) {

                        await restoreArchivedReport(id);

                    }

                }
            );

            deleteButton.addEventListener(
                "click",
                async () => {

                    const id =
                        deleteButton.dataset.archiveId;

                    if (id) {

                        const confirmed =
                            window.confirm(
                                `Permanently delete archived report ${id}?`
                            );

                        if (confirmed) {

                            await permanentlyDeleteArchivedReport(id);

                        }

                    }

                }
            );

            archiveList.appendChild(item);

        });

}


/* =========================================================
   SUPABASE API
========================================================= */

async function getReportsFromAPI() {

    try {
        const data = await getAdminReportsFromSupabase();
        if (!Array.isArray(data)) {
            throw new Error("Supabase returned invalid report data.");
        }
        return data;

    } catch (error) {

        console.error(error);

        showToast(
            "Unable to load reports",
            error.message || "Supabase could not provide report data.",
            "error"
        );

        return [];

    }

}


/* =========================================================
   UPDATE REPORT
========================================================= */

async function updateReportOnServer(
    reportId,
    status,
    note
) {

    if (!ADMIN_CONFIG.USE_API) {

        return updateReportLocalStorage(
            reportId,
            status,
            note
        );

    }


    try {

        const updated = await updateAdminReportInSupabase(reportId, status, note);
        if (updated !== true) {
            throw new Error("Report was not found or could not be updated.");
        }
        return true;

    } catch (error) {

        console.error(error);

        showToast(
            "Update Failed",
            error.message,
            "error"
        );

        return false;

    }

}


/* =========================================================
   LOCAL UPDATE
========================================================= */

function updateReportLocalStorage(
    reportId,
    status,
    note
) {

    try {

        const stored =
            localStorage.getItem(
                ADMIN_CONFIG.STORAGE_KEY
            );

        const localReports =
            stored
                ? JSON.parse(stored)
                : [];


        const report =
            localReports.find(
                item =>
                    item.id === reportId
            );


        if (!report) {

            return false;

        }


        report.status =
            status;


        report.lastUpdated =
            new Date().toISOString();


        /*
            Activity history structure.

            This is intentionally included now
            so that it can map naturally to a
            MySQL report_activity table later.
        */

        if (!Array.isArray(report.activity)) {

            report.activity = [];

        }


        report.activity.push({

            status: status,

            note: note || "",

            date:
                new Date().toISOString()

        });


        localStorage.setItem(
            ADMIN_CONFIG.STORAGE_KEY,
            JSON.stringify(localReports)
        );


        return true;

    } catch (error) {

        console.error(error);

        return false;

    }

}


/* =========================================================
   INITIALIZATION
========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    async () => {

        try {
            const { user } = await getAdminSession();
            const adminIdentity = document.querySelector(".user-info strong");
            if (adminIdentity) {
                adminIdentity.textContent = user.email || "Administrator";
            }
            await loadDashboard();

            setupNavigation();

            setupFilters();

            setupSidebar();

            setupDrawer();

            setupButtons();
            document.body.classList.remove("admin-auth-pending");
        } catch (error) {
            console.error("Admin authentication failed:", error);
            window.location.replace("adlog.html?reason=login");
        }

    }
);


/* =========================================================
   LOAD DASHBOARD
========================================================= */

async function loadDashboard() {

    reports =
        await getReports();


    /*
        Sort newest first.
    */

    reports.sort(
        (a, b) =>
            new Date(b.date || 0) -
            new Date(a.date || 0)
    );


    updateStatistics();

    populateCategoryFilter();

    applyFilters();

    renderActivity();

    renderAnalytics();

    renderArchive();

}


/* =========================================================
   STATISTICS
========================================================= */

function updateStatistics() {

    const total =
        reports.length;


    const review =
        reports.filter(
            report =>
                report.status ===
                "Under Review"
        ).length;


    const followup =
        reports.filter(
            report =>
                report.status ===
                "Follow-up Initiated"
        ).length;


    const high =
        reports.filter(
            report =>
                String(report.priority)
                    .toLowerCase() ===
                "high"
        ).length;


    const closed =
        reports.filter(
            report =>
                ["Completed", "Closed", "Resolved"]
                    .includes(report.status)
        ).length;


    setText(
        "totalReports",
        total
    );

    setText(
        "underReviewReports",
        review
    );

    setText(
        "followupReports",
        followup
    );

    setText(
        "highPriorityReports",
        high
    );

    setText(
        "closedReports",
        closed
    );


    setText(
        "sidebarReportCount",
        total
    );

    setText(
        "sidebarReviewCount",
        review
    );

    setText(
        "sidebarFollowupCount",
        followup
    );

    setText(
        "sidebarHighCount",
        high
    );

    setText(
        "sidebarClosedCount",
        closed
    );

}


/* =========================================================
   NAVIGATION
========================================================= */

function setupNavigation() {

    document
        .querySelectorAll(".sidebar-link[data-view]")
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    const view =
                        button.dataset.view;

                    showView(view);

                    closeSidebar();

                }
            );

        });


    document
        .querySelectorAll(
            ".sidebar-link[data-filter-status]"
        )
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    showView("reports");

                    const status =
                        button.dataset.filterStatus;

                    const allStatusFilter =
                        document.getElementById(
                            "allStatusFilter"
                        );

                    const allPriorityFilter =
                        document.getElementById(
                            "allPriorityFilter"
                        );

                    if (allStatusFilter) {

                        allStatusFilter.value = status;

                    }

                    if (allPriorityFilter) {

                        allPriorityFilter.value = "";

                    }

                    document
                        .querySelectorAll(
                            ".sidebar-link[data-filter-status]"
                        )
                        .forEach(item => {

                            item.classList.toggle(
                                "active",
                                item === button
                            );

                        });

                    renderReportsCards();

                    closeSidebar();

                }
            );

        });


    document
        .querySelectorAll(
            ".sidebar-link[data-filter-priority]"
        )
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    showView("reports");

                    const priority =
                        button.dataset.filterPriority;

                    const allPriorityFilter =
                        document.getElementById(
                            "allPriorityFilter"
                        );

                    const allStatusFilter =
                        document.getElementById(
                            "allStatusFilter"
                        );

                    if (allPriorityFilter) {

                        allPriorityFilter.value = priority;

                    }

                    if (allStatusFilter) {

                        allStatusFilter.value = "";

                    }

                    document
                        .querySelectorAll(
                            ".sidebar-link[data-filter-priority]"
                        )
                        .forEach(item => {

                            item.classList.toggle(
                                "active",
                                item === button
                            );

                        });

                    renderReportsCards();

                    closeSidebar();

                }
            );

        });

}


/* =========================================================
   SHOW VIEW
========================================================= */

function showView(view) {

    document
        .querySelectorAll(".admin-view")
        .forEach(section => {

            section.classList.remove("active");

        });


    const target =
        document.getElementById(
            `${view}View`
        );


    if (target) {

        target.classList.add("active");

    }


    document
        .querySelectorAll(".sidebar-link")
        .forEach(link => {

            link.classList.remove("active");

        });


    const matching =
        document.querySelector(
            `.sidebar-link[data-view="${view}"]`
        );


    if (matching) {

        matching.classList.add("active");

    }


    if (view === "reports") {

        renderReportsCards();

    }


    if (view === "analytics") {

        renderAnalytics();

    }

    if (view === "archive") {

        renderArchive();

    }

}


/* =========================================================
   SIDEBAR
========================================================= */

function setupSidebar() {

    sidebarToggle.addEventListener(
        "click",
        () => {

            sidebar.classList.toggle(
                "open"
            );

            sidebarOverlay.classList.toggle(
                "active"
            );

        }
    );


    sidebarOverlay.addEventListener(
        "click",
        closeSidebar
    );

}


function closeSidebar() {

    sidebar.classList.remove(
        "open"
    );

    sidebarOverlay.classList.remove(
        "active"
    );

}


function normalizeStatusValue(value) {

    const normalized = String(value || "").trim();

    if (!normalized) {

        return "";

    }

    const key = normalized.toLowerCase().replace(/\s+/g, " ");
    const statuses = {
        "pending review": "Pending Review",
        "submitted": "Report Submitted",
        "report submitted": "Report Submitted",
        "under review": "Under Review",
        "follow-up initiated": "Follow-up Initiated",
        "in progress": "Under Process",
        "under process": "Under Process",
        "completed": "Completed",
        "closed": "Completed",
        "resolved": "Completed"
    };

    return statuses[key] || normalized;

}

/* =========================================================
   FILTERS
========================================================= */

function setupFilters() {

    const search =
        document.getElementById(
            "reportSearch"
        );

    const status =
        document.getElementById(
            "statusFilter"
        );

    const category =
        document.getElementById(
            "categoryFilter"
        );

    const priority =
        document.getElementById(
            "priorityFilter"
        );


    [
        search,
        status,
        category,
        priority
    ].forEach(element => {

        element.addEventListener(
            "input",
            () => {

                currentPage = 1;

                applyFilters();

            }
        );

        element.addEventListener(
            "change",
            () => {

                currentPage = 1;

                applyFilters();

            }
        );

    });


    const allSearch =
        document.getElementById(
            "allReportSearch"
        );


    const allStatus =
        document.getElementById(
            "allStatusFilter"
        );


    const allPriority =
        document.getElementById(
            "allPriorityFilter"
        );


    [
        allSearch,
        allStatus,
        allPriority
    ].forEach(element => {

        element.addEventListener(
            "input",
            renderReportsCards
        );

        element.addEventListener(
            "change",
            renderReportsCards
        );

    });

}


/* =========================================================
   APPLY DASHBOARD FILTERS
========================================================= */

function applyFilters() {

    const search =
        document
            .getElementById(
                "reportSearch"
            )
            .value
            .trim()
            .toLowerCase();


    const status =
        document
            .getElementById(
                "statusFilter"
            )
            .value;


    const category =
        document
            .getElementById(
                "categoryFilter"
            )
            .value;


    const priority =
        document
            .getElementById(
                "priorityFilter"
            )
            .value;


    filteredReports =
        reports.filter(report => {

            const searchable = [

                report.id,

                report.title,

                report.location,

                report.category,

                report.name

            ]
                .join(" ")
                .toLowerCase();


            const matchesSearch =
                !search ||
                searchable.includes(search);


            const matchesStatus =
                !status ||
                normalizeStatusValue(report.status) ===
                normalizeStatusValue(status);


            const matchesCategory =
                !category ||
                report.category === category;


            const matchesPriority =
                !priority ||
                report.priority === priority;


            return (
                matchesSearch &&
                matchesStatus &&
                matchesCategory &&
                matchesPriority
            );

        });


    renderTable();

}


/* =========================================================
   CATEGORY FILTER
========================================================= */

function populateCategoryFilter() {

    const select =
        document.getElementById(
            "categoryFilter"
        );


    const categories =
        [
            ...new Set(
                reports
                    .map(
                        report =>
                            report.category
                    )
                    .filter(Boolean)
            )
        ]
        .sort();


    select.innerHTML = `

        <option value="">
            All Categories
        </option>

    `;


    categories.forEach(category => {

        const option =
            document.createElement(
                "option"
            );

        option.value = category;

        option.textContent = category;

        select.appendChild(option);

    });

}


/* =========================================================
   RENDER TABLE
========================================================= */

function renderTable() {

    const total =
        filteredReports.length;


    const pages =
        Math.ceil(
            total /
            ADMIN_CONFIG.REPORTS_PER_PAGE
        );


    if (currentPage > pages && pages > 0) {

        currentPage = pages;

    }


    const start =
        (currentPage - 1) *
        ADMIN_CONFIG.REPORTS_PER_PAGE;


    const pageReports =
        filteredReports.slice(
            start,
            start +
            ADMIN_CONFIG.REPORTS_PER_PAGE
        );


    reportsTableBody.innerHTML = "";


    if (!pageReports.length) {

        tableEmpty.classList.add(
            "active"
        );

        tableSummary.textContent =
            "Showing 0 reports";

        pagination.innerHTML = "";

        return;

    }


    tableEmpty.classList.remove(
        "active"
    );


    pageReports.forEach(
        report => {

            reportsTableBody
                .appendChild(
                    createTableRow(
                        report
                    )
                );

        }
    );


    const from =
        start + 1;


    const to =
        Math.min(
            start +
            pageReports.length,
            total
        );


    tableSummary.textContent =
        `Showing ${from}-${to} of ${total} reports`;


    renderPagination(pages);

}


/* =========================================================
   CREATE TABLE ROW
========================================================= */

function createTableRow(report) {

    const row =
        document.createElement("tr");


    row.innerHTML = `

        <td>

            <span class="report-id">

                ${escapeHtml(
                    report.id || "—"
                )}

            </span>

        </td>


        <td class="issue-title-cell">

            <span class="issue-title">

                ${escapeHtml(
                    report.title || "Untitled Issue"
                )}

            </span>

            <span class="issue-subtitle">

                ${escapeHtml(
                    report.name || "Public Report"
                )}

            </span>

        </td>


        <td>

            ${escapeHtml(
                report.category || "—"
            )}

        </td>


        <td>

            ${escapeHtml(
                report.location || "—"
            )}

        </td>


        <td>

            <span class="
                priority-badge
                ${priorityClass(
                    report.priority
                )}
            ">

                ${escapeHtml(
                    report.priority || "—"
                )}

            </span>

        </td>


        <td>

            <span class="
                status-badge
                ${statusClass(
                    report.status
                )}
            ">

                ${escapeHtml(
                    report.status || "—"
                )}

            </span>

        </td>


        <td>

            ${formatDate(
                report.date
            )}

        </td>


        <td>

            <button
                class="view-button"
                data-report-id="${escapeHtml(
                    report.id
                )}"
                title="View report"
            >

                <i class="fa-solid fa-eye"></i>

            </button>

        </td>

    `;


    row
        .querySelector(
            ".view-button"
        )
        .addEventListener(
            "click",
            () => {

                openReportDrawer(
                    report.id
                );

            }
        );


    return row;

}


/* =========================================================
   PAGINATION
========================================================= */

function renderPagination(totalPages) {

    pagination.innerHTML = "";


    if (totalPages <= 1) {

        return;

    }


    for (
        let page = 1;
        page <= totalPages;
        page++
    ) {

        const button =
            document.createElement(
                "button"
            );


        button.className =
            "page-button";


        if (page === currentPage) {

            button.classList.add(
                "active"
            );

        }


        button.textContent =
            page;


        button.addEventListener(
            "click",
            () => {

                currentPage =
                    page;

                renderTable();

            }
        );


        pagination.appendChild(
            button
        );

    }

}


/* =========================================================
   REPORT DRAWER
========================================================= */

function setupDrawer() {

    drawerClose.addEventListener(
        "click",
        closeReportDrawer
    );


    detailsOverlay.addEventListener(
        "click",
        closeReportDrawer
    );


    document
        .getElementById(
            "saveReportUpdate"
        )
        .addEventListener(
            "click",
            saveReportUpdate
        );


    document
        .getElementById(
            "deleteReportBtn"
        )
        .addEventListener(
            "click",
            deleteSelectedReport
        );

}


async function deleteSelectedReport() {

    if (!selectedReportId) {

        return;

    }

    const deleteReasonField =
        document.getElementById("deleteReason");

    const deleteReason =
        deleteReasonField
            ? deleteReasonField.value.trim()
            : "";

    if (!deleteReason) {

        showToast(
            "Reason Required",
            "Please enter why this report is being deleted before continuing.",
            "error"
        );

        if (deleteReasonField) {

            deleteReasonField.focus();

        }

        return;

    }

    const confirmed = window.confirm(
        `Delete report ${selectedReportId}?\n\nReason: ${deleteReason}`
    );

    if (!confirmed) {

        return;

    }

    try {
        if (await archiveAdminReportInSupabase(selectedReportId, deleteReason) !== true) {
            throw new Error("The report was not found or has already been archived.");
        }

        if (deleteReasonField) {

            deleteReasonField.value = "";

        }

        showToast(
            "Report Archived",
            `${selectedReportId} has been moved to the archive.`,
            "success"
        );

        closeReportDrawer();

        await loadDashboard();

    } catch (error) {

        console.error("Delete failed:", error);

        showToast(
            "Delete Failed",
            error.message || "The report could not be archived. Please try again.",
            "error"
        );

    }

}


function openReportDrawer(reportId) {

    const report =
        reports.find(
            item =>
                item.id === reportId
        );


    if (!report) {

        return;

    }


    selectedReportId =
        reportId;


    setText(
        "drawerReportId",
        report.id
    );


    setText(
        "drawerTitle",
        report.title || "Untitled Issue"
    );


    setText(
        "drawerCategory",
        report.category || "—"
    );


    setText(
        "drawerLocation",
        report.location || "—"
    );


    setText(
        "drawerDate",
        formatDateTime(report.date)
    );


    setText(
        "drawerUpdated",
        formatDateTime(
            report.lastUpdated ||
            report.date
        )
    );


    setText(
        "drawerReporter",
        report.name ||
        "Not provided"
    );


    setText(
        "drawerContact",
        report.contact ||
        "Not provided"
    );


    setText(
        "drawerDescription",
        report.description ||
        "No description provided."
    );


    const status =
        document.getElementById(
            "drawerStatus"
        );

    const reportStatus =
        normalizeStatusValue(report.status);

    status.textContent =
        reportStatus || "—";


    status.className =
        `status-badge ${statusClass(reportStatus)}`;


    const priority =
        document.getElementById(
            "drawerPriority"
        );


    priority.textContent =
        report.priority || "—";


    priority.className =
        `priority-badge ${priorityClass(
            report.priority
        )}`;


    document
        .getElementById(
            "drawerStatusSelect"
        )
        .value =
            reportStatus ||
            "Under Review";


    document
        .getElementById(
            "followupNote"
        )
        .value = "";


    setupDrawerAttachments(report);


    reportDrawer.classList.add(
        "active"
    );


    detailsOverlay.classList.add(
        "active"
    );


    document.body.style.overflow =
        "hidden";

}


function closeReportDrawer() {

    reportDrawer.classList.remove(
        "active"
    );


    detailsOverlay.classList.remove(
        "active"
    );


    document.body.style.overflow =
        "";

    selectedReportId = null;

}


/* =========================================================
   DRAWER PHOTO
========================================================= */

function setupDrawerAttachments(report) {
    const section =
        document.getElementById(
            "drawerPhotoSection"
        );
    const container = document.getElementById("drawerAttachments");
    const attachments = Array.isArray(report.attachments) && report.attachments.length
        ? report.attachments
        : report.photo
            ? [{
                file_name: report.file_name || "Uploaded file",
                file_path: report.photo,
                media_type: report.media_type || "image"
            }]
            : [];

    container.replaceChildren();
    if (attachments.length === 0) {
        section.style.display = "none";
        return;
    }

    section.style.display = "block";

    attachments.forEach(attachment => {
        if (!attachment || typeof attachment.file_path !== "string" || !attachment.file_path) {
            return;
        }
        let mediaUrl;
        try {
            mediaUrl = new URL(attachment.file_path, SUPABASE_PROJECT_URL);
        } catch (error) {
            return;
        }
        if (
            mediaUrl.origin !== new URL(SUPABASE_PROJECT_URL).origin
            || !mediaUrl.pathname.startsWith("/storage/v1/object/public/report-media/reports/")
        ) {
            return;
        }

        const item = document.createElement("div");
        item.className = "drawer-attachment";

        const media = document.createElement(
            attachment.media_type === "video" ? "video" : "img"
        );
        media.src = mediaUrl.href;
        if (attachment.media_type === "video") {
            media.controls = true;
            media.playsInline = true;
        } else {
            media.alt = attachment.file_name || "Uploaded report photo";
        }
        media.addEventListener("error", () => {
            media.hidden = true;
            const unavailable = document.createElement("p");
            unavailable.textContent = "Preview unavailable. Use the link below to open the uploaded file.";
            item.insertBefore(unavailable, media.nextSibling);
        }, { once: true });
        item.appendChild(media);

        const link = document.createElement("a");
        link.href = mediaUrl.href;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = "Open uploaded file";
        item.appendChild(link);

        if (attachment.file_name) {
            const name = document.createElement("p");
            name.textContent = attachment.file_name;
            item.appendChild(name);
        }
        container.appendChild(item);
    });

    if (container.childElementCount === 0) {
        section.style.display = "none";
    }

}


/* =========================================================
   SAVE STATUS UPDATE
========================================================= */

async function saveReportUpdate() {

    if (!selectedReportId) {

        return;

    }


    const status =
        document
            .getElementById(
                "drawerStatusSelect"
            )
            .value;


    const note =
        document
            .getElementById(
                "followupNote"
            )
            .value
            .trim();


    const success =
        await updateReportOnServer(
            selectedReportId,
            status,
            note
        );


    if (!success) {

        showToast(
            "Update Failed",
            "The report could not be updated.",
            "error"
        );

        return;

    }


    showToast(
        "Report Updated",
        `${selectedReportId} status updated successfully.`,
        "success"
    );


    closeReportDrawer();


    await loadDashboard();

}


/* =========================================================
   ALL REPORTS CARDS
========================================================= */

function renderReportsCards() {

    const container =
        document.getElementById(
            "reportsCardGrid"
        );


    const search =
        document
            .getElementById(
                "allReportSearch"
            )
            .value
            .trim()
            .toLowerCase();


    const status =
        document
            .getElementById(
                "allStatusFilter"
            )
            .value;


    const priority =
        document
            .getElementById(
                "allPriorityFilter"
            )
            .value;


    const result =
        reports.filter(
            report => {

                const searchable = [

                    report.id,
                    report.title,
                    report.location,
                    report.category,
                    report.name

                ]
                    .join(" ")
                    .toLowerCase();


                return (

                    (!search ||
                        searchable.includes(
                            search
                        ))

                    &&

                    (!status ||
                        normalizeStatusValue(report.status) ===
                        normalizeStatusValue(status))

                    &&

                    (!priority ||
                        report.priority ===
                        priority)

                );

            }
        );


    container.innerHTML = "";


    if (!result.length) {

        container.innerHTML = `

            <div class="table-empty active">

                <div class="empty-icon">

                    <i class="fa-solid fa-folder-open"></i>

                </div>

                <h3>
                    No reports found
                </h3>

                <p>
                    Try changing your filters.
                </p>

            </div>

        `;

        return;

    }


    result.forEach(report => {

        const card =
            document.createElement(
                "article"
            );


        card.className =
            "report-card";


        card.innerHTML = `

            <div class="report-card-top">

                <span class="report-id">

                    ${escapeHtml(
                        report.id
                    )}

                </span>

                <span class="
                    status-badge
                    ${statusClass(
                        report.status
                    )}
                ">

                    ${escapeHtml(
                        report.status || "—"
                    )}

                </span>

            </div>


            <h3>

                ${escapeHtml(
                    report.title ||
                    "Untitled Issue"
                )}

            </h3>


            <p class="report-card-location">

                <i class="fa-solid fa-location-dot"></i>

                ${escapeHtml(
                    report.location ||
                    "Location not provided"
                )}

            </p>


            <div class="report-card-meta">

                <span class="
                    priority-badge
                    ${priorityClass(
                        report.priority
                    )}
                ">

                    ${escapeHtml(
                        report.priority ||
                        "—"
                    )}

                </span>


                <span class="priority-badge">

                    ${escapeHtml(
                        report.category ||
                        "Other"
                    )}

                </span>

            </div>


            <div class="report-card-footer">

                <span class="report-card-date">

                    ${formatDate(
                        report.date
                    )}

                </span>


                <button
                    class="view-button"
                    title="View report"
                >

                    <i class="fa-solid fa-arrow-right"></i>

                </button>

            </div>

        `;


        card
            .querySelector(
                ".view-button"
            )
            .addEventListener(
                "click",
                () => {

                    openReportDrawer(
                        report.id
                    );

                }
            );


        container.appendChild(
            card
        );

    });

}


/* =========================================================
   RECENT ACTIVITY
========================================================= */

function renderActivity() {

    const container =
        document.getElementById(
            "activityList"
        );


    const recent =
        [...reports]
            .sort(
                (a,b) =>
                    new Date(
                        b.lastUpdated ||
                        b.date ||
                        0
                    )
                    -
                    new Date(
                        a.lastUpdated ||
                        a.date ||
                        0
                    )
            )
            .slice(0, 6);


    container.innerHTML = "";


    if (!recent.length) {

        container.innerHTML = `

            <div class="activity-item">

                <div class="activity-dot">

                    <i class="fa-solid fa-info"></i>

                </div>

                <div>

                    <strong>
                        No activity yet
                    </strong>

                    <p>
                        Public reports will appear here.
                    </p>

                </div>

            </div>

        `;

        return;

    }


    recent.forEach(report => {

        const item =
            document.createElement(
                "div"
            );


        item.className =
            "activity-item";


        item.innerHTML = `

            <div class="activity-dot">

                <i class="fa-solid fa-file-lines"></i>

            </div>


            <div>

                <strong>

                    ${escapeHtml(
                        report.id
                    )}

                </strong>

                <p>

                    ${escapeHtml(
                        report.title ||
                        "New report"
                    )}

                </p>

                <time>

                    ${formatRelativeDate(
                        report.lastUpdated ||
                        report.date
                    )}

                </time>

            </div>

        `;


        container.appendChild(
            item
        );

    });

}


/* =========================================================
   ANALYTICS
========================================================= */

function renderAnalytics() {

    renderStatusChart();

    renderCategoryChart();

    renderAnalyticsSummary();

}


/* =========================================================
   STATUS CHART
========================================================= */

function renderStatusChart() {

    const container =
        document.getElementById(
            "statusChart"
        );


    const statuses = [

        {
            name: "Pending Review",
            color: "",
            className: ""
        },

        {
            name: "Report Submitted",
            color: "",
            className: ""
        },

        {
            name: "Under Review",
            color: "",
            className: "orange"
        },

        {
            name: "Follow-up Initiated",
            color: "",
            className: "purple"
        },

        {
            name: "Under Process",
            color: "",
            className: ""
        },

        {
            name: "Completed",
            color: "",
            className: ""
        }

    ];


    const total =
        reports.length || 1;


    container.innerHTML = "";


    statuses.forEach(item => {

        const count =
            reports.filter(
                report =>
                    normalizeStatusValue(report.status) ===
                    normalizeStatusValue(item.name)
            ).length;


        const percent =
            Math.round(
                count /
                total *
                100
            );


        const row =
            document.createElement(
                "div"
            );


        row.className =
            "chart-row";


        row.innerHTML = `

            <div class="chart-label">

                <span>
                    ${item.name}
                </span>

                <span>
                    ${count}
                    (${percent}%)
                </span>

            </div>


            <div class="chart-bar">

                <div
                    class="
                        chart-fill
                        ${item.className}
                    "
                    style="
                        width:${percent}%;
                    "
                ></div>

            </div>

        `;


        container.appendChild(
            row
        );

    });

}


/* =========================================================
   CATEGORY CHART
========================================================= */

function renderCategoryChart() {

    const container =
        document.getElementById(
            "categoryChart"
        );


    const categoryMap = {};


    reports.forEach(report => {

        const category =
            report.category ||
            "Other";


        categoryMap[category] =
            (categoryMap[category] || 0) + 1;

    });


    const categories =
        Object.entries(
            categoryMap
        )
        .sort(
            (a,b) =>
                b[1] - a[1]
        )
        .slice(0, 8);


    const total =
        reports.length || 1;


    container.innerHTML = "";


    categories.forEach(
        ([category,count]) => {

            const percent =
                Math.round(
                    count /
                    total *
                    100
                );


            const row =
                document.createElement(
                    "div"
                );


            row.className =
                "chart-row";


            row.innerHTML = `

                <div class="chart-label">

                    <span>
                        ${escapeHtml(
                            category
                        )}
                    </span>

                    <span>
                        ${count}
                    </span>

                </div>


                <div class="chart-bar">

                    <div
                        class="chart-fill"
                        style="
                            width:${percent}%;
                        "
                    ></div>

                </div>

            `;


            container.appendChild(
                row
            );

        }
    );


    if (!categories.length) {

        container.innerHTML = `

            <p style="
                color:var(--text-light);
                font-size:10px;
            ">
                No category data available.
            </p>

        `;

    }

}


/* =========================================================
   ANALYTICS SUMMARY
========================================================= */

function renderAnalyticsSummary() {

    const container =
        document.getElementById(
            "analyticsSummary"
        );


    const total =
        reports.length;


    const high =
        reports.filter(
            report =>
                report.priority ===
                "High"
        ).length;


    const followup =
        reports.filter(
            report =>
                report.status ===
                "Follow-up Initiated"
        ).length;


    const completed =
        reports.filter(
            report =>
                ["Completed", "Closed", "Resolved"]
                    .includes(report.status)
        ).length;


    const values = [

        ["Total Reports", total],

        ["High Priority", high],

        ["Active Follow-ups", followup],

        ["Completed", completed]

    ];


    container.innerHTML = "";


    values.forEach(
        ([label,value]) => {

            const item =
                document.createElement(
                    "div"
                );


            item.className =
                "analytics-summary-item";


            item.innerHTML = `

                <span>
                    ${label}
                </span>

                <strong>
                    ${value}
                </strong>

            `;


            container.appendChild(
                item
            );

        }
    );

}


/* =========================================================
   BUTTONS
========================================================= */

function setupButtons() {

    document
        .getElementById(
            "refreshDashboard"
        )
        .addEventListener(
            "click",
            async () => {

                await loadDashboard();

                showToast(
                    "Dashboard Refreshed",
                    "Latest report data has been loaded."
                );

            }
        );


    document
        .getElementById(
            "reportsRefresh"
        )
        .addEventListener(
            "click",
            async () => {

                await loadDashboard();

                showView("reports");

                renderReportsCards();

                showToast(
                    "Reports Refreshed",
                    "Latest report data has been loaded."
                );

            }
        );


    document
        .getElementById(
            "viewAllReports"
        )
        .addEventListener(
            "click",
            () => {

                showView("reports");

            }
        );


    document
        .getElementById(
            "exportReports"
        )
        .addEventListener(
            "click",
            exportReports
        );


    document
        .getElementById(
            "dashboardExport"
        )
        .addEventListener(
            "click",
            exportReports
        );


    document
        .getElementById(
            "reportsExport"
        )
        .addEventListener(
            "click",
            exportReports
        );


    toastClose.addEventListener(
        "click",
        () => {

            toast.classList.remove(
                "show"
            );

        }
    );


    document
        .getElementById(
            "logoutButton"
        )
        .addEventListener(
            "click",
            async () => {
                try {
                    await signOutAdminFromSupabase();
                } catch (error) {
                    console.error("Admin sign-out failed:", error);
                }
                window.location.href = "adlog.html";

            }
        );

}


/* =========================================================
   EXPORT CSV
========================================================= */

function exportReports() {

    if (!reports.length) {

        showToast(
            "No Reports",
            "There are no reports available to export.",
            "error"
        );

        return;

    }


    const headers = [

        "Report ID",

        "Issue Title",

        "Category",

        "Priority",

        "Location",

        "Reporter",

        "Contact",

        "Status",

        "Submitted",

        "Last Updated"

    ];


    const rows =
        reports.map(
            report => [

                report.id,

                report.title,

                report.category,

                report.priority,

                report.location,

                report.name,

                report.contact,

                report.status,

                formatDateTime(
                    report.date
                ),

                formatDateTime(
                    report.lastUpdated
                )

            ]
        );


    const csv = [

        headers,

        ...rows

    ]
        .map(
            row =>
                row
                    .map(csvEscape)
                    .join(",")
        )
        .join("\n");


    const blob =
        new Blob(
            [csv],
            {
                type:
                    "text/csv;charset=utf-8;"
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


    link.href = url;

    link.download =
        `gunupur-matters-reports-${new Date().toISOString().slice(0,10)}.csv`;


    document.body.appendChild(
        link
    );


    link.click();


    link.remove();


    URL.revokeObjectURL(
        url
    );


    showToast(
        "Export Complete",
        "Report data has been exported as CSV."
    );

}


/* =========================================================
   STATUS CLASS
========================================================= */

function statusClass(status) {

    switch (status) {

        case "Pending Review":
            return "status-submitted";

        case "Report Submitted":
            return "status-submitted";

        case "Under Review":
            return "status-review";

        case "Follow-up Initiated":
            return "status-followup";

        case "Under Process":
            return "status-followup";

        case "Completed":
            return "status-closed";

        case "Closed":
            return "status-closed";

        default:
            return "status-submitted";

    }

}


/* =========================================================
   PRIORITY CLASS
========================================================= */

function priorityClass(priority) {

    switch (
        String(priority || "")
            .toLowerCase()
    ) {

        case "high":
            return "priority-high";

        case "medium":
            return "priority-medium";

        case "low":
            return "priority-low";

        default:
            return "";

    }

}


/* =========================================================
   DATE
========================================================= */

function formatDate(value) {

    if (!value) {

        return "—";

    }


    const date =
        new Date(value);


    if (Number.isNaN(
        date.getTime()
    )) {

        return "—";

    }


    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    return `${day}-${month}-${date.getFullYear()}`;

}


function formatDateTime(value) {

    if (!value) {

        return "—";

    }


    const date =
        new Date(value);


    if (Number.isNaN(
        date.getTime()
    )) {

        return "—";

    }


    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const hour = String(date.getHours()).padStart(2, "0");
    const minute = String(date.getMinutes()).padStart(2, "0");
    return `${day}-${month}-${date.getFullYear()} ${hour}:${minute}`;

}


/* =========================================================
   RELATIVE DATE
========================================================= */

function formatRelativeDate(value) {

    if (!value) {

        return "Date unavailable";

    }


    const date =
        new Date(value);


    const now =
        new Date();


    const difference =
        now - date;


    const minutes =
        Math.floor(
            difference /
            60000
        );


    if (minutes < 1) {

        return "Just now";

    }


    if (minutes < 60) {

        return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;

    }


    const hours =
        Math.floor(
            minutes /
            60
        );


    if (hours < 24) {

        return `${hours} hour${hours === 1 ? "" : "s"} ago`;

    }


    const days =
        Math.floor(
            hours /
            24
        );


    if (days < 7) {

        return `${days} day${days === 1 ? "" : "s"} ago`;

    }


    return formatDate(value);

}


/* =========================================================
   CSV ESCAPE
========================================================= */

function csvEscape(value) {

    if (
        value === null ||
        value === undefined
    ) {

        return "";

    }


    const text =
        String(value)
            .replace(
                /"/g,
                '""'
            );


    return `"${text}"`;

}


/* =========================================================
   SAFE TEXT
========================================================= */

function setText(
    elementId,
    value
) {

    const element =
        document.getElementById(
            elementId
        );


    if (element) {

        element.textContent =
            value;

    }

}


/* =========================================================
   ESCAPE HTML
========================================================= */

function escapeHtml(value) {

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


/* =========================================================
   TOAST
========================================================= */

let toastTimer;


function showToast(
    title,
    message,
    type = "success"
) {

    const titleElement =
        document.getElementById(
            "toastTitle"
        );


    const messageElement =
        document.getElementById(
            "toastMessage"
        );


    const icon =
        toast.querySelector(
            ".toast-icon"
        );


    const iconElement =
        toast.querySelector(
            ".toast-icon i"
        );


    titleElement.textContent =
        title;


    messageElement.textContent =
        message;


    if (type === "error") {

        icon.style.background =
            "var(--red-light)";

        icon.style.color =
            "var(--red)";

        iconElement.className =
            "fa-solid fa-circle-exclamation";

    } else {

        icon.style.background =
            "var(--green-light)";

        icon.style.color =
            "var(--green)";

        iconElement.className =
            "fa-solid fa-check";

    }


    toast.classList.add(
        "show"
    );


    clearTimeout(
        toastTimer
    );


    toastTimer =
        setTimeout(
            () => {

                toast.classList.remove(
                    "show"
                );

            },
            4500
        );

}


/* =========================================================
   KEYBOARD
========================================================= */

document.addEventListener(
    "keydown",
    event => {

        if (
            event.key === "Escape"
        ) {

            closeReportDrawer();

            closeSidebar();

        }

    }
);


/* =========================================================
   DEVELOPMENT MESSAGE
========================================================= */

console.log(
    "Gunupur Matters Admin Dashboard loaded."
);

console.log(
    "Data mode:",
    ADMIN_CONFIG.USE_API
        ? "Supabase"
        : "Local Development"
);