<?php

header("Content-Type: application/json; charset=utf-8");
header("Cache-Control: no-store, private");

function smsResponse(int $status, array $body): void
{
    http_response_code($status);
    echo json_encode($body, JSON_THROW_ON_ERROR);
    exit;
}

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
    header("Allow: POST");
    smsResponse(405, ["success" => false, "message" => "Invalid request method."]);
}

$payload = json_decode(file_get_contents("php://input"), true);
$reportNumber = strtoupper(trim((string)($payload["report_id"] ?? "")));
$reporterName = trim((string)($payload["reporter_name"] ?? ""));

if (!is_array($payload)
    || !preg_match('/^GM-[A-Z0-9-]{4,76}$/', $reportNumber)
    || $reporterName === ""
    || strlen($reporterName) > 400) {
    smsResponse(400, ["success" => false, "message" => "The report ID and reporter name are required."]);
}

require_once __DIR__ . "/supabase.php";
require_once __DIR__ . "/msg91.php";

try {
    $rows = supabaseRequest("GET", "reports", [
        "select" => "report_number,reporter_name,reporter_phone,report_sms_sent_at",
        "report_number" => "eq." . $reportNumber,
        "limit" => 1,
    ]);
    $report = $rows[0] ?? null;

    if (!is_array($report)
        || !hash_equals(
            strtolower(trim((string)($report["reporter_name"] ?? ""))),
            strtolower($reporterName)
        )) {
        smsResponse(404, ["success" => false, "message" => "The submitted report could not be confirmed."]);
    }

    if (!empty($report["report_sms_sent_at"])) {
        smsResponse(200, ["success" => true, "already_sent" => true]);
    }

    $claimed = supabaseRequest("PATCH", "reports", [
        "report_number" => "eq." . $reportNumber,
        "report_sms_sent_at" => "is.null",
    ], [
        "report_sms_sent_at" => gmdate("c"),
    ]);

    if ($claimed === []) {
        smsResponse(200, ["success" => true, "already_sent" => true]);
    }

    sendReportSms(
        (string)$report["reporter_phone"],
        $reportNumber,
        $reporterName
    );

    smsResponse(200, ["success" => true]);
} catch (Throwable $error) {
    error_log("Report confirmation SMS failed: " . $error->getMessage());
    smsResponse(503, [
        "success" => false,
        "message" => "The report was saved, but its SMS could not be sent.",
    ]);
}
