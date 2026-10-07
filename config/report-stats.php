<?php

require_once __DIR__ . "/supabase.php";

header("Content-Type: application/json");

$counts = [
    "total" => 0,
    "under_review" => 0,
    "followups" => 0,
    "closed" => 0,
];

try {
    $offset = 0;
    do {
        $rows = supabaseRequest("GET", "reports", [
            "select" => "status",
            "limit" => 1000,
            "offset" => $offset,
        ]);
        foreach ($rows as $row) {
            $counts["total"]++;
            $status = $row["status"] ?? "";
            if (in_array($status, ["Pending Review", "Under Review", "Submitted"], true)) {
                $counts["under_review"]++;
            } elseif ($status === "Follow-up Initiated") {
                $counts["followups"]++;
            } elseif (in_array($status, ["Completed", "Closed", "Resolved"], true)) {
                $counts["closed"]++;
            }
        }
        $offset += count($rows);
    } while (count($rows) === 1000);
} catch (Throwable $error) {
    error_log("Supabase report statistics failed: " . $error->getMessage());
    http_response_code(503);
    echo json_encode(["success" => false, "message" => "Report statistics are temporarily unavailable."]);
    exit;
}

echo json_encode([
    "success" => true,
    "total" => $counts["total"],
    "under_review" => $counts["under_review"],
    "followups" => $counts["followups"],
    "closed" => $counts["closed"]
]);