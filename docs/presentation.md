<!--
Project presentation. Source of truth for the slide deck.
When a customer or shop-facing behaviour changes, edit this file in the same change,
then run: npm run docs:presentation
Outputs: docs/pdf/Project-Presentation.pptx, plus HTML and PDF.
Open the PowerPoint in Keynote or PowerPoint. Speaker notes are on each slide.
-->

# A shop that takes orders from the phone

kicker: Farm2Flavour

Home delivery for a small shop. Customers order in an Android app. The shop runs the day from a website. Drivers can use a second phone app.

5 November 2026

???
Open with one sentence: customers order on the phone, the shop sees it at once, and they pay the person who delivers. This deck matches the product as it works today.

---

# Three tools, one shop

kicker: The product

| Tool | Who | Where |
|---|---|---|
| **Customer app** | People who order | Android phone |
| **Admin panel** | Owner and shop staff | Website, laptop or phone |
| **Delivery app** | Staff on the road | Android phone, optional |

They share one database. A new order shows in the admin panel as soon as the customer places it. A status change in the admin panel shows in the customer app, with the date and time.

???
The delivery app is optional. Many days the shop can run everything from the website. Use the delivery app when someone is out with a phone.

---

# The app wears the shop’s name

kicker: One product, any shop

The customer app is not locked to one logo drawn into the software.

- **Name, phone, address, and description** come from **Profile**.
- **Logo** is on the sign-in screen and on the delivery bill.
- **Welcome photo** is the wide picture on the sign-in screen only.
- **Home posters** are separate. They are set under **Announcements**.
- **Products, prices, and categories** come from the admin panel.

The phone’s home-screen icon is part of the installed app. A new icon needs a new install.

???
If we ever set this up for another shop, they change Profile, products, and posters. They do not get a new app design for each photo.

---

# From browse to paid

kicker: The order

1. The customer browses and adds items.
2. They place the order. Status is **Placed**.
3. The shop confirms. Status is **Confirmed**.
4. The shop sends it out. Status is **Out for delivery**.
5. The shop marks it delivered. Status is **Delivered**.
6. The shop records **Cash** or **UPI**.

Each step keeps a date and time. The customer sees the same steps.

???
Walk this slowly. Placed means waiting. Confirmed means the shop accepted it. Out for delivery means it is on the way. Delivered means it was handed over. Payment is a separate step.

---

# Pay the person who delivers

kicker: Payment

There is no card payment inside the app.

- Customers pay **cash** or **UPI** at the door.
- Until the shop records that payment, a delivered order stays **Outstanding**.
- If the shop uploaded a UPI code, the customer can see it when the order is on the way and not yet paid.
- If a paid order is cancelled, it becomes **Refund pending** until the shop marks the money returned.

???
Stress this if someone asks about online payment. The app does not take money. The shop records what was collected.

---

# How a customer gets in

kicker: Customer app

- A new visit shows the welcome screen: logo, shop name, description, and the welcome photo if one is set.
- They enter a 10-digit mobile number. The code arrives by text. There is no password.
- They can **Skip** and look at products first. Sign-in is required to save an address, open orders, or place an order.
- Someone who is already signed in opens straight on Home.
- The first sign-in adds them to **Customers**, with source **App**.

???
Skip is for looking, not for ordering. The text code is the sign-in.

---

# Home, then a full search screen

kicker: Customer app

**Browsing, top to bottom**

- Delivery address, and a round initial that opens Account.
- Search.
- Category chips, fixed under search, when categories are turned on.
- Home posters, a wide strip under the categories. More than one poster moves on its own.
- Products, two per row, with Add, then plus and minus.

**Search**

- Search fills the screen. A round back arrow sits beside the box.
- Categories stay and still filter the results.
- The posters hide so results have room, and they stay above the keyboard.
- Back clears the search and returns to Home.

???
Do not describe an old layout with a voice button or a banner above search. Posters sit under the categories. Search is its own screen.

---

# Posters and a closed shop

kicker: Customer app

**Posters**

- Shown only when Announcements are turned on.
- Up to 8. The shop crops each photo to the same wide frame the phone uses.
- A phone alert is sent only for a poster the shop switches on at publish time. The switch turns off after save, so a later save does not send it again.

**Shop closed**

- The home screen and the cart show the shop’s message.
- **Place order** is not available.
- An order that is already placed can still be updated.
- The shop can still type a phone or walk-in order on the website.

???
Closed means no new customer orders. It does not freeze orders that are already in. The website can still take a phone order.

---

# The cart

kicker: Customer app

- Address at the top. Tap it to change where this order goes.
- Up to **15 different products**, and up to **10 of each**.
- Clear cart asks before it empties the cart.
- The bill shows the total and **Pay on delivery · Cash or UPI**.
- The phone must be online to place the order.
- If a product became Coming soon after it was added, the customer has to remove it first.

???
The limits are there so one order stays a normal home delivery, not a bulk list.

---

# One open order for one address

kicker: Customer app

Each address can have only one **open** order. Open means Placed or Confirmed.

- A second order to that same address is offered as **View / Modify** on the order already there.
- A different saved address can have its own open order.
- A customer can save up to **3 addresses**.
- Once the first order is **Out for delivery**, a new order to that address is allowed.

???
This avoids two separate drops to the same house while the first order is still being prepared.

---

# Change it, cancel it, follow it

kicker: Customer app

**Change an open order**

- Add, remove, or change quantities, then **Update order**.
- A customer can update one order at most **5 times**. Shop edits do not use up that count.
- After the shop edits items, the customer can open **View changes**.

**Cancel**

- The customer can cancel only while the order is still **Placed**, and at most **3 times in a day**.
- After the shop confirms, the customer calls the shop. The shop can still cancel, and must give a reason.

**Follow**

- Your Orders shows the status. The order screen shows the number, items, address, and each step with its time.

???
If someone asks why a customer cannot cancel after confirm: the shop has already accepted it. Staff can still cancel from the website.

---

# Coming soon, and order again

kicker: Customer app

- **Inactive** products are hidden.
- **Coming soon** products stay visible, dimmed, and cannot be added. **Notify me** asks for a phone alert when that item can be ordered.
- **Order again** lists products from the customer’s recent orders, not from cancelled ones, so a usual order is quick to repeat.
- Tapping a product picture does not open a separate product page. The name, price, and Add button are on the card.

???
Notify me only reaches people who installed the app and allowed notifications.

---

# The shop’s website

kicker: Admin panel

Staff sign in with email and password. A customer phone login cannot open the shop website.

**Menu**

Dashboard, Orders, Reports, Audit log, Products, Customers, Profile, Announcements, Shop status.

**A normal day**

- Dashboard: orders today, sales today, delivered today, and money still outstanding.
- If orders are still Placed, a banner counts them and opens that list.
- Confirm, send out, mark delivered, then record Cash, UPI, or Not yet.
- A wrong status can be corrected. A cancellation needs a reason.
- Reports lists who still owes money. “Today” uses India time.

???
Outstanding is the follow-up list: delivered, not paid yet.

---

# Products and customers

kicker: Admin panel

**Products**

- Add a photo, name, and price. Active and available means the customer can buy it.
- Categories are optional. Customers see them as chips under search.
- A spreadsheet import handles up to 250 products at a time.
- A product that was already ordered is not deleted. Mark it Inactive to hide it.

**Customers**

- App customers appear on their own. Staff can also add a phone or walk-in customer.
- Up to 3 addresses, plus delivery notes the customer does not type themselves.
- Communities group addresses for the shop only. Customers never see the community name.

???
Communities are for the shop’s own sorting, for example one apartment. They are not a customer feature.

---

# Profile, posters, and shop status

kicker: Admin panel

**Profile**

- Logo, welcome photo, name, phone, email, and address.
- Save prints those details on the next delivery bill.
- The welcome photo is only for the sign-in screen.

**Announcements**

- Crop each poster in the wide frame. Publish to show it under the categories.
- Phone alert is off until the shop turns it on for that poster.

**Shop status**

- Open: customers can place orders.
- Closed: new customer orders stop, with the message the shop writes.
- Staff can still create an order on the website.

???
If a poster looks wrong on the phone, fit it again in Announcements and publish. Old crops were made for an earlier frame.

---

# The delivery phone

kicker: Delivery app

Same email and password as the website. Not a customer sign-in.

- **To deliver** shows what is still Placed, Confirmed, or on the way.
- Swipe through confirm, start delivery, and mark delivered.
- At the door, record Cash, UPI, or Not yet.
- After a delivery, the phone can share a one-page invoice on WhatsApp. The file name is the shop name and the order number. The app does not send it by itself.
- The bill uses the logo, phone, email, and address from Profile.
- If the website already marked the order delivered, the phone does not deliver it a second time. Staff can still record payment.

???
The bill is a share sheet. Someone still has to send it in WhatsApp. Not now skips it.

---

# What reaches the phone

kicker: Notifications

Only people who installed the app and allowed notifications.

- The order is confirmed, sent out, or delivered.
- A Coming soon item they tapped **Notify me** on is ready.
- A poster whose **Phone alert** was on when the shop published.

The shop’s WhatsApp contact list is not the same as this. The app cannot text that list.

???
If a customer says they got no alert, the usual cause is notifications are off for the app, or they have not installed it.

---

# What this version does not do

kicker: Out of scope

- No voice ordering, and no microphone permission.
- No card or in-app payment.
- No separate product page.
- No customer-typed delivery instructions. The shop can store those on the address.
- The delivery app is not on the Play Store. Staff install that app directly.
- The customer app’s store listing is still a release step, not something this deck treats as already live.

???
If someone asks for voice, say it is not in the app and it is not a switch we can turn on.

---

# How access is kept in bounds

kicker: Safety

- Customers prove the phone number with a text code. They see their own orders.
- Shop staff use an admin login. Anyone else is turned away.
- A closed shop is enforced in the database, including on an older installed app.
- Posters, the logo, and the welcome photo have to be pictures uploaded for this shop.
- Shop photos and the UPI code are public on purpose, so customers can see them.
- The app does not ask for the microphone.

???
Do not promise that nothing can ever go wrong. Say the important doors are locked: customer data, admin login, closed shop, and no microphone.

---

# Where it lives

kicker: For a technical listener

| Piece | Role |
|---|---|
| Customer app | Expo Android app. Talks to the database with the public client key. |
| Admin panel | Website. Staff actions run only after an admin sign-in. |
| Delivery app | Expo Android app. Same admin login as the website. |
| Database | Shared shop data, order rules, and file storage. |
| Text codes | Sent for sign-in. A practice number can use a fixed code and does not send a real text. |

Push alerts are sent by the server, not by the phone app holding a master key.

???
Skip this slide for a shop-only audience. Use it if a developer or a partner is in the room. Do not read out keys or passwords.

---

# What we tell people to try

kicker: Checking the product

The tester sheet is `docs/qa-test-cases.xlsx`. It is written for shop staff, not for engineers.

- Start at Step 1, admin sign-in.
- Do every must-pass row before a launch.
- Step 61 is one real order from the customer through payment.
- Newer rows cover posters, a phone alert, closing the shop, search, and the missing microphone.

The business guide and the technical guide are the long form of this deck.

???
Point at the Excel file if someone wants to click through it themselves. This slide is the map, not the test script.

---

# When the product changes, update this deck

kicker: Keep it true

This presentation is part of the project docs. It should describe what a customer and the shop can do today.

1. Edit `docs/presentation.md` in the same change as the feature.
2. Run `npm run docs:presentation`.
3. Open `docs/pdf/Project-Presentation.pptx` in PowerPoint or Keynote.

Speaker notes are saved on each slide. The HTML copy is for a browser: arrow keys move, **N** shows notes, **F** fills the screen.

Update the deck when someone would see or do something new: a screen, a rule, a menu, or a removed feature. A version number by itself does not need a new slide.

???
Leave this slide up if you are handing the project to someone else. The markdown file is the one to edit. The HTML and PDF are generated.
