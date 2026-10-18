"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"
import { Group, Row } from "@/components/kit/group"
import { PendingButton } from "@/components/pending-button"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { api, call } from "@/lib/api"
import { ordersKey } from "@/lib/queries"
import { moving } from "@/lib/moves"

// DeleteOrderButton deletes the order on screen, after asking, and leaves for
// the list: the order's page is gone with it. A deleted order is not shown
// anywhere again. A refusal shows the API's reason, and the order stays.
export function DeleteOrderButton({ companyId, id, title }: { companyId: number; id: number; title: string }) {
  const [confirming, setConfirming] = useState(false)
  const queryClient = useQueryClient()
  const router = useRouter()
  const remove = useMutation({
    mutationFn: () => call(api.DELETE("/app/orders/{id}", { params: { path: { id } } })),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ordersKey(companyId) })
      toast.success("Vazifa o'chirildi")
      moving("back", () => router.replace("/orders"))
    },
    onError: (error) => {
      toast.error(error.message)
      setConfirming(false)
    },
  })

  return (
    <>
      <Group>
        <Row variant="danger" onClick={() => setConfirming(true)} title="Vazifani o'chirish" />
      </Group>
      <AlertDialog open={confirming} onOpenChange={setConfirming}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Vazifani o&apos;chirasizmi?</AlertDialogTitle>
          <AlertDialogDescription>
            «{title}» vazifalar ro&apos;yxatidan olib tashlanadi. Qayta tiklab bo&apos;lmaydi.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel size="lg" className="max-sm:h-10">
            Bekor qilish
          </AlertDialogCancel>
          <PendingButton
            variant="destructive"
            size="lg"
            className="max-sm:h-10"
            // It waits until the list is on screen: a second press would
            // only find the order gone.
            pending={remove.isPending || remove.isSuccess}
            onClick={() => remove.mutate()}
          >
            O&apos;chirish
          </PendingButton>
        </AlertDialogFooter>
      </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
