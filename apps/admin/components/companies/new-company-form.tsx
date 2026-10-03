"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import type { z } from "zod"
import { PendingButton } from "@/components/pending-button"
import { Refusal } from "@/components/refusal"
import { TextField } from "@/components/text-field"
import { FieldGroup } from "@/components/ui/field"
import { api, call } from "@/lib/api"
import { keys } from "@/lib/queries"
import { companySchema } from "@/lib/schemas"

type Input = z.input<typeof companySchema>
type Output = z.output<typeof companySchema>

// NewCompanyForm adds a company with its owner, then opens it.
export function NewCompanyForm() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const form = useForm<Input, unknown, Output>({
    resolver: zodResolver(companySchema),
    defaultValues: { name: "", end_date: "", owner_phone: "", owner_full_name: "" },
  })
  const create = useMutation({
    mutationFn: (company: Output) => call(api.POST("/admin/companies", { body: company })),
    onSuccess: (company) => {
      queryClient.invalidateQueries({ queryKey: keys.companies() })
      toast.success("Kompaniya yaratildi")
      router.push(`/companies/${company.id}`)
    },
  })

  return (
    // One sheet: the company first, its owner after a wider gap (the labels
    // say whose each field is), what the API refused last, and the button on
    // the band that closes the sheet.
    <form
      onSubmit={form.handleSubmit((company) => create.mutate(company))}
      noValidate
      className="max-w-lg rounded-xl border bg-card"
    >
      <div className="space-y-8 p-4 md:p-5">
        <FieldGroup>
          <TextField control={form.control} name="name" label="Kompaniya nomi" autoComplete="off" />
          <TextField control={form.control} name="end_date" label="Tugash sanasi" type="date" className="tabular-nums" />
        </FieldGroup>
        <FieldGroup>
          <TextField
            control={form.control}
            name="owner_phone"
            label="Egasining telefoni"
            type="tel"
            inputMode="tel"
            placeholder="+998 90 123 45 67"
            className="tabular-nums"
          />
          <TextField control={form.control} name="owner_full_name" label="Egasining ismi" autoComplete="off" />
        </FieldGroup>
        {create.isError && <Refusal>{create.error.message}</Refusal>}
      </div>
      <div className="flex justify-end rounded-b-xl border-t bg-muted/50 px-4 py-3 md:px-5">
        <PendingButton type="submit" size="lg" className="px-3.5 max-md:w-full" pending={create.isPending}>
          Yaratish
        </PendingButton>
      </div>
    </form>
  )
}
