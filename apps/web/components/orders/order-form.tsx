"use client"

import Link from "next/link"
import { type ReactNode, useEffect } from "react"
import { type Control, type UseFormReturn, useWatch } from "react-hook-form"
import { FieldAnswer } from "@/components/field-answer"
import { Avatar } from "@/components/kit/avatar"
import { ChoiceChips } from "@/components/kit/chips"
import { AmountRow, TextRow } from "@/components/kit/form-row"
import { Foot, Group } from "@/components/kit/group"
import { SelectRow } from "@/components/kit/picker-sheet"
import { Refusal } from "@/components/refusal"
import { LinesField } from "@/components/warehouse/lines-field"
import { PaymentsField } from "@/components/warehouse/payments-field"
import { ApiError } from "@/lib/api"
import { currencyOf, currencyOptions, isMulti, trimRate, useAccounts, useCurrencies, UZS } from "@/lib/currencies"
import { customerName } from "@/lib/customers"
import { fieldKey, type FormField } from "@/lib/fields"
import { assigneeOptions } from "@/lib/members"
import { formatPhone } from "@/lib/phone"
import type { OrderForm, OrderOutput } from "@/lib/orders"
import type { Customer, CustomerDropdown, CustomerType, Member, Order, OrderStage, OrderType } from "@/lib/types"
import { CustomerPicker } from "./customer-picker"

export type FormControl = Control<OrderForm, unknown, OrderOutput>

// FormSection is a part of a sheet's form, named by its legend, as the
// prototype heads a group: «Mijoz», «Buyurtma».
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

// OrderFields is the order's own part of the form: the deadline,
// the stage, the assignee (a member who works in the order's location,
// locationId), then the fields of its type in their order. order is the one
// being edited, if any: its answers keep the options turned off since, and
// its assignee stays offered after leaving the company or the location.
export function OrderFields({
  control,
  type,
  stages,
  members,
  dropdowns,
  locationId,
  order,
}: {
  control: FormControl
  type: OrderType
  stages: OrderStage[]
  members: Member[]
  dropdowns: CustomerDropdown[]
  locationId: number
  order?: Order
}) {
  return (
    <Group>
      {/* The phone's own calendar picks the day. */}
      <TextRow control={control} name="deadline" label="Muddat" type="date" />
      <SelectRow
        control={control}
        name="stage_id"
        label="Bosqich"
        placeholder="Tanlang"
        options={stages.map((stage) => ({ value: String(stage.id), label: stage.name }))}
      />
      <SelectRow control={control} name="assignee_phone" label="Mas'ul" none="Tanlanmagan" options={assigneeOptions(members, locationId, order)} />
      {type.fields.map((field) => (
        <FieldAnswer
          key={field.id}
          control={control}
          name={`values.${fieldKey(field)}`}
          field={field}
          options={offered(field, dropdowns, order?.values)}
        />
      ))}
    </Group>
  )
}

// MoneySection is the order's money in the form (logic/orders.md, 4.3): the
// price (with another currency than the so'm, the currency and its rate,
// the standard one offered), the lines of goods (products and services,
// without prices; for whoever may pick the products) and, on entry
// (withPayments), the advance's payments. locationName says where the
// goods come from.
export function MoneySection({
  form,
  companyId,
  withPayments,
  canPickProducts,
  locationName,
}: {
  form: UseFormReturn<OrderForm, unknown, OrderOutput>
  companyId: number
  withPayments: boolean
  canPickProducts: boolean
  locationName?: string
}) {
  const currencies = useCurrencies()
  const accounts = useAccounts()
  const currencyId = Number(useWatch({ control: form.control, name: "currency_id" })) || UZS
  const amount = useWatch({ control: form.control, name: "amount" })
  const currency = currencyOf(currencies, currencyId)

  // Another currency: its standard rate is offered while none is typed.
  useEffect(() => {
    if (currencyId === UZS || form.getValues("rate") !== "") return
    const rate = currencyOf(currencies, currencyId).rate
    if (rate !== null) form.setValue("rate", trimRate(rate))
  }, [currencyId, currencies, form])

  return (
    <>
      <Group>
        <AmountRow control={form.control} name="amount" label="Narx" suffix={currency.symbol} placeholder="narxsiz" />
        {isMulti(currencies) && <SelectRow control={form.control} name="currency_id" label="Valyuta" options={currencyOptions(currencies)} />}
        {isMulti(currencies) && currencyId !== UZS && (
          <AmountRow control={form.control} name="rate" label={`1 ${currency.code} = ? so'm`} placeholder="kurs" suffix={null} />
        )}
      </Group>
      <Foot className="-mt-4">
        {withPayments ? "Narx mijoz qarziga yoziladi, avans uni kamaytiradi" : "Narx mijoz qarziga yoziladi; to'lovlar buyurtma sahifasida"}
        {canPickProducts && locationName ? `; mahsulotlar «${locationName}» qoldig'idan chiqadi.` : "."}
      </Foot>
      {canPickProducts && <LinesField form={form} companyId={companyId} withPrice={false} currencyId={currencyId} pending={form.formState.isSubmitting} kinds={["product", "service"]} />}
      {withPayments && (
        <PaymentsField form={form} accounts={accounts} currencies={currencies} documentCurrency={currencyId} total={Number(amount.replace(/\s/g, "").replace(",", ".")) || 0} pending={form.formState.isSubmitting} heading="Avans" />
      )}
    </>
  )
}

// LinkedCustomerCard shows the customer an order is for, once it is known, on
// frosted glass:
// the name (or the phone), the type and the phone, the way to its page and,
// where the customer may still be let go (a new order), the way to do so.
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
    <section aria-label="Mavjud mijoz" className="mb-6 flex items-center gap-3 rounded-group surface px-4 py-3">
      <Avatar name={name} />
      <span className="min-w-0 flex-1">
        <small className="block text-xs text-muted-foreground">Mavjud mijoz</small>
        <span className="block font-medium [overflow-wrap:anywhere]">{name ?? formatPhone(phone)}</span>
        {facts.length > 0 && <span className="block text-sm text-muted-foreground">{facts.join(" · ")}</span>}
        <Link href={href} className="text-sm font-medium text-primary">
          Mijozni ochish
        </Link>
      </span>
      {onUnlink && (
        <button type="button" onClick={onUnlink} className="h-[34px] shrink-0 rounded-full glass-chip px-3.5 text-md font-semibold text-primary outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
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

// OrderRefusal is the API's reason for turning an order down. A new customer's
// phone or answer that another customer has leads to that customer: it can
// be linked to the order at a press, or opened.
export function OrderRefusal({ error, onLink }: { error: Error; onLink: (customerId: number) => void }) {
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
