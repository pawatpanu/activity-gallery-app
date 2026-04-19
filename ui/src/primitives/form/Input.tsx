import React, { forwardRef } from 'react'
import classNames, { Argument as ClassNamesArg } from 'classnames'
import { ReactComponent as ActionArrowIcon } from './icons/textboxActionArrow.svg'
import { ReactComponent as LoadingSpinnerIcon } from './icons/textboxLoadingSpinner.svg'
import styled from 'styled-components'
import { tailwindClassNames } from '../../helpers/utils'

type TextFieldProps = {
  label?: string
  error?: string
  className?: ClassNamesArg
  wrapperClassName?: ClassNamesArg
  sizeVariant?: 'default' | 'big'
  fullWidth?: boolean
  action?: () => void
  loading?: boolean
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'className'>

export const TextField = forwardRef(
  (
    {
      label,
      error,
      className,
      wrapperClassName,
      sizeVariant,
      fullWidth,
      action,
      loading,
      ...inputProps
    }: TextFieldProps,
    ref: React.ForwardedRef<HTMLInputElement>
  ) => {
    const disabled = !!inputProps.disabled
    sizeVariant = sizeVariant ?? 'default'

    let variant =
      'border-[var(--border-subtle)] bg-[var(--surface-elevated)] text-[var(--text-primary)] shadow-[inset_0_1px_0_rgba(255,255,255,0.35)] hover:border-[var(--border-strong)] focus:border-[rgba(108,132,255,0.48)] focus:ring-[var(--shadow-focus)]'
    if (error)
      variant =
        'border-[rgba(217,83,113,0.28)] bg-[var(--danger-surface)] text-[var(--text-primary)] focus:border-[rgba(217,83,113,0.46)] focus:ring-[0_0_0_4px_rgba(217,83,113,0.16)] placeholder:text-[rgba(185,56,87,0.55)]'

    if (disabled)
      variant =
        'border-[var(--border-subtle)] bg-[var(--surface-muted)] text-[var(--text-muted)] cursor-not-allowed shadow-none'

    let keyUpEvent = undefined
    if (action) {
      keyUpEvent = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (inputProps.onKeyUp) inputProps.onKeyUp(event)

        if (event.key == 'Enter') {
          event.preventDefault()
          action()
        }
      }
    }

    let input = (
      <input
        onKeyUp={keyUpEvent}
        className={classNames(
          'block border focus:outline-none px-4 transition-all duration-200 ease-out',
          'rounded-[18px] placeholder:text-[var(--text-muted)]',
          variant,
          sizeVariant == 'big' ? 'min-h-[52px] py-3 text-base' : 'min-h-[46px] py-2.5 text-[0.95rem]',
          { 'w-full': fullWidth },
          className
        )}
        {...inputProps}
        ref={ref}
      />
    )

    if (loading) {
      input = (
        <div className="relative">
          {input}
          <LoadingSpinnerIcon
            aria-label="Loading"
            className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-[var(--text-muted)]"
          />
        </div>
      )
    } else if (action) {
      input = (
        <div
          className={classNames('relative inline-block', {
            'w-full': fullWidth,
          })}
        >
          {input}
          <button
            disabled={disabled}
            aria-label="Submit"
            className={classNames(
              'absolute top-1/2 right-1.5 -translate-y-1/2 rounded-full p-2 text-[var(--text-muted)] transition-colors duration-200 hover:text-[var(--text-primary)] disabled:text-[var(--text-muted)] disabled:cursor-default'
            )}
            onClick={e => {
              e.preventDefault()
              e.stopPropagation()
              action()
              return false
            }}
          >
            <ActionArrowIcon
              className={classNames(
                sizeVariant == 'big' && 'w-4 h-4'
              )}
            />
          </button>
        </div>
      )
    }

    let errorElm = null
    if (error)
      errorElm = <div className="mt-1.5 text-sm text-[var(--danger-text)]">{error}</div>

    const wrapperClasses = classNames(
      sizeVariant == 'default' && 'text-sm',
      wrapperClassName
    )

    if (label) {
      return (
        <label className={classNames(wrapperClasses, 'block')}>
          <span className="field-label">{label}</span>
          {input}
          {errorElm}
        </label>
      )
    }

    return (
      <div className={wrapperClasses}>
        {input}
        {errorElm}
      </div>
    )
  }
)

type ButtonProps = {
  variant?: 'negative' | 'positive' | 'default'
  background?: 'default' | 'white'
  className?: string
}

export const buttonStyles = ({ variant, background }: ButtonProps) =>
  classNames(
    'inline-flex min-h-[44px] items-center justify-center rounded-[16px] border px-5 py-2.5 text-sm font-semibold tracking-[-0.01em] whitespace-nowrap transition-all duration-200 ease-out focus:outline-none disabled:cursor-not-allowed disabled:opacity-60',
    'border-[var(--border-subtle)] text-[var(--text-primary)] shadow-[0_8px_20px_rgba(22,32,51,0.06)]',
    'hover:-translate-y-[1px] hover:border-[var(--border-strong)]',
    'focus:ring-[var(--shadow-focus)]',
    background == 'white'
      ? 'bg-[var(--surface-elevated)]'
      : 'bg-[var(--surface-strong)]',
    variant == 'negative' &&
      'bg-[var(--danger-surface)] text-[var(--danger-text)] border-[rgba(217,83,113,0.18)] hover:bg-[#b93857] hover:border-[#b93857] hover:text-white',
    variant == 'positive' &&
      'brand-surface-bg border-transparent text-white shadow-[0_18px_34px_rgba(216,61,103,0.24)] hover:brightness-105',
    variant == 'default' &&
      'hover:bg-[var(--surface-muted)]'
  )

type SubmitProps = ButtonProps & {
  children: string
  className?: string
}

export const Submit = ({
  className,
  variant,
  background,
  children,
  ...props
}: SubmitProps & React.ButtonHTMLAttributes<HTMLInputElement>) => (
  <input
    className={tailwindClassNames(
      buttonStyles({ variant, background }),
      className
    )}
    type="submit"
    value={children}
    {...props}
  />
)

export const Button = ({
  children,
  variant,
  background,
  className,
  ...props
}: ButtonProps & React.ButtonHTMLAttributes<HTMLButtonElement>) => (
  <button
    className={tailwindClassNames(
      buttonStyles({ variant, background }),
      className
    )}
    {...props}
  >
    {children}
  </button>
)

export const ButtonGroup = styled.div.attrs({ className: 'flex gap-1' })``
