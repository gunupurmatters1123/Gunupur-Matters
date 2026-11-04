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
    const previewVideo = document.getElementById("previewVideo");
    const imagePlaceholder = document.getElementById("imagePlaceholder");
    const selectedFile = document.getElementById("selectedFile");
    const captionCount = document.getElementById("captionCount");
    const aspectRatioInputs = Array.from(form.querySelectorAll('input[name="media_aspect_ratio"]'));
    const saveDraftButton = document.getElementById("saveDraftButton");
    const draftList = document.getElementById("draftList");
    const draftStatus = document.getElementById("draftStatus");
    const draftCount = document.getElementById("draftCount");
    const archiveList = document.getElementById("archiveList");
    const archiveStatus = document.getElementById("archiveStatus");
    const archiveCount = document.getElementById("archiveCount");
    const trashList = document.getElementById("trashList");
    const trashStatus = document.getElementById("trashStatus");
    const trashCount = document.getElementById("trashCount");
    const aspectRatios = {
        portrait: "4 / 5",
        square: "1 / 1",
        landscape: "1.91 / 1"
    };
    let previewUrl = "";
    let editingDraft = null;
    let editingEvent = null;
    let uploadedMediaPaths = [];

    function mediaDetails(file) {
        const formats = {
            "image/jpeg": { extension: "jpg", kind: "image" },
            "image/png": { extension: "png", kind: "image" },
            "image/webp": { extension: "webp", kind: "image" },
            "image/gif": { extension: "gif", kind: "image" },
            "video/mp4": { extension: "mp4", kind: "video" },
            "video/quicktime": { extension: "mov", kind: "video" },
            "video/webm": { extension: "webm", kind: "video" }
        };
        return formats[file.type];
    }

    function validateMediaFiles(files) {
        if (files.length > 10) throw new Error("Choose no more than 10 files.");
        const details = files.map(mediaDetails);
        if (details.some((detail) => !detail)) {
            throw new Error("Choose JPG, PNG, WebP, GIF, MP4, MOV, or WebM files.");
        }
        if (files.some((file) => file.size === 0 || file.size > 8 * 1024 * 1024)) {
            throw new Error("Each file must be larger than 0 bytes and no larger than 8 MB.");
        }
        if (files.length > 1 && details.some((detail) => detail.kind === "video")) {
            throw new Error("Choose either up to 10 photos or one video, not both.");
        }
        return details;
    }

    function selectedAspectRatio() {
        return aspectRatioInputs.find((input) => input.checked)?.value || "square";
    }

    function savedMediaPaths(post) {
        return Array.isArray(post?.media_urls) && post.media_urls.length
            ? post.media_urls
            : post?.image_url ? [post.image_url] : [];
    }

    function resetMediaPreview() {
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        previewUrl = "";
        previewImage.removeAttribute("src");
        previewVideo.removeAttribute("src");
        previewVideo.load();
        previewImage.hidden = true;
        previewVideo.hidden = true;
        imagePlaceholder.hidden = false;
    }

    function mediaUrl(path) {
        if (path.startsWith("Photos/") || /^https:\/\//i.test(path)) return path;
        return `${SUPABASE_PROJECT_URL}/storage/v1/object/public/events/${path
            .split("/")
            .map(encodeURIComponent)
            .join("/")}`;
    }

    function isVideoPath(path) {
        return /\.(mp4|mov|webm)$/i.test(path || "");
    }

    function showSavedMedia(path) {
        resetMediaPreview();
        if (!path) return;
        const source = mediaUrl(path);
        if (isVideoPath(path)) {
            previewVideo.src = source;
            previewVideo.hidden = false;
        } else {
            previewImage.src = source;
            previewImage.hidden = false;
        }
        imagePlaceholder.hidden = true;
    }

    function sessionHeaders(session, headers = {}) {
        return {
            ...headers,
            Authorization: `Bearer ${session.access_token}`
        };
    }

    async function uploadMedia(media, session) {
        const details = mediaDetails(media);
        if (!details) {
            throw new Error("Choose a JPG, PNG, WebP, GIF, MP4, MOV, or WebM file.");
        }
        if (media.size === 0 || media.size > 8 * 1024 * 1024) {
            throw new Error("Choose a file larger than 0 bytes and no larger than 8 MB.");
        }

        const path = `events/${crypto.randomUUID()}.${details.extension}`;
        const encodedPath = path.split("/").map(encodeURIComponent).join("/");
        const response = await supabaseFetch(`/storage/v1/object/events/${encodedPath}`, {
            method: "POST",
            headers: sessionHeaders(session, {
                "Content-Type": media.type,
                "x-upsert": "false"
            }),
            body: media
        });
        if (!response.ok) throw new Error("A media file couldn't be uploaded.");
        return path;
    }

    async function removeMedia(path, session) {
        if (!path || !path.startsWith("events/")) return;
        const encodedPath = path.split("/").map(encodeURIComponent).join("/");
        const response = await supabaseFetch(`/storage/v1/object/events/${encodedPath}`, {
            method: "DELETE",
            headers: sessionHeaders(session)
        });
        if (!response.ok) throw new Error("A media file couldn't be removed.");
    }

    function clearEditor() {
        editingDraft = null;
        editingEvent = null;
        saveDraftButton.hidden = false;
        publishButton.firstChild.textContent = "Publish update ";
        form.reset();
        dateInput.value = localDateValue();
        selectedFile.textContent = "No media selected yet.";
        resetMediaPreview();
        updatePreview();
    }

    function makeManagedPost(post, type) {
        const item = document.createElement("article");
        item.className = "managed-post";

        const copy = document.createElement("div");
        copy.className = "managed-post-copy";
        const title = document.createElement("strong");
        title.textContent = (post.title || post.description || "").trim().slice(0, 100) || "Untitled draft";
        const detail = document.createElement("small");
        const date = post.activity_date
            ? new Intl.DateTimeFormat(undefined, { year: "numeric", month: "short", day: "numeric" })
                .format(new Date(`${post.activity_date}T00:00:00`))
            : "No activity date";
        const mediaCount = savedMediaPaths(post).length;
        detail.textContent = `${date} · ${mediaCount ? `${mediaCount} ${mediaCount === 1 ? "media file" : "media files"}` : "No media"}`;
        copy.append(title, detail);

        const actions = document.createElement("div");
        actions.className = "managed-post-actions";
        const actionNames = type === "draft"
            ? [["edit", "Edit"], ["publish", "Publish"], ["delete", "Delete"]]
            : type === "archive"
                ? [["restore", "Restore"], ["delete", "Move to trash"]]
                : [["restore", "Restore to feed"], ["archive", "Move to archive"]];
        actionNames.forEach(([action, label]) => {
            const button = document.createElement("button");
            button.className = `management-action${action === "delete" ? " danger" : ""}`;
            button.type = "button";
            button.dataset.action = action;
            button.dataset.postId = post.id;
            button.textContent = label;
            actions.append(button);
        });
        item.append(copy, actions);
        return item;
    }

    async function refreshPostLists() {
        draftStatus.textContent = "Loading drafts...";
        archiveStatus.textContent = "Loading archived posts...";
        trashStatus.textContent = "Loading deleted posts...";
        try {
            const { session } = await getAdminSession();
            const headers = sessionHeaders(session, { Accept: "application/json" });
            const [draftResponse, archiveResponse, trashResponse] = await Promise.all([
                supabaseFetch("/rest/v1/event_drafts?select=id,description,location,activity_date,image_url,media_urls,media_aspect_ratio,created_at,updated_at&order=updated_at.desc", { headers }),
                supabaseFetch("/rest/v1/events?select=id,title,description,location,activity_date,image_url,media_urls,media_aspect_ratio,archived_at,deleted_at&archived_at=not.is.null&deleted_at=is.null&order=archived_at.desc", { headers }),
                supabaseFetch("/rest/v1/events?select=id,title,description,location,activity_date,image_url,media_urls,media_aspect_ratio,archived_at,deleted_at&deleted_at=not.is.null&order=deleted_at.desc", { headers })
            ]);
            const [drafts, archivedPosts, trashedPosts] = await Promise.all([
                draftResponse.json(),
                archiveResponse.json(),
                trashResponse.json()
            ]);
            draftCount.textContent = String(drafts.length);
            archiveCount.textContent = String(archivedPosts.length);
            trashCount.textContent = String(trashedPosts.length);
            draftList.replaceChildren(...drafts.map((post) => makeManagedPost(post, "draft")));
            archiveList.replaceChildren(...archivedPosts.map((post) => makeManagedPost(post, "archive")));
            trashList.replaceChildren(...trashedPosts.map((post) => makeManagedPost(post, "trash")));
            draftStatus.textContent = drafts.length ? "" : "No saved drafts yet.";
            archiveStatus.textContent = archivedPosts.length ? "" : "No archived posts.";
            trashStatus.textContent = trashedPosts.length ? "" : "Trash is empty.";
        } catch (error) {
            const message = error.message || "Event management data couldn't be loaded.";
            draftStatus.textContent = message;
            archiveStatus.textContent = message;
            trashStatus.textContent = message;
            console.error("Unable to load event drafts and archived posts:", error);
        }
    }

    function editDraft(draft) {
        editingDraft = draft;
        editingEvent = null;
        captionInput.value = draft.description || "";
        dateInput.value = draft.activity_date || "";
        locationInput.value = draft.location || "";
        photoInput.value = "";
        const selectedAspect = aspectRatioInputs.find((input) => input.value === draft.media_aspect_ratio);
        if (selectedAspect) selectedAspect.checked = true;
        const mediaPaths = savedMediaPaths(draft);
        selectedFile.textContent = mediaPaths.length
            ? `${mediaPaths.length} saved ${mediaPaths.length === 1 ? "media file" : "media files"} attached.`
            : "No media selected yet.";
        showSavedMedia(mediaPaths[0]);
        updatePreview();
        status.textContent = "Editing saved draft. Save your changes or publish it.";
        status.className = "form-status";
        publishButton.firstChild.textContent = "Publish update ";
        saveDraftButton.hidden = false;
        composer.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    function editEvent(event) {
        editingDraft = null;
        editingEvent = event;
        captionInput.value = event.description || "";
        dateInput.value = event.activity_date || "";
        locationInput.value = event.location || "";
        photoInput.value = "";
        const selectedAspect = aspectRatioInputs.find((input) => input.value === event.media_aspect_ratio);
        if (selectedAspect) selectedAspect.checked = true;
        const mediaPaths = savedMediaPaths(event);
        selectedFile.textContent = mediaPaths.length
            ? `${mediaPaths.length} saved ${mediaPaths.length === 1 ? "media file" : "media files"} attached.`
            : "No media selected yet.";
        showSavedMedia(mediaPaths[0]);
        updatePreview();
        publishButton.firstChild.textContent = "Save changes ";
        saveDraftButton.hidden = true;
        status.textContent = "Editing a published post. Save changes to update it on the community feed.";
        status.className = "form-status";
        composer.scrollIntoView({ behavior: "smooth", block: "start" });
    }

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

        document.getElementById("previewImageWrap").style.aspectRatio =
            aspectRatios[selectedAspectRatio()];
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
            await refreshPostLists();
            const eventId = new URLSearchParams(window.location.search).get("edit");
            if (eventId) {
                if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(eventId)) {
                    throw new Error("The event link is invalid.");
                }
                const { session } = await getAdminSession();
                const response = await supabaseFetch(
                    `/rest/v1/events?select=id,title,description,location,activity_date,image_url,media_urls,media_aspect_ratio&id=eq.${encodeURIComponent(eventId)}`,
                    { headers: sessionHeaders(session, { Accept: "application/json" }) }
                );
                const [event] = await response.json();
                if (!event) throw new Error("The event wasn't found or you can't edit it.");
                editEvent(event);
            }
        } catch (error) {
            console.error("Unable to verify event publishing access:", error);
            if (!getAdminSession || !localStorage.getItem(SUPABASE_ADMIN_SESSION_KEY)) {
                window.location.replace("adlog.html?next=adupload.html");
                return;
            }
            status.textContent = error.message || "The event editor couldn't be opened.";
            status.classList.add("error");
        }
    }

    captionInput.addEventListener("input", updatePreview);
    dateInput.addEventListener("change", updatePreview);
    locationInput.addEventListener("input", updatePreview);

    photoInput.addEventListener("change", () => {
        const files = Array.from(photoInput.files || []);
        const savedPaths = savedMediaPaths(editingDraft || editingEvent);
        status.textContent = "";
        status.className = "form-status";

        resetMediaPreview();
        selectedFile.textContent = files.length
            ? files.length > 1
                ? `${files.length} photos selected.`
                : files[0].name
            : savedPaths.length
                ? `${savedPaths.length} saved ${savedPaths.length === 1 ? "media file" : "media files"} attached.`
                : "No media selected yet.";

        if (!files.length) {
            if (savedPaths.length) showSavedMedia(savedPaths[0]);
            return;
        }
        let details;
        try {
            details = validateMediaFiles(files);
        } catch (error) {
            status.textContent = error.message;
            status.classList.add("error");
            photoInput.value = "";
            selectedFile.textContent = savedPaths.length
                ? `${savedPaths.length} saved ${savedPaths.length === 1 ? "media file" : "media files"} attached.`
                : "No media selected yet.";
            if (savedPaths.length) showSavedMedia(savedPaths[0]);
            return;
        }

        previewUrl = URL.createObjectURL(files[0]);
        if (details[0].kind === "video") {
            previewVideo.src = previewUrl;
            previewVideo.hidden = false;
        } else {
            previewImage.src = previewUrl;
            previewImage.hidden = false;
        }
        imagePlaceholder.hidden = true;
    });

    aspectRatioInputs.forEach((input) => input.addEventListener("change", updatePreview));

    saveDraftButton.addEventListener("click", async () => {
        saveDraftButton.disabled = true;
        status.textContent = "";
        status.className = "form-status";
        let uploadedPaths = [];
        let draftSaved = false;

        try {
            const { session } = await getAdminSession();
            const files = Array.from(photoInput.files || []);
            validateMediaFiles(files);
            for (const media of files) uploadedPaths.push(await uploadMedia(media, session));

            const mediaPaths = files.length ? uploadedPaths : savedMediaPaths(editingDraft);
            const draft = {
                description: captionInput.value.trim(),
                location: locationInput.value.trim() || null,
                activity_date: dateInput.value || null,
                image_url: mediaPaths[0] || null,
                media_urls: mediaPaths,
                media_aspect_ratio: selectedAspectRatio(),
                updated_at: new Date().toISOString()
            };
            const response = editingDraft
                ? await supabaseFetch(`/rest/v1/event_drafts?id=eq.${encodeURIComponent(editingDraft.id)}`, {
                    method: "PATCH",
                    headers: sessionHeaders(session, {
                        "Content-Type": "application/json",
                        Prefer: "return=representation"
                    }),
                    body: JSON.stringify(draft)
                })
                : await supabaseFetch("/rest/v1/event_drafts", {
                    method: "POST",
                    headers: sessionHeaders(session, {
                        "Content-Type": "application/json",
                        Prefer: "return=representation"
                    }),
                    body: JSON.stringify(draft)
                });
            if (!response.ok) throw new Error("The draft could not be saved.");
            const savedDrafts = await response.json();
            if (!savedDrafts.length) throw new Error("The draft could not be saved.");
            draftSaved = true;
            uploadedPaths = [];
            const savedPaths = new Set(mediaPaths);
            const replacedPaths = savedMediaPaths(editingDraft).filter((path) => !savedPaths.has(path));
            clearEditor();
            await refreshPostLists();
            status.textContent = "Your draft has been saved.";
            status.classList.add("success");
            if (replacedPaths.length) {
                try {
                    await Promise.all(replacedPaths.map((path) => removeMedia(path, session)));
                } catch (cleanupError) {
                    status.textContent = "Your draft is saved, but its replaced media couldn't be removed.";
                    status.classList.add("error");
                    console.error("Unable to remove replaced draft media:", cleanupError);
                }
            }
        } catch (error) {
            status.textContent = error.message || "Couldn't save the draft. Please try again.";
            status.classList.add("error");
            console.error("Event draft save failed:", error);
            if (uploadedPaths.length && !draftSaved) {
                try {
                    const { session } = await getAdminSession();
                    await Promise.all(uploadedPaths.map((path) => removeMedia(path, session)));
                } catch (cleanupError) {
                    console.error("Unable to remove unused draft media:", cleanupError);
                }
            }
        } finally {
            saveDraftButton.disabled = false;
        }
    });

    draftList.addEventListener("click", async (clickEvent) => {
        const button = clickEvent.target.closest("button[data-action]");
        if (!button) return;
        const action = button.dataset.action;
        const draftId = button.dataset.postId;

        try {
            const { session } = await getAdminSession();
            const response = await supabaseFetch(
                `/rest/v1/event_drafts?id=eq.${encodeURIComponent(draftId)}`,
                { headers: sessionHeaders(session, { Accept: "application/json" }) }
            );
            const [draft] = await response.json();
            if (!draft) throw new Error("The draft was not found.");

            if (action === "edit" || action === "publish") {
                editDraft(draft);
                if (action === "publish") form.requestSubmit();
                return;
            }
            if (action === "delete") {
                if (!window.confirm("Permanently delete this draft?")) return;
                button.disabled = true;
                const deleteResponse = await supabaseFetch(
                    `/rest/v1/event_drafts?id=eq.${encodeURIComponent(draftId)}`,
                    {
                        method: "DELETE",
                        headers: sessionHeaders(session, { Prefer: "return=representation" })
                    }
                );
                const deletedDrafts = await deleteResponse.json();
                if (!deletedDrafts.length) throw new Error("The draft was not found or was already deleted.");
                await refreshPostLists();
                const draftMedia = savedMediaPaths(draft);
                if (draftMedia.length) {
                    try {
                        await Promise.all(draftMedia.map((path) => removeMedia(path, session)));
                    } catch (cleanupError) {
                        draftStatus.textContent = "Draft deleted, but its media file couldn't be removed.";
                        console.error("Unable to remove deleted draft media:", cleanupError);
                    }
                }
            }
        } catch (error) {
            draftStatus.textContent = error.message || "The draft action failed. Please try again.";
            console.error("Event draft action failed:", error);
        } finally {
            button.disabled = false;
        }
    });

    archiveList.addEventListener("click", async (clickEvent) => {
        const button = clickEvent.target.closest("button[data-action]");
        if (!button) return;
        const action = button.dataset.action;
        const postId = button.dataset.postId;

        try {
            const { session } = await getAdminSession();
            if (action === "restore") {
                const response = await supabaseFetch(
                    `/rest/v1/events?id=eq.${encodeURIComponent(postId)}&archived_at=not.is.null&deleted_at=is.null`,
                    {
                        method: "PATCH",
                        headers: sessionHeaders(session, {
                            "Content-Type": "application/json",
                            Prefer: "return=representation"
                        }),
                        body: JSON.stringify({ archived_at: null })
                    }
                );
                if (!(await response.json()).length) throw new Error("The archived post was not found.");
                await refreshPostLists();
                archiveStatus.textContent = "The post has been restored to the community feed.";
                return;
            }
            if (action === "delete") {
                if (!window.confirm("Move this post to Trash? An admin can restore it later.")) return;
                button.disabled = true;
                const response = await supabaseFetch(
                    `/rest/v1/events?id=eq.${encodeURIComponent(postId)}&archived_at=not.is.null&deleted_at=is.null`,
                    {
                        method: "PATCH",
                        headers: sessionHeaders(session, {
                            "Content-Type": "application/json",
                            Prefer: "return=representation"
                        }),
                        body: JSON.stringify({
                            archived_at: null,
                            deleted_at: new Date().toISOString()
                        })
                    }
                );
                if (!(await response.json()).length) throw new Error("The archived post wasn't found or was already changed.");
                await refreshPostLists();
                archiveStatus.textContent = "The post has been moved to Trash and can be restored.";
            }
        } catch (error) {
            archiveStatus.textContent = error.message || "The archive action failed. Please try again.";
            console.error("Archived event action failed:", error);
        } finally {
            button.disabled = false;
        }
    });

    trashList.addEventListener("click", async (clickEvent) => {
        const button = clickEvent.target.closest("button[data-action]");
        if (!button) return;
        const action = button.dataset.action;
        const postId = button.dataset.postId;

        try {
            const { session } = await getAdminSession();
            const update = action === "restore"
                ? { deleted_at: null, archived_at: null }
                : { deleted_at: null, archived_at: new Date().toISOString() };
            const response = await supabaseFetch(
                `/rest/v1/events?id=eq.${encodeURIComponent(postId)}&deleted_at=not.is.null`,
                {
                    method: "PATCH",
                    headers: sessionHeaders(session, {
                        "Content-Type": "application/json",
                        Prefer: "return=representation"
                    }),
                    body: JSON.stringify(update)
                }
            );
            if (!(await response.json()).length) throw new Error("The post wasn't found in Trash or was already changed.");
            await refreshPostLists();
            trashStatus.textContent = action === "restore"
                ? "The post has been restored to the community feed."
                : "The post has been moved to Archived posts.";
        } catch (error) {
            trashStatus.textContent = error.message || "The trash action failed. Please try again.";
            console.error("Deleted event action failed:", error);
        } finally {
            button.disabled = false;
        }
    });

    form.addEventListener("submit", async (submitEvent) => {
        submitEvent.preventDefault();
        status.textContent = "";
        status.className = "form-status";
        publishButton.disabled = true;
        let uploadedPaths = [];

        try {
            const { session } = await getAdminSession();
            const caption = captionInput.value.trim();
            const files = Array.from(photoInput.files || []);
            validateMediaFiles(files);
            if (!caption || caption.length > 5000) {
                throw new Error("Add a caption of up to 5,000 characters.");
            }
            if (!dateInput.value) {
                throw new Error("Choose the activity date.");
            }
            const existingMedia = savedMediaPaths(editingDraft || editingEvent);
            if (!files.length && !existingMedia.length) {
                throw new Error("Choose a photo or video before publishing.");
            }
            for (const media of files) uploadedPaths.push(await uploadMedia(media, session));
            const mediaPaths = files.length ? uploadedPaths : existingMedia;
            const mediaPath = mediaPaths[0];

            if (editingDraft) {
                const response = await supabaseFetch("/rest/v1/rpc/admin_publish_event_draft", {
                    method: "POST",
                    headers: sessionHeaders(session, { "Content-Type": "application/json" }),
                    body: JSON.stringify({
                        p_draft_id: editingDraft.id,
                        p_description: caption,
                        p_location: locationInput.value.trim() || null,
                        p_activity_date: dateInput.value,
                        p_image_url: mediaPath,
                        p_media_aspect_ratio: selectedAspectRatio(),
                        p_media_urls: mediaPaths
                    })
                });
                if (!response.ok) throw new Error("The draft couldn't be published.");
            } else if (editingEvent) {
                const title = Array.from(caption).slice(0, 180).join("");
                const response = await supabaseFetch(
                    `/rest/v1/events?id=eq.${encodeURIComponent(editingEvent.id)}&deleted_at=is.null`,
                    {
                        method: "PATCH",
                        headers: sessionHeaders(session, {
                            "Content-Type": "application/json",
                            Prefer: "return=representation"
                        }),
                        body: JSON.stringify({
                            title,
                            description: caption,
                            location: locationInput.value.trim() || null,
                            activity_date: dateInput.value,
                            image_url: mediaPath,
                            media_urls: mediaPaths,
                            media_aspect_ratio: selectedAspectRatio()
                        })
                    }
                );
                if (!response.ok) throw new Error("The post couldn't be updated.");
                if (!(await response.json()).length) throw new Error("The post wasn't found or was moved to Trash.");
            } else {
                const title = Array.from(caption).slice(0, 180).join("");
                const response = await supabaseFetch("/rest/v1/events", {
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
                        image_url: mediaPath,
                        media_urls: mediaPaths,
                        media_aspect_ratio: selectedAspectRatio()
                    })
                });
                if (!response.ok) throw new Error("The update couldn't be published.");
            }

            const previousMedia = savedMediaPaths(editingDraft || editingEvent);
            const currentMedia = new Set(mediaPaths);
            const replacedMedia = files.length
                ? previousMedia.filter((path) => !currentMedia.has(path))
                : [];
            const updatedEvent = Boolean(editingEvent);
            uploadedPaths = [];
            clearEditor();
            await refreshPostLists();
            status.textContent = updatedEvent
                ? "The post has been updated."
                : "Your update is live in the community feed.";
            status.classList.add("success");
            if (replacedMedia.length) {
                try {
                    await Promise.all(replacedMedia.map((path) => removeMedia(path, session)));
                } catch (cleanupError) {
                    status.textContent = "Your update is saved, but the replaced media couldn't be removed.";
                    status.classList.add("error");
                    console.error("Unable to remove replaced event draft media:", cleanupError);
                }
            }
        } catch (error) {
            status.textContent = error.message || "Couldn't publish your update. Please try again.";
            status.classList.add("error");
            console.error("Activity publishing failed:", error);

            if (uploadedPaths.length) {
                try {
                    const { session } = await getAdminSession();
                    await Promise.all(uploadedPaths.map((path) => removeMedia(path, session)));
                } catch (cleanupError) {
                    console.error("Unable to remove the unused activity media:", cleanupError);
                }
            }
        } finally {
            publishButton.disabled = false;
        }
    });

    checkAdminAccess();
})();
