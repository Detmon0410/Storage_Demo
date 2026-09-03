# Basic Role And Permission Recommendation
## Liquor Import, Sales & Distribution System

## 1. Purpose

This document recommends a basic, standard role structure for the liquor import, sales, and distribution system.

The previous example used 8 roles. That structure is useful for a larger organization, but it may be too detailed when the system does not yet know how many roles each user should have.

For the current system, a simpler structure is recommended:

```text
6 basic roles
```

The system should still support assigning multiple roles to one user in the future.

---

## 2. Recommended Basic Roles

| No. | Role | Main Responsibility |
|---|---|---|
| 1 | System Admin | Manage users, roles, permissions, and system settings |
| 2 | Manager / Approver | View overall business data and approve important transactions |
| 3 | Import & Compliance Officer | Manage suppliers, import orders, import documents, and licenses |
| 4 | Warehouse & Distribution Officer | Receive goods, manage stock, lot/batch, picking, delivery, returns, and damage |
| 5 | Sales Officer | Manage customers and create sales orders |
| 6 | Finance / Accounting Officer | View and manage tax, cost, credit, invoice, and financial reports |

This is the recommended standard level for the first production version.

---

## 3. Why 6 Roles Are Enough For Basic Use

The 8-role example can be simplified by combining roles that are closely related:

| Detailed Role From Example | Basic Role |
|---|---|
| Senior Manager | Manager / Approver |
| Supervisor | Manager / Approver |
| Import / Order Officer | Import & Compliance Officer |
| Documentation & Compliance Officer | Import & Compliance Officer |
| Warehouse Officer | Warehouse & Distribution Officer |
| Distribution Officer | Warehouse & Distribution Officer |
| Tax Officer | Finance / Accounting Officer |
| Accounting Officer | Finance / Accounting Officer |

This keeps the system easier to manage while still separating the most important responsibilities.

---

## 4. User Role Assignment Rule

The system should support this rule:

```text
One user can have one or more roles.
```

Example:

```text
User: Somchai
Roles:
- Sales Officer
- Warehouse & Distribution Officer
```

The user's effective permissions should be the combined permissions from all assigned roles.

However, some control rules must still apply even if the user has multiple roles.

Important control rules:

- A user should not approve their own transaction.
- A user should not bypass license validation.
- A user should not bypass stock validation.
- A user should not edit audit logs.
- A user should not change financial limits unless their role allows it.

---

## 5. Recommended Database Concept

Do not store only one role directly on the user record if the business may grow later.

Recommended structure:

```text
users
  user_id
  username
  display_name
  email
  status

roles
  role_id
  role_code
  role_name

user_roles
  user_id
  role_id

permissions
  permission_id
  permission_code
  permission_name

role_permissions
  role_id
  permission_id
```

This allows one user to have many roles and each role to have many permissions.

---

## 6. Role Details

## 6.1 System Admin

Responsible for system setup and user access.

Can:

- Create, edit, deactivate, and reactivate users
- Assign roles to users
- Manage role permissions
- Manage master data configuration
- Manage system settings
- View audit logs
- View all modules for support purposes

Should not normally:

- Approve business transactions
- Change stock manually without a controlled reason
- Bypass compliance checks

Recommended access:

```text
User Management        Full
Role Management        Full
System Settings        Full
Master Data            Full
Audit Logs             View
Business Transactions  View
Reports                View
```

---

## 6.2 Manager / Approver

Responsible for business overview, approval, and exception control.

Can:

- View dashboard and KPIs
- View import orders
- View sales orders
- View inventory and stock value
- View customer credit status
- View license and compliance risks
- Approve or reject import orders
- Approve or reject sales orders
- Approve discount exceptions
- Approve credit exceptions
- View reports
- Export management reports

Should not normally:

- Create daily operational transactions
- Edit system settings
- Manage user access

Recommended access:

```text
Dashboard              View
Import Orders          View / Approve / Reject
Sales Orders           View / Approve / Reject
Inventory              View
Customers              View
Licenses               View
Reports                View / Export
Audit Logs             View
System Settings        No Access
```

---

## 6.3 Import & Compliance Officer

Responsible for import records, suppliers, import documents, and license/compliance information.

Can:

- Create and edit supplier records
- Create and edit import orders in draft or staging status
- Add import order items
- Enter country, incoterms, ETA, customs entry number, and document references
- Upload or record import documents
- Manage import license records
- Manage customer liquor license records if assigned
- Track license issue date, expiry date, and status
- Submit import orders for approval
- View import validation issues

Cannot:

- Approve their own import orders
- Mark goods as received into warehouse
- Change physical stock quantity
- Override tax or credit rules
- Manage users or roles

Recommended access:

```text
Suppliers              Create / Edit / View
Import Orders          Create / Edit / View
Import Documents       Create / Edit / View
Licenses               Create / Edit / View
Inventory              View
Sales Orders           View
Approval               Submit Only
```

---

## 6.4 Warehouse & Distribution Officer

Responsible for physical stock, warehouse receiving, lot/batch, picking, delivery, returns, and damage.

Can:

- View approved import orders ready for receiving
- Record actual received quantity
- Record shortage, overage, or damaged goods
- Create and update lot/batch inventory
- Assign warehouse or storage location
- Mark stock as available, on hold, damaged, or sold out according to workflow
- View inventory by SKU, lot/batch, and warehouse
- Generate or use picking lists
- Update delivery status
- Record returned goods
- Record damaged goods
- Create stock adjustment requests or controlled stock adjustments if authorized

Cannot:

- Create sales orders
- Approve sales discounts
- Change customer credit limits
- Change tax calculation
- Manage users or roles

Recommended access:

```text
Inventory              Create / Edit / View
Warehouse Receiving    Create / Edit / View
Stock Transactions     Create / View
Picking                Create / Edit / View
Delivery               Edit / View
Returns / Damage       Create / Edit / View
Import Orders          View
Sales Orders           View
```

---

## 6.5 Sales Officer

Responsible for customer and sales order processing.

Can:

- View products available for sale
- View available stock
- View customer records
- Create customer records if company policy allows
- Create sales orders
- Select valid customer liquor license
- Select available lot/batch
- Apply discount within allowed limit
- Submit discount exception for approval
- Submit credit exception for approval
- View sales order status
- View delivery status
- View own sales reports

Cannot:

- Sell to customers without a valid active license
- Sell more than available stock
- Approve their own discount or credit exception
- Directly change physical stock
- Mark goods as received
- Change tax settings
- Manage users or roles

Recommended access:

```text
Products               View
Customers              Create / Edit / View
Customer Licenses      View
Sales Orders           Create / Edit / View
Inventory              View
Delivery               View
Reports                Own / Sales View
Approval               Submit Only
```

---

## 6.6 Finance / Accounting Officer

Responsible for tax, duty, invoice, cost, credit, and financial reporting.

Can:

- View approved import orders
- View sales orders
- Verify customs duty
- Verify excise tax
- Verify VAT
- Manage landed cost information
- View supplier cost and product cost
- View invoices
- View customer outstanding balance
- Update customer payment or balance information if the system supports it
- Export tax, sales, and accounting reports
- View credit limit and credit usage

Cannot:

- Change physical stock quantity
- Create warehouse receiving records
- Approve their own financial exception unless also assigned Manager / Approver
- Manage users or roles

Recommended access:

```text
Import Orders          View
Sales Orders           View
Invoices               View / Edit
Tax / Duty             Create / Edit / View
Landed Cost            Create / Edit / View
Customer Credit        View / Edit If Authorized
Reports                View / Export
Inventory              View
```

---

## 7. Basic Permission Matrix

Legend:

```text
V = View
C = Create
E = Edit
A = Approve / Reject
X = Full Admin
- = No Access
```

| Module | Admin | Manager | Import & Compliance | Warehouse & Distribution | Sales | Finance |
|---|---|---|---|---|---|---|
| Dashboard | V | V | V | V | V | V |
| User Management | X | - | - | - | - | - |
| Role Management | X | - | - | - | - | - |
| Product Master | X | V | V | V | V | V |
| Supplier Master | X | V | C/E | V | - | V |
| Customer Master | X | V | V | V | C/E | V |
| Customer License | X | V | C/E | V | V | V |
| Import Order | X | V/A | C/E | V | - | V |
| Import Documents | X | V | C/E | V | - | V |
| Customs / Compliance | X | V | C/E | V | - | C/E |
| Tax / Duty | X | V | V | - | V | C/E |
| Warehouse Receiving | X | V | V | C/E | - | V |
| Inventory | X | V | V | C/E | V | V |
| Stock Transactions | X | V | V | C/E | V | V |
| Sales Order | X | V/A | V | V | C/E | V |
| Picking | X | V | - | C/E | V | V |
| Delivery | X | V | - | C/E | V | V |
| Returns / Damage | X | V | - | C/E | V | V |
| Reports | X | V | V | V | V | V |
| Audit Logs | V | V | Own/Related | Own/Related | Own/Related | Own/Related |

---

## 8. Minimum Permission Rules

## 8.1 No Self-Approval

A user who creates or edits a transaction should not approve that same transaction.

Example:

```text
Sales Officer creates sales order
        |
Discount exceeds limit
        |
Manager / Approver must approve
```

## 8.2 Backend Permission Enforcement

The frontend may hide unavailable buttons, but the backend must always check permissions again.

Example:

```text
Frontend: hide approve button
Backend: reject approve API call if user has no approval permission
```

## 8.3 Audit Trail

The system should record important actions:

```text
created_by
created_at
updated_by
updated_at
approved_by
approved_at
rejected_by
rejected_at
rejection_reason
status_from
status_to
status_changed_by
status_changed_at
```

## 8.4 Sensitive Field Control

| Sensitive Field | Roles Allowed To Edit |
|---|---|
| User role | System Admin |
| Credit limit | System Admin / Finance |
| Discount limit | System Admin |
| Tax rate | System Admin / Finance |
| License information | Import & Compliance |
| Received quantity | Warehouse & Distribution |
| Lot/batch quantity | Warehouse & Distribution |
| Approval result | Manager / Approver |
| Audit log | No normal user can edit |

---

## 9. Recommended Role Codes

Use stable role codes in the database and API:

```text
SYSTEM_ADMIN
MANAGER_APPROVER
IMPORT_COMPLIANCE_OFFICER
WAREHOUSE_DISTRIBUTION_OFFICER
SALES_OFFICER
FINANCE_ACCOUNTING_OFFICER
```

---

## 10. Future Expansion

If the business grows, the 6 basic roles can be split later.

Possible future roles:

```text
MANAGER_APPROVER
  -> SENIOR_MANAGER
  -> SUPERVISOR

IMPORT_COMPLIANCE_OFFICER
  -> IMPORT_OFFICER
  -> DOCUMENTATION_OFFICER
  -> COMPLIANCE_OFFICER

WAREHOUSE_DISTRIBUTION_OFFICER
  -> WAREHOUSE_OFFICER
  -> DISTRIBUTION_OFFICER

FINANCE_ACCOUNTING_OFFICER
  -> TAX_OFFICER
  -> ACCOUNTING_OFFICER
```

The system should not need a major redesign if the database supports users, roles, permissions, user roles, and role permissions from the beginning.

---

## 11. Final Recommendation

For the basic standard version, use:

```text
6 roles
```

Recommended roles:

1. System Admin
2. Manager / Approver
3. Import & Compliance Officer
4. Warehouse & Distribution Officer
5. Sales Officer
6. Finance / Accounting Officer

Most users should start with one role. Some users can have multiple roles when needed, but the system must still enforce no self-approval, license validation, stock validation, audit logging, and backend permission checks.
