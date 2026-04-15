import React from 'react'
import { useTranslation } from 'react-i18next'
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

const AlbumsPage = () => {
  const { t } = useTranslation()
  const isAdmin = useIsAdmin()
  const [createModalOpen, setCreateModalOpen] = React.useState(false)

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

  return (
    <Layout title="Albums">
      <div className="flex flex-wrap gap-4 items-end justify-between">
        <AlbumFilter
          onlyFavorites={false}
          ordering={orderParams}
          setOrdering={orderParams.setOrdering}
          sortingOptions={sortingOptions}
        />
        {isAdmin && (
          <Button variant="positive" onClick={() => setCreateModalOpen(true)}>
            {t('albums_page.activity_gallery.open_modal', 'Add album')}
          </Button>
        )}
      </div>
      <AlbumBoxes error={error} albums={data?.myAlbums} />
      {isAdmin && (
        <ActivityGalleryModal
          open={createModalOpen}
          onClose={() => setCreateModalOpen(false)}
          onCompleted={() => {
            void refetch()
          }}
        />
      )}
    </Layout>
  )
}

export default AlbumsPage
