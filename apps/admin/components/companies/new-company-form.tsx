"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import type { z } from "zod"
import { TextField } from "@/components/text-field"
import { Button } from "@/components/ui/button"
import { FieldGroup } from "@/components/ui/field"
import { companySchema } from "@/lib/schemas"

type Input = z.input<typeof companySchema>
type Output = z.output<typeof companySchema>

// NewCompanyForm adds a company with its owner.
export function NewCompanyForm() {
  const form = useForm<Input, unknown, Output>({
    resolver: zodResolver(companySchema),
    defaultValues: { name: "", end_date: "", owner_phone: "", owner_full_name: "" },
  })

  return (
    <form onSubmit={form.handleSubmit(() => {})} noValidate className="max-w-lg space-y-6">
      <FieldGroup>
        <TextField control={form.control} name="name" label="Kompaniya nomi" autoComplete="off" />
        <TextField control={form.control} name="end_date" label="Tugash sanasi" type="date" />
        <TextField
          control={form.control}
          name="owner_phone"
          label="Egasining telefoni"
          type="tel"
          inputMode="tel"
          placeholder="+998 90 123 45 67"
        />
        <TextField control={form.control} name="owner_full_name" label="Egasining ismi" autoComplete="off" />
      </FieldGroup>
      <Button type="submit">Yaratish</Button>
    </form>
  )
}
