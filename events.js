(() => {
    const EVENTS_BUCKET = `${SUPABASE_PROJECT_URL}/storage/v1/object/public/events`;
    const FEATURED_IMAGE = "Photos/prom_team.png";
    const timeline = document.getElementById("timeline");
    const pageStatus = document.getElementById("pageStatus");
    const mobileMenuButton = document.getElementById("mobileMenuBtn");
    const navMenu = document.getElementById("navMenu");

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

    function makeEventCard(event, comments) {
        const article = makeElement("article", "event-card");
        article.id = `event-${event.id}`;

        const header = makeElement("header", "post-header");
        header.append(makeElement("span", "post-avatar", "GM"));
        const author = makeElement("div", "post-author");
        author.append(makeElement("strong", "", "Gunupur Matters"));
        author.append(makeElement("span", "", "Community update"));
        header.append(author);
        if (event.location) header.append(makeElement("span", "post-location", event.location));
        article.append(header);

        const image = makeElement("img", "event-photo");
        image.src = imageUrl(event);
        image.alt = String(event.title || "Gunupur Matters community activity");
        image.loading = "lazy";
        article.append(image);

        const content = makeElement("div", "event-content");
        const meta = makeElement("div", "event-meta");
        meta.append(makeElement("span", "", formatDate(event.activity_date) || "Community activity"));
        content.append(meta);
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
        commentSection.append(makeCommentForm(event));
        content.append(commentSection);
        article.append(content);
        return article;
    }

    async function loadTimeline() {
        try {
            const events = await fetchRows(
                "/rest/v1/events",
                "select=id,title,description,location,activity_date,image_url,created_at&order=activity_date.desc,created_at.desc&limit=40"
            );
            if (events.length === 0) {
                timeline.replaceChildren();
                pageStatus.textContent = "";
                return;
            }

            const ids = events.map((event) => encodeURIComponent(event.id)).join(",");
            const comments = await fetchRows(
                "/rest/v1/event_comments",
                `select=id,event_id,author_name,comment_text,created_at&event_id=in.(${ids})&order=created_at.asc`
            );
            const commentsByEvent = new Map();
            comments.forEach((comment) => {
                if (!commentsByEvent.has(comment.event_id)) commentsByEvent.set(comment.event_id, []);
                commentsByEvent.get(comment.event_id).push(comment);
            });
            timeline.replaceChildren(...events.map((event) => makeEventCard(
                event,
                commentsByEvent.get(event.id) || []
            )));
            pageStatus.textContent = "";
        } catch (error) {
            timeline.replaceChildren();
            pageStatus.textContent = "The community updates couldn't load right now. Please try again later.";
            console.error("Unable to load the community events feed:", error);
        }
    }

    loadTimeline();
})();
