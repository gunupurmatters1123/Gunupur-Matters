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
    const aspectRatios = {
        portrait: "4 / 5",
        square: "1 / 1",
        landscape: "1.91 / 1"
    };
    let previewUrl = "";
    let editingDraft = null;

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

    function selectedAspectRatio() {
        return aspectRatioInputs.find((input) => input.checked)?.value || "square";
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
        await supabaseFetch(`/storage/v1/object/events/${encodedPath}`, {
            method: "POST",
            headers: sessionHeaders(session, {
                "Content-Type": media.type,
                "x-upsert": "false"
            }),
            body: media
        });
        return path;
    }

    async function removeMedia(path, session) {
        if (!path) return;
        const encodedPath = path.split("/").map(encodeURIComponent).join("/");
        await supabaseFetch(`/storage/v1/object/events/${encodedPath}`, {
            method: "DELETE",
            headers: sessionHeaders(session)
        });
    }

    function clearEditor() {
        editingDraft = null;
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
        title.textContent = post.description.trim().slice(0, 100) || "Untitled draft";
        const detail = document.createElement("small");
        const date = post.activity_date
            ? new Intl.DateTimeFormat(undefined, { year: "numeric", month: "short", day: "numeric" })
                .format(new Date(`${post.activity_date}T00:00:00`))
            : "No activity date";
        detail.textContent = `${date} · ${post.image_url ? "Media attached" : "No media"}`;
        copy.append(title, detail);

        const actions = document.createElement("div");
        actions.className = "managed-post-actions";
        const actionNames = type === "draft"
            ? [["edit", "Edit"], ["publish", "Publish"], ["delete", "Delete"]]
            : [["restore", "Restore"], ["delete", "Delete"]];
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
        try {
            const { session } = await getAdminSession();
            const headers = sessionHeaders(session, { Accept: "application/json" });
            const [draftResponse, archiveResponse] = await Promise.all([
                supabaseFetch("/rest/v1/event_drafts?select=id,description,location,activity_date,image_url,media_aspect_ratio,created_at,updated_at&order=updated_at.desc", { headers }),
                supabaseFetch("/rest/v1/events?select=id,title,description,location,activity_date,image_url,media_aspect_ratio,archived_at&archived_at=not.is.null&order=archived_at.desc", { headers })
            ]);
            const [drafts, archivedPosts] = await Promise.all([
                draftResponse.json(),
                archiveResponse.json()
            ]);
            draftCount.textContent = String(drafts.length);
            archiveCount.textContent = String(archivedPosts.length);
            draftList.replaceChildren(...drafts.map((post) => makeManagedPost(post, "draft")));
            archiveList.replaceChildren(...archivedPosts.map((post) => makeManagedPost(post, "archive")));
            draftStatus.textContent = drafts.length ? "" : "No saved drafts yet.";
            archiveStatus.textContent = archivedPosts.length ? "" : "No archived posts.";
        } catch (error) {
            draftStatus.textContent = "Drafts couldn't be loaded.";
            archiveStatus.textContent = "Archived posts couldn't be loaded.";
            console.error("Unable to load event drafts and archived posts:", error);
        }
    }

    function editDraft(draft) {
        editingDraft = draft;
        captionInput.value = draft.description || "";
        dateInput.value = draft.activity_date || "";
        locationInput.value = draft.location || "";
        photoInput.value = "";
        const selectedAspect = aspectRatioInputs.find((input) => input.value === draft.media_aspect_ratio);
        if (selectedAspect) selectedAspect.checked = true;
        selectedFile.textContent = draft.image_url ? "Saved media attached." : "No media selected yet.";
        showSavedMedia(draft.image_url);
        updatePreview();
        status.textContent = "Editing saved draft. Save your changes or publish it.";
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
        } catch (error) {
            console.error("Unable to verify event publishing access:", error);
            window.location.replace("adlog.html?next=adupload.html");
        }
    }

    captionInput.addEventListener("input", updatePreview);
    dateInput.addEventListener("change", updatePreview);
    locationInput.addEventListener("input", updatePreview);

    photoInput.addEventListener("change", () => {
        const [media] = photoInput.files || [];
        status.textContent = "";
        status.className = "form-status";

        resetMediaPreview();
        selectedFile.textContent = media
            ? media.name
            : editingDraft?.image_url
                ? "Saved media attached."
                : "No media selected yet.";

        if (!media) {
            if (editingDraft?.image_url) showSavedMedia(editingDraft.image_url);
            return;
        }
        const details = mediaDetails(media);
        if (!details) {
            status.textContent = "Choose a JPG, PNG, WebP, GIF, MP4, MOV, or WebM file.";
            status.classList.add("error");
            photoInput.value = "";
            selectedFile.textContent = editingDraft?.image_url
                ? "Saved media attached."
                : "No media selected yet.";
            if (editingDraft?.image_url) showSavedMedia(editingDraft.image_url);
            return;
        }
        if (media.size === 0 || media.size > 8 * 1024 * 1024) {
            status.textContent = "Choose a file larger than 0 bytes and no larger than 8 MB.";
            status.classList.add("error");
            photoInput.value = "";
            selectedFile.textContent = editingDraft?.image_url
                ? "Saved media attached."
                : "No media selected yet.";
            if (editingDraft?.image_url) showSavedMedia(editingDraft.image_url);
            return;
        }

        previewUrl = URL.createObjectURL(media);
        if (details.kind === "video") {
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
        let uploadedPath = "";
        let draftSaved = false;

        try {
            const { session } = await getAdminSession();
            const [media] = photoInput.files || [];
            if (media) uploadedPath = await uploadMedia(media, session);

            const mediaPath = uploadedPath || editingDraft?.image_url || null;
            const draft = {
                description: captionInput.value.trim(),
                location: locationInput.value.trim() || null,
                activity_date: dateInput.value || null,
                image_url: mediaPath,
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
            const savedDrafts = await response.json();
            if (!savedDrafts.length) throw new Error("The draft could not be saved.");
            draftSaved = true;
            uploadedPath = "";
            const replacedPath = savedDrafts[0].image_url !== editingDraft?.image_url
                ? editingDraft?.image_url
                : "";
            clearEditor();
            await refreshPostLists();
            status.textContent = "Your draft has been saved.";
            status.classList.add("success");
            if (replacedPath) {
                try {
                    await removeMedia(replacedPath, session);
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
            if (uploadedPath && !draftSaved) {
                try {
                    const { session } = await getAdminSession();
                    await removeMedia(uploadedPath, session);
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
                if (draft.image_url) {
                    try {
                        await removeMedia(draft.image_url, session);
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
                    `/rest/v1/events?id=eq.${encodeURIComponent(postId)}&archived_at=not.is.null`,
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
                if (!window.confirm("Permanently delete this archived post and its comments? This cannot be undone.")) return;
                button.disabled = true;
                const response = await supabaseFetch(
                    `/rest/v1/events?id=eq.${encodeURIComponent(postId)}&archived_at=not.is.null`,
                    {
                        method: "DELETE",
                        headers: sessionHeaders(session, { Prefer: "return=representation" })
                    }
                );
                const [deletedPost] = await response.json();
                if (!deletedPost) throw new Error("The archived post was not found or was already deleted.");
                await refreshPostLists();
                try {
                    await removeMedia(deletedPost.image_url, session);
                } catch (cleanupError) {
                    archiveStatus.textContent = "Post deleted, but its media file couldn't be removed.";
                    console.error("Unable to remove permanently deleted event media:", cleanupError);
                }
            }
        } catch (error) {
            archiveStatus.textContent = error.message || "The archive action failed. Please try again.";
            console.error("Archived event action failed:", error);
        } finally {
            button.disabled = false;
        }
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
            const [media] = photoInput.files || [];
            const details = media ? mediaDetails(media) : null;
            if (!caption || caption.length > 5000) {
                throw new Error("Add a caption of up to 5,000 characters.");
            }
            if (!dateInput.value) {
                throw new Error("Choose the activity date.");
            }
            if (!(media instanceof File) && !editingDraft?.image_url) {
                throw new Error("Choose a photo or video before publishing.");
            }
            if (media) {
                if (!details) {
                    throw new Error("Choose a JPG, PNG, WebP, GIF, MP4, MOV, or WebM file.");
                }
                if (media.size === 0 || media.size > 8 * 1024 * 1024) {
                    throw new Error("Choose a file larger than 0 bytes and no larger than 8 MB.");
                }
            }

            if (media) {
            uploadedPath = `events/${crypto.randomUUID()}.${details.extension}`;
            const encodedPath = uploadedPath.split("/").map(encodeURIComponent).join("/");
            await supabaseFetch(`/storage/v1/object/events/${encodedPath}`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    "Content-Type": media.type,
                    "x-upsert": "false"
                },
                body: media
            });
            }
            const mediaPath = uploadedPath || editingDraft?.image_url;

            if (editingDraft) {
                await supabaseFetch("/rest/v1/rpc/admin_publish_event_draft", {
                    method: "POST",
                    headers: sessionHeaders(session, { "Content-Type": "application/json" }),
                    body: JSON.stringify({
                        p_draft_id: editingDraft.id,
                        p_description: caption,
                        p_location: locationInput.value.trim() || null,
                        p_activity_date: dateInput.value,
                        p_image_url: mediaPath,
                        p_media_aspect_ratio: selectedAspectRatio()
                    })
                });
            } else {
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
                    image_url: mediaPath,
                    media_aspect_ratio: selectedAspectRatio()
                })
            });
            }

            const previousDraftMedia = editingDraft?.image_url;
            const replacedDraftMedia = uploadedPath && previousDraftMedia && previousDraftMedia !== mediaPath
                ? previousDraftMedia
                : "";
            uploadedPath = "";
            clearEditor();
            await refreshPostLists();
            status.textContent = "Your update is live in the community feed.";
            status.classList.add("success");
            if (replacedDraftMedia) {
                try {
                    await removeMedia(replacedDraftMedia, session);
                } catch (cleanupError) {
                    status.textContent = "Your update is live, but the replaced draft media couldn't be removed.";
                    status.classList.add("error");
                    console.error("Unable to remove replaced event draft media:", cleanupError);
                }
            }
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
                    console.error("Unable to remove the unused activity media:", cleanupError);
                }
            }
        } finally {
            publishButton.disabled = false;
        }
    });

    checkAdminAccess();
})();
