import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import urlJoin from 'url-join'
import { API_ENDPOINT } from '../../apolloClient'
import { MessageState } from '../messages/Messages'
import { NotificationType } from '../../__generated__/globalTypes'
import Dropdown, { DropdownItem } from '../../primitives/form/Dropdown'
import { TextField } from '../../primitives/form/Input'
import Loader from '../../primitives/Loader'
import Modal from '../../primitives/Modal'

type ActivityGalleryRoot = {
  title: string
  path: string
}

type ActivityGalleryConfigResponse = {
  roots: ActivityGalleryRoot[]
  message?: string
}

type ActivityGalleryActionResponse = {
  success: boolean
  message: string
  relativePath?: string
  files?: string[]
}

type ActivityGalleryModalProps = {
  open: boolean
  onClose(): void
  onCompleted?(): void
}

const ACTIVITY_GALLERY_CONFIG_URL = urlJoin(API_ENDPOINT, '/activity-gallery/config')
const ACTIVITY_GALLERY_CREATE_ALBUM_URL = urlJoin(
  API_ENDPOINT,
  '/activity-gallery/albums'
)
const ACTIVITY_GALLERY_UPLOAD_URL = urlJoin(API_ENDPOINT, '/activity-gallery/upload')

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

const ActivityGalleryModal = ({
  open,
  onClose,
  onCompleted,
}: ActivityGalleryModalProps) => {
  const { t } = useTranslation()
  const [roots, setRoots] = useState<ActivityGalleryRoot[]>([])
  const [selectedRoot, setSelectedRoot] = useState('')
  const [loadingRoots, setLoadingRoots] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [parentPath, setParentPath] = useState('')
  const [albumName, setAlbumName] = useState('')
  const [mainImage, setMainImage] = useState<File | null>(null)
  const [albumImages, setAlbumImages] = useState<FileList | null>(null)
  const mainImageInputRef = useRef<HTMLInputElement>(null)
  const albumImagesInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return

    const abortController = new AbortController()
    setLoadingRoots(true)

    fetch(ACTIVITY_GALLERY_CONFIG_URL, {
      credentials: 'include',
      signal: abortController.signal,
    })
      .then(async response => {
        const data = (await response.json()) as ActivityGalleryConfigResponse
        if (!response.ok) {
          throw new Error(data.message || 'Could not load activity gallery config')
        }

        setRoots(data.roots)
        setSelectedRoot(current =>
          current || (data.roots.length > 0 ? data.roots[0].path : '')
        )
      })
      .catch(error => {
        if (abortController.signal.aborted) return
        addMessage(
          t('albums_page.activity_gallery.load_failed.title', 'Activity gallery error'),
          error.message,
          true
        )
      })
      .finally(() => {
        if (!abortController.signal.aborted) {
          setLoadingRoots(false)
        }
      })

    return () => abortController.abort()
  }, [open, t])

  const rootItems = useMemo<DropdownItem[]>(
    () =>
      roots.map(root => ({
        value: root.path,
        label: `${root.title} (${root.path})`,
      })),
    [roots]
  )

  const resetForm = () => {
    setParentPath('')
    setAlbumName('')
    setMainImage(null)
    setAlbumImages(null)
    if (mainImageInputRef.current) {
      mainImageInputRef.current.value = ''
    }
    if (albumImagesInputRef.current) {
      albumImagesInputRef.current.value = ''
    }
  }

  useEffect(() => {
    if (!open) {
      resetForm()
    }
  }, [open])

  const uploadFiles = async (rootPath: string, albumPath: string, files: File[]) => {
    if (files.length === 0) return

    const formData = new FormData()
    formData.append('rootPath', rootPath)
    formData.append('albumPath', albumPath)
    files.forEach(file => formData.append('files', file))

    const response = await fetch(ACTIVITY_GALLERY_UPLOAD_URL, {
      method: 'POST',
      credentials: 'include',
      body: formData,
    })

    const data = (await response.json()) as ActivityGalleryActionResponse
    if (!response.ok || !data.success) {
      throw new Error(data.message || 'Could not upload files')
    }
  }

  const createAlbum = async () => {
    if (submitting) return

    if (!selectedRoot) {
      addMessage(
        t('albums_page.activity_gallery.validation.title', 'Validation error'),
        t('albums_page.activity_gallery.validation.root_required', 'Please choose a root path'),
        true
      )
      return
    }

    if (!albumName.trim()) {
      addMessage(
        t('albums_page.activity_gallery.validation.title', 'Validation error'),
        t('albums_page.activity_gallery.validation.album_name_required', 'Album name is required'),
        true
      )
      return
    }

    setSubmitting(true)
    try {
      const response = await fetch(ACTIVITY_GALLERY_CREATE_ALBUM_URL, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          rootPath: selectedRoot,
          parentPath,
          albumName,
        }),
      })

      const data = (await response.json()) as ActivityGalleryActionResponse
      if (!response.ok || !data.success || !data.relativePath) {
        throw new Error(data.message || 'Could not create album')
      }

      if (mainImage) {
        await uploadFiles(selectedRoot, data.relativePath, [mainImage])
      }

      if (albumImages && albumImages.length > 0) {
        await uploadFiles(selectedRoot, data.relativePath, Array.from(albumImages))
      }

      addMessage(
        t('albums_page.activity_gallery.create_success.title', 'Album created'),
        t(
          'albums_page.activity_gallery.create_success.description',
          'The album and selected images were added successfully.'
        )
      )

      resetForm()
      onClose()
      onCompleted?.()
    } catch (error) {
      addMessage(
        t('albums_page.activity_gallery.create_failed.title', 'Create album failed'),
        error instanceof Error ? error.message : String(error),
        true
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        if (!submitting) onClose()
      }}
      title={t('albums_page.activity_gallery.modal.title', 'Create album')}
      description={t(
        'albums_page.activity_gallery.modal.description',
        'Create a new album, choose a main image for the cover, and add more images in one step.'
      )}
      actions={[
        {
          key: 'cancel',
          label: t('general.action.cancel', 'Cancel'),
          onClick: () => {
            if (!submitting) onClose()
          },
          disabled: submitting,
        },
        {
          key: 'create',
          label: t('albums_page.activity_gallery.modal.submit', 'Add album'),
          onClick: () => {
            void createAlbum()
          },
          variant: 'positive',
          disabled: submitting || loadingRoots,
        },
      ]}
    >
      <div className="w-[min(92vw,42rem)]">
        <Loader active={loadingRoots} />
        {rootItems.length > 0 ? (
          <div className="flex flex-col gap-3">
            <div>
              <label htmlFor="activity_gallery_modal_root">
                <span className="block text-xs uppercase font-semibold mb-1">
                  {t('albums_page.activity_gallery.root.label', 'Gallery root path')}
                </span>
              </label>
              <Dropdown
                id="activity_gallery_modal_root"
                items={rootItems}
                selected={selectedRoot}
                setSelected={setSelectedRoot}
              />
            </div>

            <TextField
              label={t('albums_page.activity_gallery.parent_path.label', 'Parent path')}
              value={parentPath}
              onChange={event => setParentPath(event.target.value)}
              placeholder={t(
                'albums_page.activity_gallery.parent_path.placeholder',
                'optional parent path, e.g. 2026-04-events'
              )}
              fullWidth
            />

            <TextField
              label={t('albums_page.activity_gallery.album_name.label', 'Album name')}
              value={albumName}
              onChange={event => setAlbumName(event.target.value)}
              placeholder={t(
                'albums_page.activity_gallery.album_name.placeholder',
                'album folder name, e.g. 2026-04-songkran-event'
              )}
              fullWidth
            />

            <label className="block text-sm">
              <span className="block text-xs uppercase font-semibold mb-1">
                {t('albums_page.activity_gallery.main_image.label', 'Main image')}
              </span>
              <input
                ref={mainImageInputRef}
                type="file"
                accept="image/*"
                onChange={event => setMainImage(event.target.files?.[0] ?? null)}
              />
            </label>

            <label className="block text-sm">
              <span className="block text-xs uppercase font-semibold mb-1">
                {t('albums_page.activity_gallery.album_images.label', 'Album images')}
              </span>
              <input
                ref={albumImagesInputRef}
                type="file"
                multiple
                accept="image/*"
                onChange={event => setAlbumImages(event.target.files)}
              />
            </label>
          </div>
        ) : (
          !loadingRoots && (
            <p className="text-sm">
              {t(
                'albums_page.activity_gallery.no_roots',
                'No owned root albums are configured for the current user.'
              )}
            </p>
          )
        )}
      </div>
    </Modal>
  )
}

export default ActivityGalleryModal
