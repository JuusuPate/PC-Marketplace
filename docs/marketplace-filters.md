# Marketplace filters

Category pages use a left sidebar on desktop and an expandable filter panel below 761 px. The horizontal category buttons are replaced by category checkboxes, so multiple product groups can be included in a single search.

- Choices within one group are OR; different groups and price limits are AND.
- Filtering runs on the complete active-listing collection before sorting and 24-item pagination. Changing filters resets the page.
- The category route limits the available product groups. Selecting one group enables its technical filters. Selecting several groups clears category-specific choices and shows general filters. General choices and price limits survive product-group changes within the same route.
- The sidebar reset clears sidebar choices and prices; the empty-state reset also clears search and the existing navigation filter.
- Counts include the search and other filter groups, replacing the current group's choices with the displayed option. Zero-count options remain selectable.
- Brand/city choices come from listings; technical choices include common values plus explicit values found in listings.

Technical filters use the existing public `Listing.specs` map, which the existing listing service passes to the create/update RPC and reads back from Supabase. No schema change or remote data migration is required. New optional fields in the listing editor supply missing specifications, including explicit Yes/No choices for free shipping, Wi-Fi and Bluetooth. Existing listings without these facts remain visible until the corresponding filter is selected. Missing values are never interpreted as "No" or "free shipping".

Legacy Finnish/English specification names are recognized. Capacity supports GB/TB and explicit RAM kits; CPU cores are separate from thread counts; form-factor spellings are normalized. Chip vendors may also be recognized from explicit model-family names. Cooler socket lists can match individual sockets or multiple-socket groups; these are based on the seller's stated compatibility, not an inferred hardware compatibility guarantee.

The simulated demo listings have illustrative specifications and free-shipping flags. These are demo-only and are not written to the real database. Filters are session UI state, not saved searches or URL parameters.

Implementation: `features/catalog/MarketplaceFilterSidebar.tsx`, `features/catalog/marketplace-filters.ts`, and `styles/features/marketplace/filters.css`. Optional seller fields remain in `features/sell/specification-fields.ts`.
