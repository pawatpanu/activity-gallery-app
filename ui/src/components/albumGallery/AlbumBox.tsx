import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { ProtectedImage } from '../photoGallery/ProtectedMedia'
import { albumQuery_album_subAlbums } from '../../Pages/AlbumPage/__generated__/albumQuery'
import classNames from 'classnames'

interface AlbumBoxImageProps {
  src?: string
}

const AlbumBoxImage = ({ src, ...props }: AlbumBoxImageProps) => {
  const [loaded, setLoaded] = useState(false)

  let image = null
  if (src) {
    image = (
      <ProtectedImage
        className="h-full w-full rounded-[24px] object-cover object-center transition-transform duration-500 group-hover:scale-[1.03]"
        {...props}
        onLoad={() => setLoaded(true)}
        src={src}
      />
    )
  }

  let placeholder = null
  if (!loaded) {
    placeholder = (
      <div className="absolute top-0 h-full w-full animate-pulse rounded-[24px] bg-[var(--surface-muted)]"></div>
    )
  }

  return (
    <div className="relative aspect-[0.98/1] overflow-hidden rounded-[24px] bg-[var(--surface-muted)]">
      {image}
      {placeholder}
    </div>
  )
}

type AlbumBoxProps = {
  album?: albumQuery_album_subAlbums
  customLink?: string
  actions?: React.ReactNode
}

export const AlbumBox = ({
  album,
  customLink,
  actions,
  ...props
}: AlbumBoxProps) => {
  const wrapperClasses =
    'group relative overflow-hidden rounded-[28px] border p-3 text-left transition-all duration-300 hover:-translate-y-1'

  if (album) {
    return (
      <div
        className={classNames(wrapperClasses)}
        style={{
          background: 'var(--surface-strong)',
          borderColor: 'var(--border-subtle)',
          boxShadow: 'var(--shadow-card)',
        }}
        {...props}
      >
        <Link to={customLink || `/album/${album.id}`} className="block">
          <div className="relative overflow-hidden rounded-[24px]">
            <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-16 bg-[linear-gradient(180deg,rgba(15,20,30,0.14),transparent)] opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-24 bg-[linear-gradient(0deg,rgba(15,20,30,0.2),transparent)] opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
            <AlbumBoxImage src={album.thumbnail?.thumbnail?.url} />
          </div>
          <div className="px-1 pb-1 pt-4">
            <div className="mb-1 text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[var(--text-muted)]">
              Album
            </div>
            <p className="overflow-hidden text-ellipsis whitespace-nowrap text-[1.02rem] font-semibold tracking-[-0.02em] text-[var(--text-primary)]">
              {album.title}
            </p>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              Curated media collection
            </p>
          </div>
        </Link>
        {actions ? <div className="mt-1 flex justify-start px-1">{actions}</div> : null}
      </div>
    )
  }

  return (
    <div
      className={wrapperClasses}
      style={{
        background: 'var(--surface-strong)',
        borderColor: 'var(--border-subtle)',
        boxShadow: 'var(--shadow-card)',
      }}
      {...props}
    >
      <AlbumBoxImage />
    </div>
  )
}
