import React from 'react'

type MessageBoxProps = {
  message?: string | null
  show?: boolean
  type?: 'neutral' | 'positive' | 'negative'
}

const MessageBox = ({ message, show, type }: MessageBoxProps) => {
  if (!show) return null

  let variant =
    'border-[var(--border-subtle)] bg-[var(--surface-muted)] text-[var(--text-secondary)]'
  if (type == 'positive')
    variant =
      'border-[rgba(74,191,60,0.2)] bg-[var(--success-surface)] text-[#1f7446]'
  if (type == 'negative')
    variant =
      'border-[rgba(217,83,113,0.2)] bg-[var(--danger-surface)] text-[var(--danger-text)]'

  return (
    <div className={`my-4 rounded-[18px] border px-4 py-3 text-sm ${variant}`}>
      {message}
    </div>
  )
}

export default MessageBox
