/* =========================================================
   COMMUNITY VOICE
   Main JavaScript
   ========================================================= */


/* =========================================================
   GLOBAL ELEMENTS
   ========================================================= */

const navbar = document.getElementById("navbar");

const mobileMenuBtn =
    document.getElementById("mobileMenuBtn");

const navMenu =
    document.getElementById("navMenu");

const reportForm =
    document.getElementById("reportForm");

const trackForm =
    document.getElementById("trackForm");

const successModal =
    document.getElementById("successModal");

const modalClose =
    document.getElementById("modalClose");

const modalTrackBtn =
    document.getElementById("modalTrackBtn");

const generatedReportId =
    document.getElementById("generatedReportId");

const copyReportId =
    document.getElementById("copyReportId");

const toast =
    document.getElementById("toast");

const toastClose =
    document.getElementById("toastClose");

const toastTitle =
    document.getElementById("toastTitle");

const toastMessage =
    document.getElementById("toastMessage");

const description =
    document.getElementById("description");

const charCount =
    document.getElementById("charCount");

const photo =
    document.getElementById("photo");

const photoPreview =
    document.getElementById("photoPreview");

let selectedPhotoData = "";

const trackResult =
    document.getElementById("trackResult");


/* =========================================================
   STORAGE
   ========================================================= */

const STORAGE_KEY =
    "communityVoiceReports";


function getReports() {

    try {

        return JSON.parse(
            localStorage.getItem(STORAGE_KEY)
        ) || [];

    } catch (error) {

        console.error(error);

        return [];

    }

}


function saveReports(reports) {

    localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(reports)
    );

}


/* =========================================================
   REPORT ID
   ========================================================= */

function generateReportId() {

    const reports = getReports();

    const year =
        new Date().getFullYear().toString().slice(-2);

    const number =
        String(reports.length + 1).padStart(4, "0");

    return `CV-${year}-${number}`;

}


/* =========================================================
   NAVIGATION
   ========================================================= */

window.addEventListener("scroll", () => {

    if (window.scrollY > 20) {

        navbar.classList.add("scrolled");

    } else {

        navbar.classList.remove("scrolled");

    }

});


mobileMenuBtn.addEventListener("click", () => {

    navMenu.classList.toggle("active");

    const icon =
        mobileMenuBtn.querySelector("i");

    if (navMenu.classList.contains("active")) {

        icon.classList.remove("fa-bars");

        icon.classList.add("fa-xmark");

    } else {

        icon.classList.remove("fa-xmark");

        icon.classList.add("fa-bars");

    }

});


document.querySelectorAll(".nav-link, .nav-report")
    .forEach(link => {

        link.addEventListener("click", () => {

            navMenu.classList.remove("active");

            const icon =
                mobileMenuBtn.querySelector("i");

            icon.classList.remove("fa-xmark");

            icon.classList.add("fa-bars");

        });

    });


/* =========================================================
   ACTIVE NAVIGATION
   ========================================================= */

const sections =
    document.querySelectorAll("section[id]");

const navLinks =
    document.querySelectorAll(".nav-link");


window.addEventListener("scroll", () => {

    let currentSection = "";

    sections.forEach(section => {

        const sectionTop =
            section.offsetTop - 150;

        const sectionHeight =
            section.offsetHeight;

        if (
            window.scrollY >= sectionTop &&
            window.scrollY < sectionTop + sectionHeight
        ) {

            currentSection =
                section.getAttribute("id");

        }

    });


    navLinks.forEach(link => {

        link.classList.remove("active");

        if (
            link.getAttribute("href") ===
            `#${currentSection}`
        ) {

            link.classList.add("active");

        }

    });

});


/* =========================================================
   CATEGORY SELECTION
   ========================================================= */

document.querySelectorAll(".category-card")
    .forEach(card => {

        card.addEventListener("click", () => {

            const category =
                card.dataset.category;

            document.getElementById("category").value =
                category;

            document.getElementById("report")
                .scrollIntoView({
                    behavior: "smooth"
                });

            setTimeout(() => {

                document.getElementById("category")
                    .focus();

            }, 700);

        });

    });


/* =========================================================
   CHARACTER COUNTER
   ========================================================= */

description.addEventListener("input", () => {

    if (description.value.length > 1000) {

        description.value =
            description.value.substring(0, 1000);

    }

    charCount.textContent =
        description.value.length;

});


/* =========================================================
   PHOTO PREVIEW
   ========================================================= */

photo.addEventListener("change", () => {

    const file = photo.files[0];

    photoPreview.innerHTML = "";

    if (!file) {

        selectedPhotoData = "";
        photoPreview.classList.remove("active");

        return;

    }


    const maxSize =
        5 * 1024 * 1024;


    if (file.size > maxSize) {

        showToast(
            "File Too Large",
            "Please select an image smaller than 5MB.",
            "error"
        );

        photo.value = "";

        photoPreview.classList.remove("active");

        return;

    }


    if (!file.type.startsWith("image/")) {

        showToast(
            "Invalid File",
            "Please select a JPG, PNG or WEBP image.",
            "error"
        );

        photo.value = "";

        return;

    }


    const reader =
        new FileReader();


    reader.onload = function(event) {

        selectedPhotoData = event.target.result;

        const image =
            document.createElement("img");

        image.src =
            selectedPhotoData;

        image.alt =
            "Selected report photograph";

        photoPreview.appendChild(image);

        photoPreview.classList.add("active");

    };


    reader.readAsDataURL(file);

});


/* =========================================================
   REPORT SUBMISSION
   ========================================================= */

reportForm.addEventListener("submit", event => {

    event.preventDefault();


    const category =
        document.getElementById("category").value;

    const priority =
        document.getElementById("priority").value;

    const location =
        document.getElementById("location").value.trim();

    const title =
        document.getElementById("title").value.trim();

    const issueDescription =
        document.getElementById("description").value.trim();

    const name =
        document.getElementById("reporterName").value.trim();

    const contact =
        document.getElementById("reporterPhone").value.trim();


    if (
        !category ||
        !priority ||
        !location ||
        !title ||
        !issueDescription
    ) {

        showToast(
            "Missing Information",
            "Please complete all required fields.",
            "error"
        );

        return;

    }


    if (issueDescription.length < 15) {

        showToast(
            "More Details Needed",
            "Please provide a little more information about the issue.",
            "error"
        );

        return;

    }


    const reportId =
        generateReportId();


    const report = {

        id: reportId,

        name: name,

        contact: contact,

        category: category,

        priority: priority,

        location: location,

        title: title,

        description: issueDescription,

        photo: selectedPhotoData,

        status: "Pending Review",

        date:
            new Date().toISOString(),

        lastUpdated:
            new Date().toISOString()

    };


    const reports =
        getReports();


    reports.push(report);


    saveReports(reports);


    updateStatistics();


    generatedReportId.textContent =
        reportId;


    successModal.classList.add("active");


    reportForm.reset();

    charCount.textContent = "0";

    photoPreview.innerHTML = "";

    photoPreview.classList.remove("active");

    selectedPhotoData = "";


    showToast(
        "Report Submitted",
        `Your report ID is ${reportId}.`,
        "success"
    );

});


/* =========================================================
   SUCCESS MODAL
   ========================================================= */

modalClose.addEventListener("click", () => {

    successModal.classList.remove("active");

});


successModal.addEventListener("click", event => {

    if (event.target === successModal) {

        successModal.classList.remove("active");

    }

});


modalTrackBtn.addEventListener("click", () => {

    const id =
        generatedReportId.textContent.trim();

    successModal.classList.remove("active");

    document.getElementById("trackId").value =
        id;

    document.getElementById("track")
        .scrollIntoView({
            behavior: "smooth"
        });

});


/* =========================================================
   COPY REPORT ID
   ========================================================= */

copyReportId.addEventListener("click", async () => {

    const id =
        generatedReportId.textContent.trim();

    try {

        await navigator.clipboard.writeText(id);

        showToast(
            "Copied",
            "Your report ID has been copied.",
            "success"
        );

    } catch (error) {

        showToast(
            "Copy Failed",
            "Please copy the ID manually.",
            "error"
        );

    }

});


/* =========================================================
   TRACK REPORT
   ========================================================= */

trackForm.addEventListener("submit", event => {

    event.preventDefault();


    const id =
        document.getElementById("trackId")
            .value
            .trim()
            .toUpperCase();


    const reports =
        getReports();


    const report =
        reports.find(
            item => item.id.toUpperCase() === id
        );


    if (!report) {

        trackResult.innerHTML = `

            <strong>
                <i class="fa-solid fa-circle-xmark"></i>
                Report not found
            </strong>

            <br>

            Please check your report ID and try again.

        `;

        trackResult.classList.add("active");

        return;

    }


    const formattedDate =
        new Date(report.lastUpdated)
            .toLocaleDateString(
                "en-IN",
                {
                    day: "numeric",
                    month: "long",
                    year: "numeric"
                }
            );


    trackResult.innerHTML = `

        <strong>
            <i class="fa-solid fa-circle-check"></i>
            ${escapeHtml(report.status)}
        </strong>

        <br>

        <span>
            <strong>Report:</strong>
            ${escapeHtml(report.title)}
        </span>

        <br>

        <span>
            <strong>Category:</strong>
            ${escapeHtml(report.category)}
        </span>

        <br>

        <span>
            <strong>Location:</strong>
            ${escapeHtml(report.location)}
        </span>

        <br>

        <span>
            <strong>Last Updated:</strong>
            ${formattedDate}
        </span>

    `;

    trackResult.classList.add("active");

});


/* =========================================================
   STATISTICS
   ========================================================= */

function updateStatistics() {

    const reports =
        getReports();


    const total =
        reports.length;


    const underReview =
        reports.filter(
            report =>
                report.status === "Under Review"
        ).length;


    const followups =
        reports.filter(
            report =>
                report.status ===
                "Follow-up Initiated"
        ).length;


    const closed =
        reports.filter(
            report =>
                ["Completed", "Closed", "Resolved"]
                    .includes(report.status)
        ).length;


    animateNumber(
        document.getElementById("reportsCount"),
        total
    );


    animateNumber(
        document.getElementById("reviewCount"),
        underReview
    );


    animateNumber(
        document.getElementById("followupCount"),
        followups
    );


    animateNumber(
        document.getElementById("closedCount"),
        closed
    );

}


/* =========================================================
   NUMBER ANIMATION
   ========================================================= */

function animateNumber(element, target) {

    const start =
        parseInt(element.textContent) || 0;

    const duration = 700;

    const startTime =
        performance.now();


    function update(currentTime) {

        const elapsed =
            currentTime - startTime;

        const progress =
            Math.min(
                elapsed / duration,
                1
            );


        const eased =
            1 - Math.pow(1 - progress, 3);


        const value =
            Math.round(
                start +
                (target - start) * eased
            );


        element.textContent =
            value;


        if (progress < 1) {

            requestAnimationFrame(update);

        }

    }


    requestAnimationFrame(update);

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

    toastTitle.textContent =
        title;

    toastMessage.textContent =
        message;


    const icon =
        toast.querySelector(".toast-icon i");


    if (type === "error") {

        toast.querySelector(".toast-icon")
            .style.background =
            "var(--danger)";

        icon.className =
            "fa-solid fa-circle-exclamation";

    } else {

        toast.querySelector(".toast-icon")
            .style.background =
            "var(--success)";

        icon.className =
            "fa-solid fa-check";

    }


    toast.classList.add("show");


    clearTimeout(toastTimer);


    toastTimer =
        setTimeout(() => {

            toast.classList.remove("show");

        }, 4500);

}


toastClose.addEventListener("click", () => {

    toast.classList.remove("show");

});


/* =========================================================
   ESCAPE HTML
   ========================================================= */

function escapeHtml(value) {

    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

}


/* =========================================================
   SCROLL REVEAL
   ========================================================= */

const revealElements =
    document.querySelectorAll(
        ".process-card, .category-card, .transparency-card, .stat-item"
    );


const revealObserver =
    new IntersectionObserver(
        entries => {

            entries.forEach(entry => {

                if (entry.isIntersecting) {

                    entry.target.classList.add(
                        "fade-up"
                    );

                    revealObserver.unobserve(
                        entry.target
                    );

                }

            });

        },
        {
            threshold: 0.12
        }
    );


revealElements.forEach(element => {

    revealObserver.observe(element);

});


/* =========================================================
   INITIALIZE
   ========================================================= */

updateStatistics();


/* =========================================================
   DEMO DATA
   =========================================================

   Uncomment the following function once if you want
   to test the website with sample reports.

------------------------------------------------------------

function createDemoReport() {

    const reports = getReports();

    reports.push({

        id: "CV-26-0001",

        name: "Demo User",

        contact: "",

        category: "Water & Sanitation",

        priority: "High",

        location: "Ward 12",

        title: "Water supply interruption",

        description:
            "Water supply has been interrupted in the area.",

        status: "Follow-up Initiated",

        date:
            new Date().toISOString(),

        lastUpdated:
            new Date().toISOString()

    });

    saveReports(reports);

    updateStatistics();

}

------------------------------------------------------------
*/


console.log(
    "Community Voice website loaded successfully."
);