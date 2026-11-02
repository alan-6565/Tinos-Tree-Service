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

Files: `admin/` (UI), `api/admin/` (Vercel serverless functions: `login`, `logout`, `documents`), `lib/` (auth + Supabase client).

## Hosting & setup

Hosted on **Vercel**. Pushing to `main` deploys automatically.

1. **Database:** create a Supabase project and run `supabase-schema.sql` once in the SQL editor.
2. **Environment variables:** set these in Vercel (and in `.env.local` for `vercel dev`; see `.env.local.example`):
   - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
   - `ADMIN_PASSWORD`: shared password for `/admin`
   - `SESSION_SECRET`: long random string (`openssl rand -hex 32`)
3. **Local development:** `npm install`, then `vercel dev`.

## Updating gallery photos

Resize photos to about 1200px on the long side, save them as `images/work-N.jpg`, and add a `.gallery__item` block in `our-work.html`. The tag text (`Trimming`, `Removal`, `Cleanup`, `Emergency`) controls which filter shows the photo.
