import React from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'
import { useIsAdmin } from '../../components/routes/AuthorizedRoute'
import Layout from '../../components/layout/Layout'
import ActivityGallerySection from './ActivityGallerySection'
import ScannerSection from './ScannerSection'
import UserPreferences from './UserPreferences'
import UsersTable from './Users/UsersTable'
import VersionInfo from './VersionInfo'
import classNames from 'classnames'

type SectionTitleProps = {
  children: string
  nospace?: boolean
}

export const SectionTitle = ({ children, nospace }: SectionTitleProps) => {
  return (
    <h2
      className={classNames(
        'mb-5 border-b pb-3 text-[1.55rem] font-bold tracking-[-0.03em]',
        !nospace && 'mt-6'
      )}
      style={{
        borderColor: 'var(--border-subtle)',
        color: 'var(--text-primary)',
      }}
    >
      {children}
    </h2>
  )
}

export const InputLabelTitle = styled.h3.attrs({
  className: 'mt-5 text-base font-semibold tracking-[-0.02em]',
})``

export const InputLabelDescription = styled.p.attrs({
  className: 'mb-2 text-sm leading-6 text-[var(--text-secondary)]',
})``

const SettingsPage = () => {
  const { t } = useTranslation()
  const isAdmin = useIsAdmin()

  return (
    <Layout title={t('title.settings', 'Settings')}>
      <div className="mb-8">
        <h1 className="page-title">{t('title.settings', 'Settings')}</h1>
      </div>
      <UserPreferences />
      {isAdmin && (
        <>
          <ActivityGallerySection />
          <ScannerSection />
          <UsersTable />
        </>
      )}
      <VersionInfo />
    </Layout>
  )
}

export default SettingsPage
