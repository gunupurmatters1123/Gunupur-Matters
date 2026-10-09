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

reportForm.addEventListener("submit", async event => {

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


    if (!category || !location || !issueDescription) {

        showToast(
            "Missing Information",
            "Please choose a category, describe the issue, and add an approximate location.",
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


    try {
        const result = await submitReportToSupabase({
            title,
            category,
            priority,
            description: issueDescription,
            location,
            reporter_name: name,
            reporter_phone: contact,
            reporter_email: contact.includes("@") ? contact : ""
        }, photo.files[0] || null);

        generatedReportId.textContent = result.report_id;
        successModal.classList.add("active");
        reportForm.reset();
        charCount.textContent = "0";
        photoPreview.innerHTML = "";
        photoPreview.classList.remove("active");
        selectedPhotoData = "";
        await updateStatistics();

        showToast(
            "Report Submitted",
            `Your report ID is ${result.report_id}.`,
            "success"
        );
    } catch (error) {
        console.error(error);
        showToast("Submit failed", error.message || "Please try again.", "error");
    }

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

trackForm.addEventListener("submit", async event => {

    event.preventDefault();


    const id =
        document.getElementById("trackId")
            .value
            .trim()
            .toUpperCase();


    try {
        const report = await findReportInSupabase(id);
        if (!report) {
            trackResult.textContent = "Report not found. Please check your report ID and try again.";
            trackResult.classList.add("active");
            return;
        }

        const formattedDate = new Date(report.lastUpdated || report.date)
            .toLocaleDateString("en-IN", {
                day: "numeric",
                month: "long",
                year: "numeric"
            });

        trackResult.innerHTML = `
            <strong>
                <i class="fa-solid fa-circle-check"></i>
                ${escapeHtml(report.status)}
            </strong>
            <br>
            <span><strong>Report:</strong> ${escapeHtml(report.title || "Community Issue")}</span>
            <br>
            <span><strong>Category:</strong> ${escapeHtml(report.category || "Not specified")}</span>
            <br>
            <span><strong>Location:</strong> ${escapeHtml(report.location || "Not specified")}</span>
            <br>
            <span><strong>Last Updated:</strong> ${formattedDate}</span>
        `;
        trackResult.classList.add("active");
    } catch (error) {
        console.error("Unable to track report:", error);
        trackResult.textContent =
            "Report tracking is temporarily unavailable. Please try again later.";
        trackResult.classList.add("active");
    }

});


/* =========================================================
   STATISTICS
   ========================================================= */

async function updateStatistics() {
    try {
        const stats = await getReportStatisticsFromSupabase();
        const values = [
            stats.total,
            stats.under_review,
            stats.followups,
            stats.closed
        ].map(Number);
        if (!values.every(Number.isFinite)) {
            throw new Error("Supabase returned invalid report statistics.");
        }

        animateNumber(document.getElementById("reportsCount"), values[0]);
        animateNumber(document.getElementById("reviewCount"), values[1]);
        animateNumber(document.getElementById("followupCount"), values[2]);
        animateNumber(document.getElementById("closedCount"), values[3]);
    } catch (error) {
        console.error("Unable to load report statistics:", error);
    }

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


console.log(
    "Community Voice website loaded successfully."
);