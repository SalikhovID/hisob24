"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { type FormEvent, useRef, useState } from "react"
import { Group } from "@/components/kit/group"
import { Button } from "@/components/ui/button"
import { api, call } from "@/lib/api"
import { customerDropdownsKey } from "@/lib/queries"

// AddOptionForm is the line under a dropdown's options: a name and Enter add
// an option at the end, and the line is at once ready for the next one, so a
// whole list is typed in without leaving the keyboard. The new row is the
// answer; a refusal (an option that is there already) shows under the line,
// which keeps what was typed. As the prototype's row: the line and its
// small button in a group of their own.
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
    <form onSubmit={submit}>
      <Group>
        <div data-slot="form-row" className="flex min-h-[52px] items-center gap-3 px-4 py-1.5">
          <input
            ref={input}
            aria-label="Yangi variant"
            placeholder="Yangi variant"
            autoComplete="off"
            enterKeyHint="done"
            maxLength={60}
            value={label}
            aria-invalid={add.isError || undefined}
            aria-describedby={add.isError ? "add-option-error" : undefined}
            onChange={(event) => {
              setLabel(event.target.value)
              if (add.isError) add.reset()
            }}
            className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
          />
          <Button type="submit" size="mini" disabled={add.isPending} aria-busy={add.isPending || undefined}>
            Qo&apos;shish
          </Button>
        </div>
        {add.isError && (
          <p id="add-option-error" role="alert" className="-mt-1 px-4 pb-2.5 text-xs text-destructive">
            {add.error.message}
          </p>
        )}
      </Group>
    </form>
  )
}
