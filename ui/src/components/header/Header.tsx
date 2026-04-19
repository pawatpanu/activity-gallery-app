import React, { useContext } from 'react'
import SearchBar from './Searchbar'

import { authToken } from '../../helpers/authentication'
import { SidebarContext } from '../sidebar/Sidebar'
import classNames from 'classnames'

const Header = () => {
  const { pinned } = useContext(SidebarContext)

  return (
    <div
      className={classNames(
        'sticky top-0 z-20 px-3 pt-3 md:px-4 lg:px-8 lg:pt-5',
        { 'lg:pr-[428px]': pinned }
      )}
    >
      <div
        className="floating-surface flex w-full items-center justify-between gap-4 px-4 py-3 md:px-5 md:py-4"
      >
        <div className="mr-2 flex min-w-0 items-center gap-3 md:gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white shadow-[0_18px_34px_rgba(0,92,45,0.16)]">
            <img
              className="h-14 w-14 rounded-full object-contain"
              src={import.meta.env.BASE_URL + 'sirattana-hospital-logo.png'}
              alt="Sirattana Hospital logo"
            />
          </div>
          <div className="min-w-0">
            <div className="text-[0.72rem] font-bold uppercase tracking-[0.22em] text-[var(--text-muted)]">
              Premium Gallery
            </div>
            <h1 className="truncate text-xl font-extrabold tracking-[-0.04em] text-[var(--text-primary)] md:text-2xl">
              Photoview
            </h1>
          </div>
        </div>
        {authToken() ? <SearchBar /> : null}
      </div>
    </div>
  )
}

export default Header
