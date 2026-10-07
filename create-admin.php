<?php
require_once __DIR__ . "/config/database.php";

header("Content-Type: application/json");

$username = trim($_POST["username"] ?? "admin");
$password = $_POST["password"] ?? "admin123";
$name = trim($_POST["name"] ?? "Gunupur Matters Admin");

if ($username === "") {
    http_response_code(400);
    echo json_encode(["success" => false, "message" => "Username is required."]);
    exit;
}

$check = $pdo->prepare("SELECT id FROM admin_users WHERE username = :username LIMIT 1");
$check->execute([":username" => $username]);

if ($check->fetch()) {
    $update = $pdo->prepare("UPDATE admin_users SET password_hash = :password_hash, name = :name WHERE username = :username");
    $update->execute([
        ":password_hash" => password_hash($password, PASSWORD_DEFAULT),
        ":name" => $name,
        ":username" => $username
    ]);

    echo json_encode(["success" => true, "message" => "Admin account updated.", "username" => $username]);
    exit;
}

$insert = $pdo->prepare(
    "INSERT INTO admin_users (username, password_hash, name, role) VALUES (:username, :password_hash, :name, :role)"
);
$insert->execute([
    ":username" => $username,
    ":password_hash" => password_hash($password, PASSWORD_DEFAULT),
    ":name" => $name,
    ":role" => "admin"
]);

echo json_encode(["success" => true, "message" => "Admin account created.", "username" => $username]);