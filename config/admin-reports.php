<?php

session_start();
header("Content-Type: application/json");

if (!isset($_SESSION["user"]) || ($_SESSION["user"]["role"] ?? "") !== "admin") {
    http_response_code(401);
    echo json_encode(["success" => false, "message" => "Admin login is required."]);
    exit;
}

require_once __DIR__ . "/supabase.php";

if ($_SERVER["REQUEST_METHOD"] === "GET") {
    try {
        $rows = [];
        $offset = 0;
        do {
            $page = supabaseRequest("GET", "reports", [
                "select" => "*",
                "order" => "created_at.desc",
                "limit" => 1000,
                "offset" => $offset,
            ]);
            $rows = array_merge($rows, $page);
            $offset += count($page);
        } while (count($page) === 1000);
    } catch (Throwable $error) {
        error_log("Supabase admin report load failed: " . $error->getMessage());
        http_response_code(503);
        echo json_encode(["success" => false, "message" => "Report data is temporarily unavailable."]);
        exit;
    }

    $reports = array_map(static function ($row) {
        $description = trim($row["description"] ?? "");
        $title = trim($row["title"] ?? "");
        if ($title === "") {
            $title = $description !== "" ? substr($description, 0, 80) : "Untitled Issue";
        }

        $status = $row["status"] ?? "Pending Review";
        if ($status === "Submitted") {
            $status = "Under Review";
        }

        return [
            "id" => $row["report_number"] ?? (string)$row["id"],
            "title" => $title,
            "category" => $row["category"] ?? "General",
            "priority" => $row["priority"] ?? "Medium",
            "location" => $row["location"] ?? "Unknown location",
            "description" => $description,
            "name" => $row["reporter_name"] ?? $row["full_name"] ?? "",
            "contact" => $row["reporter_phone"] ?? $row["mobile"] ?? $row["reporter_email"] ?? $row["email"] ?? "",
            "photo" => $row["file_path"] ?? "",
            "status" => $status,
            "date" => $row["created_at"] ?? "",
            "lastUpdated" => $row["updated_at"] ?? $row["created_at"] ?? "",
            "activity" => []
        ];
    }, $rows);

    echo json_encode(["success" => true, "reports" => $reports]);
    exit;
}

if ($_SERVER["REQUEST_METHOD"] === "POST") {
    $payload = json_decode(file_get_contents("php://input"), true);
    if (!is_array($payload)) {
        http_response_code(400);
        echo json_encode(["success" => false, "message" => "Invalid report update."]);
        exit;
    }

    $reportId = $payload["report_id"] ?? "";
    $status = $payload["status"] ?? "";
    $note = $payload["note"] ?? "";
    if (!is_string($reportId) || !is_string($status) || !is_string($note)) {
        http_response_code(400);
        echo json_encode(["success" => false, "message" => "Invalid report update."]);
        exit;
    }
    $reportId = trim($reportId);
    $status = trim($status);
    $note = trim($note);
    $allowedStatuses = [
        "Pending Review", "Under Review", "Follow-up Initiated", "In Progress",
        "Completed", "Closed", "Resolved", "Rejected", "Submitted"
    ];

    if ($reportId === "" || !in_array($status, $allowedStatuses, true)) {
        http_response_code(400);
        echo json_encode(["success" => false, "message" => "Invalid report update."]);
        exit;
    }

    try {
        $updated = supabaseRequest("PATCH", "reports", [
            "report_number" => "eq." . $reportId,
        ], [
            "status" => $status === "Submitted" ? "Under Review" : $status,
            "admin_remarks" => $note !== "" ? $note : null,
        ]);
    } catch (Throwable $error) {
        error_log("Supabase admin report update failed: " . $error->getMessage());
        http_response_code(503);
        echo json_encode(["success" => false, "message" => "Unable to update this report right now."]);
        exit;
    }

    if ($updated === []) {
        http_response_code(404);
        echo json_encode(["success" => false, "message" => "Report not found."]);
        exit;
    }

    echo json_encode(["success" => true, "message" => "Report updated."]);
    exit;
}

http_response_code(405);
echo json_encode(["success" => false, "message" => "Invalid request method."]);