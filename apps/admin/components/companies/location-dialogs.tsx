"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { MapPinPlusIcon, PencilIcon, Trash2Icon } from "lucide-react"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import type { z } from "zod"
import { ActionTooltip } from "@/components/action-tooltip"
import { PendingButton } from "@/components/pending-button"
import { Refusal } from "@/components/refusal"
import { TextField } from "@/components/text-field"
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
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { api, call } from "@/lib/api"
import { keys } from "@/lib/queries"
import { locationSchema } from "@/lib/schemas"
import type { AdminLocation } from "@/lib/types"

type Input = z.input<typeof locationSchema>
type Output = z.output<typeof locationSchema>

// An icon button of a location's row: quiet until the pointer is on it,
// with a larger target under a thumb.
const rowButton =
  "text-muted-foreground hover:text-foreground max-md:relative max-md:size-9 max-md:after:absolute max-md:after:-inset-1 pointer-coarse:relative pointer-coarse:size-9 pointer-coarse:after:absolute pointer-coarse:after:-inset-1"

// AddLocationDialog adds a location (a branch) to the company: a task of
// the company stands in one of them (logic/locations.md, section 3).
export function AddLocationDialog({ companyId }: { companyId: number }) {
  const [open, setOpen] = useState(false)
  const queryClient = useQueryClient()
  const form = useForm<Input, unknown, Output>({ resolver: zodResolver(locationSchema), defaultValues: { name: "" } })
  const add = useMutation({
    mutationFn: (location: Output) =>
      call(api.POST("/admin/companies/{id}/locations", { params: { path: { id: companyId } }, body: location })),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.company(companyId) })
      toast.success("Lokatsiya qo'shildi")
      setOpen(false)
    },
  })

  // Every opening starts from an empty form.
  const changeOpen = (next: boolean) => {
    setOpen(next)
    if (next) {
      form.reset({ name: "" })
      add.reset()
    }
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger render={<Button variant="outline" size="lg" />}>
        <MapPinPlusIcon />
        Lokatsiya qo&apos;shish
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Lokatsiya qo&apos;shish</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit((location) => add.mutate(location))} noValidate className="space-y-4">
          <TextField control={form.control} name="name" label="Nomi" autoComplete="off" />
          {add.isError && <Refusal>{add.error.message}</Refusal>}
          <DialogFooter>
            <PendingButton type="submit" size="lg" className="px-3.5 max-sm:h-10" pending={add.isPending}>
              Qo&apos;shish
            </PendingButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// RenameLocationDialog changes a location's name.
export function RenameLocationDialog({ companyId, location }: { companyId: number; location: AdminLocation }) {
  const [open, setOpen] = useState(false)
  const queryClient = useQueryClient()
  const form = useForm<Input, unknown, Output>({ resolver: zodResolver(locationSchema), defaultValues: { name: location.name } })
  const rename = useMutation({
    mutationFn: (change: Output) =>
      call(
        api.PATCH("/admin/companies/{id}/locations/{locationId}", {
          params: { path: { id: companyId, locationId: location.id } },
          body: change,
        }),
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.company(companyId) })
      toast.success("Lokatsiya nomi o'zgartirildi")
      setOpen(false)
    },
  })

  // Every opening starts from the current name.
  const changeOpen = (next: boolean) => {
    setOpen(next)
    if (next) {
      form.reset({ name: location.name })
      rename.reset()
    }
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <ActionTooltip label="Nomini o'zgartirish">
        <DialogTrigger
          render={<Button variant="ghost" size="icon" className={rowButton} aria-label={`Nomini o'zgartirish: ${location.name}`} />}
        >
          <PencilIcon />
        </DialogTrigger>
      </ActionTooltip>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Lokatsiya nomini o&apos;zgartirish</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit((change) => rename.mutate(change))} noValidate className="space-y-4">
          <TextField control={form.control} name="name" label="Nomi" autoComplete="off" />
          {rename.isError && <Refusal>{rename.error.message}</Refusal>}
          <DialogFooter>
            <PendingButton type="submit" size="lg" className="px-3.5 max-sm:h-10" pending={rename.isPending}>
              Saqlash
            </PendingButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// DeleteLocationButton hides a location after asking. The API refuses the
// company's only location and one a task stands in: its reason shows.
export function DeleteLocationButton({ companyId, location }: { companyId: number; location: AdminLocation }) {
  const [confirming, setConfirming] = useState(false)
  const queryClient = useQueryClient()
  const remove = useMutation({
    mutationFn: () =>
      call(
        api.DELETE("/admin/companies/{id}/locations/{locationId}", {
          params: { path: { id: companyId, locationId: location.id } },
        }),
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.company(companyId) })
      toast.success("Lokatsiya o'chirildi")
    },
    onError: (error) => toast.error(error.message),
    onSettled: () => setConfirming(false),
  })

  return (
    <AlertDialog open={confirming} onOpenChange={setConfirming}>
      <ActionTooltip label="O'chirish">
        <AlertDialogTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive dark:hover:bg-destructive/20 max-md:relative max-md:size-9 max-md:after:absolute max-md:after:-inset-1 pointer-coarse:relative pointer-coarse:size-9 pointer-coarse:after:absolute pointer-coarse:after:-inset-1"
              aria-label={`O'chirish: ${location.name}`}
            />
          }
        >
          <Trash2Icon />
        </AlertDialogTrigger>
      </ActionTooltip>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Lokatsiyani o&apos;chirasizmi?</AlertDialogTitle>
          <AlertDialogDescription>
            «{location.name}» lokatsiyasi o&apos;chadi. Vazifasi bor lokatsiya va kompaniyaning yagona lokatsiyasi
            o&apos;chirilmaydi.
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
            pending={remove.isPending}
            onClick={() => remove.mutate()}
          >
            O&apos;chirish
          </PendingButton>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
