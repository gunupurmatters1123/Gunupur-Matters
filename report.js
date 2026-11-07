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

let photoPreviewUrls = [];

function clearPhotoPreview() {
    photoPreviewUrls.forEach(url => URL.revokeObjectURL(url));
    photoPreviewUrls = [];
    photoPreview.replaceChildren();
    photoPreview.classList.remove("active");
}

if (photoInput && photoPreview) {

    photoInput.addEventListener("change", () => {

        const files = Array.from(photoInput.files || []);

        clearPhotoPreview();
        if (files.length === 0) {
            return;
        }

        if (files.length > 4) {
            showToast("Too many files", "Please select no more than 4 photos or videos.");
            photoInput.value = "";
            return;
        }

        for (const file of files) {
            const extension = file.name.split(".").pop().toLowerCase();
            const isImage = file.type.startsWith("image/")
                || ["jpg", "jpeg", "png", "webp", "gif", "heic", "heif"].includes(extension);
            const isVideo = file.type.startsWith("video/")
                || ["mp4", "mov", "avi", "mkv", "webm", "mpeg", "mpg"].includes(extension);
            if (!isImage && !isVideo) {
                showToast("Invalid file", "Please choose supported photos or videos.");
                photoInput.value = "";
                clearPhotoPreview();
                return;
            }
            if (file.size > 30 * 1024 * 1024) {
                showToast("File too large", "Each photo or video must be no larger than 30 MB.");
                photoInput.value = "";
                clearPhotoPreview();
                return;
            }
        }

        files.forEach(file => {
            const url = URL.createObjectURL(file);
            photoPreviewUrls.push(url);
            const extension = file.name.split(".").pop().toLowerCase();
            const isVideo = file.type.startsWith("video/")
                || ["mp4", "mov", "avi", "mkv", "webm", "mpeg", "mpg"].includes(extension);
            const media = document.createElement(isVideo ? "video" : "img");
            media.src = url;
            if (media instanceof HTMLVideoElement) {
                media.controls = true;
                media.playsInline = true;
                media.preload = "metadata";
            } else {
                media.alt = file.name;
            }
            photoPreview.appendChild(media);
        });
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

const reportSmsStatus = document.getElementById("reportSmsStatus");

const modalClose = document.getElementById("modalClose");

const modalTrackBtn = document.getElementById("modalTrackBtn");

const copyReportIdBtn = document.getElementById("copyReportId");

let lastReporterName = "";

function openModal(reportId, smsSent) {

    if (!successModal || !generatedReportId) {

        return;

    }

    generatedReportId.textContent = reportId;
    if (reportSmsStatus) {
        reportSmsStatus.textContent = smsSent
            ? "A confirmation SMS was sent to your mobile."
            : "We could not send a confirmation SMS. Please keep your report ID safe.";
    }

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

        try {
            sessionStorage.setItem("reportTrackingName", lastReporterName);
        } catch (error) {
            console.error("Could not preserve the reporter name for tracking:", error);
        }
        window.location.href = `track.html?id=${encodeURIComponent(generatedReportId.textContent.trim())}`;

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

        const descriptionText = description.value.trim();
        if (descriptionText.length < 15) {
            description.focus();
            showToast("A little more detail needed", "Please describe the issue in at least 15 characters.");
            return;
        }

        if (!reportForm.reportValidity()) {
            showToast("Missing details", "Please provide the category, ward number, street, and issue description.");
            return;
        }

        if (!window.confirm("Are you sure you want to submit this issue? Similar reports are checked and duplicate submissions may be declined.")) {
            return;
        }

        const formData = new FormData(reportForm);
        const photos = Array.from(photoInput && photoInput.files ? photoInput.files : []);

        try {
            const value = name => String(formData.get(name) || "").trim();
            const contact = value("reporterPhone");
            const wardNumber = value("wardNumber");
            const street = value("street");
            const result = await submitReportToSupabase({
                title: value("title"),
                category: value("category"),
                priority: value("priority"),
                description: value("description"),
                location: [street, wardNumber].filter(Boolean).join(", "),
                require_address: true,
                location_details: value("locationDetails"),
                ward_number: wardNumber,
                street,
                latitude: value("latitude"),
                longitude: value("longitude"),
                reporter_name: value("reporterName"),
                reporter_phone: contact,
                reporter_email: value("reporterEmail") || (contact.includes("@") ? contact : "")
            }, photos);

            lastReporterName = value("reporterName");
            const smsSent = await sendReportConfirmationSms(result.report_id, lastReporterName);
            openModal(result.report_id, smsSent);

            reportForm.reset();

            if (charCount) {
                charCount.textContent = "0 / 1000";
            }

            if (photoPreview) {
                clearPhotoPreview();
            }

            if (locationStatus) {
                locationStatus.textContent = "Location not selected";
            }

            if (latitudeInput) {
                latitudeInput.value = "";
            }

            if (longitudeInput) {
                longitudeInput.value = "";
            }

            showToast(
                "Issue logged",
                smsSent
                    ? "Your report was submitted. A confirmation SMS was sent to your mobile."
                    : "Your report was submitted, but we could not send the confirmation SMS. Please keep your report ID."
            );

        } catch (error) {
            console.error(error);
            const isDuplicate = error.message && error.message.startsWith("This issue is already reported.");
            showToast(isDuplicate ? "Duplicate report" : "Submit failed", error.message || "Please try again.");
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
