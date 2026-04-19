import React from 'react'
import { useTranslation } from 'react-i18next'
import urlJoin from 'url-join'
import AlbumBoxes from '../../components/albumGallery/AlbumBoxes'
import Layout from '../../components/layout/Layout'
import { useQuery, gql } from '@apollo/client'
import { getMyAlbums, getMyAlbumsVariables } from './__generated__/getMyAlbums'
import useURLParameters from '../../hooks/useURLParameters'
import useOrderingParams from '../../hooks/useOrderingParams'
import AlbumFilter from '../../components/album/AlbumFilter'
import { useIsAdmin } from '../../components/routes/AuthorizedRoute'
import { Button } from '../../primitives/form/Input'
import ActivityGalleryModal from '../../components/activityGallery/ActivityGalleryModal'
import Modal from '../../primitives/Modal'
import { API_ENDPOINT } from '../../apolloClient'
import { MessageState } from '../../components/messages/Messages'
import { NotificationType } from '../../__generated__/globalTypes'

const getAlbumsQuery = gql`
  query getMyAlbums($orderBy: String, $orderDirection: OrderDirection) {
    myAlbums(
      order: { order_by: $orderBy, order_direction: $orderDirection }
      onlyRoot: true
      showEmpty: true
    ) {
      id
      title
      thumbnail {
        id
        thumbnail {
          url
        }
      }
    }
  }
`

const ACTIVITY_GALLERY_DELETE_ALBUM_URL = urlJoin(API_ENDPOINT, '/activity-gallery/albums')

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

const AlbumsPage = () => {
  const { t } = useTranslation()
  const isAdmin = useIsAdmin()
  const [createModalOpen, setCreateModalOpen] = React.useState(false)
  const [albumToDelete, setAlbumToDelete] = React.useState<null | {
    id: string
    title: string
  }>(null)
  const [deletingAlbum, setDeletingAlbum] = React.useState(false)

  const urlParams = useURLParameters()
  const orderParams = useOrderingParams(urlParams, 'updated_at')

  const { error, data, refetch } = useQuery<getMyAlbums, getMyAlbumsVariables>(
    getAlbumsQuery,
    {
      variables: {
        orderBy: orderParams.orderBy,
        orderDirection: orderParams.orderDirection,
      },
    }
  )

  const sortingOptions = React.useMemo(
    () => [
      {
        value: 'updated_at' as const,
        label: t('album_filter.sorting_options.date_imported', 'Date imported'),
      },
      {
        value: 'title' as const,
        label: t('album_filter.sorting_options.title', 'Title'),
      },
    ],
    [t]
  )

  const deleteAlbum = async () => {
    if (!albumToDelete || deletingAlbum) return

    setDeletingAlbum(true)
    try {
      const response = await fetch(
        urlJoin(ACTIVITY_GALLERY_DELETE_ALBUM_URL, albumToDelete.id),
        {
          method: 'DELETE',
          credentials: 'include',
        }
      )

      const data = (await response.json()) as { success?: boolean; message?: string }
      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Could not delete album')
      }

      addMessage(
        t('albums_page.delete.success.title', 'Album deleted'),
        t(
          'albums_page.delete.success.description',
          'The album and its images were removed successfully.'
        )
      )

      setAlbumToDelete(null)
      void refetch()
    } catch (error) {
      addMessage(
        t('albums_page.delete.failed.title', 'Delete album failed'),
        error instanceof Error ? error.message : String(error),
        true
      )
    } finally {
      setDeletingAlbum(false)
    }
  }

  return (
    <Layout title={t('sidemenu.albums', 'อัลบั้ม')}>
      <div className="mb-8">
        <h1 className="page-title">{t('sidemenu.albums', 'อัลบั้ม')}</h1>
      </div>
      <div className="content-toolbar mb-6">
        <AlbumFilter
          onlyFavorites={false}
          ordering={orderParams}
          setOrdering={orderParams.setOrdering}
          sortingOptions={sortingOptions}
        />
        {isAdmin && (
          <div className="toolbar-actions">
            <Button variant="positive" onClick={() => setCreateModalOpen(true)}>
              {t('albums_page.activity_gallery.open_modal', 'เพิ่มอัลบั้ม')}
            </Button>
          </div>
        )}
      </div>
      <AlbumBoxes
        error={error}
        albums={data?.myAlbums}
        renderAlbumActions={
          isAdmin
            ? album => (
                <Button
                  variant="negative"
                  onClick={() => setAlbumToDelete({ id: album.id, title: album.title })}
                >
                  {t('albums_page.delete.action', 'ลบ')}
                </Button>
              )
            : undefined
        }
      />
      {isAdmin && (
        <ActivityGalleryModal
          open={createModalOpen}
          onClose={() => setCreateModalOpen(false)}
          onCompleted={() => {
            void refetch()
          }}
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
    </Layout>
  )
}

export default AlbumsPage
