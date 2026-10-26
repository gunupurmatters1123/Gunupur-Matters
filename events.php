<?php
session_start();
require_once __DIR__ . "/config/database.php";

if (!isset($_SESSION["events_csrf_token"]) || !is_string($_SESSION["events_csrf_token"])) {
    $_SESSION["events_csrf_token"] = bin2hex(random_bytes(32));
}
$csrfToken = $_SESSION["events_csrf_token"];
$isAdmin = isset($_SESSION["user"]) && ($_SESSION["user"]["role"] ?? "") === "admin";

$events = $pdo->query(
    "SELECT id, title, description, location, activity_date, photo_path, created_at
     FROM events
     ORDER BY activity_date DESC, created_at DESC
     LIMIT 50"
)->fetchAll();

$commentsByEvent = [];
if ($events !== []) {
    $eventIds = array_column($events, "id");
    $placeholders = implode(",", array_fill(0, count($eventIds), "?"));
    $commentsStatement = $pdo->prepare(
        "SELECT event_id, author_name, comment_text, created_at
         FROM event_comments
         WHERE event_id IN ($placeholders)
         ORDER BY created_at ASC"
    );
    $commentsStatement->execute($eventIds);
    foreach ($commentsStatement->fetchAll() as $comment) {
        $commentsByEvent[$comment["event_id"]][] = $comment;
    }
}

function escapeEventText(string $value): string
{
    return htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, "UTF-8");
}

function formatEventDate(string $value): string
{
    $timestamp = strtotime($value);
    return $timestamp === false ? $value : date("F j, Y", $timestamp);
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="description" content="See Gunupur Matters activities, photos, and community perspectives.">
    <title>Events & Activities | Gunupur Matters</title>
    <link rel="stylesheet" href="events.css">
</head>
<body>
    <header class="site-header">
        <div class="container navbar">
            <a href="index.html" class="brand" aria-label="Gunupur Matters home">
                <span class="brand-mark">✓</span>
                <span class="brand-text"><strong>Gunupur</strong><span>Matters</span></span>
            </a>
            <nav class="top-links" aria-label="Main navigation">
                <a href="index.html">Home</a>
                <a href="report.html">Report</a>
                <a href="track.html">Track</a>
                <a href="about.html">About</a>
            </nav>
        </div>
    </header>

    <main class="container page-content">
        <section class="intro">
            <span class="eyebrow">Our work, together</span>
            <h1>Events & activities</h1>
            <p>Follow the work happening around Gunupur, explore photos from our activities, and share your perspective.</p>
        </section>

        <?php if (isset($_GET["event"]) && $_GET["event"] === "posted"): ?>
            <p class="notice success" role="status">Your activity has been published.</p>
        <?php elseif (isset($_GET["comment"]) && $_GET["comment"] === "posted"): ?>
            <p class="notice success" role="status">Your comment has been added.</p>
        <?php elseif (isset($_GET["error"])): ?>
            <p class="notice error" role="alert">We couldn't submit that. Please check the form and try again.</p>
        <?php endif; ?>

        <?php if ($isAdmin): ?>
            <details class="publish-panel">
                <summary>Share a new activity</summary>
                <form action="config/event-submit.php" method="post" enctype="multipart/form-data" class="publish-form">
                    <input type="hidden" name="csrf_token" value="<?php echo escapeEventText($csrfToken); ?>">
                    <label>
                        Activity title
                        <input type="text" name="title" maxlength="180" required>
                    </label>
                    <label>
                        What happened?
                        <textarea name="description" maxlength="5000" rows="4" required></textarea>
                    </label>
                    <div class="form-row">
                        <label>
                            Date
                            <input type="date" name="activity_date" required>
                        </label>
                        <label>
                            Location <span class="optional">(optional)</span>
                            <input type="text" name="location" maxlength="180">
                        </label>
                    </div>
                    <label>
                        Activity photo
                        <input type="file" name="photo" accept="image/jpeg,image/png,image/webp,image/gif" required>
                        <small>JPG, PNG, WebP, or GIF. Maximum 8 MB.</small>
                    </label>
                    <button type="submit" class="primary-button">Publish activity</button>
                </form>
            </details>
        <?php else: ?>
            <p class="admin-hint"><a href="adlog.html">Admin sign-in</a> to publish an activity.</p>
        <?php endif; ?>

        <section class="timeline" aria-label="Recent activities">
            <?php if ($events === []): ?>
                <div class="empty-state">
                    <h2>Activities are on the way</h2>
                    <p>When we share an update, it will appear here with photos and space for your thoughts.</p>
                </div>
            <?php else: ?>
                <?php foreach ($events as $event): ?>
                    <article class="event-card" id="event-<?php echo (int) $event["id"]; ?>">
                        <img class="event-photo" src="<?php echo escapeEventText($event["photo_path"]); ?>" alt="<?php echo escapeEventText($event["title"]); ?>" loading="lazy">
                        <div class="event-content">
                            <div class="event-meta">
                                <time datetime="<?php echo escapeEventText($event["activity_date"]); ?>"><?php echo escapeEventText(formatEventDate($event["activity_date"])); ?></time>
                                <?php if (!empty($event["location"])): ?>
                                    <span><?php echo escapeEventText($event["location"]); ?></span>
                                <?php endif; ?>
                            </div>
                            <h2><?php echo escapeEventText($event["title"]); ?></h2>
                            <p class="event-description"><?php echo nl2br(escapeEventText($event["description"])); ?></p>

                            <section class="comments" aria-label="Comments on <?php echo escapeEventText($event["title"]); ?>">
                                <h3>Community perspectives <span><?php echo count($commentsByEvent[$event["id"]] ?? []); ?></span></h3>
                                <?php if (!empty($commentsByEvent[$event["id"]])): ?>
                                    <ul class="comment-list">
                                        <?php foreach ($commentsByEvent[$event["id"]] as $comment): ?>
                                            <li class="comment">
                                                <strong><?php echo escapeEventText($comment["author_name"]); ?></strong>
                                                <p><?php echo nl2br(escapeEventText($comment["comment_text"])); ?></p>
                                                <time datetime="<?php echo escapeEventText(date("c", strtotime($comment["created_at"]))); ?>"><?php echo escapeEventText(date("M j, Y - g:i a", strtotime($comment["created_at"]))); ?></time>
                                            </li>
                                        <?php endforeach; ?>
                                    </ul>
                                <?php else: ?>
                                    <p class="no-comments">No comments yet. Be the first to share your perspective.</p>
                                <?php endif; ?>

                                <form action="config/event-comment-submit.php" method="post" class="comment-form">
                                    <input type="hidden" name="csrf_token" value="<?php echo escapeEventText($csrfToken); ?>">
                                    <input type="hidden" name="event_id" value="<?php echo (int) $event["id"]; ?>">
                                    <label>
                                        Your name
                                        <input type="text" name="author_name" maxlength="80" autocomplete="name" required>
                                    </label>
                                    <label>
                                        Your perspective
                                        <textarea name="comment_text" maxlength="1000" rows="3" required></textarea>
                                    </label>
                                    <button type="submit" class="secondary-button">Add comment</button>
                                </form>
                            </section>
                        </div>
                    </article>
                <?php endforeach; ?>
            <?php endif; ?>
        </section>
    </main>
</body>
</html>
