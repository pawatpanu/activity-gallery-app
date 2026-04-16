import React from 'react'
import { Dialog } from '@headlessui/react'
import { Button } from './form/Input'

export type ModalAction = {
  key: string
  label: string
  variant?: 'negative' | 'positive' | 'default'
  disabled?: boolean
  onClick(event: React.MouseEvent<HTMLButtonElement>): void
}

export type ModalProps = {
  title: string
  description: React.ReactNode
  children?: React.ReactNode
  actions: ModalAction[]
  open: boolean
  onClose(): void
}

const Modal = ({
  title,
  description,
  children,
  actions,
  open,
  onClose,
}: ModalProps) => {
  const actionElms = actions.map(x => (
    <Button
      key={x.key}
      onClick={e => x.onClick(e)}
      variant={x.variant}
      background="white"
      disabled={x.disabled}
    >
      {x.label}
    </Button>
  ))

  return (
    <Dialog
      open={open}
      onClose={onClose}
      className="fixed inset-0 z-40 overflow-y-auto"
    >
      <div className="flex min-h-screen items-center justify-center px-3 py-6 md:px-6">
        <Dialog.Overlay className="fixed inset-0 bg-[rgba(15,20,30,0.46)] backdrop-blur-sm" />

        <div
          className="fixed mx-auto w-full max-w-[calc(100%-16px)] overflow-hidden rounded-[28px] border md:max-w-2xl"
          style={{
            background: 'var(--surface-elevated)',
            borderColor: 'var(--border-subtle)',
            boxShadow: 'var(--shadow-medium)',
          }}
        >
          <div className="p-5 md:p-6">
            <Dialog.Title className="mb-2 text-2xl font-bold tracking-[-0.03em] text-[var(--text-primary)]">
              {title}
            </Dialog.Title>
            <Dialog.Description className="mb-5 text-sm leading-6 text-[var(--text-secondary)]">
              {description}
            </Dialog.Description>

            {children}
          </div>

          <div
            className="mt-1 flex gap-2 justify-end border-t px-5 py-4 md:px-6"
            style={{
              background: 'var(--surface-muted)',
              borderColor: 'var(--border-subtle)',
            }}
          >
            {actionElms}
          </div>
        </div>
      </div>
    </Dialog>
  )
}

export default Modal
