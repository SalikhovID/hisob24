"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { api, call } from "@/lib/api"
import { forgetOrderMoney } from "@/lib/order-money"
import { orderHistoryKey, orderKey, ordersKey } from "@/lib/queries"
import type { OrderDetail, OrderUpdate } from "@/lib/types"

// useUpdateOrder saves an order whole (PUT /app/orders/{id}: what is not sent
// is emptied). The page shows the answer at once; the lists and the history
// ask again, and so does what the money touches. Who saves it says so and
// closes its dialog.
export function useUpdateOrder(companyId: number, order: Pick<OrderDetail, "id" | "customer">) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: OrderUpdate) => call(api.PUT("/app/orders/{id}", { params: { path: { id: order.id } }, body })),
    onSuccess: (saved) => {
      queryClient.setQueryData(orderKey(companyId, order.id), saved)
      queryClient.invalidateQueries({ queryKey: ordersKey(companyId) })
      queryClient.invalidateQueries({ queryKey: orderHistoryKey(companyId, order.id) })
      forgetOrderMoney(queryClient, companyId, order.id, order.customer.id)
    },
  })
}
