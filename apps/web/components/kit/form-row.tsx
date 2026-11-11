"use client"

import { CheckIcon, ChevronDownIcon } from "lucide-react"
import { type ComponentProps, type ReactNode, useId } from "react"
import { type Control, Controller, type FieldPath, type FieldValues } from "react-hook-form"
import { AmountInput } from "@/components/kit/amount-input"
import { chip, chipOff, chipOn } from "@/components/kit/chips"
import { Switch } from "@/components/ui/switch"
import { formatPhoneInput } from "@/lib/phone"
import { cn } from "@/lib/utils"

// The fields of a form, as the prototype draws them: the label over the
// control, the control in its box (a 44px field of 17px words on a phone, a
// 34px one of 13px on the web; both ringed by a hairline, a touch darker on
// a phone, where the box stands white on a white card and would else not
// look like a field; the accent's ring round it while typing), the error
// under them in red. Each is bound to a react-hook-form field through
// Controller. TOut is what the form's schema turns the values into.

const labelClass =
  "pl-1 text-[13px] leading-tight text-muted-foreground group-data-invalid:text-destructive md:pl-0 md:text-[12.5px] md:font-medium md:text-foreground"
export const boxClass =
  "flex h-11 items-center gap-1.5 rounded-field bg-field px-3.5 text-base text-foreground shadow-[inset_0_0_0_1px_var(--ink-5)] transition-shadow focus-within:shadow-[inset_0_0_0_1.5px_var(--primary)] group-data-invalid:shadow-[inset_0_0_0_1px_var(--destructive),0_0_0_3px_var(--destructive-soft)] md:h-[34px] md:rounded-md md:px-2.5 md:shadow-[inset_0_0_0_1px_var(--ink-4)] md:focus-within:shadow-[inset_0_0_0_1px_var(--primary),0_0_0_3px_var(--primary-soft)] md:group-data-invalid:shadow-[inset_0_0_0_1px_var(--destructive),0_0_0_3px_var(--destructive-soft)]"
export const inputClass = "h-full min-w-0 flex-1 bg-transparent text-base text-foreground outline-none placeholder:text-faint disabled:opacity-60"
const errorClass = "text-[12px] text-destructive"

interface Bound<T extends FieldValues, TOut extends FieldValues> {
  control: Control<T, unknown, TOut>
  name: FieldPath<T>
  label: string
}

// FormRow is the frame: a label (for the control with htmlFor, or plain
// text over a group), the control in its box, the error. stack leaves the
// box out (a group of chips stands bare under its label).
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
    <div data-slot="form-row" data-invalid={error ? true : undefined} className={cn("group grid gap-1.5 px-4 py-2 md:px-3", className)}>
      {htmlFor ? (
        <label htmlFor={htmlFor} className={labelClass}>
          {label}
        </label>
      ) : (
        <span className={labelClass}>{label}</span>
      )}
      {stack ? (
        children
      ) : (
        <div data-slot="field-box" className={boxClass}>
          {children}
        </div>
      )}
      {error && (
        <p id={errorId} role="alert" data-slot="form-error" className={errorClass}>
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
          {prefix && <span className="text-base text-faint">{prefix}</span>}
          <input
            id={id}
            aria-invalid={fieldState.invalid || undefined}
            aria-describedby={fieldState.error ? `${id}-error` : undefined}
            className={cn(inputClass, className)}
            {...input}
            {...field}
            value={field.value ?? ""}
          />
          {suffix && <span className="text-base text-faint">{suffix}</span>}
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
          <span className="text-base text-faint">+998</span>
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

// AmountRow is an amount of money (or a rate): a decimal keyboard, the unit
// beside it. What is typed is masked as an amount is read (AmountInput:
// "1 250 000,5"); the field holds the masked text, which the schema parses.
export function AmountRow<T extends FieldValues, TOut extends FieldValues = T>({
  control,
  name,
  label,
  suffix = "so'm",
  placeholder = "0",
}: Bound<T, TOut> & { suffix?: ReactNode; placeholder?: string }) {
  const id = useId()
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <FormRow label={label} htmlFor={id} error={fieldState.error?.message} errorId={`${id}-error`}>
          <AmountInput
            id={id}
            inputMode="decimal"
            autoComplete="off"
            placeholder={placeholder}
            aria-invalid={fieldState.invalid || undefined}
            aria-describedby={fieldState.error ? `${id}-error` : undefined}
            className={inputClass}
            {...field}
            value={field.value ?? ""}
          />
          {suffix && <span className="text-base text-faint">{suffix}</span>}
        </FormRow>
      )}
    />
  )
}

// PickRow is a choice made elsewhere (a picker sheet, a calendar), drawn as
// the prototype's select: the label over a boxed button that says the value
// (or a prompt) with a chevron down; it is named by the label and the
// value; a press opens the sheet.
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
    <div data-slot="form-row" data-invalid={error ? true : undefined} className="group grid gap-1.5 px-4 py-2 md:px-3">
      <span id={`${own}-label`} className={labelClass}>
        {label}
      </span>
      <button
        type="button"
        id={id}
        data-slot="field-box"
        // Named by its label and its value: the label finds it, and the
        // value is heard with it.
        aria-labelledby={`${own}-label ${own}-value`}
        aria-haspopup="dialog"
        aria-describedby={error ? described : undefined}
        disabled={disabled}
        onClick={onClick}
        className={cn(boxClass, "w-full text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60")}
      >
        <span id={`${own}-value`} data-slot="pick-value" className={cn("min-w-0 flex-1 truncate", value ? "text-foreground" : "text-faint")}>
          {value ?? placeholder}
        </span>
        <ChevronDownIcon aria-hidden="true" strokeWidth={2} className="size-4 shrink-0 text-icon" />
      </button>
      {error && (
        <p id={described} role="alert" data-slot="form-error" className={errorClass}>
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
        <div data-slot="form-row" className="flex min-h-11 items-center justify-between gap-3 px-4 py-2 md:min-h-8 md:px-3">
          <label htmlFor={id} className="min-w-0 flex-1 text-base">
            {label}
            {description && <span className="block text-md text-muted-foreground">{description}</span>}
          </label>
          <Switch id={id} checked={!!field.value} onCheckedChange={(checked) => field.onChange(checked)} onBlur={field.onBlur} disabled={field.disabled} />
        </div>
      )}
    />
  )
}

// An option is the prototype's chip: white (ringed on the web); the chosen
// one the accent on a phone, the ink on the web.

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
                {optional && <span className="font-normal text-faint"> · ixtiyoriy</span>}
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
              {options.length === 0 && <span className="text-md text-faint">{empty}</span>}
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
                    className={cn(chip, on ? chipOn : chipOff, "disabled:opacity-60")}
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
