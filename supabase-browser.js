const SUPABASE_PROJECT_URL = "https://alptdaggxnvilkwlnfrr.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_guRwHM2q64hY_gLNXUAe-A_K6yjL8OJ";
const SUPABASE_ADMIN_SESSION_KEY = "gunupurMattersAdminSession";

async function supabaseFetch(path, options) {
    const response = await fetch(`${SUPABASE_PROJECT_URL}${path}`, {
        ...options,
        headers: {
            ...options.headers,
            apikey: SUPABASE_PUBLISHABLE_KEY,
            Authorization: options.headers && options.headers.Authorization
                ? options.headers.Authorization
                : `Bearer ${SUPABASE_PUBLISHABLE_KEY}`
        }
    });

    if (!response.ok) {
        let message = `Supabase request failed (HTTP ${response.status}).`;
        try {
            const error = await response.json();
            message = error.message || error.error || error.hint || message;
        } catch (parseError) {
            console.error("Unable to read Supabase error response:", parseError);
        }
        throw new Error(message);
    }

    return response;
}

async function submitReportToSupabase(report, file = null) {
    let filePath = null;
    let mediaType = null;
    let fileName = null;
    let mediaContentType = null;

    const compactPhone = String(report.reporter_phone || "").trim().replace(/[\s().-]/g, "");
    if (!/^(?:\+[1-9]\d{7,14}|00[1-9]\d{7,14}|0[6-9]\d{9}|[6-9]\d{9})$/.test(compactPhone)) {
        throw new Error("Enter a valid phone number so you can verify and track this report by SMS.");
    }

    const duplicateCheck = await supabaseFetch("/rest/v1/rpc/report_is_duplicate", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            p_category: report.category,
            p_location: report.location,
            p_description: report.description
        })
    });
    if (await duplicateCheck.json()) {
        throw new Error("This issue has already been reported. Please track the existing report instead of submitting it again.");
    }

    if (file) {
        if (file.size > 30 * 1024 * 1024) {
            throw new Error("File is too large. Maximum size is 30 MB.");
        }

        const typesByExtension = {
            jpg: ["image", "image/jpeg"],
            jpeg: ["image", "image/jpeg"],
            png: ["image", "image/png"],
            webp: ["image", "image/webp"],
            gif: ["image", "image/gif"],
            heic: ["image", "image/heic"],
            heif: ["image", "image/heif"],
            mp4: ["video", "video/mp4"],
            mov: ["video", "video/quicktime"],
            webm: ["video", "video/webm"],
            avi: ["video", "video/x-msvideo"],
            mkv: ["video", "video/x-matroska"],
            mpeg: ["video", "video/mpeg"],
            mpg: ["video", "video/mpeg"]
        };
        const extension = file.name.split(".").pop().toLowerCase();
        const detectedType = typesByExtension[extension];
        if (file.size === 0) {
            throw new Error("The selected file is empty.");
        }
        if (!detectedType || (
            file.type
            && file.type !== "application/octet-stream"
            && file.type.split("/")[0] !== detectedType[0]
        )) {
            throw new Error("This file type is not allowed.");
        }

        mediaType = detectedType[0];
        mediaContentType = detectedType[1];
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const objectPath = `reports/${crypto.randomUUID()}-${safeName}`;
        await supabaseFetch(
            `/storage/v1/object/report-media/${objectPath.split("/").map(encodeURIComponent).join("/")}`,
            {
                method: "POST",
                headers: {
                    "Content-Type": mediaContentType,
                    "x-upsert": "false"
                },
                body: file
            }
        );
        filePath = `${SUPABASE_PROJECT_URL}/storage/v1/object/public/report-media/${objectPath}`;
        fileName = file.name;
    }

    const response = await supabaseFetch("/rest/v1/rpc/submit_report", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            p_report: {
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
                require_address: report.require_address === true,
                file_name: fileName,
                file_path: filePath,
                media_type: mediaType,
                file_content_type: mediaContentType,
                file_size: file ? file.size : null
            }
        })
    });

    const reportNumber = await response.json();
    if (typeof reportNumber !== "string" || !/^GM-\d{2}-\d{4,}$/.test(reportNumber)) {
        throw new Error("Supabase did not return a valid report number.");
    }

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

async function getReportStatisticsFromSupabase() {
    const response = await supabaseFetch("/rest/v1/rpc/report_statistics", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: "{}"
    });
    return response.json();
}

function saveAdminSession(session) {
    try {
        localStorage.setItem(SUPABASE_ADMIN_SESSION_KEY, JSON.stringify(session));
    } catch (error) {
        throw new Error("Unable to save your admin session in this browser.");
    }
}

function clearAdminSession() {
    localStorage.removeItem(SUPABASE_ADMIN_SESSION_KEY);
}

async function signInAdminWithSupabase(email, password) {
    const response = await supabaseFetch("/auth/v1/token?grant_type=password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
    });
    const auth = await response.json();

    if (!auth.user || auth.user.app_metadata?.role !== "admin") {
        clearAdminSession();
        throw new Error("This account is not authorized as an administrator.");
    }

    const session = {
        access_token: auth.access_token,
        refresh_token: auth.refresh_token,
        expires_at: Date.now() + Number(auth.expires_in || 3600) * 1000
    };
    saveAdminSession(session);
    return auth.user;
}

async function getAdminSession() {
    let session;
    try {
        session = JSON.parse(localStorage.getItem(SUPABASE_ADMIN_SESSION_KEY) || "null");
    } catch (error) {
        clearAdminSession();
        throw new Error("The saved admin session is invalid. Please sign in again.");
    }

    if (!session || !session.access_token || !session.refresh_token) {
        throw new Error("Please sign in to access the admin dashboard.");
    }

    if (Number(session.expires_at) < Date.now() + 60000) {
        const response = await supabaseFetch("/auth/v1/token?grant_type=refresh_token", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ refresh_token: session.refresh_token })
        });
        const auth = await response.json();
        if (!auth.user || auth.user.app_metadata?.role !== "admin") {
            clearAdminSession();
            throw new Error("This account is not authorized as an administrator.");
        }
        session = {
            access_token: auth.access_token,
            refresh_token: auth.refresh_token,
            expires_at: Date.now() + Number(auth.expires_in || 3600) * 1000
        };
        saveAdminSession(session);
    }

    const response = await supabaseFetch("/auth/v1/user", {
        headers: { Authorization: `Bearer ${session.access_token}` }
    });
    const user = await response.json();

    if (user.app_metadata?.role !== "admin") {
        clearAdminSession();
        throw new Error("This account is not authorized as an administrator.");
    }

    return { session, user };
}

async function getAdminReportsFromSupabase() {
    const { session } = await getAdminSession();
    const response = await supabaseFetch("/rest/v1/rpc/admin_list_reports", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json"
        },
        body: "{}"
    });
    return response.json();
}

async function updateAdminReportInSupabase(reportNumber, status, note) {
    const { session } = await getAdminSession();
    const response = await supabaseFetch("/rest/v1/rpc/admin_update_report", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            p_report_number: reportNumber,
            p_status: status,
            p_note: note
        })
    });
    return response.json();
}

async function archiveAdminReportInSupabase(reportNumber, reason) {
    const { session } = await getAdminSession();
    const response = await supabaseFetch("/rest/v1/rpc/admin_archive_report", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            p_reason: reason,
            p_report_number: reportNumber
        })
    });
    return response.json();
}

async function getArchivedReportsFromSupabase() {
    const { session } = await getAdminSession();
    const response = await supabaseFetch("/rest/v1/rpc/admin_list_archived_reports", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json"
        },
        body: "{}"
    });
    return response.json();
}

async function removeArchivedReportFilesFromSupabase(attachments) {
    const paths = attachments
        .map(attachment => {
            if (!attachment || typeof attachment.file_path !== "string") {
                return null;
            }
            try {
                const url = new URL(attachment.file_path, SUPABASE_PROJECT_URL);
                const prefix = "/storage/v1/object/public/report-media/";
                if (url.origin !== SUPABASE_PROJECT_URL || !url.pathname.startsWith(prefix)) {
                    return null;
                }
                return decodeURIComponent(url.pathname.slice(prefix.length));
            } catch (error) {
                return null;
            }
        })
        .filter(Boolean);
    if (paths.length === 0) {
        return;
    }

    const { session } = await getAdminSession();
    await supabaseFetch("/storage/v1/object/report-media", {
        method: "DELETE",
        headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ prefixes: paths })
    });
}

async function restoreAdminReportInSupabase(reportNumber) {
    const { session } = await getAdminSession();
    const response = await supabaseFetch("/rest/v1/rpc/admin_restore_report", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ p_report_number: reportNumber })
    });
    return response.json();
}

async function permanentlyDeleteAdminReportInSupabase(reportNumber) {
    const { session } = await getAdminSession();
    const response = await supabaseFetch("/rest/v1/rpc/admin_delete_archived_report", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ p_report_number: reportNumber })
    });
    return response.json();
}

async function signOutAdminFromSupabase() {
    let session = null;
    try {
        session = JSON.parse(localStorage.getItem(SUPABASE_ADMIN_SESSION_KEY) || "null");
    } catch (error) {
        clearAdminSession();
        return;
    }
    clearAdminSession();
    if (session?.access_token) {
        await supabaseFetch("/auth/v1/logout", {
            method: "POST",
            headers: { Authorization: `Bearer ${session.access_token}` }
        });
    }
}
