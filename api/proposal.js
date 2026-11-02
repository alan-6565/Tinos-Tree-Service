const { getSupabase } = require("../lib/supabase");

// Public (no login) endpoint behind a proposal's approval link. The share
// token is the only key, so only safe, client-facing fields are returned.
const TOKEN_RE = /^[A-Za-z0-9_-]{20,64}$/;
const PUBLIC_FIELDS = "number, client_name, client_address, line_items, total, created_at, viewed_at, approved_at, approved_name";

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const token = req.method === "GET" ? req.query && req.query.t : req.body && req.body.t;
  if (!TOKEN_RE.test(token || "")) {
    res.status(404).json({ error: "Proposal not found" });
    return;
  }

  const supabase = getSupabase();
  const base = () => supabase.from("documents").select(PUBLIC_FIELDS).eq("share_token", token).eq("type", "proposal");

  if (req.method === "GET") {
    const { data, error } = await base().maybeSingle();
    if (error) {
      res.status(500).json({ error: "Could not load proposal" });
      return;
    }
    if (!data) {
      res.status(404).json({ error: "Proposal not found" });
      return;
    }
    if (!data.viewed_at) {
      await supabase.from("documents").update({ viewed_at: new Date().toISOString() })
        .eq("share_token", token).is("viewed_at", null);
    }
    res.status(200).json({ proposal: data });
    return;
  }

  if (req.method === "POST") {
    const name = String((req.body && req.body.name) || "").trim().slice(0, 100);
    if (name.length < 2) {
      res.status(400).json({ error: "Please type your full name to approve." });
      return;
    }
    const now = new Date().toISOString();
    await supabase.from("documents")
      .update({ approved_at: now, approved_name: name })
      .eq("share_token", token).eq("type", "proposal").is("approved_at", null);

    const { data, error } = await base().maybeSingle();
    if (error || !data) {
      res.status(error ? 500 : 404).json({ error: error ? "Could not approve proposal" : "Proposal not found" });
      return;
    }
    res.status(200).json({ proposal: data });
    return;
  }

  res.status(405).json({ error: "Method not allowed" });
};
