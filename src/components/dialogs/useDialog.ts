import { createContext, useContext, type ReactNode } from 'react'

export type DialogTone = 'primary' | 'danger' | 'warning'
export type AlertDialogType = 'success' | 'warning' | 'error' | 'info'

interface BaseDialogOptions {
  title: string
  message?: string
  icon?: ReactNode
}

export interface ConfirmationDialogOptions extends BaseDialogOptions {
  confirmLabel?: string
  cancelLabel?: string
  confirmTone?: DialogTone
}

export interface AlertDialogOptions extends BaseDialogOptions {
  type?: AlertDialogType
  acceptLabel?: string
}

export interface PromptDialogOptions extends BaseDialogOptions {
  initialValue?: string
  placeholder?: string
  confirmLabel?: string
  cancelLabel?: string
  inputMode?: 'none' | 'text' | 'decimal' | 'numeric' | 'tel' | 'search' | 'email' | 'url'
  validate?: (value: string) => string | undefined
}

export interface DialogApi {
  confirm: (options: ConfirmationDialogOptions) => Promise<boolean>
  alert: (options: AlertDialogOptions) => Promise<void>
  prompt: (options: PromptDialogOptions) => Promise<string | null>
}

export const DialogContext = createContext<DialogApi | null>(null)

export function useDialog() {
  const context = useContext(DialogContext)

  if (!context) {
    throw new Error('useDialog debe utilizarse dentro de DialogProvider.')
  }

  return context
}
