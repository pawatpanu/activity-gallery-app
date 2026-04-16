import React, { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Button, TextField } from '../../primitives/form/Input'
import { MessageContainer } from './SharePage'

type ProtectedTokenEnterPasswordProps = {
  refetchWithPassword(password: string): void
  loading: boolean
}

const PasswordProtectedShare = ({
  refetchWithPassword,
  loading = false,
}: ProtectedTokenEnterPasswordProps) => {
  const { t } = useTranslation()

  const {
    register,
    watch,
    formState: { errors },
    handleSubmit,
  } = useForm()

  const [invalidPassword, setInvalidPassword] = useState(false)

  const onSubmit = () => {
    refetchWithPassword(watch('password') as string)
    setInvalidPassword(true)
  }

  let errorMessage = undefined
  if (invalidPassword && !loading) {
    errorMessage = t(
      'share_page.wrong_password',
      'Wrong password, please try again.'
    )
  } else if (errors.password) {
    errorMessage = t(
      'share_page.protected_share.password_required_error',
      'Password is required'
    )
  }

  return (
    <MessageContainer>
      <h1 className="text-[1.9rem] font-extrabold tracking-[-0.04em] text-[var(--text-primary)]">
        {t('share_page.protected_share.title', 'Protected share')}
      </h1>
      <p className="mb-5 mt-2 text-sm leading-6 text-[var(--text-secondary)]">
        {t(
          'share_page.protected_share.description',
          'This share is protected with a password.'
        )}
      </p>
      <form onSubmit={handleSubmit(onSubmit)} className="control-stack">
        <TextField
          {...register('password', { required: true })}
          label={t('login_page.field.password', 'Password')}
          type="password"
          loading={loading}
          disabled={loading}
          action={handleSubmit(onSubmit)}
          error={errorMessage}
          fullWidth={true}
          sizeVariant="big"
        />
        <Button type="submit" variant="positive" disabled={loading}>
          {t('login_page.field.submit', 'Sign in')}
        </Button>
      </form>
    </MessageContainer>
  )
}

export default PasswordProtectedShare
