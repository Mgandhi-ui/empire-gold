# Empire Gold — website and sales back office

One Next.js app, two addresses:

| Address | What it is | Who uses it |
|---|---|---|
| **empiregoldmazgaon.com** | The project website: story, the tower floor by floor, homes, plans, location, specifications, site updates, enquiry form, broker application. **No prices, no commissions.** | Buyers, brokers, ads, QR codes |
| **back.empiregoldmazgaon.com** | Sign-in (email code) → the back office, the partner login and the buyer login | Sales team, admins, brokers, buyers |

Same stack as the Arrex sites: Next.js 14 on Vercel (Mumbai, `bom1`), Supabase Postgres reached only by the server
(row level security on, no policies), email codes through Resend.

## What it does

**Website** — enquiry form → lead in the back office, tagged with where the visitor came from (`?ref=meta`, `?ref=google`,
`?ref=hoarding`, or `utm_source`). Booked flats show as Booked on the floor picker. Meta Pixel + Conversions API on each enquiry.
Broker application form (MahaRERA agent number required).

**Back office (admin / staff)**
- Dashboard: homes left, sold, collected, demanded-not-received, brokerage to pay, follow-ups due, pipeline, which source produces visits and bookings.
- Leads: every source in one list; stages New → Contacted → Visit booked → Site visit done → Negotiation → Booked / Lost (with reason); notes and calls; next follow-up date. Same mobile within 90 days = same lead (a note is added, no duplicate).
- Inventory: the 35 flats by floor, status, holds with an end date, per-flat rate (rates live only here).
- Bookings (the "order of sale"): flat + buyer (customer ID `EGC-0001`…) + broker (`EGP-001`…) + agreement value + brokerage %. Booking IDs `EGB-0001`…
  Each booking has a payment schedule (construction-linked stages), demands, receipts, brokerage payouts, documents, and status
  Booked → Agreement registered → Possession offered → Keys handed over (or Cancelled, which frees the flat).
- Brokers: approve applications (sends the partner login), brokerage % per broker, earned / paid / due, pause a login.
- Broker prospects: paste lists (e.g. from the public MahaRERA agent register), track contacted / invited / joined, email an invitation.
- Buyers, site updates (photos; for buyers only or also on the website), settings, team.

**Partner login** — register a client (protected for 60 days; refused if we already know the number), see own clients' status,
own sales (flat, buyer first name + customer ID, status), brokerage earned, paid and due.

**Buyer login** — their flat, progress steps, payment schedule (what is due now), receipts, documents, construction updates.

**Meta**
1. Pixel (browser) + Conversions API (server) on each website enquiry, deduplicated by event ID.
2. Lead Ads: Instant Form fills arrive at `/api/meta/webhook` and become leads automatically (source = Meta ad, campaign / ad name kept).
3. Quality signals back to Meta: when a Meta lead reaches *Site visit done* or *Booked* (or is *Lost*), Meta is told, so the ads learn to find buyers, not form-fillers.

## Setting up (once)

1. **Supabase** — new project `empire-gold`, region Mumbai. SQL editor: open `db/001_schema.sql`, change the admin email on the
   last lines to yours, run it. (Safe to run again.)
2. **Vercel** — import this repository as a new project. Region is set to Mumbai by `vercel.json`.
3. **Environment variables** (Vercel → Settings → Environment Variables, Production):

   | Name | Value |
   |---|---|
   | `EG_DATABASE_URL` | Supabase → Connect → **Transaction pooler** URL |
   | `EG_SECRET` | any long random text (40+ characters) |
   | `RESEND_API_KEY` | from resend.com, after verifying empiregoldmazgaon.com there |
   | `MAIL_FROM` | `Empire Gold <noreply@empiregoldmazgaon.com>` |
   | `LEAD_ALERT_TO` | emails that get a note for every new lead / broker application, comma separated |
   | `NEXT_PUBLIC_SITE_URL` | `https://empiregoldmazgaon.com` |
   | `NEXT_PUBLIC_META_PIXEL_ID` | Meta Events Manager → your Pixel / dataset ID |
   | `META_PIXEL_ID` | the same ID |
   | `META_CAPI_TOKEN` | Events Manager → dataset → Settings → Conversions API → Generate access token |
   | `META_VERIFY_TOKEN` | any long random text; type the same in the Meta app's webhook setup |
   | `META_APP_SECRET` | Meta app → App settings → Basic → App secret |
   | `META_PAGE_TOKEN` | a long-lived Page access token with `leads_retrieval` and `pages_manage_metadata` |
   | `NEXT_PUBLIC_GA_ID` | optional, Google Analytics `G-…` |

4. **Domains** (Vercel → Settings → Domains): add `empiregoldmazgaon.com`, `www.empiregoldmazgaon.com` (redirect to the apex)
   and `back.empiregoldmazgaon.com`. At the domain registrar: `A` record for `@` → `76.76.21.21`; `CNAME` for `www` and
   `back` → `cname.vercel-dns.com`. (Vercel shows the exact records if they differ.)
5. **MahaRERA QR** — save the project QR code as `public/img/maharera-qr.png` and push; it replaces the placeholder in the header.
6. **Meta Lead Ads webhook** — in a Meta app (type Business) add *Webhooks* → *Page* → callback
   `https://back.empiregoldmazgaon.com/api/meta/webhook`, verify token = `META_VERIFY_TOKEN`, subscribe to `leadgen`;
   then subscribe the Empire Gold Facebook Page to the app. Test with Meta's *Lead Ads Testing Tool*: the test lead should
   appear in Leads within a few seconds.
7. **Ads and QR links** — point Meta ads to `https://empiregoldmazgaon.com/?ref=meta`, Google to `?ref=google`,
   the hoarding QR to `?ref=hoarding`, portals to `?ref=portal`.

## Daily use

- Sign in at back.empiregoldmazgaon.com with your email; a 6-digit code arrives by email.
- Add staff in **Settings → Team**. Brokers get access when you approve them; buyers when a booking is created with their email.
- Everything that moves money or ownership is written to the `audit` table.

## Local development

    npm install
    createdb eg && psql eg -f db/001_schema.sql
    EG_DATABASE_URL=postgres://localhost/eg EG_OTP_TEST=1 npm run dev

Website: http://localhost:3300 · back office: http://back.localhost:3300 (with `EG_OTP_TEST=1`, sign-in codes print in the terminal).
