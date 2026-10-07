/* =========================================================
   GUNUPUR MATTERS
   REPORT PAGE INTERACTIONS
   ========================================================= */

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

        const isImage = file.type.startsWith("image/");
        const isVideo = file.type.startsWith("video/");

        if (!isImage && !isVideo) {

            showToast("Invalid file", "Please choose a JPG, PNG, WEBP, MP4, MOV, or WEBM file.");
            photoInput.value = "";
            return;

        }

        if (isImage) {
            const reader = new FileReader();

            reader.onload = (event) => {
                selectedPhotoData = event.target.result;
                photoPreview.innerHTML = `<img src="${selectedPhotoData}" alt="Issue preview" />`;
                photoPreview.classList.add("active");
            };

            reader.readAsDataURL(file);
            return;
        }

        selectedPhotoData = "";
        const videoUrl = URL.createObjectURL(file);
        photoPreview.innerHTML = `
            <video controls playsinline preload="metadata">
                <source src="${videoUrl}" type="${file.type}">
            </video>
        `;
        photoPreview.classList.add("active");

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

    reportForm.addEventListener("submit", async (event) => {

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

        const formData = new FormData(reportForm);

        if (photoInput && photoInput.files && photoInput.files[0]) {
            formData.set("photo", photoInput.files[0]);
        }

        try {
            const response = await fetch("config/submit-report.php", {
                method: "POST",
                body: formData,
                credentials: "same-origin"
            });

            let result;

            if (response.status === 405) {
                const value = name => String(formData.get(name) || "").trim();
                const street = value("street");
                const area = value("area");
                const ward = value("wardNumber");
                const pin = value("pinCode");
                const location = [area, street, ward, pin].filter(Boolean).join(", ");
                const contact = value("reporterPhone");

                result = await submitReportToSupabase({
                    title: value("title"),
                    category: value("category"),
                    priority: value("priority"),
                    description: value("description"),
                    location,
                    location_details: value("locationDetails"),
                    ward_number: ward,
                    street,
                    area,
                    landmark: value("landmark"),
                    pin_code: pin,
                    latitude: value("latitude"),
                    longitude: value("longitude"),
                    reporter_name: value("reporterName"),
                    reporter_phone: contact,
                    reporter_email: contact.includes("@") ? contact : ""
                }, photoInput && photoInput.files ? photoInput.files[0] : null);
            } else {
                const responseBody = await response.text();
                try {
                    result = JSON.parse(responseBody);
                } catch (error) {
                    const responseMessage = responseBody.trim()
                        ? "The server returned an invalid response. Check the PHP error log."
                        : `The server returned an empty response (HTTP ${response.status}). Check that PHP is running.`;
                    throw new Error(responseMessage);
                }
            }

            if ((response.status !== 405 && !response.ok) || !result.success) {
                throw new Error(result.message || "Unable to submit report.");
            }

            if (!result.report_id) {
                throw new Error("The server did not return a report ID.");
            }

            openModal(result.report_id);

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

        } catch (error) {
            console.error(error);
            showToast("Submit failed", error.message || "Please try again.");
        }

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
