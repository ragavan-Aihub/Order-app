---
dest: docs/pdf/Business-Guide.pdf
document_title: Ordering App Business Guide
pdf_options:
  format: A4
  margin: 22mm 16mm 22mm 16mm
  printBackground: true
  headerTemplate: '<div></div>'
  footerTemplate: '<div style="font-size:9px;width:100%;text-align:center;color:#71717a;font-family:Arial,sans-serif;">Business Guide &middot; Page <span class="pageNumber"></span> of <span class="totalPages"></span></div>'
---

<div class="cover">

# Ordering App: Business Guide

<p class="subtitle">How the customer app and the admin panel work, written for the business owner, staff and product managers.</p>

<p class="meta">Version 1.2 &middot; Last updated 29 October 2026</p>

</div>

## Contents

1. [About the ordering app](#1-about-the-ordering-app)
2. [Important words](#2-important-words)
3. [The customer app](#3-the-customer-app)
4. [The admin panel](#4-the-admin-panel)
5. [All business rules in one place](#5-all-business-rules-in-one-place)
6. [Frequently asked questions](#6-frequently-asked-questions)

### Who this guide is for

- **Business owner:** to understand everything the product can do today.
- **Shop staff:** to handle orders, payments, products and customers every day.
- **Product managers:** to see the rules and the limits.

You do not need any technical knowledge to read this guide. For technical details, see the separate **Technical Guide**.

## 1. About the ordering app

This is an online ordering system for a small business that takes orders and delivers them to the customer's home, for example a food, grocery or home products business. It has two parts:

| Part | Who uses it | Where it runs |
|---|---|---|
| **Customer app** | Customers | Android phone (installed as an app) |
| **Admin panel** | Business owner and staff | Web browser on a laptop or phone |
| **Delivery app** (optional) | Shop staff who deliver orders | Android phone (installed as an app) |

The customer app carries **your** business name, logo, home banner, products and prices, so the same system can serve any business. You manage products, prices, orders and customers in the admin panel. The delivery app uses the **same admin login** (email and password) for staff on the road.

The delivery app is optional. Many shops run deliveries from the admin panel only; use the delivery app when drivers need a phone-first list, maps links, swipe-to-advance status, and UPI QR at the door.

Both parts share one online database. When a customer places an order in the app, it appears in the admin panel at once. When the shop changes the order status in the admin panel, the customer sees it in the app.

**How an order flows:**

```
 Customer app                      Admin panel
 ------------                      -----------
 1. Browse products
 2. Add to cart
 3. Place order  --------------->  4. New order appears (status: Placed)
                                   5. Shop confirms        (Confirmed)
                                   6. Shop sends it out    (Out for delivery)
                                   7. Shop delivers it     (Delivered)
                                   8. Shop records payment (Cash or UPI)
 Customer sees every step  <-----
 with date and time
```

**Payment:** customers pay on delivery, by cash or UPI. There is no online payment inside the app.

## 2. Important words

| Word | Meaning |
|---|---|
| **Order number** | A 6-digit number for each order, for example #100058. It starts at 100001 and goes up by one. |
| **Status** | Where the order is now: Placed, Confirmed, Out for delivery, Delivered or Cancelled. |
| **Open order** | An order that is still **Placed** or **Confirmed**. Customers can modify open orders. They can cancel only while the order is Placed. |
| **Modify** | The customer changes an open order: adds items, removes items or changes quantities. |
| **Modify limit** | A customer can modify one order at most 5 times. Shop edits to items do not count toward this limit. |
| **Shop modified** | The shop changed items on an open order. The customer sees a tag until they review what changed. |
| **Coming soon** | A product that customers can see, but cannot buy yet. It shows dimmed with "Coming soon". |
| **Active / Inactive** | Active products show in the app. Inactive products are hidden from the app. |
| **Outstanding** | An order that is delivered but not yet paid. |
| **Refund pending / Refunded** | For a paid order that was later cancelled: the money still has to be returned, or it has been returned. |
| **Channel** | How an order came in, for example from the App or entered by the shop as Phone / Offline. |
| **Source** | How a customer first reached you, for example App or Phone / Offline. |
| **Community** | An optional group of delivery addresses (for example, one apartment complex). Only the shop sees it. Customers never see communities. |
| **Category** | An optional group of products (for example, Sweets, Spices, Oils). Customers see categories as filters on Home. |
| **OTP** | One Time Password. A 6-digit code sent by SMS to sign in. |
| **IST** | India Standard Time. All "today" figures in the admin panel use IST. |

## 3. The customer app

### 3.1 Signing in

**What it does:** customers sign in with their mobile number. There is no password.

**Steps for the customer:**

1. Open the app. The welcome screen shows your logo, business name and description.
2. Enter the 10-digit mobile number (the +91 is already shown).
3. Tap **Continue**. An SMS with a 6-digit OTP arrives.
4. Enter the OTP and tap **Verify**. If the SMS does not come, tap **Resend OTP**.

**Rules:**

- A customer can tap **Skip** on the first screen and browse products without signing in. Sign-in is needed later, when they add an address, open **Orders** or **Order again**, or place an order.
- When a customer signs in for the first time, they are added automatically to your **Customers** list in the admin panel, with the source **App**.
- If OTPs are requested too often, the app says: "Wait about a minute, then request a new OTP."

### 3.2 Delivery addresses

**What it does:** customers save up to 3 delivery addresses and choose one for each order.

**Address details the customer enters:**

- Flat / House No. / Building / Block No. (required)
- Area / Street / Village (required)
- Landmark (optional)
- Pincode (6 digits, required). **City** and **State** fill in automatically from the pincode.
- Label: **Home**, **Work** or **Other**
- Receiver's name and receiver's phone number (required)

**How to switch the delivery address:** tap the address at the top of the Home screen or the Cart screen. A sheet called **Deliver to** opens. Tap an address. The sheet closes and the new address is used straight away.

**Rules:**

- Maximum 3 saved addresses per customer. To add a fourth, delete one first.
- The chosen address becomes the customer's **default address**. It is remembered for the next time.
- Addresses can be edited or deleted from **Saved addresses** (open it from the address sheet with **Manage saved addresses**, or from Account).
- Delivery instructions cannot be typed by the customer in this version. The shop can add delivery instructions to a customer's address in the admin panel.

### 3.3 Shopping

**Bottom tabs:** **Home**, **Order again**, and **Orders**. There is no Cart tab; the cart opens from the floating **View cart** bar.

**Home screen** (top to bottom):

1. The delivery address, and the customer's initial (tap it to open **Account**).
2. The **Modifying order** bar, only when the customer is changing an existing order (see 3.6).
3. Optional **Order by Voice** card, only when the developer turns voice ordering on for this build.
4. A search box: **Search products** (searches names and descriptions).
5. Category chips (**All**, then each category with its picture), only if you use categories. This row **stays fixed under search** while the customer scrolls products. Swipe sideways when there are many categories.
6. Your home banner picture, if you set one (scrolls with the product list).
7. All products in a grid of **2 per row**. Each card shows the picture, name, price and an **Add** button. After adding, the button becomes a **- / +** stepper.

**Coming soon products** show dimmed with the words "Coming soon". They can show a **Notify me** button instead of Add. They appear at the end of the list.

**Tapping a product** does not open a product detail page in this version.

**Order again tab:** shows products from the customer's last 10 orders (cancelled orders are not counted). It uses the same 2-per-row grid and has its own search box. It is a quick way to repeat a usual order.

**View cart bar:** when the cart has items, a green **View cart** bar floats at the bottom with the item count.

### 3.4 The cart

**What the customer sees:**

- **Deliver to** with the chosen address at the top. Tap it to change the address.
- Each item with picture, name, price per piece, line total and a **- / +** stepper.
- **Clear cart** button (asks first: "This will remove all items from your cart. This cannot be undone.").
- **Add more items**, which goes back to Home.
- **Bill summary** with the item total and **To pay**.
- The note **Pay on delivery · Cash or UPI**.
- The **Place order** button.

**How to remove an item:** swipe the item to the left and tap the red bin, or reduce the quantity below 1.

**Limits:**

- Up to **15 different products** in one order. Message: "You can add up to 15 items in one order. Remove an item to add another."
- Up to **10 of each product**. Message: "You can order a maximum of 10 of each product."

### 3.5 Placing an order

**Steps:**

1. Check the address at the top of the cart.
2. Tap **Place order**.
3. The **Order status** screen opens with the order number, "Thank you! Your order is placed.", the total to pay, where it will be delivered (for example "Delivering to · Home") and the order progress.

**Rules:**

- The customer must be signed in and have an address.
- The customer must be online to place an order.
- If a product became "Coming soon" after it was added, the app asks the customer to remove it first.

### 3.6 One open order per address

**The rule:** each address can have only **one open order** (Placed or Confirmed) at a time. This avoids two separate deliveries to the same house on the same day.

**What happens when a customer tries to start a second order for the same address:**

- When they tap **Add** on a product, or open the cart, the app shows the **New order** screen: "Where should we deliver your new order?"
- For the address that already has an open order, it shows "Active order #N · Placed/Confirmed" and a **View / Modify order** button, with the hint "You can modify this order until it goes out for delivery."
- Other addresses show **Deliver here**. The customer can also **Add new address**.

**Customers with two addresses** can have two open orders, one for each address. When they tap Modify on an order, the app switches to that order's address automatically.

**Orders that are out for delivery do not block a new order.** For that address the screen shows "An order is on its way to this address" with a **View order** button and a **Deliver a new order here** link.

### 3.7 Modifying an order

**What it does:** the customer can change an open order: add products, remove products or change quantities.

**How to start:** tap **Modify** on the order in **Orders**, or **Modify order** on the order details screen or the Order status screen.

**What the customer sees:**

- The cart opens and scrolls down to **Add more items**, so they can add more straight away.
- A fixed bar at the top says **Modifying order #N**. It does not scroll away, so the customer always knows they are changing an existing order.
- On Home and Buy again, the same bar shows "Items you add go into this order".
- **New** items have a light green background and a **New** tag.
- Items with a changed quantity show a **Was 2** tag (the old quantity).
- Removing an item asks first: "Remove {name}? It will be taken off this order when you tap Update order."
- The button at the bottom says **Update order**. It stays disabled until something changes.

**Buttons in the Modifying order bar:**

| Button | What it does |
|---|---|
| **Discard** (shown only after a change) | Asks "Discard changes?", then puts the order back to how it was saved. The customer stays in the cart and can continue. |
| **Exit** | Leaves modify mode. If there are unsaved changes, it asks "Leave without saving? Your order stays as it was." |

**After tapping Update order:** the Order status screen shows "Order updated successfully".

**Rules:**

- Modify is allowed only while the order is **Placed** or **Confirmed**. Once it is **Out for delivery**, it is locked.
- Each order can be modified at most **5 times**. After that the app shows "Modify limit reached for this order." While the order is still Placed, it adds "You can still cancel it."
- If the shop marks the order Out for delivery (or cancels or delivers it) while the customer is still modifying, the app discards the changes and explains why, for example: "Order #N is out for delivery. Your changes were not saved. The order will arrive as originally placed."
- If the customer closes the app in the middle of modifying:
  - with changes, the app reopens the modify cart next time;
  - with no changes, the app forgets the modify cart.

### 3.8 Cancelling an order

**Steps:** in **Orders**, tap **Cancel** on the order. Or open the order and choose **Cancel order** from the "..." menu. Confirm with **Cancel order**.

**Rules:**

- Customers can cancel only while the order is **Placed**. Once the shop confirms it, the Cancel option disappears. The customer can still modify the order until it is Out for delivery, or call the shop to cancel.
- A customer can cancel at most **3 orders in 24 hours**. After that the app says "Cancel limit reached for today. Please contact the shop to cancel this order." Cancellations done by the shop do not count.
- These limits apply only to customers. The admin panel can cancel or change any order at any time.
- The reason is saved as "Customer requested". The customer is not asked to type a reason.
- Cancelling cannot be undone by the customer.

### 3.9 Your orders and order tracking

**Orders tab** (title **Your Orders**) shows the latest 40 orders. Each card shows:

- a plain-language status headline (for example **Order delivered**, **Out for delivery**, **Order placed**) with a small status icon;
- **Placed at** date and time;
- the order **total** and a menu icon (the whole card opens the order);
- up to four **product pictures** in a row (then **+N** if there are more);
- **Payment pending** (with a warning icon), **Refund pending**, or **Refunded** when that applies. Paid orders do not repeat a paid badge on the list;
- **Shop modified** when the shop changed that order and the customer has not yet opened **View changes** on the detail screen.

The **order number is not shown on the list**; it appears on the order detail screen only.

**Order details** (tap a card) shows **Modify order** and **Cancel order** (while Placed) when those actions are allowed:

- header **Order #…**, status, placed date and time, payment badge;
- **Order progress** as separate cards for **Placed, Confirmed, Out for delivery, Delivered**, each with date and time when recorded;
- **Deliver to** with receiver name and full address in a grey inset (no call or copy buttons on this screen);
- when the order is **Out for delivery** and payment is not yet recorded, an optional **Pay by UPI** block with your shop's **UPI QR** image (if the shop uploaded one);
- all items with quantities and the total;
- if the shop edited the order, a banner with **View changes** (added/removed items, quantity changes, old and new total). Payment status stays as it was; collect or refund any difference manually.

Note: older orders may show only the Placed time, because step times were not recorded for them at the time.

If the customer tries to update their cart while the shop changed the same order, the app asks them to refresh and review.

### 3.10 Account

The Account screen (tap the round initial on Home) shows:

- the customer's name and mobile number;
- the default delivery address, with **Change**;
- a link to **Orders**;
- **Sign out**.

### 3.11 Delivery app (optional, for shop staff)

**Who signs in:** staff use the **admin email and password** (same as the web admin panel), not customer OTP.

**Today's deliveries** screen:

- Tabs **To deliver (n)** and **Delivered today**.
- **To deliver** lists orders that are still **Placed**, **Confirmed**, or **Out for delivery** (same idea as **Pending delivery** in the admin panel).
- **Delivered today** lists orders marked **Delivered** today (IST), for an end-of-day check.

Each order card shows the customer, address, total, status, payment chip, and quick **Call** and **Map** actions.

**Order detail** on the delivery app:

- Swipe actions to move the order forward (**Confirm**, **Start delivery**, **Mark delivered**), with a short confirmation banner when appropriate.
- Customer, address, map preview, items, and payment.
- When marking **Delivered**, staff choose **Cash**, **UPI**, or **Not yet** (same rules as the admin panel).
- For **UPI**, staff can show the shop's **UPI QR** to the customer and upload or replace that QR image from the phone (stored once per business for the customer app and delivery app).
- If **admin** already moved the order forward (for example **Delivered** in the web panel), the delivery app **refreshes** and does not offer a duplicate deliver step; staff may only **record payment** if it is still outstanding.

Customers do not use the delivery app.

### 3.12 When there is no internet

- If the customer has opened the app before, products are saved on the phone. They can still browse, and the app shows "You're offline. Saved products stay in your cart."
- If there is no saved product list (first use with no internet), a full "You are Offline" screen appears with a **Reload** button.
- Placing an order, signing in and loading **Your Orders** need the internet.

## 4. The admin panel

### 4.1 Signing in

- Open the admin website (hosted on HTTPS, e.g. Vercel) and sign in with the **email and password** given by the developer.
- Only accounts set up as admin for this business can sign in. Customer accounts see "Not authorized".
- Use **Sign out** at the bottom of the menu when you finish on a shared computer.

**Menu (left side):** Dashboard, Orders, Reports, **Audit log**, Products, Customers. **Categories** opens from the Products page. **Communities** opens from the Customers page. On a phone, tap **Menu** at the top. Lists on Dashboard, Reports, and Orders show as **cards** on a small screen (tap to open an order). Use a laptop for heavy work such as product import.

### 4.2 Dashboard

The page opens with a greeting (Good morning, afternoon or evening) and today's date, then "What needs your attention today". "Today" means today in IST.

If any orders are still **Placed**, a teal banner at the top says how many are waiting to be confirmed. Tap it to open the Orders list already showing the **Placed** tab. It disappears when nothing is waiting.

| Card | What it shows |
|---|---|
| **Orders today** | Number of orders placed today, with an arrow showing how many more or fewer than yesterday, and yesterday's number. |
| **Sales today** | Value of today's orders, not counting cancelled orders. |
| **Delivered today** | Orders marked Delivered today. |
| **Outstanding** | Total amount of delivered orders that are not paid yet. Turns amber when above zero. Tap it to open the full list in Reports. |

Below the cards there is a one-line summary (for example "3 delivered orders are still unpaid, ₹1,250 outstanding"). It is amber when money is outstanding and green otherwise. Under it is the **Recent orders** table with the latest 8 orders.

### 4.3 Orders

#### Orders list

- **Status tabs** at the top: All, Placed, Confirmed, Out for delivery, Delivered, Cancelled, each with a count.
- **Search** by order number, customer name or phone.
- **Filters:** order status, payment status, payment method, channel, date From and To. If communities are on, also Type (Community or Individual) and Community.
- **Clear** removes all filters. **Export** downloads the filtered orders as a CSV file (opens in Excel or Google Sheets).
- 25 orders per page, with Previous and Next.

#### Order details

Open an order to see:

1. Order number, status, customer, item count, total, placed date and channel.
2. **Order status** panel (see below).
3. **Payment** panel (see below).
4. **Customer**: name, mobile, source, and a link to the customer's history.
5. **Delivery**: address, pincode and any order notes.
6. **Items** with quantity, price, subtotal and total.

#### Changing items on an open order

While the order is **Placed** or **Confirmed**, open the order and use **Modify order** on the Items section when a customer asks for a change (same rules as the customer app: not after Out for delivery or Delivered). Most orders are left as placed.

1. Tap **Modify order**. The items table switches to an editable list with product search.
2. Add, remove or change quantities.
3. Tap **Review & update**, check the totals, optionally add a short reason for the customer, then confirm **Update order**.
4. Tap **Cancel** to leave without saving.

Payment method and whether the order is paid do not change automatically. If the total went up or down, use the payment panel or collect/refund manually. The customer sees a **Shop modified** notice in the app with a before/after summary. These edits do not use up the customer's 5 self-service modifications.

#### Moving an order to the next status

The **Order status** panel shows the four steps with the date and time under each completed step. Use the green button for the next step:

| Current status | Button | Confirmation |
|---|---|---|
| Placed | **Confirm order** | "Confirm order #N?" |
| Confirmed | **Mark out for delivery** | "Mark order #N as Out for delivery?" |
| Out for delivery | **Mark as delivered** | "Mark order #N as Delivered?" |

- When you mark an unpaid order as Delivered, the app asks **Payment collected?** with **Cash**, **UPI** or **Not yet**. If you choose Not yet, the order shows as **Outstanding** until you record the payment.
- A delivered order shows "Order completed".
- The customer sees every status change in the app.

#### Fixing a status mistake

If you pressed the wrong button, open the **...** (More) menu and choose **Fix a status mistake**. Pick the correct status and tap **Save correction**. Use this only for mistakes, not for the normal next step.

#### Cancelling an order

Open the **...** menu and choose **Cancel order**. A reason is required:

- Customer requested
- Item unavailable
- Could not deliver
- Duplicate order
- Other (type a short note for the customer)

The customer sees the order as cancelled, with the reason. If the order was already paid, it becomes **Refund pending**.

#### Payment and refunds

| Situation | What you see | What to do |
|---|---|---|
| Not paid yet | **Collect ₹X** | Tap it, choose Cash or UPI, then **Mark paid**. |
| Delivered but not paid | Amber note: "Delivered but not paid yet. ₹X is outstanding." | Collect the money, then **Collect ₹X**. |
| Paid | "Paid ₹X by Cash/UPI" | If it was saved by mistake, use **...**, then **Change payment method**. You can switch Cash and UPI, or choose **Not yet** to mark it unpaid again. |
| Paid, then cancelled | **Mark ₹X refunded** | Return the money first, then tap it. |
| Refunded | "Refunded ₹X" | Nothing more to do. |
| Cancelled and never paid | Payment shows "Not Applicable" | Nothing to do. |

#### Creating an order for a customer (phone or in-person orders)

Use this when a customer orders by phone or in person.

1. Go to **Orders**, then **Create order**. Or open a customer and tap **Place order**.
2. **Customer:** search by name or phone (press space to see everyone), or choose **New customer** and enter name and 10-digit phone.
   - If the phone number already exists, a message says "Mobile number already exists" and offers **Load this customer**.
   - For a new customer, fill in the address and tap **Deliver to this address**. The form then shows the customer and address in the same compact style as an existing customer, with **Change** and **Discard**. The customer is not stored until you tap **Create order**. If the order cannot be created, the new customer is removed again.
3. **Delivery address:** use a saved address, or tap **Change / add address** to type one. A typed address is used for this order only. It is saved to the address book only for a brand-new customer.
4. **Products:** search by name (press space to list all), tap **Add**, set quantities. Inactive and Coming soon products cannot be added.
5. **Payment:** Cash, UPI or **Not yet** (default).
6. **Notes (optional):** shown with the delivery details.
7. Tap **Create order**.

Orders created here have the channel **Phone / Offline**. Prices always come from your product list.

### 4.4 Products

#### Products list

- Shows all products, **sorted by name (A to Z)**.
- **Search** by name, description or category.
- **Filters:** category (if categories are on) and status (All statuses, Active, Inactive).
- Each product has two controls:
  - **Active / Inactive / Delete** menu. Inactive hides the product from the app. **Delete** appears only for products that were never ordered. Products that are in old orders cannot be deleted; set them Inactive.
  - **Available / Coming soon** switch. Coming soon still shows the product in the app, dimmed, with no Add button.

#### Adding or editing a product

Tap **Add product**, or **Edit** on a product.

| Field | Rule |
|---|---|
| Product image | Required for new products. JPG, PNG, WebP or GIF, up to 5 MB. |
| Product name | Required, up to 120 characters. |
| Description | Optional, up to 500 characters. |
| Ingredients | Optional, up to 500 characters. |
| Price (₹) | Required. |
| Category | Optional, only if categories are on. |

New products start as **Active** and **Available**. Change those from the products list.

#### Importing many products from a spreadsheet (CSV)

1. On the Products page, tap **Export template** to download a sample file.
2. Fill one product per row. Columns: `name`, `description`, `price`, `image_path` (required), and `available`, `active`, `category` (optional, Yes or No for the first two).
3. Tap **Choose CSV**, then **Import CSV**.
4. The result shows "Imported N. Skipped M." Use **Download error log** to see which rows failed and why.

Rules: up to 250 products per file. The image file must be on the same computer where the admin panel is running, inside the user's home folder.

#### Categories (optional)

- Open from **Products**, then **Categories**.
- Categories are off by default. Tap **Enable Categories** to start using them.
- Each category needs a name (unique) and a picture. The picture is shown to customers.
- Each category can be Active or Inactive. Products can stay without a category.
- Customers see active categories as chips on the Home screen.

### 4.5 Customers

#### Customers list

- Shows app sign-ups and customers you added.
- **Search** by name, phone or address.
- Columns: customer, source, default address, number of saved addresses (out of 3), number of orders, last order.

#### Adding a customer

Tap **Add customer**. Enter name, 10-digit mobile, optional notes and optional address. Customers you add are saved with the source **Phone / Offline**. If the mobile number already exists, you are offered **Load this customer** instead.

#### Customer details

- **Place order**, **Edit** and **Delete customer** buttons. A customer with orders cannot be deleted.
- **Address book:** up to 3 addresses. You can **Edit**, **Remove**, **Set as Default** and add **delivery instructions** to each address.
- **Recent orders** for this customer.
- **Edit** lets you change the name, mobile, source and notes.

### 4.6 Communities (optional)

**What it is:** a way to group delivery addresses, for example all customers in one apartment complex. This helps you plan deliveries. **Customers never see communities.**

**How to use it:**

1. Go to **Customers**, then **Communities**, and tap **Enable Communities**.
2. Type a community name and tap **Create and manage customers**.
3. Search for a customer and tap **Map this address** on the right address. A customer with two addresses can have each address in a different community.
4. To move an address, tap **Move from {other community}**. To remove it, tap **Unmap**.

**Effects:**

- Orders show **Type** (Community or Individual) and the community name in lists, filters, exports and reports.
- Mapping an address also updates that customer's existing orders for the same pincode.
- An inactive community cannot receive new addresses.

### 4.7 Reports

Title: "Sales, collections, and outstanding payments for this period".

**Filters** (changes apply straight away, with "Applying filter..." while it loads):

- Date range: Today, Yesterday, Last 7 days, **Last 30 days** (default) or Custom From and To.
- Order status, payment status, payment method, channel and community.
- Customer name or phone.
- **Reset filters** goes back to the default.

**Summary cards:** Total orders, Total sales (without cancelled), Delivered sales, Amount collected, Outstanding amount.

**Outstanding section:** every delivered order that is not paid, with customer, phone, delivery time and amount. Use this list to follow up on payments.

**Orders section:** all matching orders, 25 per page.

Notes:

- Reports read up to 3,000 orders for one view. For longer periods, use smaller date ranges.
- To download data, use **Export** on the Orders list.

### 4.8 Audit log

Title: "Changes from the admin panel and delivery app".

Use this when you need a record of what changed: order status, products, customers, business settings, and delivery actions.

**Filters:** date range (default last 7 days), **app** (all, admin panel only, or delivery app only), area (orders, products, customers, and so on), and search on the summary text.

Each row shows **when**, **app** (admin panel or delivery app), **area**, and a short **summary**. Order-related lines link to that order. Shop edits to order items (quantities and totals) from the admin panel appear here even when no separate note was added.

## 5. All business rules in one place

| Area | Rule |
|---|---|
| Sign in | Customers sign in with mobile number and SMS OTP. Admins sign in with email and password. |
| Addresses | Up to 3 saved addresses per customer. The chosen one becomes the default. |
| Cart | Up to 15 different products, up to 10 of each. |
| Payment | Pay on delivery only, by cash or UPI. |
| Order number | 6 digits, starting at 100001, one series per business. |
| Open order | Placed or Confirmed. |
| One open order per address | A customer cannot place a second order to the same address while the first is still open. |
| Modify | Only open orders. At most 5 modifications per order. |
| Customer cancel | Only while Placed. At most 3 customer cancellations in 24 hours. Reason always saved as "Customer requested". |
| Shop cancel | Allowed from Placed, Confirmed or Out for delivery, with no daily limit. A reason is required. |
| Status steps | Placed, then Confirmed, then Out for delivery, then Delivered. Mistakes can be fixed with "Fix a status mistake". |
| Delivered and unpaid | Shows as Outstanding until payment is recorded. |
| Paid and cancelled | Becomes Refund pending. Mark refunded after returning the money. |
| Products | Inactive hides from the app. Coming soon shows dimmed, cannot be bought. Products in old orders cannot be deleted. |
| Images | JPG, PNG, WebP or GIF, up to 5 MB. |
| CSV import | Up to 250 products per file. |
| Customers | Mobile number must be unique. Customers with orders cannot be deleted. |
| Communities | Optional. Never shown to customers. |
| Categories | Optional. Shown to customers as a fixed chip row under search on Home. |
| UPI QR | Optional. One image per business for pay-at-delivery UPI; upload from the delivery app (customer sees it on order detail when out for delivery and unpaid). |
| Delivery app | Optional Android app for staff; admin login; delivery queue and swipe status updates. If admin already delivered the order, staff can only record payment. |
| Times | All "today" and date filters use India Standard Time. |

## 6. Frequently asked questions

**Why can't a customer modify their order?**
The order is no longer open (it is Out for delivery, Delivered or Cancelled), or it has already been modified 5 times. If the order is still Placed, the customer can cancel it instead.

**Why can't a customer cancel their order?**
Either the shop has already confirmed it (customers can cancel only while it is Placed), or the customer has cancelled 3 orders in the last 24 hours. The shop can cancel it from the admin panel.

**Why does the app say an order is already open for this address?**
Each address can have only one open order. The customer can modify that order, or choose or add another address.

**Why is a step time missing in the app?**
Older orders did not record step times. Also, the database update that lets customers see step times must be applied (the developer handles this).

**A customer paid, but the order shows Outstanding. What do I do?**
Open the order and use **Collect ₹X** to record Cash or UPI.

**I recorded a payment by mistake. Can I undo it?**
Yes. In the Payment panel, open **...**, then **Change payment method**, and choose the right method or **Not yet**.

**I moved an order to the wrong status. Can I fix it?**
Yes. Use **...**, then **Fix a status mistake**.

**Why can't I delete a product?**
It is part of at least one order. Set it to **Inactive** to hide it from the app.

**Why can't I delete a customer?**
The customer has orders. Keep the record for your history.

**A customer cannot get the OTP SMS. What can I do?**
Ask them to wait a minute and tap **Resend OTP**, and check that the number is correct. If many customers have this problem, tell the developer, because the SMS provider may need attention.

**Do customers see communities?**
No. Communities are only for the shop.

**What happens to a customer's cart if they lose internet?**
The cart stays on the phone. They can place the order when the internet is back.
