import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react'

import { AlertDialog } from './AlertDialog'
import { ConfirmationDialog } from './ConfirmationDialog'
import { PromptDialog } from './PromptDialog'
import {
  DialogContext,
  type AlertDialogOptions,
  type ConfirmationDialogOptions,
  type DialogApi,
  type PromptDialogOptions,
} from './useDialog'

type DialogRequest =
  | { id: number; kind: 'confirm'; options: ConfirmationDialogOptions; resolve: (value: boolean) => void }
  | { id: number; kind: 'alert'; options: AlertDialogOptions; resolve: () => void }
  | { id: number; kind: 'prompt'; options: PromptDialogOptions; resolve: (value: string | null) => void }

const CLOSE_ANIMATION_MS = 180

export function DialogProvider({ children }: { children: ReactNode }) {
  const [activeDialog, setActiveDialog] = useState<DialogRequest | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const activeDialogRef = useRef<DialogRequest | null>(null)
  const queueRef = useRef<DialogRequest[]>([])
  const nextIdRef = useRef(1)
  const closingRef = useRef(false)

  const presentNextDialog = useCallback(() => {
    const nextDialog = queueRef.current.shift() ?? null
    activeDialogRef.current = nextDialog
    setActiveDialog(nextDialog)
    setIsOpen(Boolean(nextDialog))
  }, [])

  const enqueueDialog = useCallback((request: DialogRequest) => {
    if (activeDialogRef.current || closingRef.current) {
      queueRef.current.push(request)
      return
    }

    activeDialogRef.current = request
    setActiveDialog(request)
    setIsOpen(true)
  }, [])

  const settleDialog = useCallback((value?: boolean | string | null) => {
    const request = activeDialogRef.current
    if (!request || closingRef.current) {
      return
    }

    closingRef.current = true
    setIsOpen(false)
    window.setTimeout(() => {
      if (request.kind === 'confirm') {
        request.resolve(Boolean(value))
      } else if (request.kind === 'prompt') {
        request.resolve(typeof value === 'string' ? value : null)
      } else {
        request.resolve()
      }

      closingRef.current = false
      presentNextDialog()
    }, CLOSE_ANIMATION_MS)
  }, [presentNextDialog])

  const api = useMemo<DialogApi>(() => ({
    confirm: (options) => new Promise<boolean>((resolve) => {
      enqueueDialog({ id: nextIdRef.current++, kind: 'confirm', options, resolve })
    }),
    alert: (options) => new Promise<void>((resolve) => {
      enqueueDialog({ id: nextIdRef.current++, kind: 'alert', options, resolve })
    }),
    prompt: (options) => new Promise<string | null>((resolve) => {
      enqueueDialog({ id: nextIdRef.current++, kind: 'prompt', options, resolve })
    }),
  }), [enqueueDialog])

  return (
    <DialogContext.Provider value={api}>
      {children}
      {activeDialog?.kind === 'confirm' && (
        <ConfirmationDialog
          key={activeDialog.id}
          onCancel={() => settleDialog(false)}
          onConfirm={() => settleDialog(true)}
          open={isOpen}
          options={activeDialog.options}
        />
      )}
      {activeDialog?.kind === 'alert' && (
        <AlertDialog
          key={activeDialog.id}
          onAccept={() => settleDialog()}
          open={isOpen}
          options={activeDialog.options}
        />
      )}
      {activeDialog?.kind === 'prompt' && (
        <PromptDialog
          key={activeDialog.id}
          onCancel={() => settleDialog(null)}
          onConfirm={(value) => settleDialog(value)}
          open={isOpen}
          options={activeDialog.options}
        />
      )}
    </DialogContext.Provider>
  )
}
