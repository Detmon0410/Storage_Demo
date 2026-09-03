# User Manual — Liquor Import & Distribution System

*Warehouse Management System · Version 2.0 (Demo build)*
*Covers system state as of Phase 1 completion (2026-09-03): authentication is live; all screens below already existed and are now behind login.*

---

## 1. Signing In

1. Open the app in your browser. If you are not logged in, you're automatically sent to the **Sign in** page.
2. Enter your **Username** and **Password**, then click **Log in**.
3. Wrong username/password shows: *"Incorrect username or password. Please try again."*
4. **10 failed attempts** in a row temporarily locks out further tries for a few minutes (protects against password guessing) — you'll see *"Too many login attempts. Please wait a few minutes and try again."*
5. Once signed in, your session stays active across page refreshes — you don't need to log in again just from reloading the page.
6. If your session eventually expires, you'll see *"Your session has expired. Please log in again."* and be returned to the sign-in page.

**Default administrator account** (set up during system installation): username `admin`. The password is set during deployment — ask whoever installed the system if you don't have it. **Change this password after first login** if the system offers a way to, or ask your administrator.

### Signing Out

Click your user badge in the top bar, then **Log out**. This ends your session on this device; you'll need to log in again to continue.

---

## 2. Layout Overview

Once signed in, every screen shares the same layout:

- **Top bar** — app name, your username, and the logout control.
- **Side navigation**, grouped by area:
  - **Overview** — Dashboard
  - **Import** — Import Orders, Suppliers
  - **Product & Warehouse** — Products / SKU, Categories, Inventory Lots, Stock Transactions
  - **Compliance** — Licenses
  - **Sales & Distribution** — Customers, Sales Orders

Every list screen in this system follows the same pattern: a table of records, an **Add** button to create a new one, and **Edit**/**Delete** actions per row (some screens restrict edit/delete where noted below). Most tables can be filtered by status using a dropdown at the top.

---

## 3. Dashboard

**What it's for:** a real-time, one-screen snapshot of the whole business.

- **Alerts requiring action** — four cards flag anything that needs attention right now:
  - Licenses expiring within 30 days or already expired
  - Customers with credit risk (over their credit limit, or missing a valid license)
  - Products that are low or out of stock
  - Import orders flagged with an issue at the staging stage
- **KPI tiles** — Average Import Lead Time, Staging Error Rate, Total Stock Value, Licenses Expiring Soon, Monthly Tax/Duty Cost, Monthly Sales Total, Inventory Turnover, Aging Stock (Overdue), On-time Delivery Rate, Total Outstanding Credit.
- **Recent Import Orders** and **Recent Sales Orders** — quick lists with a "View all" link to the full screen.

> Note: dashboard figures are currently maintained manually rather than computed live from transactions — this is planned to change in a later phase.

---

## 4. Import Orders

**What it's for:** bringing new stock into the warehouse from a supplier.

- One import order can bring in **several different liquor products from the same supplier** in a single order.
- Every new order starts in **Staging** — nothing enters the warehouse until it's reviewed and moves through the pipeline:
  `Staging (Pending Review) → Pending Approval → Approved → Customs Cleared → Received into Warehouse`
  (or flagged as **Issue** if something like an ABV mismatch is found at staging).
- Click **Add** to create a new order: choose the supplier, add one or more line items (product + quantity + unit cost), and enter order details (order date, ETA, country, incoterms, customs entry number).
- Existing orders can be edited while still early in the pipeline; check the order's status before assuming you can change it.

---

## 5. Suppliers

**What it's for:** the manufacturers or trading partners you place import orders with.

- Add/edit supplier records: code, name, country, contact info, status (Active/Inactive).
- Only Active suppliers should normally be selected on a new import order.

---

## 6. Products / SKU

**What it's for:** your full liquor product catalog, with live sellable-stock status shown per product.

- Each product has a status: **Ready for Sale**, **Low Stock**, **Out of Stock**, or **Suspended**.
- Products are referenced by import orders, inventory lots, and sales orders — deleting a product that's already in use elsewhere may be restricted.
- Products belong to a **Category** (see below) for grouping/reference.

---

## 7. Categories

**What it's for:** grouping products for easier reference across the Products, Import Orders, and other screens (e.g. "Whiskey", "Wine", "Beer").

- Simple add/edit/delete — code, name, description.

---

## 8. Inventory Lots

**What it's for:** tracking actual physical stock at the lot/batch level — the total units on hand across all lots, plus which lots are aging (sitting too long) or overdue.

- Each lot can optionally be linked back to the import order that brought it in, for full traceability.
- Lot status: **Normal**, **Aging Soon**, or **Aging**.
- This is where "how much do we actually have, and where/when did it arrive" lives, separate from the product's summary stock number.

---

## 9. Stock Transactions

**What it's for:** the ledger of every stock movement — received (IN), issued (OUT), or adjustment.

- Recording a transaction here automatically updates the linked product's stock quantity.
- **Transactions cannot be edited after they're created**, to preserve an accurate history — if a transaction was wrong, delete it to reverse its effect (this itself is logged) rather than editing it.

---

## 10. Licenses

**What it's for:** tracking both **import licenses** (your own company's) and **customers' liquor sales licenses**, with automatic alerts 30 days before any license expires.

- License status: **Normal**, **Expiring Soon**, or **Expired**.
- Renewing a customer license: the current record is marked **Expired**, and a **new** license record is created and linked back to it — preserving full audit history rather than overwriting the old one.

---

## 11. Customers

**What it's for:** managing customer records, credit limits, and license status — this is what gets checked before a sales order can be confirmed.

- Each customer shows a **credit status**: Normal, Near Limit, Over Limit, or No License.
- A customer's license panel shows how many licenses are on file and their current status.
- Sales channel is tracked per customer: Distributor, Retail/Wholesale, Restaurant/Bar, or Online.

---

## 12. Sales Orders

**What it's for:** creating orders that ship one or more products to a customer, with automatic credit and license checks.

- Click **Add**, pick a customer, select their valid license, then add line items (product, quantity, unit price, discount).
- **Stock, credit, and license validity are checked automatically before the order saves** — you'll be blocked from confirming an order that would oversell stock, exceed the customer's credit limit, or use an invalid/missing license.
- Each order also tracks a **delivery status**: Pending Shipment, Shipping, Delivered, Returned, or Damaged.

---

## 13. What's Coming Next

This system is being hardened in phases. As of this manual, only **Phase 1 (Authentication)** is complete — every screen above already existed and now requires login, with every API request checked server-side. Planned next:

- **User roles & permissions** — six defined roles (System Admin, Manager/Approver, Import & Compliance Officer, Warehouse & Distribution Officer, Sales Officer, Finance/Accounting Officer), each with different screen/action access, plus a full audit trail of who did what and when.
- **Stronger backend rule enforcement** — license, stock, and credit rules checked no matter how a request reaches the server.
- **Lot/batch-accurate stock control** — inventory lots become the single source of truth for quantity.
- **A real approval workflow** — orders move through proper Draft → Pending Approval → Approved/Rejected states, with no one able to approve their own order.
- **Liquor tax & compliance data** — HS codes, excise, ABV, and permit/document tracking built into products and import orders.
- **Documents & reporting** — generated invoices, delivery notes, picking lists, and reports; dashboard figures computed live instead of maintained by hand.

This manual will be updated as each phase ships.

---

*Last updated: 2026-09-03*
