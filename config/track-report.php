<?php

header("Content-Type: application/json");

if ($_SERVER["REQUEST_METHOD"] !== "GET") {
    http_response_code(405);
    echo json_encode(["success" => false, "message" => "Invalid request method."]);
    exit;
}

$reportNumberInput = $_GET["report_id"] ?? "";
if (!is_string($reportNumberInput)) {
    http_response_code(400);
    echo json_encode(["success" => false, "message" => "A valid report ID is required."]);
    exit;
}

$reportNumber = strtoupper(trim($reportNumberInput));
if ($reportNumber === "" || strlen($reportNumber) > 80) {
    http_response_code(400);
    echo json_encode(["success" => false, "message" => "A valid report ID is required."]);
    exit;
}

require_once __DIR__ . "/supabase.php";

try {
    $rows = supabaseRequest("GET", "reports", [
        "select" => "report_number,title,category,priority,description,location,status,created_at,updated_at",
        "report_number" => "eq." . $reportNumber,
        "limit" => 1,
    ]);
} catch (Throwable $error) {
    error_log("Supabase report lookup failed: " . $error->getMessage());
    http_response_code(503);
    echo json_encode(["success" => false, "message" => "Report tracking is temporarily unavailable."]);
    exit;
}

if ($rows === []) {
    http_response_code(404);
    echo json_encode(["success" => false, "message" => "Report not found."]);
    exit;
}

$row = $rows[0];
echo json_encode([
    "success" => true,
    "report" => [
        "id" => $row["report_number"],
        "title" => $row["title"] ?? "",
        "category" => $row["category"] ?? "",
        "priority" => $row["priority"] ?? "Medium",
        "description" => $row["description"] ?? "",
        "location" => $row["location"] ?? "",
        "status" => $row["status"] ?? "Pending Review",
        "date" => $row["created_at"] ?? "",
        "lastUpdated" => $row["updated_at"] ?? $row["created_at"] ?? "",
    ],
]);
