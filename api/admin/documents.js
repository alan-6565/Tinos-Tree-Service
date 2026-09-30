const { requireAuth } = require("../../lib/auth");
const { getSupabase } = require("../../lib/supabase");

function computeTotal(jobs) {
  return jobs.reduce((sum, job) => sum + (Number(job.price) || 0), 0);
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Each job: its own date/range, optional address, a list of work items,
// and one price for the whole job. Stored in the line_items column.
function normalizeJobs(jobs) {
  if (!Array.isArray(jobs)) return [];
  return jobs
    .filter((job) => job && Array.isArray(job.tasks))
    .map((job) => ({
      date: DATE_RE.test(job.date) ? job.date : null,
      endDate: DATE_RE.test(job.endDate) ? job.endDate : null,
      address: job.address ? String(job.address) : null,
      tasks: job.tasks.map((t) => String(t).trim()).filter(Boolean),
      price: Number(job.price) || 0,
    }))
    .filter((job) => job.tasks.length > 0);
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
    const jobs = normalizeJobs(body.jobs);

    if (!body.clientName || jobs.length === 0) {
      res.status(400).json({ error: "Client name and at least one job are required" });
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
      line_items: jobs,
      total: computeTotal(jobs),
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
