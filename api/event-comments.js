const { createHmac } = require("node:crypto");
const { isIP } = require("node:net");

const SUPABASE_URL =
    process.env.SUPABASE_URL || "https://alptdaggxnvilkwlnfrr.supabase.co";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function responseError(res, status, message) {
    return res.status(status).json({ error: message });
}

module.exports = async function handler(req, res) {
    res.setHeader("Cache-Control", "no-store");
    if (req.method !== "POST") {
        res.setHeader("Allow", "POST");
        return responseError(res, 405, "This action is not supported.");
    }

    const body = req.body && typeof req.body === "object" && !Array.isArray(req.body)
        ? req.body
        : {};
    const action = body.action;
    if (action !== "comment" && action !== "report") {
        return responseError(res, 400, "Invalid comment action.");
    }
    if (Buffer.byteLength(JSON.stringify(body)) > 1500) {
        return responseError(res, 413, "The request is too large.");
    }

    const forwardedFor = req.headers["x-forwarded-for"];
    const forwardedIps = typeof forwardedFor === "string"
        ? forwardedFor.split(",").map((ip) => ip.trim()).filter(isIP)
        : [];
    const clientIp = forwardedIps[forwardedIps.length - 1]
        || req.headers["x-real-ip"];
    if (typeof clientIp !== "string" || !isIP(clientIp.trim())) {
        console.error("Event comments require a valid client IP from the hosting platform.");
        return responseError(res, 503, "Comment services are temporarily unavailable.");
    }

    const supabaseKey =
        process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseKey) {
        console.error("Event comments are missing the Supabase server secret.");
        return responseError(res, 503, "Comment services are temporarily unavailable.");
    }

    const ipHash = createHmac("sha256", supabaseKey)
        .update(clientIp.trim())
        .digest("hex");
    let functionName;
    let args;

    if (action === "comment") {
        const eventId = String(body.event_id || "").trim();
        const authorName = String(body.author_name || "").trim().replace(/\s+/g, " ");
        const commentText = String(body.comment_text || "").trim();
        if (!UUID_PATTERN.test(eventId)
            || !/^[\p{L}\p{M}][\p{L}\p{M} .'-]{1,79}$/u.test(authorName)
            || !commentText
            || commentText.length > 1000) {
            return responseError(res, 400, "Check the name and comment, then try again.");
        }
        functionName = "submit_event_comment";
        args = {
            p_event_id: eventId,
            p_author_name: authorName,
            p_comment_text: commentText,
            p_ip_hash: ipHash
        };
    } else {
        const commentId = String(body.comment_id || "").trim();
        if (!UUID_PATTERN.test(commentId)) {
            return responseError(res, 400, "This comment could not be reported.");
        }
        functionName = "report_event_comment";
        args = {
            p_comment_id: commentId,
            p_ip_hash: ipHash,
            p_report_hash: createHmac("sha256", supabaseKey)
                .update(`${clientIp.trim()}:${commentId}`)
                .digest("hex")
        };
    }

    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${functionName}`, {
            method: "POST",
            headers: {
                apikey: supabaseKey,
                Authorization: `Bearer ${supabaseKey}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(args)
        });
        const result = await response.json().catch(() => null);
        if (!response.ok) {
            const databaseMessage = String(result && result.message || "");
            if (databaseMessage.includes("COMMENT_RATE_LIMIT")) {
                return responseError(res, 429, "You've reached the comment limit. Please try again in 10 minutes.");
            }
            if (databaseMessage.includes("REPORT_RATE_LIMIT")) {
                return responseError(res, 429, "Too many reports were sent. Please try again later.");
            }
            if (databaseMessage.includes("COMMENT_NOT_FOUND")) {
                return responseError(res, 404, "This comment is no longer available.");
            }
            console.error(`Event comment request failed (HTTP ${response.status}).`);
            return responseError(res, 503, "The request couldn't be completed. Please try again.");
        }

        if (action === "comment") {
            return res.status(201).json(result);
        }
        return res.status(200).json({ reported: Boolean(result) });
    } catch (error) {
        console.error("Event comment service request failed:", error);
        return responseError(res, 503, "Comment services are temporarily unavailable.");
    }
};
