import { gql } from '@apollo/client'
import React, { useContext } from 'react'
import { Helmet } from 'react-helmet'
import Header from '../header/Header'
import { Authorized } from '../routes/AuthorizedRoute'
import { Sidebar, SidebarContext } from '../sidebar/Sidebar'
import MainMenu from './MainMenu'

export const ADMIN_QUERY = gql`
  query adminQuery {
    myUser {
      admin
    }
  }
`

type LayoutProps = {
  children: React.ReactNode
  title: string
  publicView?: boolean
}

const Layout = ({
  children,
  title,
  publicView = false,
  ...otherProps
}: LayoutProps) => {
  const { pinned, content: sidebarContent } = useContext(SidebarContext)

  return (
    <>
      <Helmet>
        <title>{title ? `${title} - Photoview` : `Photoview`}</title>
      </Helmet>
      <div className="app-shell" {...otherProps} data-testid="Layout">
        <Header />
        {!publicView && (
          <Authorized>
            <MainMenu />
          </Authorized>
        )}
        <div
          className={`${
            publicView ? 'app-content-public' : 'app-content'
          } ${!publicView && pinned && sidebarContent ? 'lg:pr-[428px]' : ''}`}
          id="layout-content"
        >
          <div className="page-wrap">{children}</div>
        </div>
        {!publicView && <Sidebar />}
      </div>
    </>
  )
}

export default Layout
