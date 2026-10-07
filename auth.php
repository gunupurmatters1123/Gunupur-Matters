<?php
session_start();
require_once __DIR__ . "/config/database.php";

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
    header("Location: adlog.html");
    exit;
}

$username = trim($_POST["username"] ?? "");
$password = $_POST["password"] ?? "";

$stmt = $pdo->prepare("SELECT * FROM admin_users WHERE username = :username LIMIT 1");
$stmt->execute([":username" => $username]);
$user = $stmt->fetch();

$validLogin = $user !== false && password_verify($password, $user["password_hash"] ?? "");

if ($validLogin) {
    $_SESSION["user"] = [
        "id" => (int)($user["id"] ?? 1),
        "username" => $user["username"],
        "name" => $user["name"] ?? "Gunupur Matters Admin",
        "role" => $user["role"] ?? "admin"
    ];

    $_SESSION["admin_logged_in"] = true;
    $_SESSION["login_time"] = time();

    header("Location: admin.php");
    exit;
}

$_SESSION["login_error"] = "Invalid username or password.";
header("Location: adlog.html?error=1");
exit;
