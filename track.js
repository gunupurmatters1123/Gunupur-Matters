/* =========================================================
   GUNUPUR MATTERS
   PUBLIC REPORT TRACKING
   ========================================================= */


/* =========================================================
   ELEMENTS
========================================================= */

const trackForm =
    document.getElementById("trackForm");

const trackingVerification =
    document.getElementById("trackingVerification");

const trackingCode =
    document.getElementById("trackingCode");

const verifyTrackingCodeButton =
    document.getElementById("verifyTrackingCode");

const requestTrackingCodeButton =
    document.getElementById("requestTrackingCode");

let pendingTrackingReportId = "";

function normalizeStatus(status) {

    const value = String(status || "").trim();

    if (!value) {

        return "Pending Review";

    }

    const normalized = value.toLowerCase().replace(/\s+/g, " ");
    const statuses = {
        "pending review": "Pending Review",
        "submitted": "Submitted",
        "report submitted": "Report Submitted",
        "under review": "Under Review",
        "follow-up initiated": "Follow-up Initiated",
        "in progress": "Under Process",
        "under process": "Under Process",
        "completed": "Completed",
        "closed": "Completed",
        "resolved": "Completed"
    };

    return statuses[normalized] || value;

}

function isTrackableStatus(status) {

    return [
        "Pending Review",
        "Submitted",
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


    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    return `${day}-${month}-${date.getFullYear()}`;

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


function showTrackingError(error) {

    console.error("Unable to track report:", error);
    trackResult.textContent =
        "Report tracking is temporarily unavailable. Please try again later.";
    trackResult.classList.add("active");
    reportDetails.classList.remove("active");
    emptyState.style.display = "none";

}


function showDeletedReport(report) {

    const reason = String(report.deleteReason || "").trim();
    trackResult.textContent = reason
        ? `This report was removed by the administrators. Reason: ${reason}`
        : "This report was removed by the administrators. No reason was recorded.";
    trackResult.classList.add("active");
    reportDetails.classList.remove("active");
    emptyState.style.display = "none";

}


function showTrackingMessage(message) {

    trackResult.textContent = message;
    trackResult.classList.add("active");
    reportDetails.classList.remove("active");
    emptyState.style.display = "none";

}


async function requestTrackingCode(reportId) {

    pendingTrackingReportId = reportId;
    requestTrackingCodeButton.disabled = true;
    trackResult.classList.remove("active");
    reportDetails.classList.remove("active");
    emptyState.style.display = "none";
    trackingVerification.style.display = "none";

    try {
        await sendReportTrackingCode(reportId);
        trackingCode.value = "";
        trackingVerification.style.display = "block";
        showTrackingMessage(
            "If this report ID is valid and has a registered phone number, a verification code has been sent."
        );
        trackingCode.focus();
    } catch (error) {
        showTrackingError(error);
    } finally {
        requestTrackingCodeButton.disabled = false;
    }

}


/* =========================================================
   TRACK REPORT
========================================================= */

trackForm.addEventListener(
    "submit",
    async event => {

        event.preventDefault();


        const id =
            trackId.value
                .trim()
                .toUpperCase();


        if (!id) {

            return;

        }


        await requestTrackingCode(id);

    }
);


verifyTrackingCodeButton.addEventListener("click", async () => {

    const code = trackingCode.value.trim();
    if (!pendingTrackingReportId || !code) {
        showTrackingMessage("Enter the SMS verification code to continue.");
        trackingCode.focus();
        return;
    }

    verifyTrackingCodeButton.disabled = true;
    try {
        const result = await verifyReportTrackingCode(pendingTrackingReportId, code);
        const report = result.report;
        if (!report) {
            throw new Error("The report ID or verification code is invalid or expired.");
        }

        trackingVerification.style.display = "none";
        if (report.deleted || normalizeStatus(report.status) === "Archived") {
            showDeletedReport(report);
        } else if (isTrackableStatus(report.status)) {
            trackResult.classList.remove("active");
            displayReport(report);
        } else {
            showTrackingMessage("The report is not available for tracking.");
        }
    } catch (error) {
        showTrackingMessage(error.message || "The verification code could not be confirmed.");
    } finally {
        verifyTrackingCodeButton.disabled = false;
    }

});

trackingCode.addEventListener("keydown", event => {
    if (event.key === "Enter") {
        event.preventDefault();
        verifyTrackingCodeButton.click();
    }
});


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

        pendingTrackingReportId = "";
        trackingVerification.style.display = "none";
        trackResult.classList.remove("active");

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

    showTrackingMessage(
        "For privacy, enter the report ID and request an SMS code to view its status."
    );

}


/* =========================================================
   INITIAL STATE
========================================================= */

reportDetails.classList.remove("active");
if (!urlReportId) {
    emptyState.style.display = "block";
}


console.log(
    "Gunupur Matters report tracking loaded."
);