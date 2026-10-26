(() => {
    const EVENTS_BUCKET = `${SUPABASE_PROJECT_URL}/storage/v1/object/public/events`;
    const FEATURED_POST = {
        id: "community-highlights",
        title: "Our community, our story",
        description: "This is where we will share photos and updates from our community activities. Check back for the latest moments from Gunupur.",
        location: "Gunupur",
        activity_date: null,
        image_url: "Photos/prom_team.png",
        featured: true
    };
    const timeline = document.getElementById("timeline");
    const pageStatus = document.getElementById("pageStatus");
    const publishPanel = document.getElementById("publishPanel");
    const adminHint = document.getElementById("adminHint");
    const publishForm = document.getElementById("publishForm");
    const publishToggle = document.getElementById("publishToggle");
    const publishStatus = document.getElementById("publishStatus");
    let events = [];

    async function fetchRows(resource, query) {
        const response = await supabaseFetch(`${resource}?${query}`, {
            headers: { Accept: "application/json" }
        });
        return response.json();
    }

    function safeText(value) {
        return String(value ?? "");
    }

    function makeElement(tag, className, text) {
        const element = document.createElement(tag);
        if (className) element.className = className;
        if (text !== undefined) element.textContent = text;
        return element;
    }

    function formatDate(value) {
        if (!value) return "";
        const date = new Date(`${value}T00:00:00`);
        return Number.isNaN(date.getTime())
            ? ""
            : new Intl.DateTimeFormat(undefined, { year: "numeric", month: "long", day: "numeric" }).format(date);
    }

    function imageUrl(event) {
        if (event.image_url === FEATURED_POST.image_url) return event.image_url;
        if (/^https:\/\//i.test(event.image_url || "")) return event.image_url;
        return `${EVENTS_BUCKET}/${String(event.image_url || "").split("/").map(encodeURIComponent).join("/")}`;
    }

    function makeComment(comment) {
        const item = makeElement("li", "comment");
        item.append(makeElement("strong", "", comment.author_name));
        item.append(makeElement("p", "", comment.comment_text));
        const time = makeElement("time", "", new Date(comment.created_at).toLocaleString());
        time.dateTime = comment.created_at;
        item.append(time);
        return item;
    }

    function makeCommentForm(event) {
        const form = makeElement("form", "comment-form");
        form.noValidate = false;
        const nameLabel = makeElement("label", "", "Your name");
        const nameInput = document.createElement("input");
        nameInput.name = "author_name";
        nameInput.maxLength = 80;
        nameInput.autocomplete = "name";
        nameInput.required = true;
        nameLabel.append(nameInput);
        const textLabel = makeElement("label", "", "Your perspective");
        const textInput = document.createElement("textarea");
        textInput.name = "comment_text";
        textInput.maxLength = 1000;
        textInput.rows = 3;
        textInput.required = true;
        textLabel.append(textInput);
        const status = makeElement("p", "comment-status");
        status.setAttribute("role", "status");
        const submit = makeElement("button", "secondary-button", "Add comment");
        submit.type = "submit";
        form.append(nameLabel, textLabel, submit, status);
        form.addEventListener("submit", async (submitEvent) => {
            submitEvent.preventDefault();
            status.textContent = "";
            status.className = "comment-status";
            submit.disabled = true;
            try {
                const response = await supabaseFetch("/rest/v1/event_comments", {
                    method: "POST",
                    headers: { "Content-Type": "application/json", Prefer: "return=representation" },
                    body: JSON.stringify({
                        event_id: event.id,
                        author_name: nameInput.value.trim(),
                        comment_text: textInput.value.trim()
                    })
                });
                const rows = await response.json();
                const comment = rows[0];
                const card = form.closest(".event-card");
                const list = card.querySelector(".comment-list");
                const empty = card.querySelector(".no-comments");
                if (empty) empty.remove();
                list.append(makeComment(comment));
                card.querySelector(".comment-count").textContent = String(Number(card.querySelector(".comment-count").textContent) + 1);
                form.reset();
                status.textContent = "Your comment has been added.";
                status.classList.add("success");
            } catch (error) {
                status.textContent = "Couldn't add your comment. Please try again.";
                status.classList.add("error");
                console.error("Event comment submission failed:", error);
            } finally {
                submit.disabled = false;
            }
        });
        return form;
    }

    function makeEventCard(event, comments) {
        const article = makeElement("article", `event-card${event.featured ? " featured-event" : ""}`);
        article.id = `event-${event.id}`;
        const image = makeElement("img", "event-photo");
        image.src = imageUrl(event);
        image.alt = safeText(event.title);
        image.loading = "lazy";
        article.append(image);

        const content = makeElement("div", "event-content");
        const meta = makeElement("div", "event-meta");
        meta.append(makeElement("span", "", event.location || "Gunupur Matters"));
        meta.append(makeElement("span", "", formatDate(event.activity_date) || "Community highlights"));
        content.append(meta);
        content.append(makeElement("h2", "", event.title));
        content.append(makeElement("p", "event-description", event.description));

        const commentSection = makeElement("section", "comments");
        const commentHeading = makeElement("h3", "", "Community perspectives");
        const count = makeElement("span", "comment-count", String(comments.length));
        count.setAttribute("aria-label", `${comments.length} comments`);
        commentHeading.append(count);
        commentSection.append(commentHeading);
        const commentList = makeElement("ul", "comment-list");
        comments.forEach((comment) => commentList.append(makeComment(comment)));
        commentSection.append(commentList);
        if (comments.length === 0) {
            commentSection.append(makeElement("p", "no-comments", "No comments yet. Be the first to share your perspective."));
        }
        if (!event.featured) {
            commentSection.append(makeCommentForm(event));
        } else {
            commentSection.append(makeElement("p", "no-comments", "Comments will be available when the events service is connected."));
        }
        content.append(commentSection);
        article.append(content);
        return article;
    }

    function renderTimeline(commentRows = []) {
        const commentsByEvent = new Map();
        commentRows.forEach((comment) => {
            if (!commentsByEvent.has(comment.event_id)) commentsByEvent.set(comment.event_id, []);
            commentsByEvent.get(comment.event_id).push(comment);
        });
        timeline.replaceChildren(...events.map((event) => makeEventCard(event, commentsByEvent.get(event.id) || [])));
    }

    async function loadTimeline() {
        try {
            const rows = await fetchRows(
                "/rest/v1/events",
                "select=id,title,description,location,activity_date,image_url,created_at&order=activity_date.desc,created_at.desc&limit=40"
            );
            events = rows.length > 0 ? rows : [FEATURED_POST];
            if (rows.length > 0) {
                const ids = rows.map((event) => encodeURIComponent(event.id)).join(",");
                const comments = await fetchRows(
                    "/rest/v1/event_comments",
                    `select=id,event_id,author_name,comment_text,created_at&event_id=in.(${ids})&order=created_at.asc`
                );
                renderTimeline(comments);
                pageStatus.textContent = "";
            } else {
                renderTimeline();
                pageStatus.textContent = "Be the first to share an activity. Sign in as an admin to publish an update.";
            }
        } catch (error) {
            events = [FEATURED_POST];
            renderTimeline();
            pageStatus.textContent = "Showing a community highlight. The shared events feed will appear after its one-time Supabase setup.";
            console.error("Unable to load the community events feed:", error);
        }
    }

    async function setupAdminPublishing() {
        if (typeof getAdminSession !== "function") return;
        try {
            await getAdminSession();
            publishPanel.hidden = false;
            adminHint.hidden = true;
        } catch {
            publishPanel.hidden = true;
            adminHint.hidden = false;
        }
    }

    publishToggle.addEventListener("click", () => {
        const willOpen = publishForm.hidden;
        publishForm.hidden = !willOpen;
        publishToggle.setAttribute("aria-expanded", String(willOpen));
    });

    publishForm.addEventListener("submit", async (submitEvent) => {
        submitEvent.preventDefault();
        publishStatus.textContent = "";
        publishStatus.className = "form-status";
        const submit = publishForm.querySelector("button[type=submit]");
        submit.disabled = true;
        let uploadedPath = "";
        try {
            const { session } = await getAdminSession();
            const formData = new FormData(publishForm);
            const photo = formData.get("photo");
            if (!(photo instanceof File) || photo.size === 0 || photo.size > 8 * 1024 * 1024) {
                throw new Error("Choose a photo no larger than 8 MB.");
            }
            const extensions = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" };
            if (!extensions[photo.type]) throw new Error("Choose a JPG, PNG, WebP, or GIF image.");

            uploadedPath = `events/${crypto.randomUUID()}.${extensions[photo.type]}`;
            const uploadResponse = await supabaseFetch(
                `/storage/v1/object/events/${uploadedPath.split("/").map(encodeURIComponent).join("/")}`,
                {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${session.access_token}`,
                        "Content-Type": photo.type,
                        "x-upsert": "false"
                    },
                    body: photo
                }
            );
            if (!uploadResponse.ok) throw new Error("Couldn't upload the activity photo.");

            const response = await supabaseFetch("/rest/v1/events", {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${session.access_token}`,
                    "Content-Type": "application/json",
                    Prefer: "return=representation"
                },
                body: JSON.stringify({
                    title: formData.get("title").trim(),
                    description: formData.get("description").trim(),
                    location: formData.get("location").trim() || null,
                    activity_date: formData.get("activity_date"),
                    image_url: uploadedPath
                })
            });
            const [created] = await response.json();
            events = [created, ...events.filter((event) => !event.featured)];
            await loadTimeline();
            publishForm.reset();
            publishForm.hidden = true;
            publishToggle.setAttribute("aria-expanded", "false");
            publishStatus.textContent = "Activity published.";
            publishStatus.classList.add("success");
            pageStatus.textContent = "";
        } catch (error) {
            publishStatus.textContent = error.message || "Couldn't publish this activity. Please try again.";
            publishStatus.classList.add("error");
            console.error("Activity publishing failed:", error);
            if (uploadedPath) {
                try {
                    const { session } = await getAdminSession();
                    await supabaseFetch(`/storage/v1/object/events/${uploadedPath.split("/").map(encodeURIComponent).join("/")}`, {
                        method: "DELETE",
                        headers: { Authorization: `Bearer ${session.access_token}` }
                    });
                } catch (cleanupError) {
                    console.error("Unable to remove the unused event photo:", cleanupError);
                }
            }
        } finally {
            submit.disabled = false;
        }
    });

    setupAdminPublishing();
    loadTimeline();
})();
