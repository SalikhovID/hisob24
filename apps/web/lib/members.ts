import type { SelectOption } from "@/components/select-field"
import { formatPhone } from "./phone"
import type { Member, Task } from "./types"

// worksIn tells whether the member may work in the location
// (logic/locations.md, section 5): everywhere unless restricted, in the
// restriction's locations otherwise.
export function worksIn(member: Member, locationId: number): boolean {
  return member.locations === null || member.locations.some((l) => l.id === locationId)
}

// nameOf is how a member is offered: by name, or by phone without one.
const nameOf = (member: { phone: string; full_name: string | null }) => member.full_name ?? formatPhone(member.phone)

// assigneeOptions is who a task in the location may be assigned to: the
// members who work there. The assignee a task has stays offered as long as
// the edit keeps them (logic/tasks.md, 4.2): one who works elsewhere now,
// and one who left the company, each said so.
export function assigneeOptions(members: Member[], locationId: number, task?: Task): SelectOption[] {
  const options = members.filter((member) => worksIn(member, locationId)).map((member) => ({ value: member.phone, label: nameOf(member) }))
  const assignee = task?.assignee
  if (assignee && !options.some((option) => option.value === assignee.phone)) {
    const still = members.some((member) => member.phone === assignee.phone)
    options.push({ value: assignee.phone, label: `${nameOf(assignee)} (${still ? "bu lokatsiyada ishlamaydi" : "chiqarilgan"})` })
  }
  return options
}
