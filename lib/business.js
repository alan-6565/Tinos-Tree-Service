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
    venmo: "(510) 932-3088",
  },
};
