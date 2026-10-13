"use client"

import Link from "next/link"
import type { ReactNode } from "react"
import type { Control } from "react-hook-form"
import { FieldAnswer } from "@/components/field-answer"
import { Avatar } from "@/components/kit/avatar"
import { ChoiceChips } from "@/components/kit/chips"
import { TextRow } from "@/components/kit/form-row"
import { Foot, Group } from "@/components/kit/group"
import { SelectRow } from "@/components/kit/picker-sheet"
import { Refusal } from "@/components/refusal"
import { ApiError } from "@/lib/api"
import { customerName } from "@/lib/customers"
import { fieldKey, type FormField } from "@/lib/fields"
import { assigneeOptions } from "@/lib/members"
import { formatPhone } from "@/lib/phone"
import type { TaskForm, TaskOutput } from "@/lib/tasks"
import type { Customer, CustomerDropdown, CustomerType, Member, Task, TaskStage, TaskType } from "@/lib/types"
import { CustomerPicker } from "./customer-picker"

export type FormControl = Control<TaskForm, unknown, TaskOutput>

// FormSection is a part of a sheet's form, named by its legend, as the
// prototype heads a group: «Mijoz», «Vazifa».
export function FormSection({ legend, children }: { legend: string; children: ReactNode }) {
  return (
    <fieldset className="min-w-0">
      <legend className="px-1 pb-2 text-base font-semibold text-heading">{legend}</legend>
      {children}
    </fieldset>
  )
}

// offered is what a choice field offers: the options of its dropdown that
// are not turned off, and those turned off since that the record has.
function offered(field: FormField, dropdowns: CustomerDropdown[], values?: Record<string, unknown>) {
  const answer = values?.[field.id]
  const has = (optionId: number) => (Array.isArray(answer) ? answer.includes(optionId) : answer === optionId)
  return (dropdowns.find((dropdown) => dropdown.id === field.dropdown_id)?.options ?? []).filter((o) => o.is_active || has(o.id))
}

// TaskFields is the task's own part of the form: the title, the deadline,
// the stage, the assignee (a member who works in the task's location,
// locationId), then the fields of its type in their order. task is the one
// being edited, if any: its answers keep the options turned off since, and
// its assignee stays offered after leaving the company or the location.
export function TaskFields({
  control,
  type,
  stages,
  members,
  dropdowns,
  locationId,
  task,
}: {
  control: FormControl
  type: TaskType
  stages: TaskStage[]
  members: Member[]
  dropdowns: CustomerDropdown[]
  locationId: number
  task?: Task
}) {
  return (
    <Group>
      <TextRow control={control} name="title" label="Nomi" autoComplete="off" placeholder="Masalan, qo'ng'iroq qilish" />
      {/* The phone's own calendar picks the day. */}
      <TextRow control={control} name="deadline" label="Muddat" type="date" />
      <SelectRow
        control={control}
        name="stage_id"
        label="Bosqich"
        placeholder="Tanlang"
        options={stages.map((stage) => ({ value: String(stage.id), label: stage.name }))}
      />
      <SelectRow control={control} name="assignee_phone" label="Mas'ul" none="Tanlanmagan" options={assigneeOptions(members, locationId, task)} />
      {type.fields.map((field) => (
        <FieldAnswer
          key={field.id}
          control={control}
          name={`values.${fieldKey(field)}`}
          field={field}
          options={offered(field, dropdowns, task?.values)}
        />
      ))}
    </Group>
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
  seed,
  onUnlink,
}: {
  name: string | null
  phone: string
  typeName?: string
  href: string
  seed: number
  onUnlink?: () => void
}) {
  const facts = [typeName, name ? formatPhone(phone) : null].filter((fact): fact is string => !!fact)
  return (
    <section aria-label="Mavjud mijoz" className="mb-6 flex items-center gap-3 rounded-group bg-card px-4 py-3">
      <Avatar name={name} seed={seed} />
      <span className="min-w-0 flex-1">
        <small className="block text-xs text-muted-foreground">Mavjud mijoz</small>
        <span className="block font-medium [overflow-wrap:anywhere]">{name ?? formatPhone(phone)}</span>
        {facts.length > 0 && <span className="block text-sm text-muted-foreground">{facts.join(" · ")}</span>}
        <Link href={href} className="text-sm font-medium text-primary">
          Mijozni ochish
        </Link>
      </span>
      {onUnlink && (
        <button type="button" onClick={onUnlink} className="h-[34px] shrink-0 rounded-full bg-primary-soft px-3.5 text-md font-semibold text-primary outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
          Boshqa mijoz
        </button>
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
  const fields = customerType?.fields ?? []
  return (
    <>
      {linked ? (
        <LinkedCustomerCard
          name={linkedName}
          phone={linked.phone}
          typeName={linkedType?.name}
          href={`/customers/${linked.id}`}
          seed={linked.id}
          onUnlink={onUnlink}
        />
      ) : (
        canCreate &&
        customerTypes.length > 1 && (
          <ChoiceChips
            label="Mijoz turi"
            value={customerType ? String(customerType.id) : ""}
            onChange={(value) => onChangeType(Number(value))}
            options={customerTypes.map((candidate) => ({ value: String(candidate.id), label: candidate.name }))}
          />
        )
      )}
      {/* A customer that is there is the card above: nothing more is asked
          about it. The form keeps what it was filled in with. */}
      {!linked && (
      <Group>
        <CustomerPicker
          control={control}
          name="customer.phone"
          companyId={companyId}
          types={customerTypes}
          onSelect={onLink}
        />
        {fields.map((field) => (
          <FieldAnswer
            key={field.id}
            control={control}
            name={`customer.values.${fieldKey(field)}`}
            field={field}
            options={offered(field, dropdowns)}
          />
        ))}
      </Group>
      )}
      {!linked && (
        <Foot className="-mt-4">
          {!canCreate
            ? "Yangi mijoz qo'shish ruxsatingiz yo'q: mavjud mijozni biriktiring."
            : customerTypes.length === 0
              ? "Mijoz turlari yo'q: faqat mavjud mijozni biriktirish mumkin."
              : "3 ta raqam yozsangiz, mavjud mijozlar taklif qilinadi. Topilmasa, yangi mijoz qo'shiladi."}
        </Foot>
      )}
    </>
  )
}

// TaskRefusal is the API's reason for turning a task down. A new customer's
// phone or answer that another customer has leads to that customer: it can
// be linked to the task at a press, or opened.
export function TaskRefusal({ error, onLink }: { error: Error; onLink: (customerId: number) => void }) {
  const other = error instanceof ApiError ? error.customerId : undefined
  return (
    <Refusal
      className="mb-4"
      actions={
        other !== undefined && (
          <>
            <button type="button" onClick={() => onLink(other)}>
              Shu mijozni biriktirish
            </button>
            <Link href={`/customers/${other}`}>Mijozni ochish</Link>
          </>
        )
      }
    >
      {error.message}
    </Refusal>
  )
}
