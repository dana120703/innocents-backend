"use client"

import type React from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export interface FormData {
  fornavn: string
  etternavn: string
  epost: string
  adresse: string
  postnummer: string
  sted: string
}

interface CheckoutFormProps {
  formData: FormData
  onChange: (data: FormData) => void
  errors: Partial<Record<keyof FormData, string>>
}

function Field({
  id,
  label,
  error,
  children,
}: {
  id: string
  label: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label
        htmlFor={id}
        className="text-xs font-medium text-muted-foreground"
      >
        {label}
      </Label>
      {children}
      {error && (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

export function CheckoutForm({ formData, onChange, errors }: CheckoutFormProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    onChange({ ...formData, [name]: value })
  }

  const inputClass =
    "h-11 border-border bg-background text-foreground placeholder:text-muted-foreground/40 focus-visible:ring-foreground"

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field id="fornavn" label="Fornavn" error={errors.fornavn}>
          <Input
            id="fornavn"
            name="fornavn"
            placeholder="Ola"
            value={formData.fornavn}
            onChange={handleChange}
            aria-invalid={!!errors.fornavn}
            className={inputClass}
            autoComplete="given-name"
            required
          />
        </Field>
        <Field id="etternavn" label="Etternavn" error={errors.etternavn}>
          <Input
            id="etternavn"
            name="etternavn"
            placeholder="Nordmann"
            value={formData.etternavn}
            onChange={handleChange}
            aria-invalid={!!errors.etternavn}
            className={inputClass}
            autoComplete="family-name"
            required
          />
        </Field>
      </div>

      <Field id="epost" label="E-post" error={errors.epost}>
        <Input
          id="epost"
          name="epost"
          type="email"
          placeholder="ola@eksempel.no"
          value={formData.epost}
          onChange={handleChange}
          aria-invalid={!!errors.epost}
          className={inputClass}
          autoComplete="email"
          required
        />
      </Field>

      <Field id="adresse" label="Adresse" error={errors.adresse}>
        <Input
          id="adresse"
          name="adresse"
          placeholder="Storgata 1"
          value={formData.adresse}
          onChange={handleChange}
          aria-invalid={!!errors.adresse}
          className={inputClass}
          autoComplete="street-address"
          required
        />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field id="postnummer" label="Postnummer" error={errors.postnummer}>
          <Input
            id="postnummer"
            name="postnummer"
            placeholder="0001"
            value={formData.postnummer}
            onChange={handleChange}
            aria-invalid={!!errors.postnummer}
            className={inputClass}
            autoComplete="postal-code"
            inputMode="numeric"
            required
          />
        </Field>
        <Field id="sted" label="Sted" error={errors.sted}>
          <Input
            id="sted"
            name="sted"
            placeholder="Oslo"
            value={formData.sted}
            onChange={handleChange}
            aria-invalid={!!errors.sted}
            className={inputClass}
            autoComplete="address-level2"
            required
          />
        </Field>
      </div>
    </div>
  )
}
