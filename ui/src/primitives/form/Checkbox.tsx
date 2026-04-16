import React from 'react'
import classNames from 'classnames'

type CheckboxProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label: string
  className?: string
}

const Checkbox = ({ label, className, ...props }: CheckboxProps) => {
  return (
    <label
      className={classNames(
        'inline-flex cursor-pointer items-center gap-3 rounded-[16px] px-1 py-1 text-sm font-medium text-[var(--text-secondary)] transition-colors duration-200',
        className
      )}
    >
      <input type="checkbox" className="peer sr-only" {...props} />
      <span
        className={classNames(
          'flex h-5 w-5 items-center justify-center rounded-[7px] border transition-all duration-200',
          'border-[var(--border-strong)] bg-[var(--surface-elevated)] shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]',
          'peer-focus:ring-[var(--shadow-focus)] peer-focus:border-[rgba(108,132,255,0.48)]',
          'peer-checked:border-transparent peer-checked:bg-[var(--brand-surface)] peer-disabled:opacity-60'
        )}
      >
        <svg
          viewBox="0 0 14 10"
          className="h-3.5 w-3.5 scale-75 text-white opacity-0 transition-all duration-200 peer-checked:scale-100 peer-checked:opacity-100"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M1 5 4.25 8.25 13 1.5" />
        </svg>
      </span>
      <span className="peer-disabled:opacity-60">{label}</span>
    </label>
  )
}

export default Checkbox
