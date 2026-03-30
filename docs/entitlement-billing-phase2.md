# Entitlement & Billing Phase 2

## Capability Protocol

### `entitlement.check`
- Input: `userId`, `feature_code`
- Output:
  - `can_access`
  - `reason_code`
  - `display_message`
  - `paywall_payload`
  - `remaining_quota`

### `entitlement.explain`
- Input: `userId`, `feature_code`
- Output:
  - All check fields
  - `active_entitlements`
  - `active_quotas`
  - `available_plans`

### `usage.consume`
- Input: `userId`, `feature_code`, `usage_key`, `operation_status`
- Behavior:
  - Only consumes quota when `operation_status = SUCCESS`
  - Idempotent by `usage_key`

### `unlock.create`
- Input: `userId`, `plan_code`, `feature_code?`
- Output: mock order + payment record refs + paywall payload

### `unlock.confirm`
- Input: `order_id`, `transaction_id`
- Output: order/payment status + refreshed `entitlement_state`

## Mock Payment Flow

1. Agent or frontend calls `unlock.create`.
2. System creates:
   - `PurchaseOrder` with `PENDING_PAYMENT`
   - `PaymentRecord` with `INITIATED`
3. Mock callback calls `unlock.confirm`.
4. System marks:
   - payment `SUCCEEDED`
   - order `PAID` -> `FULFILLED`
5. Fulfillment grants:
   - `UserEntitlement` (membership / unlock / purchase source)
   - `UsageQuota` (for one-time or quota packs)
   - `UnlockRecord` (for one-time unlock)
6. `entitlement.check` reflects new state immediately.

## API/Use Cases (for shell and external adapters)

- `queryCurrentEntitlements`
- `queryFeatureAvailability`
- `createMockOrder`
- `confirmMockPayment`

All APIs route to one shared `EntitlementBillingService`, so agent checks, purchase flow, and UI rendering remain consistent.
