"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Trash2Icon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"
import { PendingButton } from "@/components/pending-button"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { api, call } from "@/lib/api"
import { customersKey } from "@/lib/queries"

// DeleteCustomerButton deletes the customer on screen, after asking, and
// leaves for the list: the customer's page is gone with it. A deleted
// customer is not shown anywhere again, and its phone is free for another.
// A refusal shows the API's reason, and the customer stays.
export function DeleteCustomerButton({ companyId, id, name }: { companyId: number; id: number; name: string }) {
  const [confirming, setConfirming] = useState(false)
  const queryClient = useQueryClient()
  const router = useRouter()
  const remove = useMutation({
    mutationFn: () => call(api.DELETE("/app/customers/{id}", { params: { path: { id } } })),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: customersKey(companyId) })
      toast.success("Mijoz o'chirildi")
      router.replace("/customers")
    },
    onError: (error) => {
      toast.error(error.message)
      setConfirming(false)
    },
  })

  return (
    <AlertDialog open={confirming} onOpenChange={setConfirming}>
      <AlertDialogTrigger
        render={
          <Button
            variant="outline"
            size="lg"
            className="px-3.5 hover:bg-destructive/10 hover:text-destructive dark:hover:bg-destructive/20"
          />
        }
      >
        <Trash2Icon />
        O&apos;chirish
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Mijozni o&apos;chirasizmi?</AlertDialogTitle>
          <AlertDialogDescription>
            {name} mijozlar ro&apos;yxatidan olib tashlanadi. Qayta tiklab bo&apos;lmaydi.
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
            // only find the customer gone.
            pending={remove.isPending || remove.isSuccess}
            onClick={() => remove.mutate()}
          >
            O&apos;chirish
          </PendingButton>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
