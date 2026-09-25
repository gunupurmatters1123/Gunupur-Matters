/* =========================================================
   GUNUPUR MATTERS
   REPORT PAGE INTERACTIONS
   ========================================================= */

const STORAGE_KEY = "communityVoiceReports";

function getReports() {

    try {

        return JSON.parse(
            localStorage.getItem(STORAGE_KEY)
        ) || [];

    } catch (error) {

        console.error("Unable to read reports:", error);

        return [];

    }

}


function saveReports(reports) {

    localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(reports)
    );

}


function generateReportId() {

    const reports = getReports();

    const year = new Date().getFullYear().toString().slice(-2);

    const nextNumber = String(reports.length + 1).padStart(4, "0");

    return `CV-${year}-${nextNumber}`;

}


function showToast(title, message) {

    const toast = document.getElementById("toast");

    const toastTitle = document.getElementById("toastTitle");

    const toastMessage = document.getElementById("toastMessage");

    if (!toast || !toastTitle || !toastMessage) {

        return;

    }

    toastTitle.textContent = title;

    toastMessage.textContent = message;

    toast.classList.add("show");

    clearTimeout(showToast.timeoutId);

    showToast.timeoutId = setTimeout(() => {

        toast.classList.remove("show");

    }, 2800);

}


const mobileMenuBtn = document.getElementById("mobileMenuBtn");

const mobileNav = document.getElementById("mobileNav");

if (mobileMenuBtn && mobileNav) {

    mobileMenuBtn.addEventListener("click", () => {

        mobileNav.classList.toggle("active");

        const icon = mobileMenuBtn.querySelector("i");

        if (mobileNav.classList.contains("active")) {

            icon.classList.remove("fa-bars");

            icon.classList.add("fa-xmark");

        } else {

            icon.classList.remove("fa-xmark");

            icon.classList.add("fa-bars");

        }

    });

    document.querySelectorAll(".mobile-nav a").forEach((link) => {

        link.addEventListener("click", () => {

            mobileNav.classList.remove("active");

            const icon = mobileMenuBtn.querySelector("i");

            if (icon) {

                icon.classList.remove("fa-xmark");

                icon.classList.add("fa-bars");

            }

        });

    });

}


const description = document.getElementById("description");

const charCount = document.getElementById("charCount");

if (description && charCount) {

    const updateCount = () => {

        charCount.textContent = `${description.value.length} / 1000`;

    };

    description.addEventListener("input", updateCount);

    updateCount();

}


const photoInput = document.getElementById("photo");

const photoPreview = document.getElementById("photoPreview");

let selectedPhotoData = "";

if (photoInput && photoPreview) {

    photoInput.addEventListener("change", () => {

        const [file] = photoInput.files;

        if (!file) {

            selectedPhotoData = "";
            photoPreview.classList.remove("active");

            photoPreview.innerHTML = "";

            return;

        }

        if (!file.type.startsWith("image/")) {

            showToast("Invalid file", "Please choose a JPG, PNG, or WEBP image.");

            photoInput.value = "";

            return;

        }

        const reader = new FileReader();

        reader.onload = (event) => {

            selectedPhotoData = event.target.result;

            photoPreview.innerHTML = `
                <img src="${selectedPhotoData}" alt="Issue preview" />
            `;

            photoPreview.classList.add("active");

        };

        reader.readAsDataURL(file);

    });

}


const getLocationBtn = document.getElementById("getLocationBtn");

const locationStatus = document.getElementById("locationStatus");

const latitudeInput = document.getElementById("latitude");

const longitudeInput = document.getElementById("longitude");

if (getLocationBtn) {

    getLocationBtn.addEventListener("click", () => {

        if (!navigator.geolocation) {

            if (locationStatus) {

                locationStatus.textContent = "Geolocation is unsupported on this device.";

            }

            return;

        }

        if (locationStatus) {

            locationStatus.textContent = "Fetching location...";

        }

        navigator.geolocation.getCurrentPosition(
            (position) => {

                const latitude = position.coords.latitude;

                const longitude = position.coords.longitude;

                if (latitudeInput) {

                    latitudeInput.value = latitude.toFixed(6);

                }

                if (longitudeInput) {

                    longitudeInput.value = longitude.toFixed(6);

                }

                if (locationStatus) {

                    locationStatus.textContent = `Location captured: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;

                }

            },
            () => {

                if (locationStatus) {

                    locationStatus.textContent = "Unable to access your location.";

                }

            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            }
        );

    });

}


const reportForm = document.getElementById("reportForm");

const successModal = document.getElementById("successModal");

const generatedReportId = document.getElementById("generatedReportId");

const modalClose = document.getElementById("modalClose");

const modalTrackBtn = document.getElementById("modalTrackBtn");

const copyReportIdBtn = document.getElementById("copyReportId");

function openModal(reportId) {

    if (!successModal || !generatedReportId) {

        return;

    }

    generatedReportId.textContent = reportId;

    successModal.classList.add("active");

    successModal.setAttribute("aria-hidden", "false");

}


function closeModal() {

    if (!successModal) {

        return;

    }

    successModal.classList.remove("active");

    successModal.setAttribute("aria-hidden", "true");

}


if (modalClose) {

    modalClose.addEventListener("click", closeModal);

}


if (successModal) {

    successModal.addEventListener("click", (event) => {

        if (event.target === successModal) {

            closeModal();

        }

    });

}


if (modalTrackBtn) {

    modalTrackBtn.addEventListener("click", () => {

        window.location.href = "track.html";

    });

}


if (copyReportIdBtn) {

    copyReportIdBtn.addEventListener("click", async () => {

        const value = generatedReportId?.textContent || "";

        if (!value) {

            return;

        }

        try {

            await navigator.clipboard.writeText(value);

            const originalText = copyReportIdBtn.innerHTML;

            copyReportIdBtn.innerHTML = '<i class="fa-solid fa-check"></i> Copied';

            setTimeout(() => {

                copyReportIdBtn.innerHTML = originalText;

            }, 1200);

        } catch (error) {

            console.error("Clipboard copy failed:", error);

        }

    });

}


if (reportForm) {

    reportForm.addEventListener("submit", (event) => {

        event.preventDefault();

        const requiredFields = reportForm.querySelectorAll("[required]");

        let formIsValid = true;

        requiredFields.forEach((field) => {

            if (!field.value.trim()) {

                formIsValid = false;

                field.focus();

                if (typeof field.reportValidity === "function") {

                    field.reportValidity();

                }

                return;

            }

            if (field.id === "description" && field.value.trim().length < 15) {

                formIsValid = false;

                field.focus();

                field.setCustomValidity("Description must be at least 15 characters long.");

                field.reportValidity();

                field.setCustomValidity("");

            }

        });

        if (!formIsValid) {

            showToast("Missing details", "Please complete all required fields before submitting.");

            return;

        }

        const reportId = generateReportId();

        const reportData = {

            id: reportId,

            category: document.getElementById("category")?.value || "",

            priority: document.getElementById("priority")?.value || "",

            title: document.getElementById("title")?.value.trim() || "",

            description: document.getElementById("description")?.value.trim() || "",

            wardNumber: document.getElementById("wardNumber")?.value || "",

            street: document.getElementById("street")?.value.trim() || "",

            area: document.getElementById("area")?.value.trim() || "",

            landmark: document.getElementById("landmark")?.value.trim() || "",

            pinCode: document.getElementById("pinCode")?.value.trim() || "",

            latitude: document.getElementById("latitude")?.value || "",

            longitude: document.getElementById("longitude")?.value || "",

            reporterName: document.getElementById("reporterName")?.value.trim() || "",

            reporterPhone: document.getElementById("reporterPhone")?.value.trim() || "",

            name: document.getElementById("reporterName")?.value.trim() || "",

            contact: document.getElementById("reporterPhone")?.value.trim() || "",

            photo: selectedPhotoData,

            location: [

                document.getElementById("area")?.value.trim() || "",

                document.getElementById("street")?.value.trim() || "",

                document.getElementById("wardNumber")?.value ? `Ward ${document.getElementById("wardNumber").value}` : "",

                document.getElementById("pinCode")?.value.trim() || ""

            ]
                .filter(Boolean)
                .join(", "),

            date: new Date().toISOString(),

            lastUpdated: new Date().toISOString(),

            submittedAt: new Date().toISOString(),

            status: "Pending Review"

        };

        const reports = getReports();

        reports.unshift(reportData);

        saveReports(reports);

        openModal(reportId);

        reportForm.reset();

        if (charCount) {

            charCount.textContent = "0 / 1000";

        }

        if (photoPreview) {

            photoPreview.classList.remove("active");

            photoPreview.innerHTML = "";

        }

        selectedPhotoData = "";

        if (locationStatus) {

            locationStatus.textContent = "Location not selected";

        }

        if (latitudeInput) {

            latitudeInput.value = "";

        }

        if (longitudeInput) {

            longitudeInput.value = "";

        }

        showToast("Issue logged", "Your report was submitted successfully.");

    });

}


const toastClose = document.getElementById("toastClose");

if (toastClose) {

    toastClose.addEventListener("click", () => {

        const toast = document.getElementById("toast");

        if (toast) {

            toast.classList.remove("show");

        }

    });

}
