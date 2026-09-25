<?php
session_start();

if (!isset($_SESSION["user"]) || empty($_SESSION["user"])) {
    header("Location: adlog.html?error=1");
    exit;
}

if (($_SESSION["user"]["role"] ?? "") !== "admin") {
    session_destroy();
    header("Location: adlog.html?error=1");
    exit;
}
