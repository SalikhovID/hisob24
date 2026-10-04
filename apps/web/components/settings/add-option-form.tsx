"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { type FormEvent, useRef, useState } from "react"
import { PendingButton } from "@/components/pending-button"
import { Refusal } from "@/components/refusal"
import { Input } from "@/components/ui/input"
import { api, call } from "@/lib/api"
import { customerDropdownsKey } from "@/lib/queries"

// AddOptionForm is the line under a dropdown's options: a name and Enter add
// an option at the end, and the line is at once ready for the next one, so a
// whole list is typed in without leaving the keyboard. The new row is the
// answer; a refusal (an option that is there already) shows under the line,
// which keeps what was typed.
export function AddOptionForm({ companyId, dropdownId }: { companyId: number; dropdownId: number }) {
  const [label, setLabel] = useState("")
  const input = useRef<HTMLInputElement>(null)
  const queryClient = useQueryClient()
  const add = useMutation({
    mutationFn: (value: string) =>
      call(api.POST("/app/customer-dropdowns/{id}/options", { params: { path: { id: dropdownId } }, body: { label: value } })),
    onSuccess: async () => {
      setLabel("")
      await queryClient.invalidateQueries({ queryKey: customerDropdownsKey(companyId) })
      input.current?.focus()
    },
  })

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const value = label.trim()
    if (value && !add.isPending) add.mutate(value)
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      <div className="flex gap-2">
        <Input
          ref={input}
          aria-label="Yangi variant"
          placeholder="Yangi variant"
          autoComplete="off"
          value={label}
          onChange={(event) => {
            setLabel(event.target.value)
            if (add.isError) add.reset()
          }}
          className="h-9 bg-card"
        />
        <PendingButton type="submit" size="lg" className="px-3.5" pending={add.isPending}>
          Qo&apos;shish
        </PendingButton>
      </div>
      {add.isError && <Refusal>{add.error.message}</Refusal>}
    </form>
  )
}
