import React, { useEffect, useContext } from 'react'
import { Link } from 'react-router-dom'
import styled from 'styled-components'
import { SidebarContext } from '../sidebar/Sidebar'
import AlbumSidebar from '../sidebar/AlbumSidebar'
import { useLazyQuery, gql } from '@apollo/client'
import { authToken } from '../../helpers/authentication'
import { albumPathQuery } from './__generated__/albumPathQuery'
import useDelay from '../../hooks/useDelay'

import { ReactComponent as GearIcon } from './icons/gear.svg'
import { tailwindClassNames } from '../../helpers/utils'
import { buttonStyles } from '../../primitives/form/Input'

export const BreadcrumbList = styled.ol<{ hideLastArrow?: boolean }>`
  &
    ${({ hideLastArrow }) =>
      hideLastArrow ? 'li:not(:last-child)::after' : 'li::after'} {
    content: '';
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='5px' height='6px' viewBox='0 0 5 6'%3E%3Cpolyline fill='none' stroke='%23979797' points='0.74 0.167710644 3.57228936 3 0.74 5.83228936' /%3E%3C/svg%3E");
    width: 5px;
    height: 6px;
    display: inline-block;
    margin: 6px;
    vertical-align: middle;
  }
`

const ALBUM_PATH_QUERY = gql`
  query albumPathQuery($id: ID!) {
    album(id: $id) {
      id
      path {
        id
        title
      }
    }
  }
`

type AlbumTitleProps = {
  album?: {
    id: string
    title: string
  }
  disableLink: boolean
  actions?: React.ReactNode
}

const AlbumTitle = ({
  album,
  disableLink = false,
  actions,
}: AlbumTitleProps) => {
  const [fetchPath, { data: pathData }] =
    useLazyQuery<albumPathQuery>(ALBUM_PATH_QUERY)
  const { updateSidebar } = useContext(SidebarContext)

  useEffect(() => {
    if (!album) return

    if (authToken() && disableLink == true) {
      fetchPath({
        variables: {
          id: album.id,
        },
      })
    }
  }, [album])

  const delay = useDelay(200, [album])

  if (!album) {
    return (
      <div
        className={`mb-8 flex h-20 flex-col justify-end transition-opacity animate-pulse ${
          delay ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <div className="mb-3 mt-1 h-4 w-32 rounded-full bg-[var(--surface-muted)]"></div>
        <div className="h-8 w-72 rounded-full bg-[var(--surface-muted)]"></div>
      </div>
    )
  }

  let title = <span>{album.title}</span>

  const path = pathData?.album.path || []

  const breadcrumbSections = path
    .slice()
    .reverse()
    .map(x => (
      <li key={x.id} className="inline-block hover:underline">
        <Link to={`/album/${x.id}`}>{x.title}</Link>
      </li>
    ))

  const activityLabel =
    path.length > 0
      ? path[path.length - 1]?.title
      : null

  if (!disableLink) {
    title = <Link to={`/album/${album.id}`}>{title}</Link>
  }

  return (
    <div className="hero-panel mb-8 flex min-h-[112px] items-end justify-between gap-4">
      <div className="min-w-0">
        <div className="mb-2 text-[0.72rem] font-bold uppercase tracking-[0.22em] text-[var(--text-muted)]">
          {activityLabel
            ? `กิจกรรม: ${activityLabel}`
            : 'พื้นที่จัดการอัลบั้ม'}
        </div>
        <nav
          aria-label="Album breadcrumb"
          className="mb-3 text-sm text-[var(--text-secondary)]"
        >
          <BreadcrumbList hideLastArrow>{breadcrumbSections}</BreadcrumbList>
        </nav>
        <h1 className="min-w-0 truncate text-[2.35rem] font-extrabold tracking-[-0.05em] text-[var(--text-primary)] md:text-[2.75rem]">
          {title}
        </h1>
      </div>
      {authToken() && (
        <div className="ml-2 flex flex-wrap items-center gap-2 self-start md:self-end">
          {actions}
          <button
            title="Album options"
            aria-label="Album options"
            className={tailwindClassNames(
              buttonStyles({}),
              'h-[48px] min-w-[48px] px-3 py-3'
            )}
            onClick={() => {
              updateSidebar(<AlbumSidebar albumId={album.id} />)
            }}
          >
            <GearIcon />
          </button>
        </div>
      )}
    </div>
  )
}

export default AlbumTitle
