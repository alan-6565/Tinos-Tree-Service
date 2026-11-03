// Business details used in client emails. Payment options are optional:
// leave a value empty and that line is left out of invoice emails.
module.exports = {
  name: "Tino's Tree Service",
  owner: "Juventino Crisostomo",
  license: "1094445",
  address: "2530 McBryde Ave, Richmond, CA 94804",
  phone: "(510) 932-3088",
  phoneHref: "tel:+15109323088",
  email: "juventinocrisostomo33@gmail.com",
  siteUrl: "https://www.tinostreeservice.net",
  reviewUrl: "https://share.google/BmWV8PMSILavNV3VV",
  // Shown on invoice emails and reminders. Leave a value empty to hide it.
  payment: {
    zelle: { to: "(510) 253-3887", name: "Meli Garcia Bautista" },
    venmo: { phone: "(510) 932-3088", username: "Juventino-Crusostomo" },
  },
};

// Venmo link that opens a payment to Tino with the amount and invoice number
// filled in (opens the Venmo app on phones).
module.exports.venmoPayUrl = function venmoPayUrl(doc) {
  const { venmo } = module.exports.payment;
  if (!venmo || !venmo.username) return null;
  const params = new URLSearchParams({ txn: "pay" });
  if (Number(doc.total) > 0) params.set("amount", Number(doc.total).toFixed(2));
  params.set("note", doc.number ? `Invoice #${doc.number}` : "Tino's Tree Service");
  return `https://venmo.com/${encodeURIComponent(venmo.username)}?${params.toString()}`;
};
