<?php
session_start();
require_once __DIR__ . "/config/database.php";

$stmt = $pdo->query(
    "SELECT * FROM community_posts WHERE status = 'approved' ORDER BY approved_at DESC, created_at DESC"
);
$posts = $stmt->fetchAll();
?>

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Community Feed | Gunupur Matters</title>
    <meta name="description" content="Share community issues with a photo and location for admin review.">
    <link rel="stylesheet" href="community.css">
</head>
<body>
    <header class="site-header">
        <div class="container navbar">
            <a href="index.html" class="brand" aria-label="Gunupur Matters home">
                <span class="brand-mark">✓</span>
                <span class="brand-text">
                    <strong>Gunupur</strong>
                    <span>Matters</span>
                </span>
            </a>

            <nav class="top-links" aria-label="Main navigation">
                <a href="index.html">Home</a>
                <a href="report.html">Report</a>
                <a href="track.html">Track</a>
                <a href="about.html">About</a>
            </nav>
        </div>
    </header>

    <main class="main-wrap">
        <div class="container community-shell">
            <section class="card form-card">
                <h1>Share a local issue</h1>
                <p class="subtitle">Post a photo, add the location, and write a short caption. Your post will remain hidden until an admin approves it.</p>

                <?php if (isset($_GET["success"])): ?>
                    <div class="notice success">Your post was submitted successfully. It is now waiting for admin approval.</div>
                <?php elseif (isset($_GET["error"])): ?>
                    <div class="notice error">Please complete all fields and upload a valid image before posting.</div>
                <?php endif; ?>

                <form action="config/community-submit.php" method="post" enctype="multipart/form-data">
                    <div class="form-group">
                        <label for="caption">Caption</label>
                        <textarea id="caption" name="caption" class="form-control" placeholder="Example: Broken streetlight near the school gate..." required></textarea>
                    </div>

                    <div class="form-group">
                        <label for="location">Location</label>
                        <input id="location" type="text" name="location" class="form-control" placeholder="Example: Ward 12, Main Market Road" required>
                    </div>

                    <div class="form-group">
                        <label for="photo">Upload photo</label>
                        <input id="photo" type="file" name="photo" class="form-control file-input" accept="image/*" required>
                    </div>

                    <button type="submit" class="primary-btn">Post for review</button>
                </form>
            </section>

            <section class="feed">
                <div class="feed-header">
                    <h2>Community feed</h2>
                    <span class="feed-badge">Approved posts</span>
                </div>

                <?php if (empty($posts)): ?>
                    <div class="empty-state">No approved posts yet. Be the first one to post an issue.</div>
                <?php else: ?>
                    <?php foreach ($posts as $post): ?>
                        <article class="post-card">
                            <?php if (!empty($post["photo_path"])): ?>
                                <img class="post-image" src="<?php echo htmlspecialchars($post["photo_path"]); ?>" alt="Community issue photo">
                            <?php endif; ?>

                            <div class="post-body">
                                <div class="post-top">
                                    <span class="post-author">Community update</span>
                                    <span class="status-pill">Verified</span>
                                </div>

                                <p><?php echo nl2br(htmlspecialchars($post["caption"])); ?></p>
                                <div class="post-location">
                                    <strong>Location:</strong> <?php echo htmlspecialchars($post["location"]); ?>
                                </div>
                            </div>
                        </article>
                    <?php endforeach; ?>
                <?php endif; ?>
            </section>
        </div>
    </main>
</body>
</html>
