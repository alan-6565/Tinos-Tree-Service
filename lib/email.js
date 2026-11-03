const business = require("./business");

// Sends email through Resend (https://resend.com). Needs RESEND_API_KEY in
// the environment; EMAIL_FROM can override the sender once the domain is
// verified in Resend.
class EmailNotConfiguredError extends Error {
  constructor() {
    super("Email isn't set up yet. Add RESEND_API_KEY in Vercel to turn it on.");
    this.name = "EmailNotConfiguredError";
  }
}

function isEmailConfigured() {
  return Boolean(process.env.RESEND_API_KEY);
}

async function sendEmail({ to, bcc, subject, html, text, attachments }) {
  if (!isEmailConfigured()) throw new EmailNotConfiguredError();
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM || `${business.name} <invoices@tinostreeservice.net>`,
      reply_to: business.email,
      to: Array.isArray(to) ? to : [to],
      bcc,
      subject,
      html,
      text,
      attachments,
    }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || `Email failed to send (${res.status})`);
  }
  return res.json();
}

const escapeHtml = (str) =>
  String(str == null ? "" : str)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");

const money = (n) => `$${Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const firstName = (name) => String(name || "").trim().split(/\s+/)[0] || "there";

function button(href, label) {
  return `<a href="${escapeHtml(href)}" style="display:inline-block;background:#0b7a2a;color:#ffffff;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:8px;">${escapeHtml(label)}</a>`;
}

// Simple, email-client-safe layout (tables + inline styles).
function layout(bodyHtml) {
  return `<!doctype html><html><body style="margin:0;padding:0;background:#f6f2e8;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f2e8;padding:24px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;font-family:Arial,Helvetica,sans-serif;color:#172317;">
<tr><td style="background:#0c1f13;padding:18px 24px;color:#ffffff;font-size:18px;font-weight:700;">${escapeHtml(business.name)}</td></tr>
<tr><td style="padding:24px;font-size:15px;line-height:1.55;">${bodyHtml}</td></tr>
<tr><td style="padding:16px 24px;background:#f3f4f1;color:#5c6b5f;font-size:12px;line-height:1.5;">
${escapeHtml(business.owner)}, Owner &middot; License #${escapeHtml(business.license)}<br>
${escapeHtml(business.address)}<br>
${escapeHtml(business.phone)} &middot; ${escapeHtml(business.email)}
</td></tr>
</table>
</td></tr></table>
</body></html>`;
}

function paymentHtml(doc) {
  const { zelle, venmo } = business.payment;
  const venmoUrl = business.venmoPayUrl(doc);
  const lines = [];
  if (zelle && zelle.to) lines.push(`<li><strong>Zelle:</strong> ${escapeHtml(zelle.to)}${zelle.name ? ` (${escapeHtml(zelle.name)})` : ""}</li>`);
  if (venmo) lines.push(`<li><strong>Venmo:</strong> ${venmoUrl ? `<a href="${escapeHtml(venmoUrl)}" style="color:#0b7a2a;">@${escapeHtml(venmo.username)}</a>` : ""}${venmo.phone ? ` (${escapeHtml(venmo.phone)})` : ""}</li>`);
  lines.push(`<li><strong>Check or cash:</strong> payable to ${escapeHtml(business.name)}</li>`);
  const venmoButton = venmoUrl
    ? `<p style="margin:16px 0 4px;"><a href="${escapeHtml(venmoUrl)}" style="display:inline-block;background:#008cff;color:#ffffff;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:8px;">Pay ${money(doc.total)} with Venmo</a></p>`
    : "";
  return `<p style="margin:18px 0 6px;"><strong>How to pay</strong></p>${venmoButton}<ul style="margin:8px 0 0;padding-left:20px;">${lines.join("")}</ul>`;
}

function paymentText(doc) {
  const { zelle, venmo } = business.payment;
  const venmoUrl = business.venmoPayUrl(doc);
  const lines = ["How to pay:"];
  if (zelle && zelle.to) lines.push(`- Zelle: ${zelle.to}${zelle.name ? ` (${zelle.name})` : ""}`);
  if (venmo) lines.push(`- Venmo: @${venmo.username}${venmo.phone ? ` (${venmo.phone})` : ""}${venmoUrl ? ` - pay here: ${venmoUrl}` : ""}`);
  lines.push(`- Check or cash: payable to ${business.name}`);
  return lines.join("\n") + "\n";
}

function documentEmail(doc, { approvalUrl } = {}) {
  const isProposal = doc.type === "proposal";
  const label = isProposal ? "Proposal" : "Invoice";
  const subject = `${label} #${doc.number} from ${business.name}`;
  const intro = isProposal
    ? `Thank you for considering ${escapeHtml(business.name)}. Your proposal for <strong>${money(doc.total)}</strong> is attached.`
    : `Thank you for choosing ${escapeHtml(business.name)}! Your invoice for <strong>${money(doc.total)}</strong> is attached.`;
  const action = isProposal && approvalUrl
    ? `<p style="margin:20px 0;">You can review and approve it online:</p><p style="margin:0 0 8px;">${button(approvalUrl, "Review & Approve Proposal")}</p>`
    : "";
  const html = layout(`
<p style="margin:0 0 14px;">Hi ${escapeHtml(firstName(doc.client_name))},</p>
<p style="margin:0 0 14px;">${intro}</p>
${action}
${isProposal ? "" : paymentHtml(doc)}
<p style="margin:20px 0 0;">Questions? Just reply to this email or call <a href="${business.phoneHref}" style="color:#0b7a2a;">${escapeHtml(business.phone)}</a>.</p>
<p style="margin:14px 0 0;">${escapeHtml(business.owner)}<br>${escapeHtml(business.name)}</p>`);
  const text = [
    `Hi ${firstName(doc.client_name)},`,
    "",
    `${label} #${doc.number} from ${business.name} for ${money(doc.total)} is attached.`,
    isProposal && approvalUrl ? `Review and approve it here: ${approvalUrl}` : "",
    "",
    isProposal ? "" : paymentText(doc),
    `Questions? Reply to this email or call ${business.phone}.`,
    business.owner,
  ].join("\n");
  return { subject, html, text };
}

function reviewEmail(doc) {
  const subject = `Thank you from ${business.name}`;
  const html = layout(`
<p style="margin:0 0 14px;">Hi ${escapeHtml(firstName(doc.client_name))},</p>
<p style="margin:0 0 14px;">Thank you for your payment and for trusting us with your trees. We really appreciate your business!</p>
<p style="margin:0 0 14px;">If you were happy with our work, would you take a minute to leave us a Google review? It helps a small family business like ours more than you know.</p>
<p style="margin:20px 0;">${button(business.reviewUrl, "Leave a Google Review")}</p>
<p style="margin:14px 0 0;">Thank you again,<br>${escapeHtml(business.owner)}<br>${escapeHtml(business.name)}</p>`);
  const text = `Hi ${firstName(doc.client_name)},\n\nThank you for your payment and for trusting us with your trees!\n\nIf you were happy with our work, would you leave us a Google review? ${business.reviewUrl}\n\nThank you again,\n${business.owner}\n${business.name}`;
  return { subject, html, text };
}

function reminderEmail(doc) {
  const subject = `Friendly reminder: Invoice #${doc.number} from ${business.name}`;
  const html = layout(`
<p style="margin:0 0 14px;">Hi ${escapeHtml(firstName(doc.client_name))},</p>
<p style="margin:0 0 14px;">Just a friendly reminder that invoice <strong>#${doc.number}</strong> for <strong>${money(doc.total)}</strong> is still open. If you've already paid, thank you, and please ignore this note!</p>
${paymentHtml(doc)}
<p style="margin:20px 0 0;">Questions? Reply to this email or call <a href="${business.phoneHref}" style="color:#0b7a2a;">${escapeHtml(business.phone)}</a>.</p>
<p style="margin:14px 0 0;">${escapeHtml(business.owner)}<br>${escapeHtml(business.name)}</p>`);
  const text = `Hi ${firstName(doc.client_name)},\n\nJust a friendly reminder that invoice #${doc.number} for ${money(doc.total)} is still open. If you've already paid, thank you, and please ignore this note!\n\n${paymentText(doc)}\nQuestions? Reply to this email or call ${business.phone}.\n${business.owner}`;
  return { subject, html, text };
}

function approvalNoticeEmail(doc, adminUrl) {
  const subject = `Proposal #${doc.number} approved by ${doc.approved_name}`;
  const html = layout(`
<p style="margin:0 0 14px;"><strong>${escapeHtml(doc.client_name)}</strong> approved proposal <strong>#${doc.number}</strong> for <strong>${money(doc.total)}</strong>.</p>
<p style="margin:0 0 14px;">Signed as: ${escapeHtml(doc.approved_name)}</p>
<p style="margin:20px 0 0;">${button(adminUrl, "Open Admin")}</p>`);
  const text = `${doc.client_name} approved proposal #${doc.number} for ${money(doc.total)}. Signed as: ${doc.approved_name}. ${adminUrl}`;
  return { subject, html, text };
}

module.exports = {
  EmailNotConfiguredError,
  isEmailConfigured,
  sendEmail,
  documentEmail,
  reviewEmail,
  reminderEmail,
  approvalNoticeEmail,
};
