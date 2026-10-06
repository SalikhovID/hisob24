"use client"

import Link from "next/link"
import type { Control } from "react-hook-form"
import { FieldAnswer } from "@/components/field-answer"
import { PhoneField } from "@/components/phone-field"
import { Refusal } from "@/components/refusal"
import { FieldGroup } from "@/components/ui/field"
import { ApiError } from "@/lib/api"
import { type CustomerForm, type CustomerOutput } from "@/lib/customers"
import { fieldKey } from "@/lib/fields"
import type { Customer, CustomerDropdown, CustomerField, CustomerType } from "@/lib/types"

type FormControl = Control<CustomerForm, unknown, CustomerOutput>

// CustomerFields is the form of a type's customer: the phone, which every
// customer has, then the type's fields in their order. customer is the one
// being edited, if any.
export function CustomerFields({
  control,
  type,
  dropdowns,
  customer,
}: {
  control: FormControl
  type: CustomerType
  dropdowns: CustomerDropdown[]
  customer?: Customer
}) {
  // has tells whether the customer being edited has the option in the field.
  const has = (field: CustomerField, optionId: number) => {
    const answer = customer?.values[field.id]
    return Array.isArray(answer) ? answer.includes(optionId) : answer === optionId
  }
  return (
    <FieldGroup>
      <PhoneField control={control} name="phone" label="Telefon raqami" autoComplete="off" />
      {type.fields.map((field) => (
        <FieldAnswer
          key={field.id}
          control={control}
          name={`values.${fieldKey(field)}`}
          field={field}
          // A choice offers the options of its dropdown that are not turned
          // off, and the one turned off since that the customer has: an edit
          // keeps it.
          options={(dropdowns.find((dropdown) => dropdown.id === field.dropdown_id)?.options ?? []).filter(
            (o) => o.is_active || has(field, o.id),
          )}
        />
      ))}
    </FieldGroup>
  )
}

// CustomerRefusal is the API's reason for turning a customer down. A phone
// or an answer that another customer has leads to that customer: whoever is
// entering them twice can open the one that is there.
export function CustomerRefusal({ error }: { error: Error }) {
  const other = error instanceof ApiError ? error.customerId : undefined
  return (
    <Refusal>
      <span>
        {error.message}
        {other !== undefined && (
          <>
            {" "}
            <Link href={`/customers/${other}`} className="font-medium whitespace-nowrap underline underline-offset-4">
              Mijozni ochish
            </Link>
          </>
        )}
      </span>
    </Refusal>
  )
}
