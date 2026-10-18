// What an order's money touches in the cache (logic/orders.md, 4.3): the
// order and the lists, the customer's balance and statement, the stock and
// the accounts.
import type { QueryClient } from "@tanstack/react-query"
import { forgetFinance } from "./finance"
import { customerKey, customersKey, customerStatementKey, orderHistoryKey, orderKey, ordersKey, productsKey } from "./queries"

// forgetOrderMoney drops what an order's money (its price, its goods, a
// payment for it) changes.
export function forgetOrderMoney(queryClient: QueryClient, companyId: number, orderId: number, customerId: number) {
  queryClient.invalidateQueries({ queryKey: orderKey(companyId, orderId) })
  queryClient.invalidateQueries({ queryKey: orderHistoryKey(companyId, orderId) })
  queryClient.invalidateQueries({ queryKey: ordersKey(companyId) })
  queryClient.invalidateQueries({ queryKey: customerKey(companyId, customerId) })
  queryClient.invalidateQueries({ queryKey: customersKey(companyId) })
  queryClient.invalidateQueries({ queryKey: customerStatementKey(companyId, customerId) })
  queryClient.invalidateQueries({ queryKey: productsKey(companyId) })
  forgetFinance(queryClient, companyId)
}
