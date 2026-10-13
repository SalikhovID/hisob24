"use client"

import { CheckIcon } from "lucide-react"
import { type CSSProperties, type KeyboardEvent, type ReactNode, useState } from "react"
import { type Control, Controller, type FieldPath, type FieldValues } from "react-hook-form"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { PickRow } from "./form-row"
import { Foot } from "./group"
import { MainButton } from "./main-button"
import { SearchBox } from "./search-box"

export interface PickerOption {
  value: string
  label: string
  // sub is a line under the name (a phone, a unit and a price); media leads
  // the row (an avatar, a dot); badge stands beside the name.
  sub?: string
  media?: ReactNode
  badge?: ReactNode
  disabled?: boolean
}

// norm is text for matching: lowercase, the apostrophes of o' and g' and
// the tutuq dropped, so "o'zbek", "oʻzbek" and "ozbek" meet.
const norm = (text: string) => text.toLowerCase().replace(/['ʻʼ’`]/g, "")

const matches = (options: PickerOption[], query: string) =>
  query === "" ? options : options.filter((option) => norm(`${option.label} ${option.sub ?? ""}`).includes(norm(query)))

// Option is one row of the list: a listbox option, taken with a press or
// the keyboard.
function Option({ option, selected, onSelect }: { option: PickerOption; selected: boolean; onSelect: () => void }) {
  const onKeyDown = (event: KeyboardEvent<HTMLLIElement>) => {
    if (event.key !== "Enter" && event.key !== " ") return
    event.preventDefault()
    onSelect()
  }
  return (
    <li
      role="option"
      aria-selected={selected}
      aria-disabled={option.disabled || undefined}
      tabIndex={option.disabled ? -1 : 0}
      data-slot="row"
      onClick={option.disabled ? undefined : onSelect}
      onKeyDown={option.disabled ? undefined : onKeyDown}
      className={cn(
        "flex min-h-12 w-full cursor-default items-center gap-3 px-4 py-2 text-left text-base outline-none active:bg-press focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset",
        option.disabled && "opacity-45",
      )}
    >
      {option.media}
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-center gap-1.5 font-medium">
          <span className="truncate">{option.label}</span>
          {option.badge}
        </span>
        {option.sub && " "}
        {option.sub && <span className="mt-0.5 block truncate text-sm text-muted-foreground">{option.sub}</span>}
      </span>
      {selected && <CheckIcon aria-hidden="true" strokeWidth={2.6} className="size-5 shrink-0 text-primary" />}
    </li>
  )
}

// OptionList is the options in a group, with what to say when none match.
function OptionList({
  title,
  options,
  isSelected,
  onSelect,
  emptyText,
}: {
  title: string
  options: PickerOption[]
  isSelected: (value: string) => boolean
  onSelect: (value: string) => void
  emptyText: string
}) {
  const inset = options.some((option) => option.media) ? "68px" : "16px"
  return (
    <ul role="listbox" aria-label={title} style={{ "--inset": inset } as CSSProperties} className="overflow-hidden rounded-group bg-sheet-cell">
      {options.map((option) => (
        <Option key={option.value} option={option} selected={isSelected(option.value)} onSelect={() => onSelect(option.value)} />
      ))}
      {options.length === 0 && <li className="px-4 py-4 text-center text-sm text-muted-foreground">{emptyText}</li>}
    </ul>
  )
}

interface SheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  options: PickerOption[]
  // search, when given, is the search box's placeholder: the options are
  // narrowed in place as it is typed in.
  search?: string
  note?: ReactNode
  emptyText?: string
}

// PickerSheet is a choice of one option in a sheet (the prototype's
// picker): the options as a listbox, the chosen one marked, with a search
// over them when there are many; «none» is a first option that clears the
// choice. A press chooses and closes the sheet.
export function PickerSheet({
  open,
  onOpenChange,
  title,
  options,
  search,
  ...body
}: SheetProps & { value: string; onChange: (value: string) => void; none?: string }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent tall={search !== undefined || options.length > 8}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <PickerBody title={title} options={options} search={search} onClose={() => onOpenChange(false)} {...body} />
      </DialogContent>
    </Dialog>
  )
}

// PickerBody is the open sheet's search and list: it mounts with every
// opening (the closed sheet holds nothing), so each one starts unsearched.
function PickerBody({
  title,
  options,
  value,
  onChange,
  none,
  search,
  note,
  emptyText = "Hech narsa topilmadi",
  onClose,
}: {
  title: string
  options: PickerOption[]
  value: string
  onChange: (value: string) => void
  none?: string
  search?: string
  note?: ReactNode
  emptyText?: string
  onClose: () => void
}) {
  const [query, setQuery] = useState("")
  const shown = matches(options, query)
  const listed = none && query === "" ? [{ value: "", label: none }, ...shown] : shown
  return (
    <>
      {search !== undefined && <SearchBox value={query} onSearch={setQuery} placeholder={search} delay={0} className="mb-3" />}
      <OptionList
        title={title}
        options={listed}
        isSelected={(candidate) => candidate === value}
        onSelect={(candidate) => {
          onChange(candidate)
          onClose()
        }}
        emptyText={emptyText}
      />
      {note && <Foot className="mt-3">{note}</Foot>}
    </>
  )
}

// MultiPickerSheet is a choice of several: the sheet stays open while
// options are taken and put back, and hands them over on «Tayyor».
export function MultiPickerSheet({
  open,
  onOpenChange,
  title,
  options,
  search,
  ...body
}: SheetProps & { value: string[]; onChange: (value: string[]) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent tall={search !== undefined || options.length > 8}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <MultiPickerBody title={title} options={options} search={search} onClose={() => onOpenChange(false)} {...body} />
      </DialogContent>
    </Dialog>
  )
}

// MultiPickerBody starts, with every opening, from the choice as it stands.
function MultiPickerBody({
  title,
  options,
  value,
  onChange,
  search,
  note,
  emptyText = "Hech narsa topilmadi",
  onClose,
}: {
  title: string
  options: PickerOption[]
  value: string[]
  onChange: (value: string[]) => void
  search?: string
  note?: ReactNode
  emptyText?: string
  onClose: () => void
}) {
  const [query, setQuery] = useState("")
  const [chosen, setChosen] = useState(value)
  return (
    <>
      {search !== undefined && <SearchBox value={query} onSearch={setQuery} placeholder={search} delay={0} className="mb-3" />}
      <OptionList
        title={title}
        options={matches(options, query)}
        isSelected={(candidate) => chosen.includes(candidate)}
        onSelect={(candidate) => setChosen(chosen.includes(candidate) ? chosen.filter((v) => v !== candidate) : [...chosen, candidate])}
        emptyText={emptyText}
      />
      {note && <Foot className="mt-3">{note}</Foot>}
      <DialogFooter>
        <MainButton
          onClick={() => {
            onChange(chosen)
            onClose()
          }}
        >
          Tayyor
        </MainButton>
      </DialogFooter>
    </>
  )
}

interface Bound<T extends FieldValues, TOut extends FieldValues> {
  control: Control<T, unknown, TOut>
  name: FieldPath<T>
  label: string
  options: PickerOption[]
  search?: string
  note?: ReactNode
  disabled?: boolean
}

// SelectRow is a PickRow bound to a form field with a PickerSheet behind
// it: the row says the chosen option's name, or the prompt (none's name,
// when there is one).
export function SelectRow<T extends FieldValues, TOut extends FieldValues = T>({
  control,
  name,
  label,
  options,
  none,
  placeholder,
  search,
  note,
  disabled,
}: Bound<T, TOut> & { none?: string; placeholder?: string }) {
  const [open, setOpen] = useState(false)
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const current = options.find((option) => option.value === String(field.value ?? ""))
        return (
          <>
            <PickRow
              label={label}
              value={current?.label}
              placeholder={placeholder ?? none ?? "Tanlang"}
              onClick={() => setOpen(true)}
              error={fieldState.error?.message}
              disabled={disabled || field.disabled}
            />
            <PickerSheet
              open={open}
              onOpenChange={setOpen}
              title={label}
              options={options}
              value={String(field.value ?? "")}
              onChange={(value) => field.onChange(value)}
              none={none}
              search={search}
              note={note}
            />
          </>
        )
      }}
    />
  )
}

// MultiSelectRow is the same for a choice of several: the row lists the
// chosen names.
export function MultiSelectRow<T extends FieldValues, TOut extends FieldValues = T>({
  control,
  name,
  label,
  options,
  placeholder = "Tanlanmagan",
  search,
  note,
  disabled,
}: Bound<T, TOut> & { placeholder?: string }) {
  const [open, setOpen] = useState(false)
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const chosen = (field.value as string[] | undefined) ?? []
        const names = options.filter((option) => chosen.includes(option.value)).map((option) => option.label)
        return (
          <>
            <PickRow
              label={label}
              value={names.length > 0 ? names.join(", ") : undefined}
              placeholder={placeholder}
              onClick={() => setOpen(true)}
              error={fieldState.error?.message}
              disabled={disabled || field.disabled}
            />
            <MultiPickerSheet
              open={open}
              onOpenChange={setOpen}
              title={label}
              options={options}
              value={chosen}
              onChange={(value) => field.onChange(value)}
              search={search}
              note={note}
            />
          </>
        )
      }}
    />
  )
}

// SearchPickerSheet finds a record on the server: what is typed is told to
// the owner (onQuery), who brings the matches (options) from its hook; the
// list says it is loading or that nothing matched. A press chooses and
// closes the sheet.
export function SearchPickerSheet({
  open,
  onOpenChange,
  title,
  placeholder,
  query,
  onQuery,
  options,
  value,
  onChange,
  loading,
  emptyText = "Hech narsa topilmadi",
  note,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  placeholder: string
  query: string
  onQuery: (query: string) => void
  options: PickerOption[]
  value: string
  onChange: (value: string) => void
  loading: boolean
  emptyText?: string
  note?: ReactNode
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent tall>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <SearchBox value={query} onSearch={onQuery} placeholder={placeholder} className="mb-3" />
        <OptionList
          title={title}
          options={options}
          isSelected={(candidate) => candidate === value}
          onSelect={(candidate) => {
            onChange(candidate)
            onOpenChange(false)
          }}
          emptyText={loading ? "Yuklanmoqda…" : emptyText}
        />
        {note && <Foot className="mt-3">{note}</Foot>}
      </DialogContent>
    </Dialog>
  )
}
