import React from 'react'
import TimelineGroupAlbum from './TimelineGroupAlbum'
import { useTranslation } from 'react-i18next'
import {
  TimelineGalleryAction,
  TimelineGalleryState,
} from './timelineGalleryReducer'

const dateFormatterOptions: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
}

type TimelineGroupDateProps = {
  groupIndex: number
  mediaState: TimelineGalleryState
  dispatchMedia: React.Dispatch<TimelineGalleryAction>
}

const TimelineGroupDate = ({
  groupIndex,
  mediaState,
  dispatchMedia,
}: TimelineGroupDateProps) => {
  const { i18n } = useTranslation()

  const group = mediaState.timelineGroups[groupIndex]

  const albumGroupElms = group.albums.map((album, i) => (
    <TimelineGroupAlbum
      key={`${group.date}_${album.id}`}
      dateIndex={groupIndex}
      albumIndex={i}
      mediaState={mediaState}
      dispatchMedia={dispatchMedia}
    />
  ))

  const dateFormatter = new Intl.DateTimeFormat(
    i18n.language,
    dateFormatterOptions
  )

  const formattedDate = dateFormatter.format(new Date(group.date))

  return (
    <section
      className="rounded-[26px] border p-5 md:p-6"
      style={{
        background: 'var(--surface-strong)',
        borderColor: 'var(--border-subtle)',
        boxShadow: 'var(--shadow-card)',
      }}
    >
      <div className="mb-4 text-[1.25rem] font-bold tracking-[-0.03em] text-[var(--text-primary)]">
        {formattedDate}
      </div>
      <div className="flex flex-wrap gap-4">{albumGroupElms}</div>
    </section>
  )
}

export default TimelineGroupDate
