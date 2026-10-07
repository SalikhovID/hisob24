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

  expect(await listCustomers()).toEqual({ items: [firma, vali, ali], total: 3, page: 1, page_size: 20 })

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

test("every company starts with the ready stages and task type; every member reads them", async () => {
  await signIn(VALI)
  await chooseCompany(1)

  const stages = await call(api.GET("/app/task-stages"))
  expect(stages.map((s) => [s.name, s.color, s.is_done])).toEqual([
    ["Yangi", "blue", false],
    ["Jarayonda", "amber", false],
    ["Bajarildi", "green", true],
  ])
  const types = await call(api.GET("/app/task-types"))
  expect(types.map((t) => [t.name, t.fields])).toEqual([["Vazifa", []]])

  await chooseCompany(2)
  expect((await call(api.GET("/app/task-stages"))).map((s) => s.name)).toEqual(["Yangi", "Jarayonda", "Bajarildi"])
  expect((await call(api.GET("/app/task-stages"))).map((s) => s.id)).not.toEqual(stages.map((s) => s.id))
  await chooseCompany(null)
  expect(await failure(call(api.GET("/app/task-stages")))).toMatchObject({ status: 403, code: "company_required" })
  expect(await failure(call(api.GET("/app/task-types")))).toMatchObject({ status: 403, code: "company_required" })
})

test("the owner makes, changes, orders and deletes stages; an employee does not", async () => {
  await signIn(ALI)

  const made = await call(api.POST("/app/task-stages", { body: { name: " Kutilmoqda ", color: "teal" } }))
  expect(made).toMatchObject({ name: "Kutilmoqda", color: "teal", is_done: false })
  const done = await call(api.POST("/app/task-stages", { body: { name: "Yopildi", color: "slate", is_done: true } }))
  expect(done.is_done).toBe(true)
  expect(await failure(call(api.POST("/app/task-stages", { body: { name: "kutilmoqda", color: "red" } })))).toMatchObject({
    status: 409,
    code: "name_taken",
    message: "Bu nomli bosqich allaqachon bor",
  })
  expect(await failure(call(api.POST("/app/task-stages", { body: { name: "Oltin", color: "gold" as never } })))).toMatchObject({
    status: 400,
    message: "Rangni tanlang",
  })
  expect(await failure(call(api.POST("/app/task-stages", { body: { name: " ", color: "red" } })))).toMatchObject({
    status: 400,
    message: "Nomni kiriting",
  })

  const changed = await call(api.PATCH("/app/task-stages/{id}", { params: { path: { id: made.id } }, body: { color: "pink" } }))
  expect(changed).toMatchObject({ name: "Kutilmoqda", color: "pink", is_done: false })
  expect(
    await failure(call(api.PATCH("/app/task-stages/{id}", { params: { path: { id: made.id } }, body: { name: "YOPILDI" } }))),
  ).toMatchObject({ status: 409, code: "name_taken" })
  expect(
    await failure(call(api.PATCH("/app/task-stages/{id}", { params: { path: { id: 9999 } }, body: { name: "Yo'q" } }))),
  ).toMatchObject({ status: 404, message: "Bosqich topilmadi" })

  const ids = (await call(api.GET("/app/task-stages"))).map((s) => s.id)
  expect(ids).toHaveLength(5)
  await call(api.PUT("/app/task-stages/order", { body: { ids: [...ids].reverse() } }))
  expect((await call(api.GET("/app/task-stages"))).map((s) => s.name)).toEqual(["Yopildi", "Kutilmoqda", "Bajarildi", "Jarayonda", "Yangi"])
  expect(await failure(call(api.PUT("/app/task-stages/order", { body: { ids: ids.slice(1) } })))).toMatchObject({
    status: 409,
    code: "order_changed",
  })

  await call(api.DELETE("/app/task-stages/{id}", { params: { path: { id: made.id } } }))
  expect((await call(api.GET("/app/task-stages"))).map((s) => s.name)).toEqual(["Yopildi", "Bajarildi", "Jarayonda", "Yangi"])
  expect(await failure(call(api.DELETE("/app/task-stages/{id}", { params: { path: { id: made.id } } })))).toMatchObject({ status: 404 })
  expect(db.stages.filter((s) => s.companyId === 1)).toHaveLength(5)

  await signIn(VALI)
  await chooseCompany(1)
  expect(await failure(call(api.POST("/app/task-stages", { body: { name: "Xodimniki", color: "red" } })))).toMatchObject({
    status: 403,
    code: "forbidden",
  })
})

test("the owner makes, renames, orders and deletes task types, and adds, changes, orders and deletes their fields", async () => {
  await signIn(ALI)
  const [manba] = db.dropdowns
  const nokManba = { id: 950, companyId: 2, name: "Begona", options: [] }
  db.dropdowns.push(nokManba)

  const buyurtma = await call(api.POST("/app/task-types", { body: { name: " Buyurtma " } }))
  expect(buyurtma).toMatchObject({ name: "Buyurtma", fields: [] })
  expect(await failure(call(api.POST("/app/task-types", { body: { name: "vazifa" } })))).toMatchObject({
    status: 409,
    code: "name_taken",
    message: "Bu nomli tur allaqachon bor",
  })
  expect(await call(api.PATCH("/app/task-types/{id}", { params: { path: { id: buyurtma.id } }, body: { name: "Zakaz" } }))).toMatchObject({
    name: "Zakaz",
  })
  const [vazifa] = db.taskTypes
  await call(api.PUT("/app/task-types/order", { body: { ids: [buyurtma.id, vazifa.id] } }))
  expect((await call(api.GET("/app/task-types"))).map((t) => t.name)).toEqual(["Zakaz", "Vazifa"])
  expect(await failure(call(api.PUT("/app/task-types/order", { body: { ids: [vazifa.id] } })))).toMatchObject({ status: 409, code: "order_changed" })

  const path = { params: { path: { id: buyurtma.id } } }
  const izoh = await call(api.POST("/app/task-types/{id}/fields", { ...path, body: { label: " Izoh ", kind: "string", required: true } }))
  expect(izoh).toEqual({ id: izoh.id, label: "Izoh", kind: "string", required: true, dropdown_id: null })
  const source = await call(api.POST("/app/task-types/{id}/fields", { ...path, body: { label: "Manba", kind: "dropdown", dropdown_id: manba.id } }))
  expect(source).toMatchObject({ kind: "dropdown", required: false, dropdown_id: manba.id })
  for (const [body, message] of [
    [{ label: "Sana", kind: "date" }, "Maydon turini tanlang"],
    [{ label: "Holat", kind: "radio" }, "Dropdownni tanlang"],
    [{ label: "Holat", kind: "radio", dropdown_id: nokManba.id }, "Dropdownni tanlang"],
    [{ label: "Matn", kind: "string", dropdown_id: manba.id }, "Matn va son maydoniga dropdown ulanmaydi"],
    [{ label: " ", kind: "string" }, "Nomni kiriting"],
  ] as const) {
    expect(await failure(call(api.POST("/app/task-types/{id}/fields", { ...path, body: body as never }))), message).toMatchObject({
      status: 400,
      message,
    })
  }
  expect(await failure(call(api.POST("/app/task-types/{id}/fields", { ...path, body: { label: "izoh", kind: "int" } })))).toMatchObject({
    status: 409,
    message: "Bu nomli maydon allaqachon bor",
  })
  expect(
    await failure(call(api.POST("/app/task-types/{id}/fields", { params: { path: { id: 9999 } }, body: { label: "Izoh", kind: "string" } }))),
  ).toMatchObject({ status: 404, message: "Tur topilmadi" })

  const fieldPath = { params: { path: { id: buyurtma.id, fieldId: izoh.id } } }
  expect(await call(api.PATCH("/app/task-types/{id}/fields/{fieldId}", { ...fieldPath, body: { label: "Tavsif" } }))).toMatchObject({
    label: "Tavsif",
    required: true,
  })
  expect(await call(api.PATCH("/app/task-types/{id}/fields/{fieldId}", { ...fieldPath, body: { required: false } }))).toMatchObject({
    label: "Tavsif",
    required: false,
  })
  await call(api.PUT("/app/task-types/{id}/fields/order", { ...path, body: { ids: [source.id, izoh.id] } }))
  expect((await call(api.GET("/app/task-types")))[0].fields.map((f) => f.label)).toEqual(["Manba", "Tavsif"])
  expect(await failure(call(api.PUT("/app/task-types/{id}/fields/order", { ...path, body: { ids: [izoh.id] } })))).toMatchObject({
    status: 409,
    code: "order_changed",
  })
  await call(api.DELETE("/app/task-types/{id}/fields/{fieldId}", fieldPath))
  expect((await call(api.GET("/app/task-types")))[0].fields.map((f) => f.label)).toEqual(["Manba"])
  expect(await failure(call(api.DELETE("/app/task-types/{id}/fields/{fieldId}", fieldPath)))).toMatchObject({
    status: 404,
    message: "Maydon topilmadi",
  })

  await call(api.DELETE("/app/task-types/{id}", path))
  expect((await call(api.GET("/app/task-types"))).map((t) => t.name)).toEqual(["Vazifa"])
  expect(db.taskTypes.find((t) => t.id === buyurtma.id)?.fields.every((f) => f.deleted)).toBe(true)
  expect(await failure(call(api.DELETE("/app/task-types/{id}", path)))).toMatchObject({ status: 404, message: "Tur topilmadi" })

  await signIn(VALI)
  await chooseCompany(1)
  expect(await failure(call(api.POST("/app/task-types", { body: { name: "Xodimniki" } })))).toMatchObject({ status: 403, code: "forbidden" })
})

test("a dropdown a task field takes its options from is not deleted either", async () => {
  await signIn(ALI)
  const holat = await call(api.POST("/app/customer-dropdowns", { body: { name: "Holat" } }))
  const [vazifa] = db.taskTypes
  const field = await call(
    api.POST("/app/task-types/{id}/fields", { params: { path: { id: vazifa.id } }, body: { label: "Holati", kind: "radio", dropdown_id: holat.id } }),
  )

  expect(await failure(call(api.DELETE("/app/customer-dropdowns/{id}", { params: { path: { id: holat.id } } })))).toMatchObject({
    status: 409,
    code: "dropdown_in_use",
    message: "Bu dropdown 1 ta maydonda ishlatilgan",
  })

  await call(api.DELETE("/app/task-types/{id}/fields/{fieldId}", { params: { path: { id: vazifa.id, fieldId: field.id } } }))
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

// The tasks (logic/tasks.md; backend/internal/app/tasks_test.go).
type TaskCreate = components["schemas"]["TaskCreate"]
type TaskUpdate = components["schemas"]["TaskUpdate"]
type TaskQuery = {
  search?: string
  location_id?: number
  type_id?: number
  stage_id?: number
  assignee?: string
  customer_id?: number
  page?: number
}
const createTask = (body: TaskCreate) => call(api.POST("/app/tasks", { body }))
const getTask = (id: number) => call(api.GET("/app/tasks/{id}", { params: { path: { id } } }))
const listTasks = (query: TaskQuery = {}) => call(api.GET("/app/tasks", { params: { query } }))
const updateTask = (id: number, body: TaskUpdate) => call(api.PUT("/app/tasks/{id}", { params: { path: { id } }, body }))
const moveTask = (id: number, stageId: number) =>
  call(api.PATCH("/app/tasks/{id}/stage", { params: { path: { id } }, body: { stage_id: stageId } }))
const deleteTask = (id: number) => call(api.DELETE("/app/tasks/{id}", { params: { path: { id } } }))
const taskHistory = (id: number) => call(api.GET("/app/tasks/{id}/history", { params: { path: { id } } }))
const deleteStage = (id: number) => call(api.DELETE("/app/task-stages/{id}", { params: { path: { id } } }))
const deleteTaskType = (id: number) => call(api.DELETE("/app/task-types/{id}", { params: { path: { id } } }))
const deleteTaskField = (typeId: number, fieldId: number) =>
  call(api.DELETE("/app/task-types/{id}/fields/{fieldId}", { params: { path: { id: typeId, fieldId } } }))

// taskSetup is what Olma Savdo's tasks are entered with, by its owner: the
// three ready stages, the ready type, a type Buyurtma with a required text
// Izoh, a number Summa and a checkbox Kanal over Manba, and the customer Ali.
async function taskSetup() {
  const [yangi, jarayonda, bajarildi] = await call(api.GET("/app/task-stages"))
  const [vazifa] = await call(api.GET("/app/task-types"))
  const buyurtma = await call(api.POST("/app/task-types", { body: { name: "Buyurtma" } }))
  const field = (body: components["schemas"]["TaskFieldInput"]) =>
    call(api.POST("/app/task-types/{id}/fields", { params: { path: { id: buyurtma.id } }, body }))
  const customers = await setup()
  const dropdown = (await customerDropdowns())[0]
  const izoh = await field({ label: "Izoh", kind: "string", required: true })
  const summa = await field({ label: "Summa", kind: "int" })
  const kanal = await field({ label: "Kanal", kind: "checkbox", dropdown_id: dropdown.id })
  const ali = await createCustomer(customers.jismoniy.id, "998901112233", { [customers.fish.id]: "Ali Valiyev" })
  return { ...customers, dropdown, yangi, jarayonda, bajarildi, vazifa, buyurtma, izoh, summa, kanal, ali }
}
type TaskSetup = Awaited<ReturnType<typeof taskSetup>>

// taskBody is a task of the type Buyurtma for Ali, in Asosiy, due on
// 10.10.2026, in Yangi, with Izoh filled in; over changes what the test is
// about.
const taskBody = (s: TaskSetup, over: Partial<TaskCreate> = {}): TaskCreate => ({
  type_id: s.buyurtma.id,
  location_id: asosiyOf(1).id,
  title: "Qo'ng'iroq qilish",
  deadline: "2026-10-10",
  stage_id: s.yangi.id,
  values: { [s.izoh.id]: "Ertalab" },
  customer: { id: s.ali.id },
  ...over,
})

// The tasks a member works with are those of the locations they may work
// in (logic/locations.md, section 6; backend/internal/app/tasks_test.go
// TestTasksAreTheLocationsTheMemberMayWorkIn).
test("the tasks are those of the locations the member works in: the list, a task by its id, entering one, the assignee", async () => {
  db.cooldown = false
  await signIn(ALI)
  const s = await taskSetup()
  const asosiy = asosiyOf(1)
  const chilonzor = addLocation(1, "Chilonzor")
  const inAsosiy = await createTask(taskBody(s, { title: "Asosiyda", location_id: asosiy.id }))
  const inChilonzor = await createTask(taskBody(s, { title: "Chilonzorda", deadline: "2026-10-09", location_id: chilonzor.id }))
  const titles = async (query?: TaskQuery) => (await listTasks(query)).items.map((t) => t.title)
  const edit = (over: Partial<TaskUpdate> = {}): TaskUpdate => ({
    title: "X",
    deadline: "2026-10-10",
    stage_id: s.yangi.id,
    values: { [s.izoh.id]: "Ertalab" },
    ...over,
  })

  expect(await titles()).toEqual(["Chilonzorda", "Asosiyda"])
  expect(await titles({ location_id: asosiy.id })).toEqual(["Asosiyda"])
  expect(await failure(listTasks({ location_id: 999999 }))).toMatchObject({ status: 403, code: "forbidden" })
  expect(await failure(listTasks({ location_id: 0 }))).toMatchObject({ status: 400, message: "Lokatsiya noto'g'ri" })

  // The assignee works in the task's location: Vali, restricted to
  // Chilonzor, is not assigned a task in Asosiy; one assigned stays theirs
  // while the edit keeps them, another has to work there.
  restrictTo(VALI, 1, [chilonzor.id])
  expect(await failure(createTask(taskBody(s, { location_id: asosiy.id, assignee_phone: VALI })))).toMatchObject({
    status: 400,
    message: "Mas'ul bu lokatsiyada ishlamaydi",
  })
  const valis = await createTask(taskBody(s, { title: "Valiga", location_id: chilonzor.id, assignee_phone: VALI }))
  expect(valis.assignee?.phone).toBe(VALI)
  restrictTo(VALI, 1, [asosiy.id])
  expect((await updateTask(valis.id, edit({ title: "Valiga", assignee_phone: VALI }))).assignee?.phone).toBe(VALI)
  expect(await failure(updateTask(inChilonzor.id, edit({ assignee_phone: VALI })))).toMatchObject({
    status: 400,
    message: "Mas'ul bu lokatsiyada ishlamaydi",
  })

  restrictTo(VALI, 1, [chilonzor.id])
  await signIn(VALI)
  await chooseCompany(1)
  expect(await titles()).toEqual(["Chilonzorda", "Valiga"])
  expect(await failure(listTasks({ location_id: asosiy.id }))).toMatchObject({ status: 403, code: "forbidden" })
  expect(await failure(getTask(inAsosiy.id))).toMatchObject({ status: 404, message: "Vazifa topilmadi" })
  expect(await failure(updateTask(inAsosiy.id, edit()))).toMatchObject({ status: 404 })
  expect(await failure(moveTask(inAsosiy.id, s.bajarildi.id))).toMatchObject({ status: 404 })
  expect(await failure(deleteTask(inAsosiy.id))).toMatchObject({ status: 404 })
  expect((await getTask(inChilonzor.id)).location_id).toBe(chilonzor.id)
  expect(await failure(createTask(taskBody(s, { location_id: asosiy.id })))).toMatchObject({ status: 403, code: "forbidden" })
  expect((await createTask(taskBody(s, { title: "Yangi", location_id: chilonzor.id }))).location_id).toBe(chilonzor.id)
  expect(await failure(createTask({ ...taskBody(s, { title: "Nomsiz" }), location_id: undefined } as unknown as TaskCreate))).toMatchObject({
    status: 400,
    message: "Lokatsiyani tanlang",
  })
  restrictTo(VALI, 1, null)
  expect((await listTasks()).total).toBe(4)
})

test("a member enters a task for a customer that is there, or with a new one; what is wrong is said in the API's words", async () => {
  // The owner signs in twice: once to set up, once to read a history.
  db.cooldown = false
  await signIn(ALI)
  const s = await taskSetup()
  await signIn(VALI)
  await chooseCompany(1)

  const task = await createTask(
    taskBody(s, {
      title: " Qo'ng'iroq qilish ",
      assignee_phone: "+998 90 123 45 67",
      values: { [s.izoh.id]: " Ertalab ", [s.summa.id]: 45000, [s.kanal.id]: [s.linkedin.id, s.instagram.id] },
    }),
  )

  expect(task).toMatchObject({
    type_id: s.buyurtma.id,
    stage_id: s.yangi.id,
    location_id: asosiyOf(1).id,
    title: "Qo'ng'iroq qilish",
    deadline: "2026-10-10",
    customer: { id: s.ali.id, phone: "998901112233", name: "Ali Valiyev" },
    assignee: { phone: ALI, full_name: "Ali Valiyev" },
    values: { [s.izoh.id]: "Ertalab", [s.summa.id]: 45000, [s.kanal.id]: [s.instagram.id, s.linkedin.id] },
    created_by_name: "Vali Aliyev",
  })
  expect(task.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  expect(task.updated_at).toBe(task.created_at)
  expect(await getTask(task.id)).toEqual(task)

  // A new customer, in one request.
  const withNew = await createTask(
    taskBody(s, {
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
  const before = [db.tasks.length, db.customers.length]
  expect(
    await failure(createTask(taskBody(s, { customer: { type_id: s.jismoniy.id, phone: "998901112233", values: { [s.fish.id]: "Ali" } } }))),
  ).toMatchObject({ status: 409, code: "phone_taken", message: "Bu raqamli mijoz allaqachon bor", customerId: s.ali.id })
  expect([db.tasks.length, db.customers.length]).toEqual(before)

  const invalid = { status: 400, code: "validation_error" }
  const nokStage = db.stages.find((stage) => stage.companyId === 2)!.id
  const refusals: [Partial<TaskCreate>, string][] = [
    [{ title: " " }, "Vazifa nomini kiriting"],
    [{ title: "ў".repeat(201) }, "Vazifa nomi 200 belgidan oshmasin"],
    [{ deadline: "" }, "Muddatni kiriting"],
    [{ deadline: "10.10.2026" }, "Muddat noto'g'ri"],
    [{ deadline: "2026-02-30" }, "Muddat noto'g'ri"],
    [{ type_id: 999 }, "Vazifa turini tanlang"],
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
    [{ title: "", type_id: 999 }, "Vazifa nomini kiriting"],
    [{ stage_id: 0, values: {} }, "Bosqichni tanlang"],
    [{ values: {}, customer: {} }, "«Izoh» maydonini to'ldiring"],
  ]
  for (const [over, message] of refusals) {
    expect(await failure(createTask(taskBody(s, over))), message).toMatchObject({ ...invalid, message })
  }
  // A location that is not there is one the member may not work in: refused
  // the way a missing permission is, before anything else.
  expect(await failure(createTask(taskBody(s, { title: "", location_id: 999999 })))).toMatchObject({ status: 403, code: "forbidden" })
  expect(db.tasks).toHaveLength(2)
  // The task stands in the location named; one has to be named
  // (logic/locations.md, section 6).
  const chilonzor = addLocation(1, "Chilonzor")
  expect((await createTask(taskBody(s, { location_id: chilonzor.id }))).location_id).toBe(chilonzor.id)
  expect(await failure(createTask({ ...taskBody(s), location_id: undefined } as unknown as TaskCreate))).toMatchObject({
    status: 400,
    message: "Lokatsiyani tanlang",
  })

  expect(await failure(getTask(999))).toMatchObject({ status: 404, code: "not_found", message: "Vazifa topilmadi" })
  await chooseCompany(2)
  expect(await failure(getTask(task.id))).toMatchObject({ status: 404, message: "Vazifa topilmadi" })
  await chooseCompany(null)
  expect(await failure(createTask(taskBody(s)))).toMatchObject({ status: 403, code: "company_required" })
})

test("the tasks list: the one due soonest first, twenty to a page, the filters and the search", async () => {
  await signIn(ALI)
  const s = await taskSetup()
  const zarina = await createCustomer(s.jismoniy.id, "998905555555", { [s.fish.id]: "Zarina Karimova" })
  const later = await createTask(
    taskBody(s, { title: "Hisob yozish", deadline: "2026-10-12", values: { [s.izoh.id]: "Ertalab yozish", [s.summa.id]: 45000, [s.kanal.id]: [s.instagram.id] } }),
  )
  const sooner = await createTask(taskBody(s, { title: "Qo'ng'iroq qilish", deadline: "2026-10-10", assignee_phone: VALI, values: { [s.izoh.id]: "X" } }))
  const other = await createTask({
    type_id: s.vazifa.id,
    location_id: asosiyOf(1).id,
    title: "Shikoyatni ko'rish",
    deadline: "2026-10-10",
    stage_id: s.bajarildi.id,
    customer: { id: zarina.id },
  })

  expect(await listTasks()).toEqual({ items: [sooner, other, later], total: 3, page: 1, page_size: 20 })

  const found = async (query: TaskQuery) => (await listTasks(query)).items.map((t) => t.id)
  expect(await found({ type_id: s.vazifa.id })).toEqual([other.id])
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
  expect((await listTasks({ search: "ali" })).total).toBe(2)
  // A number is looked for in the customer's whole number answers too.
  const firma = await createCustomer(s.yuridik.id, "998907777777", { [s.nomi.id]: "Olma MChJ", [s.inn.id]: 301234567 })
  const firmas = await createTask(taskBody(s, { title: "Hisob-faktura", deadline: "2026-10-13", customer: { id: firma.id } }))
  expect(await found({ search: "3012" })).toEqual([firmas.id])
  expect(await found({ search: "7777" })).toEqual([firmas.id])

  for (let i = 0; i < 20; i += 1) await createTask(taskBody(s, { title: `Vazifa ${i}`, deadline: "2026-11-01" }))
  const first = await listTasks()
  expect(first.items).toHaveLength(20)
  expect(first.total).toBe(24)
  const second = await listTasks({ page: 2 })
  expect(second.items.map((t) => t.title)).toEqual(["Vazifa 16", "Vazifa 17", "Vazifa 18", "Vazifa 19"])
  expect(second).toMatchObject({ total: 24, page: 2, page_size: 20 })
  expect(await listTasks({ page: 3 })).toEqual({ items: [], total: 24, page: 3, page_size: 20 })
  const bad: [TaskQuery, string][] = [
    [{ page: 0 }, "Sahifa raqami noto'g'ri"],
    [{ type_id: "abc" as unknown as number }, "Vazifa turi noto'g'ri"],
    [{ stage_id: 0 }, "Bosqich noto'g'ri"],
    [{ customer_id: "abc" as unknown as number }, "Mijoz noto'g'ri"],
    [{ assignee: "vali" }, "Mas'ul noto'g'ri"],
  ]
  for (const [query, message] of bad) {
    expect(await failure(listTasks(query)), message).toMatchObject({ status: 400, code: "validation_error", message })
  }

  // Each company has its own tasks.
  await signIn(VALI)
  expect(await failure(listTasks())).toMatchObject({ status: 403, code: "company_required" })
  await chooseCompany(2)
  expect(await listTasks()).toEqual({ items: [], total: 0, page: 1, page_size: 20 })
})

test("an edit replaces the task's own fields and its answers and goes into the history, which is the owner's; the customer and the type stay", async () => {
  await signIn(ALI)
  const s = await taskSetup()
  const task = await createTask(taskBody(s, { values: { [s.izoh.id]: "Ertalab", [s.summa.id]: 45000, [s.kanal.id]: [s.instagram.id] } }))
  const same: TaskUpdate = {
    title: "Qayta qo'ng'iroq",
    deadline: "2026-10-12",
    stage_id: s.jarayonda.id,
    assignee_phone: VALI,
    values: { [s.izoh.id]: "Kechqurun", [s.kanal.id]: [s.linkedin.id, s.instagram.id] },
  }

  const edited = await updateTask(task.id, { ...same, title: " Qayta qo'ng'iroq " })

  expect(edited).toMatchObject({
    title: "Qayta qo'ng'iroq",
    deadline: "2026-10-12",
    stage_id: s.jarayonda.id,
    assignee: { phone: VALI, full_name: "Vali Aliyev" },
    values: { [s.izoh.id]: "Kechqurun", [s.kanal.id]: [s.instagram.id, s.linkedin.id] },
    customer: task.customer,
    type_id: task.type_id,
    created_at: task.created_at,
  })
  expect(edited.updated_at).not.toBe(task.updated_at)
  expect(await getTask(task.id)).toEqual(edited)
  const history = await taskHistory(task.id)
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
  expect(await updateTask(task.id, { ...same, assignee_phone: "+998 90 222 33 44" })).toEqual(edited)
  expect(await taskHistory(task.id)).toHaveLength(2)
  // An assignee who left the company stays as long as the edit keeps them;
  // another one has to be a member.
  db.members[VALI] = db.members[VALI].filter((m) => m.companyId !== 1)
  expect((await updateTask(task.id, { ...same, deadline: "2026-10-13" })).assignee).toEqual({ phone: VALI, full_name: "Vali Aliyev" })
  expect(await failure(updateTask(task.id, { ...same, assignee_phone: ZARINA }))).toMatchObject({ status: 400, message: "Mas'ul kompaniya a'zosi emas" })

  const refusals: [TaskUpdate, string][] = [
    [{ ...same, title: "" }, "Vazifa nomini kiriting"],
    [{ ...same, deadline: "soon" }, "Muddat noto'g'ri"],
    [{ ...same, stage_id: db.stages.find((stage) => stage.companyId === 2)!.id }, "Bosqichni tanlang"],
    [{ ...same, values: {} }, "«Izoh» maydonini to'ldiring"],
  ]
  for (const [body, message] of refusals) {
    expect(await failure(updateTask(task.id, body)), message).toMatchObject({ status: 400, code: "validation_error", message })
  }
  // A task that is not there is said first, whatever is sent.
  expect(await failure(updateTask(999, { ...same, title: "" }))).toMatchObject({ status: 404, message: "Vazifa topilmadi" })

  await signIn(SARDOR)
  await chooseCompany(1)
  expect(await failure(taskHistory(task.id))).toMatchObject({ status: 403, code: "forbidden" })
})

test("moving a task changes its stage alone and goes into the history; the same stage changes nothing", async () => {
  db.cooldown = false
  await signIn(ALI)
  const s = await taskSetup()
  const task = await createTask(taskBody(s))
  await signIn(VALI)
  await chooseCompany(1)

  const moved = await moveTask(task.id, s.bajarildi.id)

  expect(moved).toMatchObject({ stage_id: s.bajarildi.id, title: task.title, values: task.values, customer: task.customer })
  expect(await getTask(task.id)).toEqual(moved)
  expect(await moveTask(task.id, s.bajarildi.id)).toEqual(moved)
  for (const stageId of [0, 999, db.stages.find((stage) => stage.companyId === 2)!.id]) {
    expect(await failure(moveTask(task.id, stageId)), String(stageId)).toMatchObject({ status: 400, message: "Bosqichni tanlang" })
  }
  expect(await failure(moveTask(999, s.yangi.id))).toMatchObject({ status: 404, message: "Vazifa topilmadi" })

  await signIn(ALI)
  const history = await taskHistory(task.id)
  expect(history).toHaveLength(2)
  expect(history[0]).toMatchObject({
    action: "updated",
    actor_name: "Vali Aliyev",
    changes: [{ label: "Bosqich", old: "Yangi", new: "Bajarildi" }],
  })
})

test("a deleted task is gone from the app and its history is not shown; it stays in the database", async () => {
  db.cooldown = false
  await signIn(ALI)
  const s = await taskSetup()
  const task = await createTask(taskBody(s))
  const another = await createTask(taskBody(s, { title: "Boshqa" }))
  await signIn(VALI)
  await chooseCompany(1)

  await deleteTask(task.id)

  expect(await failure(getTask(task.id))).toMatchObject({ status: 404, code: "not_found", message: "Vazifa topilmadi" })
  expect(await failure(deleteTask(task.id))).toMatchObject({ status: 404 })
  expect((await listTasks()).items.map((t) => t.id)).toEqual([another.id])
  expect(db.tasks).toHaveLength(2)
  await chooseCompany(2)
  expect(await failure(deleteTask(another.id))).toMatchObject({ status: 404, message: "Vazifa topilmadi" })
  await signIn(ALI)
  expect(await failure(taskHistory(task.id))).toMatchObject({ status: 404 })
  expect(db.taskHistory.filter((e) => e.taskId === task.id).map((e) => e.action)).toEqual(["created", "deleted"])
})

test("what the tasks use is not deleted; the customers are suggested by the digits a phone begins with", async () => {
  await signIn(ALI)
  const s = await taskSetup()
  const task = await createTask(taskBody(s, { values: { [s.izoh.id]: "X", [s.kanal.id]: [s.instagram.id] } }))
  const gone = await createTask(taskBody(s, { title: "O'chirilgan", values: { [s.izoh.id]: "X", [s.summa.id]: 1 } }))
  await deleteTask(gone.id)
  const inUse = { status: 409 }

  expect(await failure(deleteCustomer(s.ali.id))).toMatchObject({ ...inUse, code: "customer_in_use", message: "Bu mijozda 1 ta vazifa bor" })
  expect(await failure(deleteStage(s.yangi.id))).toMatchObject({ ...inUse, code: "stage_in_use", message: "Bu bosqichda 1 ta vazifa bor" })
  expect(await failure(deleteTaskType(s.buyurtma.id))).toMatchObject({ ...inUse, code: "type_in_use", message: "Bu turda 1 ta vazifa bor" })
  expect(await failure(deleteTaskField(s.buyurtma.id, s.izoh.id))).toMatchObject({
    ...inUse,
    code: "field_in_use",
    message: "Bu maydon 1 ta vazifada to'ldirilgan",
  })
  expect(await failure(deleteOption(s.dropdown.id, s.instagram.id))).toMatchObject({
    ...inUse,
    code: "option_in_use",
    message: "Bu variant 1 ta vazifada tanlangan",
  })
  // The customers are told first.
  const vali = await createCustomer(s.jismoniy.id, "998905555555", { [s.fish.id]: "Vali", [s.manba.id]: s.instagram.id })
  expect(await failure(deleteOption(s.dropdown.id, s.instagram.id))).toMatchObject({ message: "Bu variant 1 ta mijozda tanlangan" })

  // What nobody uses goes as before; a deleted task holds nothing.
  await deleteStage(s.jarayonda.id)
  await deleteTaskType(s.vazifa.id)
  await deleteTaskField(s.buyurtma.id, s.summa.id)
  await deleteTask(task.id)
  await deleteCustomer(s.ali.id)
  await deleteStage(s.yangi.id)
  await deleteTaskType(s.buyurtma.id)

  // The suggestions of the task form: the digits typed after 998.
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

  const sotuvchi = await createRole({ name: " Sotuvchi ", permissions: ["tasks.view", "customers.view", "customers.view"] })
  expect(sotuvchi).toMatchObject({ name: "Sotuvchi", permissions: ["customers.view", "tasks.view"], members_count: 0 })
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
  expect(await failure(updateRole(sotuvchi.id, { name: "Kassir", permissions: ["tasks.create"] }))).toMatchObject({
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
  const kuzatuvchi = await createRole({ name: "Kuzatuvchi", permissions: ["tasks.view"] })
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
  expect(me.permissions).toEqual(["tasks.view"])
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

  expect(await call(api.GET("/app/products/{id}", path))).toEqual(p)
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
