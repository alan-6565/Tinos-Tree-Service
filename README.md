# Tino's Tree Service

Website and admin tools for Tino's Tree Service, a family-owned, licensed and insured tree care business serving the East Bay (Richmond / Contra Costa County, CA).

Live site: https://www.tinostreeservice.net/

## What's here

### Public website
| Page | File |
|------|------|
| Home | `index.html` |
| Services | `services.html` (`pricing.html` redirects here) |
| Our Work (photo gallery with filters) | `our-work.html` |
| Request an Estimate | `signup.html` |

- Plain HTML, CSS (`styles.css`) and vanilla JS (`app.js`), no build step.
- The estimate form submits through [Web3Forms](https://web3forms.com) and is emailed to the business.
- SEO: page titles and descriptions, `LocalBusiness` JSON-LD, Open Graph share image (`images/og-share.jpg`), `sitemap.xml`, `robots.txt`.

### Admin tool (`/admin`)
Password-protected tool for creating **invoices** and **proposals**:
- Multiple jobs per document (date or date range, optional job address, work list, one price per job)
- Returning-client search (by name, phone, or email) to autofill client details
- Auto-numbered documents and a history list, stored in Supabase
- PDF export (still downloads, without a number, if the database is unreachable)
- Paid / Unpaid status for invoices, delete from History
- **Online proposal approval:** each proposal gets a private link (`/proposal.html?t=…`) where the client approves by typing their name; History shows Not opened / Viewed / Approved, and an approved proposal can be turned into an invoice in one click
- **Email (via [Resend](https://resend.com))**: send invoices/proposals with the PDF attached (right after generating or from History), thank-you + Google review request when an invoice is marked paid, an alert to the owner when a proposal is approved, and one automatic reminder for invoices still unpaid 7 days after being emailed (daily Vercel cron)

Business details and payment options shown in emails live in `lib/business.js`.

Files: `admin/` (UI), `api/admin/` (`login`, `logout`, `documents`, `send`), `api/proposal.js` (public approval link), `api/cron/reminders.js`, `lib/` (auth, Supabase client, email, business info).

## Hosting & setup

Hosted on **Vercel**. Pushing to `main` deploys automatically. The domain is registered through Netlify and its DNS is managed in Netlify DNS (records point to Vercel).

1. **Database:** create a Supabase project and run `supabase-schema.sql` once in the SQL editor.
2. **Environment variables:** set these in Vercel (and in `.env.local` for `vercel dev`; see `.env.local.example`):
   - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
   - `ADMIN_PASSWORD`: shared password for `/admin`
   - `SESSION_SECRET`: long random string (`openssl rand -hex 32`)
   - `RESEND_API_KEY`, `EMAIL_FROM`: email sending (the domain is verified in Resend; its DNS records are in Netlify DNS)
   - `CRON_SECRET`: protects the daily reminder job
3. **Local development:** `npm install`, then `vercel dev`.

## Updating gallery photos

Resize photos to about 1200px on the long side, save them as `images/work-N.jpg`, and add a `.gallery__item` block in `our-work.html`. The tag text (`Trimming`, `Removal`, `Cleanup`, `Emergency`) controls which filter shows the photo.
