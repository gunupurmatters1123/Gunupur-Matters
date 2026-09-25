<?php

$password = "ChangeThisPassword123!";

$hash = password_hash(
    $password,
    PASSWORD_DEFAULT
);

echo "<h3>Password Hash</h3>";

echo "<p>" .
     htmlspecialchars($hash) .
     "</p>";