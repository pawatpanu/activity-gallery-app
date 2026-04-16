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
}

const Layout = ({ children, title, ...otherProps }: LayoutProps) => {
  const { pinned, content: sidebarContent } = useContext(SidebarContext)

  return (
    <>
      <Helmet>
        <title>{title ? `${title} - Photoview` : `Photoview`}</title>
      </Helmet>
      <div className="app-shell" {...otherProps} data-testid="Layout">
        <Header />
        <Authorized>
          <MainMenu />
        </Authorized>
        <div
          className={`app-content ${pinned && sidebarContent ? 'lg:pr-[428px]' : ''}`}
          id="layout-content"
        >
          <div className="page-wrap">{children}</div>
        </div>
        <Sidebar />
      </div>
    </>
  )
}

export default Layout
