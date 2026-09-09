const { requireAuth } = require("../../lib/auth");
const { getSupabase } = require("../../lib/supabase");

function computeTotal(lineItems) {
  return lineItems.reduce((sum, item) => sum + (Number(item.price) || 0), 0);
}

module.exports = async function handler(req, res) {
  if (!requireAuth(req, res)) return;

  const supabase = getSupabase();

  if (req.method === "GET") {
    const { data, error } = await supabase
      .from("documents")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.status(200).json({ documents: data });
    return;
  }

  if (req.method === "POST") {
    const body = req.body || {};
    const type = body.type === "proposal" ? "proposal" : "invoice";
    const lineItems = Array.isArray(body.lineItems)
      ? body.lineItems
          .filter((item) => item && item.description)
          .map((item) => ({ description: String(item.description), price: Number(item.price) || 0 }))
      : [];

    if (!body.clientName || lineItems.length === 0) {
      res.status(400).json({ error: "Client name and at least one line item are required" });
      return;
    }

    const { data: numberData, error: numberError } = await supabase.rpc("next_document_number", {
      doc_type: type,
    });
    if (numberError) {
      res.status(500).json({ error: numberError.message });
      return;
    }

    const row = {
      type,
      number: numberData,
      client_name: body.clientName,
      client_address: body.clientAddress || null,
      client_email: body.clientEmail || null,
      client_phone: body.clientPhone || null,
      line_items: lineItems,
      total: computeTotal(lineItems),
    };

    const { data, error } = await supabase.from("documents").insert(row).select().single();
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.status(201).json({ document: data });
    return;
  }

  res.status(405).json({ error: "Method not allowed" });
};
