<?php

function sendReportSms(string $phone, string $reportNumber, string $reporterName): bool
{
    $authKey = getenv("MSG91_AUTH_KEY");
    $templateId = getenv("MSG91_FLOW_TEMPLATE_ID");
    if ($authKey === false || $authKey === "" || $templateId === false || $templateId === "") {
        throw new RuntimeException("MSG91 SMS is not configured.");
    }

    $digits = preg_replace('/\D+/', '', $phone) ?? "";
    if (strlen($digits) !== 12 || !str_starts_with($digits, "91")) {
        throw new RuntimeException("The report does not have a valid Indian mobile number.");
    }

    $handle = curl_init("https://control.msg91.com/api/v5/flow");
    curl_setopt_array($handle, [
        CURLOPT_POST => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => [
            "authkey: " . $authKey,
            "Content-Type: application/json",
            "Accept: application/json",
        ],
        CURLOPT_POSTFIELDS => json_encode([
            "template_id" => $templateId,
            "short_url" => 0,
            "recipients" => [[
                "mobiles" => $digits,
                "VAR1" => $reporterName,
                "VAR2" => $reportNumber,
            ]],
        ], JSON_THROW_ON_ERROR),
        CURLOPT_TIMEOUT => 15,
    ]);
    $responseBody = curl_exec($handle);
    $status = (int)curl_getinfo($handle, CURLINFO_RESPONSE_CODE);
    curl_close($handle);

    if (!is_string($responseBody) || $status < 200 || $status >= 300) {
        error_log("MSG91 report SMS failed with HTTP " . $status . ".");
        throw new RuntimeException("The report was saved, but its SMS could not be sent.");
    }

    $response = json_decode($responseBody, true);
    if (!is_array($response) || strtolower((string)($response["type"] ?? "")) !== "success") {
        error_log("MSG91 returned an unsuccessful report SMS response.");
        throw new RuntimeException("The report was saved, but its SMS could not be sent.");
    }

    return true;
}
