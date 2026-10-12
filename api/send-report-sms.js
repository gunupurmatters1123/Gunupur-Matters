const SUPABASE_URL =
    process.env.SUPABASE_URL || "https://alptdaggxnvilkwlnfrr.supabase.co";

module.exports = async function handler(req, res) {
    res.setHeader("Cache-Control", "no-store");
    if (req.method !== "POST") {
        res.setHeader("Allow", "POST");
        return res.status(405).json({ success: false });
    }

    const { report_id: rawId, reporter_name: rawName } = req.body || {};
    const reportId = String(rawId || "").trim().toUpperCase();
    const reporterName = String(rawName || "").trim();
    if (!/^GM-\d{2}-\d{4,}$/.test(reportId)
        || !reporterName
        || reporterName.length > 100) {
        return res.status(400).json({ success: false });
    }

    const supabaseKey =
        process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
    const msg91Key = process.env.MSG91_AUTH_KEY;
    const templateId = process.env.MSG91_FLOW_TEMPLATE_ID;
    if (!supabaseKey || !msg91Key || !templateId) {
        console.error("Report SMS is missing server environment variables.");
        return res.status(503).json({ success: false });
    }

    try {
        const query = new URLSearchParams({
            select: "report_number,reporter_name,reporter_phone,report_sms_sent_at,created_at",
            report_number: `eq.${reportId}`,
            limit: "1"
        });
        const reportResponse = await fetch(`${SUPABASE_URL}/rest/v1/reports?${query}`, {
            headers: {
                apikey: supabaseKey,
                Authorization: `Bearer ${supabaseKey}`
            }
        });
        if (!reportResponse.ok) {
            throw new Error(`Report lookup failed (HTTP ${reportResponse.status}).`);
        }

        const [report] = await reportResponse.json();
        const normalize = value => String(value || "").trim().replace(/\s+/g, " ").toLowerCase();
        if (!report || normalize(report.reporter_name) !== normalize(reporterName)) {
            return res.status(404).json({ success: false });
        }
        if (report.report_sms_sent_at) {
            return res.status(200).json({ success: true, already_sent: true });
        }

        const phone = String(report.reporter_phone || "").replace(/\D/g, "");
        if (!/^91[6-9]\d{9}$/.test(phone)) {
            throw new Error("Report has no valid Indian mobile number.");
        }

        const submittedAt = new Intl.DateTimeFormat("en-IN", {
            timeZone: "Asia/Kolkata",
            dateStyle: "medium",
            timeStyle: "short"
        }).format(new Date(report.created_at)) + " IST";
        const smsResponse = await fetch("https://control.msg91.com/api/v5/flow", {
            method: "POST",
            headers: {
                authkey: msg91Key,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                template_id: templateId,
                short_url: 0,
                recipients: [{
                    mobiles: phone,
                    VAR1: reporterName,
                    VAR2: reportId,
                    VAR3: submittedAt
                }]
            })
        });
        const smsResult = await smsResponse.json();
        if (!smsResponse.ok || String(smsResult.type).toLowerCase() !== "success") {
            throw new Error(`MSG91 rejected the SMS (HTTP ${smsResponse.status}).`);
        }

        const markSent = await fetch(
            `${SUPABASE_URL}/rest/v1/reports?report_number=eq.${encodeURIComponent(reportId)}&report_sms_sent_at=is.null`,
            {
                method: "PATCH",
                headers: {
                    apikey: supabaseKey,
                    Authorization: `Bearer ${supabaseKey}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ report_sms_sent_at: new Date().toISOString() })
            }
        );
        if (!markSent.ok) {
            console.error("SMS accepted, but its sent marker could not be saved.");
        }

        return res.status(200).json({ success: true });
    } catch (error) {
        console.error("Report confirmation SMS failed:", error);
        return res.status(503).json({ success: false });
    }
};
