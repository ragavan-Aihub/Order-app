# QA test cases — share with a friend

Workbook: **[qa-test-cases.xlsx](qa-test-cases.xlsx)**

Send that file. It has two sheets:

1. **How to use** — short instructions in plain language (no technical setup).
2. **Test cases** — 66 steps in order, starting with **admin website sign-in**, then products and customers, then the customer phone app, then one full order, then the delivery app.

### Columns

| Column | Meaning |
|--------|---------|
| **Step** | Do these in order (1, 2, 3…) |
| **Test case id** | Short code if you need to refer to a row |
| **App category** | Admin panel, Order app, or Delivery app |
| **Module** | Area of the product |
| **Priority** | **P0** must pass before launch · **P1** should pass · **P2** workaround exists · **P3** after Play Store or low risk |
| **Use case** | One sentence: what this check is for |
| **What to do** | Steps a non-technical person can follow |
| **What you should see** | How you know it passed |
| **Status** | Pass, Fail, Blocked, or Not started |

### First session

Filter **Priority** = P0, and always run **Step 57** (one order from the customer through payment).

Regenerate the Excel file after editing the CSV:

```bash
npm run docs:qa-xlsx
```

Source: [qa-test-cases.csv](qa-test-cases.csv). Coverage follows [business-guide.md](business-guide.md).
