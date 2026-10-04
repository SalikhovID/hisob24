"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { BanIcon, CircleCheckIcon } from "lucide-react"
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
import { keys } from "@/lib/queries"
import type { Company } from "@/lib/types"

// useUpdateCompany changes a company's name or active flag and refreshes
// what shows it.
export function useUpdateCompany(id: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (change: { name?: string; is_active?: boolean }) =>
      call(api.PATCH("/admin/companies/{id}", { params: { path: { id } }, body: change })),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.company(id) })
      queryClient.invalidateQueries({ queryKey: keys.companies() })
    },
  })
}

// CompanyActions block a company (after asking: its users lose access) or
// activate it again.
export function CompanyActions({ company }: { company: Company }) {
  const [confirming, setConfirming] = useState(false)
  const update = useUpdateCompany(company.id)

  if (!company.is_active) {
    return (
      <PendingButton
        variant="outline"
        size="lg"
        pending={update.isPending}
        onClick={() =>
          update.mutate({ is_active: true }, { onSuccess: () => toast.success("Kompaniya faollashtirildi") })
        }
      >
        {/* The spinner takes the icon's place while the request is on its way. */}
        {!update.isPending && <CircleCheckIcon />}
        Faollashtirish
      </PendingButton>
    )
  }

  return (
    <AlertDialog open={confirming} onOpenChange={setConfirming}>
      {/* Quiet until the pointer is on it: only then does it show what it is. */}
      <AlertDialogTrigger
        render={
          <Button
            variant="outline"
            size="lg"
            className="hover:border-destructive/30 hover:bg-destructive/10 hover:text-destructive dark:hover:border-destructive/40 dark:hover:bg-destructive/20"
          />
        }
      >
        <BanIcon />
        Bloklash
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Kompaniyani bloklaysizmi?</AlertDialogTitle>
          <AlertDialogDescription>
            Bloklangan kompaniyaning userlari tizimga kira olmaydi. Keyin qayta faollashtirish mumkin.
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
            pending={update.isPending}
            onClick={() =>
              update.mutate(
                { is_active: false },
                {
                  onSuccess: () => {
                    setConfirming(false)
                    toast.success("Kompaniya bloklandi")
                  },
                },
              )
            }
          >
            Bloklash
          </PendingButton>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
