<?php

session_start();

require_once "../config/database.php";


if (
    !isset($_SESSION["admin_logged_in"]) ||
    $_SESSION["admin_logged_in"] !== true
) {

    header("Location: ../admin.php");

    exit;
}


/*
|--------------------------------------------------------------------------
| Get all reports
|--------------------------------------------------------------------------
*/

$stmt = $pdo->query("
    SELECT
        id,
        report_number,
        full_name,
        mobile,
        category,
        location,
        status,
        created_at
    FROM reports
    ORDER BY created_at DESC
");

$reports = $stmt->fetchAll();

?>

<!DOCTYPE html>

<html lang="en">

<head>

    <meta charset="UTF-8">

    <meta
        name="viewport"
        content="width=device-width, initial-scale=1.0"
    >

    <title>Admin Dashboard | Gunupur Matters</title>

</head>

<body>

<h1>
    Gunupur Matters
</h1>

<h2>
    Admin Dashboard
</h2>

<p>
    Welcome,
    <?php
    echo htmlspecialchars(
        $_SESSION["admin_username"]
    );
    ?>
</p>

<p>
    <a href="logout.php">
        Logout
    </a>
</p>


<hr>


<h2>
    Submitted Reports
</h2>


<table
    border="1"
    cellpadding="10"
    cellspacing="0"
>

<thead>

<tr>

    <th>Report Number</th>

    <th>Name</th>

    <th>Mobile</th>

    <th>Category</th>

    <th>Location</th>

    <th>Status</th>

    <th>Date</th>

</tr>

</thead>


<tbody>

<?php foreach ($reports as $report): ?>

<tr>

    <td>
        <?php
        echo htmlspecialchars(
            $report["report_number"]
        );
        ?>
    </td>

    <td>
        <?php
        echo htmlspecialchars(
            $report["full_name"] ?? "Anonymous"
        );
        ?>
    </td>

    <td>
        <?php
        echo htmlspecialchars(
            $report["mobile"] ?? "-"
        );
        ?>
    </td>

    <td>
        <?php
        echo htmlspecialchars(
            $report["category"]
        );
        ?>
    </td>

    <td>
        <?php
        echo htmlspecialchars(
            $report["location"]
        );
        ?>
    </td>

    <td>
        <?php
        echo htmlspecialchars(
            $report["status"]
        );
        ?>
    </td>

    <td>
        <?php
        echo htmlspecialchars(
            $report["created_at"]
        );
        ?>
    </td>

</tr>

<?php endforeach; ?>

</tbody>

</table>

</body>

</html>