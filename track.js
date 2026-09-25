/* =========================================================
   GUNUPUR MATTERS
   PUBLIC REPORT TRACKING
   ========================================================= */


/* =========================================================
   STORAGE
========================================================= */

const STORAGE_KEY = "communityVoiceReports";


function getReports() {

    try {

        return JSON.parse(
            localStorage.getItem(STORAGE_KEY)
        ) || [];

    } catch (error) {

        console.error(
            "Unable to read reports:",
            error
        );

        return [];

    }

}


/* =========================================================
   ELEMENTS
========================================================= */

const trackForm =
    document.getElementById("trackForm");

function normalizeStatus(status) {

    const value = String(status || "").trim();

    if (!value) {

        return "Pending Review";

    }

    const aliases = {
        "Closed": "Completed",
        "Resolved": "Completed",
        "Under process": "Under Process",
        "Under Process": "Under Process"
    };

    return aliases[value] || value;

}

function isTrackableStatus(status) {

    return [
        "Pending Review",
        "Report Submitted",
        "Under Review",
        "Follow-up Initiated",
        "Under Process",
        "Completed"
    ].includes(normalizeStatus(status));

}

const trackId =
    document.getElementById("trackId");

const trackResult =
    document.getElementById("trackResult");

const reportDetails =
    document.getElementById("reportDetails");

const emptyState =
    document.getElementById("emptyState");

const resultTitle =
    document.getElementById("resultTitle");

const resultId =
    document.getElementById("resultId");

const resultDate =
    document.getElementById("resultDate");

const resultCategory =
    document.getElementById("resultCategory");

const resultPriority =
    document.getElementById("resultPriority");

const resultLocation =
    document.getElementById("resultLocation");

const resultUpdated =
    document.getElementById("resultUpdated");

const resultDescription =
    document.getElementById("resultDescription");

const statusText =
    document.getElementById("statusText");

const statusBadge =
    document.getElementById("statusBadge");

const progressFill =
    document.getElementById("progressFill");

const progressPercent =
    document.getElementById("progressPercent");

const latestUpdateText =
    document.getElementById("latestUpdateText");

const timelineItems =
    document.querySelectorAll(".timeline-item");


/* =========================================================
   MOBILE MENU
========================================================= */

const mobileMenuBtn =
    document.getElementById("mobileMenuBtn");

const mobileNav =
    document.getElementById("mobileNav");


if (mobileMenuBtn) {

    mobileMenuBtn.addEventListener(
        "click",
        () => {

            mobileNav.classList.toggle("active");

            const icon =
                mobileMenuBtn.querySelector("i");

            if (
                mobileNav.classList.contains("active")
            ) {

                icon.classList.remove("fa-bars");

                icon.classList.add("fa-xmark");

            } else {

                icon.classList.remove("fa-xmark");

                icon.classList.add("fa-bars");

            }

        }
    );

}


/* =========================================================
   CLOSE MOBILE MENU
========================================================= */

document
    .querySelectorAll(".mobile-nav a")
    .forEach(link => {

        link.addEventListener(
            "click",
            () => {

                mobileNav.classList.remove(
                    "active"
                );

                const icon =
                    mobileMenuBtn.querySelector("i");

                icon.classList.remove(
                    "fa-xmark"
                );

                icon.classList.add(
                    "fa-bars"
                );

            }
        );

    });


/* =========================================================
   DATE FORMAT
========================================================= */

function formatDate(dateValue) {

    if (!dateValue) {

        return "Not available";

    }


    const date =
        new Date(dateValue);


    if (Number.isNaN(date.getTime())) {

        return "Not available";

    }


    return date.toLocaleDateString(
        "en-IN",
        {
            day: "numeric",
            month: "short",
            year: "numeric"
        }
    );

}


/* =========================================================
   ESCAPE HTML
========================================================= */

function escapeHtml(value) {

    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

}


/* =========================================================
   STATUS CONFIGURATION
========================================================= */

function getStatusStep(status) {

    switch (normalizeStatus(status)) {

        case "Pending Review":

            return 1;

        case "Report Submitted":

            return 2;

        case "Under Review":

            return 3;

        case "Follow-up Initiated":

            return 4;

        case "Under Process":

            return 5;

        case "Completed":

            return 6;

        default:

            return 1;

    }

}


/* =========================================================
   STATUS MESSAGE
========================================================= */

function getStatusMessage(status) {

    switch (normalizeStatus(status)) {

        case "Pending Review":

            return "Your report has been submitted and is waiting for the initial review.";

        case "Report Submitted":

            return "Your report has been successfully recorded and submitted for follow-up.";

        case "Under Review":

            return "Your report is currently under review.";

        case "Follow-up Initiated":

            return "Follow-up has been initiated regarding your reported issue.";

        case "Under Process":

            return "The issue is currently being worked on and is under process.";

        case "Completed":

            return "This report has been completed successfully.";

        default:

            return "Your report has been successfully received.";

    }

}


/* =========================================================
   STATUS COLOR
========================================================= */

function updateStatusAppearance(status) {

    const normalized = normalizeStatus(status);

    statusBadge.className =
        "status-badge";


    if (
        normalized === "Completed"
    ) {

        statusBadge.classList.add(
            "status-closed"
        );

    }


    if (
        normalized === "Follow-up Initiated" ||
        normalized === "Under Process"
    ) {

        statusBadge.classList.add(
            "status-followup"
        );

    }


    if (
        normalized === "Under Review"
    ) {

        statusBadge.classList.add(
            "status-review"
        );

    }


    statusText.textContent =
        normalized;

}


/* =========================================================
   TIMELINE
========================================================= */

function updateTimeline(
    status,
    submittedDate,
    updatedDate
) {

    const currentStep =
        getStatusStep(status);


    const progressValues = {

        1: 15,

        2: 32,

        3: 50,

        4: 68,

        5: 85,

        6: 100

    };


    const percentage =
        progressValues[currentStep] || 10;


    progressFill.style.width =
        `${percentage}%`;

    progressPercent.textContent =
        `${percentage}%`;


    timelineItems.forEach(
        item => {

            const step =
                Number(
                    item.dataset.step
                );


            item.classList.remove(
                "completed",
                "current"
            );


            const dateElement =
                item.querySelector(
                    ".timeline-date"
                );


            if (step < currentStep) {

                item.classList.add(
                    "completed"
                );

            }


            if (step === currentStep) {

                item.classList.add(
                    "current"
                );

            }


            if (step <= currentStep) {

                if (step === 1) {

                    dateElement.textContent =
                        formatDate(
                            submittedDate
                        );

                } else if (
                    step === currentStep
                ) {

                    dateElement.textContent =
                        formatDate(
                            updatedDate
                        );

                } else {

                    dateElement.textContent =
                        "Completed";

                }

            } else {

                dateElement.textContent =
                    "Pending";

            }

        }
    );

}


/* =========================================================
   DISPLAY REPORT
========================================================= */

function displayReport(report) {

    const status =
        normalizeStatus(report.status || "Pending Review");


    resultTitle.textContent =
        report.title || "Community Issue";


    resultId.textContent =
        report.id || "—";


    resultDate.textContent =
        formatDate(report.date);


    resultCategory.textContent =
        report.category || "Not specified";


    resultPriority.textContent =
        report.priority || "Normal";


    resultLocation.textContent =
        report.location || "Not specified";


    resultUpdated.textContent =
        formatDate(
            report.lastUpdated ||
            report.date
        );


    resultDescription.textContent =
        report.description ||
        "No description was provided.";


    updateStatusAppearance(
        status
    );


    latestUpdateText.textContent =
        getStatusMessage(status);


    updateTimeline(
        status,
        report.date,
        report.lastUpdated ||
        report.date
    );


    reportDetails.classList.add(
        "active"
    );


    emptyState.style.display =
        "none";


    trackResult.classList.remove(
        "active"
    );


    setTimeout(
        () => {

            reportDetails.scrollIntoView({
                behavior: "smooth",
                block: "start"
            });

        },
        150
    );

}


/* =========================================================
   NOT FOUND
========================================================= */

function showNotFound() {

    reportDetails.classList.remove(
        "active"
    );


    emptyState.style.display =
        "none";


    trackResult.innerHTML = `

        <strong>

            <i class="fa-solid fa-circle-xmark"></i>

            Report not found

        </strong>

        <br>

        We could not find a report with this ID.
        Please check the ID and try again.

    `;


    trackResult.classList.add(
        "active"
    );

}


/* =========================================================
   TRACK REPORT
========================================================= */

trackForm.addEventListener(
    "submit",
    event => {

        event.preventDefault();


        const id =
            trackId.value
                .trim()
                .toUpperCase();


        if (!id) {

            return;

        }


        const reports =
            getReports();


        const report =
            reports.find(
                item =>
                    String(item.id)
                        .toUpperCase() === id
            );


        if (!report) {

            showNotFound();

            return;

        }


        if (!isTrackableStatus(report.status)) {

            trackResult.innerHTML = `

                <strong>

                    <i class="fa-solid fa-clock"></i>

                    Report pending admin review

                </strong>

                <br>

                Your report has been received and is waiting for admin approval before it can be tracked.

            `;

            trackResult.classList.add("active");
            reportDetails.classList.remove("active");
            emptyState.style.display = "none";
            return;

        }


        displayReport(report);

    }
);


/* =========================================================
   AUTO FORMAT REPORT ID
========================================================= */

trackId.addEventListener(
    "input",
    () => {

        trackId.value =
            trackId.value
                .toUpperCase()
                .replace(/\s+/g, "");

    }
);


/* =========================================================
   URL REPORT ID SUPPORT
=========================================================

   Example:

   report.html?id=CV-26-0001

========================================================= */

const urlParams =
    new URLSearchParams(
        window.location.search
    );


const urlReportId =
    urlParams.get("id");


if (urlReportId) {

    trackId.value =
        urlReportId
            .toUpperCase()
            .trim();


    const reports =
        getReports();


    const report =
        reports.find(
            item =>
                String(item.id)
                    .toUpperCase() ===
                trackId.value
        );


    if (report) {

        if (!isTrackableStatus(report.status)) {

            trackResult.innerHTML = `

                <strong>

                    <i class="fa-solid fa-clock"></i>

                    Report pending admin review

                </strong>

                <br>

                Your report has been received and is waiting for admin approval before it can be tracked.

            `;

            trackResult.classList.add("active");
            reportDetails.classList.remove("active");
            emptyState.style.display = "none";

        } else {

            displayReport(report);

        }

    } else {

        showNotFound();

    }

}


/* =========================================================
   INITIAL STATE
========================================================= */

reportDetails.classList.remove(
    "active"
);

emptyState.style.display =
    "block";


console.log(
    "Gunupur Matters report tracking loaded."
);