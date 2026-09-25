<?php
session_start();

$adminAllowed = (
    (isset($_SESSION["admin_logged_in"]) && $_SESSION["admin_logged_in"] === true) ||
    (isset($_SESSION["user"]) && ($_SESSION["user"]["role"] ?? "") === "admin")
);

if (!$adminAllowed) {
    header("Location: ../admin.php");
    exit;
}

require_once __DIR__ . "/database.php";

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
    header("Location: ../dashboard.php?error=1");
    exit;
}

$postId = (int) ($_POST["post_id"] ?? 0);
$action = $_POST["action"] ?? "approve";

if ($postId <= 0 || !in_array($action, ["approve", "reject"], true)) {
    header("Location: ../dashboard.php?error=1");
    exit;
}

$status = $action === "approve" ? "approved" : "rejected";
$approvedAt = $action === "approve" ? date("Y-m-d H:i:s") : null;

$stmt = $pdo->prepare(
    "UPDATE community_posts
     SET status = :status, approved_at = :approved_at
     WHERE id = :id"
);

$stmt->execute([
    ":status" => $status,
    ":approved_at" => $approvedAt,
    ":id" => $postId,
]);

header("Location: ../dashboard.php?status=" . $status);
exit;
