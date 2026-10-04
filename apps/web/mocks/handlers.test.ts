// The mock API has to answer /app/employees the way the Go API does, or the
// pages tested against it would be tested against something else
// (logic/user.md, logic/roles.md; backend/internal/app/employees_test.go).
import { expect, test } from "vitest"
import { api, call } from "@/lib/api"
import { chooseCompany, signIn } from "@/test/session"
import { ALI, db, nameIn, SARDOR, VALI, ZARINA } from "./data"

const list = () => call(api.GET("/app/employees"))
const add = (phone: string, fullName: string) =>
  call(api.POST("/app/employees", { body: { phone, full_name: fullName } }))
const rename = (phone: string, fullName: string) =>
  call(api.PATCH("/app/employees/{phone}", { params: { path: { phone } }, body: { full_name: fullName } }))
const remove = (phone: string) => call(api.DELETE("/app/employees/{phone}", { params: { path: { phone } } }))
const failure = (request: Promise<unknown>) =>
  request.then(
    () => null,
    (error: unknown) => error,
  )

test("the owner gets the company's members: the owner first, then the users as they joined", async () => {
  await signIn(ALI)

  const members = await list()

  expect(members.map((m) => [m.phone, m.full_name, m.role])).toEqual([
    [ALI, "Ali Valiyev", "owner"],
    [VALI, "Vali Aliyev", "user"],
    [SARDOR, "Sardor Karimov", "user"],
  ])
  expect(members[0].created_at).toMatch(/^\d{4}-\d{2}-\d{2}T/)
})

test("an employee, and a session with no company chosen, get 403 owner_only", async () => {
  await signIn(VALI)
  expect(await failure(list())).toMatchObject({ status: 403, code: "owner_only" })

  await chooseCompany(1)
  expect(await failure(list())).toMatchObject({
    status: 403,
    code: "owner_only",
    message: "Bu bo'lim faqat kompaniya egasi uchun",
  })
})

test("adding: a new phone, a phone that works in another company, a member already, bad input", async () => {
  await signIn(ALI)

  expect(await add("+998 90 777 88 99", " Yangi Xodim ")).toMatchObject({
    phone: "998907778899",
    full_name: "Yangi Xodim",
    role: "user",
  })
  // Zarina works in Anor Servis: the answer is a new phone's, and she is in both.
  expect(await add(ZARINA, "Zarina (kassir)")).toMatchObject({ phone: ZARINA, full_name: "Zarina (kassir)", role: "user" })
  expect(db.members[ZARINA].map((m) => m.companyId)).toEqual([3, 1])

  expect(await failure(add(ALI, "Ali"))).toMatchObject({
    status: 409,
    code: "already_member",
    message: "Bu raqam kompaniyangizga allaqachon qo'shilgan",
  })
  expect(await failure(add("12ab", "Vali"))).toMatchObject({ status: 400, message: "Telefon raqami noto'g'ri" })
  expect(await failure(add("998907770000", " "))).toMatchObject({ status: 400, message: "Ismni kiriting" })
  expect((await list()).map((m) => m.phone)).toEqual([ALI, VALI, SARDOR, "998907778899", ZARINA])
})

test("the name the owner gives is the name in their company: the user's own and the other company's stay", async () => {
  // Vali owns Nok Market; Ali is known by his own name, and owns Olma Savdo.
  await signIn(VALI)
  await chooseCompany(2)

  expect(await add(ALI, "Ali (haydovchi)")).toMatchObject({ phone: ALI, full_name: "Ali (haydovchi)", role: "user" })

  expect(db.users[ALI]).toBe("Ali Valiyev")
  expect(nameIn(ALI, 1)).toBe("Ali Valiyev")
  expect(nameIn(ALI, 2)).toBe("Ali (haydovchi)")
})

test("renaming and removing reach the company's employees, not its owner and not a stranger", async () => {
  await signIn(ALI)

  expect(await rename(VALI, " Vali (hisobchi) ")).toMatchObject({ phone: VALI, full_name: "Vali (hisobchi)", role: "user" })
  expect(await failure(rename(ALI, "Boshqa"))).toMatchObject({
    status: 409,
    code: "cannot_change_owner",
    message: "Kompaniya egasini o'zgartirib yoki o'chirib bo'lmaydi",
  })
  expect(await failure(rename(ZARINA, "Boshqa"))).toMatchObject({ status: 404, code: "not_found", message: "Xodim topilmadi" })
  expect(await failure(rename(VALI, " "))).toMatchObject({ status: 400, message: "Ismni kiriting" })

  await remove(SARDOR)
  expect((await list()).map((m) => [m.phone, m.full_name])).toEqual([
    [ALI, "Ali Valiyev"],
    [VALI, "Vali (hisobchi)"],
  ])
  expect(db.members[SARDOR].map((m) => m.companyId)).toEqual([3, 4])
  expect(await failure(remove(ALI))).toMatchObject({ status: 409, code: "cannot_change_owner" })
  expect(await failure(remove(SARDOR))).toMatchObject({ status: 404, code: "not_found" })
})

test("/app/me names the user as the company they work in does", async () => {
  await signIn(VALI)
  await chooseCompany(1)
  db.members[VALI].find((m) => m.companyId === 1)!.fullName = "Vali (hisobchi)"

  expect((await call(api.GET("/app/me"))).user.full_name).toBe("Vali (hisobchi)")
  await chooseCompany(2)
  expect((await call(api.GET("/app/me"))).user.full_name).toBe("Vali Aliyev")
})

// The customer settings (logic/customers.md; backend/internal/app/customer_settings_test.go).
const customerTypes = () => call(api.GET("/app/customer-types"))
const customerDropdowns = () => call(api.GET("/app/customer-dropdowns"))

test("every member reads the customer types and dropdowns of the company they work in", async () => {
  await signIn(ALI)

  expect((await customerTypes()).map((t) => [t.name, t.fields.map((f) => f.label)])).toEqual([
    ["Jismoniy", ["F.I.Sh.", "Manba"]],
    ["Yuridik", ["Nomi", "INN"]],
  ])
  const inn = (await customerTypes())[1].fields[1]
  expect(inn).toMatchObject({ kind: "int", required: true, is_unique: true, dropdown_id: null })
  expect((await customerDropdowns()).map((d) => [d.name, d.options.map((o) => [o.label, o.is_active])])).toEqual([
    [
      "Manba",
      [
        ["Instagram", true],
        ["LinkedIn", true],
        ["YouTube", false],
      ],
    ],
  ])

  // Vali is in two companies: the session has none until one is chosen.
  await signIn(VALI)
  expect(await failure(customerTypes())).toMatchObject({
    status: 403,
    code: "company_required",
    message: "Avval kompaniyani tanlang",
  })
  expect(await failure(customerDropdowns())).toMatchObject({ status: 403, code: "company_required" })
  await chooseCompany(1)
  expect(await customerTypes()).toHaveLength(2)
  expect(await customerDropdowns()).toHaveLength(1)
  await chooseCompany(2)
  expect((await customerTypes()).map((t) => [t.name, t.fields.map((f) => f.label)])).toEqual([
    ["Jismoniy", ["F.I.Sh."]],
    ["Yuridik", ["Nomi", "INN"]],
  ])
  expect(await customerDropdowns()).toEqual([])
})

const createDropdown = (name: string) => call(api.POST("/app/customer-dropdowns", { body: { name } }))
const renameDropdown = (id: number, name: string) =>
  call(api.PATCH("/app/customer-dropdowns/{id}", { params: { path: { id } }, body: { name } }))
const deleteDropdown = (id: number) => call(api.DELETE("/app/customer-dropdowns/{id}", { params: { path: { id } } }))

test("the owner makes, renames and deletes dropdowns; an employee does not", async () => {
  await signIn(ALI)

  const holat = await createDropdown(" Holat ")
  expect(holat).toMatchObject({ name: "Holat", options: [] })
  expect(await failure(createDropdown("holat"))).toMatchObject({
    status: 409,
    code: "name_taken",
    message: "Bu nomli dropdown allaqachon bor",
  })
  expect(await failure(createDropdown(" "))).toMatchObject({ status: 400, code: "validation_error", message: "Nomni kiriting" })
  expect(await failure(createDropdown("x".repeat(61)))).toMatchObject({ status: 400, message: "Nom 60 belgidan oshmasin" })

  expect(await renameDropdown(holat.id, " Holati ")).toEqual({ id: holat.id, name: "Holati", options: [] })
  expect(await failure(renameDropdown(999, "Yo'q"))).toMatchObject({ status: 404, code: "not_found", message: "Dropdown topilmadi" })

  // Manba gives its options to a field of Jismoniy.
  const [manba] = await customerDropdowns()
  expect(await failure(deleteDropdown(manba.id))).toMatchObject({
    status: 409,
    code: "dropdown_in_use",
    message: "Bu dropdown 1 ta maydonda ishlatilgan",
  })
  await deleteDropdown(holat.id)
  expect((await customerDropdowns()).map((d) => d.name)).toEqual(["Manba"])
  expect(await failure(deleteDropdown(holat.id))).toMatchObject({ status: 404, code: "not_found" })
  expect((await createDropdown("Holati")).id).not.toBe(holat.id)

  await signIn(VALI)
  await chooseCompany(1)
  expect(await failure(createDropdown("Xodimniki"))).toMatchObject({
    status: 403,
    code: "owner_only",
    message: "Bu bo'lim faqat kompaniya egasi uchun",
  })
  expect(await failure(deleteDropdown(manba.id))).toMatchObject({ status: 403, code: "owner_only" })
})

const addOption = (id: number, label: string) =>
  call(api.POST("/app/customer-dropdowns/{id}/options", { params: { path: { id } }, body: { label } }))
const updateOption = (id: number, optionId: number, body: { label?: string; is_active?: boolean }) =>
  call(api.PATCH("/app/customer-dropdowns/{id}/options/{optionId}", { params: { path: { id, optionId } }, body }))
const deleteOption = (id: number, optionId: number) =>
  call(api.DELETE("/app/customer-dropdowns/{id}/options/{optionId}", { params: { path: { id, optionId } } }))
const orderOptions = (id: number, ids: number[]) =>
  call(api.PUT("/app/customer-dropdowns/{id}/options/order", { params: { path: { id } }, body: { ids } }))

test("the owner adds options, renames them, turns them off, orders and deletes them", async () => {
  await signIn(ALI)
  const [manba] = await customerDropdowns()
  const [instagram, linkedin, youtube] = manba.options
  const labels = async () => (await customerDropdowns())[0].options.map((o) => o.label)

  const tavsiya = await addOption(manba.id, " Tavsiya ")
  expect(tavsiya).toMatchObject({ label: "Tavsiya", is_active: true })
  expect(await labels()).toEqual(["Instagram", "LinkedIn", "YouTube", "Tavsiya"])
  expect(await failure(addOption(manba.id, "instagram"))).toMatchObject({
    status: 409,
    code: "name_taken",
    message: "Bu variant allaqachon bor",
  })
  expect(await failure(addOption(manba.id, " "))).toMatchObject({ status: 400, message: "Nomni kiriting" })
  expect(await failure(addOption(999, "Yo'q"))).toMatchObject({ status: 404, message: "Dropdown topilmadi" })

  expect(await updateOption(manba.id, instagram.id, { label: " Insta " })).toEqual({ id: instagram.id, label: "Insta", is_active: true })
  expect(await updateOption(manba.id, instagram.id, { is_active: false })).toEqual({ id: instagram.id, label: "Insta", is_active: false })
  expect(await failure(updateOption(manba.id, instagram.id, { label: "linkedin" }))).toMatchObject({ status: 409, code: "name_taken" })
  expect(await failure(updateOption(manba.id, 999, { label: "Yo'q" }))).toMatchObject({
    status: 404,
    code: "not_found",
    message: "Variant topilmadi",
  })

  await orderOptions(manba.id, [tavsiya.id, youtube.id, linkedin.id, instagram.id])
  expect(await labels()).toEqual(["Tavsiya", "YouTube", "LinkedIn", "Insta"])
  expect(await failure(orderOptions(manba.id, [tavsiya.id, youtube.id]))).toMatchObject({
    status: 409,
    code: "order_changed",
    message: "Ro'yxat o'zgargan. Sahifani yangilang",
  })
  expect(await failure(orderOptions(manba.id, [tavsiya.id, tavsiya.id, linkedin.id, instagram.id]))).toMatchObject({ status: 409 })

  await deleteOption(manba.id, linkedin.id)
  expect(await labels()).toEqual(["Tavsiya", "YouTube", "Insta"])
  expect(await failure(deleteOption(manba.id, linkedin.id))).toMatchObject({ status: 404, message: "Variant topilmadi" })
  expect((await addOption(manba.id, "LinkedIn")).id).not.toBe(linkedin.id)

  await signIn(VALI)
  await chooseCompany(1)
  expect(await failure(addOption(manba.id, "Xodimniki"))).toMatchObject({ status: 403, code: "owner_only" })
})
