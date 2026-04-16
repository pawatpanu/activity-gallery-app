import classNames from 'classnames'
import React from 'react'
import styled from 'styled-components'

const DropdownStyledSelect = styled.select`
  appearance: none;

  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12px' height='7px' viewBox='0 0 12 7'%3E%3Cpath fill='none' stroke='%237f8ba3' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round' d='M1 1l5 5 5-5'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: center right 16px;
`

export type DropdownItem = {
  value: string
  label: string
}

type DropdownProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
  items: DropdownItem[]
  selected?: string
  setSelected(value: string): void
  className?: string
}

const Dropdown = ({
  items,
  selected,
  setSelected,
  className,
  ...otherProps
}: DropdownProps) => {
  const onChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelected(e.target.value)
    otherProps.onChange && otherProps.onChange(e)
  }

  const options = items.map(({ value, label }) => (
    <option key={value} value={value}>
      {label}
    </option>
  ))

  return (
    <DropdownStyledSelect
      className={classNames(
        'min-h-[46px] rounded-[18px] border px-4 pr-11 text-[0.95rem] text-[var(--text-primary)] focus:outline-none transition-all duration-200 ease-out',
        'bg-[var(--surface-elevated)] border-[var(--border-subtle)] shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]',
        'hover:border-[var(--border-strong)] hover:bg-[var(--surface-strong)]',
        'focus:border-[rgba(108,132,255,0.48)] focus:ring-[var(--shadow-focus)]',
        'disabled:bg-[var(--surface-muted)] disabled:text-[var(--text-muted)] disabled:cursor-default disabled:hover:border-[var(--border-subtle)]',
        className
      )}
      value={selected}
      onChange={onChange}
      {...otherProps}
    >
      {options}
    </DropdownStyledSelect>
  )
}

export default Dropdown
