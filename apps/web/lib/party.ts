// Party is whose money documents a dialog or a list is about: a supplier's
// (logic/warehouse.md, section 6) or a customer's (logic/sales.md, section
// 5). The endpoints and the caches differ; the forms and the rows do not.
import type { QueryClient } from "@tanstack/react-query"
import { forgetFinance } from "./finance"
import { customerKey, customersKey, customerStatementKey, paymentsKey, statementKey, supplierKey, suppliersKey } from "./queries"

export type Party = "supplier" | "customer"

// forgetParty drops what a party's money document changes: its balance,
// its statement and its payments.
export function forgetParty(queryClient: QueryClient, party: Party, companyId: number, partyId: number) {
  // A payment moves money in an account too.
  forgetFinance(queryClient, companyId)
  if (party === "supplier") {
    queryClient.invalidateQueries({ queryKey: paymentsKey(companyId, partyId) })
    queryClient.invalidateQueries({ queryKey: statementKey(companyId, partyId) })
    queryClient.invalidateQueries({ queryKey: supplierKey(companyId, partyId) })
    queryClient.invalidateQueries({ queryKey: suppliersKey(companyId) })
    return
  }
  queryClient.invalidateQueries({ queryKey: customerStatementKey(companyId, partyId) })
  queryClient.invalidateQueries({ queryKey: customerKey(companyId, partyId) })
  queryClient.invalidateQueries({ queryKey: customersKey(companyId) })
}
