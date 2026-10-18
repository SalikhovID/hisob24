"use client"

import { useQueryClient } from "@tanstack/react-query"
import { LayersIcon } from "lucide-react"
import { useState } from "react"
import { Foot, Row } from "@/components/kit/group"
import { OrderedRows } from "@/components/kit/ordered-rows"
import { PageTitle, PlusButton } from "@/components/kit/page-title"
import { EmptyState, Failed, ListLoading } from "@/components/states"
import { Badge } from "@/components/ui/badge"
import { api, call } from "@/lib/api"
import { can } from "@/lib/permissions"
import { orderStagesKey, useOrderStages } from "@/lib/queries"
import { colorClasses, colorLabels } from "@/lib/stage-colors"
import type { Permission, OrderStage } from "@/lib/types"
import { usePermission } from "@/lib/use-gate"
import { inOrder, useReorder } from "@/lib/use-reorder"
import { cn } from "@/lib/utils"
import { DeleteDialog } from "./delete-button"
import { StageDialog } from "./stage-dialog"

// Sheet is what is open over the page: a stage being added, changed or deleted.
type Sheet = { add: true } | { edit: OrderStage } | { remove: OrderStage }

// StagesPage is the company's stages in the order the owner put them in
// (the board's columns, left to right), for whoever may see the settings,
// as the prototype's page: each a row with its color's dot and name, the
// final one marked; a row opens the stage's sheet (settings.edit: its name,
// color and final mark; settings.delete: the way to delete it); the plus
// adds one (settings.create); the «Tartiblash» mode orders them (settings.edit).
export function StagesPage() {
  const gate = usePermission("settings.view")
  const companyId = gate?.company.id ?? null
  const allowed = (permission: Permission) => can(gate?.permissions, permission)
  const stages = useOrderStages(companyId)
  const queryClient = useQueryClient()
  const queryKey = orderStagesKey(companyId)
  const refresh = () => queryClient.invalidateQueries({ queryKey })
  const reorder = useReorder<OrderStage[]>(queryKey, inOrder, (ids) => call(api.PUT("/app/order-stages/order", { body: { ids } })))
  const [sheet, setSheet] = useState<Sheet | null>(null)
  const close = (open: boolean) => !open && setSheet(null)

  if (!gate) return null
  const open = (stage: OrderStage) => (allowed("settings.edit") ? () => setSheet({ edit: stage }) : allowed("settings.delete") ? () => setSheet({ remove: stage }) : undefined)
  return (
    <>
      <PageTitle
        title="Bosqichlar"
        description="Kanban ustunlari. Vazifa shulardan birida turadi."
        back={{ href: "/settings", label: "Sozlamalar" }}
        action={allowed("settings.create") && <PlusButton label="Bosqich qo'shish" onClick={() => setSheet({ add: true })} />}
      />
      {stages.isPending && <ListLoading rows={3} mark="none" />}
      {stages.isError && <Failed error={stages.error} onRetry={() => stages.refetch()} />}
      {stages.data?.length === 0 && <EmptyState icon={LayersIcon} title="Hali bosqich yo'q" description="Vazifa qo'shish uchun kamida bitta bosqich kerak." />}
      {stages.data && stages.data.length > 0 && (
        <>
          <OrderedRows
            label="Bosqichlar"
            heading={`${stages.data.length} ta bosqich`}
            items={stages.data}
            getId={(stage) => String(stage.id)}
            getLabel={(stage) => stage.name}
            onReorder={(ids) => reorder.mutate(ids.map(Number))}
            canOrder={allowed("settings.edit")}
            row={(stage, handle) => {
              const dot = <span aria-hidden="true" className={cn("size-3 shrink-0 rounded-full", colorClasses[stage.color].dot)} />
              const final = stage.is_done && <Badge variant="green">Yakuniy</Badge>
              return handle ? (
                <Row
                  compact
                  media={
                    <>
                      {handle}
                      {dot}
                    </>
                  }
                  title={stage.name}
                  badge={final}
                  sub={colorLabels[stage.color]}
                />
              ) : (
                <Row onClick={open(stage)} media={dot} title={stage.name} badge={final} sub={colorLabels[stage.color]} chevron={open(stage) !== undefined} />
              )
            }}
          />
          <Foot className="-mt-4">Yakuniy bosqichdagi vazifa bajarilgan hisoblanadi va kanbanda yig&apos;ilgan ustunda turadi.</Foot>
        </>
      )}
      {sheet && "add" in sheet && (
        <StageDialog
          title="Bosqich qo'shish"
          description="Masalan: Yangi, Jarayonda, Bajarildi. Bosqich ro'yxat oxiriga qo'shiladi."
          submit="Qo'shish"
          done="Bosqich qo'shildi"
          open
          onOpenChange={close}
          onSubmit={async (stage) => {
            await call(api.POST("/app/order-stages", { body: stage }))
            await refresh()
          }}
        />
      )}
      {sheet && "edit" in sheet && (
        <StageDialog
          title="Bosqichni tahrirlash"
          description="Bu bosqichdagi vazifalar o'z joyida qoladi."
          initial={{ name: sheet.edit.name, color: sheet.edit.color, is_done: sheet.edit.is_done }}
          submit="Saqlash"
          done="Bosqich saqlandi"
          open
          onOpenChange={close}
          onDelete={allowed("settings.delete") ? () => setSheet({ remove: sheet.edit }) : undefined}
          onSubmit={async (edited) => {
            await call(api.PATCH("/app/order-stages/{id}", { params: { path: { id: sheet.edit.id } }, body: edited }))
            await refresh()
          }}
        />
      )}
      {sheet && "remove" in sheet && (
        <DeleteDialog
          title="Bosqichni o'chirasizmi?"
          description={`«${sheet.remove.name}» bosqichi o'chadi. Vazifasi bor bosqich o'chirilmaydi.`}
          done="Bosqich o'chirildi"
          onDelete={async () => {
            await call(api.DELETE("/app/order-stages/{id}", { params: { path: { id: sheet.remove.id } } }))
            await refresh()
          }}
          open
          onOpenChange={close}
        />
      )}
    </>
  )
}
