import React, { useContext } from 'react'
import { Link } from 'react-router-dom'
import { MediaThumbnail } from '../photoGallery/MediaThumbnail'
import { PhotoFiller } from '../photoGallery/MediaGallery'
import {
  toggleFavoriteAction,
  useMarkFavoriteMutation,
} from '../photoGallery/photoGalleryMutations'
import MediaSidebar from '../sidebar/MediaSidebar/MediaSidebar'
import { SidebarContext } from '../sidebar/Sidebar'
import {
  getActiveTimelineImage,
  openTimelinePresentMode,
  TimelineGalleryAction,
  TimelineGalleryState,
} from './timelineGalleryReducer'

type TimelineGroupAlbumProps = {
  dateIndex: number
  albumIndex: number
  mediaState: TimelineGalleryState
  dispatchMedia: React.Dispatch<TimelineGalleryAction>
}

const TimelineGroupAlbum = ({
  dateIndex,
  albumIndex,
  mediaState,
  dispatchMedia,
}: TimelineGroupAlbumProps) => {
  const {
    media,
    title: albumTitle,
    id: albumID,
  } = mediaState.timelineGroups[dateIndex].albums[albumIndex]

  const [markFavorite] = useMarkFavoriteMutation()

  const { updateSidebar } = useContext(SidebarContext)

  const mediaElms = media.map((media, index) => (
    <MediaThumbnail
      key={media.id}
      media={media}
      selectImage={() => {
        dispatchMedia({
          type: 'selectImage',
          index: {
            album: albumIndex,
            date: dateIndex,
            media: index,
          },
        })
        updateSidebar(<MediaSidebar media={media} />)
      }}
      clickPresent={() => {
        openTimelinePresentMode({
          dispatchMedia,
          activeIndex: {
            album: albumIndex,
            date: dateIndex,
            media: index,
          },
        })
      }}
      clickFavorite={() => {
        toggleFavoriteAction({
          media,
          markFavorite,
        })
      }}
      active={media.id === getActiveTimelineImage({ mediaState })?.id}
    />
  ))

  return (
    <div className="min-w-0 flex-1 rounded-[22px] border p-4" style={{ background: 'var(--surface-elevated)', borderColor: 'var(--border-subtle)' }}>
      <Link to={`/album/${albumID}`} className="inline-flex items-center gap-2 hover:underline">
        <span className="text-sm font-semibold text-[var(--text-secondary)]">
          {albumTitle}
        </span>
      </Link>
      <div className="relative mt-3 flex flex-wrap items-center overflow-hidden">
        {mediaElms}
        <PhotoFiller />
      </div>
    </div>
  )
}

export default TimelineGroupAlbum
