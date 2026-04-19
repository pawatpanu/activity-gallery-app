import { gql, useLazyQuery } from '@apollo/client'
import React, { useEffect, useContext } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import styled from 'styled-components'
import urlJoin from 'url-join'
import { API_ENDPOINT } from '../../../apolloClient'
import { NotificationType } from '../../../__generated__/globalTypes'
import { authToken } from '../../../helpers/authentication'
import { isNil } from '../../../helpers/utils'
import { MediaType } from '../../../__generated__/globalTypes'
import { MessageState } from '../../messages/Messages'
import { SidebarFacesOverlay } from '../../facesOverlay/FacesOverlay'
import { SidebarContext } from '../Sidebar'
import {
  ProtectedImage,
  ProtectedVideo,
  ProtectedVideoProps_Media,
} from '../../photoGallery/ProtectedMedia'
import { SidebarPhotoCover } from '../AlbumCovers'
import { SidebarPhotoShare } from '../Sharing'
import SidebarMediaDownload from '../SidebarDownloadMedia'
import SidebarHeader from '../SidebarHeader'
import { Button } from '../../../primitives/form/Input'
import Dropdown, { DropdownItem } from '../../../primitives/form/Dropdown'
import { useIsAdmin } from '../../routes/AuthorizedRoute'
import { SidebarSection, SidebarSectionTitle } from '../SidebarComponents'
import { sidebarDownloadQuery_media_downloads } from '../__generated__/sidebarDownloadQuery'
import ExifDetails from './MediaSidebarExif'
import MediaSidebarPeople from './MediaSidebarPeople'
import MediaSidebarMap from './MediaSidebarMap'
import {
  sidebarMediaQuery,
  sidebarMediaQueryVariables,
  sidebarMediaQuery_media_album_path,
  sidebarMediaQuery_media_exif,
  sidebarMediaQuery_media_faces,
  sidebarMediaQuery_media_thumbnail,
  sidebarMediaQuery_media_videoMetadata,
} from './__generated__/sidebarMediaQuery'
import { BreadcrumbList } from '../../album/AlbumTitle'

const ACTIVITY_GALLERY_DELETE_MEDIA_URL = urlJoin(
  API_ENDPOINT,
  '/activity-gallery/media'
)
const ACTIVITY_GALLERY_ALBUMS_URL = urlJoin(
  API_ENDPOINT,
  '/activity-gallery/albums'
)

type ActivityGalleryAlbumOption = {
  id: number
  title: string
  path: string
  depth: number
}

const addMessage = (header: string, content: string, negative = false) => {
  MessageState.add({
    key: Math.random().toString(26),
    type: NotificationType.Message,
    props: {
      header,
      content,
      negative,
      positive: !negative,
    },
  })
}

export const SIDEBAR_MEDIA_QUERY = gql`
  query sidebarMediaQuery($id: ID!) {
    media(id: $id) {
      id
      title
      type
      highRes {
        url
        width
        height
      }
      thumbnail {
        url
        width
        height
      }
      videoWeb {
        url
        width
        height
      }
      videoMetadata {
        id
        width
        height
        duration
        codec
        framerate
        bitrate
        colorProfile
        audio
      }
      exif {
        id
        description
        camera
        maker
        lens
        dateShot
        exposure
        aperture
        iso
        focalLength
        flash
        exposureProgram
        coordinates {
          latitude
          longitude
        }
      }
      album {
        id
        title
        path {
          id
          title
        }
      }
      faces {
        id
        rectangle {
          minX
          maxX
          minY
          maxY
        }
        faceGroup {
          id
          label
          imageFaceCount
        }
        media {
          id
          title
          thumbnail {
            url
            width
            height
          }
        }
      }
    }
  }
`

const PreviewImage = styled(ProtectedImage)`
  position: absolute;
  width: 100%;
  height: 100%;
  top: 0;
  left: 0;
  object-fit: contain;
`

const PreviewVideo = styled(ProtectedVideo)`
  position: absolute;
  width: 100%;
  height: 100%;
  top: 0;
  left: 0;
`

interface PreviewMediaPropsMedia extends ProtectedVideoProps_Media {
  type: MediaType
}

type PreviewMediaProps = {
  media: PreviewMediaPropsMedia
  previewImage?: {
    url: string
  }
}

const PreviewMedia = ({ media, previewImage }: PreviewMediaProps) => {
  if (media.type === MediaType.Photo) {
    return <PreviewImage src={previewImage?.url} />
  }

  if (media.type === MediaType.Video) {
    return <PreviewVideo media={media} />
  }

  return <div>ERROR: Unknown media type: {media.type}</div>
}

type SidebarContentProps = {
  media: MediaSidebarMedia
  hidePreview?: boolean
  onDeleted?(): void
}

const SidebarContent = ({
  media,
  hidePreview,
  onDeleted,
}: SidebarContentProps) => {
  const { updateSidebar } = useContext(SidebarContext)
  const { t } = useTranslation()
  const isAdmin = useIsAdmin()
  const [deleting, setDeleting] = React.useState(false)
  const [moving, setMoving] = React.useState(false)
  const [destinationAlbumId, setDestinationAlbumId] = React.useState('')
  const [albumOptions, setAlbumOptions] = React.useState<
    ActivityGalleryAlbumOption[]
  >([])
  let previewImage = null
  if (media.highRes) previewImage = media.highRes
  else if (media.thumbnail) previewImage = media.thumbnail

  React.useEffect(() => {
    setDestinationAlbumId('')
  }, [media.id])

  const imageAspect =
    previewImage?.width && previewImage?.height
      ? previewImage.height / previewImage.width
      : 3 / 2

  let sidebarMap = null
  const mediaCoordinates = media.exif?.coordinates
  if (mediaCoordinates) {
    sidebarMap = <MediaSidebarMap coordinates={mediaCoordinates} />
  }

  let albumPath = null
  const mediaAlbum = media.album
  if (!isNil(mediaAlbum)) {
    const pathElms = [
      ...[...(mediaAlbum.path ?? [])].reverse(),
      mediaAlbum,
    ].map(album => (
      <li key={album.id} className="inline-block hover:underline">
        <Link
          className="text-blue-900 dark:text-blue-200 hover:underline"
          to={`/album/${album.id}`}
          onClick={() => updateSidebar(null)}
        >
          {album.title}
        </Link>
      </li>
    ))

    albumPath = (
      <div className="mx-4 my-4">
        <h2 className="uppercase text-xs text-gray-900 dark:text-gray-300 font-semibold">
          {t('sidebar.media.album_path', 'Album path')}
        </h2>
        <BreadcrumbList hideLastArrow={true}>{pathElms}</BreadcrumbList>
      </div>
    )
  }

  React.useEffect(() => {
    if (!isAdmin || !authToken()) return

    let cancelled = false
    fetch(ACTIVITY_GALLERY_ALBUMS_URL, {
      credentials: 'include',
    })
      .then(async response => {
        const data = (await response.json()) as {
          albums?: ActivityGalleryAlbumOption[]
          message?: string
        }
        if (!response.ok) {
          throw new Error(data.message || 'Could not load albums')
        }
        if (!cancelled) {
          setAlbumOptions(data.albums || [])
        }
      })
      .catch(error => {
        if (cancelled) return
        addMessage(
          t('sidebar.media.move.load_failed.title', 'Load albums failed'),
          error instanceof Error ? error.message : String(error),
          true
        )
      })

    return () => {
      cancelled = true
    }
  }, [isAdmin, t])

  const deleteMedia = async () => {
    if (deleting) return

    setDeleting(true)
    try {
      const response = await fetch(
        urlJoin(ACTIVITY_GALLERY_DELETE_MEDIA_URL, media.id),
        {
          method: 'DELETE',
          credentials: 'include',
        }
      )

      const data = (await response.json()) as {
        success?: boolean
        message?: string
      }
      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Could not delete media')
      }

      addMessage(
        t('sidebar.media.delete.success.title', 'Photo deleted'),
        t(
          'sidebar.media.delete.success.description',
          'The selected image was removed successfully.'
        )
      )
      updateSidebar(null)
      onDeleted?.()
    } catch (error) {
      addMessage(
        t('sidebar.media.delete.failed.title', 'Delete photo failed'),
        error instanceof Error ? error.message : String(error),
        true
      )
    } finally {
      setDeleting(false)
    }
  }

  const moveMedia = async () => {
    if (moving || !destinationAlbumId) return

    setMoving(true)
    try {
      const response = await fetch(
        urlJoin(ACTIVITY_GALLERY_DELETE_MEDIA_URL, media.id, 'move'),
        {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            destinationAlbumId: Number(destinationAlbumId),
          }),
        }
      )

      const data = (await response.json()) as {
        success?: boolean
        message?: string
      }
      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Could not move media')
      }

      addMessage(
        t('sidebar.media.move.success.title', 'Photo moved'),
        t(
          'sidebar.media.move.success.description',
          'The selected image was moved successfully.'
        )
      )
      updateSidebar(null)
      onDeleted?.()
    } catch (error) {
      addMessage(
        t('sidebar.media.move.failed.title', 'Move photo failed'),
        error instanceof Error ? error.message : String(error),
        true
      )
    } finally {
      setMoving(false)
    }
  }

  const currentAlbumId = media.album?.id ?? ''
  const moveAlbumItems: DropdownItem[] = albumOptions
    .filter(album => String(album.id) !== currentAlbumId)
    .map(album => ({
      value: String(album.id),
      label: `${'\u00a0\u00a0'.repeat(Math.max(album.depth - 1, 0))}${
        album.title
      }`,
    }))

  return (
    <div>
      <SidebarHeader title={media.title ?? 'Loading...'} />
      <div className="lg:mx-4">
        {!hidePreview && (
          <div
            className="w-full h-0 relative"
            style={{ paddingTop: `${Math.min(imageAspect, 0.75) * 100}%` }}
          >
            <PreviewMedia
              previewImage={previewImage || undefined}
              media={media}
            />
            <SidebarFacesOverlay media={media} />
          </div>
        )}
      </div>
      <ExifDetails media={media} />
      {albumPath}
      <MediaSidebarPeople media={media} />
      {sidebarMap}
      <SidebarMediaDownload media={media} />
      <SidebarPhotoShare id={media.id} />
      <div className="mt-8">
        <SidebarPhotoCover cover_id={media.id} />
      </div>
      {isAdmin && (
        <div className="mt-8">
          <SidebarSection>
            <SidebarSectionTitle>
              {t('sidebar.media.management.title', 'Media management')}
            </SidebarSectionTitle>
            {moveAlbumItems.length > 0 && (
              <div className="mb-3">
                <label className="mb-2 block">
                  <span className="field-label">
                    {t('sidebar.media.move.destination', 'Move to album')}
                  </span>
                  <Dropdown
                    className="w-full"
                    items={[
                      {
                        value: '',
                        label: t(
                          'sidebar.media.move.placeholder',
                          'Select destination album'
                        ),
                      },
                      ...moveAlbumItems,
                    ]}
                    selected={destinationAlbumId}
                    setSelected={setDestinationAlbumId}
                    disabled={moving || deleting}
                  />
                </label>
                <Button
                  variant="default"
                  className="w-full"
                  onClick={() => {
                    void moveMedia()
                  }}
                  disabled={!destinationAlbumId || moving || deleting}
                >
                  {t('sidebar.media.move.action', 'Move photo')}
                </Button>
              </div>
            )}
            <Button
              variant="negative"
              className="w-full"
              onClick={() => {
                void deleteMedia()
              }}
              disabled={deleting || moving}
            >
              {t('sidebar.media.delete.action', 'Delete photo')}
            </Button>
          </SidebarSection>
        </div>
      )}
    </div>
  )
}

export interface MediaSidebarMedia {
  __typename: 'Media'
  id: string
  title?: string
  type: MediaType
  highRes?: null | {
    __typename: 'MediaURL'
    url: string
    width?: number
    height?: number
  }
  thumbnail?: sidebarMediaQuery_media_thumbnail | null
  videoWeb?: null | {
    __typename: 'MediaURL'
    url: string
    width?: number
    height?: number
  }
  videoMetadata?: sidebarMediaQuery_media_videoMetadata | null
  exif?: sidebarMediaQuery_media_exif | null
  faces?: sidebarMediaQuery_media_faces[]
  downloads?: sidebarDownloadQuery_media_downloads[]
  album?: {
    __typename: 'Album'
    id: string
    title: string
    path?: sidebarMediaQuery_media_album_path[]
  }
}

type MediaSidebarType = {
  media: MediaSidebarMedia
  hidePreview?: boolean
  onDeleted?(): void
}

const MediaSidebar = ({ media, hidePreview, onDeleted }: MediaSidebarType) => {
  const [loadMedia, { loading, error, data }] = useLazyQuery<
    sidebarMediaQuery,
    sidebarMediaQueryVariables
  >(SIDEBAR_MEDIA_QUERY)

  useEffect(() => {
    if (media != null && authToken()) {
      loadMedia({
        variables: {
          id: media.id,
        },
      })
    }
  }, [media])

  if (!media) return null

  if (!authToken()) {
    return <SidebarContent media={media} hidePreview={hidePreview} onDeleted={onDeleted} />
  }

  if (error) return <div>{error.message}</div>

  if (loading || data == null) {
    return <SidebarContent media={media} hidePreview={hidePreview} onDeleted={onDeleted} />
  }

  return <SidebarContent media={data.media} hidePreview={hidePreview} onDeleted={onDeleted} />
}

export default MediaSidebar
