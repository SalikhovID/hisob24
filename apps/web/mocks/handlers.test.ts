// The mock API has to answer /app/employees the way the Go API does, or the
// pages tested against it would be tested against something else
// (logic/user.md, logic/roles.md; backend/internal/app/employees_test.go).
import { expect, test } from "vitest"
import { api, call } from "@/lib/api"
import type { CustomerFieldKind } from "@/lib/types"
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
  expect(await failure(createType("Xodimniki"))).toMatchObject({ status: 403, code: "owner_only" })
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
  expect(await failure(addField(jismoniy.id, { label: "Xodimniki", kind: "string" }))).toMatchObject({ status: 403, code: "owner_only" })
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

type ListQuery = { search?: string; type_id?: number; page?: number }
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
    code: "owner_only",
    message: "Bu bo'lim faqat kompaniya egasi uchun",
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
