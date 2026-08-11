# Product

Riftwatch serves a small, invite-only group of Riftbound buyers. Users search the
Riftbound Singles catalog, track a printing with marketplace filters, and receive
an in-app and Telegram alert when a comparable listing is unusually cheap.

## MVP defaults

- Google sign-in restricted to invited email addresses.
- English, Mint/Near Mint, ungraded, unsigned, and unaltered listings.
- EU/EEA seller countries, configurable in user settings and per watch.
- Foil or non-foil and CardTrader Zero optional.
- A 20% relative discount and EUR 5 absolute saving, overridable per watch.
- 50 watches per user by default; an administrator can change the quota.

Shipping cost and delivery estimates are not represented because CardTrader's
marketplace response does not expose them reliably. The MVP never modifies a
cart or purchases a product.

## Catalog watch workflow

- A card can be added immediately with account marketplace defaults, or opened
  to configure a single watch in detail.
- Catalog selections are kept in the current browser tab across searches,
  filters, and pagination. A bulk dialog applies one validated filter set to
  every selected printing and creates the watches atomically.
- Non-navigation mutations show an in-button pending state. Every completion or
  failure is reported through the shared bottom-right notification viewport. A
  failed operation remains retryable and must not present a success
  confirmation.
- The watchlist can refresh every active watched printing in one user-scoped
  request. The scanner deduplicates those printings and applies its adaptive
  expansion batching without exposing administrator-wide scan access.
