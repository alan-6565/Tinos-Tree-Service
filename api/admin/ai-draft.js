const Anthropic = require("@anthropic-ai/sdk");
const { betaZodOutputFormat } = require("@anthropic-ai/sdk/helpers/beta/zod");
const { z } = require("zod");
const { requireAuth } = require("../../lib/auth");

// Turns Tino's quick note (English or Spanish, e.g. "Robert 925-330-8983,
// cut 4 oaks away from the house, $1800") into a filled-in invoice/proposal
// with professional English wording. Nothing is saved or sent here: the
// admin page fills the form so Tino can review it first.

const DraftSchema = z.object({
  docType: z.enum(["invoice", "proposal"]).describe("proposal if the work is quoted/not done yet, otherwise invoice"),
  client: z.object({
    name: z.string().describe("Client full name, properly capitalized; empty if not given"),
    address: z.string().describe("Client mailing/service address, formatted like '2600 Mission Bell Dr, San Pablo, CA 94806'; empty if not given"),
    email: z.string().describe("Client email, lowercase; empty if not given"),
    phone: z.string().describe("Client phone formatted (XXX) XXX-XXXX; empty if not given"),
  }),
  jobs: z.array(z.object({
    date: z.string().describe("Work date YYYY-MM-DD, or empty if not mentioned"),
    endDate: z.string().describe("Last day YYYY-MM-DD for multi-day work, otherwise empty"),
    address: z.string().describe("Job site address only if different from the client address, otherwise empty"),
    tasks: z.array(z.string()).describe("Each piece of work as its own professional line item in English"),
    price: z.number().describe("Price for this job in US dollars; 0 if not given"),
  })).describe("One entry per job/visit. Usually one job unless the note clearly describes separate visits or separate prices"),
  notes: z.array(z.string()).describe("Short plain-English reminders for Tino about anything missing or unclear (e.g. 'No email given, so it can't be emailed'). Empty if everything is clear"),
});

const SYSTEM_PROMPT = `You write invoices and proposals for Tino's Tree Service, a family-owned, licensed tree care company in the East Bay (Richmond, CA). The owner, Tino, types quick notes from his phone, often in Spanish or informal English, with typos. Turn each note into a clean document.

How to write the work items:
- Always write in clear, professional US English, even when the note is in Spanish.
- One line item per distinct piece of work, starting with a verb: "Remove four oak trees growing too close to the house", "Prune three trees in the front yard", "Grind stump and haul away all debris".
- Use correct tree names when you can tell (encino = oak, eucalipto = eucalyptus, pino = pine, palma = palm, cedro = cedar).
- Keep the facts Tino gave: counts, locations, tree types. Do not invent work, prices, measurements, or guarantees he didn't mention. Mentioning cleanup or haul-away is fine only if he said it.
- Keep each line short enough to read at a glance.

Other fields:
- If he gives one total price for everything, use one job with that price.
- Only fill client details that are in the note. Fix obvious capitalization and formatting, but never guess an email or phone number.
- Use the date he mentions ("today", "yesterday", "el lunes") relative to the current date given with the note.
- Choose "proposal" when he is quoting work that hasn't been done ("estimate", "cotización", "would cost", "propuesta"); otherwise "invoice".
- Add a note for anything important that's missing, such as no price or no client name.`;

const client = new Anthropic();

module.exports = async function handler(req, res) {
  if (!requireAuth(req, res)) return;
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    res.status(503).json({ error: "The AI helper isn't set up yet. Add ANTHROPIC_API_KEY in Vercel to turn it on." });
    return;
  }

  const body = req.body || {};
  const note = String(body.note || "").trim().slice(0, 4000);
  if (note.length < 5) {
    res.status(400).json({ error: "Type a few details about the job first." });
    return;
  }
  const today = /^\d{4}-\d{2}-\d{2}$/.test(body.today || "") ? body.today : new Date().toISOString().slice(0, 10);
  const preferredType = body.docType === "proposal" ? "proposal" : body.docType === "invoice" ? "invoice" : null;

  try {
    const response = await client.beta.messages.parse({
      model: "claude-opus-5-5",
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low", format: betaZodOutputFormat(DraftSchema) },
      system: SYSTEM_PROMPT,
      messages: [{
        role: "user",
        content: `Today's date: ${today}${preferredType ? `\nTino selected: ${preferredType} (use this unless the note clearly says otherwise)` : ""}\n\nTino's note:\n${note}`,
      }],
    });

    if (response.stop_reason === "refusal" || !response.parsed_output) {
      res.status(422).json({ error: "The AI couldn't make a document from that note. Try adding a bit more detail." });
      return;
    }
    res.status(200).json({ draft: response.parsed_output });
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) {
      res.status(429).json({ error: "The AI is busy right now. Wait a minute and try again." });
    } else if (err instanceof Anthropic.AuthenticationError) {
      res.status(503).json({ error: "The AI key in Vercel isn't valid. Check ANTHROPIC_API_KEY." });
    } else if (err instanceof Anthropic.APIError) {
      console.error("AI draft failed:", err.status, err.message);
      res.status(502).json({ error: "The AI had a problem. Please try again." });
    } else {
      console.error("AI draft failed:", err);
      res.status(500).json({ error: "Something went wrong. Please try again." });
    }
  }
};
