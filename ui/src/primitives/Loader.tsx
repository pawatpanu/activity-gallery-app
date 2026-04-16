import React, { CSSProperties } from 'react'

type LoaderProps = {
  active: boolean
  message?: string
  size?: 'small' | 'default'
  className?: string
  style?: CSSProperties
}

const Loader = ({ active, message, className, style }: LoaderProps) => {
  if (!active) return null
  return (
    <div
      className={`inline-flex items-center gap-3 rounded-[18px] border px-4 py-3 text-sm font-medium text-[var(--text-secondary)] shadow-[var(--shadow-card)] ${className ?? ''}`}
      style={{
        background: 'var(--surface-elevated)',
        borderColor: 'var(--border-subtle)',
        ...style,
      }}
    >
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-[rgba(127,139,163,0.3)] border-t-[var(--brand-2)]" />
      {message ?? 'Loading...'}
    </div>
  )
}

export default Loader
