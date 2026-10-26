<?php
session_start();

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
    header("Location: ../events.php?error=1");
    exit;
}

$sessionToken = $_SESSION["events_csrf_token"] ?? "";
$submittedToken = $_POST["csrf_token"] ?? "";
if (!is_string($sessionToken) || !is_string($submittedToken) || $sessionToken === "" || !hash_equals($sessionToken, $submittedToken)) {
    header("Location: ../events.php?error=1");
    exit;
}

$eventId = filter_var($_POST["event_id"] ?? null, FILTER_VALIDATE_INT);
$authorNameInput = $_POST["author_name"] ?? "";
$commentTextInput = $_POST["comment_text"] ?? "";
if (!is_string($authorNameInput) || !is_string($commentTextInput)) {
    header("Location: ../events.php?error=1");
    exit;
}

$authorName = trim($authorNameInput);
$commentText = trim($commentTextInput);
$authorNameLength = preg_match_all("/./us", $authorName);
$commentTextLength = preg_match_all("/./us", $commentText);
if (
    $eventId === false || $eventId === null || $eventId < 1
    || $authorName === "" || $authorNameLength === false || $authorNameLength > 80
    || $commentText === "" || $commentTextLength === false || $commentTextLength > 1000
) {
    header("Location: ../events.php?error=1");
    exit;
}

require_once __DIR__ . "/database.php";

try {
    $eventStatement = $pdo->prepare("SELECT id FROM events WHERE id = :id LIMIT 1");
    $eventStatement->execute([":id" => $eventId]);
    if (!$eventStatement->fetch()) {
        header("Location: ../events.php?error=1");
        exit;
    }

    $commentStatement = $pdo->prepare(
        "INSERT INTO event_comments (event_id, author_name, comment_text)
         VALUES (:event_id, :author_name, :comment_text)"
    );
    $commentStatement->execute([
        ":event_id" => $eventId,
        ":author_name" => $authorName,
        ":comment_text" => $commentText,
    ]);
} catch (PDOException $error) {
    error_log("Event comment submission failed: " . $error->getMessage());
    header("Location: ../events.php?error=1");
    exit;
}

header("Location: ../events.php?comment=posted#event-" . $eventId);
exit;
