const { getSupabase } = require("../../lib/supabase");
const { isEmailConfigured, sendEmail, reminderEmail, parseEmails } = require("../../lib/email");

const REMIND_AFTER_DAYS = 7;

// Runs daily (see vercel.json). Sends one friendly reminder for each invoice
// that was emailed at least 7 days ago and is still unpaid.
module.exports = async function handler(req, res) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.authorization !== `Bearer ${secret}`) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  if (!isEmailConfigured()) {
    res.status(200).json({ sent: 0, skipped: "email not configured" });
    return;
  }

  const supabase = getSupabase();
  const cutoff = new Date(Date.now() - REMIND_AFTER_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { data: invoices, error } = await supabase
    .from("documents")
    .select("*")
    .eq("type", "invoice")
    .is("paid_at", null)
    .is("reminder_sent_at", null)
    .not("client_email", "is", null)
    .lte("emailed_at", cutoff)
    .limit(50);

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  let sent = 0;
  const failed = [];
  for (const doc of invoices) {
    try {
      const recipients = parseEmails(doc.client_email);
      if (recipients.length === 0) continue;
      await sendEmail({ to: recipients, ...reminderEmail(doc) });
      await supabase.from("documents").update({ reminder_sent_at: new Date().toISOString() }).eq("id", doc.id);
      sent += 1;
    } catch (err) {
      failed.push({ number: doc.number, error: err.message });
    }
  }
  res.status(200).json({ sent, failed });
};
