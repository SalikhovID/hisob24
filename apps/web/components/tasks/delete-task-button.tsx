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
import { tasksKey } from "@/lib/queries"

// DeleteTaskButton deletes the task on screen, after asking, and leaves for
// the list: the task's page is gone with it. A deleted task is not shown
// anywhere again. A refusal shows the API's reason, and the task stays.
export function DeleteTaskButton({ companyId, id, title }: { companyId: number; id: number; title: string }) {
  const [confirming, setConfirming] = useState(false)
  const queryClient = useQueryClient()
  const router = useRouter()
  const remove = useMutation({
    mutationFn: () => call(api.DELETE("/app/tasks/{id}", { params: { path: { id } } })),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tasksKey(companyId) })
      toast.success("Vazifa o'chirildi")
      router.replace("/tasks")
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
            // only find the task gone.
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
