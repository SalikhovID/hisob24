import { expect, test } from "vitest"
import type { Member, Task } from "./types"
import { assigneeOptions, worksIn } from "./members"

const member = (phone: string, name: string, locations: Member["locations"]): Member => ({
  phone,
  full_name: name,
  role: "user",
  role_id: null,
  role_name: null,
  locations,
  created_at: "2026-10-01T05:00:00Z",
})
const ali = member("998901234567", "Ali Valiyev", null)
const vali = member("998902223344", "Vali Aliyev", [{ id: 2, name: "Chilonzor" }])
const sardor = member("998903334455", "Sardor Karimov", [])

test("worksIn: a member without a restriction works everywhere, a restricted one in the restriction's locations", () => {
  expect(worksIn(ali, 1)).toBe(true)
  expect(worksIn(vali, 2)).toBe(true)
  expect(worksIn(vali, 1)).toBe(false)
  expect(worksIn(sardor, 1)).toBe(false)
})

test("assigneeOptions offers the members who work in the location, by name or phone", () => {
  expect(assigneeOptions([ali, vali, sardor], 2)).toEqual([
    { value: "998901234567", label: "Ali Valiyev" },
    { value: "998902223344", label: "Vali Aliyev" },
  ])
  expect(assigneeOptions([{ ...vali, full_name: null }], 2)).toEqual([{ value: "998902223344", label: "+998 90 222 33 44" }])
})

test("assigneeOptions keeps a task's assignee who works elsewhere now, or who left, so the edit may keep them", () => {
  const task = { assignee: { phone: "998902223344", full_name: "Vali Aliyev" } } as Task
  expect(assigneeOptions([ali, vali], 1, task)).toEqual([
    { value: "998901234567", label: "Ali Valiyev" },
    { value: "998902223344", label: "Vali Aliyev (bu lokatsiyada ishlamaydi)" },
  ])
  expect(assigneeOptions([ali], 1, task)).toEqual([
    { value: "998901234567", label: "Ali Valiyev" },
    { value: "998902223344", label: "Vali Aliyev (chiqarilgan)" },
  ])
  expect(assigneeOptions([ali, vali], 2, task)).toEqual([
    { value: "998901234567", label: "Ali Valiyev" },
    { value: "998902223344", label: "Vali Aliyev" },
  ])
  expect(assigneeOptions([ali], 1, { assignee: null } as Task)).toEqual([{ value: "998901234567", label: "Ali Valiyev" }])
})
