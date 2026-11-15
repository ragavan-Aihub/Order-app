# QA test cases — by module

Workbook: **[qa-test-cases.xlsx](qa-test-cases.xlsx)**

Send that file. It has:

1. **How to use** — how to run and score a case.
2. **Index** — every module sheet with case counts (including P0).
3. **One sheet per module** — add future Sign-up (or Notifications, Orders, …) rows on that sheet only. Use a **new** Test case id.
4. **All cases** — the same rows in one list if you want to filter.

Source of the rows: [scripts/qa-test-case-rows.mjs](../scripts/qa-test-case-rows.mjs). Regenerating writes [qa-test-cases.csv](qa-test-cases.csv) and the Excel file:

```bash
npm run docs:qa-xlsx
```

### Columns

| Column | Meaning |
|--------|---------|
| **Seq** | On **All cases**, 1, 2, 3… through the whole book. On a module sheet, 1, 2, 3… for that module. |
| **Test case id** | Assigned in that same order: first admin row `TC-A-001`, first customer row `TC-O-001`, first delivery row `TC-D-001`. |
| **App category** | Admin panel, Order app, Delivery app, or cross-app |
| **Module** | Sheet name (Sign-up, Notifications, Orders, …) |
| **Type** | Happy, Negative, or Edge |
| **Priority** | **P0** must pass before launch · **P1** should pass · **P2** workaround exists · **P3** after Play Store or low risk |
| **Preconditions** | Who is signed in, shop open/closed, alerts on/off, order status |
| **Use case** | One sentence: what this check is for |
| **What to do** | Steps a non-technical person can follow |
| **What you should see** | How you know it passed |
| **Status** | Pass, Fail, Blocked, or Not started |

### First session

On **All cases**, filter **Priority** = P0. Always run customer **Google** and **email link** on **Sign-up**, **Notifications** P0 rows, and **End-to-end**. Use a **preview APK**, not a development build that asks for a Metro URL.

### Module sheets

Sign-up, Dashboard, Products, Categories, Customers, Home, Catalog, Cart, Orders, Payments, Notifications, Announcements, Shop status, Profile, Preferences, Reports, Audit, Communities, Account, Connectivity, Deliveries, Bill, Store review, End-to-end.
