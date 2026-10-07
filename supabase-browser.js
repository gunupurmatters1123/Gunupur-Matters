const SUPABASE_PROJECT_URL = "https://alptdaggxnvilkwlnfrr.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_guRwHM2q64hY_gLNXUAe-A_K6yjL8OJ";

function makeReportNumber() {
    const bytes = crypto.getRandomValues(new Uint8Array(8));
    const suffix = Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
    return `GM-${new Date().getFullYear()}-${suffix.toUpperCase()}`;
}

async function supabaseFetch(path, options) {
    const response = await fetch(`${SUPABASE_PROJECT_URL}${path}`, {
        ...options,
        headers: {
            apikey: SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
            ...options.headers
        }
    });

    if (!response.ok) {
        let message = `Supabase request failed (HTTP ${response.status}).`;
        try {
            const error = await response.json();
            message = error.message || error.hint || message;
        } catch (parseError) {
            console.error("Unable to read Supabase error response:", parseError);
        }
        throw new Error(message);
    }

    return response;
}

async function submitReportToSupabase(report, file = null) {
    const reportNumber = makeReportNumber();
    let filePath = null;
    let mediaType = null;
    let fileName = null;

    if (file) {
        if (file.size > 30 * 1024 * 1024) {
            throw new Error("File is too large. Maximum size is 30 MB.");
        }

        const allowedTypes = new Set([
            "image/jpeg", "image/png", "image/webp", "image/gif",
            "video/mp4", "video/quicktime", "video/webm", "video/x-msvideo",
            "video/x-matroska", "video/mpeg"
        ]);
        if (!allowedTypes.has(file.type)) {
            throw new Error("This file type is not allowed.");
        }

        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const objectPath = `${reportNumber}/${crypto.randomUUID()}-${safeName}`;
        await supabaseFetch(
            `/storage/v1/object/report-media/${objectPath.split("/").map(encodeURIComponent).join("/")}`,
            {
                method: "POST",
                headers: {
                    "Content-Type": file.type,
                    "x-upsert": "false"
                },
                body: file
            }
        );
        filePath = `${SUPABASE_PROJECT_URL}/storage/v1/object/public/report-media/${objectPath}`;
        mediaType = file.type.startsWith("video/") ? "video" : "image";
        fileName = file.name;
    }

    await supabaseFetch("/rest/v1/reports", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Prefer: "return=minimal"
        },
        body: JSON.stringify({
            report_number: reportNumber,
            title: report.title || null,
            category: report.category,
            priority: report.priority || "Medium",
            description: report.description,
            location: report.location,
            location_details: report.location_details || null,
            ward_number: report.ward_number || null,
            street: report.street || null,
            area: report.area || null,
            landmark: report.landmark || null,
            pin_code: report.pin_code || null,
            latitude: report.latitude || null,
            longitude: report.longitude || null,
            reporter_name: report.reporter_name || null,
            reporter_phone: report.reporter_phone || null,
            reporter_email: report.reporter_email || null,
            file_name: fileName,
            file_path: filePath,
            media_type: mediaType
        })
    });

    return { success: true, report_id: reportNumber, report_number: reportNumber };
}

async function findReportInSupabase(reportNumber) {
    const response = await supabaseFetch("/rest/v1/rpc/track_report", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ p_report_number: reportNumber })
    });
    return response.json();
}
