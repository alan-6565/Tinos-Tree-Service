const { getSupabase } = require("../lib/supabase");
const business = require("../lib/business");

// Public (no login) endpoint behind an invoice's pay link. The share token
// is the only key, so only what the pay page needs is returned.
const TOKEN_RE = /^[A-Za-z0-9_-]{20,64}$/;

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  const token = req.query && req.query.t;
  if (!TOKEN_RE.test(token || "")) {
    res.status(404).json({ error: "Invoice not found" });
    return;
  }

  const { data, error } = await getSupabase()
    .from("documents")
    .select("number, client_name, total, created_at, paid_at")
    .eq("share_token", token)
    .eq("type", "invoice")
    .maybeSingle();
  if (error) {
    res.status(500).json({ error: "Could not load invoice" });
    return;
  }
  if (!data) {
    res.status(404).json({ error: "Invoice not found" });
    return;
  }

  const { zelle, venmo } = business.payment;
  res.status(200).json({
    invoice: {
      number: data.number,
      clientFirstName: String(data.client_name || "").trim().split(/\s+/)[0] || "",
      total: Number(data.total) || 0,
      createdAt: data.created_at,
      paid: Boolean(data.paid_at),
    },
    payment: {
      venmoUrl: business.venmoPayUrl(data),
      venmoUsername: venmo && venmo.username,
      zelleTo: zelle && zelle.to,
      zelleName: zelle && zelle.name,
      checksPayableTo: business.name,
      phone: business.phone,
    },
  });
};
