// The mock API has to answer /app/employees the way the Go API does, or the
// pages tested against it would be tested against something else
// (logic/user.md, logic/roles.md; backend/internal/app/employees_test.go).
import type { components } from "@hisob24/api-client"
import { expect, test } from "vitest"
import { api, call } from "@/lib/api"
import { allPermissions, defaultPermissions } from "@/lib/permissions"
import type { CustomerFieldKind, Permission } from "@/lib/types"
import { setAccessToken } from "@/lib/session"
import { addLocation, asosiyOf, restrictTo } from "@/test/locations"
import { giveRole as holdRole } from "@/test/roles"
import { chooseCompany, signIn } from "@/test/session"
import { addDays, ALI, db, localToday, nameIn, nextId, type RateRow, SARDOR, seedCatalog, seedOrders, seedWarehouse, type SupplierRow, type TransactionRow, VALI, ZARINA } from "./data"

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
  // Nobody holds a company role yet.
  expect(members.map((m) => [m.role_id, m.role_name])).toEqual([
    [null, null],
    [null, null],
    [null, null],
  ])
})

test("a session with no company chosen gets 403 company_required, an employee without the permission 403 forbidden", async () => {
  await signIn(VALI)
  expect(await failure(list())).toMatchObject({ status: 403, code: "company_required" })

  await chooseCompany(1)
  expect(await failure(list())).toMatchObject({
    status: 403,
    code: "forbidden",
    message: "Bu amal uchun ruxsatingiz yo'q",
  })
})

test("/app/me tells what the user may do: nothing before a company, everything as the owner, the default as an employee", async () => {
  await signIn(VALI)
  expect((await call(api.GET("/app/me"))).permissions).toEqual([])

  await chooseCompany(2)
  const asOwner = await call(api.GET("/app/me"))
  expect(asOwner.permissions).toEqual(allPermissions)
  expect(asOwner.company?.role_name).toBeNull()

  await chooseCompany(1)
  const asEmployee = await call(api.GET("/app/me"))
  expect(asEmployee.permissions).toEqual(defaultPermissions)
  expect(asEmployee.companies.map((c) => c.role_name)).toEqual([null, null])
})

// The locations a member may work in (logic/locations.md, sections 4 and
// 5; backend/internal/app/handler_test.go TestMeTellsTheMembersLocations).
test("/app/me tells the member's locations: the company's live ones, or the live ones of a restriction; none before a company", async () => {
  const asosiy = asosiyOf(1)
  const chilonzor = addLocation(1, "Chilonzor")
  const gone = addLocation(1, "Yopilgan")
  gone.deleted = true
  await signIn(VALI)
  expect((await call(api.GET("/app/me"))).locations).toEqual([])

  await chooseCompany(1)
  const both = [
    { id: asosiy.id, name: "Asosiy" },
    { id: chilonzor.id, name: "Chilonzor" },
  ]
  expect((await call(api.GET("/app/me"))).locations).toEqual(both)
  restrictTo(VALI, 1, [gone.id, chilonzor.id])
  expect((await call(api.GET("/app/me"))).locations).toEqual([{ id: chilonzor.id, name: "Chilonzor" }])
  restrictTo(VALI, 1, [gone.id])
  expect((await call(api.GET("/app/me"))).locations).toEqual([])
  restrictTo(VALI, 1, null)
  expect((await call(api.GET("/app/me"))).locations).toEqual(both)

  await chooseCompany(2)
  // Nok Market has two locations in the seed.
  expect((await call(api.GET("/app/me"))).locations.map((l) => l.name)).toEqual(["Asosiy", "Chilonzor"])
})

// The restriction is the owner's to set (logic/locations.md, section 5;
// backend/internal/app/locations_test.go).
const setLocations = (phone: string, ids: number[] | null) =>
  call(api.PUT("/app/employees/{phone}/locations", { params: { path: { phone } }, body: { location_ids: ids } }))

test("the owner restricts an employee to some locations, or lifts the restriction; it holds from the next request on", async () => {
  db.cooldown = false
  const asosiy = asosiyOf(1)
  const chilonzor = addLocation(1, "Chilonzor")
  const gone = addLocation(1, "Yopilgan")
  gone.deleted = true
  await signIn(ALI)

  expect(await setLocations(VALI, [chilonzor.id, asosiy.id, chilonzor.id])).toMatchObject({
    phone: VALI,
    locations: [
      { id: asosiy.id, name: "Asosiy" },
      { id: chilonzor.id, name: "Chilonzor" },
    ],
  })
  expect((await setLocations(VALI, [chilonzor.id])).locations).toEqual([{ id: chilonzor.id, name: "Chilonzor" }])
  expect((await call(api.GET("/app/employees"))).find((m) => m.phone === VALI)?.locations).toEqual([{ id: chilonzor.id, name: "Chilonzor" }])
  expect(await failure(setLocations(VALI, []))).toMatchObject({ status: 400, message: "Kamida bitta lokatsiyani tanlang" })
  expect(await failure(setLocations(VALI, [gone.id]))).toMatchObject({ status: 404, message: "Lokatsiya topilmadi" })
  expect(await failure(setLocations(VALI, [asosiyOf(2).id]))).toMatchObject({ status: 404, message: "Lokatsiya topilmadi" })
  expect(await failure(setLocations(VALI, [999999]))).toMatchObject({ status: 404, message: "Lokatsiya topilmadi" })
  expect(await failure(setLocations(ALI, [chilonzor.id]))).toMatchObject({ status: 409, code: "cannot_change_owner" })
  expect(await failure(setLocations("998909999999", [chilonzor.id]))).toMatchObject({ status: 404, message: "Xodim topilmadi" })

  await signIn(VALI)
  await chooseCompany(1)
  expect((await call(api.GET("/app/me"))).locations).toEqual([{ id: chilonzor.id, name: "Chilonzor" }])
  expect(await failure(setLocations(SARDOR, [chilonzor.id]))).toMatchObject({ status: 403, code: "owner_only" })
  await chooseCompany(null)
  expect(await failure(setLocations(SARDOR, [chilonzor.id]))).toMatchObject({ status: 403, code: "owner_only" })

  await signIn(ALI)
  expect((await setLocations(VALI, null)).locations).toBeNull()
})

test("the employees and the members tell each member's locations: null for every one, the restriction's otherwise", async () => {
  const chilonzor = addLocation(1, "Chilonzor")
  restrictTo(VALI, 1, [chilonzor.id])
  await signIn(ALI)

  const employees = await call(api.GET("/app/employees"))
  const members = await call(api.GET("/app/members"))

  expect(employees.find((m) => m.phone === ALI)?.locations).toBeNull()
  expect(employees.find((m) => m.phone === VALI)?.locations).toEqual([{ id: chilonzor.id, name: "Chilonzor" }])
  expect(members.find((m) => m.phone === VALI)?.locations).toEqual([{ id: chilonzor.id, name: "Chilonzor" }])
  expect(members.find((m) => m.phone === SARDOR)?.locations).toBeNull()
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
    code: "forbidden",
    message: "Bu amal uchun ruxsatingiz yo'q",
  })
  expect(await failure(deleteDropdown(manba.id))).toMatchObject({ status: 403, code: "forbidden" })
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
  expect(await failure(addOption(manba.id, "Xodimniki"))).toMatchObject({ status: 403, code: "forbidden" })
})

const createType = (name: string) => call(api.POST("/app/customer-types", { body: { name } }))
const renameType = (id: number, name: string) =>
  call(api.PATCH("/app/customer-types/{id}", { params: { path: { id } }, body: { name } }))
const deleteType = (id: number) => call(api.DELETE("/app/customer-types/{id}", { params: { path: { id } } }))
const orderTypes = (ids: number[]) => call(api.PUT("/app/customer-types/order", { body: { ids } }))

test("the owner makes, renames, orders and deletes customer types", async () => {
  await signIn(ALI)
  const [jismoniy, yuridik] = await customerTypes()
  const names = async () => (await customerTypes()).map((t) => t.name)

  const hamkor = await createType(" Hamkor ")
  expect(hamkor).toMatchObject({ name: "Hamkor", fields: [] })
  expect(await names()).toEqual(["Jismoniy", "Yuridik", "Hamkor"])
  expect(await failure(createType("jismoniy"))).toMatchObject({
    status: 409,
    code: "name_taken",
    message: "Bu nomli tur allaqachon bor",
  })
  expect(await failure(createType(" "))).toMatchObject({ status: 400, message: "Nomni kiriting" })

  expect(await renameType(hamkor.id, "Hamkorlar")).toEqual({ id: hamkor.id, name: "Hamkorlar", fields: [] })
  expect(await failure(renameType(hamkor.id, "YURIDIK"))).toMatchObject({ status: 409, code: "name_taken" })
  expect(await failure(renameType(999, "Yo'q"))).toMatchObject({ status: 404, code: "not_found", message: "Tur topilmadi" })

  await orderTypes([hamkor.id, jismoniy.id, yuridik.id])
  expect(await names()).toEqual(["Hamkorlar", "Jismoniy", "Yuridik"])
  expect(await failure(orderTypes([jismoniy.id, yuridik.id]))).toMatchObject({
    status: 409,
    code: "order_changed",
    message: "Ro'yxat o'zgargan. Sahifani yangilang",
  })

  await deleteType(hamkor.id)
  expect(await names()).toEqual(["Jismoniy", "Yuridik"])
  expect(await failure(deleteType(hamkor.id))).toMatchObject({ status: 404, message: "Tur topilmadi" })
  // Manba's only field went with its type: the dropdown is free to delete.
  await deleteType(jismoniy.id)
  await deleteDropdown((await customerDropdowns())[0].id)

  await signIn(VALI)
  await chooseCompany(1)
  expect(await failure(createType("Xodimniki"))).toMatchObject({ status: 403, code: "forbidden" })
})

type FieldBody = { label: string; kind: CustomerFieldKind; required?: boolean; is_unique?: boolean; dropdown_id?: number | null }
const addField = (id: number, body: FieldBody) =>
  call(api.POST("/app/customer-types/{id}/fields", { params: { path: { id } }, body }))
const updateField = (id: number, fieldId: number, body: { label?: string; required?: boolean; is_unique?: boolean }) =>
  call(api.PATCH("/app/customer-types/{id}/fields/{fieldId}", { params: { path: { id, fieldId } }, body }))
const deleteField = (id: number, fieldId: number) =>
  call(api.DELETE("/app/customer-types/{id}/fields/{fieldId}", { params: { path: { id, fieldId } } }))
const orderFields = (id: number, ids: number[]) =>
  call(api.PUT("/app/customer-types/{id}/fields/order", { params: { path: { id } }, body: { ids } }))

test("the owner adds fields of the six kinds, changes, orders and deletes them", async () => {
  await signIn(ALI)
  const [jismoniy] = await customerTypes()
  const [fish, source] = jismoniy.fields
  const [manba] = await customerDropdowns()
  const labels = async () => (await customerTypes())[0].fields.map((f) => f.label)

  const yosh = await addField(jismoniy.id, { label: " Yoshi ", kind: "int", is_unique: true })
  expect(yosh).toMatchObject({ label: "Yoshi", kind: "int", required: false, is_unique: true, dropdown_id: null })
  const kanallar = await addField(jismoniy.id, { label: "Kanallar", kind: "checkbox", required: true, dropdown_id: manba.id })
  expect(kanallar).toMatchObject({ kind: "checkbox", required: true, is_unique: false, dropdown_id: manba.id })
  expect(await labels()).toEqual(["F.I.Sh.", "Manba", "Yoshi", "Kanallar"])

  const invalid = { status: 400, code: "validation_error" }
  expect(await failure(addField(jismoniy.id, { label: " ", kind: "string" }))).toMatchObject({ ...invalid, message: "Nomni kiriting" })
  expect(await failure(addField(jismoniy.id, { label: "Sana", kind: "date" as CustomerFieldKind }))).toMatchObject({
    ...invalid,
    message: "Maydon turini tanlang",
  })
  expect(await failure(addField(jismoniy.id, { label: "Tanlov", kind: "radio" }))).toMatchObject({
    ...invalid,
    message: "Dropdownni tanlang",
  })
  expect(await failure(addField(jismoniy.id, { label: "Tanlov", kind: "radio", dropdown_id: 999 }))).toMatchObject({
    ...invalid,
    message: "Dropdownni tanlang",
  })
  expect(await failure(addField(jismoniy.id, { label: "Tanlov", kind: "multi_dropdown", dropdown_id: manba.id, is_unique: true }))).toMatchObject({
    ...invalid,
    message: "Faqat matn va son maydoni takrorlanmas bo'ladi",
  })
  expect(await failure(addField(jismoniy.id, { label: "Izoh", kind: "string", dropdown_id: manba.id }))).toMatchObject({
    ...invalid,
    message: "Matn va son maydoniga dropdown ulanmaydi",
  })
  expect(await failure(addField(jismoniy.id, { label: "f.i.sh.", kind: "string" }))).toMatchObject({
    status: 409,
    code: "name_taken",
    message: "Bu nomli maydon allaqachon bor",
  })
  expect(await failure(addField(999, { label: "Ism", kind: "string" }))).toMatchObject({ status: 404, message: "Tur topilmadi" })

  expect(await updateField(jismoniy.id, fish.id, { label: " Ism ", required: false })).toMatchObject({
    id: fish.id,
    label: "Ism",
    kind: "string",
    required: false,
    is_unique: false,
  })
  expect(await updateField(jismoniy.id, fish.id, { is_unique: true })).toMatchObject({ label: "Ism", required: false, is_unique: true })
  expect(await failure(updateField(jismoniy.id, source.id, { is_unique: true }))).toMatchObject({
    ...invalid,
    message: "Faqat matn va son maydoni takrorlanmas bo'ladi",
  })
  expect(await failure(updateField(jismoniy.id, fish.id, { label: "MANBA" }))).toMatchObject({ status: 409, code: "name_taken" })
  expect(await failure(updateField(jismoniy.id, 999, { label: "Yo'q" }))).toMatchObject({
    status: 404,
    code: "not_found",
    message: "Maydon topilmadi",
  })

  await orderFields(jismoniy.id, [yosh.id, fish.id, source.id, kanallar.id])
  expect(await labels()).toEqual(["Yoshi", "Ism", "Manba", "Kanallar"])
  expect(await failure(orderFields(jismoniy.id, [yosh.id, fish.id]))).toMatchObject({ status: 409, code: "order_changed" })
  expect(await failure(orderFields(999, []))).toMatchObject({ status: 404, message: "Tur topilmadi" })

  await deleteField(jismoniy.id, yosh.id)
  expect(await labels()).toEqual(["Ism", "Manba", "Kanallar"])
  expect(await failure(deleteField(jismoniy.id, yosh.id))).toMatchObject({ status: 404, message: "Maydon topilmadi" })

  await signIn(VALI)
  await chooseCompany(1)
  expect(await failure(addField(jismoniy.id, { label: "Xodimniki", kind: "string" }))).toMatchObject({ status: 403, code: "forbidden" })
})

// The customers (logic/customers.md; backend/internal/app/customers_test.go).
type Answers = Record<string, string | number | number[] | null>
const createCustomer = (typeId: number, phone: string, values?: Answers) =>
  call(api.POST("/app/customers", { body: { type_id: typeId, phone, values } }))
const getCustomer = (id: number) => call(api.GET("/app/customers/{id}", { params: { path: { id } } }))

// setup is what Olma Savdo's customers are entered with: its two types, their
// fields and the options of Manba (YouTube is turned off).
async function setup() {
  const [jismoniy, yuridik] = await customerTypes()
  const [fish, manba] = jismoniy.fields
  const [nomi, inn] = yuridik.fields
  const [instagram, linkedin, youtube] = (await customerDropdowns())[0].options
  return { jismoniy, yuridik, fish, manba, nomi, inn, instagram, linkedin, youtube }
}

test("a member enters a customer and reads it back; what is wrong is said in the API's words", async () => {
  await signIn(VALI)
  await chooseCompany(1)
  const { jismoniy, yuridik, fish, manba, nomi, inn, instagram, youtube } = await setup()

  const ali = await createCustomer(jismoniy.id, "+998 90 111 22 33", { [fish.id]: " Ali Valiyev ", [manba.id]: instagram.id })

  expect(ali).toMatchObject({
    type_id: jismoniy.id,
    phone: "998901112233",
    values: { [fish.id]: "Ali Valiyev", [manba.id]: instagram.id },
    created_by_name: "Vali Aliyev",
  })
  expect(ali.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  expect(ali.updated_at).toBe(ali.created_at)
  expect(await getCustomer(ali.id)).toEqual(ali)
  // An answer left empty is not kept.
  const vali = await createCustomer(jismoniy.id, "901112244", { [fish.id]: "Vali", [manba.id]: null })
  expect(vali.values).toEqual({ [fish.id]: "Vali" })

  const invalid = { status: 400, code: "validation_error" }
  const refusals: [number, string, Answers | undefined, string][] = [
    [jismoniy.id, "+7 900 123 45 67", { [fish.id]: "Chet el" }, "Telefon raqami noto'g'ri"],
    [999, "998901112255", {}, "Mijoz turini tanlang"],
    [jismoniy.id, "998901112255", { [fish.id]: "Ali", [inn.id]: 5 }, "Bu turda bunday maydon yo'q"],
    [jismoniy.id, "998901112255", undefined, "«F.I.Sh.» maydonini to'ldiring"],
    [jismoniy.id, "998901112255", { [fish.id]: "   " }, "«F.I.Sh.» maydonini to'ldiring"],
    [jismoniy.id, "998901112255", { [fish.id]: 5 }, "«F.I.Sh.» matn bo'lishi kerak"],
    [jismoniy.id, "998901112255", { [fish.id]: "a".repeat(501) }, "«F.I.Sh.» 500 belgidan oshmasin"],
    [jismoniy.id, "998901112255", { [fish.id]: "Ali", [manba.id]: youtube.id }, "«Manba» uchun variant noto'g'ri"],
    [jismoniy.id, "998901112255", { [fish.id]: "Ali", [manba.id]: 999 }, "«Manba» uchun variant noto'g'ri"],
    [jismoniy.id, "998901112255", { [fish.id]: "Ali", [manba.id]: [instagram.id] }, "«Manba» uchun variant noto'g'ri"],
    [yuridik.id, "998901112255", { [nomi.id]: "Olma", [inn.id]: 1.5 }, "«INN» butun son bo'lishi kerak"],
    [yuridik.id, "998901112255", { [nomi.id]: "Olma", [inn.id]: "301" }, "«INN» butun son bo'lishi kerak"],
    [yuridik.id, "998901112255", { [nomi.id]: "Olma", [inn.id]: 2 ** 53 }, "«INN» butun son bo'lishi kerak"],
    [yuridik.id, "998901112255", { [nomi.id]: "Olma" }, "«INN» maydonini to'ldiring"],
  ]
  for (const [typeId, phone, values, message] of refusals) {
    expect(await failure(createCustomer(typeId, phone, values)), message).toMatchObject({ ...invalid, message })
  }

  const firma = await createCustomer(yuridik.id, "998901112255", { [nomi.id]: "Olma MChJ", [inn.id]: 0 })
  expect(firma.values).toEqual({ [nomi.id]: "Olma MChJ", [inn.id]: 0 })
  expect(await failure(createCustomer(jismoniy.id, "901112233", { [fish.id]: "Boshqa" }))).toMatchObject({
    status: 409,
    code: "phone_taken",
    message: "Bu raqamli mijoz allaqachon bor",
    customerId: ali.id,
  })
  expect(await failure(createCustomer(yuridik.id, "998901112266", { [nomi.id]: "Nok MChJ", [inn.id]: 0 }))).toMatchObject({
    status: 409,
    code: "value_taken",
    message: "Bu «INN» boshqa mijozda bor",
    customerId: firma.id,
  })
  // What is wrong with the answers is said before a phone that is taken.
  expect(await failure(createCustomer(jismoniy.id, "901112233", {}))).toMatchObject({ ...invalid, message: "«F.I.Sh.» maydonini to'ldiring" })

  expect(await failure(getCustomer(999))).toMatchObject({ status: 404, code: "not_found", message: "Mijoz topilmadi" })
  // Vali's own company is another one: Olma Savdo's customer is not there.
  await chooseCompany(2)
  expect(await failure(getCustomer(ali.id))).toMatchObject({ status: 404, message: "Mijoz topilmadi" })
  await chooseCompany(null)
  expect(await failure(getCustomer(ali.id))).toMatchObject({ status: 403, code: "company_required" })
  expect(await failure(createCustomer(jismoniy.id, "998901112277", { [fish.id]: "Soli" }))).toMatchObject({
    status: 403,
    code: "company_required",
    message: "Avval kompaniyani tanlang",
  })
})

test("a required choice has to be made; the owner enters customers too", async () => {
  await signIn(ALI)
  const { jismoniy, fish, manba, linkedin } = await setup()
  await updateField(jismoniy.id, manba.id, { required: true })

  expect(await failure(createCustomer(jismoniy.id, "998901112233", { [fish.id]: "Ali" }))).toMatchObject({
    status: 400,
    message: "«Manba» ni tanlang",
  })
  expect(await createCustomer(jismoniy.id, "998901112233", { [fish.id]: "Ali", [manba.id]: linkedin.id })).toMatchObject({
    created_by_name: "Ali Valiyev",
  })
})

type ListQuery = { search?: string; type_id?: number; phone?: string; page?: number }
const listCustomers = (query: ListQuery = {}) => call(api.GET("/app/customers", { params: { query } }))

test("the list: the newest first, twenty to a page, one type, a search in the phones, the texts and the numbers", async () => {
  await signIn(ALI)
  const { jismoniy, yuridik, fish, manba, nomi, inn, instagram } = await setup()
  const ali = await createCustomer(jismoniy.id, "998901234567", { [fish.id]: "Ali Valiyev", [manba.id]: instagram.id })
  const vali = await createCustomer(jismoniy.id, "998905555555", { [fish.id]: "Vali Aliyev" })
  const firma = await createCustomer(yuridik.id, "998907777777", { [nomi.id]: "Olma 100% MChJ", [inn.id]: 301234567 })

  // A list leaves the balance by currency out (logic/sales.md, section 5).
  const listed = (c: typeof ali) => ({ ...c, balance_by_currency: null })
  expect(await listCustomers()).toEqual({ items: [listed(firma), listed(vali), listed(ali)], total: 3, page: 1, page_size: 20 })

  const found = async (query: ListQuery) => (await listCustomers(query)).items.map((c) => c.id)
  expect(await found({ type_id: yuridik.id })).toEqual([firma.id])
  expect(await found({ type_id: 999 })).toEqual([])
  expect(await found({ search: "ALI" })).toEqual([vali.id, ali.id])
  expect(await found({ search: " valiyev " })).toEqual([ali.id])
  expect(await found({ search: "+998 (90) 555-55" })).toEqual([vali.id])
  expect(await found({ search: "0123" })).toEqual([firma.id, ali.id])
  expect(await found({ search: "100%" })).toEqual([firma.id])
  expect(await found({ search: "_" })).toEqual([])
  expect(await found({ search: "olma 100" })).toEqual([firma.id])
  // Letters with digits are a text: the digits are not looked for in the phones.
  expect(await found({ search: "ali 5" })).toEqual([])
  // An option's name is not searched.
  expect(await found({ search: "Instagram" })).toEqual([])
  expect(await found({ search: "ali", type_id: yuridik.id })).toEqual([])
  expect((await listCustomers({ search: "ali" })).total).toBe(2)

  for (let i = 0; i < 20; i += 1) {
    await createCustomer(jismoniy.id, `9989000000${String(i).padStart(2, "0")}`, { [fish.id]: `Mijoz ${i}` })
  }
  const first = await listCustomers()
  expect(first.items).toHaveLength(20)
  expect(first.total).toBe(23)
  const second = await listCustomers({ page: 2 })
  expect(second.items.map((c) => c.id)).toEqual([firma.id, vali.id, ali.id])
  expect(second).toMatchObject({ total: 23, page: 2, page_size: 20 })
  expect(await listCustomers({ page: 3 })).toEqual({ items: [], total: 23, page: 3, page_size: 20 })
  expect(await failure(listCustomers({ page: 0 }))).toMatchObject({ status: 400, code: "validation_error", message: "Sahifa raqami noto'g'ri" })
  expect(await failure(listCustomers({ type_id: "abc" as unknown as number }))).toMatchObject({
    status: 400,
    message: "Mijoz turi noto'g'ri",
  })

  // Each company has its own customers.
  await signIn(VALI)
  expect(await failure(listCustomers())).toMatchObject({ status: 403, code: "company_required" })
  await chooseCompany(2)
  expect(await listCustomers()).toEqual({ items: [], total: 0, page: 1, page_size: 20 })
})

const updateCustomer = (id: number, phone: string, values?: Answers) =>
  call(api.PUT("/app/customers/{id}", { params: { path: { id } }, body: { phone, values } }))
const customerHistory = (id: number) => call(api.GET("/app/customers/{id}/history", { params: { path: { id } } }))

test("an edit replaces the phone and the answers and goes into the history, which is the owner's to see", async () => {
  // Vali signs in twice here: no waiting a minute for the second code.
  db.cooldown = false
  await signIn(VALI)
  await chooseCompany(1)
  const { jismoniy, yuridik, fish, manba, nomi, inn, instagram, linkedin } = await setup()
  const ali = await createCustomer(jismoniy.id, "998901234567", { [fish.id]: "Ali", [manba.id]: instagram.id })
  const vali = await createCustomer(jismoniy.id, "998905555555", { [fish.id]: "Vali" })
  const firma = await createCustomer(yuridik.id, "998907777777", { [nomi.id]: "Olma MChJ", [inn.id]: 301234567 })
  const boshqa = await createCustomer(yuridik.id, "998908888888", { [nomi.id]: "Nok MChJ", [inn.id]: 305555555 })

  await signIn(ALI)
  const edited = await updateCustomer(ali.id, "+998 90 765 43 21", { [fish.id]: " Ali Valiyev ", [manba.id]: linkedin.id })

  expect(edited).toMatchObject({
    id: ali.id,
    type_id: jismoniy.id,
    phone: "998907654321",
    values: { [fish.id]: "Ali Valiyev", [manba.id]: linkedin.id },
    created_by_name: "Vali Aliyev",
    created_at: ali.created_at,
  })
  expect(edited.updated_at > ali.updated_at).toBe(true)
  expect(await getCustomer(ali.id)).toEqual(edited)
  // An answer the edit leaves out is taken away.
  expect((await updateCustomer(ali.id, "998907654321", { [fish.id]: "Ali Valiyev" })).values).toEqual({ [fish.id]: "Ali Valiyev" })

  // A save that changes nothing changes nothing, the moment of the edit too.
  const before = await getCustomer(ali.id)
  expect(await updateCustomer(ali.id, "+998 90 765-43-21", { [fish.id]: " Ali Valiyev ", [manba.id]: null })).toEqual(before)

  const history = await customerHistory(ali.id)
  expect(history.map((e) => [e.action, e.actor_name, e.changes])).toEqual([
    ["updated", "Ali Valiyev", [{ label: "Manba", old: "LinkedIn", new: "" }]],
    [
      "updated",
      "Ali Valiyev",
      [
        { label: "Telefon", old: "+998 90 123 45 67", new: "+998 90 765 43 21" },
        { label: "F.I.Sh.", old: "Ali", new: "Ali Valiyev" },
        { label: "Manba", old: "Instagram", new: "LinkedIn" },
      ],
    ],
    ["created", "Vali Aliyev", []],
  ])
  expect(history[0].created_at).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  expect(history[0].id).toBeGreaterThan(history[1].id)

  expect(await failure(updateCustomer(ali.id, "998905555555", { [fish.id]: "Ali" }))).toMatchObject({
    status: 409,
    code: "phone_taken",
    customerId: vali.id,
  })
  expect(await failure(updateCustomer(boshqa.id, "998908888888", { [nomi.id]: "Nok MChJ", [inn.id]: 301234567 }))).toMatchObject({
    status: 409,
    code: "value_taken",
    message: "Bu «INN» boshqa mijozda bor",
    customerId: firma.id,
  })
  // A customer's own phone and own answer are no repeat.
  expect(await updateCustomer(firma.id, "998907777777", { [nomi.id]: "Olma Savdo MChJ", [inn.id]: 301234567 })).toMatchObject({
    values: { [nomi.id]: "Olma Savdo MChJ" },
  })
  expect(await failure(updateCustomer(ali.id, "123", { [fish.id]: "Ali" }))).toMatchObject({ status: 400, message: "Telefon raqami noto'g'ri" })
  expect(await failure(updateCustomer(ali.id, "998907654321", {}))).toMatchObject({ status: 400, message: "«F.I.Sh.» maydonini to'ldiring" })
  // A customer that is not there is said first, whatever is sent.
  expect(await failure(updateCustomer(999, "123", {}))).toMatchObject({ status: 404, code: "not_found", message: "Mijoz topilmadi" })
  expect(await failure(customerHistory(999))).toMatchObject({ status: 404, message: "Mijoz topilmadi" })

  // The history is not for an employee.
  await signIn(VALI)
  await chooseCompany(1)
  expect(await failure(customerHistory(ali.id))).toMatchObject({
    status: 403,
    code: "forbidden",
    message: "Bu amal uchun ruxsatingiz yo'q",
  })
  // The owner of another company finds no such customer.
  await chooseCompany(2)
  expect(await failure(customerHistory(ali.id))).toMatchObject({ status: 404, message: "Mijoz topilmadi" })
  expect(await failure(updateCustomer(ali.id, "998907654321", { [fish.id]: "Ali" }))).toMatchObject({ status: 404 })
  await chooseCompany(null)
  expect(await failure(customerHistory(ali.id))).toMatchObject({ status: 403, code: "company_required" })
})

test("a customer who has an option that is turned off keeps it through an edit; nobody else may take it", async () => {
  await signIn(ALI)
  const { jismoniy, fish, manba, instagram } = await setup()
  const dropdown = (await customerDropdowns())[0]
  const ali = await createCustomer(jismoniy.id, "998901234567", { [fish.id]: "Ali", [manba.id]: instagram.id })
  const vali = await createCustomer(jismoniy.id, "998905555555", { [fish.id]: "Vali" })
  await updateOption(dropdown.id, instagram.id, { is_active: false })

  expect((await updateCustomer(ali.id, "998901234567", { [fish.id]: "Ali Valiyev", [manba.id]: instagram.id })).values).toEqual({
    [fish.id]: "Ali Valiyev",
    [manba.id]: instagram.id,
  })
  expect(await failure(updateCustomer(vali.id, "998905555555", { [fish.id]: "Vali", [manba.id]: instagram.id }))).toMatchObject({
    status: 400,
    message: "«Manba» uchun variant noto'g'ri",
  })
})

const deleteCustomer = (id: number) => call(api.DELETE("/app/customers/{id}", { params: { path: { id } } }))

test("a deleted customer is gone from the app, stays in the database, and its phone is free again", async () => {
  await signIn(VALI)
  await chooseCompany(1)
  const { jismoniy, fish } = await setup()
  const ali = await createCustomer(jismoniy.id, "998901234567", { [fish.id]: "Ali" })
  const vali = await createCustomer(jismoniy.id, "998905555555", { [fish.id]: "Vali" })

  await deleteCustomer(ali.id)

  expect(await failure(getCustomer(ali.id))).toMatchObject({ status: 404, message: "Mijoz topilmadi" })
  expect((await listCustomers()).items.map((c) => c.id)).toEqual([vali.id])
  expect(await failure(deleteCustomer(ali.id))).toMatchObject({ status: 404, code: "not_found", message: "Mijoz topilmadi" })
  expect(await failure(updateCustomer(ali.id, "998901234567", { [fish.id]: "Ali" }))).toMatchObject({ status: 404 })
  expect(db.customers.find((c) => c.id === ali.id)).toMatchObject({ deleted: true, phone: "998901234567" })
  expect(db.history.filter((entry) => entry.customerId === ali.id).map((entry) => [entry.action, entry.by])).toEqual([
    ["created", VALI],
    ["deleted", VALI],
  ])
  expect((await createCustomer(jismoniy.id, "998901234567", { [fish.id]: "Yangi Ali" })).id).not.toBe(ali.id)

  await chooseCompany(2)
  expect(await failure(deleteCustomer(vali.id))).toMatchObject({ status: 404, message: "Mijoz topilmadi" })
  await chooseCompany(null)
  expect(await failure(deleteCustomer(vali.id))).toMatchObject({ status: 403, code: "company_required" })
})

test("what the customers use is not deleted from the settings; the deleted customers use nothing", async () => {
  await signIn(ALI)
  const { jismoniy, yuridik, fish, manba, instagram, linkedin } = await setup()
  const dropdown = (await customerDropdowns())[0]
  const ali = await createCustomer(jismoniy.id, "998901234567", { [fish.id]: "Ali", [manba.id]: instagram.id })
  const vali = await createCustomer(jismoniy.id, "998905555555", { [fish.id]: "ali" })
  const inUse = { status: 409 }

  expect(await failure(deleteType(jismoniy.id))).toMatchObject({ ...inUse, code: "type_in_use", message: "Bu turda 2 ta mijoz bor" })
  expect(await failure(deleteField(jismoniy.id, fish.id))).toMatchObject({
    ...inUse,
    code: "field_in_use",
    message: "Bu maydon 2 ta mijozda to'ldirilgan",
  })
  expect(await failure(deleteField(jismoniy.id, manba.id))).toMatchObject({ ...inUse, message: "Bu maydon 1 ta mijozda to'ldirilgan" })
  expect(await failure(deleteOption(dropdown.id, instagram.id))).toMatchObject({
    ...inUse,
    code: "option_in_use",
    message: "Bu variant 1 ta mijozda tanlangan",
  })
  expect(await failure(updateField(jismoniy.id, fish.id, { is_unique: true }))).toMatchObject({
    ...inUse,
    code: "duplicates_exist",
    message: "Bu maydonda takrorlangan qiymatlar bor",
  })
  expect((await customerTypes())[0].fields.map((f) => [f.label, f.is_unique])).toEqual([
    ["F.I.Sh.", false],
    ["Manba", false],
  ])

  // What nobody uses goes as before.
  await deleteOption(dropdown.id, linkedin.id)
  await deleteType(yuridik.id)
  // An option in use can be turned off instead.
  expect(await updateOption(dropdown.id, instagram.id, { is_active: false })).toMatchObject({ is_active: false })

  await deleteCustomer(vali.id)
  expect(await updateField(jismoniy.id, fish.id, { is_unique: true })).toMatchObject({ is_unique: true })
  expect(await failure(deleteType(jismoniy.id))).toMatchObject({ code: "type_in_use", message: "Bu turda 1 ta mijoz bor" })
  await deleteCustomer(ali.id)
  await deleteOption(dropdown.id, instagram.id)
  await deleteField(jismoniy.id, manba.id)
  await deleteType(jismoniy.id)
  expect(await customerTypes()).toEqual([])
})

test("every company starts with the ready stages and order type; every member reads them", async () => {
  await signIn(VALI)
  await chooseCompany(1)

  const stages = await call(api.GET("/app/order-stages"))
  expect(stages.map((s) => [s.name, s.color, s.is_done])).toEqual([
    ["Yangi", "blue", false],
    ["Jarayonda", "amber", false],
    ["Bajarildi", "green", true],
  ])
  const types = await call(api.GET("/app/order-types"))
  expect(types.map((t) => [t.name, t.fields])).toEqual([["Buyurtma", []]])

  await chooseCompany(2)
  expect((await call(api.GET("/app/order-stages"))).map((s) => s.name)).toEqual(["Yangi", "Jarayonda", "Bajarildi"])
  expect((await call(api.GET("/app/order-stages"))).map((s) => s.id)).not.toEqual(stages.map((s) => s.id))
  await chooseCompany(null)
  expect(await failure(call(api.GET("/app/order-stages")))).toMatchObject({ status: 403, code: "company_required" })
  expect(await failure(call(api.GET("/app/order-types")))).toMatchObject({ status: 403, code: "company_required" })
})

test("the owner makes, changes, orders and deletes stages; an employee does not", async () => {
  await signIn(ALI)

  const made = await call(api.POST("/app/order-stages", { body: { name: " Kutilmoqda ", color: "teal" } }))
  expect(made).toMatchObject({ name: "Kutilmoqda", color: "teal", is_done: false })
  const done = await call(api.POST("/app/order-stages", { body: { name: "Yopildi", color: "slate", is_done: true } }))
  expect(done.is_done).toBe(true)
  expect(await failure(call(api.POST("/app/order-stages", { body: { name: "kutilmoqda", color: "red" } })))).toMatchObject({
    status: 409,
    code: "name_taken",
    message: "Bu nomli bosqich allaqachon bor",
  })
  expect(await failure(call(api.POST("/app/order-stages", { body: { name: "Oltin", color: "gold" as never } })))).toMatchObject({
    status: 400,
    message: "Rangni tanlang",
  })
  expect(await failure(call(api.POST("/app/order-stages", { body: { name: " ", color: "red" } })))).toMatchObject({
    status: 400,
    message: "Nomni kiriting",
  })

  const changed = await call(api.PATCH("/app/order-stages/{id}", { params: { path: { id: made.id } }, body: { color: "pink" } }))
  expect(changed).toMatchObject({ name: "Kutilmoqda", color: "pink", is_done: false })
  expect(
    await failure(call(api.PATCH("/app/order-stages/{id}", { params: { path: { id: made.id } }, body: { name: "YOPILDI" } }))),
  ).toMatchObject({ status: 409, code: "name_taken" })
  expect(
    await failure(call(api.PATCH("/app/order-stages/{id}", { params: { path: { id: 9999 } }, body: { name: "Yo'q" } }))),
  ).toMatchObject({ status: 404, message: "Bosqich topilmadi" })

  const ids = (await call(api.GET("/app/order-stages"))).map((s) => s.id)
  expect(ids).toHaveLength(5)
  await call(api.PUT("/app/order-stages/order", { body: { ids: [...ids].reverse() } }))
  expect((await call(api.GET("/app/order-stages"))).map((s) => s.name)).toEqual(["Yopildi", "Kutilmoqda", "Bajarildi", "Jarayonda", "Yangi"])
  expect(await failure(call(api.PUT("/app/order-stages/order", { body: { ids: ids.slice(1) } })))).toMatchObject({
    status: 409,
    code: "order_changed",
  })

  await call(api.DELETE("/app/order-stages/{id}", { params: { path: { id: made.id } } }))
  expect((await call(api.GET("/app/order-stages"))).map((s) => s.name)).toEqual(["Yopildi", "Bajarildi", "Jarayonda", "Yangi"])
  expect(await failure(call(api.DELETE("/app/order-stages/{id}", { params: { path: { id: made.id } } })))).toMatchObject({ status: 404 })
  expect(db.stages.filter((s) => s.companyId === 1)).toHaveLength(5)

  await signIn(VALI)
  await chooseCompany(1)
  expect(await failure(call(api.POST("/app/order-stages", { body: { name: "Xodimniki", color: "red" } })))).toMatchObject({
    status: 403,
    code: "forbidden",
  })
})

test("the owner makes, renames, reorders and deletes order types, and adds, changes, reorders and deletes their fields", async () => {
  await signIn(ALI)
  const [manba] = db.dropdowns
  const nokManba = { id: 950, companyId: 2, name: "Begona", options: [] }
  db.dropdowns.push(nokManba)

  const montaj = await call(api.POST("/app/order-types", { body: { name: " Montaj " } }))
  expect(montaj).toMatchObject({ name: "Montaj", fields: [] })
  expect(await failure(call(api.POST("/app/order-types", { body: { name: "buyurtma" } })))).toMatchObject({
    status: 409,
    code: "name_taken",
    message: "Bu nomli tur allaqachon bor",
  })
  expect(await call(api.PATCH("/app/order-types/{id}", { params: { path: { id: montaj.id } }, body: { name: "Zakaz" } }))).toMatchObject({
    name: "Zakaz",
  })
  const [buyurtma] = db.orderTypes
  await call(api.PUT("/app/order-types/order", { body: { ids: [montaj.id, buyurtma.id] } }))
  expect((await call(api.GET("/app/order-types"))).map((t) => t.name)).toEqual(["Zakaz", "Buyurtma"])
  expect(await failure(call(api.PUT("/app/order-types/order", { body: { ids: [buyurtma.id] } })))).toMatchObject({ status: 409, code: "order_changed" })

  const path = { params: { path: { id: montaj.id } } }
  const izoh = await call(api.POST("/app/order-types/{id}/fields", { ...path, body: { label: " Izoh ", kind: "string", required: true } }))
  expect(izoh).toEqual({ id: izoh.id, label: "Izoh", kind: "string", required: true, dropdown_id: null })
  const source = await call(api.POST("/app/order-types/{id}/fields", { ...path, body: { label: "Manba", kind: "dropdown", dropdown_id: manba.id } }))
  expect(source).toMatchObject({ kind: "dropdown", required: false, dropdown_id: manba.id })
  for (const [body, message] of [
    [{ label: "Sana", kind: "date" }, "Maydon turini tanlang"],
    [{ label: "Holat", kind: "radio" }, "Dropdownni tanlang"],
    [{ label: "Holat", kind: "radio", dropdown_id: nokManba.id }, "Dropdownni tanlang"],
    [{ label: "Matn", kind: "string", dropdown_id: manba.id }, "Matn va son maydoniga dropdown ulanmaydi"],
    [{ label: " ", kind: "string" }, "Nomni kiriting"],
  ] as const) {
    expect(await failure(call(api.POST("/app/order-types/{id}/fields", { ...path, body: body as never }))), message).toMatchObject({
      status: 400,
      message,
    })
  }
  expect(await failure(call(api.POST("/app/order-types/{id}/fields", { ...path, body: { label: "izoh", kind: "int" } })))).toMatchObject({
    status: 409,
    message: "Bu nomli maydon allaqachon bor",
  })
  expect(
    await failure(call(api.POST("/app/order-types/{id}/fields", { params: { path: { id: 9999 } }, body: { label: "Izoh", kind: "string" } }))),
  ).toMatchObject({ status: 404, message: "Tur topilmadi" })

  const fieldPath = { params: { path: { id: montaj.id, fieldId: izoh.id } } }
  expect(await call(api.PATCH("/app/order-types/{id}/fields/{fieldId}", { ...fieldPath, body: { label: "Tavsif" } }))).toMatchObject({
    label: "Tavsif",
    required: true,
  })
  expect(await call(api.PATCH("/app/order-types/{id}/fields/{fieldId}", { ...fieldPath, body: { required: false } }))).toMatchObject({
    label: "Tavsif",
    required: false,
  })
  await call(api.PUT("/app/order-types/{id}/fields/order", { ...path, body: { ids: [source.id, izoh.id] } }))
  expect((await call(api.GET("/app/order-types")))[0].fields.map((f) => f.label)).toEqual(["Manba", "Tavsif"])
  expect(await failure(call(api.PUT("/app/order-types/{id}/fields/order", { ...path, body: { ids: [izoh.id] } })))).toMatchObject({
    status: 409,
    code: "order_changed",
  })
  await call(api.DELETE("/app/order-types/{id}/fields/{fieldId}", fieldPath))
  expect((await call(api.GET("/app/order-types")))[0].fields.map((f) => f.label)).toEqual(["Manba"])
  expect(await failure(call(api.DELETE("/app/order-types/{id}/fields/{fieldId}", fieldPath)))).toMatchObject({
    status: 404,
    message: "Maydon topilmadi",
  })

  await call(api.DELETE("/app/order-types/{id}", path))
  expect((await call(api.GET("/app/order-types"))).map((t) => t.name)).toEqual(["Buyurtma"])
  expect(db.orderTypes.find((t) => t.id === montaj.id)?.fields.every((f) => f.deleted)).toBe(true)
  expect(await failure(call(api.DELETE("/app/order-types/{id}", path)))).toMatchObject({ status: 404, message: "Tur topilmadi" })

  await signIn(VALI)
  await chooseCompany(1)
  expect(await failure(call(api.POST("/app/order-types", { body: { name: "Xodimniki" } })))).toMatchObject({ status: 403, code: "forbidden" })
})

test("a dropdown an order field takes its options from is not deleted either", async () => {
  await signIn(ALI)
  const holat = await call(api.POST("/app/customer-dropdowns", { body: { name: "Holat" } }))
  const [buyurtma] = db.orderTypes
  const field = await call(
    api.POST("/app/order-types/{id}/fields", { params: { path: { id: buyurtma.id } }, body: { label: "Holati", kind: "radio", dropdown_id: holat.id } }),
  )

  expect(await failure(call(api.DELETE("/app/customer-dropdowns/{id}", { params: { path: { id: holat.id } } })))).toMatchObject({
    status: 409,
    code: "dropdown_in_use",
    message: "Bu dropdown 1 ta maydonda ishlatilgan",
  })

  await call(api.DELETE("/app/order-types/{id}/fields/{fieldId}", { params: { path: { id: buyurtma.id, fieldId: field.id } } }))
  await call(api.DELETE("/app/customer-dropdowns/{id}", { params: { path: { id: holat.id } } }))
  expect((await call(api.GET("/app/customer-dropdowns"))).map((d) => d.name)).toEqual(["Manba"])
})

test("every member reads the company's members, the owner first; managing them stays the owner's", async () => {
  await signIn(VALI)
  await chooseCompany(1)

  const members = await call(api.GET("/app/members"))

  expect(members.map((m) => [m.phone, m.full_name, m.role])).toEqual([
    [ALI, "Ali Valiyev", "owner"],
    [VALI, "Vali Aliyev", "user"],
    [SARDOR, "Sardor Karimov", "user"],
  ])
  expect(await failure(call(api.GET("/app/employees")))).toMatchObject({ status: 403, code: "forbidden" })
  await chooseCompany(null)
  expect(await failure(call(api.GET("/app/members")))).toMatchObject({ status: 403, code: "company_required" })
})

// The orders (logic/tasks.md; backend/internal/app/orders_test.go).
type OrderCreate = components["schemas"]["OrderCreate"]
type OrderUpdate = components["schemas"]["OrderUpdate"]
type OrderQuery = {
  search?: string
  location_id?: number
  type_id?: number
  stage_id?: number
  assignee?: string
  customer_id?: number
  page?: number
}
const createOrder = (body: OrderCreate) => call(api.POST("/app/orders", { body }))
const getOrder = (id: number) => call(api.GET("/app/orders/{id}", { params: { path: { id } } }))
const listOrders = (query: OrderQuery = {}) => call(api.GET("/app/orders", { params: { query } }))
const updateOrder = (id: number, body: OrderUpdate) => call(api.PUT("/app/orders/{id}", { params: { path: { id } }, body }))
const moveOrder = (id: number, stageId: number) =>
  call(api.PATCH("/app/orders/{id}/stage", { params: { path: { id } }, body: { stage_id: stageId } }))
const deleteOrder = (id: number) => call(api.DELETE("/app/orders/{id}", { params: { path: { id } } }))
const orderHistory = (id: number) => call(api.GET("/app/orders/{id}/history", { params: { path: { id } } }))
const deleteStage = (id: number) => call(api.DELETE("/app/order-stages/{id}", { params: { path: { id } } }))
const deleteOrderType = (id: number) => call(api.DELETE("/app/order-types/{id}", { params: { path: { id } } }))
const deleteOrderField = (typeId: number, fieldId: number) =>
  call(api.DELETE("/app/order-types/{id}/fields/{fieldId}", { params: { path: { id: typeId, fieldId } } }))

// orderSetup is what Olma Savdo's orders are entered with, by its owner: the
// three ready stages, the ready type, a type Montaj with a required text
// Izoh, a number Summa and a checkbox Kanal over Manba, and the customer Ali.
async function orderSetup() {
  const [yangi, jarayonda, bajarildi] = await call(api.GET("/app/order-stages"))
  const [buyurtma] = await call(api.GET("/app/order-types"))
  const montaj = await call(api.POST("/app/order-types", { body: { name: "Montaj" } }))
  const field = (body: components["schemas"]["OrderFieldInput"]) =>
    call(api.POST("/app/order-types/{id}/fields", { params: { path: { id: montaj.id } }, body }))
  const customers = await setup()
  const dropdown = (await customerDropdowns())[0]
  const izoh = await field({ label: "Izoh", kind: "string", required: true })
  const summa = await field({ label: "Summa", kind: "int" })
  const kanal = await field({ label: "Kanal", kind: "checkbox", dropdown_id: dropdown.id })
  const ali = await createCustomer(customers.jismoniy.id, "998901112233", { [customers.fish.id]: "Ali Valiyev" })
  return { ...customers, dropdown, yangi, jarayonda, bajarildi, buyurtma, montaj, izoh, summa, kanal, ali }
}
type OrderSetup = Awaited<ReturnType<typeof orderSetup>>

// orderBody is an order of the type Montaj for Ali, in Asosiy, due on
// 10.10.2026, in Yangi, with Izoh filled in; over changes what the test is
// about.
const orderBody = (s: OrderSetup, over: Partial<OrderCreate> = {}): OrderCreate => ({
  type_id: s.montaj.id,
  location_id: asosiyOf(1).id,
  title: "Qo'ng'iroq qilish",
  deadline: "2026-10-10",
  stage_id: s.yangi.id,
  values: { [s.izoh.id]: "Ertalab" },
  customer: { id: s.ali.id },
  ...over,
})

// The orders a member works with are those of the locations they may work
// in (logic/locations.md, section 6; backend/internal/app/orders_test.go
// TestOrdersAreTheLocationsTheMemberMayWorkIn).
test("the orders are those of the locations the member works in: the list, an order by its id, entering one, the assignee", async () => {
  db.cooldown = false
  await signIn(ALI)
  const s = await orderSetup()
  const asosiy = asosiyOf(1)
  const chilonzor = addLocation(1, "Chilonzor")
  const inAsosiy = await createOrder(orderBody(s, { title: "Asosiyda", location_id: asosiy.id }))
  const inChilonzor = await createOrder(orderBody(s, { title: "Chilonzorda", deadline: "2026-10-09", location_id: chilonzor.id }))
  const titles = async (query?: OrderQuery) => (await listOrders(query)).items.map((t) => t.title)
  const edit = (over: Partial<OrderUpdate> = {}): OrderUpdate => ({
    title: "X",
    deadline: "2026-10-10",
    stage_id: s.yangi.id,
    values: { [s.izoh.id]: "Ertalab" },
    ...over,
  })

  expect(await titles()).toEqual(["Chilonzorda", "Asosiyda"])
  expect(await titles({ location_id: asosiy.id })).toEqual(["Asosiyda"])
  expect(await failure(listOrders({ location_id: 999999 }))).toMatchObject({ status: 403, code: "forbidden" })
  expect(await failure(listOrders({ location_id: 0 }))).toMatchObject({ status: 400, message: "Lokatsiya noto'g'ri" })

  // The assignee works in the order's location: Vali, restricted to
  // Chilonzor, is not assigned an order in Asosiy; one assigned stays theirs
  // while the edit keeps them, another has to work there.
  restrictTo(VALI, 1, [chilonzor.id])
  expect(await failure(createOrder(orderBody(s, { location_id: asosiy.id, assignee_phone: VALI })))).toMatchObject({
    status: 400,
    message: "Mas'ul bu lokatsiyada ishlamaydi",
  })
  const valis = await createOrder(orderBody(s, { title: "Valiga", location_id: chilonzor.id, assignee_phone: VALI }))
  expect(valis.assignee?.phone).toBe(VALI)
  restrictTo(VALI, 1, [asosiy.id])
  expect((await updateOrder(valis.id, edit({ title: "Valiga", assignee_phone: VALI }))).assignee?.phone).toBe(VALI)
  expect(await failure(updateOrder(inChilonzor.id, edit({ assignee_phone: VALI })))).toMatchObject({
    status: 400,
    message: "Mas'ul bu lokatsiyada ishlamaydi",
  })

  restrictTo(VALI, 1, [chilonzor.id])
  await signIn(VALI)
  await chooseCompany(1)
  expect(await titles()).toEqual(["Chilonzorda", "Valiga"])
  expect(await failure(listOrders({ location_id: asosiy.id }))).toMatchObject({ status: 403, code: "forbidden" })
  expect(await failure(getOrder(inAsosiy.id))).toMatchObject({ status: 404, message: "Buyurtma topilmadi" })
  expect(await failure(updateOrder(inAsosiy.id, edit()))).toMatchObject({ status: 404 })
  expect(await failure(moveOrder(inAsosiy.id, s.bajarildi.id))).toMatchObject({ status: 404 })
  expect(await failure(deleteOrder(inAsosiy.id))).toMatchObject({ status: 404 })
  expect((await getOrder(inChilonzor.id)).location_id).toBe(chilonzor.id)
  expect(await failure(createOrder(orderBody(s, { location_id: asosiy.id })))).toMatchObject({ status: 403, code: "forbidden" })
  expect((await createOrder(orderBody(s, { title: "Yangi", location_id: chilonzor.id }))).location_id).toBe(chilonzor.id)
  expect(await failure(createOrder({ ...orderBody(s, { title: "Nomsiz" }), location_id: undefined } as unknown as OrderCreate))).toMatchObject({
    status: 400,
    message: "Lokatsiyani tanlang",
  })
  restrictTo(VALI, 1, null)
  expect((await listOrders()).total).toBe(4)
})

test("a member enters an order for a customer that is there, or with a new one; what is wrong is said in the API's words", async () => {
  // The owner signs in twice: once to set up, once to read a history.
  db.cooldown = false
  await signIn(ALI)
  const s = await orderSetup()
  await signIn(VALI)
  await chooseCompany(1)

  const order = await createOrder(
    orderBody(s, {
      title: " Qo'ng'iroq qilish ",
      assignee_phone: "+998 90 123 45 67",
      values: { [s.izoh.id]: " Ertalab ", [s.summa.id]: 45000, [s.kanal.id]: [s.linkedin.id, s.instagram.id] },
    }),
  )

  expect(order).toMatchObject({
    type_id: s.montaj.id,
    stage_id: s.yangi.id,
    location_id: asosiyOf(1).id,
    title: "Qo'ng'iroq qilish",
    deadline: "2026-10-10",
    customer: { id: s.ali.id, phone: "998901112233", name: "Ali Valiyev" },
    assignee: { phone: ALI, full_name: "Ali Valiyev" },
    values: { [s.izoh.id]: "Ertalab", [s.summa.id]: 45000, [s.kanal.id]: [s.instagram.id, s.linkedin.id] },
    created_by_name: "Vali Aliyev",
  })
  expect(order.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  expect(order.updated_at).toBe(order.created_at)
  expect(await getOrder(order.id)).toEqual(order)

  // A new customer, in one request.
  const withNew = await createOrder(
    orderBody(s, {
      title: "Shartnoma",
      deadline: "2026-10-11",
      customer: { type_id: s.jismoniy.id, phone: "+998 90 111 22 44", values: { [s.fish.id]: " Zarina Karimova " } },
    }),
  )
  expect(withNew.customer).toMatchObject({ phone: "998901112244", name: "Zarina Karimova" })
  expect(withNew.assignee).toBeNull()
  expect(await getCustomer(withNew.customer.id)).toMatchObject({
    type_id: s.jismoniy.id,
    phone: "998901112244",
    values: { [s.fish.id]: "Zarina Karimova" },
    created_by_name: "Vali Aliyev",
  })
  await signIn(ALI)
  expect((await customerHistory(withNew.customer.id)).map((e) => e.action)).toEqual(["created"])
  await signIn(VALI)
  await chooseCompany(1)

  // The phone of a customer that is there: nothing is entered.
  const before = [db.orders.length, db.customers.length]
  expect(
    await failure(createOrder(orderBody(s, { customer: { type_id: s.jismoniy.id, phone: "998901112233", values: { [s.fish.id]: "Ali" } } }))),
  ).toMatchObject({ status: 409, code: "phone_taken", message: "Bu raqamli mijoz allaqachon bor", customerId: s.ali.id })
  expect([db.orders.length, db.customers.length]).toEqual(before)

  const invalid = { status: 400, code: "validation_error" }
  const nokStage = db.stages.find((stage) => stage.companyId === 2)!.id
  const refusals: [Partial<OrderCreate>, string][] = [
    [{ title: " " }, "Buyurtma nomini kiriting"],
    [{ title: "ў".repeat(201) }, "Buyurtma nomi 200 belgidan oshmasin"],
    [{ deadline: "" }, "Muddatni kiriting"],
    [{ deadline: "10.10.2026" }, "Muddat noto'g'ri"],
    [{ deadline: "2026-02-30" }, "Muddat noto'g'ri"],
    [{ type_id: 999 }, "Buyurtma turini tanlang"],
    [{ stage_id: 999 }, "Bosqichni tanlang"],
    [{ stage_id: nokStage }, "Bosqichni tanlang"],
    [{ assignee_phone: "998907777777" }, "Mas'ul kompaniya a'zosi emas"],
    [{ values: { [s.izoh.id]: "X", [s.fish.id]: "Ali" } }, "Bu turda bunday maydon yo'q"],
    [{ values: {} }, "«Izoh» maydonini to'ldiring"],
    [{ values: { [s.izoh.id]: "X", [s.summa.id]: "ko'p" } }, "«Summa» butun son bo'lishi kerak"],
    [{ customer: {} }, "Mijozni tanlang"],
    [{ customer: { id: 999 } }, "Mijozni tanlang"],
    [{ customer: { type_id: s.jismoniy.id, phone: "998901112266" } }, "«F.I.Sh.» maydonini to'ldiring"],
    // The title is told before the type, the stage before the answers, the
    // answers before the customer.
    [{ title: "", type_id: 999 }, "Buyurtma nomini kiriting"],
    [{ stage_id: 0, values: {} }, "Bosqichni tanlang"],
    [{ values: {}, customer: {} }, "«Izoh» maydonini to'ldiring"],
  ]
  for (const [over, message] of refusals) {
    expect(await failure(createOrder(orderBody(s, over))), message).toMatchObject({ ...invalid, message })
  }
  // A location that is not there is one the member may not work in: refused
  // the way a missing permission is, before anything else.
  expect(await failure(createOrder(orderBody(s, { title: "", location_id: 999999 })))).toMatchObject({ status: 403, code: "forbidden" })
  expect(db.orders).toHaveLength(2)
  // The order stands in the location named; one has to be named
  // (logic/locations.md, section 6).
  const chilonzor = addLocation(1, "Chilonzor")
  expect((await createOrder(orderBody(s, { location_id: chilonzor.id }))).location_id).toBe(chilonzor.id)
  expect(await failure(createOrder({ ...orderBody(s), location_id: undefined } as unknown as OrderCreate))).toMatchObject({
    status: 400,
    message: "Lokatsiyani tanlang",
  })

  expect(await failure(getOrder(999))).toMatchObject({ status: 404, code: "not_found", message: "Buyurtma topilmadi" })
  await chooseCompany(2)
  expect(await failure(getOrder(order.id))).toMatchObject({ status: 404, message: "Buyurtma topilmadi" })
  await chooseCompany(null)
  expect(await failure(createOrder(orderBody(s)))).toMatchObject({ status: 403, code: "company_required" })
})

test("the orders list: the one due soonest first, twenty to a page, the filters and the search", async () => {
  await signIn(ALI)
  const s = await orderSetup()
  const zarina = await createCustomer(s.jismoniy.id, "998905555555", { [s.fish.id]: "Zarina Karimova" })
  const later = await createOrder(
    orderBody(s, { title: "Hisob yozish", deadline: "2026-10-12", values: { [s.izoh.id]: "Ertalab yozish", [s.summa.id]: 45000, [s.kanal.id]: [s.instagram.id] } }),
  )
  const sooner = await createOrder(orderBody(s, { title: "Qo'ng'iroq qilish", deadline: "2026-10-10", assignee_phone: VALI, values: { [s.izoh.id]: "X" } }))
  const other = await createOrder({
    type_id: s.buyurtma.id,
    location_id: asosiyOf(1).id,
    title: "Shikoyatni ko'rish",
    deadline: "2026-10-10",
    stage_id: s.bajarildi.id,
    customer: { id: zarina.id },
  })

  expect(await listOrders()).toEqual({ items: [sooner, other, later], total: 3, page: 1, page_size: 20 })

  const found = async (query: OrderQuery) => (await listOrders(query)).items.map((t) => t.id)
  expect(await found({ type_id: s.buyurtma.id })).toEqual([other.id])
  expect(await found({ stage_id: s.yangi.id })).toEqual([sooner.id, later.id])
  expect(await found({ assignee: "+998 90 222 33 44" })).toEqual([sooner.id])
  expect(await found({ customer_id: zarina.id })).toEqual([other.id])
  expect(await found({ search: "qo'ng" })).toEqual([sooner.id])
  expect(await found({ search: "ERTALAB" })).toEqual([later.id])
  expect(await found({ search: "karim" })).toEqual([other.id])
  expect(await found({ search: "90 555" })).toEqual([other.id])
  expect(await found({ search: "450" })).toEqual([later.id])
  // An option's name is not searched.
  expect(await found({ search: "Instagram" })).toEqual([])
  expect(await found({ stage_id: s.yangi.id, search: "karim" })).toEqual([])
  expect((await listOrders({ search: "ali" })).total).toBe(2)
  // A number is looked for in the customer's whole number answers too.
  const firma = await createCustomer(s.yuridik.id, "998907777777", { [s.nomi.id]: "Olma MChJ", [s.inn.id]: 301234567 })
  const firmas = await createOrder(orderBody(s, { title: "Hisob-faktura", deadline: "2026-10-13", customer: { id: firma.id } }))
  expect(await found({ search: "3012" })).toEqual([firmas.id])
  expect(await found({ search: "7777" })).toEqual([firmas.id])

  for (let i = 0; i < 20; i += 1) await createOrder(orderBody(s, { title: `Vazifa ${i}`, deadline: "2026-11-01" }))
  const first = await listOrders()
  expect(first.items).toHaveLength(20)
  expect(first.total).toBe(24)
  const second = await listOrders({ page: 2 })
  expect(second.items.map((t) => t.title)).toEqual(["Vazifa 16", "Vazifa 17", "Vazifa 18", "Vazifa 19"])
  expect(second).toMatchObject({ total: 24, page: 2, page_size: 20 })
  expect(await listOrders({ page: 3 })).toEqual({ items: [], total: 24, page: 3, page_size: 20 })
  const bad: [OrderQuery, string][] = [
    [{ page: 0 }, "Sahifa raqami noto'g'ri"],
    [{ type_id: "abc" as unknown as number }, "Buyurtma turi noto'g'ri"],
    [{ stage_id: 0 }, "Bosqich noto'g'ri"],
    [{ customer_id: "abc" as unknown as number }, "Mijoz noto'g'ri"],
    [{ assignee: "vali" }, "Mas'ul noto'g'ri"],
  ]
  for (const [query, message] of bad) {
    expect(await failure(listOrders(query)), message).toMatchObject({ status: 400, code: "validation_error", message })
  }

  // Each company has its own orders.
  await signIn(VALI)
  expect(await failure(listOrders())).toMatchObject({ status: 403, code: "company_required" })
  await chooseCompany(2)
  expect(await listOrders()).toEqual({ items: [], total: 0, page: 1, page_size: 20 })
})

test("an edit replaces the order's own fields and its answers and goes into the history, which is the owner's; the customer and the type stay", async () => {
  await signIn(ALI)
  const s = await orderSetup()
  const order = await createOrder(orderBody(s, { values: { [s.izoh.id]: "Ertalab", [s.summa.id]: 45000, [s.kanal.id]: [s.instagram.id] } }))
  const same: OrderUpdate = {
    title: "Qayta qo'ng'iroq",
    deadline: "2026-10-12",
    stage_id: s.jarayonda.id,
    assignee_phone: VALI,
    values: { [s.izoh.id]: "Kechqurun", [s.kanal.id]: [s.linkedin.id, s.instagram.id] },
  }

  const edited = await updateOrder(order.id, { ...same, title: " Qayta qo'ng'iroq " })

  expect(edited).toMatchObject({
    title: "Qayta qo'ng'iroq",
    deadline: "2026-10-12",
    stage_id: s.jarayonda.id,
    assignee: { phone: VALI, full_name: "Vali Aliyev" },
    values: { [s.izoh.id]: "Kechqurun", [s.kanal.id]: [s.instagram.id, s.linkedin.id] },
    customer: order.customer,
    type_id: order.type_id,
    created_at: order.created_at,
  })
  expect(edited.updated_at).not.toBe(order.updated_at)
  expect(await getOrder(order.id)).toEqual(edited)
  const history = await orderHistory(order.id)
  expect(history.map((e) => [e.action, e.actor_name])).toEqual([
    ["updated", "Ali Valiyev"],
    ["created", "Ali Valiyev"],
  ])
  expect(history[0].changes).toEqual([
    { label: "Nomi", old: "Qo'ng'iroq qilish", new: "Qayta qo'ng'iroq" },
    { label: "Muddat", old: "10.10.2026", new: "12.10.2026" },
    { label: "Bosqich", old: "Yangi", new: "Jarayonda" },
    { label: "Mas'ul", old: "", new: "Vali Aliyev" },
    { label: "Izoh", old: "Ertalab", new: "Kechqurun" },
    { label: "Summa", old: "45000", new: "" },
    { label: "Kanal", old: "Instagram", new: "Instagram, LinkedIn" },
  ])
  expect(history[1].changes).toEqual([])

  // A save that changes nothing writes nothing.
  expect(await updateOrder(order.id, { ...same, assignee_phone: "+998 90 222 33 44" })).toEqual(edited)
  expect(await orderHistory(order.id)).toHaveLength(2)
  // An assignee who left the company stays as long as the edit keeps them;
  // another one has to be a member.
  db.members[VALI] = db.members[VALI].filter((m) => m.companyId !== 1)
  expect((await updateOrder(order.id, { ...same, deadline: "2026-10-13" })).assignee).toEqual({ phone: VALI, full_name: "Vali Aliyev" })
  expect(await failure(updateOrder(order.id, { ...same, assignee_phone: ZARINA }))).toMatchObject({ status: 400, message: "Mas'ul kompaniya a'zosi emas" })

  const refusals: [OrderUpdate, string][] = [
    [{ ...same, title: "" }, "Buyurtma nomini kiriting"],
    [{ ...same, deadline: "soon" }, "Muddat noto'g'ri"],
    [{ ...same, stage_id: db.stages.find((stage) => stage.companyId === 2)!.id }, "Bosqichni tanlang"],
    [{ ...same, values: {} }, "«Izoh» maydonini to'ldiring"],
  ]
  for (const [body, message] of refusals) {
    expect(await failure(updateOrder(order.id, body)), message).toMatchObject({ status: 400, code: "validation_error", message })
  }
  // An order that is not there is said first, whatever is sent.
  expect(await failure(updateOrder(999, { ...same, title: "" }))).toMatchObject({ status: 404, message: "Buyurtma topilmadi" })

  await signIn(SARDOR)
  await chooseCompany(1)
  expect(await failure(orderHistory(order.id))).toMatchObject({ status: 403, code: "forbidden" })
})

test("moving an order changes its stage alone and goes into the history; the same stage changes nothing", async () => {
  db.cooldown = false
  await signIn(ALI)
  const s = await orderSetup()
  const order = await createOrder(orderBody(s))
  await signIn(VALI)
  await chooseCompany(1)

  const moved = await moveOrder(order.id, s.bajarildi.id)

  expect(moved).toMatchObject({ stage_id: s.bajarildi.id, title: order.title, values: order.values, customer: order.customer })
  expect(await getOrder(order.id)).toEqual(moved)
  expect(await moveOrder(order.id, s.bajarildi.id)).toEqual(moved)
  for (const stageId of [0, 999, db.stages.find((stage) => stage.companyId === 2)!.id]) {
    expect(await failure(moveOrder(order.id, stageId)), String(stageId)).toMatchObject({ status: 400, message: "Bosqichni tanlang" })
  }
  expect(await failure(moveOrder(999, s.yangi.id))).toMatchObject({ status: 404, message: "Buyurtma topilmadi" })

  await signIn(ALI)
  const history = await orderHistory(order.id)
  expect(history).toHaveLength(2)
  expect(history[0]).toMatchObject({
    action: "updated",
    actor_name: "Vali Aliyev",
    changes: [{ label: "Bosqich", old: "Yangi", new: "Bajarildi" }],
  })
})

test("a deleted order is gone from the app and its history is not shown; it stays in the database", async () => {
  db.cooldown = false
  await signIn(ALI)
  const s = await orderSetup()
  const order = await createOrder(orderBody(s))
  const another = await createOrder(orderBody(s, { title: "Boshqa" }))
  await signIn(VALI)
  await chooseCompany(1)

  await deleteOrder(order.id)

  expect(await failure(getOrder(order.id))).toMatchObject({ status: 404, code: "not_found", message: "Buyurtma topilmadi" })
  expect(await failure(deleteOrder(order.id))).toMatchObject({ status: 404 })
  expect((await listOrders()).items.map((t) => t.id)).toEqual([another.id])
  expect(db.orders).toHaveLength(2)
  await chooseCompany(2)
  expect(await failure(deleteOrder(another.id))).toMatchObject({ status: 404, message: "Buyurtma topilmadi" })
  await signIn(ALI)
  expect(await failure(orderHistory(order.id))).toMatchObject({ status: 404 })
  expect(db.orderHistory.filter((e) => e.orderId === order.id).map((e) => e.action)).toEqual(["created", "deleted"])
})

test("what the orders use is not deleted; the customers are suggested by the digits a phone begins with", async () => {
  await signIn(ALI)
  const s = await orderSetup()
  const order = await createOrder(orderBody(s, { values: { [s.izoh.id]: "X", [s.kanal.id]: [s.instagram.id] } }))
  const gone = await createOrder(orderBody(s, { title: "O'chirilgan", values: { [s.izoh.id]: "X", [s.summa.id]: 1 } }))
  await deleteOrder(gone.id)
  const inUse = { status: 409 }

  expect(await failure(deleteCustomer(s.ali.id))).toMatchObject({ ...inUse, code: "customer_in_use", message: "Bu mijozda 1 ta buyurtma bor" })
  expect(await failure(deleteStage(s.yangi.id))).toMatchObject({ ...inUse, code: "stage_in_use", message: "Bu bosqichda 1 ta buyurtma bor" })
  expect(await failure(deleteOrderType(s.montaj.id))).toMatchObject({ ...inUse, code: "type_in_use", message: "Bu turda 1 ta buyurtma bor" })
  expect(await failure(deleteOrderField(s.montaj.id, s.izoh.id))).toMatchObject({
    ...inUse,
    code: "field_in_use",
    message: "Bu maydon 1 ta buyurtmada to'ldirilgan",
  })
  expect(await failure(deleteOption(s.dropdown.id, s.instagram.id))).toMatchObject({
    ...inUse,
    code: "option_in_use",
    message: "Bu variant 1 ta buyurtmada tanlangan",
  })
  // The customers are told first.
  const vali = await createCustomer(s.jismoniy.id, "998905555555", { [s.fish.id]: "Vali", [s.manba.id]: s.instagram.id })
  expect(await failure(deleteOption(s.dropdown.id, s.instagram.id))).toMatchObject({ message: "Bu variant 1 ta mijozda tanlangan" })

  // What nobody uses goes as before; a deleted order holds nothing.
  await deleteStage(s.jarayonda.id)
  await deleteOrderType(s.buyurtma.id)
  await deleteOrderField(s.montaj.id, s.summa.id)
  await deleteOrder(order.id)
  await deleteCustomer(s.ali.id)
  await deleteStage(s.yangi.id)
  await deleteOrderType(s.montaj.id)

  // The suggestions of the order form: the digits typed after 998.
  const phones = async (phone: string) => (await listCustomers({ phone })).items.map((c) => c.phone)
  expect(await phones("9055")).toEqual([vali.phone])
  expect(await phones("90")).toEqual([vali.phone])
  expect(await phones("5555")).toEqual([])
  expect(await failure(listCustomers({ phone: "abc" }))).toMatchObject({ status: 400, message: "Telefon raqami noto'g'ri" })
  expect(await failure(listCustomers({ phone: "9055555555" }))).toMatchObject({ status: 400, message: "Telefon raqami noto'g'ri" })
})

// The roles (logic/roles.md, section 5; backend/internal/app/roles_test.go).
type RoleInput = components["schemas"]["RoleInput"]
const listRoles = () => call(api.GET("/app/roles"))
const createRole = (body: RoleInput) => call(api.POST("/app/roles", { body }))
const updateRole = (id: number, body: RoleInput) => call(api.PUT("/app/roles/{id}", { params: { path: { id } }, body }))
const deleteRole = (id: number) => call(api.DELETE("/app/roles/{id}", { params: { path: { id } } }))
const giveRole = (phone: string, roleId: number | null) =>
  call(api.PUT("/app/employees/{phone}/role", { params: { path: { phone } }, body: { role_id: roleId } }))

test("the owner makes, changes and deletes roles; the permissions come back in the catalog's order", async () => {
  await signIn(ALI)
  expect(await listRoles()).toEqual([])

  const sotuvchi = await createRole({ name: " Sotuvchi ", permissions: ["orders.view", "customers.view", "customers.view"] })
  expect(sotuvchi).toMatchObject({ name: "Sotuvchi", permissions: ["customers.view", "orders.view"], members_count: 0 })
  const admin = await createRole({ name: "admin", permissions: [] })
  expect((await listRoles()).map((r) => r.name)).toEqual(["admin", "Sotuvchi"])

  expect(await updateRole(sotuvchi.id, { name: "Katta sotuvchi", permissions: ["customers.create", "customers.view"] })).toMatchObject({
    name: "Katta sotuvchi",
    permissions: ["customers.view", "customers.create"],
  })
  expect(await failure(createRole({ name: "katta SOTUVCHI", permissions: [] }))).toMatchObject({
    status: 409,
    code: "name_taken",
    message: "Bu nomli rol allaqachon bor",
  })
  expect(await failure(createRole({ name: " ", permissions: [] }))).toMatchObject({ status: 400, message: "Nomni kiriting" })
  expect(await failure(createRole({ name: "Kassir", permissions: ["customers.fly" as Permission] }))).toMatchObject({
    status: 400,
    message: "Ruxsat noto'g'ri",
  })
  expect(await failure(updateRole(sotuvchi.id, { name: "Kassir", permissions: ["orders.create"] }))).toMatchObject({
    status: 400,
    message: "«Vazifalar» bo'limida avval «Ko'rish» ni belgilang",
  })
  expect(await failure(updateRole(999999, { name: "X", permissions: [] }))).toMatchObject({ status: 404, message: "Rol topilmadi" })

  await deleteRole(admin.id)
  expect((await listRoles()).map((r) => r.id)).toEqual([sotuvchi.id])
  expect(await failure(deleteRole(admin.id))).toMatchObject({ status: 404, code: "not_found" })
})

test("an employee holds a role and works by it; a role someone holds is not deleted", async () => {
  const owner = await signIn(ALI)
  const kuzatuvchi = await createRole({ name: "Kuzatuvchi", permissions: ["orders.view"] })
  expect(await giveRole(VALI, kuzatuvchi.id)).toMatchObject({ phone: VALI, role: "user", role_id: kuzatuvchi.id, role_name: "Kuzatuvchi" })
  expect((await listRoles())[0].members_count).toBe(1)
  expect((await call(api.GET("/app/employees"))).find((m) => m.phone === VALI)).toMatchObject({ role_id: kuzatuvchi.id, role_name: "Kuzatuvchi" })
  expect(await failure(deleteRole(kuzatuvchi.id))).toMatchObject({
    status: 409,
    code: "role_in_use",
    message: "Bu rol 1 ta xodimga biriktirilgan",
  })

  await signIn(VALI)
  await chooseCompany(1)
  const me = await call(api.GET("/app/me"))
  expect(me.permissions).toEqual(["orders.view"])
  expect(me.company?.role_name).toBe("Kuzatuvchi")
  expect(await failure(call(api.GET("/app/customers")))).toMatchObject({ status: 403, code: "forbidden" })

  // Back as the owner (a second code within a minute would be refused).
  setAccessToken(owner.access_token)
  expect(await giveRole(VALI, null)).toMatchObject({ role_id: null, role_name: null })
  await deleteRole(kuzatuvchi.id)
  expect(await listRoles()).toEqual([])
})

test("the roles are the owner's: an employee, and a session with no company chosen, get owner_only; the owner takes no role", async () => {
  await signIn(VALI)
  expect(await failure(listRoles())).toMatchObject({ status: 403, code: "owner_only" })
  await chooseCompany(1)
  expect(await failure(listRoles())).toMatchObject({ status: 403, code: "owner_only", message: "Bu bo'lim faqat kompaniya egasi uchun" })
  expect(await failure(createRole({ name: "X", permissions: [] }))).toMatchObject({ status: 403, code: "owner_only" })

  await signIn(ALI)
  const role = await createRole({ name: "X", permissions: [] })
  expect(await failure(giveRole(ALI, role.id))).toMatchObject({ status: 409, code: "cannot_change_owner" })
  expect(await failure(giveRole("998909999999", role.id))).toMatchObject({ status: 404, message: "Xodim topilmadi" })
  expect(await failure(giveRole(VALI, 999999))).toMatchObject({ status: 404, message: "Rol topilmadi" })
})

// The catalog (logic/products.md; backend/internal/app/catalog_test.go).
const products = (query: Record<string, string> = {}) => call(api.GET("/app/products", { params: { query } }))
const addProduct = (body: components["schemas"]["ProductInput"]) => call(api.POST("/app/products", { body }))

test("a product is entered with its fields trimmed, a service without a unit; the names and the SKUs are checked like the Go API's", async () => {
  await signIn(VALI)
  await chooseCompany(1)

  const olma = await addProduct({ kind: "product", name: " Olma ", unit: "kg", sku: "A-1", price: "12000.5", note: "Qizil" })
  expect(olma).toMatchObject({
    kind: "product",
    name: "Olma",
    unit: "kg",
    sku: "A-1",
    price: "12000.50",
    note: "Qizil",
    is_active: true,
    created_by_name: "Vali Aliyev",
  })
  expect(olma.created_at).toBe(olma.updated_at)
  const service = await addProduct({ kind: "service", name: "Yetkazish", price: "50000" })
  expect(service).toMatchObject({ kind: "service", unit: null, sku: null, price: "50000.00", note: null })

  for (const [body, message] of [
    [{ name: "Nok" }, "Turni tanlang"],
    [{ kind: "product", name: " ", unit: "kg" }, "Nomni kiriting"],
    [{ kind: "product", name: "a".repeat(121), unit: "kg" }, "Nom 120 belgidan oshmasin"],
    [{ kind: "product", name: "Nok" }, "Birlikni tanlang"],
    [{ kind: "product", name: "Nok", unit: "tonna" }, "Birlikni tanlang"],
    [{ kind: "service", name: "Ta'mirlash", unit: "dona" }, "Xizmatga birlik berilmaydi"],
    [{ kind: "service", name: "Ta'mirlash", sku: "S-1" }, "Xizmatga artikul berilmaydi"],
    [{ kind: "product", name: "Nok", unit: "kg", sku: "1".repeat(61) }, "Artikul 60 belgidan oshmasin"],
    [{ kind: "product", name: "Nok", unit: "kg", price: "1,5" }, "Narx noto'g'ri"],
    [{ kind: "product", name: "Nok", unit: "kg", note: "x".repeat(501) }, "Izoh 500 belgidan oshmasin"],
  ] as [components["schemas"]["ProductInput"], string][]) {
    expect(await failure(addProduct(body)), message).toMatchObject({ status: 400, code: "validation_error", message })
  }
  expect(await failure(addProduct({ kind: "product", name: "OLMA", unit: "dona" }))).toMatchObject({
    status: 409,
    code: "name_taken",
    message: "Bu nomli mahsulot allaqachon bor",
  })
  expect(await failure(addProduct({ kind: "service", name: "yetkazish" }))).toMatchObject({
    status: 409,
    code: "name_taken",
    message: "Bu nomli xizmat allaqachon bor",
  })
  expect(await failure(addProduct({ kind: "product", name: "Nok", unit: "dona", sku: "a-1" }))).toMatchObject({
    status: 409,
    code: "sku_taken",
    message: "Bu artikulli mahsulot allaqachon bor",
  })
  await expect(addProduct({ kind: "service", name: "Olma" })).resolves.toMatchObject({ kind: "service" })
})

test("the list is the active products by name, the services and the inactive apart, searched by name or SKU, 20 a page", async () => {
  await signIn(ALI)
  await addProduct({ kind: "product", name: "Nok", unit: "dona", sku: "N-1" })
  await addProduct({ kind: "product", name: "anor", unit: "kg" })
  const off = await addProduct({ kind: "product", name: "Olma", unit: "kg" })
  await addProduct({ kind: "service", name: "Yetkazish" })
  await call(api.PATCH("/app/products/{id}", { params: { path: { id: off.id } }, body: { is_active: false } }))
  const names = async (query: Record<string, string> = {}) => (await products(query)).items.map((p) => p.name)

  expect(await names()).toEqual(["anor", "Nok"])
  expect(await names({ status: "inactive" })).toEqual(["Olma"])
  expect(await names({ kind: "service" })).toEqual(["Yetkazish"])
  expect(await names({ search: "n-1" })).toEqual(["Nok"])
  expect(await names({ search: "ANO" })).toEqual(["anor"])
  expect(await products({ page: "2" })).toMatchObject({ items: [], total: 2, page: 2, page_size: 20 })
  expect(await failure(products({ page: "abc" }))).toMatchObject({ status: 400, message: "Sahifa raqami noto'g'ri" })
  expect(await failure(products({ kind: "thing" }))).toMatchObject({ status: 400, message: "Tur noto'g'ri" })
  expect(await failure(products({ status: "gone" }))).toMatchObject({ status: 400, message: "Holat noto'g'ri" })
})

test("a product is read, edited (its kind stays, what is not sent is cleared), turned off and deleted; another company's is not found", async () => {
  await signIn(VALI)
  await chooseCompany(2)
  const theirs = await addProduct({ kind: "product", name: "Nok", unit: "dona" })

  await signIn(ALI)
  expect(await failure(call(api.GET("/app/products/{id}", { params: { path: { id: theirs.id } } })))).toMatchObject({ status: 404 })
  const p = await addProduct({ kind: "product", name: "Olma", unit: "kg", sku: "A-1", price: "100", note: "Qizil" })
  const path = { params: { path: { id: p.id } } }

  // The page adds the stock in each of the member's locations.
  expect(await call(api.GET("/app/products/{id}", path))).toEqual({ ...p, stock: [{ location_id: asosiyOf(1).id, location_name: "Asosiy", quantity: "0.000" }] })
  const edited = await call(api.PUT("/app/products/{id}", { ...path, body: { name: "Qizil olma", unit: "dona" } }))
  expect(edited).toMatchObject({ kind: "product", name: "Qizil olma", unit: "dona", sku: null, price: null, note: null })
  expect(await failure(call(api.PUT("/app/products/{id}", { ...path, body: { name: "Qizil olma" } })))).toMatchObject({
    status: 400,
    message: "Birlikni tanlang",
  })
  expect((await call(api.PATCH("/app/products/{id}", { ...path, body: { is_active: false } }))).is_active).toBe(false)
  expect(await failure(call(api.PATCH("/app/products/{id}", { ...path, body: {} as { is_active: boolean } })))).toMatchObject({
    status: 400,
    message: "Holat noto'g'ri",
  })
  await call(api.DELETE("/app/products/{id}", path))
  expect(await failure(call(api.GET("/app/products/{id}", path)))).toMatchObject({ status: 404, code: "not_found", message: "Mahsulot topilmadi" })
  expect(await failure(call(api.DELETE("/app/products/{id}", path)))).toMatchObject({ status: 404 })
  await expect(addProduct({ kind: "product", name: "Olma", unit: "kg", sku: "A-1" })).resolves.toMatchObject({ name: "Olma" })
})

test("the products take their permissions: an employee without a role has them all, a role without them gets 403", async () => {
  holdRole(SARDOR, 1, "Kuzatuvchi", ["customers.view"])
  await signIn(SARDOR)
  await chooseCompany(1)
  expect(await failure(products())).toMatchObject({ status: 403, code: "forbidden" })
  expect(await failure(addProduct({ kind: "product", name: "Nok", unit: "dona" }))).toMatchObject({ status: 403, code: "forbidden" })

  await signIn(VALI)
  await chooseCompany(1)
  await expect(addProduct({ kind: "product", name: "Nok", unit: "dona" })).resolves.toMatchObject({ name: "Nok" })
})

// The member's own pages of the tab bar (logic/roles.md, section 8;
// backend/internal/app/nav_test.go).
test("/app/me tells the member's own pages of the tab bar; PUT /app/me/tab-bar keeps them, a repeated key once, four at most, null drops them", async () => {
  await signIn(ALI)
  expect((await call(api.GET("/app/me"))).tab_bar).toBeNull()

  const me = await call(api.PUT("/app/me/tab-bar", { body: { pages: ["sales", "purchases", "sales", "home"] } }))
  expect(me.tab_bar).toEqual(["sales", "purchases", "home"])
  expect(me.company?.name).toBe("Olma Savdo")
  expect((await call(api.GET("/app/me"))).tab_bar).toEqual(["sales", "purchases", "home"])
  expect(await failure(call(api.PUT("/app/me/tab-bar", { body: { pages: ["orders", "settings" as never] } })))).toMatchObject({
    status: 400,
    message: "Sahifa noto'g'ri",
  })
  expect(await failure(call(api.PUT("/app/me/tab-bar", { body: { pages: ["home", "customers", "orders", "products", "sales"] } })))).toMatchObject({
    status: 400,
    message: "Panelda ko'pi bilan 4 ta sahifa",
  })
  expect((await call(api.GET("/app/me"))).tab_bar).toEqual(["sales", "purchases", "home"])
  expect((await call(api.PUT("/app/me/tab-bar", { body: { pages: [] } }))).tab_bar).toEqual([])
  expect((await call(api.PUT("/app/me/tab-bar", { body: { pages: null } }))).tab_bar).toBeNull()

  await signIn(VALI)
  expect(await failure(call(api.PUT("/app/me/tab-bar", { body: { pages: ["home"] } })))).toMatchObject({ status: 403, code: "company_required" })
})

// The warehouse (logic/warehouse.md; backend/internal/app/warehouse_test.go).
const suppliers = (query: Record<string, string> = {}) => call(api.GET("/app/suppliers", { params: { query } }))
const addSupplier = (body: components["schemas"]["SupplierInput"]) => call(api.POST("/app/suppliers", { body }))
const getSupplier = (id: number) => call(api.GET("/app/suppliers/{id}", { params: { path: { id } } }))
const purchases = (query: Record<string, string> = {}) => call(api.GET("/app/purchases", { params: { query } }))
const addPurchase = (body: components["schemas"]["PurchaseCreate"]) => call(api.POST("/app/purchases", { body }))
const getPurchase = (id: number) => call(api.GET("/app/purchases/{id}", { params: { path: { id } } }))
const getProduct = (id: number) => call(api.GET("/app/products/{id}", { params: { path: { id } } }))
const payments = (id: number) => call(api.GET("/app/suppliers/{id}/payments", { params: { path: { id } } }))
const statement = (id: number) => call(api.GET("/app/suppliers/{id}/statement", { params: { path: { id } } }))
// The usual moment of a document in the tests, 9:00 on 2026-10-07 in
// Tashkent, as the client sends it and as the API tells it back.
const AT = "2026-10-07T09:00:00+05:00"
const AT_UTC = "2026-10-07T04:00:00Z"
// cashOfCompany is the cash account every company starts with.
const cashOfCompany = (companyId: number) => db.accounts[companyId][0].id

test("a supplier is entered with its phone normalized, listed with its balance for whoever may see the purchases, turned off, and kept while in use", async () => {
  await signIn(ALI)
  await chooseCompany(1)
  const { olma } = seedCatalog()
  const asosiy = asosiyOf(1).id
  const cash = cashOfCompany(1)

  const supplier = await addSupplier({ name: " Bozor ", phone: "+998 90 123-45-67" })
  expect(supplier).toMatchObject({ name: "Bozor", phone: "998901234567", note: null, is_active: true, balance: "0.00", purchases_total: "0.00", payments_total: "0.00", balance_by_currency: [], created_by_name: "Ali Valiyev" })
  expect(supplier.created_at).toBe(supplier.updated_at)
  for (const [body, message] of [
    [{ name: " " }, "Nomni kiriting"],
    [{ name: "a".repeat(121) }, "Nom 120 belgidan oshmasin"],
    [{ name: "X", phone: "12" }, "Telefon raqami noto'g'ri"],
    [{ name: "X", phone: "+7 900 000 00 00" }, "Telefon raqami noto'g'ri"],
    [{ name: "X", note: "x".repeat(501) }, "Izoh 500 belgidan oshmasin"],
  ] as [components["schemas"]["SupplierInput"], string][]) {
    expect(await failure(addSupplier(body)), message).toMatchObject({ status: 400, code: "validation_error", message })
  }
  expect(await failure(addSupplier({ name: "bozor" }))).toMatchObject({ status: 409, code: "name_taken", message: "Bu nomli ta'minotchi allaqachon bor" })
  const saved = await call(api.PUT("/app/suppliers/{id}", { params: { path: { id: supplier.id } }, body: { name: "Eski bozor", note: "Chorsu" } }))
  expect(saved).toMatchObject({ name: "Eski bozor", phone: null, note: "Chorsu" })

  const purchase = await addPurchase({ location_id: asosiy, supplier_id: supplier.id, at: AT, payments: [{ bank_account_id: cash, amount: "500" }], items: [{ product_id: olma.id, quantity: "10", price: "1000" }] })
  expect(purchase).toMatchObject({ number: 1, total: "10000.00", total_uzs: "10000.00", paid: "500.00", items_count: 1, currency_id: 1, rate: "1.0000", at: AT_UTC })
  expect(await getSupplier(supplier.id)).toMatchObject({ balance: "9500.00", purchases_total: "10000.00", payments_total: "500.00", balance_by_currency: [{ currency_id: 1, amount: "9500.00" }] })
  expect((await suppliers()).items[0]).toMatchObject({ balance: "9500.00", balance_by_currency: null })
  expect((await suppliers({ search: "90 123" })).total).toBe(0)
  expect((await suppliers({ search: "eski" })).items.map((s) => s.name)).toEqual(["Eski bozor"])
  expect(await failure(call(api.DELETE("/app/suppliers/{id}", { params: { path: { id: supplier.id } } })))).toMatchObject({ status: 409, code: "supplier_in_use", message: "Bu ta'minotchida 2 ta hujjat bor" })
  expect(await call(api.PATCH("/app/suppliers/{id}", { params: { path: { id: supplier.id } }, body: { is_active: false } }))).toMatchObject({ is_active: false })
  expect((await suppliers({ status: "inactive" })).total).toBe(1)
  expect((await suppliers()).total).toBe(0)
  expect(await failure(getSupplier(999))).toMatchObject({ status: 404, code: "not_found", message: "Ta'minotchi topilmadi" })

  // Whoever may see the suppliers alone sees no balance.
  holdRole(VALI, 1, "Kuzatuvchi", ["suppliers.view"])
  await signIn(VALI)
  await chooseCompany(1)
  const row = (await suppliers({ status: "inactive" })).items[0]
  expect(row).toMatchObject({ name: "Eski bozor", balance: null, purchases_total: null, payments_total: null, balance_by_currency: null })
})

test("a purchase lands in the stock journal of its location, is numbered, edited anew and deleted with its payments; the supplier's statement follows", async () => {
  await signIn(ALI)
  await chooseCompany(1)
  const { olma, nok, yetkazish, eski } = seedCatalog()
  const asosiy = asosiyOf(1).id
  const chilonzor = addLocation(1, "Chilonzor").id
  const cash = cashOfCompany(1)
  const supplier = await addSupplier({ name: "Bozor" })
  const body = (items: components["schemas"]["PurchaseItemInput"][], extra: Partial<components["schemas"]["PurchaseCreate"]> = {}): components["schemas"]["PurchaseCreate"] => ({
    location_id: asosiy,
    supplier_id: supplier.id,
    at: AT,
    items,
    ...extra,
  })

  for (const [input, message] of [
    [body([{ product_id: olma.id, quantity: "1", price: "1" }], { location_id: 0 }), "Lokatsiyani tanlang"],
    [body([{ product_id: olma.id, quantity: "1", price: "1" }], { supplier_id: 0 }), "Ta'minotchini tanlang"],
    [body([{ product_id: olma.id, quantity: "1", price: "1" }], { at: "" }), "Vaqtni kiriting"],
    [body([{ product_id: olma.id, quantity: "1", price: "1" }], { at: "7.10.2026" }), "Vaqt noto'g'ri"],
    [body([{ product_id: olma.id, quantity: "1", price: "1" }], { rate: "2" }), "Kurs noto'g'ri"],
    [body([{ product_id: olma.id, quantity: "1", price: "1" }], { note: "x".repeat(501) }), "Izoh 500 belgidan oshmasin"],
    [body([]), "Kamida bitta mahsulot qo'shing"],
    [body([{ product_id: 999, quantity: "1", price: "1" }]), "Mahsulotni tanlang"],
    [body([{ product_id: yetkazish.id, quantity: "1", price: "1" }]), "Xizmat xaridga kiritilmaydi"],
    [body([{ product_id: eski.id, quantity: "1", price: "1" }]), "Mahsulot nofaol"],
    [body([{ product_id: olma.id, quantity: "1", price: "1" }, { product_id: olma.id, quantity: "2", price: "1" }]), "«Olma» ikki marta kiritilgan"],
    [body([{ product_id: olma.id, quantity: "0", price: "1" }]), "«Olma» miqdori noto'g'ri"],
    [body([{ product_id: olma.id, quantity: "1", price: "1,5" }]), "«Olma» narxi noto'g'ri"],
    [body([{ product_id: olma.id, quantity: "1", price: "1" }], { payments: [{ bank_account_id: 0, amount: "1" }] }), "Akkauntni tanlang"],
    [body([{ product_id: olma.id, quantity: "1", price: "1" }], { payments: [{ bank_account_id: cash, amount: "-1" }] }), "To'lov summasi noto'g'ri"],
  ] as [components["schemas"]["PurchaseCreate"], string][]) {
    expect(await failure(addPurchase(input)), message).toMatchObject({ status: 400, code: "validation_error", message })
  }
  expect(await failure(addPurchase(body([{ product_id: olma.id, quantity: "1", price: "1" }], { currency_id: 3 })))).toMatchObject({ status: 400, code: "currency_not_allowed" })
  expect(await failure(addPurchase(body([{ product_id: olma.id, quantity: "1", price: "1" }], { location_id: 999 })))).toMatchObject({ status: 403, code: "forbidden" })
  expect((await purchases()).total).toBe(0)
  expect(db.transactions.filter((t) => t.companyId === 1)).toHaveLength(0)

  const first = await addPurchase(body([{ product_id: olma.id, quantity: "12.5", price: "1000" }, { product_id: nok.id, quantity: "3", price: "2500.5" }], { payments: [{ bank_account_id: cash, amount: "5000" }], note: " Ertalab " }))
  expect(first).toMatchObject({ number: 1, location_id: asosiy, location_name: "Asosiy", supplier: { id: supplier.id, name: "Bozor" }, at: AT_UTC, currency_id: 1, rate: "1.0000", total: "20001.50", total_uzs: "20001.50", paid: "5000.00", note: "Ertalab", items_count: 2, created_by_name: "Ali Valiyev" })
  expect(first.items).toEqual([
    { product_id: olma.id, name: "Olma", unit: "kg", quantity: "12.500", price: "1000.00", amount: "12500.00" },
    { product_id: nok.id, name: "Nok", unit: "dona", quantity: "3.000", price: "2500.50", amount: "7501.50" },
  ])
  expect(first.payments).toEqual([{ id: expect.any(Number), bank_account_id: cash, account_name: "Naqd", amount: "5000.00", currency_id: 1 }])
  const product = await getProduct(olma.id)
  expect(product).toMatchObject({ quantity: "12.500", last_price: { amount: "1000.00", currency_id: 1 } })
  expect(product.stock).toEqual([
    { location_id: asosiy, location_name: "Asosiy", quantity: "12.500" },
    { location_id: chilonzor, location_name: "Chilonzor", quantity: "0.000" },
  ])
  expect((await products({ location_id: String(chilonzor) })).items.find((p) => p.id === olma.id)?.quantity).toBe("0.000")
  expect((await products({ location_id: String(asosiy) })).items.find((p) => p.id === olma.id)?.quantity).toBe("12.500")
  expect((await products({ kind: "service" })).items.find((p) => p.id === yetkazish.id)?.quantity).toBeNull()
  expect(await failure(products({ location_id: "abc" }))).toMatchObject({ status: 400, message: "Lokatsiya noto'g'ri" })
  const paid = await payments(supplier.id)
  expect(paid.items).toHaveLength(1)
  expect(paid.items[0]).toMatchObject({ purchase_id: first.id, purchase_number: 1, bank_account_id: cash, account_name: "Naqd", amount: "5000.00", currency_id: 1, rate: "1.0000", amount_uzs: "5000.00", at: AT_UTC, note: null })
  expect(await failure(call(api.PUT("/app/suppliers/{id}/payments/{paymentId}", { params: { path: { id: supplier.id, paymentId: paid.items[0].id } }, body: { bank_account_id: cash, amount: "1", at: AT } })))).toMatchObject({ status: 409, code: "payment_linked" })
  expect(await failure(call(api.DELETE("/app/products/{id}", { params: { path: { id: olma.id } } })))).toMatchObject({ status: 409, code: "product_in_use", message: "Bu mahsulot 1 ta hujjatda bor" })
  const list = await purchases()
  expect(list.items).toHaveLength(1)
  expect(list.items[0]).not.toHaveProperty("items")
  expect(list.items[0]).not.toHaveProperty("payments")
  expect(await getPurchase(first.id)).toEqual(first)

  // An edit: Olma down to 4, Nok out; nothing paid now.
  const saved = await call(api.PUT("/app/purchases/{id}", { params: { path: { id: first.id } }, body: { supplier_id: supplier.id, at: "2026-10-09T09:00:00+05:00", items: [{ product_id: olma.id, quantity: "4", price: "1100" }] } }))
  expect(saved).toMatchObject({ number: 1, at: "2026-10-09T04:00:00Z", total: "4400.00", paid: "0.00", payments: [], items_count: 1, note: null })
  expect((await getProduct(olma.id)).quantity).toBe("4.000")
  expect((await getProduct(nok.id)).quantity).toBe("0.000")
  expect((await payments(supplier.id)).total).toBe(0)
  const lines = await call(api.GET("/app/products/{id}/purchases", { params: { path: { id: olma.id } } }))
  expect(lines.items).toEqual([{ purchase_id: first.id, number: 1, at: "2026-10-09T04:00:00Z", supplier: { id: supplier.id, name: "Bozor" }, location_id: asosiy, location_name: "Asosiy", currency_id: 1, quantity: "4.000", price: "1100.00", amount: "4400.00" }])
  expect(await failure(call(api.PUT("/app/purchases/{id}", { params: { path: { id: 999 } }, body: { supplier_id: supplier.id, at: AT, items: [] } })))).toMatchObject({ status: 404, message: "Xarid topilmadi" })

  // A deletion: the stock comes back, the number is never given again.
  await call(api.DELETE("/app/purchases/{id}", { params: { path: { id: first.id } } }))
  expect((await getProduct(olma.id)).quantity).toBe("0.000")
  expect((await purchases()).total).toBe(0)
  expect((await addPurchase(body([{ product_id: olma.id, quantity: "1", price: "1" }]))).number).toBe(2)
  expect(await failure(getPurchase(first.id))).toMatchObject({ status: 404, code: "not_found", message: "Xarid topilmadi" })

  // A supplier's own payment: entered, edited, deleted; the balance and
  // the statement follow.
  const own = await call(api.POST("/app/suppliers/{id}/payments", { params: { path: { id: supplier.id } }, body: { bank_account_id: cash, amount: "1200.5", at: "2026-10-08T09:00:00+05:00", note: " Naqd " } }))
  expect(own).toMatchObject({ supplier_id: supplier.id, purchase_id: null, purchase_number: null, bank_account_id: cash, account_name: "Naqd", amount: "1200.50", currency_id: 1, rate: "1.0000", amount_uzs: "1200.50", at: "2026-10-08T04:00:00Z", note: "Naqd", created_by_name: "Ali Valiyev" })
  for (const [input, message] of [
    [{ amount: "1", at: AT }, "Akkauntni tanlang"],
    [{ bank_account_id: cash, at: AT }, "Summani kiriting"],
    [{ bank_account_id: cash, amount: "0", at: AT }, "Summa noto'g'ri"],
    [{ bank_account_id: cash, amount: "1" }, "Vaqtni kiriting"],
    [{ bank_account_id: cash, amount: "1", at: "8.10.2026" }, "Vaqt noto'g'ri"],
  ] as [components["schemas"]["PaymentInput"], string][]) {
    expect(await failure(call(api.POST("/app/suppliers/{id}/payments", { params: { path: { id: supplier.id } }, body: input }))), message).toMatchObject({ status: 400, message })
  }
  expect(await getSupplier(supplier.id)).toMatchObject({ purchases_total: "1.00", payments_total: "1200.50", balance: "-1199.50" })
  const rows = await statement(supplier.id)
  expect(rows.total).toBe(2)
  expect(rows.items.map((r) => [r.kind, r.delta_uzs, r.balance_uzs])).toEqual([
    ["supplier_payment", "-1200.50", "-1199.50"],
    ["purchase", "1.00", "1.00"],
  ])
  expect(rows.items[0]).toMatchObject({ id: own.id, number: 2, at: "2026-10-08T04:00:00Z", amount: "1200.50", currency_id: 1, rate: "1.0000", amount_uzs: "1200.50", linked_id: null, linked_number: null, bank_account_id: cash, account_name: "Naqd", note: "Naqd", created_by_name: "Ali Valiyev" })
  expect(rows.items[1]).toMatchObject({ kind: "purchase", number: 2, bank_account_id: null, account_name: null })
  expect(await failure(statement(999))).toMatchObject({ status: 404 })
  expect(await call(api.PUT("/app/suppliers/{id}/payments/{paymentId}", { params: { path: { id: supplier.id, paymentId: own.id } }, body: { bank_account_id: cash, amount: "1500", at: "2026-10-09T09:00:00+05:00" } }))).toMatchObject({ amount: "1500.00", at: "2026-10-09T04:00:00Z", note: null })
  await call(api.DELETE("/app/suppliers/{id}/payments/{paymentId}", { params: { path: { id: supplier.id, paymentId: own.id } } }))
  expect(await failure(call(api.DELETE("/app/suppliers/{id}/payments/{paymentId}", { params: { path: { id: supplier.id, paymentId: own.id } } })))).toMatchObject({ status: 404, message: "To'lov topilmadi" })
  expect((await getSupplier(supplier.id)).balance).toBe("1.00")
})

test("a purchase in dollars: the standard rate at its moment or its own, the total in so'm, the payments in their accounts' currencies", async () => {
  await signIn(VALI)
  await chooseCompany(2)
  const asosiy = asosiyOf(2).id
  const cash = cashOfCompany(2)
  const card = db.accounts[2].find((a) => a.name === "Karta")!.id
  const olma = await call(api.POST("/app/products", { body: { kind: "product", name: "Olma", unit: "kg", currency_id: 1 } }))
  const supplier = await addSupplier({ name: "Bozor" })

  const purchase = await addPurchase({ location_id: asosiy, supplier_id: supplier.id, at: AT, currency_id: 2, items: [{ product_id: olma.id, quantity: "2", price: "50" }], payments: [{ bank_account_id: cash, amount: "640000" }, { bank_account_id: card, amount: "10" }] })
  expect(purchase).toMatchObject({ currency_id: 2, rate: "12800.0000", total: "100.00", total_uzs: "1280000.00", paid: "60.00" })
  expect(purchase.payments).toEqual([
    { id: expect.any(Number), bank_account_id: cash, account_name: "Naqd", amount: "640000.00", currency_id: 1 },
    { id: expect.any(Number), bank_account_id: card, account_name: "Karta", amount: "10.00", currency_id: 2 },
  ])
  expect(await getSupplier(supplier.id)).toMatchObject({ balance: "512000.00", balance_by_currency: [{ currency_id: 1, amount: "-640000.00" }, { currency_id: 2, amount: "90.00" }] })
  expect((await getProduct(olma.id)).last_price).toEqual({ amount: "50.00", currency_id: 2 })
  const own = await addPurchase({ location_id: asosiy, supplier_id: supplier.id, at: AT, currency_id: 2, rate: "13000", items: [{ product_id: olma.id, quantity: "1", price: "10" }] })
  expect(own).toMatchObject({ rate: "13000.0000", total_uzs: "130000.00" })
  expect(await failure(addPurchase({ location_id: asosiy, supplier_id: supplier.id, at: AT, currency_id: 2, rate: "abc", items: [{ product_id: olma.id, quantity: "1", price: "10" }] }))).toMatchObject({ status: 400, message: "Kurs noto'g'ri" })
  expect(await failure(addPurchase({ location_id: asosiy, supplier_id: supplier.id, at: AT, currency_id: 3, items: [{ product_id: olma.id, quantity: "1", price: "10" }] }))).toMatchObject({ status: 400, code: "currency_not_allowed" })
  const paid = await call(api.POST("/app/suppliers/{id}/payments", { params: { path: { id: supplier.id } }, body: { bank_account_id: card, amount: "10", at: AT } }))
  expect(paid).toMatchObject({ currency_id: 2, rate: "12800.0000", amount: "10.00", amount_uzs: "128000.00" })
  const rows = await statement(supplier.id)
  expect(rows.items.map((r) => [r.kind, r.amount, r.currency_id, r.amount_uzs, r.balance_uzs])).toEqual([
    ["supplier_payment", "10.00", 2, "128000.00", "514000.00"],
    ["purchase", "10.00", 2, "130000.00", "642000.00"],
    ["supplier_payment", "10.00", 2, "128000.00", "512000.00"],
    ["supplier_payment", "640000.00", 1, "640000.00", "640000.00"],
    ["purchase", "100.00", 2, "1280000.00", "1280000.00"],
  ])
})

test("a restricted employee sees the purchases of their locations alone, and the whole balance", async () => {
  await signIn(ALI)
  await chooseCompany(1)
  const { olma } = seedCatalog()
  const asosiy = asosiyOf(1).id
  const chilonzor = addLocation(1, "Chilonzor").id
  const supplier = await addSupplier({ name: "Bozor" })
  const theirs = await addPurchase({ location_id: asosiy, supplier_id: supplier.id, at: AT, items: [{ product_id: olma.id, quantity: "1", price: "1000" }] })
  restrictTo(VALI, 1, [chilonzor])
  await signIn(VALI)
  await chooseCompany(1)

  expect((await purchases()).total).toBe(0)
  expect(await failure(purchases({ location_id: String(asosiy) }))).toMatchObject({ status: 403, code: "forbidden" })
  expect(await failure(getPurchase(theirs.id))).toMatchObject({ status: 404, message: "Xarid topilmadi" })
  expect(await failure(addPurchase({ location_id: asosiy, supplier_id: supplier.id, at: AT, items: [{ product_id: olma.id, quantity: "1", price: "1" }] }))).toMatchObject({ status: 403, code: "forbidden" })
  const mine = await addPurchase({ location_id: chilonzor, supplier_id: supplier.id, at: AT, items: [{ product_id: olma.id, quantity: "2", price: "900" }] })
  expect(mine.number).toBe(2)
  expect((await purchases()).items.map((p) => p.number)).toEqual([2])
  expect(await getSupplier(supplier.id)).toMatchObject({ balance: "2800.00" })
  expect(await getProduct(olma.id)).toMatchObject({ quantity: "2.000", stock: [{ location_id: chilonzor, location_name: "Chilonzor", quantity: "2.000" }] })
  expect((await call(api.GET("/app/products/{id}/purchases", { params: { path: { id: olma.id } } }))).total).toBe(1)
})

test("/app/me tells the company's currencies with the rates in force", async () => {
  await signIn(ALI)
  await chooseCompany(1)
  expect((await call(api.GET("/app/me"))).currencies).toEqual([
    { id: 1, code: "UZS", name: "O'zbek so'mi", symbol: "so'm", rate: "1.0000" },
  ])

  await signIn(VALI)
  await chooseCompany(2)
  expect((await call(api.GET("/app/me"))).currencies).toEqual([
    { id: 1, code: "UZS", name: "O'zbek so'mi", symbol: "so'm", rate: "1.0000" },
    { id: 2, code: "USD", name: "AQSH dollari", symbol: "$", rate: "12800.0000" },
  ])
  await chooseCompany(null)
  expect((await call(api.GET("/app/me"))).currencies).toEqual([])
})

test("the rates are read with the settings and set with settings.edit, as the Go API does", async () => {
  await signIn(VALI)
  await chooseCompany(2)
  const history = await call(api.GET("/app/currency-rates", { params: { query: { page: 1 } } }))
  expect(history.total).toBe(1)
  expect(history.items[0]).toMatchObject({ usd: "12800.0000", eur: "0.0000", rub: "0.0000", set_by_name: "Vali Aliyev" })

  expect(await failure(call(api.POST("/app/currency-rates", { body: {} })))).toMatchObject({ status: 400, message: "Kursni kiriting" })
  expect(await failure(call(api.POST("/app/currency-rates", { body: { eur: "13900" } })))).toMatchObject({ status: 400, code: "currency_not_allowed" })
  expect(await failure(call(api.POST("/app/currency-rates", { body: { usd: "abc" } })))).toMatchObject({ status: 400, message: "Kurs noto'g'ri" })
  const set = await call(api.POST("/app/currency-rates", { body: { usd: "12900.5" } }))
  expect(set).toMatchObject({ usd: "12900.5000", eur: "0.0000", set_by_name: "Vali Aliyev" })
  expect((await call(api.GET("/app/me"))).currencies[1].rate).toBe("12900.5000")
  expect((await call(api.GET("/app/currency-rates", { params: { query: { page: 1 } } }))).items.map((r) => r.usd)).toEqual(["12900.5000", "12800.0000"])

  // An employee without the settings sees nothing of the rates; one with
  // settings.view alone cannot set them.
  await signIn(SARDOR)
  await chooseCompany(1)
  expect(await failure(call(api.GET("/app/currency-rates", { params: { query: { page: 1 } } })))).toMatchObject({ status: 403, code: "forbidden" })
  holdRole(SARDOR, 1, "Kuzatuvchi", ["settings.view"])
  expect((await call(api.GET("/app/currency-rates", { params: { query: { page: 1 } } }))).total).toBe(0)
  expect(await failure(call(api.POST("/app/currency-rates", { body: { usd: "12800" } })))).toMatchObject({ status: 403, code: "forbidden" })
})

test("a price is in the so'm unless said otherwise, and only in a currency the company has on", async () => {
  await signIn(ALI)
  await chooseCompany(1)
  const olma = await call(api.POST("/app/products", { body: { kind: "product", name: "Olma", unit: "kg", price: "12000" } }))
  expect(olma.currency_id).toBe(1)
  expect(await failure(call(api.POST("/app/products", { body: { kind: "product", name: "Nok", unit: "kg", price: "1", currency_id: 2 } })))).toMatchObject({
    status: 400,
    code: "currency_not_allowed",
    message: "Bu valyuta kompaniyada yoqilmagan",
  })
  expect(await failure(call(api.POST("/app/products", { body: { kind: "product", name: "Nok", unit: "kg", currency_id: 9 } })))).toMatchObject({ status: 400, message: "Valyuta noto'g'ri" })

  await signIn(VALI)
  await chooseCompany(2)
  const nok = await call(api.POST("/app/products", { body: { kind: "product", name: "Nok", unit: "kg", price: "1.5", currency_id: 2 } }))
  expect(nok.currency_id).toBe(2)
  const edited = await call(api.PUT("/app/products/{id}", { params: { path: { id: nok.id } }, body: { name: "Nok", unit: "kg", price: "2" } }))
  expect(edited.currency_id).toBe(1)
})

test("/app/me tells the company's accounts; the finance categories are read by every member and kept with the settings", async () => {
  await signIn(VALI)
  await chooseCompany(2)
  expect((await call(api.GET("/app/me"))).accounts).toEqual([
    { id: 9102, name: "Naqd", currency_id: 1, is_active: true },
    { id: 9112, name: "Karta", currency_id: 2, is_active: true },
  ])
  await chooseCompany(null)
  expect((await call(api.GET("/app/me"))).accounts).toEqual([])

  await signIn(ALI)
  await chooseCompany(1)
  const ijara = await call(api.POST("/app/finance-categories", { body: { name: " Ijara ", kind: "expense" } }))
  expect(ijara).toMatchObject({ name: "Ijara", kind: "expense", is_active: true })
  const kommunal = await call(api.POST("/app/finance-categories", { body: { name: "Kommunal", kind: "expense" } }))
  await call(api.POST("/app/finance-categories", { body: { name: "Ijara", kind: "income" } }))
  expect(await failure(call(api.POST("/app/finance-categories", { body: { name: "ijara", kind: "expense" } })))).toMatchObject({ status: 409, code: "name_taken" })
  expect(await failure(call(api.POST("/app/finance-categories", { body: { name: "Soliq", kind: "transfer" as "expense" } })))).toMatchObject({ status: 400, message: "Turni tanlang" })
  expect((await call(api.GET("/app/finance-categories"))).map((c) => [c.name, c.kind])).toEqual([
    ["Ijara", "expense"],
    ["Kommunal", "expense"],
    ["Ijara", "income"],
  ])
  await call(api.PUT("/app/finance-categories/order", { body: { kind: "expense", ids: [kommunal.id, ijara.id] } }))
  expect((await call(api.GET("/app/finance-categories", { params: { query: { kind: "expense" } } }))).map((c) => c.name)).toEqual(["Kommunal", "Ijara"])
  expect(await failure(call(api.PUT("/app/finance-categories/order", { body: { kind: "expense", ids: [kommunal.id] } })))).toMatchObject({ status: 409, code: "order_changed" })
  expect(await call(api.PATCH("/app/finance-categories/{id}", { params: { path: { id: ijara.id } }, body: { name: "Ofis ijarasi", is_active: false } }))).toMatchObject({ name: "Ofis ijarasi", is_active: false })
  await call(api.DELETE("/app/finance-categories/{id}", { params: { path: { id: ijara.id } } }))
  expect((await call(api.GET("/app/finance-categories", { params: { query: { kind: "expense" } } }))).map((c) => c.name)).toEqual(["Kommunal"])

  // An employee reads them, but may not change them.
  await signIn(SARDOR)
  await chooseCompany(1)
  expect((await call(api.GET("/app/finance-categories"))).length).toBe(2)
  expect(await failure(call(api.POST("/app/finance-categories", { body: { name: "Soliq", kind: "expense" } })))).toMatchObject({ status: 403, code: "forbidden" })
})

// The stock documents besides the purchases (logic/warehouse.md, section 5;
// backend/internal/app/stock_test.go).
const transfers = (query: Record<string, string> = {}) => call(api.GET("/app/transfers", { params: { query } }))
const addTransfer = (body: components["schemas"]["TransferCreate"]) => call(api.POST("/app/transfers", { body }))
const getTransfer = (id: number) => call(api.GET("/app/transfers/{id}", { params: { path: { id } } }))
const inventories = (query: Record<string, string> = {}) => call(api.GET("/app/inventories", { params: { query } }))
const addInventory = (body: components["schemas"]["InventoryCreate"]) => call(api.POST("/app/inventories", { body }))
const stockAt = (query: Partial<{ location_id: number; at: string; exclude_id: number }>) =>
  call(api.GET("/app/stock", { params: { query: query as { location_id: number; at?: string; exclude_id?: number } } }))
const openingStock = (query: Record<string, string> = {}) => call(api.GET("/app/opening-stock", { params: { query } }))
const addOpeningStock = (body: components["schemas"]["OpeningStockCreate"]) => call(api.POST("/app/opening-stock", { body }))
const moves = (id: number, query: Record<string, string> = {}) => call(api.GET("/app/products/{id}/moves", { params: { path: { id }, query } }))
const openings = (id: number) => call(api.GET("/app/suppliers/{id}/openings", { params: { path: { id } } }))
const addOpening = (id: number, body: components["schemas"]["OpeningInput"]) => call(api.POST("/app/suppliers/{id}/openings", { params: { path: { id } }, body }))

test("a transfer takes products out of one location into another at once, is seen from either end, and is the source's to change", async () => {
  db.cooldown = false
  await signIn(ALI)
  await chooseCompany(1)
  const { olma, yetkazish } = seedCatalog()
  const asosiy = asosiyOf(1).id
  const chilonzor = addLocation(1, "Chilonzor").id
  const supplier = await addSupplier({ name: "Bozor" })
  await addPurchase({ location_id: asosiy, supplier_id: supplier.id, at: AT, items: [{ product_id: olma.id, quantity: "10", price: "1000" }] })
  const body = (items: components["schemas"]["MoveInput"][], extra: Partial<components["schemas"]["TransferCreate"]> = {}): components["schemas"]["TransferCreate"] => ({
    location_id: asosiy,
    to_location_id: chilonzor,
    at: AT,
    items,
    ...extra,
  })

  for (const [input, message] of [
    [body([{ product_id: olma.id, quantity: "1" }], { location_id: 0 }), "Lokatsiyani tanlang"],
    [body([{ product_id: olma.id, quantity: "1" }], { to_location_id: 0 }), "Maqsad lokatsiyani tanlang"],
    [body([{ product_id: olma.id, quantity: "1" }], { to_location_id: 999 }), "Maqsad lokatsiyani tanlang"],
    [body([{ product_id: olma.id, quantity: "1" }], { to_location_id: asosiy }), "Maqsad lokatsiya boshqa bo'lsin"],
    [body([{ product_id: olma.id, quantity: "1" }], { at: "" }), "Vaqtni kiriting"],
    [body([{ product_id: olma.id, quantity: "1" }], { note: "x".repeat(501) }), "Izoh 500 belgidan oshmasin"],
    [body([]), "Kamida bitta mahsulot qo'shing"],
    [body([{ product_id: yetkazish.id, quantity: "1" }]), "Xizmat ombor hujjatiga kiritilmaydi"],
    [body([{ product_id: olma.id, quantity: "0" }]), "«Olma» miqdori noto'g'ri"],
  ] as [components["schemas"]["TransferCreate"], string][]) {
    expect(await failure(addTransfer(input)), message).toMatchObject({ status: 400, code: "validation_error", message })
  }
  expect(await failure(addTransfer(body([{ product_id: olma.id, quantity: "1" }], { location_id: 999 })))).toMatchObject({ status: 403, code: "forbidden" })
  expect(await failure(addTransfer(body([{ product_id: olma.id, quantity: "11" }])))).toMatchObject({ status: 409, code: "stock_insufficient", message: "«Olma» uchun omborda yetarli qoldiq yo'q" })
  expect((await getProduct(olma.id)).stock).toEqual([
    { location_id: asosiy, location_name: "Asosiy", quantity: "10.000" },
    { location_id: chilonzor, location_name: "Chilonzor", quantity: "0.000" },
  ])

  const first = await addTransfer(body([{ product_id: olma.id, quantity: "4" }], { note: " Filialga " }))
  expect(first).toMatchObject({ number: 1, location_id: asosiy, location_name: "Asosiy", to_location_id: chilonzor, to_location_name: "Chilonzor", at: AT_UTC, note: "Filialga", items_count: 1, created_by_name: "Ali Valiyev" })
  expect(first.items).toEqual([{ product_id: olma.id, name: "Olma", unit: "kg", quantity: "4.000" }])
  expect((await getProduct(olma.id)).stock).toEqual([
    { location_id: asosiy, location_name: "Asosiy", quantity: "6.000" },
    { location_id: chilonzor, location_name: "Chilonzor", quantity: "4.000" },
  ])
  expect((await addTransfer(body([{ product_id: olma.id, quantity: "1" }]))).number).toBe(2)
  expect((await addPurchase({ location_id: asosiy, supplier_id: supplier.id, at: AT, items: [{ product_id: olma.id, quantity: "1", price: "1" }] })).number).toBe(2)
  const list = await transfers()
  expect(list.total).toBe(2)
  expect(list.items.map((t) => t.number)).toEqual([2, 1])
  expect(list.items[0]).not.toHaveProperty("items")
  expect((await transfers({ location_id: String(chilonzor) })).total).toBe(2)
  expect(await getTransfer(first.id)).toEqual(first)

  // Sardor works in Chilonzor alone: he sees the transfers into it, but
  // may not change them.
  restrictTo(SARDOR, 1, [chilonzor])
  await signIn(SARDOR)
  await chooseCompany(1)
  expect((await transfers()).items.map((t) => t.number)).toEqual([2, 1])
  expect(await failure(transfers({ location_id: String(asosiy) }))).toMatchObject({ status: 403, code: "forbidden" })
  expect(await getTransfer(first.id)).toEqual(first)
  const edit = { to_location_id: chilonzor, at: AT, items: [{ product_id: olma.id, quantity: "1" }] }
  expect(await failure(call(api.PUT("/app/transfers/{id}", { params: { path: { id: first.id } }, body: edit })))).toMatchObject({ status: 403, code: "forbidden" })
  expect(await failure(call(api.DELETE("/app/transfers/{id}", { params: { path: { id: first.id } } })))).toMatchObject({ status: 403, code: "forbidden" })
  expect(await failure(addTransfer(body([{ product_id: olma.id, quantity: "1" }])))).toMatchObject({ status: 403, code: "forbidden" })

  // The owner edits it: fewer Olma, a later moment; and deletes it.
  await signIn(ALI)
  await chooseCompany(1)
  const saved = await call(api.PUT("/app/transfers/{id}", { params: { path: { id: first.id } }, body: { to_location_id: chilonzor, at: "2026-10-09T09:00:00+05:00", items: [{ product_id: olma.id, quantity: "2" }] } }))
  expect(saved).toMatchObject({ number: 1, location_id: asosiy, to_location_id: chilonzor, at: "2026-10-09T04:00:00Z", note: null, items_count: 1 })
  expect(saved.items).toEqual([{ product_id: olma.id, name: "Olma", unit: "kg", quantity: "2.000" }])
  expect((await getProduct(olma.id)).stock.map((l) => l.quantity)).toEqual(["8.000", "3.000"])
  expect(await failure(call(api.PUT("/app/transfers/{id}", { params: { path: { id: 999 } }, body: edit })))).toMatchObject({ status: 404, code: "not_found", message: "Ko'chirish topilmadi" })
  await call(api.DELETE("/app/transfers/{id}", { params: { path: { id: first.id } } }))
  expect(await failure(getTransfer(first.id))).toMatchObject({ status: 404, message: "Ko'chirish topilmadi" })
  expect((await getProduct(olma.id)).stock.map((l) => l.quantity)).toEqual(["10.000", "1.000"])
  expect((await addTransfer(body([{ product_id: olma.id, quantity: "1" }]))).number).toBe(3)
})

test("an inventory counts a location at a moment: what the journal expected then, what was counted, the difference into the stock; the stock at a moment is what it starts from", async () => {
  await signIn(ALI)
  await chooseCompany(1)
  const { olma, nok, eski } = seedCatalog()
  const asosiy = asosiyOf(1).id
  const chilonzor = addLocation(1, "Chilonzor").id
  const supplier = await addSupplier({ name: "Bozor" })
  await addPurchase({ location_id: asosiy, supplier_id: supplier.id, at: "2026-10-01T09:00:00+05:00", items: [{ product_id: olma.id, quantity: "10", price: "1000" }, { product_id: nok.id, quantity: "5", price: "2000" }] })

  expect(await stockAt({ location_id: asosiy })).toEqual([
    { product_id: nok.id, name: "Nok", unit: "dona", quantity: "5.000" },
    { product_id: olma.id, name: "Olma", unit: "kg", quantity: "10.000" },
  ])
  expect(await stockAt({ location_id: asosiy, at: "2026-09-30T00:00:00Z" })).toEqual([])
  expect(await stockAt({ location_id: chilonzor })).toEqual([])
  expect(await failure(stockAt({}))).toMatchObject({ status: 400, message: "Lokatsiyani tanlang" })
  expect(await failure(stockAt({ location_id: asosiy, at: "kecha" }))).toMatchObject({ status: 400, message: "Vaqt noto'g'ri" })
  expect(await failure(stockAt({ location_id: 999 }))).toMatchObject({ status: 403, code: "forbidden" })

  const body = (items: components["schemas"]["CountInput"][], extra: Partial<components["schemas"]["InventoryCreate"]> = {}): components["schemas"]["InventoryCreate"] => ({ location_id: asosiy, at: AT, items, ...extra })
  for (const [input, message] of [
    [body([{ product_id: olma.id, counted: "1" }], { location_id: 0 }), "Lokatsiyani tanlang"],
    [body([{ product_id: olma.id, counted: "1" }], { at: "" }), "Vaqtni kiriting"],
    [body([]), "Kamida bitta mahsulot qo'shing"],
    [body([{ product_id: eski.id, counted: "1" }]), "Mahsulot nofaol"],
    [body([{ product_id: olma.id, counted: "-1" }]), "«Olma» miqdori noto'g'ri"],
    [body([{ product_id: olma.id, counted: "1" }, { product_id: olma.id, counted: "2" }]), "«Olma» ikki marta kiritilgan"],
  ] as [components["schemas"]["InventoryCreate"], string][]) {
    expect(await failure(addInventory(input)), message).toMatchObject({ status: 400, code: "validation_error", message })
  }

  const inventory = await addInventory(body([{ product_id: olma.id, counted: "9" }, { product_id: nok.id, counted: "5" }], { note: " Oylik " }))
  expect(inventory).toMatchObject({ number: 1, location_id: asosiy, location_name: "Asosiy", at: AT_UTC, note: "Oylik", items_count: 2, created_by_name: "Ali Valiyev" })
  expect(inventory.items).toEqual([
    { product_id: olma.id, name: "Olma", unit: "kg", expected: "10.000", counted: "9.000", difference: "-1.000" },
    { product_id: nok.id, name: "Nok", unit: "dona", expected: "5.000", counted: "5.000", difference: "0.000" },
  ])
  expect((await getProduct(olma.id)).quantity).toBe("9.000")
  expect(db.moves.filter((m) => m.transactionId === inventory.id)).toHaveLength(1)
  const list = await inventories()
  expect(list.total).toBe(1)
  expect(list.items[0]).not.toHaveProperty("items")
  expect(await call(api.GET("/app/inventories/{id}", { params: { path: { id: inventory.id } } }))).toEqual(inventory)

  // The stock without the inventory's own count: what its edit form shows.
  expect(await stockAt({ location_id: asosiy, at: "2026-10-08T00:00:00Z" })).toEqual([
    { product_id: nok.id, name: "Nok", unit: "dona", quantity: "5.000" },
    { product_id: olma.id, name: "Olma", unit: "kg", quantity: "9.000" },
  ])
  expect((await stockAt({ location_id: asosiy, at: "2026-10-08T00:00:00Z", exclude_id: inventory.id })).find((r) => r.product_id === olma.id)?.quantity).toBe("10.000")
  expect(await failure(stockAt({ location_id: asosiy, exclude_id: "x" as never }))).toMatchObject({ status: 400, message: "Hujjat noto'g'ri" })

  // A purchase dated before the count arrives late: saved again, the count
  // expects it.
  await addPurchase({ location_id: asosiy, supplier_id: supplier.id, at: "2026-10-03T09:00:00+05:00", items: [{ product_id: olma.id, quantity: "4", price: "1" }] })
  expect((await getProduct(olma.id)).quantity).toBe("13.000")
  const saved = await call(api.PUT("/app/inventories/{id}", { params: { path: { id: inventory.id } }, body: { at: AT, items: [{ product_id: olma.id, counted: "9" }] } }))
  expect(saved.items).toEqual([{ product_id: olma.id, name: "Olma", unit: "kg", expected: "14.000", counted: "9.000", difference: "-5.000" }])
  expect((await getProduct(olma.id)).quantity).toBe("9.000")
  expect(await failure(call(api.PUT("/app/inventories/{id}", { params: { path: { id: 999 } }, body: { at: AT, items: [] } })))).toMatchObject({ status: 404, message: "Inventarizatsiya topilmadi" })

  // A surplus counted in and moved on cannot be taken back.
  const surplus = await addInventory(body([{ product_id: olma.id, counted: "12" }], { at: "2026-10-08T09:00:00+05:00" }))
  expect(surplus.items[0]).toMatchObject({ expected: "9.000", counted: "12.000", difference: "3.000" })
  await addTransfer({ location_id: asosiy, to_location_id: chilonzor, at: "2026-10-09T09:00:00+05:00", items: [{ product_id: olma.id, quantity: "11" }] })
  expect(await failure(call(api.DELETE("/app/inventories/{id}", { params: { path: { id: surplus.id } } })))).toMatchObject({ status: 409, code: "stock_insufficient" })
  await call(api.DELETE("/app/inventories/{id}", { params: { path: { id: inventory.id } } }))
  expect((await getProduct(olma.id)).stock.map((l) => l.quantity)).toEqual(["6.000", "11.000"])
  expect(await failure(call(api.GET("/app/inventories/{id}", { params: { path: { id: inventory.id } } })))).toMatchObject({ status: 404, message: "Inventarizatsiya topilmadi" })

  // Sardor, restricted to Chilonzor, sees none of Asosiy's.
  restrictTo(SARDOR, 1, [chilonzor])
  await signIn(SARDOR)
  await chooseCompany(1)
  expect((await inventories()).total).toBe(0)
  expect(await failure(call(api.GET("/app/inventories/{id}", { params: { path: { id: surplus.id } } })))).toMatchObject({ status: 404 })
  expect(await failure(addInventory(body([{ product_id: olma.id, counted: "1" }])))).toMatchObject({ status: 403, code: "forbidden" })
})

test("an opening stock is a purchase without a supplier: in a currency, into the stock, a last price; a product's moves tell every document", async () => {
  await signIn(ALI)
  await chooseCompany(1)
  const { olma } = seedCatalog()
  const asosiy = asosiyOf(1).id
  const chilonzor = addLocation(1, "Chilonzor").id
  const supplier = await addSupplier({ name: "Bozor" })

  const first = await addOpeningStock({ location_id: asosiy, at: AT, items: [{ product_id: olma.id, quantity: "12.5", price: "1000" }], note: " Boshi " })
  expect(first).toMatchObject({ number: 1, location_id: asosiy, location_name: "Asosiy", at: AT_UTC, currency_id: 1, rate: "1.0000", total: "12500.00", total_uzs: "12500.00", note: "Boshi", items_count: 1, created_by_name: "Ali Valiyev" })
  expect(first.items).toEqual([{ product_id: olma.id, name: "Olma", unit: "kg", quantity: "12.500", price: "1000.00", amount: "12500.00" }])
  expect(await getProduct(olma.id)).toMatchObject({ quantity: "12.500", last_price: { amount: "1000.00", currency_id: 1 } })
  expect(await failure(addOpeningStock({ location_id: asosiy, at: AT, currency_id: 3, items: [{ product_id: olma.id, quantity: "1", price: "1" }] }))).toMatchObject({ status: 400, code: "currency_not_allowed" })
  expect(await failure(addOpeningStock({ location_id: asosiy, at: AT, items: [{ product_id: olma.id, quantity: "1", price: "x" }] }))).toMatchObject({ status: 400, message: "«Olma» narxi noto'g'ri" })
  expect(await failure(addOpeningStock({ location_id: 999, at: AT, items: [{ product_id: olma.id, quantity: "1", price: "1" }] }))).toMatchObject({ status: 403, code: "forbidden" })
  expect((await addPurchase({ location_id: asosiy, supplier_id: supplier.id, at: AT, items: [{ product_id: olma.id, quantity: "1", price: "1" }] })).number).toBe(1)
  const list = await openingStock()
  expect(list.total).toBe(1)
  expect(list.items[0]).not.toHaveProperty("items")
  expect(await call(api.GET("/app/opening-stock/{id}", { params: { path: { id: first.id } } }))).toEqual(first)
  const saved = await call(api.PUT("/app/opening-stock/{id}", { params: { path: { id: first.id } }, body: { at: AT, items: [{ product_id: olma.id, quantity: "4", price: "1100" }] } }))
  expect(saved).toMatchObject({ number: 1, total: "4400.00", note: null })
  expect((await getProduct(olma.id)).quantity).toBe("5.000")

  // The moves: the transfer's two, then the purchase's, then the opening's.
  const transfer = await addTransfer({ location_id: asosiy, to_location_id: chilonzor, at: "2026-10-08T09:00:00+05:00", items: [{ product_id: olma.id, quantity: "2" }] })
  const page = await moves(olma.id)
  expect(page.total).toBe(4)
  expect(page.items).toEqual([
    { id: expect.any(Number), transaction_id: transfer.id, kind: "transfer", number: 1, at: "2026-10-08T04:00:00Z", location_id: chilonzor, location_name: "Chilonzor", quantity: "2.000", counterpart: "Asosiy" },
    { id: expect.any(Number), transaction_id: transfer.id, kind: "transfer", number: 1, at: "2026-10-08T04:00:00Z", location_id: asosiy, location_name: "Asosiy", quantity: "-2.000", counterpart: "Chilonzor" },
    { id: expect.any(Number), transaction_id: expect.any(Number), kind: "purchase", number: 1, at: AT_UTC, location_id: asosiy, location_name: "Asosiy", quantity: "1.000", counterpart: "Bozor" },
    { id: expect.any(Number), transaction_id: first.id, kind: "opening_stock", number: 1, at: AT_UTC, location_id: asosiy, location_name: "Asosiy", quantity: "4.000", counterpart: null },
  ])
  expect((await moves(olma.id, { location_id: String(chilonzor) })).total).toBe(1)
  expect(await failure(moves(999))).toMatchObject({ status: 404, message: "Mahsulot topilmadi" })
  expect(await failure(moves(olma.id, { location_id: "999" }))).toMatchObject({ status: 403, code: "forbidden" })
  expect(await failure(call(api.DELETE("/app/opening-stock/{id}", { params: { path: { id: first.id } } })))).toMatchObject({ status: 409, code: "stock_insufficient" })
  await call(api.DELETE("/app/transfers/{id}", { params: { path: { id: transfer.id } } }))
  await call(api.DELETE("/app/opening-stock/{id}", { params: { path: { id: first.id } } }))
  expect(await failure(call(api.GET("/app/opening-stock/{id}", { params: { path: { id: first.id } } })))).toMatchObject({ status: 404, message: "Hujjat topilmadi" })
  expect((await getProduct(olma.id)).quantity).toBe("1.000")

  restrictTo(SARDOR, 1, [chilonzor])
  await signIn(SARDOR)
  await chooseCompany(1)
  expect((await moves(olma.id)).total).toBe(0)
  expect((await openingStock()).total).toBe(0)
})

test("a supplier's opening debt or advance goes into its balance and statement; the kind stays through an edit", async () => {
  await signIn(VALI)
  await chooseCompany(2)
  const supplier = await addSupplier({ name: "Bozor" })
  const path = { params: { path: { id: supplier.id } } }

  const debt = await addOpening(supplier.id, { kind: "debt", amount: "1000000", at: AT, note: " Eski qarz " })
  expect(debt).toMatchObject({ kind: "debt", supplier_id: supplier.id, amount: "1000000.00", currency_id: 1, rate: "1.0000", amount_uzs: "1000000.00", at: AT_UTC, note: "Eski qarz", created_by_name: "Vali Aliyev" })
  const prepay = await addOpening(supplier.id, { kind: "prepay", amount: "10", currency_id: 2, at: AT })
  expect(prepay).toMatchObject({ kind: "prepay", amount: "10.00", currency_id: 2, rate: "12800.0000", amount_uzs: "128000.00", note: null })
  expect(await getSupplier(supplier.id)).toMatchObject({ balance: "872000.00", balance_by_currency: [{ currency_id: 1, amount: "1000000.00" }, { currency_id: 2, amount: "-10.00" }] })
  expect((await statement(supplier.id)).items.map((r) => [r.kind, r.delta_uzs, r.balance_uzs])).toEqual([
    ["supplier_prepay", "-128000.00", "872000.00"],
    ["supplier_debt", "1000000.00", "1000000.00"],
  ])
  for (const [input, message] of [
    [{ amount: "1", at: AT }, "Turni tanlang"],
    [{ kind: "loan", amount: "1", at: AT }, "Tur noto'g'ri"],
    [{ kind: "debt", at: AT }, "Summani kiriting"],
    [{ kind: "debt", amount: "0", at: AT }, "Summa noto'g'ri"],
    [{ kind: "debt", amount: "1" }, "Vaqtni kiriting"],
    [{ kind: "debt", amount: "1", currency_id: 2, rate: "x", at: AT }, "Kurs noto'g'ri"],
  ] as [components["schemas"]["OpeningInput"], string][]) {
    expect(await failure(addOpening(supplier.id, input)), message).toMatchObject({ status: 400, code: "validation_error", message })
  }
  expect(await failure(addOpening(999, { kind: "debt", amount: "1", at: AT }))).toMatchObject({ status: 404, message: "Ta'minotchi topilmadi" })
  const list = await openings(supplier.id)
  expect(list.total).toBe(2)
  expect(list.items.map((o) => o.id)).toEqual([prepay.id, debt.id])

  const own = { params: { path: { id: supplier.id, openingId: debt.id } } }
  const saved = await call(api.PUT("/app/suppliers/{id}/openings/{openingId}", { ...own, body: { kind: "debt", amount: "1500", at: "2026-10-08T09:00:00+05:00", note: "Aniq" } }))
  expect(saved).toMatchObject({ amount: "1500.00", at: "2026-10-08T04:00:00Z", note: "Aniq" })
  expect(await failure(call(api.PUT("/app/suppliers/{id}/openings/{openingId}", { ...own, body: { kind: "prepay", amount: "1", at: AT } })))).toMatchObject({ status: 400, message: "Tur o'zgartirilmaydi" })
  expect(await failure(call(api.PUT("/app/suppliers/{id}/openings/{openingId}", { params: { path: { id: supplier.id, openingId: 999 } }, body: { kind: "debt", amount: "1", at: AT } })))).toMatchObject({ status: 404, message: "Hujjat topilmadi" })
  await call(api.DELETE("/app/suppliers/{id}/openings/{openingId}", { params: { path: { id: supplier.id, openingId: prepay.id } } }))
  expect(await failure(call(api.DELETE("/app/suppliers/{id}/openings/{openingId}", { params: { path: { id: supplier.id, openingId: prepay.id } } })))).toMatchObject({ status: 404, message: "Hujjat topilmadi" })
  expect(await getSupplier(supplier.id)).toMatchObject({ balance: "1500.00" })
  expect(await failure(call(api.DELETE("/app/suppliers/{id}", path)))).toMatchObject({ status: 409, code: "supplier_in_use", message: "Bu ta'minotchida 1 ta hujjat bor" })

  // An employee whose role lacks the purchases may not see them.
  holdRole(SARDOR, 1, "Kuzatuvchi", ["customers.view"])
  await signIn(SARDOR)
  await chooseCompany(1)
  expect(await failure(openings(supplier.id))).toMatchObject({ status: 403, code: "forbidden" })
})

// The sales (logic/sales.md; backend/internal/app/sales_test.go).
const sales = (query: Record<string, string> = {}) => call(api.GET("/app/sales", { params: { query } }))
const addSale = (body: components["schemas"]["SaleCreate"]) => call(api.POST("/app/sales", { body }))
const getSale = (id: number) => call(api.GET("/app/sales/{id}", { params: { path: { id } } }))
const customerPayments = (id: number) => call(api.GET("/app/customers/{id}/payments", { params: { path: { id } } }))
const customerStatement = (id: number) => call(api.GET("/app/customers/{id}/statement", { params: { path: { id } } }))
const addCustomerPayment = (id: number, body: components["schemas"]["PaymentInput"]) => call(api.POST("/app/customers/{id}/payments", { params: { path: { id } }, body }))
const addCustomerOpening = (id: number, body: components["schemas"]["OpeningInput"]) => call(api.POST("/app/customers/{id}/openings", { params: { path: { id } }, body }))

// soldTo is Olma Savdo with 12,5 Olma and 3 Nok in Asosiy, Ali signed in,
// and Dilshod entered as a customer.
async function soldTo() {
  await signIn(ALI)
  const catalog = seedCatalog()
  const { bozor } = seedWarehouse(catalog)
  const { jismoniy, fish } = await setup()
  const dilshod = await createCustomer(jismoniy.id, "998911112233", { [fish.id]: "Dilshod" })
  return { ...catalog, bozor, asosiy: asosiyOf(1).id, cash: cashOfCompany(1), dilshod }
}

test("a sale goes out of the stock to a customer or to nobody, with services among its lines and payments with it; it is listed, edited and deleted", async () => {
  db.cooldown = false
  const { olma, nok, yetkazish, eski, bozor, asosiy, cash, dilshod } = await soldTo()
  const chilonzor = addLocation(1, "Chilonzor").id
  const body = (items: components["schemas"]["PurchaseItemInput"][], extra: Partial<components["schemas"]["SaleCreate"]> = {}): components["schemas"]["SaleCreate"] => ({
    location_id: asosiy,
    customer_id: dilshod.id,
    at: AT,
    items,
    ...extra,
  })

  for (const [input, message] of [
    [body([{ product_id: olma.id, quantity: "1", price: "1" }], { location_id: 0 }), "Lokatsiyani tanlang"],
    [body([{ product_id: olma.id, quantity: "1", price: "1" }], { customer_id: 999 }), "Mijozni tanlang"],
    [body([{ product_id: olma.id, quantity: "1", price: "1" }], { at: "" }), "Vaqtni kiriting"],
    [body([]), "Kamida bitta mahsulot qo'shing"],
    [body([{ product_id: eski.id, quantity: "1", price: "1" }]), "Mahsulot nofaol"],
    [body([{ product_id: olma.id, quantity: "1", price: "1" }, { product_id: olma.id, quantity: "2", price: "1" }]), "«Olma» ikki marta kiritilgan"],
    [body([{ product_id: olma.id, quantity: "0", price: "1" }]), "«Olma» miqdori noto'g'ri"],
    [body([{ product_id: olma.id, quantity: "1", price: "x" }]), "«Olma» narxi noto'g'ri"],
    [body([{ product_id: olma.id, quantity: "1", price: "1" }], { payments: [{ bank_account_id: 0, amount: "1" }] }), "Akkauntni tanlang"],
    [body([{ product_id: olma.id, quantity: "1", price: "3000" }], { customer_id: null }), "Mijozsiz sotuv to'liq to'langan bo'lsin"],
    [body([{ product_id: olma.id, quantity: "1", price: "3000" }], { customer_id: null, payments: [{ bank_account_id: cash, amount: "2000" }] }), "Mijozsiz sotuv to'liq to'langan bo'lsin"],
  ] as [components["schemas"]["SaleCreate"], string][]) {
    expect(await failure(addSale(input)), message).toMatchObject({ status: 400, code: "validation_error", message })
  }
  expect(await failure(addSale(body([{ product_id: olma.id, quantity: "1", price: "1" }], { location_id: 999 })))).toMatchObject({ status: 403, code: "forbidden" })
  expect(await failure(addSale(body([{ product_id: olma.id, quantity: "13", price: "1" }])))).toMatchObject({ status: 409, code: "stock_insufficient", message: "«Olma» uchun omborda yetarli qoldiq yo'q" })
  expect(db.transactions.filter((t) => t.kind === "sale" || t.kind === "customer_payment")).toHaveLength(0)

  const first = await addSale(body([{ product_id: olma.id, quantity: "4", price: "3000" }, { product_id: yetkazish.id, quantity: "1", price: "10000" }], { payments: [{ bank_account_id: cash, amount: "5000" }], note: " Kechqurun " }))
  expect(first).toMatchObject({ number: 1, location_id: asosiy, location_name: "Asosiy", customer: { id: dilshod.id, name: "Dilshod" }, at: AT_UTC, currency_id: 1, rate: "1.0000", total: "22000.00", total_uzs: "22000.00", paid: "5000.00", note: "Kechqurun", items_count: 2, created_by_name: "Ali Valiyev" })
  expect(first.items).toEqual([
    { product_id: olma.id, name: "Olma", unit: "kg", quantity: "4.000", price: "3000.00", amount: "12000.00" },
    { product_id: yetkazish.id, name: "Yetkazish", unit: null, quantity: "1.000", price: "10000.00", amount: "10000.00" },
  ])
  expect(first.payments).toEqual([{ id: expect.any(Number), bank_account_id: cash, account_name: "Naqd", amount: "5000.00", currency_id: 1 }])
  expect((await getProduct(olma.id)).quantity).toBe("8.500")
  expect(db.moves.filter((m) => m.transactionId === first.id)).toHaveLength(1)
  const retail = await addSale(body([{ product_id: nok.id, quantity: "1", price: "2000" }], { customer_id: null, payments: [{ bank_account_id: cash, amount: "2000" }] }))
  expect(retail).toMatchObject({ number: 2, customer: null, paid: "2000.00" })
  expect(db.transactions.find((t) => t.linkedId === retail.id)).toMatchObject({ kind: "customer_payment", customerId: null })
  expect((await addPurchase({ location_id: asosiy, supplier_id: bozor.id, at: AT, items: [{ product_id: olma.id, quantity: "1", price: "1" }] })).number, "the purchases count on their own").toBe(2)

  const list = await sales()
  expect(list.total).toBe(2)
  expect(list.items.map((s) => s.number)).toEqual([2, 1])
  expect(list.items[0]).not.toHaveProperty("items")
  expect((await sales({ customer_id: String(dilshod.id) })).total).toBe(1)
  expect(await failure(sales({ customer_id: "x" }))).toMatchObject({ status: 400, message: "Mijoz noto'g'ri" })
  expect(await getSale(first.id)).toEqual(first)

  restrictTo(SARDOR, 1, [chilonzor])
  await signIn(SARDOR)
  await chooseCompany(1)
  expect((await sales()).total).toBe(0)
  expect(await failure(getSale(first.id))).toMatchObject({ status: 404, message: "Sotuv topilmadi" })
  expect(await failure(sales({ location_id: String(asosiy) }))).toMatchObject({ status: 403, code: "forbidden" })

  await signIn(ALI)
  const saved = await call(api.PUT("/app/sales/{id}", { params: { path: { id: first.id } }, body: { customer_id: dilshod.id, at: AT, items: [{ product_id: olma.id, quantity: "2", price: "3000" }], payments: [] } }))
  expect(saved).toMatchObject({ number: 1, total: "6000.00", paid: "0.00", items_count: 1 })
  expect((await getProduct(olma.id)).quantity).toBe("11.500")
  expect(await failure(call(api.PUT("/app/sales/{id}", { params: { path: { id: first.id } }, body: { customer_id: null, at: AT, items: [{ product_id: olma.id, quantity: "2", price: "3000" }] } })))).toMatchObject({ status: 400, message: "Mijozsiz sotuv to'liq to'langan bo'lsin" })
  await call(api.DELETE("/app/sales/{id}", { params: { path: { id: first.id } } }))
  expect(await failure(getSale(first.id))).toMatchObject({ status: 404, message: "Sotuv topilmadi" })
  expect((await getProduct(olma.id)).quantity).toBe("13.500")
  expect((await addSale(body([{ product_id: olma.id, quantity: "1", price: "1" }]))).number).toBe(3)
})

test("a customer's payments, opening balances and statement; what they owe is on the customer, for whoever may see the sales", async () => {
  const { olma, asosiy, cash, dilshod } = await soldTo()
  const sale = await addSale({ location_id: asosiy, customer_id: dilshod.id, at: AT, items: [{ product_id: olma.id, quantity: "4", price: "3000" }], payments: [{ bank_account_id: cash, amount: "5000" }] })

  const payment = await addCustomerPayment(dilshod.id, { bank_account_id: cash, amount: "1000", at: AT, note: " Naqd " })
  expect(payment).toMatchObject({ customer_id: dilshod.id, sale_id: null, sale_number: null, bank_account_id: cash, account_name: "Naqd", amount: "1000.00", currency_id: 1, rate: "1.0000", amount_uzs: "1000.00", at: AT_UTC, note: "Naqd", created_by_name: "Ali Valiyev" })
  expect(await failure(addCustomerPayment(dilshod.id, { bank_account_id: cash, amount: "", at: AT }))).toMatchObject({ status: 400, message: "Summani kiriting" })
  expect(await failure(addCustomerPayment(999, { bank_account_id: cash, amount: "1", at: AT }))).toMatchObject({ status: 404, message: "Mijoz topilmadi" })
  const payments = await customerPayments(dilshod.id)
  expect(payments.total).toBe(2)
  expect(payments.items[1]).toMatchObject({ sale_id: sale.id, sale_number: 1, amount: "5000.00" })
  const own = { params: { path: { id: dilshod.id, paymentId: payment.id } } }
  expect((await call(api.PUT("/app/customers/{id}/payments/{paymentId}", { ...own, body: { bank_account_id: cash, amount: "1500", at: AT } }))).amount).toBe("1500.00")
  expect(await failure(call(api.DELETE("/app/customers/{id}/payments/{paymentId}", { params: { path: { id: dilshod.id, paymentId: payments.items[1].id } } })))).toMatchObject({ status: 409, code: "payment_linked", message: "Bu to'lov sotuv bilan kiritilgan: sotuvni tahrirlang" })
  await call(api.DELETE("/app/customers/{id}/payments/{paymentId}", own))
  expect(await failure(call(api.DELETE("/app/customers/{id}/payments/{paymentId}", own)))).toMatchObject({ status: 404, message: "To'lov topilmadi" })

  const debt = await addCustomerOpening(dilshod.id, { kind: "debt", amount: "300000", at: "2026-10-01T09:00:00+05:00" })
  expect(debt).toMatchObject({ kind: "debt", customer_id: dilshod.id, amount: "300000.00", amount_uzs: "300000.00" })
  expect(await failure(addCustomerOpening(dilshod.id, { kind: "loan" as "debt", amount: "1", at: AT }))).toMatchObject({ status: 400, message: "Tur noto'g'ri" })
  expect((await call(api.GET("/app/customers/{id}/openings", { params: { path: { id: dilshod.id } } }))).total).toBe(1)
  const opening = { params: { path: { id: dilshod.id, openingId: debt.id } } }
  expect(await failure(call(api.PUT("/app/customers/{id}/openings/{openingId}", { ...opening, body: { kind: "prepay", amount: "1", at: AT } })))).toMatchObject({ status: 400, message: "Tur o'zgartirilmaydi" })
  expect((await call(api.PUT("/app/customers/{id}/openings/{openingId}", { ...opening, body: { kind: "debt", amount: "200000", at: "2026-10-01T09:00:00+05:00" } }))).amount).toBe("200000.00")

  // 12 000 sold, 5 000 paid with it, 200 000 owed before: 207 000.
  expect(await getCustomer(dilshod.id)).toMatchObject({ balance: "207000.00", balance_by_currency: [{ currency_id: 1, amount: "207000.00" }] })
  const listed = (await listCustomers()).items.find((c) => c.id === dilshod.id)
  expect(listed).toMatchObject({ balance: "207000.00", balance_by_currency: null })
  const statement = await customerStatement(dilshod.id)
  expect(statement.total).toBe(3)
  expect(statement.items.map((r) => [r.kind, r.delta_uzs, r.balance_uzs])).toEqual([
    ["customer_payment", "-5000.00", "207000.00"],
    ["sale", "12000.00", "212000.00"],
    ["customer_debt", "200000.00", "200000.00"],
  ])
  expect(statement.items[0]).toMatchObject({ linked_id: sale.id, linked_number: 1, account_name: "Naqd" })
  expect(await failure(customerStatement(999))).toMatchObject({ status: 404, message: "Mijoz topilmadi" })
  expect(await failure(deleteCustomer(dilshod.id))).toMatchObject({ status: 409, code: "customer_in_use", message: "Bu mijozda 3 ta hujjat bor" })

  holdRole(SARDOR, 1, "Kuzatuvchi", ["customers.view"])
  await signIn(SARDOR)
  await chooseCompany(1)
  expect(await getCustomer(dilshod.id)).toMatchObject({ balance: null, balance_by_currency: null })
  expect((await listCustomers()).items.find((c) => c.id === dilshod.id)?.balance).toBeNull()
  expect(await failure(customerStatement(dilshod.id))).toMatchObject({ status: 403, code: "forbidden" })
})

// The finance (logic/finance.md; backend/internal/app/finance_test.go): what
// the accounts hold and their statements, and the cash documents.
const accounts = () => call(api.GET("/app/accounts"))
const accountStatement = (id: number, query: Record<string, string> = {}) => call(api.GET("/app/accounts/{id}/statement", { params: { path: { id }, query } }))
const cashOpenings = (query: Record<string, string> = {}) => call(api.GET("/app/cash-openings", { params: { query } }))
const addCashOpening = (body: components["schemas"]["CashOpeningInput"]) => call(api.POST("/app/cash-openings", { body }))
const expenses = (query: Record<string, string> = {}) => call(api.GET("/app/expenses", { params: { query } }))
const addExpense = (body: components["schemas"]["ExpenseInput"]) => call(api.POST("/app/expenses", { body }))
const moneyTransfers = (query: Record<string, string> = {}) => call(api.GET("/app/money-transfers", { params: { query } }))
const addMoneyTransfer = (body: components["schemas"]["MoneyTransferInput"]) => call(api.POST("/app/money-transfers", { body }))
const addConversion = (body: components["schemas"]["ConversionInput"]) => call(api.POST("/app/conversions", { body }))

test("the cash documents go in and out of the accounts as the Go API keeps them: an opening balance, an expense and an income under their categories, a transfer in one currency, a conversion between two; each listed, edited and deleted; what each account holds and its statement", async () => {
  // Nok Market: Vali its owner, its cash in so'm, a card in dollars, the dollar at 12 800.
  await signIn(VALI)
  await chooseCompany(2)
  const cash = 9102
  const card = 9112
  const kassa2 = { id: nextId(), name: "Kassa 2", currency_id: 1, is_active: true }
  const eski = { id: nextId(), name: "Eski", currency_id: 1, is_active: false }
  db.accounts[2].push(kassa2, eski)
  const ijara = await call(api.POST("/app/finance-categories", { body: { name: "Ijara", kind: "expense" } }))
  const boshqa = await call(api.POST("/app/finance-categories", { body: { name: "Boshqa kirim", kind: "income" } }))

  // An opening balance of the cash: the refusals in the Go API's order, then two.
  for (const [input, message] of [
    [{ bank_account_id: 0, amount: "5", at: AT }, "Akkauntni tanlang"],
    [{ bank_account_id: 9101, amount: "5", at: AT }, "Akkauntni tanlang"],
    [{ bank_account_id: eski.id, amount: "5", at: AT }, "Akkaunt nofaol"],
    [{ bank_account_id: cash, amount: "5", at: "" }, "Vaqtni kiriting"],
    [{ bank_account_id: cash, amount: "", at: AT }, "Summani kiriting"],
    [{ bank_account_id: cash, amount: "0", at: AT }, "Summa noto'g'ri"],
    [{ bank_account_id: cash, amount: "5", at: AT, note: "a".repeat(501) }, "Izoh 500 belgidan oshmasin"],
  ] as [components["schemas"]["CashOpeningInput"], string][]) {
    expect(await failure(addCashOpening(input)), message).toMatchObject({ status: 400, code: "validation_error", message })
  }
  const opening = await addCashOpening({ bank_account_id: cash, amount: "1000000", at: "2026-10-01T09:00:00+05:00", note: " Boshlanish " })
  expect(opening).toMatchObject({ number: 1, bank_account_id: cash, account_name: "Naqd", currency_id: 1, amount: "1000000.00", at: "2026-10-01T04:00:00Z", note: "Boshlanish", created_by_name: "Vali Aliyev" })
  const usd = await addCashOpening({ bank_account_id: card, amount: "250.5", at: "2026-10-01T10:00:00+05:00" })
  expect(usd).toMatchObject({ number: 2, currency_id: 2, amount: "250.50", note: null })
  expect((await cashOpenings()).items.map((d) => d.id)).toEqual([usd.id, opening.id])
  expect((await cashOpenings({ account_id: String(card) })).total).toBe(1)
  expect(await failure(cashOpenings({ account_id: "x" }))).toMatchObject({ status: 400, message: "Akkaunt noto'g'ri" })
  expect(await failure(cashOpenings({ page: "x" }))).toMatchObject({ status: 400, message: "Sahifa raqami noto'g'ri" })

  // An expense and an income, each under a category of its kind.
  for (const [input, message] of [
    [{ kind: "" as "expense", bank_account_id: cash, category_id: ijara.id, amount: "5", at: AT }, "Turni tanlang"],
    [{ kind: "expense", bank_account_id: eski.id, category_id: 0, amount: "5", at: AT }, "Akkaunt nofaol"],
    [{ kind: "expense", bank_account_id: cash, category_id: 0, amount: "5", at: AT }, "Kategoriyani tanlang"],
    [{ kind: "expense", bank_account_id: cash, category_id: boshqa.id, amount: "5", at: AT }, "Kategoriya turi mos emas"],
    [{ kind: "expense", bank_account_id: cash, category_id: ijara.id, amount: "", at: AT }, "Summani kiriting"],
  ] as [components["schemas"]["ExpenseInput"], string][]) {
    expect(await failure(addExpense(input)), message).toMatchObject({ status: 400, message })
  }
  const rent = await addExpense({ kind: "expense", bank_account_id: cash, category_id: ijara.id, amount: "150000", at: "2026-10-03T09:00:00+05:00", note: "Oktabr" })
  expect(rent).toMatchObject({ kind: "expense", number: 1, bank_account_id: cash, category_id: ijara.id, category_name: "Ijara", amount: "150000.00", note: "Oktabr" })
  const income = await addExpense({ kind: "income", bank_account_id: cash, category_id: boshqa.id, amount: "200000", at: "2026-10-02T09:00:00+05:00" })
  expect(income).toMatchObject({ kind: "income", number: 1, category_name: "Boshqa kirim" })
  expect((await expenses()).items.map((d) => d.id), "the expenses unless another kind is asked").toEqual([rent.id])
  expect((await expenses({ kind: "income" })).items.map((d) => d.id)).toEqual([income.id])
  expect((await expenses({ from: "2026-10-03", to: "2026-10-03" })).total, "the day, in Tashkent").toBe(1)
  expect((await expenses({ from: "2026-10-04" })).total).toBe(0)
  expect((await expenses({ kind: "income", to: "2026-10-02" })).total).toBe(1)
  expect((await expenses({ category_id: String(boshqa.id) })).total).toBe(0)
  expect(await failure(expenses({ kind: "gift" }))).toMatchObject({ status: 400, message: "Tur noto'g'ri" })
  expect(await failure(expenses({ category_id: "x" }))).toMatchObject({ status: 400, message: "Kategoriya noto'g'ri" })
  expect(await failure(expenses({ from: "yesterday" }))).toMatchObject({ status: 400, message: "Sana noto'g'ri" })
  expect(await failure(expenses({ from: "2026-10-04", to: "2026-10-03" }))).toMatchObject({ status: 400, message: "Sana noto'g'ri" })
  expect(await failure(call(api.PUT("/app/expenses/{id}", { params: { path: { id: rent.id } }, body: { kind: "income", bank_account_id: cash, category_id: boshqa.id, amount: "5", at: AT } })))).toMatchObject({ status: 400, message: "Tur o'zgartirilmaydi" })
  expect(await call(api.PUT("/app/expenses/{id}", { params: { path: { id: rent.id } }, body: { kind: "expense", bank_account_id: cash, category_id: ijara.id, amount: "160000", at: "2026-10-03T09:00:00+05:00" } }))).toMatchObject({ number: 1, amount: "160000.00", note: null })
  expect(await call(api.GET("/app/expenses/{id}", { params: { path: { id: rent.id } } }))).toMatchObject({ amount: "160000.00" })
  expect(await failure(call(api.GET("/app/cash-openings/{id}", { params: { path: { id: rent.id } } })))).toMatchObject({ status: 404, message: "Hujjat topilmadi" })
  expect(await failure(call(api.DELETE("/app/finance-categories/{id}", { params: { path: { id: ijara.id } } })))).toMatchObject({ status: 409, code: "category_in_use", message: "Bu kategoriyada 1 ta hujjat bor" })

  // A transfer in one currency; a conversion between two, with its rate.
  for (const [input, message] of [
    [{ from_account_id: cash, to_account_id: 0, amount: "5", at: AT }, "Maqsad akkauntni tanlang"],
    [{ from_account_id: cash, to_account_id: eski.id, amount: "5", at: AT }, "Maqsad akkaunt nofaol"],
    [{ from_account_id: cash, to_account_id: cash, amount: "5", at: AT }, "Maqsad akkaunt boshqa bo'lsin"],
    [{ from_account_id: cash, to_account_id: card, amount: "5", at: AT }, "Valyutalar farq qilsa konvertatsiya kiriting"],
  ] as [components["schemas"]["MoneyTransferInput"], string][]) {
    expect(await failure(addMoneyTransfer(input)), message).toMatchObject({ status: 400, message })
  }
  const moved = await addMoneyTransfer({ from_account_id: cash, to_account_id: kassa2.id, amount: "100000", at: "2026-10-05T09:00:00+05:00" })
  expect(moved).toMatchObject({ kind: "money_transfer", number: 1, from_account_id: cash, from_account_name: "Naqd", currency_id: 1, amount: "100000.00", to_account_id: kassa2.id, to_account_name: "Kassa 2", to_currency_id: 1, to_amount: null, rate: null })
  for (const [input, message] of [
    [{ from_account_id: cash, amount: "5", to_account_id: kassa2.id, to_amount: "5", at: AT }, "Bir xil valyutada o'tkazma kiriting"],
    [{ from_account_id: cash, amount: "5", to_account_id: card, to_amount: "", at: AT }, "Maqsad summani kiriting"],
    [{ from_account_id: cash, amount: "5", to_account_id: card, to_amount: "0", at: AT }, "Maqsad summa noto'g'ri"],
  ] as [components["schemas"]["ConversionInput"], string][]) {
    expect(await failure(addConversion(input)), message).toMatchObject({ status: 400, message })
  }
  const converted = await addConversion({ from_account_id: cash, amount: "128000", to_account_id: card, to_amount: "10", at: "2026-10-06T09:00:00+05:00" })
  expect(converted).toMatchObject({ kind: "conversion", number: 1, amount: "128000.00", to_account_id: card, to_currency_id: 2, to_amount: "10.00", rate: "12800.0000" })
  const back = await addConversion({ from_account_id: card, amount: "10", to_account_id: cash, to_amount: "127000", at: "2026-10-06T10:00:00+05:00" })
  expect(back).toMatchObject({ number: 2, rate: "12700.0000" })
  expect((await moneyTransfers()).items.map((d) => d.id), "the transfers and the conversions in one list").toEqual([back.id, converted.id, moved.id])
  expect((await moneyTransfers({ account_id: String(kassa2.id) })).items.map((d) => d.id)).toEqual([moved.id])
  expect((await call(api.GET("/app/conversions"))).items.map((d) => d.id)).toEqual([back.id, converted.id])
  expect(await failure(call(api.GET("/app/money-transfers/{id}", { params: { path: { id: converted.id } } })))).toMatchObject({ status: 404, message: "Hujjat topilmadi" })
  expect((await call(api.PUT("/app/conversions/{id}", { params: { path: { id: converted.id } }, body: { from_account_id: cash, amount: "130000", to_account_id: card, to_amount: "10", at: "2026-10-06T09:00:00+05:00" } }))).rate).toBe("13000.0000")
  expect(await call(api.PUT("/app/money-transfers/{id}", { params: { path: { id: moved.id } }, body: { from_account_id: kassa2.id, to_account_id: cash, amount: "100000", at: "2026-10-05T09:00:00+05:00" } }))).toMatchObject({ from_account_id: kassa2.id, to_account_id: cash })
  await call(api.DELETE("/app/conversions/{id}", { params: { path: { id: back.id } } }))

  // What each account holds, the one turned off last; the cash's statement.
  expect(await accounts()).toEqual([
    { id: cash, name: "Naqd", currency_id: 1, is_active: true, balance: "1010000.00" },
    { id: card, name: "Karta", currency_id: 2, is_active: true, balance: "260.50" },
    { id: kassa2.id, name: "Kassa 2", currency_id: 1, is_active: true, balance: "-100000.00" },
    { id: eski.id, name: "Eski", currency_id: 1, is_active: false, balance: "0.00" },
  ])
  const statement = await accountStatement(cash)
  expect(statement).toMatchObject({ total: 5, page: 1, page_size: 20 })
  expect(statement.items.map((r) => [r.kind, r.delta, r.balance, r.party_name])).toEqual([
    ["conversion", "-130000.00", "1010000.00", "Karta"],
    ["money_transfer", "100000.00", "1140000.00", "Kassa 2"],
    ["expense", "-160000.00", "1040000.00", "Ijara"],
    ["income", "200000.00", "1200000.00", "Boshqa kirim"],
    ["cash_opening", "1000000.00", "1000000.00", null],
  ])
  expect(statement.items[2]).toMatchObject({ id: rent.id, number: 1, at: "2026-10-03T04:00:00Z", note: null, linked_id: null, linked_number: null, created_by_name: "Vali Aliyev" })
  expect(await failure(accountStatement(9101))).toMatchObject({ status: 404, message: "Akkaunt topilmadi" })

  await call(api.DELETE("/app/cash-openings/{id}", { params: { path: { id: opening.id } } }))
  expect(await failure(call(api.GET("/app/cash-openings/{id}", { params: { path: { id: opening.id } } })))).toMatchObject({ status: 404, message: "Hujjat topilmadi" })
  expect((await addCashOpening({ bank_account_id: cash, amount: "1", at: AT })).number, "the number of the deleted one is never given again").toBe(3)
})

test("/app/dashboard answers the home's blocks as the Go API does: each by its permission, in so'm by each document's rate, of the location asked for or of every one of the member's", async () => {
  const today = localToday()
  const day = Number(today.slice(8, 10))
  const { yangi, jarayonda } = seedOrders()
  const chilonzor = addLocation(1, "Chilonzor")
  const asosiy = asosiyOf(1)
  // The customers came last month, but one: today.
  for (const c of db.customers.filter((c) => c.companyId === 1)) c.createdAt = `${addDays(today, -40)}T05:00:00Z`
  db.customers.filter((c) => c.companyId === 1)[0].createdAt = `${today}T05:00:00Z`
  // Bozor is owed 100 000 and 10 $ at 12 800 (128 000), paid 50 000; Dehqon got 30 000 ahead.
  const rate: RateRow = { id: nextId(), companyId: 1, usd: "12800.0000", eur: "0.0000", rub: "0.0000", status: 1, setBy: ALI, setAt: `${addDays(today, -60)}T05:00:00Z` }
  db.rates.push(rate)
  const supplier = (name: string): SupplierRow => {
    const row: SupplierRow = { id: nextId(), companyId: 1, name, phone: null, note: null, active: true, by: ALI, byName: null, createdAt: `${today}T05:00:00Z`, updatedAt: `${today}T05:00:00Z` }
    db.suppliers.push(row)
    return row
  }
  const bozor = supplier("Bozor")
  const dehqon = supplier("Dehqon")
  const enter = (fields: Partial<TransactionRow> & Pick<TransactionRow, "kind" | "total" | "at">) => {
    db.transactions.push({
      id: nextId(), companyId: 1, number: nextId(), locationId: null, toLocationId: null, supplierId: null, customerId: null, bankAccountId: null, toBankAccountId: null,
      categoryId: null, linkedId: null, currencyId: 1, rateId: rate.id, toTotal: null, note: null, by: ALI, byName: null, createdAt: fields.at, updatedAt: fields.at, ...fields,
    })
  }
  enter({ kind: "purchase", at: `${today}T05:00:00Z`, locationId: asosiy.id, supplierId: bozor.id, total: 100000 })
  enter({ kind: "purchase", at: `${today}T05:00:00Z`, locationId: chilonzor.id, supplierId: bozor.id, currencyId: 2, total: 10 })
  enter({ kind: "purchase", at: `${addDays(today, -40)}T05:00:00Z`, locationId: asosiy.id, supplierId: bozor.id, total: 0.01, deleted: true })
  enter({ kind: "supplier_payment", at: `${today}T05:00:00Z`, supplierId: bozor.id, bankAccountId: db.accounts[1][0].id, total: 50000 })
  enter({ kind: "supplier_prepay", at: `${today}T05:00:00Z`, supplierId: dehqon.id, total: 30000 })
  enter({ kind: "sale", at: `${today}T05:00:00Z`, locationId: asosiy.id, total: 7000 })
  await signIn(ALI)

  const all = await call(api.GET("/app/dashboard"))

  const before = (value: string) => Array.from({ length: day - 1 }, () => value)
  expect(all.suppliers).toEqual({ debt: "178000.00", debtors: 1, advance: "30000.00" })
  expect(all.customers).toEqual({ total: 3, added_this_month: 1, by_day: [...Array.from({ length: day - 1 }, () => 2), 3] })
  expect(all.orders).toMatchObject({ active: 3, late: 1, by_stage: [{ stage_id: yangi.id, count: 2 }, { stage_id: jarayonda.id, count: 1 }] })
  expect(all.orders?.upcoming.map((t) => t.title)).toEqual(["Hisob-faktura", "Shartnoma yuborish", "Qo'ng'iroq qilish"])
  expect(all.purchases).toEqual({ month_total: "228000.00", month_count: 2, by_day: [...before("0.00"), "228000.00"] })
  expect(all.sales).toEqual({ month_total: "7000.00", month_count: 1, by_day: [...before("0.00"), "7000.00"] })

  const one = await call(api.GET("/app/dashboard", { params: { query: { location_id: chilonzor.id } } }))
  expect(one.purchases?.month_total).toBe("128000.00")
  expect(one.orders?.active).toBe(0)
  expect(await failure(call(api.GET("/app/dashboard", { params: { query: { location_id: 999999 } } })))).toMatchObject({ status: 403, code: "forbidden" })

  // A role that sees the orders alone.
  holdRole(VALI, 1, "Kuzatuvchi", ["orders.view"])
  await signIn(VALI)
  await chooseCompany(1)
  const vali = await call(api.GET("/app/dashboard"))
  expect(vali).toMatchObject({ suppliers: null, customers: null, purchases: null, sales: null })
  expect(vali.orders?.active).toBe(3)
})
