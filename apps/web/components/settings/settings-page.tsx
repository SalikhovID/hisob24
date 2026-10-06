"use client"

import { useQueryClient } from "@tanstack/react-query"
import { PencilIcon, PlusIcon } from "lucide-react"
import Link from "next/link"
import { type ReactNode, useId } from "react"
import { PageHeader } from "@/components/page-header"
import { SortableList } from "@/components/sortable-list"
import { EmptyState, Failed, ListLoading } from "@/components/states"
import { StageDot } from "@/components/tasks/stage-dot"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { api, call } from "@/lib/api"
import {
  customerDropdownsKey,
  customerTypesKey,
  taskStagesKey,
  taskTypesKey,
  useCustomerDropdowns,
  useCustomerTypes,
  useTaskStages,
  useTaskTypes,
} from "@/lib/queries"
import { can } from "@/lib/permissions"
import type { CustomerType, Permission, TaskStage, TaskType } from "@/lib/types"
import { usePermission } from "@/lib/use-gate"
import { inOrder, useReorder } from "@/lib/use-reorder"
import { DeleteButton } from "./delete-button"
import { NameDialog } from "./name-dialog"
import { iconAction, SettingRow, settingList } from "./setting-row"
import { StageDialog } from "./stage-dialog"
import { asTab, useSettingsTab } from "./use-settings-tab"

const link = "rounded-sm underline-offset-4 hover:underline"

// A tab is quiet until it is the chosen one, which then stands out as a card
// on the muted strip (the customers' and the tasks' tabs).
const tab = "px-3 text-muted-foreground data-active:bg-card"

// SettingsPage is where what the company's customers and its tasks are
// asked is set up, by the owner or an employee whose role holds
// settings.view (adding, changing and deleting each take their own
// permission), in three tabs: the customer types with their fields;
// the task types with theirs and the stages the tasks go through; and the
// dropdowns the choice fields of both take their options from. The open tab
// is in the address. A type and a dropdown open on a page of their own.
export function SettingsPage() {
  const gate = usePermission("settings.view")
  const [open, select] = useSettingsTab()
  if (!gate) return null
  const companyId = gate.company.id
  const permissions = gate.permissions

  return (
    <div className="space-y-5">
      <PageHeader title="Sozlamalar" description="Mijozlar va vazifalar sozlamalari" />
      <Tabs value={open} onValueChange={(value) => select(asTab(value))} className="gap-5">
        {/* The strip of tabs scrolls sideways on a narrow screen rather than squeezing. */}
        <div className="-mx-1 min-w-0 overflow-x-auto px-1 py-0.5 scrollbar-hide">
          <TabsList aria-label="Sozlamalar bo'limlari" className="group-data-horizontal/tabs:h-9 max-sm:min-w-full">
            <TabsTrigger value="customers" className={tab}>
              Mijozlar
            </TabsTrigger>
            <TabsTrigger value="tasks" className={tab}>
              Vazifalar
            </TabsTrigger>
            <TabsTrigger value="dropdowns" className={tab}>
              Dropdownlar
            </TabsTrigger>
          </TabsList>
        </div>
        {/* A panel keeps the page's text size: its lists set their own. */}
        <TabsContent value="customers" className="space-y-8 text-base">
          <CustomerTypes companyId={companyId} permissions={permissions} />
        </TabsContent>
        <TabsContent value="tasks" className="space-y-8 text-base">
          <TaskTypes companyId={companyId} permissions={permissions} />
          <Stages companyId={companyId} permissions={permissions} />
        </TabsContent>
        <TabsContent value="dropdowns" className="space-y-8 text-base">
          <Dropdowns companyId={companyId} permissions={permissions} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

// SectionProps is what a section of the settings works with: the company and
// what the member may do to the settings.
interface SectionProps {
  companyId: number
  permissions: Permission[]
}

// CustomerTypes is the company's customer types in the order the owner put
// them in: the order of the type buttons when a customer is added.
function CustomerTypes({ companyId, permissions }: SectionProps) {
  const allowed = (permission: Permission) => can(permissions, permission)
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
        allowed("settings.create") && (
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
        )
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
          disabled={!allowed("settings.edit")}
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
                  {allowed("settings.edit") && (
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
                  )}
                  {allowed("settings.delete") && (
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
                  )}
                </>
              }
            />
          )}
        />
      )}
    </Section>
  )
}

// TaskTypes is the company's task types in the order the owner put them in:
// the order of the type buttons when a task is added.
function TaskTypes({ companyId, permissions }: SectionProps) {
  const allowed = (permission: Permission) => can(permissions, permission)
  const types = useTaskTypes(companyId)
  const queryClient = useQueryClient()
  const queryKey = taskTypesKey(companyId)
  const refresh = () => queryClient.invalidateQueries({ queryKey })
  const reorder = useReorder<TaskType[]>(queryKey, inOrder, (ids) => call(api.PUT("/app/task-types/order", { body: { ids } })))

  return (
    <Section
      title="Vazifa turlari"
      description="Vazifa qo'shishda tanlanadi. Har turning o'z maydonlari bor."
      action={
        allowed("settings.create") && (
        <NameDialog
          title="Vazifa turi qo'shish"
          description="Masalan: Buyurtma, Shikoyat. Maydonlari tur sahifasida qo'shiladi."
          submit="Qo'shish"
          done="Vazifa turi qo'shildi"
          trigger={
            <Button variant="outline" size="lg" className="px-3.5">
              <PlusIcon />
              Vazifa turi qo&apos;shish
            </Button>
          }
          onSubmit={async (name) => {
            await call(api.POST("/app/task-types", { body: { name } }))
            await refresh()
          }}
        />
        )
      }
    >
      {types.isPending && <ListLoading rows={2} mark="none" />}
      {types.isError && <Failed error={types.error} onRetry={() => types.refetch()} />}
      {types.data?.length === 0 && (
        <EmptyState title="Hali vazifa turi yo'q" description="Vazifa qo'shish uchun kamida bitta tur kerak." />
      )}
      {types.data && types.data.length > 0 && (
        <SortableList
          label="Vazifa turlari"
          items={types.data}
          getId={(type) => String(type.id)}
          getLabel={(type) => type.name}
          onReorder={(ids) => reorder.mutate(ids.map(Number))}
          className={settingList}
          disabled={!allowed("settings.edit")}
          renderItem={(type, handle) => (
            <SettingRow
              handle={handle}
              title={
                <Link href={`/settings/task-types/${type.id}`} className={link}>
                  {type.name}
                </Link>
              }
              detail={type.fields.map((field) => field.label).join(", ")}
              actions={
                <>
                  {allowed("settings.edit") && (
                  <NameDialog
                    title="Vazifa turi nomini o'zgartirish"
                    description="Turning maydonlari va shu turdagi vazifalar o'zgarmaydi."
                    initial={type.name}
                    submit="Saqlash"
                    done="Vazifa turi nomi o'zgartirildi"
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
                      await call(api.PATCH("/app/task-types/{id}", { params: { path: { id: type.id } }, body: { name } }))
                      await refresh()
                    }}
                  />
                  )}
                  {allowed("settings.delete") && (
                  <DeleteButton
                    label={`O'chirish: ${type.name}`}
                    title="Vazifa turini o'chirasizmi?"
                    description={`«${type.name}» turi va uning maydonlari o'chadi. Vazifasi bor tur o'chirilmaydi.`}
                    done="Vazifa turi o'chirildi"
                    onDelete={async () => {
                      await call(api.DELETE("/app/task-types/{id}", { params: { path: { id: type.id } } }))
                      await refresh()
                    }}
                  />
                  )}
                </>
              }
            />
          )}
        />
      )}
    </Section>
  )
}

// Stages is the company's stages in the order the owner put them in: the
// columns of the board, left to right.
function Stages({ companyId, permissions }: SectionProps) {
  const allowed = (permission: Permission) => can(permissions, permission)
  const stages = useTaskStages(companyId)
  const queryClient = useQueryClient()
  const queryKey = taskStagesKey(companyId)
  const refresh = () => queryClient.invalidateQueries({ queryKey })
  const reorder = useReorder<TaskStage[]>(queryKey, inOrder, (ids) => call(api.PUT("/app/task-stages/order", { body: { ids } })))

  return (
    <Section
      title="Bosqichlar"
      description="Kanban ustunlari. Vazifa shulardan birida turadi."
      action={
        allowed("settings.create") && (
        <StageDialog
          title="Bosqich qo'shish"
          description="Masalan: Yangi, Jarayonda, Bajarildi. Bosqich ro'yxat oxiriga qo'shiladi."
          submit="Qo'shish"
          done="Bosqich qo'shildi"
          trigger={
            <Button variant="outline" size="lg" className="px-3.5">
              <PlusIcon />
              Bosqich qo&apos;shish
            </Button>
          }
          onSubmit={async (stage) => {
            await call(api.POST("/app/task-stages", { body: stage }))
            await refresh()
          }}
        />
        )
      }
    >
      {stages.isPending && <ListLoading rows={3} mark="none" />}
      {stages.isError && <Failed error={stages.error} onRetry={() => stages.refetch()} />}
      {stages.data?.length === 0 && (
        <EmptyState title="Hali bosqich yo'q" description="Vazifa qo'shish uchun kamida bitta bosqich kerak." />
      )}
      {stages.data && stages.data.length > 0 && (
        <SortableList
          label="Bosqichlar"
          items={stages.data}
          getId={(stage) => String(stage.id)}
          getLabel={(stage) => stage.name}
          onReorder={(ids) => reorder.mutate(ids.map(Number))}
          className={settingList}
          disabled={!allowed("settings.edit")}
          renderItem={(stage, handle) => (
            <SettingRow
              handle={handle}
              lead={<StageDot color={stage.color} />}
              title={stage.name}
              marks={stage.is_done && <Badge variant="secondary">Yakuniy</Badge>}
              actions={
                <>
                  {allowed("settings.edit") && (
                  <StageDialog
                    title="Bosqichni tahrirlash"
                    description="Bu bosqichdagi vazifalar o'z joyida qoladi."
                    initial={{ name: stage.name, color: stage.color, is_done: stage.is_done }}
                    submit="Saqlash"
                    done="Bosqich saqlandi"
                    tooltip="Tahrirlash"
                    trigger={
                      <Button variant="ghost" size="icon" className={iconAction} aria-label={`Tahrirlash: ${stage.name}`}>
                        <PencilIcon />
                      </Button>
                    }
                    onSubmit={async (edited) => {
                      await call(api.PATCH("/app/task-stages/{id}", { params: { path: { id: stage.id } }, body: edited }))
                      await refresh()
                    }}
                  />
                  )}
                  {allowed("settings.delete") && (
                  <DeleteButton
                    label={`O'chirish: ${stage.name}`}
                    title="Bosqichni o'chirasizmi?"
                    description={`«${stage.name}» bosqichi o'chadi. Vazifasi bor bosqich o'chirilmaydi.`}
                    done="Bosqich o'chirildi"
                    onDelete={async () => {
                      await call(api.DELETE("/app/task-stages/{id}", { params: { path: { id: stage.id } } }))
                      await refresh()
                    }}
                  />
                  )}
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
function Dropdowns({ companyId, permissions }: SectionProps) {
  const allowed = (permission: Permission) => can(permissions, permission)
  const dropdowns = useCustomerDropdowns(companyId)
  const queryClient = useQueryClient()
  const refresh = () => queryClient.invalidateQueries({ queryKey: customerDropdownsKey(companyId) })

  return (
    <Section
      title="Dropdownlar"
      description="Mijoz va vazifa maydonlari variantlarni shu ro'yxatlardan oladi."
      action={
        allowed("settings.create") && (
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
        )
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
                  <>
                    {allowed("settings.edit") && (
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
                    )}
                    {allowed("settings.delete") && (
                    <DeleteButton
                      label={`O'chirish: ${dropdown.name}`}
                      title="Dropdownni o'chirasizmi?"
                      description={`«${dropdown.name}» va uning variantlari o'chadi. Maydonga ulangan dropdown o'chirilmaydi.`}
                      done="Dropdown o'chirildi"
                      onDelete={async () => {
                        await call(api.DELETE("/app/customer-dropdowns/{id}", { params: { path: { id: dropdown.id } } }))
                        await refresh()
                      }}
                    />
                    )}
                  </>
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
