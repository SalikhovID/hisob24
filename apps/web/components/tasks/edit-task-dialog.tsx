"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { PencilIcon } from "lucide-react"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { PendingButton } from "@/components/pending-button"
import { Refusal } from "@/components/refusal"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { api, call } from "@/lib/api"
import { taskHistoryKey, taskKey, tasksKey } from "@/lib/queries"
import { type TaskForm, type TaskOutput, taskDefaults, taskSchema } from "@/lib/tasks"
import type { CustomerDropdown, Member, Task, TaskStage, TaskType } from "@/lib/types"
import { LinkedCustomerCard, TaskFields } from "./task-form"

// EditTaskDialog saves a task with another title, deadline, stage, assignee
// and answers. Its type and its customer were chosen when it was entered
// and stay: the dialog says so, shows the customer and asks the fields of
// that type. An answer left empty is taken away.
export function EditTaskDialog({
  companyId,
  task,
  type,
  stages,
  members,
  dropdowns,
}: {
  companyId: number
  task: Task
  type: TaskType
  stages: TaskStage[]
  members: Member[]
  dropdowns: CustomerDropdown[]
}) {
  const [open, setOpen] = useState(false)
  const queryClient = useQueryClient()
  const form = useForm<TaskForm, unknown, TaskOutput>({
    resolver: zodResolver(taskSchema(type, null, task.customer.id)),
    defaultValues: taskDefaults(type, null, null, task),
  })
  const save = useMutation({
    mutationFn: (edited: TaskOutput) =>
      call(
        api.PUT("/app/tasks/{id}", {
          params: { path: { id: task.id } },
          body: {
            title: edited.title,
            deadline: edited.deadline,
            stage_id: edited.stage_id,
            assignee_phone: edited.assignee_phone,
            values: edited.values,
          },
        }),
      ),
    onSuccess: (saved) => {
      // The page shows the answer at once; the lists and the history ask again.
      queryClient.setQueryData(taskKey(companyId, task.id), saved)
      queryClient.invalidateQueries({ queryKey: tasksKey(companyId) })
      queryClient.invalidateQueries({ queryKey: taskHistoryKey(companyId, task.id) })
      toast.success("Vazifa saqlandi")
      setOpen(false)
    },
  })

  // Every opening starts from the task as it is now.
  const changeOpen = (next: boolean) => {
    setOpen(next)
    if (next) {
      form.reset(taskDefaults(type, null, null, task))
      save.reset()
    }
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger render={<Button size="lg" className="px-3.5" />}>
        <PencilIcon />
        Tahrirlash
      </DialogTrigger>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Vazifani tahrirlash</DialogTitle>
          <DialogDescription>{type.name} · mijoz va tur o&apos;zgarmaydi</DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit((edited) => save.mutate(edited))} noValidate className="space-y-4">
          <div className="grid gap-6 md:grid-cols-2">
            <fieldset className="min-w-0">
              <legend className="mb-3 text-sm font-semibold">Mijoz</legend>
              <LinkedCustomerCard name={task.customer.name} phone={task.customer.phone} href={`/customers/${task.customer.id}`} />
            </fieldset>
            <fieldset className="min-w-0">
              <legend className="mb-3 text-sm font-semibold">Vazifa</legend>
              <TaskFields
                control={form.control}
                type={type}
                stages={stages}
                members={members}
                dropdowns={dropdowns}
                locationId={task.location_id}
                task={task}
              />
            </fieldset>
          </div>
          {save.isError && <Refusal>{save.error.message}</Refusal>}
          <DialogFooter>
            <PendingButton type="submit" size="lg" className="px-3.5 max-sm:h-10" pending={save.isPending}>
              Saqlash
            </PendingButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
