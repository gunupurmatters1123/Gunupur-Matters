(() => {
    const EVENTS_BUCKET = `${SUPABASE_PROJECT_URL}/storage/v1/object/public/events`;
    const FEATURED_IMAGE = "Photos/prom_team.png";
    const timeline = document.getElementById("timeline");
    const pageStatus = document.getElementById("pageStatus");
    const navbar = document.getElementById("navbar");
    const mobileMenuButton = document.getElementById("mobileMenuBtn");
    const navMenu = document.getElementById("navMenu");

    window.addEventListener("scroll", () => {
        navbar.classList.toggle("scrolled", window.scrollY > 20);
    }, { passive: true });

    mobileMenuButton.addEventListener("click", () => {
        const isOpen = navMenu.classList.toggle("active");
        mobileMenuButton.setAttribute("aria-expanded", String(isOpen));
        mobileMenuButton.setAttribute("aria-label", isOpen ? "Close navigation menu" : "Open navigation menu");
        mobileMenuButton.querySelector("i").className = isOpen
            ? "fa-solid fa-xmark"
            : "fa-solid fa-bars";
    });

    navMenu.addEventListener("click", (event) => {
        if (event.target.closest("a")) {
            navMenu.classList.remove("active");
            mobileMenuButton.setAttribute("aria-expanded", "false");
            mobileMenuButton.setAttribute("aria-label", "Open navigation menu");
            mobileMenuButton.querySelector("i").className = "fa-solid fa-bars";
        }
    });

    async function fetchRows(resource, query) {
        const response = await supabaseFetch(`${resource}?${query}`, {
            headers: { Accept: "application/json" }
        });
        return response.json();
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
        if (event.image_url === FEATURED_IMAGE) return event.image_url;
        if (/^https:\/\//i.test(event.image_url || "")) return event.image_url;
        return `${EVENTS_BUCKET}/${String(event.image_url || "").split("/").map(encodeURIComponent).join("/")}`;
    }

    function mediaAspectRatio(event) {
        return {
            portrait: "4 / 5",
            square: "1 / 1",
            landscape: "1.91 / 1"
        }[event.media_aspect_ratio] || "4 / 3";
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
        const nameLabel = makeElement("label", "", "Your name");
        const nameInput = document.createElement("input");
        nameInput.name = "author_name";
        nameInput.type = "text";
        nameInput.maxLength = 80;
        nameInput.autocomplete = "name";
        nameInput.placeholder = "Enter your name";
        nameInput.minLength = 2;
        nameInput.required = true;
        nameInput.setAttribute("aria-label", "Your name, required to comment");
        nameInput.addEventListener("input", () => nameInput.setCustomValidity(""));
        nameLabel.append(nameInput);

        const textLabel = makeElement("label", "", "Your perspective");
        const textInput = document.createElement("textarea");
        textInput.name = "comment_text";
        textInput.placeholder = "Add a comment...";
        textInput.maxLength = 1000;
        textInput.rows = 3;
        textInput.required = true;
        textInput.setAttribute("aria-label", "Comment");
        textLabel.append(textInput);

        const status = makeElement("p", "comment-status");
        status.setAttribute("role", "status");
        const submit = makeElement("button", "secondary-button", "Post comment");
        submit.type = "submit";
        form.append(nameLabel, textLabel, submit, status);

        form.addEventListener("submit", async (submitEvent) => {
            submitEvent.preventDefault();
            status.textContent = "";
            status.className = "comment-status";
            submit.disabled = true;
            try {
                const authorName = nameInput.value.trim().replace(/\s+/g, " ");
                if (!/^[\p{L}\p{M}][\p{L}\p{M} .'-]{1,79}$/u.test(authorName)) {
                    nameInput.setCustomValidity("Enter a valid name using at least two letters.");
                    nameInput.reportValidity();
                    status.textContent = "Enter a valid name before posting your comment.";
                    status.classList.add("error");
                    return;
                }
                const commentText = textInput.value.trim();
                if (!commentText || commentText.length > 1000) {
                    status.textContent = "Enter a comment of up to 1,000 characters.";
                    status.classList.add("error");
                    textInput.focus();
                    return;
                }
                const response = await supabaseFetch("/rest/v1/event_comments", {
                    method: "POST",
                    headers: { "Content-Type": "application/json", Prefer: "return=representation" },
                    body: JSON.stringify({
                        event_id: event.id,
                        author_name: authorName,
                        comment_text: commentText
                    })
                });
                const [comment] = await response.json();
                const card = form.closest(".event-card");
                const list = card.querySelector(".comment-list");
                const empty = card.querySelector(".no-comments");
                if (empty) empty.remove();
                list.append(makeComment(comment));
                const count = card.querySelector(".comment-count");
                count.textContent = String(Number(count.textContent) + 1);
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

    function makeEventCard(event, comments, isAdmin) {
        const article = makeElement("article", "event-card");
        article.id = `event-${event.id}`;

        const header = makeElement("header", "post-header");
        header.append(makeElement("span", "post-avatar", "GM"));
        const author = makeElement("div", "post-author");
        author.append(makeElement("strong", "", "Gunupur Matters"));
        if (event.location) author.append(makeElement("span", "post-location", event.location));
        author.append(makeElement("span", "post-subtitle", "Community update"));
        header.append(author);
        article.append(header);

        if (isAdmin) {
            const adminControls = makeElement("div", "event-admin-controls");
            const archiveButton = makeElement("button", "event-admin-button", "Archive post");
            archiveButton.type = "button";
            archiveButton.addEventListener("click", async () => {
                if (!window.confirm("Archive this post? It will be hidden from the community feed.")) return;
                archiveButton.disabled = true;
                try {
                    const { session } = await getAdminSession();
                    await supabaseFetch(`/rest/v1/events?id=eq.${encodeURIComponent(event.id)}`, {
                        method: "PATCH",
                        headers: {
                            Authorization: `Bearer ${session.access_token}`,
                            "Content-Type": "application/json",
                            Prefer: "return=minimal"
                        },
                        body: JSON.stringify({ archived_at: new Date().toISOString() })
                    });
                    article.remove();
                    pageStatus.textContent = "The post has been archived.";
                } catch (error) {
                    pageStatus.textContent = "The post couldn't be archived. Please try again.";
                    archiveButton.disabled = false;
                    console.error("Unable to archive the event post:", error);
                }
            });
            const editButton = makeElement("button", "event-admin-button", "Edit post");
            editButton.type = "button";
            editButton.addEventListener("click", () => {
                window.location.href = `adupload.html?edit=${encodeURIComponent(event.id)}`;
            });

            const deleteButton = makeElement("button", "event-admin-button danger", "Delete");
            deleteButton.type = "button";
            deleteButton.addEventListener("click", async () => {
                if (!window.confirm("Move this post to Trash? An admin can restore it later.")) return;
                deleteButton.disabled = true;
                try {
                    const { session } = await getAdminSession();
                    const response = await supabaseFetch(
                        `/rest/v1/events?id=eq.${encodeURIComponent(event.id)}&archived_at=is.null&deleted_at=is.null`,
                        {
                            method: "PATCH",
                            headers: {
                                Authorization: `Bearer ${session.access_token}`,
                                "Content-Type": "application/json",
                                Prefer: "return=representation"
                            },
                            body: JSON.stringify({
                                archived_at: null,
                                deleted_at: new Date().toISOString()
                            })
                        }
                    );
                    if (!(await response.json()).length) throw new Error("The post was not found or was already changed.");
                    article.remove();
                    pageStatus.textContent = "The post was moved to Trash. Restore it from the admin upload page.";
                } catch (error) {
                    pageStatus.textContent = error.message || "The post couldn't be moved to Trash.";
                    deleteButton.disabled = false;
                    console.error("Unable to move the event post to Trash:", error);
                }
            });
            adminControls.append(editButton, archiveButton, deleteButton);
            article.append(adminControls);
        }

        const mediaFrame = makeElement("div", "event-media");
        mediaFrame.style.aspectRatio = mediaAspectRatio(event);
        const source = imageUrl(event);
        if (/\.(mp4|mov|webm)(?:$|[?#])/i.test(String(event.image_url || ""))) {
            const video = makeElement("video", "event-video");
            video.src = source;
            video.controls = true;
            video.playsInline = true;
            video.preload = "metadata";
            article.append(mediaFrame);
            mediaFrame.append(video);
        } else {
            const image = makeElement("img", "event-photo");
            image.src = source;
            image.alt = String(event.title || "Gunupur Matters community activity");
            image.loading = "lazy";
            mediaFrame.append(image);
            article.append(mediaFrame);
        }

        const content = makeElement("div", "event-content");
        const meta = makeElement("div", "event-meta");
        meta.append(makeElement("span", "", formatDate(event.activity_date) || "Community activity"));
        content.append(meta);
        const caption = makeElement("p", "event-description", event.description);
        const captionToggle = makeElement("button", "caption-toggle", "See more");
        captionToggle.type = "button";
        captionToggle.hidden = true;
        captionToggle.setAttribute("aria-expanded", "false");
        captionToggle.addEventListener("click", () => {
            const expanded = caption.classList.toggle("expanded");
            captionToggle.textContent = expanded ? "See less" : "See more";
            captionToggle.setAttribute("aria-expanded", String(expanded));
        });
        content.append(caption, captionToggle);
        requestAnimationFrame(() => {
            captionToggle.hidden = caption.scrollHeight <= caption.clientHeight + 1;
        });

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
        commentSection.append(makeCommentForm(event));
        content.append(commentSection);
        article.append(content);
        return article;
    }

    async function loadTimeline() {
        try {
            let isAdmin = false;
            if (localStorage.getItem(SUPABASE_ADMIN_SESSION_KEY)) {
                try {
                    await getAdminSession();
                    isAdmin = true;
                } catch (error) {
                    console.error("Unable to verify event archive controls:", error);
                }
            }
            const events = await fetchRows(
                "/rest/v1/events",
                "select=id,title,description,location,activity_date,image_url,media_aspect_ratio,created_at&order=activity_date.desc,created_at.desc&limit=40"
            );
            if (events.length === 0) {
                timeline.replaceChildren();
                pageStatus.textContent = "";
                return;
            }

            timeline.replaceChildren(...events.map((event) => makeEventCard(event, [], isAdmin)));

            const ids = events.map((event) => encodeURIComponent(event.id)).join(",");
            let comments = [];
            let commentsAvailable = true;
            try {
                comments = await fetchRows(
                    "/rest/v1/event_comments",
                    `select=id,event_id,author_name,comment_text,created_at&event_id=in.(${ids})&order=created_at.asc`
                );
            } catch (error) {
                commentsAvailable = false;
                pageStatus.textContent = "Community updates are shown, but comments couldn't load right now.";
                console.error("Unable to load comments for the community events feed:", error);
            }
            const commentsByEvent = new Map();
            comments.forEach((comment) => {
                if (!commentsByEvent.has(comment.event_id)) commentsByEvent.set(comment.event_id, []);
                commentsByEvent.get(comment.event_id).push(comment);
            });
            events.forEach((event) => {
                const card = document.getElementById(`event-${event.id}`);
                if (!card) return;
                const eventComments = commentsByEvent.get(event.id) || [];
                const commentList = card.querySelector(".comment-list");
                commentList.replaceChildren(...eventComments.map(makeComment));
                const emptyMessage = card.querySelector(".no-comments");
                if (eventComments.length && emptyMessage) emptyMessage.remove();
                const count = card.querySelector(".comment-count");
                count.textContent = String(eventComments.length);
                count.setAttribute("aria-label", `${eventComments.length} comments`);
            });
            if (commentsAvailable) pageStatus.textContent = "";
        } catch (error) {
            timeline.replaceChildren();
            pageStatus.textContent = "The community updates couldn't load right now. Please try again later.";
            console.error("Unable to load the community events feed:", error);
        }
    }

    loadTimeline();
})();
