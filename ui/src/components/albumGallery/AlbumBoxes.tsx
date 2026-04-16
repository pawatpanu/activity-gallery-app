import React from 'react'
import { albumQuery_album_subAlbums } from '../../Pages/AlbumPage/__generated__/albumQuery'
import { AlbumBox } from './AlbumBox'

type AlbumBoxesProps = {
  error?: Error
  albums?: albumQuery_album_subAlbums[]
  getCustomLink?(albumID: string): string
  renderAlbumActions?(album: albumQuery_album_subAlbums): React.ReactNode
}

const AlbumBoxes = ({
  error,
  albums,
  getCustomLink,
  renderAlbumActions,
}: AlbumBoxesProps) => {
  if (error)
    return (
      <div className="section-card text-sm text-[var(--danger-text)]">
        Error {error.message}
      </div>
    )

  let albumElements = []

  if (albums !== undefined) {
    if (albums.length === 0) {
      return (
        <div className="section-card flex min-h-[320px] flex-col items-center justify-center text-center">
          <div className="mb-3 rounded-[20px] bg-[var(--surface-muted)] px-4 py-2 text-[0.72rem] font-bold uppercase tracking-[0.22em] text-[var(--text-muted)]">
            Empty library
          </div>
          <h2 className="text-2xl font-bold tracking-[-0.03em] text-[var(--text-primary)]">
            No albums yet
          </h2>
          <p className="mt-3 max-w-md text-sm leading-6 text-[var(--text-secondary)]">
            Create your first album to start organizing cover images, curated collections,
            and shareable gallery content.
          </p>
        </div>
      )
    }

    albumElements = albums.map(album => (
      <AlbumBox
        key={album.id}
        album={album}
        customLink={getCustomLink ? getCustomLink(album.id) : undefined}
        actions={renderAlbumActions ? renderAlbumActions(album) : undefined}
      />
    ))
  } else {
    for (let i = 0; i < 4; i++) {
      albumElements.push(<AlbumBox key={i} />)
    }
  }

  return (
    <div className="my-6 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {albumElements}
    </div>
  )
}

export default AlbumBoxes
