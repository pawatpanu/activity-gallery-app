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
import {
  ActivityGalleryActionResponse,
  ACTIVITY_GALLERY_CONFIG_URL,
  uploadFilesWithProgress,
} from './uploadWithProgress'

type ActivityGalleryRoot = {
  title: string
  path: string
}

type ActivityGalleryConfigResponse = {
  roots: ActivityGalleryRoot[]
  message?: string
}

type ActivityGalleryModalProps = {
  open: boolean
  onClose(): void
  onCompleted?(): void
  parentAlbumId?: string
  parentAlbumTitle?: string
}

const ACTIVITY_GALLERY_CREATE_ALBUM_URL = urlJoin(
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

const ActivityGalleryModal = ({
  open,
  onClose,
  onCompleted,
  parentAlbumId,
  parentAlbumTitle,
}: ActivityGalleryModalProps) => {
  const { t } = useTranslation()
  const [roots, setRoots] = useState<ActivityGalleryRoot[]>([])
  const [selectedRoot, setSelectedRoot] = useState('')
  const [loadingRoots, setLoadingRoots] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)
  const [uploadStage, setUploadStage] = useState('')
  const [uploadSummary, setUploadSummary] = useState('')
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
    setUploadProgress(null)
    setUploadStage('')
    setUploadSummary('')
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
    setUploadProgress(null)
    setUploadStage('')
    try {
      const targetCreateUrl = parentAlbumId
        ? urlJoin(ACTIVITY_GALLERY_CREATE_ALBUM_URL, parentAlbumId, 'children')
        : ACTIVITY_GALLERY_CREATE_ALBUM_URL

      const response = await fetch(targetCreateUrl, {
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

      const createdRootPath = data.rootPath || selectedRoot
      const uploadBatches = [
        {
          files: mainImage ? [mainImage] : [],
          label: t(
            'albums_page.activity_gallery.progress.cover',
            'Uploading cover image'
          ),
        },
        {
          files: albumImages ? Array.from(albumImages) : [],
          label: t(
            'albums_page.activity_gallery.progress.media',
            'Uploading album images'
          ),
        },
      ].filter(batch => batch.files.length > 0)

      const totalBytes = uploadBatches.reduce(
        (sum, batch) => sum + batch.files.reduce((acc, file) => acc + file.size, 0),
        0
      )
      const totalFiles = uploadBatches.reduce(
        (sum, batch) => sum + batch.files.length,
        0
      )
      let completedBytes = 0

      const trackBatchProgress = (
        stageLabel: string,
        files: File[],
        batchIndex: number
      ) => {
        const batchBytes = files.reduce((acc, file) => acc + file.size, 0)

        setUploadStage(stageLabel)
        setUploadSummary(
          t(
            'albums_page.activity_gallery.progress.summary',
            `${files.length} file(s) in step ${batchIndex + 1} of ${uploadBatches.length}`
          )
        )
        return (loaded: number, total: number) => {
          const effectiveTotal = total || batchBytes || 1
          const normalizedLoaded = Math.min(loaded, effectiveTotal)
          const percent = totalBytes
            ? Math.round(((completedBytes + normalizedLoaded) / totalBytes) * 100)
            : 100
          setUploadProgress(percent)
        }
      }

      if (mainImage) {
        await uploadFilesWithProgress(
          createdRootPath,
          data.relativePath,
          [mainImage],
          trackBatchProgress(
            t('albums_page.activity_gallery.progress.cover', 'Uploading cover image'),
            [mainImage],
            0
          )
        )
        completedBytes += mainImage.size
      }

      if (albumImages && albumImages.length > 0) {
        const files = Array.from(albumImages)
        await uploadFilesWithProgress(
          createdRootPath,
          data.relativePath,
          files,
          trackBatchProgress(
            t('albums_page.activity_gallery.progress.media', 'Uploading album images'),
            files,
            mainImage ? 1 : 0
          )
        )
        completedBytes += files.reduce((acc, file) => acc + file.size, 0)
      }

      if (uploadBatches.length > 0) {
        setUploadProgress(100)
        setUploadSummary(
          t(
            'albums_page.activity_gallery.progress.completed_summary',
            `${totalFiles} file(s) uploaded successfully`
          )
        )
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
        parentAlbumId
          ? 'albums_page.activity_gallery.modal.description_child'
          : 'albums_page.activity_gallery.modal.description',
        parentAlbumId
          ? `Create a new album inside ${parentAlbumTitle || 'this collection'}, choose a main image for the cover, and add more images in one step.`
          : 'Create a new album, choose a main image for the cover, and add more images in one step.'
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
          <div className="control-stack">
            {!parentAlbumId && (
              <div>
                <label htmlFor="activity_gallery_modal_root">
                  <span className="field-label">
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
            )}

            {!parentAlbumId && (
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
            )}

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
              <span className="field-label">
                {t('albums_page.activity_gallery.main_image.label', 'Main image')}
              </span>
              <input
                ref={mainImageInputRef}
                type="file"
                accept="image/*"
                className="file-picker"
                onChange={event => setMainImage(event.target.files?.[0] ?? null)}
              />
            </label>

            <label className="block text-sm">
              <span className="field-label">
                {t('albums_page.activity_gallery.album_images.label', 'Album images')}
              </span>
              <input
                ref={albumImagesInputRef}
                type="file"
                multiple
                accept="image/*"
                className="file-picker"
                onChange={event => setAlbumImages(event.target.files)}
              />
            </label>

            {submitting && uploadProgress !== null && (
              <div className="rounded-[18px] border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-4">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-[var(--text-primary)]">
                    {uploadStage || t('albums_page.activity_gallery.progress.default', 'Uploading files')}
                  </div>
                  <div className="text-sm text-[var(--text-secondary)]">
                    {uploadProgress}%
                  </div>
                </div>
                {uploadSummary ? (
                  <div className="mb-3 text-sm text-[var(--text-secondary)]">
                    {uploadSummary}
                  </div>
                ) : null}
                <div className="h-2 overflow-hidden rounded-full bg-[rgba(127,139,163,0.18)]">
                  <div
                    className="h-full rounded-full bg-[var(--brand-surface)] transition-all duration-200"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}
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
