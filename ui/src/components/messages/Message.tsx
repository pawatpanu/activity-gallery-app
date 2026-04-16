import React from 'react'
import { forwardRef } from 'react'
import { ReactComponent as DismissIcon } from './icons/dismissIcon.svg'

export type MessageProps = {
  header: string
  content?: string
  children?: React.ReactNode
  onDismiss?(): void
}

const Message = forwardRef(
  (
    { onDismiss, header, children, content }: MessageProps,
    ref: React.ForwardedRef<HTMLDivElement>
  ) => {
    return (
      <div
        ref={ref}
        className="relative min-h-[92px] rounded-[22px] border px-4 py-3 shadow-[var(--shadow-card)]"
        style={{
          background: 'var(--surface-elevated)',
          borderColor: 'var(--border-subtle)',
        }}
      >
        <button
          onClick={onDismiss}
          className="absolute right-3 top-3 rounded-full p-2 text-[var(--text-muted)] transition-colors duration-200 hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)]"
        >
          <DismissIcon className="h-[10px] w-[10px]" />
        </button>
        <h1 className="pr-8 text-sm font-bold text-[var(--text-primary)]">{header}</h1>
        <div className="mt-1 text-sm text-[var(--text-secondary)]">{content}</div>
        {children}
      </div>
    )
  }
)

export default Message
