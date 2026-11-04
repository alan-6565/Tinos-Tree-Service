const crypto = require("crypto");
const { requireAuth } = require("../../lib/auth");
const { getSupabase } = require("../../lib/supabase");
const business = require("../../lib/business");
const { sendEmail, documentEmail, reviewEmail, parseEmails, EmailNotConfiguredError } = require("../../lib/email");

const UUID_RE = /^[0-9a-f-]{36}$/i;

// POST { id, kind: "document", pdf: <base64> } emails an invoice/proposal
// with its PDF attached; POST { id, kind: "review" } sends the thank-you +
// Google review request.
module.exports = async function handler(req, res) {
  if (!requireAuth(req, res)) return;
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const body = req.body || {};
  if (!UUID_RE.test(body.id || "")) {
    res.status(400).json({ error: "Missing document id" });
    return;
  }

  const supabase = getSupabase();
  const { data: doc, error } = await supabase.from("documents").select("*").eq("id", body.id).single();
  if (error || !doc) {
    res.status(404).json({ error: "Document not found" });
    return;
  }
  // Older documents were saved before every one had a private link.
  if (!doc.share_token) {
    const token = crypto.randomBytes(18).toString("base64url");
    const { data: withToken } = await supabase.from("documents").update({ share_token: token })
      .eq("id", doc.id).is("share_token", null).select().single();
    if (withToken) Object.assign(doc, withToken);
  }

  const recipients = parseEmails(doc.client_email);
  if (recipients.length === 0) {
    res.status(400).json({ error: "This client has no email address on file." });
    return;
  }

  try {
    let update;
    if (body.kind === "review") {
      await sendEmail({ to: recipients, ...reviewEmail(doc) });
      update = { review_requested_at: new Date().toISOString() };
    } else {
      const pdf = String(body.pdf || "").replace(/^data:[^,]*,/, "");
      if (!pdf) {
        res.status(400).json({ error: "Missing PDF" });
        return;
      }
      const approvalUrl = doc.type === "proposal" && doc.share_token
        ? `${business.siteUrl}/proposal.html?t=${encodeURIComponent(doc.share_token)}`
        : null;
      await sendEmail({
        to: recipients,
        // Tino gets the same email (hidden copy) as a sent receipt + backup.
        bcc: recipients.includes(business.email.toLowerCase()) ? undefined : [business.email],
        ...documentEmail(doc, { approvalUrl }),
        attachments: [{ filename: `${doc.type}-${doc.number}.pdf`, content: pdf }],
      });
      update = { emailed_at: new Date().toISOString() };
    }

    const { data: updated } = await supabase.from("documents").update(update).eq("id", doc.id).select().single();
    res.status(200).json({ document: updated || { ...doc, ...update } });
  } catch (err) {
    const status = err instanceof EmailNotConfiguredError ? 503 : 502;
    res.status(status).json({ error: err.message });
  }
};
