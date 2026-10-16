"use client"

import { CheckIcon, ChevronRightIcon } from "lucide-react"
import { type ComponentProps, type ReactNode, useId } from "react"
import { type Control, Controller, type FieldPath, type FieldValues } from "react-hook-form"
import { Switch } from "@/components/ui/switch"
import { formatPhoneInput } from "@/lib/phone"
import { cn } from "@/lib/utils"

// The rows of a form, as the prototype draws them inside a Group: the label
// at the left (112px), the control beside it, the error under them in red.
// Each is bound to a react-hook-form field through Controller. TOut is what
// the form's schema turns the values into. An input is 44px tall, a thumb's
// target, in a row as tall as the prototype's (52px).

const labelClass = "shrink-0 basis-[112px] text-[16px] leading-tight text-foreground group-data-invalid:text-destructive"
export const inputClass = "h-11 min-w-0 flex-1 bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground/80 disabled:opacity-60"

interface Bound<T extends FieldValues, TOut extends FieldValues> {
  control: Control<T, unknown, TOut>
  name: FieldPath<T>
  label: string
}

// FormRow is the frame: a label (for the control with htmlFor, or plain
// text beside a group), the control, the error. stack puts the control
// under the label (a group of chips).
export function FormRow({
  label,
  htmlFor,
  error,
  errorId,
  stack = false,
  children,
  className,
}: {
  label: ReactNode
  htmlFor?: string
  error?: string
  errorId?: string
  stack?: boolean
  children: ReactNode
  className?: string
}) {
  return (
    <div data-slot="form-row" data-invalid={error ? true : undefined} className={cn("group px-4", className)}>
      <div className={cn("flex min-h-[52px] gap-3 py-1", stack ? "flex-col items-stretch gap-2 py-3" : "items-center")}>
        {htmlFor ? (
          <label htmlFor={htmlFor} className={cn(labelClass, stack && "basis-auto")}>
            {label}
          </label>
        ) : (
          <span className={cn(labelClass, stack && "basis-auto")}>{label}</span>
        )}
        {children}
      </div>
      {error && (
        <p id={errorId} role="alert" data-slot="form-error" className="-mt-1.5 pb-2.5 text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}

// TextRow is a text input in a row; prefix and suffix stand beside it.
export function TextRow<T extends FieldValues, TOut extends FieldValues = T>({
  control,
  name,
  label,
  prefix,
  suffix,
  className,
  ...input
}: Bound<T, TOut> & { prefix?: ReactNode; suffix?: ReactNode } & Omit<ComponentProps<"input">, "name" | "value" | "onChange" | "onBlur">) {
  const id = useId()
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <FormRow label={label} htmlFor={id} error={fieldState.error?.message} errorId={`${id}-error`}>
          {prefix && <span className="text-base text-muted-foreground">{prefix}</span>}
          <input
            id={id}
            aria-invalid={fieldState.invalid || undefined}
            aria-describedby={fieldState.error ? `${id}-error` : undefined}
            className={cn(inputClass, className)}
            {...input}
            {...field}
            value={field.value ?? ""}
          />
          {suffix && <span className="text-md text-muted-foreground">{suffix}</span>}
        </FormRow>
      )}
    />
  )
}

// PhoneRow is a phone after +998, shown as 90 123 45 67 (lib/phone.ts); the
// field holds what is shown, phoneDigits turns it into what the API takes.
export function PhoneRow<T extends FieldValues, TOut extends FieldValues = T>({
  control,
  name,
  label = "Telefon",
  readOnly,
  autoComplete = "off",
}: Omit<Bound<T, TOut>, "label"> & { label?: string; readOnly?: boolean; autoComplete?: string }) {
  const id = useId()
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <FormRow label={label} htmlFor={id} error={fieldState.error?.message} errorId={`${id}-error`}>
          <span className="text-base text-muted-foreground">+998</span>
          <input
            id={id}
            type="tel"
            inputMode="tel"
            placeholder="__ ___ __ __"
            readOnly={readOnly}
            autoComplete={autoComplete}
            aria-invalid={fieldState.invalid || undefined}
            aria-describedby={fieldState.error ? `${id}-error` : undefined}
            className={inputClass}
            {...field}
            value={field.value ?? ""}
            onChange={(event) => field.onChange(formatPhoneInput(event.target.value))}
          />
        </FormRow>
      )}
    />
  )
}

// AmountRow is an amount of money (or a quantity): a decimal keyboard, the
// unit beside it. The field holds the digits as typed; the schema parses.
export function AmountRow<T extends FieldValues, TOut extends FieldValues = T>({
  suffix = "so'm",
  placeholder = "0",
  ...props
}: Bound<T, TOut> & { suffix?: ReactNode; placeholder?: string }) {
  return <TextRow inputMode="decimal" autoComplete="off" placeholder={placeholder} suffix={suffix} {...props} />
}

// PickRow is a choice made elsewhere (a picker sheet, a calendar): the row
// is a button that says the label and the value (or a prompt), with a
// chevron; a press opens the sheet.
export function PickRow({
  label,
  value,
  placeholder = "Tanlang",
  onClick,
  error,
  errorId,
  disabled = false,
  id,
}: {
  label: string
  value?: ReactNode
  placeholder?: string
  onClick: () => void
  error?: string
  errorId?: string
  disabled?: boolean
  id?: string
}) {
  const own = useId()
  const described = errorId ?? `${own}-error`
  return (
    <div data-slot="form-row" data-invalid={error ? true : undefined} className="group">
      <button
        type="button"
        id={id}
        // Named by its label and its value: the label finds it, and the
        // value is heard with it.
        aria-labelledby={`${own}-label ${own}-value`}
        aria-haspopup="dialog"
        aria-describedby={error ? described : undefined}
        disabled={disabled}
        onClick={onClick}
        className="flex min-h-[52px] w-full items-center gap-3 px-4 py-1.5 text-left outline-none active:bg-press focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset disabled:opacity-60"
      >
        <span id={`${own}-label`} className={labelClass}>
          {label}
        </span>{" "}
        <span id={`${own}-value`} data-slot="pick-value" className={cn("min-w-0 flex-1 truncate text-right text-base", value ? "text-foreground" : "text-muted-foreground")}>
          {value ?? placeholder}
        </span>
        <ChevronRightIcon aria-hidden="true" strokeWidth={2.6} className="-mr-1 size-[18px] shrink-0 text-muted-foreground opacity-60" />
      </button>
      {error && (
        <p id={described} role="alert" data-slot="form-error" className="-mt-1.5 px-4 pb-2.5 text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}

// SwitchRow is a yes-or-no in a row: the name at the left, the switch at
// the right; a line under the name may say more.
export function SwitchRow<T extends FieldValues, TOut extends FieldValues = T>({
  control,
  name,
  label,
  description,
}: Bound<T, TOut> & { description?: ReactNode }) {
  const id = useId()
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <div data-slot="form-row" className="flex min-h-12 items-center gap-3 px-4 py-1.5">
          <label htmlFor={id} className="min-w-0 flex-1 text-base">
            {label}
            {description && <span className="block text-sm text-muted-foreground">{description}</span>}
          </label>
          <Switch id={id} checked={!!field.value} onCheckedChange={(checked) => field.onChange(checked)} onBlur={field.onBlur} disabled={field.disabled} />
        </div>
      )}
    />
  )
}

// An option is a chip in the plain fill; the chosen one is the prototype's
// glossy capsule.
const optClass = "inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-md font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
const optOff = "bg-muted"
const optOn = "glossy"

// OptionChips are the options of a choice field drawn as chips: one of
// them (radios; the chosen one pressed again is unchosen) or several
// (checkboxes). The field holds the value, "" for none, or the values.
export function OptionChips<T extends FieldValues, TOut extends FieldValues = T>({
  control,
  name,
  label,
  options,
  multiple = false,
  optional = false,
  disabled = false,
  empty = "Variant yo'q",
}: Bound<T, TOut> & { options: { value: string; label: string }[]; multiple?: boolean; optional?: boolean; disabled?: boolean; empty?: string }) {
  const id = useId()
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const chosen: string[] = multiple ? ((field.value as string[] | undefined) ?? []) : field.value ? [String(field.value)] : []
        const toggle = (value: string) => {
          if (multiple) field.onChange(chosen.includes(value) ? chosen.filter((v) => v !== value) : [...chosen, value])
          else field.onChange(chosen.includes(value) ? "" : value)
        }
        return (
          <FormRow
            stack
            label={
              <>
                {label}
                {optional && <span className="text-sm text-muted-foreground"> · ixtiyoriy</span>}
              </>
            }
            error={fieldState.error?.message}
            errorId={`${id}-error`}
          >
            <div
              role={multiple ? "group" : "radiogroup"}
              aria-label={label}
              aria-describedby={fieldState.error ? `${id}-error` : undefined}
              className="flex flex-wrap gap-1.5"
            >
              {options.length === 0 && <span className="text-md text-muted-foreground">{empty}</span>}
              {options.map((option) => {
                const on = chosen.includes(option.value)
                return (
                  <button
                    key={option.value}
                    type="button"
                    role={multiple ? "checkbox" : "radio"}
                    aria-checked={on}
                    data-slot="option-chip"
                    onClick={() => toggle(option.value)}
                    disabled={disabled}
                    className={cn(optClass, on ? optOn : optOff, "disabled:opacity-60")}
                  >
                    {multiple && on && <CheckIcon aria-hidden="true" strokeWidth={3} className="size-[15px]" />}
                    {option.label}
                  </button>
                )
              })}
            </div>
          </FormRow>
        )
      }}
    />
  )
}
