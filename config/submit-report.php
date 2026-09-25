<?php

require_once "../config/database.php";

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
    die("Invalid request.");
}


/*
|--------------------------------------------------------------------------
| Get form values
|--------------------------------------------------------------------------
*/

$full_name = trim($_POST["full_name"] ?? "");
$mobile = trim($_POST["mobile"] ?? "");
$email = trim($_POST["email"] ?? "");
$category = trim($_POST["category"] ?? "");
$location = trim($_POST["location"] ?? "");
$description = trim($_POST["description"] ?? "");


/*
|--------------------------------------------------------------------------
| Basic validation
|--------------------------------------------------------------------------
*/

if ($category === "") {
    die("Please select an issue category.");
}

if ($location === "") {
    die("Please enter the location.");
}

if ($description === "") {
    die("Please describe the issue.");
}


/*
|--------------------------------------------------------------------------
| Generate report number
|--------------------------------------------------------------------------
*/

$report_number = "GM-" . date("Y") . "-" . strtoupper(
    substr(bin2hex(random_bytes(4)), 0, 8)
);


/*
|--------------------------------------------------------------------------
| File upload
|--------------------------------------------------------------------------
*/

$file_name = null;
$file_path = null;

$uploaded_file = $_FILES["photo"] ?? $_FILES["attachment"] ?? null;

if (is_array($uploaded_file) && ($uploaded_file["error"] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_NO_FILE) {

    if ($uploaded_file["error"] !== UPLOAD_ERR_OK) {
        die("File upload failed.");
    }


    /*
    |--------------------------------------------------------------------------
    | Maximum 5 MB
    |--------------------------------------------------------------------------
    */

    $max_size = 5 * 1024 * 1024;

    if ($uploaded_file["size"] > $max_size) {
        die("File is too large. Maximum size is 5 MB.");
    }


    /*
    |--------------------------------------------------------------------------
    | Allowed extensions
    |--------------------------------------------------------------------------
    */

    $allowed_extensions = [
        "jpg",
        "jpeg",
        "png",
        "webp",
        "pdf"
    ];

    $original_name = $uploaded_file["name"];

    $extension = strtolower(
        pathinfo($original_name, PATHINFO_EXTENSION)
    );

    if (!in_array($extension, $allowed_extensions, true)) {
        die("This file type is not allowed.");
    }


    /*
    |--------------------------------------------------------------------------
    | Create upload folder
    |--------------------------------------------------------------------------
    */

    $upload_directory = "../uploads/reports/";

    if (!is_dir($upload_directory)) {

        mkdir(
            $upload_directory,
            0755,
            true
        );

    }


    /*
    |--------------------------------------------------------------------------
    | Generate safe filename
    |--------------------------------------------------------------------------
    */

    $safe_filename =
        $report_number . "_" .
        bin2hex(random_bytes(8)) .
        "." .
        $extension;


    $destination =
        $upload_directory .
        $safe_filename;


    if (!move_uploaded_file(
        $uploaded_file["tmp_name"],
        $destination
    )) {

        die("Unable to save uploaded file.");

    }


    $file_name = $original_name;

    $file_path =
        "uploads/reports/" .
        $safe_filename;
}


/*
|--------------------------------------------------------------------------
| Insert into database
|--------------------------------------------------------------------------
*/

$sql = "
    INSERT INTO reports
    (
        report_number,
        full_name,
        mobile,
        email,
        category,
        location,
        description,
        file_name,
        file_path,
        status
    )
    VALUES
    (
        :report_number,
        :full_name,
        :mobile,
        :email,
        :category,
        :location,
        :description,
        :file_name,
        :file_path,
        'Submitted'
    )
";


$stmt = $pdo->prepare($sql);

$stmt->execute([

    ":report_number" => $report_number,

    ":full_name" =>
        $full_name !== "" ? $full_name : null,

    ":mobile" =>
        $mobile !== "" ? $mobile : null,

    ":email" =>
        $email !== "" ? $email : null,

    ":category" => $category,

    ":location" => $location,

    ":description" => $description,

    ":file_name" => $file_name,

    ":file_path" => $file_path

]);


/*
|--------------------------------------------------------------------------
| Success
|--------------------------------------------------------------------------
*/

?>

<!DOCTYPE html>

<html lang="en">

<head>

    <meta charset="UTF-8">

    <meta
        name="viewport"
        content="width=device-width, initial-scale=1.0"
    >

    <title>Report Submitted | Gunupur Matters</title>

</head>

<body>

    <h1>Report Submitted Successfully</h1>

    <p>
        Your report has been received.
    </p>

    <h2>
        Report Number:
        <?php echo htmlspecialchars($report_number); ?>
    </h2>

    <p>
        Please save this report number.
        You will need it to track your report.
    </p>

    <p>
        <a href="../track.html">
            Track Your Report
        </a>
    </p>

    <p>
        <a href="../index.html">
            Return to Home
        </a>
    </p>

</body>

</html>