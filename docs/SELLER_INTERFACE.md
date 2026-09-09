# Seller interface organization

## Plan

Organize by what a seller needs to do, with one primary home for each feature.
Keep daily operations visible and make occasional setup available without
turning optional features into required tasks.

- **Daily work:** overview, orders, products, customers.
- **Business:** discount codes, sales reports, profit and ad spend, platform fees.
- **Shop settings:** shop details and images, delivery and payments, courier,
  optional ad tracking.

Categories belong under Products; reviews belong under Customers. Discount
codes have their own page, separate from delivery. The mobile navigation keeps
Overview, Orders, Products, and Customers visible and exposes the remaining
features through More.

## Changes

The overview shows actionable queues, a sales snapshot, and recent orders.
It does not sum overlapping order/payment counts, repeat low-stock products,
or continually promote Facebook setup. Empty and failed requests are distinct.

Shop details owns the name, description, contact information, images, and share
link. Delivery settings owns fees, payment timing, and payment accounts. Courier
and tracking configuration have dedicated pages. The previous setup-progress
score is removed: advance payment, branding, and ad tracking are optional, not
unfinished work. Products retain their individual delivery-payment exception,
with a link to the central delivery settings instead of duplicating fee tables.

Existing product, category, customer, review, and Facebook URLs remain available.
New routes are `/dashboard/discounts`, `/dashboard/settings/courier`, and
`/dashboard/settings/tracking`. Settings tabs and sidebar selection consistently
reflect the current section. Existing integration bookmarks using `#courier`,
`#meta`, or `#tracking` on the settings page forward to the matching page.

Backend permissions, checkout rules, and saved settings are unchanged by this
organization work.

## Sales and profit reports

Sales reports answer three questions: how many orders arrived, where those
orders stand now, and which products buyers ordered most. One Bangladesh date
window (order placement date) controls every section, including product ranks.
Delivered, outstanding, returned and cancelled values remain separate. Status
links open all orders in that status; their broader scope is stated explicitly.
The daily chart supports the preceding equal-length period and CSV download.
Daily counts include cancellations; daily order values exclude them. Product
rankings exclude cancellations but include returns and undelivered orders.
Order values are not represented as received cash.

Profit & ad costs has two views: Profit estimate and Advertising costs. The
estimate explains delivered order value minus saved buying costs minus recorded
ads. Missing cost snapshots hide the result instead of presenting inflated
profit. Buying-price edits apply to future orders, not historical snapshots.
Courier, packaging, platform fees and other expenses are outside this estimate.
Ad costs use spend dates, while orders use placement dates and current status;
this is neither a cash ledger nor attribution of sales to advertisements.

Actual advertising entry comes first. A date/platform entry replaces its prior
amount. Recurring daily estimates are optional and visibly identified; traffic
and technical Facebook tracking live in a collapsed advanced section. Loading,
failed requests, missing costs and an empty period have distinct messages.
