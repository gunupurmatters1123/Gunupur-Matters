<?php

$host = getenv("DB_HOST") ?: "localhost";
$dbname = getenv("DB_NAME") ?: "gunupur_matters";
$username = getenv("DB_USER") ?: "root";
$password = getenv("DB_PASS") ?: "";

try {
    $pdo = new PDO(
        "mysql:host=$host;dbname=$dbname;charset=utf8mb4",
        $username,
        $password,
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false
        ]
    );

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS admin_users (
            id INT AUTO_INCREMENT PRIMARY KEY,
            username VARCHAR(100) NOT NULL UNIQUE,
            password_hash VARCHAR(255) NOT NULL,
            name VARCHAR(150) NOT NULL DEFAULT 'Admin',
            role VARCHAR(30) NOT NULL DEFAULT 'admin',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB
    ");

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS reports (
            id INT AUTO_INCREMENT PRIMARY KEY,
            report_number VARCHAR(80) NOT NULL UNIQUE,
            title VARCHAR(255) NULL,
            category VARCHAR(120) NULL,
            priority VARCHAR(50) DEFAULT 'Medium',
            description TEXT NULL,
            location VARCHAR(255) NULL,
            location_details TEXT NULL,
            ward_number VARCHAR(50) NULL,
            street VARCHAR(200) NULL,
            area VARCHAR(200) NULL,
            landmark VARCHAR(200) NULL,
            pin_code VARCHAR(20) NULL,
            latitude VARCHAR(30) NULL,
            longitude VARCHAR(30) NULL,
            reporter_name VARCHAR(150) NULL,
            reporter_phone VARCHAR(50) NULL,
            reporter_email VARCHAR(150) NULL,
            file_name VARCHAR(255) NULL,
            file_path VARCHAR(500) NULL,
            media_type VARCHAR(50) NULL,
            status VARCHAR(80) DEFAULT 'Pending Review',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB
    ");

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS events (
            id INT AUTO_INCREMENT PRIMARY KEY,
            title VARCHAR(180) NOT NULL,
            description TEXT NOT NULL,
            location VARCHAR(180) NULL,
            activity_date DATE NOT NULL,
            photo_name VARCHAR(255) NOT NULL,
            photo_path VARCHAR(500) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_events_activity_date (activity_date, created_at)
        ) ENGINE=InnoDB
    ");

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS event_comments (
            id INT AUTO_INCREMENT PRIMARY KEY,
            event_id INT NOT NULL,
            author_name VARCHAR(80) NOT NULL,
            comment_text VARCHAR(1000) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_event_comments_event_created (event_id, created_at),
            CONSTRAINT fk_event_comments_event
                FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
        ) ENGINE=InnoDB
    ");

    $reportColumnDefinitions = [
        "title" => "VARCHAR(255) NULL",
        "priority" => "VARCHAR(50) NOT NULL DEFAULT 'Medium'",
        "location_details" => "TEXT NULL",
        "ward_number" => "VARCHAR(50) NULL",
        "street" => "VARCHAR(200) NULL",
        "area" => "VARCHAR(200) NULL",
        "landmark" => "VARCHAR(200) NULL",
        "pin_code" => "VARCHAR(20) NULL",
        "latitude" => "VARCHAR(30) NULL",
        "longitude" => "VARCHAR(30) NULL",
        "reporter_name" => "VARCHAR(150) NULL",
        "reporter_phone" => "VARCHAR(50) NULL",
        "reporter_email" => "VARCHAR(150) NULL",
        "media_type" => "VARCHAR(50) NULL",
        "full_name" => "VARCHAR(150) NULL",
        "mobile" => "VARCHAR(20) NULL",
        "email" => "VARCHAR(150) NULL",
        "admin_remarks" => "TEXT NULL"
    ];

    $reportColumns = $pdo->query("SHOW COLUMNS FROM reports")->fetchAll(PDO::FETCH_COLUMN);
    foreach ($reportColumnDefinitions as $column => $definition) {
        if (!in_array($column, $reportColumns, true)) {
            $pdo->exec("ALTER TABLE reports ADD COLUMN `$column` $definition");
        }
    }

    $statusColumn = $pdo->query("SHOW COLUMNS FROM reports LIKE 'status'")->fetch();
    if ($statusColumn && str_starts_with(strtolower($statusColumn["Type"]), "enum(")) {
        $pdo->exec("ALTER TABLE reports MODIFY status VARCHAR(80) NOT NULL DEFAULT 'Pending Review'");
    }

    $defaultAdminUser = getenv("ADMIN_USERNAME") ?: "admin";
    $defaultAdminPass = getenv("ADMIN_PASSWORD") ?: "admin123";

    $existingAdmin = $pdo->prepare("SELECT id FROM admin_users WHERE username = :username LIMIT 1");
    $existingAdmin->execute([":username" => $defaultAdminUser]);

    if (!$existingAdmin->fetch()) {
        $insertAdmin = $pdo->prepare(
            "INSERT INTO admin_users (username, password_hash, name, role) VALUES (:username, :password_hash, :name, :role)"
        );
        $insertAdmin->execute([
            ":username" => $defaultAdminUser,
            ":password_hash" => password_hash($defaultAdminPass, PASSWORD_DEFAULT),
            ":name" => "Gunupur Matters Admin",
            ":role" => "admin"
        ]);
    }

} catch (PDOException $e) {
    die("Database connection failed: " . $e->getMessage());
}
?>