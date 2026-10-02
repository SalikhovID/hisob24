"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { BanIcon, CircleCheckIcon } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
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
      <Button
        variant="outline"
        size="sm"
        disabled={update.isPending}
        onClick={() =>
          update.mutate({ is_active: true }, { onSuccess: () => toast.success("Kompaniya faollashtirildi") })
        }
      >
        <CircleCheckIcon />
        Faollashtirish
      </Button>
    )
  }

  return (
    <AlertDialog open={confirming} onOpenChange={setConfirming}>
      <AlertDialogTrigger render={<Button variant="outline" size="sm" />}>
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
          <AlertDialogCancel>Bekor qilish</AlertDialogCancel>
          <Button
            variant="destructive"
            disabled={update.isPending}
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
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
