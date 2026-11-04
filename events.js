(() => {
    const EVENTS_BUCKET = `${SUPABASE_PROJECT_URL}/storage/v1/object/public/events`;
    const FEATURED_IMAGE = "Photos/prom_team.png";
    const timeline = document.getElementById("timeline");
    const pageStatus = document.getElementById("pageStatus");
    const navbar = document.getElementById("navbar");
    const mobileMenuButton = document.getElementById("mobileMenuBtn");
    const navMenu = document.getElementById("navMenu");
    const eventCommentStates = new WeakMap();

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

    async function fetchRows(resource, query, accessToken) {
        const response = await supabaseFetch(`${resource}?${query}`, {
            headers: {
                Accept: "application/json",
                ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {})
            }
        });
        if (!response.ok) throw new Error(`Request failed (HTTP ${response.status}).`);
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

    function eventMediaPaths(event) {
        return Array.isArray(event.media_urls) && event.media_urls.length
            ? event.media_urls
            : event.image_url ? [event.image_url] : [];
    }

    function makeEventMedia(event) {
        const mediaPaths = eventMediaPaths(event);
        const frame = makeElement("div", "event-media");
        frame.style.aspectRatio = mediaAspectRatio(event);

        if (mediaPaths.length > 1) {
            const track = makeElement("div", "event-media-track");
            const slides = mediaPaths.map((path, index) => {
                const slide = makeElement("div", "event-media-slide");
                const image = makeElement("img", "event-photo");
                image.src = path === FEATURED_IMAGE || /^https:\/\//i.test(path)
                    ? path
                    : `${EVENTS_BUCKET}/${path.split("/").map(encodeURIComponent).join("/")}`;
                image.alt = `Photo ${index + 1} of ${mediaPaths.length} from ${event.title || "Gunupur Matters community activity"}`;
                image.loading = index === 0 ? "eager" : "lazy";
                slide.append(image);
                track.append(slide);
                return slide;
            });
            const controls = makeElement("div", "event-carousel-controls");
            const previous = makeElement("button", "event-carousel-arrow previous", "Previous photo");
            previous.type = "button";
            previous.setAttribute("aria-label", "Previous photo");
            previous.textContent = "‹";
            const next = makeElement("button", "event-carousel-arrow next", "Next photo");
            next.type = "button";
            next.setAttribute("aria-label", "Next photo");
            next.textContent = "›";
            const count = makeElement("span", "event-carousel-count");
            count.setAttribute("aria-live", "polite");
            const pagination = makeElement("div", "event-carousel-pagination");
            let current = 0;

            const updateControls = () => {
                count.textContent = `${current + 1} / ${slides.length}`;
                previous.disabled = current === 0;
                next.disabled = current === slides.length - 1;
                pagination.querySelectorAll("button").forEach((dot, dotIndex) => {
                    dot.classList.toggle("active", dotIndex === current);
                    dot.setAttribute("aria-current", dotIndex === current ? "true" : "false");
                });
            };
            const goTo = (index) => {
                current = Math.max(0, Math.min(slides.length - 1, index));
                track.scrollLeft = track.clientWidth * current;
                updateControls();
            };

            slides.forEach((_, index) => {
                const dot = makeElement("button", "event-carousel-dot");
                dot.type = "button";
                dot.setAttribute("aria-label", `Show photo ${index + 1}`);
                dot.addEventListener("click", () => goTo(index));
                pagination.append(dot);
            });
            previous.addEventListener("click", () => goTo(current - 1));
            next.addEventListener("click", () => goTo(current + 1));
            track.addEventListener("scroll", () => {
                const nearest = track.clientWidth
                    ? Math.round(track.scrollLeft / track.clientWidth)
                    : 0;
                if (nearest !== current) {
                    current = nearest;
                    updateControls();
                }
            }, { passive: true });
            controls.append(previous, count, next);
            frame.append(track, controls, pagination);
            goTo(0);
            return frame;
        }

        const path = mediaPaths[0];
        if (path && /\.(mp4|mov|webm)(?:$|[?#])/i.test(path)) {
            const video = makeElement("video", "event-video");
            video.src = path === FEATURED_IMAGE || /^https:\/\//i.test(path)
                ? path
                : `${EVENTS_BUCKET}/${path.split("/").map(encodeURIComponent).join("/")}`;
            video.controls = true;
            video.playsInline = true;
            video.preload = "metadata";
            frame.append(video);
        } else if (path) {
            const image = makeElement("img", "event-photo");
            image.src = path === FEATURED_IMAGE || /^https:\/\//i.test(path)
                ? path
                : `${EVENTS_BUCKET}/${path.split("/").map(encodeURIComponent).join("/")}`;
            image.alt = String(event.title || "Gunupur Matters community activity");
            image.loading = "lazy";
            frame.append(image);
        }
        return frame;
    }

    function mediaAspectRatio(event) {
        return {
            portrait: "4 / 5",
            square: "1 / 1",
            landscape: "1.91 / 1"
        }[event.media_aspect_ratio] || "4 / 3";
    }

    const COMMENTS_PER_PAGE = 5;

    function relativeTime(value) {
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return "";
        const seconds = Math.round((date.getTime() - Date.now()) / 1000);
        const units = [
            ["year", 31536000],
            ["month", 2592000],
            ["week", 604800],
            ["day", 86400],
            ["hour", 3600],
            ["minute", 60]
        ];
        const [unit, size] = units.find(([, unitSize]) => Math.abs(seconds) >= unitSize) || ["second", 1];
        return new Intl.RelativeTimeFormat(undefined, { numeric: "auto" })
            .format(Math.round(seconds / size), unit);
    }

    async function sendCommentAction(data) {
        const response = await fetch("/api/event-comments", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data)
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) {
            const error = new Error(result.error || "The request couldn't be completed. Please try again.");
            throw error;
        }
        return result;
    }

    function makeComment(comment, isAdmin, onDelete) {
        const item = makeElement("li", "comment");
        const header = makeElement("div", "comment-header");
        header.append(makeElement("strong", "", comment.author_name));
        const time = makeElement("time", "", relativeTime(comment.created_at));
        time.dateTime = comment.created_at;
        time.title = new Date(comment.created_at).toLocaleString();
        header.append(time);
        if (isAdmin && comment.report_count) {
            header.append(makeElement("span", "comment-reports", `${comment.report_count} reports`));
        }
        item.append(header);
        item.append(makeElement("p", "comment-text", comment.comment_text));

        const actions = makeElement("div", "comment-actions");
        const actionStatus = makeElement("span", "comment-action-status");
        actionStatus.setAttribute("role", "status");
        if (isAdmin && comment.report_count) {
            const removeButton = makeElement("button", "comment-action-button danger", "Remove comment");
            removeButton.type = "button";
            removeButton.addEventListener("click", () => onDelete(comment, removeButton));
            actions.append(removeButton);
        } else if (!isAdmin) {
            const reportButton = makeElement("button", "comment-action-button", "Report");
            reportButton.type = "button";
            reportButton.setAttribute("aria-label", `Report comment by ${comment.author_name}`);
            reportButton.addEventListener("click", async () => {
                reportButton.disabled = true;
                actionStatus.textContent = "";
                try {
                    const result = await sendCommentAction({ action: "report", comment_id: comment.id });
                    reportButton.hidden = true;
                    actionStatus.textContent = result.reported
                        ? "Thanks. The comment was reported for review."
                        : "You've already reported this comment.";
                } catch (error) {
                    actionStatus.textContent = error.message;
                    reportButton.disabled = false;
                }
            });
            actions.append(reportButton);
        }
        if (actions.childElementCount) {
            actions.append(actionStatus);
            item.append(actions);
        }
        return item;
    }

    function makeCommentForm(event, commentState) {
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
        const characterCount = makeElement("span", "comment-character-count", "0 / 1,000");
        characterCount.setAttribute("aria-live", "polite");
        textInput.addEventListener("input", () => {
            characterCount.textContent = `${textInput.value.length.toLocaleString()} / 1,000`;
        });

        const status = makeElement("p", "comment-status");
        status.setAttribute("role", "status");
        const submit = makeElement("button", "secondary-button", "Post comment");
        submit.type = "submit";
        form.append(nameLabel, textLabel, characterCount, submit, status);

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
                const comment = await sendCommentAction({
                    action: "comment",
                    event_id: event.id,
                    author_name: authorName,
                    comment_text: commentText
                });
                commentState.add(comment);
                form.reset();
                characterCount.textContent = "0 / 1,000";
                status.textContent = "Your comment is now visible.";
                status.classList.add("success");
            } catch (error) {
                status.textContent = error.message || "Couldn't add your comment. Please try again.";
                status.classList.add("error");
                console.error("Event comment submission failed:", error);
            } finally {
                submit.disabled = false;
            }
        });
        return form;
    }

    function createCommentState(section, isAdmin, deleteComment) {
        const list = section.querySelector(".comment-list");
        const emptyMessage = section.querySelector(".no-comments");
        const count = section.querySelector(".comment-count");
        const showOlderButton = section.querySelector(".show-older-comments");
        let comments = [];
        let visibleStart = 0;

        function render() {
            const visibleComments = comments.slice(visibleStart);
            list.replaceChildren(...visibleComments.map((comment) =>
                makeComment(comment, isAdmin, deleteComment)
            ));
            count.textContent = String(comments.length);
            count.setAttribute("aria-label", `${comments.length} comments`);
            emptyMessage.hidden = comments.length > 0;
            showOlderButton.hidden = visibleStart === 0;
            if (visibleStart > 0) {
                const olderCount = Math.min(COMMENTS_PER_PAGE, visibleStart);
                showOlderButton.textContent = `Show ${olderCount} older ${olderCount === 1 ? "comment" : "comments"}`;
            }
        }

        showOlderButton.addEventListener("click", () => {
            visibleStart = Math.max(0, visibleStart - COMMENTS_PER_PAGE);
            render();
        });

        return {
            set(nextComments) {
                comments = nextComments;
                visibleStart = Math.max(0, comments.length - COMMENTS_PER_PAGE);
                render();
            },
            add(comment) {
                comments.push(comment);
                visibleStart = Math.max(0, comments.length - COMMENTS_PER_PAGE);
                render();
            },
            remove(commentId) {
                comments = comments.filter((comment) => comment.id !== commentId);
                visibleStart = Math.min(visibleStart, Math.max(0, comments.length - COMMENTS_PER_PAGE));
                render();
            }
        };
    }

    function makeEventCard(event, comments, isAdmin) {
        const article = makeElement("article", "event-card");
        article.id = `event-${event.id}`;

        const header = makeElement("header", "post-header");
        header.append(makeElement("span", "post-avatar", "GM"));
        const author = makeElement("div", "post-author");
        author.append(makeElement("strong", "", "Gunupur Matters"));
        if (event.location) author.append(makeElement("span", "post-location", event.location));
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

        article.append(makeEventMedia(event));

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

        const noComments = makeElement("p", "no-comments", "No comments yet. Be the first to share your perspective.");
        const showOlderButton = makeElement("button", "show-older-comments", "Show older comments");
        showOlderButton.type = "button";
        const commentList = makeElement("ul", "comment-list");
        commentList.setAttribute("aria-label", "Comments");
        commentSection.append(noComments, commentList, showOlderButton);
        let commentState;
        const removeReportedComment = async (comment, button) => {
            if (!window.confirm("Remove this reported comment?")) return;
            button.disabled = true;
            try {
                const { session } = await getAdminSession();
                const response = await supabaseFetch(
                    `/rest/v1/event_comments?id=eq.${encodeURIComponent(comment.id)}`,
                    {
                        method: "DELETE",
                        headers: {
                            Authorization: `Bearer ${session.access_token}`,
                            Prefer: "return=minimal"
                        }
                    }
                );
                if (!response.ok) throw new Error(`Removal failed (HTTP ${response.status}).`);
                commentState.remove(comment.id);
                pageStatus.textContent = "The reported comment was removed.";
            } catch (error) {
                button.disabled = false;
                pageStatus.textContent = "The reported comment couldn't be removed.";
                console.error("Unable to remove a reported event comment:", error);
            }
        };
        commentState = createCommentState(commentSection, isAdmin, removeReportedComment);
        commentState.set(comments);
        eventCommentStates.set(article, commentState);
        commentSection.append(makeCommentForm(event, commentState));
        content.append(commentSection);
        article.append(content);
        return article;
    }

    async function loadTimeline() {
        try {
            let isAdmin = false;
            let adminSession = null;
            if (localStorage.getItem(SUPABASE_ADMIN_SESSION_KEY)) {
                try {
                    ({ session: adminSession } = await getAdminSession());
                    isAdmin = true;
                } catch (error) {
                    console.error("Unable to verify event archive controls:", error);
                }
            }
            let events;
            try {
                events = await fetchRows(
                    "/rest/v1/events",
                    "select=id,title,description,location,activity_date,image_url,media_urls,media_aspect_ratio,created_at&order=activity_date.desc,created_at.desc&limit=40"
                );
            } catch (error) {
                if (!error.message.includes("media_urls") || !error.message.includes("does not exist")) throw error;
                events = await fetchRows(
                    "/rest/v1/events",
                    "select=id,title,description,location,activity_date,image_url,media_aspect_ratio,created_at&order=activity_date.desc,created_at.desc&limit=40"
                );
            }
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
                    `select=id,event_id,author_name,comment_text,created_at&event_id=in.(${ids})&order=created_at.desc&limit=1000`
                );
            } catch (error) {
                commentsAvailable = false;
                pageStatus.textContent = "Community updates are shown, but comments couldn't load right now.";
                console.error("Unable to load comments for the community events feed:", error);
            }
            if (isAdmin && comments.length) {
                try {
                    const reportQueries = [];
                    for (let index = 0; index < comments.length; index += 100) {
                        const commentIds = comments.slice(index, index + 100)
                            .map((comment) => encodeURIComponent(comment.id)).join(",");
                        reportQueries.push(fetchRows(
                            "/rest/v1/event_comment_reports",
                            `select=comment_id&comment_id=in.(${commentIds})`,
                            adminSession.access_token
                        ));
                    }
                    const reports = (await Promise.all(reportQueries)).flat();
                    const reportCounts = new Map();
                    reports.forEach(({ comment_id: commentId }) => {
                        reportCounts.set(commentId, (reportCounts.get(commentId) || 0) + 1);
                    });
                    comments.forEach((comment) => {
                        comment.report_count = reportCounts.get(comment.id) || 0;
                    });
                } catch (error) {
                    commentsAvailable = false;
                    pageStatus.textContent = "Comments are shown, but reported comments couldn't be loaded.";
                    console.error("Unable to load event comment reports:", error);
                }
            }
            comments.sort((first, second) =>
                new Date(first.created_at).getTime() - new Date(second.created_at).getTime()
            );
            const commentsByEvent = new Map();
            comments.forEach((comment) => {
                if (!commentsByEvent.has(comment.event_id)) commentsByEvent.set(comment.event_id, []);
                commentsByEvent.get(comment.event_id).push(comment);
            });
            events.forEach((event) => {
                const card = document.getElementById(`event-${event.id}`);
                if (!card) return;
                const eventComments = commentsByEvent.get(event.id) || [];
                eventCommentStates.get(card).set(eventComments);
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
