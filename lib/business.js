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
  payment: {
    zelle: "", // e.g. "(510) 932-3088" or an email
    paypal: "", // e.g. "https://paypal.me/yourname"
  },
};
