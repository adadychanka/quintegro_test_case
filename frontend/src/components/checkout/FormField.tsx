import React from 'react'

interface FormFieldProps {
  id: string
  label: string
  error?: string
  children: React.ReactNode
}

// Label + control + inline error, matching LoginPage field styles.
const FormField: React.FC<FormFieldProps> = ({ id, label, error, children }) => (
  <div className="space-y-2">
    <label htmlFor={id} className="text-sm font-medium text-gray-700">
      {label}
    </label>
    {children}
    {error && (
      <p id={`${id}-error`} className="text-sm text-red-600">
        {error}
      </p>
    )}
  </div>
)

export function fieldA11y(id: string, error?: string) {
  return error
    ? { 'aria-invalid': true as const, 'aria-describedby': `${id}-error`, className: 'h-11 border-red-500' }
    : { className: 'h-11' }
}

export default FormField
