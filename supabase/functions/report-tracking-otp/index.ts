const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS"
};

type ReportRecord = {
    report_number: string;
    reporter_phone: string | null;
    status: string;
    archive_reason?: string | null;
    created_at?: string;
    updated_at?: string;
};

function jsonResponse(status: number, payload: unknown): Response {
    return new Response(JSON.stringify(payload), {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
}

function normalizePhone(value: string | null): string | null {
    if (!value) return null;
    const compact = value.trim().replace(/[\s().-]/g, "");
    if (/^\+[1-9]\d{7,14}$/.test(compact)) return compact;
    if (/^00[1-9]\d{7,14}$/.test(compact)) return `+${compact.slice(2)}`;
    if (/^0[6-9]\d{9}$/.test(compact)) return `+91${compact.slice(1)}`;
    if (/^[6-9]\d{9}$/.test(compact)) return `+91${compact}`;
    return null;
}

function normalizeReportId(value: unknown): string | null {
    if (typeof value !== "string") return null;
    const id = value.trim().toUpperCase();
    return id.length > 0 && id.length <= 80 ? id : null;
}

async function serviceRequest(path: string, init: RequestInit = {}): Promise<Response> {
    const baseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!baseUrl || !serviceKey) throw new Error("Supabase service configuration is missing.");

    return fetch(`${baseUrl}${path}`, {
        ...init,
        headers: {
            apikey: serviceKey,
            Authorization: `Bearer ${serviceKey}`,
            "Content-Type": "application/json",
            ...init.headers
        }
    });
}

async function getReport(reportId: string): Promise<{ report: ReportRecord | null; deleted: boolean }> {
    const query = new URLSearchParams({
        select: "report_number,reporter_phone,status,archive_reason,created_at,updated_at",
        report_number: `eq.${reportId}`,
        limit: "1"
    });
    const response = await serviceRequest(`/rest/v1/reports?${query}`);
    if (!response.ok) throw new Error("Could not load report.");
    const reports = await response.json() as ReportRecord[];
    if (reports[0]) return { report: reports[0], deleted: reports[0].status === "Archived" };

    const deletedQuery = new URLSearchParams({
        select: "report_number,reporter_phone,deletion_reason,deleted_at",
        report_number: `eq.${reportId}`,
        limit: "1"
    });
    const deletedResponse = await serviceRequest(`/rest/v1/deleted_report_tracking?${deletedQuery}`);
    if (!deletedResponse.ok) throw new Error("Could not load deleted report.");
    const deletedReports = await deletedResponse.json() as Array<{
        report_number: string;
        reporter_phone: string | null;
        deletion_reason: string;
        deleted_at: string;
    }>;
    const deletedReport = deletedReports[0];
    if (!deletedReport) return { report: null, deleted: false };

    return {
        report: {
            report_number: deletedReport.report_number,
            reporter_phone: deletedReport.reporter_phone,
            status: "Archived",
            archive_reason: deletedReport.deletion_reason,
            updated_at: deletedReport.deleted_at
        },
        deleted: true
    };
}

async function getPhoneRateKey(phone: string): Promise<string> {
    const secret = Deno.env.get("TRACKING_RATE_LIMIT_SECRET");
    if (!secret) throw new Error("Tracking rate-limit secret is missing.");
    const key = await crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(secret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"]
    );
    const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(phone));
    return Array.from(new Uint8Array(signature), byte => byte.toString(16).padStart(2, "0")).join("");
}

async function claimRateLimit(phone: string): Promise<boolean> {
    const rateKey = await getPhoneRateKey(phone);
    const response = await serviceRequest("/rest/v1/rpc/claim_report_tracking_otp", {
        method: "POST",
        body: JSON.stringify({ p_rate_key: rateKey })
    });
    if (!response.ok) throw new Error("Could not apply OTP rate limit.");
    return await response.json() === true;
}

async function twilioVerify(path: string, body: URLSearchParams): Promise<Record<string, unknown>> {
    const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    const serviceSid = Deno.env.get("TWILIO_VERIFY_SERVICE_SID");
    if (!accountSid || !authToken || !serviceSid) {
        throw new Error("Twilio Verify is not configured.");
    }

    const credentials = btoa(`${accountSid}:${authToken}`);
    const response = await fetch(
        `https://verify.twilio.com/v2/Services/${serviceSid}/${path}`,
        {
            method: "POST",
            headers: {
                Authorization: `Basic ${credentials}`,
                "Content-Type": "application/x-www-form-urlencoded"
            },
            body: body.toString()
        }
    );
    const result = await response.json() as Record<string, unknown>;
    if (!response.ok) throw new Error("Twilio Verify request failed.");
    return result;
}

async function handleRequest(request: Request): Promise<Response> {
    if (request.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }
    if (request.method !== "POST") {
        return jsonResponse(405, { error: "Method not allowed." });
    }

    let body: { action?: unknown; reportId?: unknown; code?: unknown };
    try {
        body = await request.json();
    } catch {
        return jsonResponse(400, { error: "Invalid request." });
    }

    const reportId = normalizeReportId(body.reportId);
    if (!reportId) return jsonResponse(400, { error: "A valid report ID is required." });

    const action = body.action;
    if (action === "send") {
        const { report } = await getReport(reportId);
        const phone = normalizePhone(report?.reporter_phone ?? null);
        if (report && phone && await claimRateLimit(phone)) {
            const form = new URLSearchParams({ To: phone, Channel: "sms" });
            await twilioVerify("Verifications", form);
        }

        return jsonResponse(200, {
            success: true,
            message: "If this report ID is valid and has a registered phone number, a verification code has been sent."
        });
    }

    if (action !== "verify" || typeof body.code !== "string" || !/^\d{4,10}$/.test(body.code.trim())) {
        return jsonResponse(400, { error: "Enter the verification code sent to the report phone." });
    }

    const { report, deleted } = await getReport(reportId);
    const phone = normalizePhone(report?.reporter_phone ?? null);
    if (!report || !phone) {
        return jsonResponse(401, { error: "The report ID or verification code is invalid or expired." });
    }

    const verification = await twilioVerify(
        "VerificationCheck",
        new URLSearchParams({ To: phone, Code: body.code.trim() })
    );
    if (verification.status !== "approved") {
        return jsonResponse(401, { error: "The report ID or verification code is invalid or expired." });
    }

    if (deleted || report.status === "Archived") {
        return jsonResponse(200, {
            success: true,
            report: {
                id: report.report_number,
                status: "Archived",
                deleted: true,
                deleteReason: report.archive_reason || "No reason was recorded.",
                date: report.created_at ?? null,
                lastUpdated: report.updated_at ?? null
            }
        });
    }

    const trackingResponse = await serviceRequest("/rest/v1/rpc/track_report", {
        method: "POST",
        body: JSON.stringify({ p_report_number: reportId })
    });
    if (!trackingResponse.ok) throw new Error("Could not load report tracking details.");
    const trackedReport = await trackingResponse.json();
    if (!trackedReport) {
        return jsonResponse(401, { error: "The report ID or verification code is invalid or expired." });
    }

    return jsonResponse(200, { success: true, report: trackedReport });
}

Deno.serve(async request => {
    try {
        return await handleRequest(request);
    } catch (error) {
        console.error("Report tracking OTP failed:", error);
        return jsonResponse(503, { error: "Secure report tracking is temporarily unavailable." });
    }
});
