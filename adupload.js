(() => {
    const adminPage = document.getElementById("adminPage");
    const composer = document.getElementById("composer");
    const form = document.getElementById("activityForm");
    const captionInput = document.getElementById("caption");
    const dateInput = document.getElementById("activityDate");
    const locationInput = document.getElementById("location");
    const photoInput = document.getElementById("photo");
    const status = document.getElementById("formStatus");
    const publishButton = document.getElementById("publishButton");
    const previewCaption = document.getElementById("previewCaption");
    const previewLocation = document.getElementById("previewLocation");
    const previewDate = document.getElementById("previewDate");
    const previewImage = document.getElementById("previewImage");
    const imagePlaceholder = document.getElementById("imagePlaceholder");
    const selectedFile = document.getElementById("selectedFile");
    const captionCount = document.getElementById("captionCount");
    let previewUrl = "";

    function localDateValue() {
        const now = new Date();
        return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    }

    function updatePreview() {
        previewCaption.textContent = captionInput.value.trim()
            || "Your caption will appear here. Share a small moment that made a difference.";
        captionCount.textContent = `${captionInput.value.length} / 5000`;

        const location = locationInput.value.trim();
        previewLocation.textContent = location;
        previewLocation.hidden = !location;

        if (dateInput.value) {
            const date = new Date(`${dateInput.value}T00:00:00`);
            previewDate.textContent = Number.isNaN(date.getTime())
                ? "Activity date"
                : new Intl.DateTimeFormat(undefined, { year: "numeric", month: "short", day: "numeric" }).format(date);
        } else {
            previewDate.textContent = "Activity date";
        }
    }

    async function checkAdminAccess() {
        try {
            if (typeof getAdminSession !== "function") {
                throw new Error("Admin sign-in is unavailable.");
            }
            await getAdminSession();
            adminPage.hidden = false;
            composer.hidden = false;
            dateInput.value = localDateValue();
            updatePreview();
        } catch (error) {
            console.error("Unable to verify event publishing access:", error);
            window.location.replace("adlog.html?next=adupload.html");
        }
    }

    captionInput.addEventListener("input", updatePreview);
    dateInput.addEventListener("change", updatePreview);
    locationInput.addEventListener("input", updatePreview);

    photoInput.addEventListener("change", () => {
        const [photo] = photoInput.files || [];
        status.textContent = "";
        status.className = "form-status";

        if (previewUrl) URL.revokeObjectURL(previewUrl);
        previewUrl = "";
        previewImage.removeAttribute("src");
        previewImage.hidden = true;
        imagePlaceholder.hidden = false;
        selectedFile.textContent = photo ? photo.name : "No photo selected yet.";

        if (!photo) return;
        if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(photo.type)) {
            status.textContent = "Choose a JPG, PNG, WebP, or GIF image.";
            status.classList.add("error");
            photoInput.value = "";
            selectedFile.textContent = "No photo selected yet.";
            return;
        }
        if (photo.size === 0 || photo.size > 8 * 1024 * 1024) {
            status.textContent = "Choose a photo larger than 0 bytes and no larger than 8 MB.";
            status.classList.add("error");
            photoInput.value = "";
            selectedFile.textContent = "No photo selected yet.";
            return;
        }

        previewUrl = URL.createObjectURL(photo);
        previewImage.src = previewUrl;
        previewImage.hidden = false;
        imagePlaceholder.hidden = true;
    });

    form.addEventListener("submit", async (submitEvent) => {
        submitEvent.preventDefault();
        status.textContent = "";
        status.className = "form-status";
        publishButton.disabled = true;
        let uploadedPath = "";
        let accessToken = "";

        try {
            const { session } = await getAdminSession();
            accessToken = session.access_token;
            const caption = captionInput.value.trim();
            const [photo] = photoInput.files || [];
            if (!caption || caption.length > 5000) {
                throw new Error("Add a caption of up to 5,000 characters.");
            }
            if (!dateInput.value) {
                throw new Error("Choose the activity date.");
            }
            if (!(photo instanceof File) || photo.size === 0 || photo.size > 8 * 1024 * 1024) {
                throw new Error("Choose a photo no larger than 8 MB.");
            }

            const extensions = {
                "image/jpeg": "jpg",
                "image/png": "png",
                "image/webp": "webp",
                "image/gif": "gif"
            };
            const extension = extensions[photo.type];
            if (!extension) throw new Error("Choose a JPG, PNG, WebP, or GIF image.");

            uploadedPath = `events/${crypto.randomUUID()}.${extension}`;
            const encodedPath = uploadedPath.split("/").map(encodeURIComponent).join("/");
            await supabaseFetch(`/storage/v1/object/events/${encodedPath}`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    "Content-Type": photo.type,
                    "x-upsert": "false"
                },
                body: photo
            });

            const title = Array.from(caption).slice(0, 180).join("");
            await supabaseFetch("/rest/v1/events", {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    "Content-Type": "application/json",
                    Prefer: "return=representation"
                },
                body: JSON.stringify({
                    title,
                    description: caption,
                    location: locationInput.value.trim() || null,
                    activity_date: dateInput.value,
                    image_url: uploadedPath
                })
            });

            form.reset();
            dateInput.value = localDateValue();
            selectedFile.textContent = "No photo selected yet.";
            if (previewUrl) URL.revokeObjectURL(previewUrl);
            previewUrl = "";
            previewImage.removeAttribute("src");
            previewImage.hidden = true;
            imagePlaceholder.hidden = false;
            updatePreview();
            status.textContent = "Your update is live in the community feed.";
            status.classList.add("success");
        } catch (error) {
            status.textContent = error.message || "Couldn't publish your update. Please try again.";
            status.classList.add("error");
            console.error("Activity publishing failed:", error);

            if (uploadedPath && accessToken) {
                const encodedPath = uploadedPath.split("/").map(encodeURIComponent).join("/");
                try {
                    await supabaseFetch(`/storage/v1/object/events/${encodedPath}`, {
                        method: "DELETE",
                        headers: { Authorization: `Bearer ${accessToken}` }
                    });
                } catch (cleanupError) {
                    console.error("Unable to remove the unused activity photo:", cleanupError);
                }
            }
        } finally {
            publishButton.disabled = false;
        }
    });

    checkAdminAccess();
})();
