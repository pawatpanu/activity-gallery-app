import React, { useContext } from 'react'

import { ReactComponent as CloseIcon } from './icons/closeSidebarIcon.svg'
import { ReactComponent as PinIconOutline } from './icons/pinSidebarIconOutline.svg'
import { ReactComponent as PinIconFilled } from './icons/pinSidebarIconFilled.svg'
import { SidebarContext } from './Sidebar'

type SidebarHeaderProps = {
  title: string
}

const SidebarHeader = ({ title }: SidebarHeaderProps) => {
  const { updateSidebar, setPinned, pinned } = useContext(SidebarContext)

  const PinIcon = pinned ? PinIconFilled : PinIconOutline

  return (
    <div
      className="sticky top-0 z-10 flex items-center gap-3 border-b px-3 py-3"
      style={{
        background: 'var(--surface-elevated)',
        borderColor: 'var(--border-subtle)',
        backdropFilter: 'blur(20px)',
      }}
    >
      <button
        className={`${pinned ? 'lg:hidden' : ''} inline-flex h-10 w-10 items-center justify-center rounded-[14px] border border-[var(--border-subtle)] bg-[var(--surface-muted)] text-[var(--text-secondary)] transition-all duration-200 hover:-translate-y-[1px] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]`}
        title="Close sidebar"
        onClick={() => updateSidebar(null)}
      >
        <CloseIcon className="h-4 w-4" />
      </button>
      <span className="flex-grow text-lg font-semibold tracking-[-0.03em] text-[var(--text-primary)]">
        {title}
      </span>
      <button
        className="hidden lg:inline-flex lg:h-10 lg:w-10 lg:items-center lg:justify-center lg:rounded-[14px] lg:border lg:border-[var(--border-subtle)] lg:bg-[var(--surface-muted)] lg:text-[var(--text-secondary)] lg:transition-all lg:duration-200 lg:hover:-translate-y-[1px] lg:hover:border-[var(--border-strong)] lg:hover:text-[var(--text-primary)]"
        title="Pin sidebar"
        onClick={() => setPinned(!pinned)}
      >
        <PinIcon className="h-4 w-4" />
      </button>
    </div>
  )
}

export default SidebarHeader
