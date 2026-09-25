<?php
session_start();

$defaultAdminUser = "admin";
$defaultAdminPass = "admin123";

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
    header("Location: adlog.html");
    exit;
}

$username = trim($_POST["username"] ?? "");
$password = $_POST["password"] ?? "";

$validLogin = (
    $username === $defaultAdminUser &&
    $password === $defaultAdminPass
);

if ($validLogin) {
    $_SESSION["user"] = [
        "id" => 1,
        "username" => $username,
        "name" => "Gunupur Matters Admin",
        "role" => "admin"
    ];

    $_SESSION["login_time"] = time();

    header("Location: admin.php");
    exit;
}

$_SESSION["login_error"] = "Invalid username or password.";
header("Location: adlog.html?error=1");
exit;
