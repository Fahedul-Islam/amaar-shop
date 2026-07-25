# Facebook Ad Tracking — Setup Guide

**Who this is for:** shop owners who run Facebook or Instagram ads.
**Time needed:** about 10 minutes, once.

---

## What this does

Right now Facebook shows your ad to people, but it never finds out which of them
actually bought from you. So it keeps guessing.

When you connect this, AmaarShop tells Facebook two things automatically:

| Event | When it is sent |
| ----- | --------------- |
| **Order placed** | A customer completes checkout on your shop |
| **Delivered** | The courier successfully delivers that parcel |

That second one is the important one. If Facebook only learns about *orders*, it
finds you more people who **place** orders — including the ones who refuse the
parcel at the door. When it learns about **deliveries**, it starts finding people
who actually take the product and pay you.

You do not need to install anything. No code, no plugin.

---

## Before you start

You need:

- A **Facebook Business account** (business.facebook.com) — free
- Access to **Events Manager** for your business
- To be an **admin** of the business, so you can generate a token

> If someone else (an agency or a friend) runs your ads and you cannot get into
> Events Manager, ask them to do Part 1 and send you the two values.

---

## Part 1 — Get your two values from Facebook

You are collecting **two things**: a *Dataset ID* and an *Access token*.

### Step 1. Open Events Manager

Go to **business.facebook.com/events_manager** and log in.

### Step 2. Find or create your dataset

Look at the left side for a list of data sources.

- **If you already see one** (it may be called a Pixel), click it.
- **If the list is empty**, click **Connect data sources** → choose **Web** →
  **Connect** → give it your shop's name → **Create**.

### Step 3. Copy the Dataset ID

With your dataset selected, the **Dataset ID** is a long number (around 15–16
digits) shown near the name, and also under the **Settings** tab.

📋 **Copy it somewhere safe — this is value #1.**

### Step 4. Generate the access token

1. Click the **Settings** tab for that dataset.
2. Scroll down to the **Conversions API** section.
3. Find **Generate access token** and click it.
4. A long code appears.

📋 **Copy it — this is value #2.**

> ⚠️ **Copy the token immediately.** Facebook shows it only once. If you lose it,
> generate a new one — that is completely safe to do.

---

## Part 2 — Connect it in AmaarShop

1. Open your dashboard → **Settings**.
2. Scroll to the **Facebook ad tracking** section.
3. Paste **Dataset ID** into *Pixel / Dataset ID*.
4. Paste the **token** into *Conversions API access token*.
5. Tick **Send conversions to Meta**.
6. Leave **Also report deliveries** ticked — this is the setting that makes your
   ads cheaper over time.
7. Click **Save tracking settings**.

The badge next to the section title should change to **Connected** ✅

> Your keys are stored securely and never shown again. To change one later, just
> paste a new value — leaving a field blank keeps what you already saved.

---

## Part 3 — Check that it is working

1. Ask a friend to place a small test order on your shop (or place one yourself).
2. Wait about a minute.
3. Go to **Profit & Ads** in your dashboard.
4. Look at the **Facebook ad tracking** panel.

You should see:

- A green **Working** badge
- **Conversions sent** counting up
- **Match quality** showing a percentage

You can also confirm on Facebook's side: in **Events Manager → your dataset →
Overview**, your events appear within a few minutes.

### What "Match quality" means

It shows how much information we could attach to each conversion — phone number,
name, city. The higher it is, the more of your sales Facebook can correctly
credit to the ad that caused them.

Yours should be high automatically, because your checkout always collects a phone
number and address. **If it drops below 50%**, it usually means customers are
entering very short or incomplete names.

---

## Part 4 — The step most people miss

Connecting is only half the job. Now **tell Facebook to optimise for deliveries.**

1. Go to **Ads Manager** and create a new campaign (or edit an existing one).
2. Choose the **Sales** objective.
3. In the ad set, under **Conversion event**, look for **OrderDelivered**.
4. Select it and publish.

> ⚠️ **OrderDelivered only appears in the list after Facebook has received at
> least one of them.** So deliver at least one order first, then come back.

If you leave it on *Purchase*, Facebook optimises for people who place orders —
refusals included. `OrderDelivered` is what makes it hunt for real, paying buyers.

### Be patient with the results

Facebook's system needs a steady stream of conversions before it learns. Expect
a few weeks, not a few days — and the more orders you get, the faster it improves.
Changing the conversion event restarts that learning, so don't switch it often.

---

## Troubleshooting

If something breaks, the exact reason appears in **Profit & Ads → Facebook ad
tracking**, in red.

| What you see | What it means | How to fix it |
| ------------ | ------------- | ------------- |
| `Invalid OAuth access token data.` | The token is wrong, expired, or was revoked | Generate a new token (Part 1, Step 4) and paste it again |
| `Unsupported post request` / *object does not exist* | Wrong Dataset ID | Re-copy the Dataset ID — it is the long number, not your page name or ad account ID |
| Badge says **Paused** | *Send conversions to Meta* is unticked | Tick it in Settings and save |
| **Failed** count rising | See the red message under the panel | Usually the token — regenerate it |
| Events stay **queued** | The sender runs every 30 seconds | Wait a minute; if they never clear, check the error message |
| Match quality is low | Customers entering incomplete details | Nothing to fix in setup — it reflects your checkout data |

---

## What is shared with Facebook

Honest summary, so you can answer customers if they ask:

**Sent, but encrypted (hashed) first — Facebook cannot read them:**
customer phone number, first and last name, city, division.

**Sent as plain values:**
order value in BDT, order reference, product IDs, and whether the order was placed
or delivered.

**Never sent:**
full delivery address, order notes, or your buying prices and profit.

Hashing is a one-way scramble: Facebook can only check whether a customer matches
someone it already knows — it cannot read the number or name itself.

> Because customer data is being shared with a third party, your shop's privacy
> policy should mention that you use Facebook advertising tools.

---

## Notes for the platform operator

- **No Meta App Review or Business Verification is required.** Each seller pastes
  their own dataset credentials, so there is no OAuth flow to get approved.
- **Deployment:** nothing to configure. Migration `000022` runs on startup and
  the dispatcher starts automatically. The backend needs outbound HTTPS to
  `graph.facebook.com`.
- **`META_GRAPH_BASE_URL`** overrides the Graph API endpoint (used for testing
  against a stub). Leave unset in production.
- **Delivery is out-of-band:** events are written to the `meta_events` outbox in
  the request path and sent by a background dispatcher every 30 seconds. A Meta
  outage can never slow down or fail a checkout.
- **Retries:** transient failures (5xx, rate limits) are retried up to 5 times;
  permanent ones (bad token) are parked immediately so quota is not wasted.
- **Test event codes** are supported by the API (`test_event_code` on
  `PUT /api/shops/me/meta-settings`) but are not yet exposed in the settings form.

### Endpoints

| Method | Path | Purpose |
| ------ | ---- | ------- |
| `GET` | `/api/shops/me/meta-settings` | Current setup (never returns secrets) |
| `PUT` | `/api/shops/me/meta-settings` | Save credentials; blank fields keep stored values |
| `GET` | `/api/shops/me/tracking-stats` | Delivery health + match quality |
| `GET` | `/api/shops/me/tracking-events` | Recent event log |
| `GET` | `/api/shops/me/funnel` | Shoppers → ordered → delivered |

All accept `?from=&to=` as `YYYY-MM-DD` **Bangladesh dates**, defaulting to the
last 30 days.
