import { type QueryKey, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

// inOrder puts rows in the order of ids; a row the ids do not name is left
// out.
export function inOrder<T extends { id: number }>(rows: T[], ids: number[]): T[] {
  return ids.flatMap((id) => rows.find((row) => row.id === id) ?? [])
}

// useReorder saves the new order of a list that people put in order. The
// list shows the order at once: apply writes it into what the query holds
// (queryKey). If the API refuses it (the list was changed elsewhere), its
// reason is said and the list is asked for again, which takes the order
// back.
export function useReorder<Data>(
  queryKey: QueryKey,
  apply: (data: Data, ids: number[]) => Data,
  save: (ids: number[]) => Promise<unknown>,
) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: save,
    onMutate: async (ids: number[]) => {
      await queryClient.cancelQueries({ queryKey })
      queryClient.setQueryData<Data>(queryKey, (data) => data && apply(data, ids))
    },
    onError: (error) => toast.error(error.message),
    onSettled: () => queryClient.invalidateQueries({ queryKey }),
  })
}
