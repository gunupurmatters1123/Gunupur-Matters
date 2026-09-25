<?php
session_start();

require_once __DIR__ . "/database.php";

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
    header("Location: ../community.php?error=1");
    exit;
}

$caption = trim($_POST["caption"] ?? "");
$location = trim($_POST["location"] ?? "");

if ($caption === "" || $location === "") {
    header("Location: ../community.php?error=1");
    exit;
}

$photo = $_FILES["photo"] ?? null;

if (!is_array($photo) || !isset($photo["tmp_name"]) || $photo["tmp_name"] === "") {
    header("Location: ../community.php?error=1");
    exit;
}

if (($photo["error"] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
    header("Location: ../community.php?error=1");
    exit;
}

$allowedMimeTypes = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif"
];

$finfo = finfo_open(FILEINFO_MIME_TYPE);
$mimeType = finfo_file($finfo, $photo["tmp_name"]);
finfo_close($finfo);

if (!in_array($mimeType, $allowedMimeTypes, true)) {
    header("Location: ../community.php?error=1");
    exit;
}

$uploadDir = __DIR__ . "/../uploads/community/";
if (!is_dir($uploadDir)) {
    mkdir($uploadDir, 0755, true);
}

$extension = strtolower(pathinfo($photo["name"], PATHINFO_EXTENSION));
if ($extension === "") {
    $extension = "jpg";
}

$fileName = "community-" . time() . "-" . bin2hex(random_bytes(4)) . "." . $extension;
$destination = $uploadDir . $fileName;

if (!move_uploaded_file($photo["tmp_name"], $destination)) {
    header("Location: ../community.php?error=1");
    exit;
}

$photoPath = "uploads/community/" . $fileName;

$stmt = $pdo->prepare(
    "INSERT INTO community_posts (caption, location, photo_name, photo_path, status, created_at)
     VALUES (:caption, :location, :photo_name, :photo_path, 'pending', NOW())"
);

$stmt->execute([
    ":caption" => $caption,
    ":location" => $location,
    ":photo_name" => $photo["name"],
    ":photo_path" => $photoPath,
]);

header("Location: ../community.php?success=1");
exit;
