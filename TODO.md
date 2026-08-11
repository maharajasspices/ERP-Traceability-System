# Task: Remove All Invoice Functionality

## Steps

- [x] 1. Delete `src/pages/Invoices.tsx`
- [x] 2. Delete `src/lib/invoiceLocalStore.ts`
- [x] 3. Delete `supabase/migrations/20260717000000_fms_invoices.sql`
- [x] 4. Remove invoice route/import from `src/App.tsx`  (files 1-3 deleted)
- [x] 5. Remove invoice nav item from `src/components/layout/Sidebar.tsx`
- [x] 6. Remove invoice title from `src/components/layout/Header.tsx`
- [ ] 7. Remove invoice types/state/operations from `src/hooks/useFMSData.ts`
- [ ] 8. Remove `invoiceSchema`/`invoiceItemSchema` from `src/lib/fmsValidation.ts`
- [ ] 9. Remove invoice schema from edge function `supabase/functions/fms-validate/index.ts`
- [ ] 10. Create migration to DROP `fms_invoices`/`fms_invoice_items` tables + enum
- [ ] 11. Run `npm run build` to verify
