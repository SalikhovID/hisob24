"use client"

import { useQueryClient } from "@tanstack/react-query"
import { PencilIcon, PlusIcon } from "lucide-react"
import Link from "next/link"
import { type ReactNode, useId } from "react"
import { PageHeader } from "@/components/page-header"
import { SortableList } from "@/components/sortable-list"
import { EmptyState, Failed, ListLoading } from "@/components/states"
import { Button } from "@/components/ui/button"
import { api, call } from "@/lib/api"
import { customerDropdownsKey, customerTypesKey, useCustomerDropdowns, useCustomerTypes } from "@/lib/queries"
import type { CustomerType } from "@/lib/types"
import { useOwner } from "@/lib/use-owner"
import { inOrder, useReorder } from "@/lib/use-reorder"
import { DeleteButton } from "./delete-button"
import { NameDialog } from "./name-dialog"
import { iconAction, SettingRow, settingList } from "./setting-row"

const link = "rounded-sm underline-offset-4 hover:underline"

// SettingsPage is where the company's owner sets up what its customers are
// asked: the customer types with their fields, and the dropdowns the choice
// fields take their options from. A type and a dropdown open on a page of
// their own.
export function SettingsPage() {
  const owner = useOwner()
  if (!owner) return null

  return (
    <div className="space-y-8">
      <PageHeader title="Sozlamalar" description="Mijozlar bo'limi sozlamalari" />
      <CustomerTypes companyId={owner.company.id} />
      <Dropdowns companyId={owner.company.id} />
    </div>
  )
}

// CustomerTypes is the company's customer types in the order the owner put
// them in: the order of the type buttons when a customer is added.
function CustomerTypes({ companyId }: { companyId: number }) {
  const types = useCustomerTypes(companyId)
  const queryClient = useQueryClient()
  const queryKey = customerTypesKey(companyId)
  // What a change did shows once the list is asked for again.
  const refresh = () => queryClient.invalidateQueries({ queryKey })
  const reorder = useReorder<CustomerType[]>(queryKey, inOrder, (ids) =>
    call(api.PUT("/app/customer-types/order", { body: { ids } })),
  )

  return (
    <Section
      title="Mijoz turlari"
      description="Mijoz qo'shishda tanlanadi. Har turning o'z maydonlari bor."
      action={
        <NameDialog
          title="Tur qo'shish"
          description="Masalan: Jismoniy, Yuridik. Maydonlari tur sahifasida qo'shiladi."
          submit="Qo'shish"
          done="Tur qo'shildi"
          trigger={
            <Button variant="outline" size="lg" className="px-3.5">
              <PlusIcon />
              Tur qo&apos;shish
            </Button>
          }
          onSubmit={async (name) => {
            await call(api.POST("/app/customer-types", { body: { name } }))
            await refresh()
          }}
        />
      }
    >
      {types.isPending && <ListLoading rows={2} mark="none" />}
      {types.isError && <Failed error={types.error} onRetry={() => types.refetch()} />}
      {types.data?.length === 0 && (
        <EmptyState title="Hali tur yo'q" description="Mijoz qo'shish uchun kamida bitta tur kerak." />
      )}
      {types.data && types.data.length > 0 && (
        <SortableList
          label="Mijoz turlari"
          items={types.data}
          getId={(type) => String(type.id)}
          getLabel={(type) => type.name}
          onReorder={(ids) => reorder.mutate(ids.map(Number))}
          className={settingList}
          renderItem={(type, handle) => (
            <SettingRow
              handle={handle}
              title={
                <Link href={`/settings/customer-types/${type.id}`} className={link}>
                  {type.name}
                </Link>
              }
              detail={type.fields.map((field) => field.label).join(", ")}
              actions={
                <>
                  <NameDialog
                    title="Tur nomini o'zgartirish"
                    description="Turning maydonlari va shu turdagi mijozlar o'zgarmaydi."
                    initial={type.name}
                    submit="Saqlash"
                    done="Tur nomi o'zgartirildi"
                    tooltip="Nomini o'zgartirish"
                    trigger={
                      <Button
                        variant="ghost"
                        size="icon"
                        className={iconAction}
                        aria-label={`Nomini o'zgartirish: ${type.name}`}
                      >
                        <PencilIcon />
                      </Button>
                    }
                    onSubmit={async (name) => {
                      await call(api.PATCH("/app/customer-types/{id}", { params: { path: { id: type.id } }, body: { name } }))
                      await refresh()
                    }}
                  />
                  <DeleteButton
                    label={`O'chirish: ${type.name}`}
                    title="Turni o'chirasizmi?"
                    description={`«${type.name}» turi va uning maydonlari o'chadi. Mijozi bor tur o'chirilmaydi.`}
                    done="Tur o'chirildi"
                    onDelete={async () => {
                      await call(api.DELETE("/app/customer-types/{id}", { params: { path: { id: type.id } } }))
                      await refresh()
                    }}
                  />
                </>
              }
            />
          )}
        />
      )}
    </Section>
  )
}

// Dropdowns is the company's dropdowns, in the order they were made.
function Dropdowns({ companyId }: { companyId: number }) {
  const dropdowns = useCustomerDropdowns(companyId)
  const queryClient = useQueryClient()
  const refresh = () => queryClient.invalidateQueries({ queryKey: customerDropdownsKey(companyId) })

  return (
    <Section
      title="Dropdownlar"
      description="Tanlov maydonlari variantlarni shu ro'yxatlardan oladi."
      action={
        <NameDialog
          title="Dropdown qo'shish"
          description="Masalan: Manba. Variantlari dropdown sahifasida qo'shiladi."
          submit="Qo'shish"
          done="Dropdown qo'shildi"
          trigger={
            <Button variant="outline" size="lg" className="px-3.5">
              <PlusIcon />
              Dropdown qo&apos;shish
            </Button>
          }
          onSubmit={async (name) => {
            await call(api.POST("/app/customer-dropdowns", { body: { name } }))
            await refresh()
          }}
        />
      }
    >
      {dropdowns.isPending && <ListLoading rows={2} mark="none" />}
      {dropdowns.isError && <Failed error={dropdowns.error} onRetry={() => dropdowns.refetch()} />}
      {dropdowns.data?.length === 0 && (
        <EmptyState
          title="Hali dropdown yo'q"
          description="Dropdown, radio va checkbox maydonlari variantlarni dropdowndan oladi."
        />
      )}
      {dropdowns.data && dropdowns.data.length > 0 && (
        <ul aria-label="Dropdownlar" className={settingList}>
          {dropdowns.data.map((dropdown) => (
            <li key={dropdown.id}>
              <SettingRow
                title={
                  <Link href={`/settings/dropdowns/${dropdown.id}`} className={link}>
                    {dropdown.name}
                  </Link>
                }
                detail={dropdown.options.map((option) => option.label).join(", ")}
                actions={
                  <NameDialog
                    title="Dropdown nomini o'zgartirish"
                    description="Variantlari va uni ishlatadigan maydonlar o'zgarmaydi."
                    initial={dropdown.name}
                    submit="Saqlash"
                    done="Dropdown nomi o'zgartirildi"
                    tooltip="Nomini o'zgartirish"
                    trigger={
                      <Button
                        variant="ghost"
                        size="icon"
                        className={iconAction}
                        aria-label={`Nomini o'zgartirish: ${dropdown.name}`}
                      >
                        <PencilIcon />
                      </Button>
                    }
                    onSubmit={async (name) => {
                      await call(
                        api.PATCH("/app/customer-dropdowns/{id}", { params: { path: { id: dropdown.id } }, body: { name } }),
                      )
                      await refresh()
                    }}
                  />
                }
              />
            </li>
          ))}
        </ul>
      )}
    </Section>
  )
}

// Section is a part of the page with a heading of its own: what it holds,
// a line on what that is for and, beside them, what can be added to it.
function Section({
  title,
  description,
  action,
  children,
}: {
  title: string
  description: string
  action?: ReactNode
  children: ReactNode
}) {
  const id = useId()
  return (
    <section aria-labelledby={id} className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <h2 id={id} className="text-base font-semibold">
            {title}
          </h2>
          <p className="text-sm text-pretty text-muted-foreground">{description}</p>
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}
