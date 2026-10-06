"use client"

import { Radio } from "@base-ui/react/radio"
import { RadioGroup } from "@base-ui/react/radio-group"
import Link from "next/link"
import type { Control } from "react-hook-form"
import { FieldAnswer } from "@/components/field-answer"
import { Refusal } from "@/components/refusal"
import { SelectField } from "@/components/select-field"
import { TextField } from "@/components/text-field"
import { Button } from "@/components/ui/button"
import { FieldGroup } from "@/components/ui/field"
import { ApiError } from "@/lib/api"
import { customerName } from "@/lib/customers"
import { fieldKey, type FormField } from "@/lib/fields"
import { formatPhone } from "@/lib/phone"
import type { TaskForm, TaskOutput } from "@/lib/tasks"
import type { Customer, CustomerDropdown, CustomerType, Member, Task, TaskStage, TaskType } from "@/lib/types"
import { CustomerPicker } from "./customer-picker"

export type FormControl = Control<TaskForm, unknown, TaskOutput>

// The choice buttons of a type, in the tabs' style.
export const choice =
  "inline-flex h-8 cursor-default items-center rounded-md px-3 text-sm font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 data-checked:bg-card data-checked:text-foreground data-checked:shadow-sm data-disabled:cursor-not-allowed data-disabled:opacity-60"
export const choices = "flex w-fit max-w-full flex-wrap gap-1 rounded-lg bg-muted p-[3px]"

// offered is what a choice field offers: the options of its dropdown that
// are not turned off, and those turned off since that the record has.
function offered(field: FormField, dropdowns: CustomerDropdown[], values?: Record<string, unknown>) {
  const answer = values?.[field.id]
  const has = (optionId: number) => (Array.isArray(answer) ? answer.includes(optionId) : answer === optionId)
  return (dropdowns.find((dropdown) => dropdown.id === field.dropdown_id)?.options ?? []).filter((o) => o.is_active || has(o.id))
}

// TaskFields is the task's own part of the form: the title, the deadline,
// the stage, the assignee, then the fields of its type in their order. task
// is the one being edited, if any: its answers keep the options turned off
// since, and its assignee stays offered after leaving the company.
export function TaskFields({
  control,
  type,
  stages,
  members,
  dropdowns,
  task,
}: {
  control: FormControl
  type: TaskType
  stages: TaskStage[]
  members: Member[]
  dropdowns: CustomerDropdown[]
  task?: Task
}) {
  const assignee = task?.assignee
  const gone = assignee && !members.some((member) => member.phone === assignee.phone) ? assignee : null
  return (
    <FieldGroup>
      <TextField control={control} name="title" label="Nomi" autoComplete="off" />
      <TextField control={control} name="deadline" label="Muddat" type="date" />
      <SelectField
        control={control}
        name="stage_id"
        label="Bosqich"
        placeholder="Tanlang"
        options={stages.map((stage) => ({ value: String(stage.id), label: stage.name }))}
      />
      <SelectField
        control={control}
        name="assignee_phone"
        label="Mas'ul"
        empty="Tanlanmagan"
        options={[
          ...members.map((member) => ({ value: member.phone, label: member.full_name ?? formatPhone(member.phone) })),
          // An assignee who left the company stays as long as the edit keeps them.
          ...(gone ? [{ value: gone.phone, label: `${gone.full_name ?? formatPhone(gone.phone)} (chiqarilgan)` }] : []),
        ]}
      />
      {type.fields.map((field) => (
        <FieldAnswer
          key={field.id}
          control={control}
          name={`values.${fieldKey(field)}`}
          field={field}
          options={offered(field, dropdowns, task?.values)}
        />
      ))}
    </FieldGroup>
  )
}

// LinkedCustomerCard shows the customer a task is for, once it is known:
// the name (or the phone), the type and the phone, the way to its page and,
// where the customer may still be let go (a new task), the way to do so.
export function LinkedCustomerCard({
  name,
  phone,
  typeName,
  href,
  onUnlink,
}: {
  name: string | null
  phone: string
  typeName?: string
  href: string
  onUnlink?: () => void
}) {
  const facts = [typeName, name ? formatPhone(phone) : null].filter((fact): fact is string => !!fact)
  return (
    <section aria-label="Mavjud mijoz" className="flex items-start justify-between gap-3 rounded-lg border bg-muted/40 px-3 py-2.5 text-sm">
      <div className="min-w-0">
        <p className="text-xs font-medium text-muted-foreground">Mavjud mijoz</p>
        <p className="font-medium [overflow-wrap:anywhere]">{name ?? formatPhone(phone)}</p>
        {facts.length > 0 && <p className="text-[0.8125rem] leading-5 text-muted-foreground">{facts.join(" · ")}</p>}
        <Link href={href} className="mt-0.5 inline-block text-[0.8125rem] leading-5 text-muted-foreground underline underline-offset-4 hover:text-foreground">
          Mijozni ochish
        </Link>
      </div>
      {onUnlink && (
        <Button type="button" variant="outline" size="sm" className="shrink-0 bg-card" onClick={onUnlink}>
          Boshqa mijoz
        </Button>
      )}
    </section>
  )
}

// CustomerSection is the customer's part of the form: the type to enter a
// new customer under, its phone (with the suggestions of the customers
// that are there) and the type's fields. Once a customer that is there is
// taken (linked), it is shown instead, its fields filled in and locked,
// until it is let go. With no customer type to enter one under, or without
// the leave to enter one (canCreate), only a customer that is there will do.
export function CustomerSection({
  control,
  companyId,
  customerTypes,
  customerType,
  canCreate,
  onChangeType,
  dropdowns,
  linked,
  onLink,
  onUnlink,
}: {
  control: FormControl
  companyId: number
  customerTypes: CustomerType[]
  customerType: CustomerType | null
  canCreate: boolean
  onChangeType: (id: number) => void
  dropdowns: CustomerDropdown[]
  linked: Customer | null
  onLink: (customer: Customer) => void
  onUnlink: () => void
}) {
  const linkedType = linked ? customerTypes.find((type) => type.id === linked.type_id) : undefined
  const linkedName = linked ? customerName(linked, linkedType) : null
  return (
    <FieldGroup>
      {linked && (
        <LinkedCustomerCard name={linkedName} phone={linked.phone} typeName={linkedType?.name} href={`/customers/${linked.id}`} onUnlink={onUnlink} />
      )}
      {!canCreate ? (
        <p className="text-[0.8125rem] leading-5 text-pretty text-muted-foreground">
          Yangi mijoz qo&apos;shish ruxsatingiz yo&apos;q: mavjud mijozni biriktiring.
        </p>
      ) : customerTypes.length === 0 ? (
        <p className="text-[0.8125rem] leading-5 text-pretty text-muted-foreground">
          Mijoz turlari yo&apos;q: faqat mavjud mijozni biriktirish mumkin.
        </p>
      ) : (
        customerTypes.length > 1 && (
          <RadioGroup
            aria-label="Mijoz turi"
            value={customerType ? String(customerType.id) : ""}
            onValueChange={(value) => onChangeType(Number(value))}
            disabled={linked !== null}
            className={choices}
          >
            {customerTypes.map((candidate) => (
              <Radio.Root
                key={candidate.id}
                value={String(candidate.id)}
                disabled={linked !== null}
                aria-disabled={linked !== null || undefined}
                className={choice}
              >
                {candidate.name}
              </Radio.Root>
            ))}
          </RadioGroup>
        )
      )}
      <CustomerPicker
        control={control}
        name="customer.phone"
        companyId={companyId}
        types={customerTypes}
        onSelect={onLink}
        disabled={linked !== null}
      />
      {(linked ? linkedType : customerType)?.fields.map((field) => (
        <FieldAnswer
          key={field.id}
          control={control}
          name={`customer.values.${fieldKey(field)}`}
          field={field}
          options={offered(field, dropdowns, linked?.values)}
          disabled={linked !== null}
        />
      ))}
    </FieldGroup>
  )
}

// TaskRefusal is the API's reason for turning a task down. A new customer's
// phone or answer that another customer has leads to that customer: it can
// be linked to the task at a press, or opened.
export function TaskRefusal({ error, onLink }: { error: Error; onLink: (customerId: number) => void }) {
  const other = error instanceof ApiError ? error.customerId : undefined
  return (
    <Refusal>
      <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span>{error.message}</span>
        {other !== undefined && (
          <>
            <Button type="button" variant="outline" size="sm" className="bg-card" onClick={() => onLink(other)}>
              Shu mijozni biriktirish
            </Button>
            <Link href={`/customers/${other}`} className="font-medium whitespace-nowrap underline underline-offset-4">
              Mijozni ochish
            </Link>
          </>
        )}
      </span>
    </Refusal>
  )
}
