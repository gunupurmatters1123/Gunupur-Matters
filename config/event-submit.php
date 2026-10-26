<?php
session_start();

$isAdmin = isset($_SESSION["user"]) && ($_SESSION["user"]["role"] ?? "") === "admin";
if (!$isAdmin) {
    header("Location: ../events.php?error=1");
    exit;
}

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

$titleInput = $_POST["title"] ?? "";
$descriptionInput = $_POST["description"] ?? "";
$locationInput = $_POST["location"] ?? "";
$activityDateInput = $_POST["activity_date"] ?? "";
if (
    !is_string($titleInput)
    || !is_string($descriptionInput)
    || !is_string($locationInput)
    || !is_string($activityDateInput)
) {
    header("Location: ../events.php?error=1");
    exit;
}

$title = trim($titleInput);
$description = trim($descriptionInput);
$location = trim($locationInput);
$activityDate = trim($activityDateInput);
$date = DateTimeImmutable::createFromFormat("!Y-m-d", $activityDate);
$dateErrors = DateTimeImmutable::getLastErrors();
$invalidDate = $date === false
    || ($dateErrors !== false && ($dateErrors["warning_count"] > 0 || $dateErrors["error_count"] > 0))
    || $date->format("Y-m-d") !== $activityDate;
$titleLength = preg_match_all("/./us", $title);
$descriptionLength = preg_match_all("/./us", $description);
$locationLength = preg_match_all("/./us", $location);

if (
    $title === "" || $titleLength === false || $titleLength > 180
    || $description === "" || $descriptionLength === false || $descriptionLength > 5000
    || $locationLength === false || $locationLength > 180
    || $invalidDate
) {
    header("Location: ../events.php?error=1");
    exit;
}

$photo = $_FILES["photo"] ?? null;
if (
    !is_array($photo)
    || ($photo["error"] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK
    || !isset($photo["tmp_name"], $photo["size"])
    || !is_string($photo["tmp_name"])
    || !is_int($photo["size"])
    || !is_uploaded_file($photo["tmp_name"])
    || $photo["size"] > 8 * 1024 * 1024
) {
    header("Location: ../events.php?error=1");
    exit;
}

$finfo = finfo_open(FILEINFO_MIME_TYPE);
if ($finfo === false) {
    error_log("Unable to inspect uploaded event photo.");
    header("Location: ../events.php?error=1");
    exit;
}
$mimeType = finfo_file($finfo, $photo["tmp_name"]);
finfo_close($finfo);

$extensionsByMimeType = [
    "image/jpeg" => "jpg",
    "image/png" => "png",
    "image/webp" => "webp",
    "image/gif" => "gif",
];
if (!is_string($mimeType) || !isset($extensionsByMimeType[$mimeType]) || @getimagesize($photo["tmp_name"]) === false) {
    header("Location: ../events.php?error=1");
    exit;
}

require_once __DIR__ . "/database.php";

$uploadDirectory = __DIR__ . "/../uploads/events/";
if (!is_dir($uploadDirectory) && !mkdir($uploadDirectory, 0755, true) && !is_dir($uploadDirectory)) {
    error_log("Unable to create event photo upload directory.");
    header("Location: ../events.php?error=1");
    exit;
}

$fileName = "event-" . bin2hex(random_bytes(16)) . "." . $extensionsByMimeType[$mimeType];
$destination = $uploadDirectory . $fileName;
if (!move_uploaded_file($photo["tmp_name"], $destination)) {
    error_log("Unable to save uploaded event photo.");
    header("Location: ../events.php?error=1");
    exit;
}

$photoPath = "uploads/events/" . $fileName;
try {
    $statement = $pdo->prepare(
        "INSERT INTO events (title, description, location, activity_date, photo_name, photo_path)
         VALUES (:title, :description, :location, :activity_date, :photo_name, :photo_path)"
    );
    $statement->execute([
        ":title" => $title,
        ":description" => $description,
        ":location" => $location !== "" ? $location : null,
        ":activity_date" => $activityDate,
        ":photo_name" => $fileName,
        ":photo_path" => $photoPath,
    ]);
} catch (PDOException $error) {
    unlink($destination);
    error_log("Event publish failed: " . $error->getMessage());
    header("Location: ../events.php?error=1");
    exit;
}

header("Location: ../events.php?event=posted");
exit;
