<?php

require_once __DIR__ . "/supabase.php";

header("Content-Type: application/json");

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
    http_response_code(405);
    echo json_encode(["success" => false, "message" => "Invalid request method."]);
    exit;
}

$report_number = "GM-" . date("Y") . "-" . strtoupper(bin2hex(random_bytes(8)));

$title = trim($_POST["title"] ?? "");
$category = trim($_POST["category"] ?? "");
$priority = trim($_POST["priority"] ?? "Medium");
$description = trim($_POST["description"] ?? "");
$street = trim($_POST["street"] ?? "");
$location_details = trim($_POST["locationDetails"] ?? "");
$ward_number = trim($_POST["wardNumber"] ?? "");
$latitude = trim($_POST["latitude"] ?? "");
$longitude = trim($_POST["longitude"] ?? "");
$reporter_name = trim($_POST["reporterName"] ?? "");
$reporter_phone = trim($_POST["reporterPhone"] ?? "");
$reporter_email = trim($_POST["reporterEmail"] ?? $_POST["email"] ?? "");
$location = trim($_POST["location"] ?? "");

if ($category === "") {
    http_response_code(400);
    echo json_encode(["success" => false, "message" => "Please select an issue category."]);
    exit;
}

if ($ward_number === "" || $street === "") {
    http_response_code(400);
    echo json_encode(["success" => false, "message" => "Please provide the ward number and street."]);
    exit;
}

if ($location === "") {
    $locationParts = array_filter([
        $street,
        $ward_number
    ]);
    $location = implode(", ", $locationParts);
}

$descriptionLength = preg_match_all('/./us', $description);
if ($descriptionLength === false || $descriptionLength < 15 || $descriptionLength > 1000) {
    http_response_code(400);
    echo json_encode(["success" => false, "message" => "Please describe the issue in 15 to 1000 characters."]);
    exit;
}

$file_name = null;
$file_path = null;
$media_type = null;

$uploaded_file = $_FILES["photo"] ?? null;

if (is_array($uploaded_file) && ($uploaded_file["error"] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_NO_FILE) {
    if (($uploaded_file["error"] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
        http_response_code(400);
        echo json_encode(["success" => false, "message" => "The uploaded file failed to process."]);
        exit;
    }

    $max_size = 30 * 1024 * 1024;
    if (($uploaded_file["size"] ?? 0) > $max_size) {
        http_response_code(400);
        echo json_encode(["success" => false, "message" => "File is too large. Maximum size is 30 MB."]);
        exit;
    }

    $allowed_extensions = [
        "jpg", "jpeg", "png", "webp", "gif",
        "mp4", "mov", "avi", "mkv", "webm", "mpeg", "mpg"
    ];

    $extension = strtolower(pathinfo($uploaded_file["name"], PATHINFO_EXTENSION));
    if (!in_array($extension, $allowed_extensions, true)) {
        http_response_code(400);
        echo json_encode(["success" => false, "message" => "This file type is not allowed."]);
        exit;
    }

    $upload_directory = __DIR__ . "/../uploads/reports/";
    if (!is_dir($upload_directory)) {
        mkdir($upload_directory, 0755, true);
    }

    $safe_filename = $report_number . "_" . bin2hex(random_bytes(8)) . "." . $extension;
    $destination = $upload_directory . $safe_filename;

    if (!move_uploaded_file($uploaded_file["tmp_name"], $destination)) {
        http_response_code(500);
        echo json_encode(["success" => false, "message" => "Unable to save uploaded file."]);
        exit;
    }

    $file_name = $uploaded_file["name"];
    $file_path = "uploads/reports/" . $safe_filename;
    $media_type = str_starts_with($uploaded_file["type"] ?? "", "video/") ? "video" : "image";
}

try {
    $savedReports = supabaseRequest("POST", "reports", [], [
        "report_number" => $report_number,
        "title" => $title !== "" ? $title : null,
        "category" => $category,
        "priority" => $priority !== "" ? $priority : "Medium",
        "description" => $description,
        "location" => $location !== "" ? $location : null,
        "location_details" => $location_details !== "" ? $location_details : null,
        "ward_number" => $ward_number !== "" ? $ward_number : null,
        "street" => $street !== "" ? $street : null,
        "latitude" => $latitude !== "" ? $latitude : null,
        "longitude" => $longitude !== "" ? $longitude : null,
        "reporter_name" => $reporter_name !== "" ? $reporter_name : null,
        "reporter_phone" => $reporter_phone !== "" ? $reporter_phone : null,
        "reporter_email" => $reporter_email !== "" ? $reporter_email : null,
        "file_name" => $file_name,
        "file_path" => $file_path,
        "media_type" => $media_type,
        "status" => "Pending Review",
    ]);
} catch (Throwable $error) {
    if ($file_path !== null) {
        $savedFile = __DIR__ . "/../" . $file_path;
        if (is_file($savedFile)) {
            unlink($savedFile);
        }
    }
    error_log("Supabase report submission failed: " . $error->getMessage());
    http_response_code(503);
    echo json_encode(["success" => false, "message" => "Unable to save your report right now. Please try again later."]);
    exit;
}

if (!isset($savedReports[0]["report_number"])) {
    error_log("Supabase report submission did not return the generated report number.");
    http_response_code(503);
    echo json_encode(["success" => false, "message" => "The report was saved, but its tracking number could not be confirmed."]);
    exit;
}

$report_number = $savedReports[0]["report_number"];

echo json_encode([
    "success" => true,
    "message" => "Report submitted successfully.",
    "report_id" => $report_number,
    "report_number" => $report_number
]);