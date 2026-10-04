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
