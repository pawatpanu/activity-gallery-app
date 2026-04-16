import React, { useCallback } from 'react'
import { useQuery, gql } from '@apollo/client'
import AlbumGallery, {
  ALBUM_GALLERY_FRAGMENT,
} from '../../components/albumGallery/AlbumGallery'
import Layout from '../../components/layout/Layout'
import useURLParameters from '../../hooks/useURLParameters'
import useScrollPagination from '../../hooks/useScrollPagination'
import PaginateLoader from '../../components/PaginateLoader'
import { useTranslation } from 'react-i18next'
import { albumQuery, albumQueryVariables } from './__generated__/albumQuery'
import useOrderingParams from '../../hooks/useOrderingParams'
import { useNavigate, useParams } from 'react-router-dom'
import { isNil } from '../../helpers/utils'
import { useIsAdmin } from '../../components/routes/AuthorizedRoute'
import { Button } from '../../primitives/form/Input'
import ActivityGalleryModal from '../../components/activityGallery/ActivityGalleryModal'
import UploadToAlbumModal from '../../components/activityGallery/UploadToAlbumModal'
import Modal from '../../primitives/Modal'
import urlJoin from 'url-join'
import { API_ENDPOINT } from '../../apolloClient'
import { MessageState } from '../../components/messages/Messages'
import { NotificationType } from '../../__generated__/globalTypes'

const ALBUM_QUERY = gql`
  ${ALBUM_GALLERY_FRAGMENT}

  query albumQuery(
    $id: ID!
    $onlyFavorites: Boolean
    $mediaOrderBy: String
    $orderDirection: OrderDirection
    $limit: Int
    $offset: Int
  ) {
    album(id: $id) {
      ...AlbumGalleryFields
    }
  }
`

let refetchNeededAll = false
let refetchNeededFavorites = false

const ACTIVITY_GALLERY_DELETE_ALBUM_URL = urlJoin(
  API_ENDPOINT,
  '/activity-gallery/albums'
)

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

function AlbumPage() {
  const { id: albumId } = useParams()
  if (isNil(albumId))
    throw new Error('Expected parameter `id` to be defined for AlbumPage')

  const { t } = useTranslation()
  const navigate = useNavigate()
  const isAdmin = useIsAdmin()
  const [createModalOpen, setCreateModalOpen] = React.useState(false)
  const [uploadModalOpen, setUploadModalOpen] = React.useState(false)
  const [albumToDelete, setAlbumToDelete] = React.useState<null | {
    id: string
    title: string
    isCurrentAlbum?: boolean
  }>(null)
  const [deletingAlbum, setDeletingAlbum] = React.useState(false)

  const urlParams = useURLParameters()
  const orderParams = useOrderingParams(urlParams)

  const onlyFavorites = urlParams.getParam('favorites') == '1' ? true : false
  const setOnlyFavorites = (favorites: boolean) =>
    urlParams.setParam('favorites', favorites ? '1' : '0')

  const { loading, error, data, refetch, fetchMore } = useQuery<
    albumQuery,
    albumQueryVariables
  >(ALBUM_QUERY, {
    variables: {
      id: albumId,
      onlyFavorites,
      mediaOrderBy: orderParams.orderBy,
      orderDirection: orderParams.orderDirection,
      offset: 0,
      limit: 200,
    },
  })

  const { containerElem, finished: finishedLoadingMore } =
    useScrollPagination<albumQuery>({
      loading,
      fetchMore,
      data,
      getItems: data => data.album.media,
    })

  const toggleFavorites = useCallback(
    (onlyFavorites: boolean) => {
      if (
        (refetchNeededAll && !onlyFavorites) ||
        (refetchNeededFavorites && onlyFavorites)
      ) {
        refetch({ id: albumId, onlyFavorites: onlyFavorites }).then(() => {
          if (onlyFavorites) {
            refetchNeededFavorites = false
          } else {
            refetchNeededAll = false
          }
          setOnlyFavorites(onlyFavorites)
        })
      } else {
        setOnlyFavorites(onlyFavorites)
      }
    },
    [setOnlyFavorites, refetch]
  )

  const deleteAlbum = async () => {
    if (deletingAlbum || !albumToDelete) return

    setDeletingAlbum(true)
    try {
      const response = await fetch(
        urlJoin(ACTIVITY_GALLERY_DELETE_ALBUM_URL, albumToDelete.id),
        {
          method: 'DELETE',
          credentials: 'include',
        }
      )

      const result = (await response.json()) as {
        success?: boolean
        message?: string
      }

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Could not delete album')
      }

      addMessage(
        t('albums_page.delete.success.title', 'ลบอัลบั้มสำเร็จ'),
        t(
          'albums_page.delete.success.description',
          'ลบอัลบั้มและรูปภาพภายในเรียบร้อยแล้ว'
        )
      )
      if (albumToDelete.isCurrentAlbum) {
        navigate('/albums')
      } else {
        void refetch()
      }
    } catch (error) {
      addMessage(
        t('albums_page.delete.failed.title', 'ลบอัลบั้มไม่สำเร็จ'),
        error instanceof Error ? error.message : String(error),
        true
      )
    } finally {
      setDeletingAlbum(false)
      setAlbumToDelete(null)
    }
  }

  if (error) return <div>Error</div>

  return (
    <Layout
      title={
        data ? data.album.title : t('title.loading_album', 'Loading album')
      }
    >
      <AlbumGallery
        ref={containerElem}
        album={data && data.album}
        loading={loading}
        setOnlyFavorites={toggleFavorites}
        onlyFavorites={onlyFavorites}
        onFavorite={() => (refetchNeededAll = refetchNeededFavorites = true)}
        showFilter
        setOrdering={orderParams.setOrdering}
        ordering={orderParams}
        toolbarActions={
          isAdmin && data?.album ? (
            <>
              <Button
                variant="default"
                onClick={() => setUploadModalOpen(true)}
              >
                {t('albums_page.media_upload.open_modal', 'เพิ่มรูป')}
              </Button>
              <Button
                variant="positive"
                onClick={() => setCreateModalOpen(true)}
              >
                {t('albums_page.activity_gallery.open_modal', 'เพิ่มอัลบั้ม')}
              </Button>
              <Button
                variant="negative"
                onClick={() =>
                  setAlbumToDelete({
                    id: data.album.id,
                    title: data.album.title,
                    isCurrentAlbum: true,
                  })
                }
              >
                {t('albums_page.delete.action', 'ลบ')}
              </Button>
            </>
          ) : null
        }
        onMediaDeleted={() => {
          void refetch()
        }}
        renderSubAlbumActions={
          isAdmin
            ? album => (
                <Button
                  variant="negative"
                  className="min-h-[38px] px-4 py-2 text-[0.82rem]"
                  onClick={() =>
                    setAlbumToDelete({
                      id: album.id,
                      title: album.title,
                    })
                  }
                >
                  {t('albums_page.delete.action', 'ลบ')}
                </Button>
              )
            : undefined
        }
      />
      {isAdmin && data?.album && (
        <ActivityGalleryModal
          open={createModalOpen}
          onClose={() => setCreateModalOpen(false)}
          onCompleted={() => {
            void refetch()
          }}
          parentAlbumId={data.album.id}
          parentAlbumTitle={data.album.title}
        />
      )}
      {isAdmin && data?.album && (
        <UploadToAlbumModal
          open={uploadModalOpen}
          onClose={() => setUploadModalOpen(false)}
          onCompleted={() => {
            void refetch()
          }}
          albumId={data.album.id}
          albumTitle={data.album.title}
        />
      )}
      <Modal
        open={albumToDelete != null}
        onClose={() => {
          if (!deletingAlbum) setAlbumToDelete(null)
        }}
        title={t('albums_page.delete.title', 'ลบอัลบั้ม')}
        description={
          <div>
            {t(
              'albums_page.delete.description',
              'ยืนยันการลบอัลบั้มนี้และรูปภาพทั้งหมดภายในอัลบั้มใช่หรือไม่'
            )}
            {albumToDelete ? (
              <div className="mt-2 font-semibold">{albumToDelete.title}</div>
            ) : null}
          </div>
        }
        actions={[
          {
            key: 'cancel',
            label: t('general.action.cancel', 'ยกเลิก'),
            onClick: () => {
              if (!deletingAlbum) setAlbumToDelete(null)
            },
            disabled: deletingAlbum,
          },
          {
            key: 'delete',
            label: t('albums_page.delete.confirm', 'ลบอัลบั้ม'),
            onClick: () => {
              void deleteAlbum()
            },
            variant: 'negative',
            disabled: deletingAlbum,
          },
        ]}
      />
      <PaginateLoader
        active={!finishedLoadingMore && !loading}
        text={t('general.loading.paginate.media', 'Loading more media')}
      />
    </Layout>
  )
}

export default AlbumPage
