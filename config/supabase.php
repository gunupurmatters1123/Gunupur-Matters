<?php

function supabaseRequest(string $method, string $resource, array $query = [], ?array $payload = null): array
{
    $projectUrl = rtrim(getenv("SUPABASE_URL") ?: "https://alptdaggxnvilkwlnfrr.supabase.co", "/");
    $secretKey = getenv("SUPABASE_SECRET_KEY") ?: getenv("SUPABASE_SERVICE_ROLE_KEY");

    if ($secretKey === false || $secretKey === "") {
        throw new RuntimeException("SUPABASE_SECRET_KEY is not configured.");
    }

    if (filter_var($projectUrl, FILTER_VALIDATE_URL) === false) {
        throw new RuntimeException("SUPABASE_URL is invalid.");
    }

    $url = $projectUrl . "/rest/v1/" . ltrim($resource, "/");
    if ($query !== []) {
        $url .= "?" . http_build_query($query, "", "&", PHP_QUERY_RFC3986);
    }

    $headers = [
        "apikey: " . $secretKey,
        "Authorization: Bearer " . $secretKey,
        "Accept: application/json",
    ];

    $body = null;
    if ($payload !== null) {
        $headers[] = "Content-Type: application/json";
        $headers[] = "Prefer: return=representation";
        $body = json_encode($payload, JSON_THROW_ON_ERROR);
    }

    if (function_exists("curl_init")) {
        $handle = curl_init($url);
        curl_setopt_array($handle, [
            CURLOPT_CUSTOMREQUEST => strtoupper($method),
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER => $headers,
            CURLOPT_TIMEOUT => 20,
        ]);
        if ($body !== null) {
            curl_setopt($handle, CURLOPT_POSTFIELDS, $body);
        }

        $responseBody = curl_exec($handle);
        $status = (int) curl_getinfo($handle, CURLINFO_RESPONSE_CODE);
        $transportError = curl_error($handle);
        curl_close($handle);

        if ($responseBody === false) {
            throw new RuntimeException("Supabase request failed: " . $transportError);
        }
    } else {
        $headers[] = "Connection: close";
        $context = stream_context_create([
            "http" => [
                "method" => strtoupper($method),
                "header" => implode("\r\n", $headers),
                "content" => $body ?? "",
                "ignore_errors" => true,
                "timeout" => 20,
            ],
        ]);

        $responseBody = @file_get_contents($url, false, $context);
        $status = 0;
        foreach ($http_response_header ?? [] as $header) {
            if (preg_match("/^HTTP\\/\\S+\\s+(\\d{3})/", $header, $matches)) {
                $status = (int) $matches[1];
            }
        }

        if ($responseBody === false) {
            throw new RuntimeException("Unable to reach the Supabase REST API.");
        }
    }

    $response = $responseBody === "" ? [] : json_decode($responseBody, true);
    if (!is_array($response)) {
        throw new RuntimeException("Supabase returned an invalid JSON response.");
    }

    if ($status < 200 || $status >= 300) {
        $message = $response["message"] ?? $response["hint"] ?? "HTTP " . $status;
        throw new RuntimeException("Supabase request failed: " . $message);
    }

    return $response;
}

