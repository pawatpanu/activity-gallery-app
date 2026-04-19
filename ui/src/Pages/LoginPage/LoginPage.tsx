import React, { useEffect } from 'react'
import { useQuery, gql, useMutation } from '@apollo/client'
import { useForm } from 'react-hook-form'
import {
  INITIAL_SETUP_QUERY,
  login,
  providerAuthEnabled,
  providerAuthStartURL,
} from './loginUtilities'
import { authToken } from '../../helpers/authentication'

import { useTranslation } from 'react-i18next'
import { Helmet } from 'react-helmet'
import { useNavigate } from 'react-router'
import { Button, TextField } from '../../primitives/form/Input'
import MessageBox from '../../primitives/form/MessageBox'
import { CheckInitialSetup } from './__generated__/CheckInitialSetup'
import { Authorize, AuthorizeVariables } from './__generated__/Authorize'

const authorizeMutation = gql`
  mutation Authorize($username: String!, $password: String!) {
    authorizeUser(username: $username, password: $password) {
      success
      status
      token
    }
  }
`

const LogoHeader = () => {
  const { t } = useTranslation()

  return (
    <div className="mb-10 flex flex-col items-center text-center">
      <div className="brand-surface-bg flex h-24 w-24 items-center justify-center rounded-[28px] shadow-[0_24px_46px_rgba(216,61,103,0.22)]">
        <img
          className="h-16"
          src={import.meta.env.BASE_URL + 'photoview-logo.svg'}
          alt="photoview logo"
        />
      </div>
      <h1 className="mt-6 text-[2.6rem] font-extrabold tracking-[-0.05em] text-[var(--text-primary)]">
        {t('login_page.welcome', 'Welcome to Photoview')}
      </h1>
      <p className="mt-3 max-w-md text-sm leading-6 text-[var(--text-secondary)]">
        A refined workspace for curated albums, timeline browsing, and premium
        media management.
      </p>
    </div>
  )
}

const LoginForm = () => {
  const { t } = useTranslation()
  const {
    register,
    handleSubmit,
    formState: { errors: formErrors },
  } = useForm<LoginInputs>()

  const [authorize, { loading, data }] = useMutation<
    Authorize,
    AuthorizeVariables
  >(authorizeMutation, {
    onCompleted: data => {
      const { success, token } = data.authorizeUser

      if (success && token) {
        login(token)
      }
    },
  })

  const onSubmit = (data: LoginInputs) => {
    authorize({
      variables: {
        username: data.username,
        password: data.password,
      },
    })
  }

  const errorMessage =
    data && !data.authorizeUser.success ? data.authorizeUser.status : null

  return (
    <form
      className="floating-surface mx-auto max-w-[560px] px-5 py-6 md:px-8 md:py-8"
      onSubmit={handleSubmit(onSubmit)}
    >
      {providerAuthEnabled && (
        <a
          href={providerAuthStartURL}
          className="mb-5 flex min-h-[48px] w-full items-center justify-center rounded-[18px] border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-8 py-3 text-center font-semibold text-[var(--text-primary)] transition-all duration-200 hover:-translate-y-[1px] hover:border-[var(--border-strong)]"
        >
          {t('login_page.provider_id.sign_in', 'Sign in with Provider ID')}
        </a>
      )}
      <TextField
        sizeVariant="big"
        wrapperClassName="my-6"
        className="w-full"
        label={t('login_page.field.username', 'Username')}
        {...register('username', { required: true })}
        error={
          formErrors.username?.type == 'required'
            ? 'Please enter a username'
            : undefined
        }
      />
      <TextField
        sizeVariant="big"
        wrapperClassName="my-6"
        className="w-full"
        type="password"
        label={t('login_page.field.password', 'Password')}
        {...register('password')}
      />
      <Button
        className="mt-2 w-full"
        type="submit"
        variant="positive"
        disabled={loading}
      >
        {t('login_page.field.submit', 'Sign in')}
      </Button>
      <MessageBox
        message={errorMessage}
        show={!!errorMessage}
        type="negative"
      />
    </form>
  )
}

type LoginInputs = {
  username: string
  password: string
}

const LoginPage = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const { data: initialSetupData } = useQuery<CheckInitialSetup>(
    INITIAL_SETUP_QUERY,
    { variables: {} }
  )

  useEffect(() => {
    if (authToken()) navigate('/')
  }, [])

  useEffect(() => {
    if (initialSetupData?.siteInfo?.initialSetup && !providerAuthEnabled)
      navigate('/initialSetup')
  }, [initialSetupData?.siteInfo?.initialSetup])

  if (
    authToken() ||
    (initialSetupData?.siteInfo?.initialSetup && !providerAuthEnabled)
  ) {
    return null
  }

  return (
    <>
      <Helmet>
        <title>{t('title.login', 'Login')} - Photoview</title>
      </Helmet>
      <div className="min-h-screen px-4 py-10">
        <LogoHeader />
        <LoginForm />
      </div>
    </>
  )
}

export default LoginPage
