import React, { useEffect } from 'react'
import { gql, useQuery, useMutation } from '@apollo/client'
import { useNavigate } from 'react-router-dom'
import { Container } from './loginUtilities'

import {
  INITIAL_SETUP_QUERY,
  login,
  providerAuthEnabled,
  providerAuthStartURL,
} from './loginUtilities'
import { authToken } from '../../helpers/authentication'
import { useTranslation } from 'react-i18next'
import { CheckInitialSetup } from './__generated__/CheckInitialSetup'
import { useForm } from 'react-hook-form'
import { Submit, TextField } from '../../primitives/form/Input'
import MessageBox from '../../primitives/form/MessageBox'
import {
  InitialSetup,
  InitialSetupVariables,
} from './__generated__/InitialSetup'

const initialSetupMutation = gql`
  mutation InitialSetup(
    $username: String!
    $password: String!
    $rootPath: String!
  ) {
    initialSetupWizard(
      username: $username
      password: $password
      rootPath: $rootPath
    ) {
      success
      status
      token
    }
  }
`

type InitialSetupFormData = {
  username: string
  password: string
  rootPath: string
}

const InitialSetupPage = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const {
    register,
    handleSubmit,
    formState: { errors: formErrors },
  } = useForm<InitialSetupFormData>()

  useEffect(() => {
    if (authToken()) navigate('/')
  }, [])

  const { data: initialSetupData } =
    useQuery<CheckInitialSetup>(INITIAL_SETUP_QUERY)

  const notInitialSetup = initialSetupData?.siteInfo?.initialSetup === false

  useEffect(() => {
    if (notInitialSetup) navigate('/')
  }, [notInitialSetup])

  const [authorize, { loading: authorizeLoading, data: authorizationData }] =
    useMutation<InitialSetup, InitialSetupVariables>(initialSetupMutation, {
      onCompleted: data => {
        if (!data.initialSetupWizard) return

        const { success, token } = data.initialSetupWizard
        if (success && token) login(token)
      },
    })

  const signIn = handleSubmit(data => {
    authorize({
      variables: {
        username: data.username,
        password: data.password,
        rootPath: data.rootPath,
      },
    })
  })

  if (authToken() || notInitialSetup) {
    return null
  }

  if (providerAuthEnabled) {
    return (
      <div className="min-h-screen px-4 py-10">
        <Container>
          <div className="floating-surface px-6 py-8 text-center md:px-8">
            <h1 className="mb-4 text-center text-3xl font-extrabold tracking-[-0.04em] text-[var(--text-primary)]">
              {t('login_page.initial_setup.title', 'Initial Setup')}
            </h1>
            <p className="mb-6 text-center text-sm leading-6 text-[var(--text-secondary)]">
              {t(
                'login_page.provider_id.initial_setup',
                'This instance is configured to sign in with Provider ID.'
              )}
            </p>
            <div className="text-center">
              <a
                href={providerAuthStartURL}
                className="inline-flex min-h-[48px] items-center justify-center rounded-[18px] border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-8 py-3 font-semibold text-[var(--text-primary)] transition-all duration-200 hover:-translate-y-[1px] hover:border-[var(--border-strong)]"
              >
                {t('login_page.provider_id.sign_in', 'Sign in with Provider ID')}
              </a>
            </div>
          </div>
        </Container>
      </div>
    )
  }

  let errorMessage = null
  if (authorizationData && !authorizationData?.initialSetupWizard?.success) {
    errorMessage = authorizationData?.initialSetupWizard?.status
  }

  return (
    <div className="min-h-screen px-4 py-10">
      <Container>
        <div className="floating-surface px-5 py-6 md:px-8 md:py-8">
          <h1 className="text-center text-[2.3rem] font-extrabold tracking-[-0.05em] text-[var(--text-primary)]">
            {t('login_page.initial_setup.title', 'Initial Setup')}
          </h1>
          <p className="mx-auto mt-3 max-w-lg text-center text-sm leading-6 text-[var(--text-secondary)]">
            Prepare the gallery workspace, assign the first administrator, and
            connect the initial media root.
          </p>
          <form onSubmit={signIn} className="mx-auto mt-8 max-w-[500px]">
            <TextField
              wrapperClassName="my-4"
              fullWidth
              {...register('username', { required: true })}
              label={t('login_page.field.username', 'Username')}
              error={
                formErrors.username?.type == 'required'
                  ? 'Please enter a username'
                  : undefined
              }
            />
            <TextField
              wrapperClassName="my-4"
              fullWidth
              type="password"
              {...register('password', { required: true })}
              label={t('login_page.field.password', 'Password')}
              error={
                formErrors.password?.type == 'required'
                  ? 'Please enter a password'
                  : undefined
              }
            />
            <TextField
              wrapperClassName="my-4"
              fullWidth
              {...register('rootPath', { required: true })}
              label={t(
                'login_page.initial_setup.field.photo_path.label',
                'Photo path'
              )}
              placeholder={t(
                'login_page.initial_setup.field.photo_path.placeholder',
                '/path/to/photos'
              )}
              error={
                formErrors.rootPath?.type == 'required'
                  ? 'Please enter a photo path'
                  : undefined
              }
            />
            <MessageBox
              type="negative"
              message={errorMessage}
              show={!!errorMessage}
            />
            <Submit className="mt-2 w-full" disabled={authorizeLoading}>
              {t('login_page.initial_setup.field.submit', 'Setup Photoview')}
            </Submit>
          </form>
        </div>
      </Container>
    </div>
  )
}

export default InitialSetupPage
