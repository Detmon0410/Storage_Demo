# Liquor Import/Export System Improvement Advice

This document converts the six recommended improvement areas into practical requirements for making the current liquor import, sales, and distribution system ready for stronger operational and compliance use.

## 1. Lot/Batch Stock Control

**Priority:** Critical

The system should treat lot/batch inventory as the source of truth for liquor stock movement, not only the product-level stock quantity.

**Requirements:**

- Sales orders must reduce `InventoryStock.quantityOnHand` for the selected lot/batch.
- Import receiving must create or update inventory lots with received quantity, warehouse, received date, and lot/batch number.
- The system must prevent sales quantities from exceeding the selected lot/batch quantity.
- Stock transactions should reference product, lot/batch, source document, and movement type.
- Product-level stock quantity should be calculated from inventory lots or kept synchronized automatically.

**Acceptance Criteria:**

- When a sales order is created, the selected lot quantity decreases.
- When a sales order is deleted or edited, the previous lot quantity is restored before applying the new quantity.
- Users cannot sell from a lot with insufficient stock.
- Inventory reports can trace each bottle/carton from import order to sales order.

## 2. Backend Business Rule Enforcement

**Priority:** Critical

Important business rules must be enforced by the backend API, not only by the frontend screen.

**Requirements:**

- Backend must validate active customer liquor license before confirming a sales order.
- Backend must block sales for expired, revoked, suspended, or missing customer licenses.
- Backend must validate available stock before creating or updating sales orders.
- Backend must check customer credit limit before confirming an order.
- Backend must require approval when discount exceeds the allowed customer discount.
- Backend must reject negative quantity, invalid price, invalid discount, or invalid status values.

**Acceptance Criteria:**

- API requests cannot bypass license, stock, credit, or discount controls.
- Invalid sales orders return clear error messages.
- Frontend and backend validation rules produce consistent results.

## 3. Approval Workflow

**Priority:** High

The current `approver` text field should become a real approval process with status history and accountable users.

**Requirements:**

- Import orders and sales orders should support approval statuses such as `DRAFT`, `PENDING_APPROVAL`, `APPROVED`, `REJECTED`, and `CANCELLED`.
- Orders requiring approval must not affect final stock or delivery until approved.
- Approval actions must store approver, timestamp, decision, and rejection reason if rejected.
- High-value orders, over-credit orders, and over-discount orders should automatically require approval.
- The system should support at least one approval level, with future support for multi-level approval.

**Acceptance Criteria:**

- Users can submit an order for approval.
- Authorized users can approve or reject the order.
- Rejected orders record a reason.
- Approved orders show who approved them and when.

## 4. Documents And Reporting

**Priority:** High

The system should produce the documents needed for liquor trading, warehouse operation, and management review.

**Requirements:**

- Generate sales invoice, tax invoice, delivery note, and picking list from sales orders.
- Generate import order summary and receiving report from import orders.
- Reports should include product, quantity, lot/batch, customer/supplier, date, value, and status.
- Users should be able to export reports to CSV or PDF.
- Dashboard KPIs should be calculated from real operational data instead of manually maintained KPI rows.

**Acceptance Criteria:**

- Users can download standard documents from order detail pages.
- Picking lists show warehouse, product, quantity, and lot/batch.
- Reports can be filtered by date, customer, supplier, product, status, and warehouse.
- Dashboard figures match database records.

## 5. Liquor Tax And Compliance Data

**Priority:** High

Liquor products require stronger regulatory and tax data than normal inventory items.

**Requirements:**

- Product master data should include HS code, excise category, alcohol type, ABV, package size, bottle/carton conversion, and origin country.
- Import orders should capture customs duty, excise tax, VAT, freight, insurance, and landed cost.
- The system should calculate stamp quantity based on actual bottle quantity.
- The system should store import permit, customs entry, excise document, and related document references.
- Compliance reports should support audit by product, lot/batch, import order, and sales order.

**Acceptance Criteria:**

- Each product has enough data for liquor tax calculation.
- Import landed cost can be calculated per SKU and per bottle/carton.
- Each lot can be traced back to import and compliance documents.
- Missing compliance fields are visible before goods are marked ready for sale.

## 6. Authentication, Roles, And Audit Logs

**Priority:** Critical

The system needs access control and auditability before production use.

**Requirements:**

- Users must log in before accessing the system.
- Roles should control access for admin, manager, sales, warehouse, compliance, and finance users.
- Sensitive actions must require appropriate permission.
- The system must record audit logs for create, update, delete, approve, reject, login, and export actions.
- Audit logs should include user, timestamp, action, entity, previous value, new value, and IP/session reference where available.
- Audit logs should be retained according to business and regulatory requirements.

**Acceptance Criteria:**

- Unauthorized users cannot access restricted modules.
- Users without approval permission cannot approve orders.
- Data changes can be traced to a specific user and time.
- Audit logs cannot be edited through normal application screens.

## Suggested Implementation Order

1. Authentication, roles, and audit logs.
2. Backend business rule enforcement.
3. Lot/batch stock control.
4. Approval workflow.
5. Liquor tax and compliance data.
6. Documents, exports, and calculated reporting.

## MVP Readiness Summary

The current system is suitable as a demo or early MVP for recording products, imports, stock, licenses, customers, and sales orders. To become suitable for real liquor import/export operations, the six areas above should be implemented before production use.
