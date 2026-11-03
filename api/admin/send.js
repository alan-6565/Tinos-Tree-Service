const { requireAuth } = require("../../lib/auth");
const { getSupabase } = require("../../lib/supabase");
const business = require("../../lib/business");
const { sendEmail, documentEmail, reviewEmail, EmailNotConfiguredError } = require("../../lib/email");

const UUID_RE = /^[0-9a-f-]{36}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
  if (!EMAIL_RE.test(doc.client_email || "")) {
    res.status(400).json({ error: "This client has no email address on file." });
    return;
  }

  try {
    let update;
    if (body.kind === "review") {
      await sendEmail({ to: doc.client_email, ...reviewEmail(doc) });
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
        to: doc.client_email,
        // Tino gets the same email (hidden copy) as a sent receipt + backup.
        bcc: doc.client_email.toLowerCase() === business.email.toLowerCase() ? undefined : [business.email],
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
