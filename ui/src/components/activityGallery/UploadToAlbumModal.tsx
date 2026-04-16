import React, { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MessageState } from '../messages/Messages'
import { NotificationType } from '../../__generated__/globalTypes'
import Modal from '../../primitives/Modal'
import {
  uploadFilesToAlbumWithProgress,
} from './uploadWithProgress'

type UploadToAlbumModalProps = {
  open: boolean
  albumId: string
  albumTitle?: string
  onClose(): void
  onCompleted?(): void
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

const UploadToAlbumModal = ({
  open,
  albumId,
  albumTitle,
  onClose,
  onCompleted,
}: UploadToAlbumModalProps) => {
  const { t } = useTranslation()
  const [files, setFiles] = useState<FileList | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)
  const [uploadSummary, setUploadSummary] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const resetState = () => {
    setFiles(null)
    setUploading(false)
    setUploadProgress(null)
    setUploadSummary('')
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const closeModal = () => {
    if (uploading) return
    resetState()
    onClose()
  }

  const uploadFiles = async () => {
    if (uploading) return
    if (!files || files.length === 0) {
      addMessage(
        t('albums_page.media_upload.validation.title', 'Validation error'),
        t(
          'albums_page.media_upload.validation.files_required',
          'Please choose one or more image files.'
        ),
        true
      )
      return
    }

    setUploading(true)
    setUploadProgress(0)
    setUploadSummary(
      t(
        'albums_page.media_upload.progress.summary',
        `${files.length} file(s) ready to upload`
      )
    )
    try {
      await uploadFilesToAlbumWithProgress(albumId, Array.from(files), (loaded, total) => {
        const percent = total ? Math.round((loaded / total) * 100) : 100
        setUploadProgress(percent)
      })

      setUploadProgress(100)
      setUploadSummary(
        t(
          'albums_page.media_upload.progress.completed_summary',
          `${files.length} file(s) uploaded successfully`
        )
      )
      addMessage(
        t('albums_page.media_upload.success.title', 'Upload complete'),
        t(
          'albums_page.media_upload.success.description',
          'New images were added to this album successfully.'
        )
      )
      resetState()
      onClose()
      onCompleted?.()
    } catch (error) {
      addMessage(
        t('albums_page.media_upload.failed.title', 'Upload failed'),
        error instanceof Error ? error.message : String(error),
        true
      )
    } finally {
      setUploading(false)
      setTimeout(() => setUploadProgress(null), 600)
    }
  }

  return (
    <Modal
      open={open}
      onClose={closeModal}
      title={t('albums_page.media_upload.title', 'Upload photos')}
      description={t(
        'albums_page.media_upload.description',
        albumTitle
          ? `Upload one or more images directly into ${albumTitle}.`
          : 'Upload one or more images directly into this album.'
      )}
      actions={[
        {
          key: 'cancel',
          label: t('general.action.cancel', 'Cancel'),
          onClick: () => closeModal(),
          disabled: uploading,
        },
        {
          key: 'upload',
          label: t('albums_page.media_upload.submit', 'Upload files'),
          onClick: () => {
            void uploadFiles()
          },
          variant: 'positive',
          disabled: uploading,
        },
      ]}
    >
      <div className="w-[min(92vw,38rem)]">
        <div className="control-stack">
          <label className="block text-sm">
            <span className="field-label">
              {t('albums_page.media_upload.files_label', 'Album images')}
            </span>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*"
              className="file-picker"
              onChange={event => setFiles(event.target.files)}
            />
          </label>

          {uploading && uploadProgress !== null && (
            <div className="rounded-[18px] border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-4">
              <div className="mb-2 flex items-center justify-between gap-3">
                <div className="text-sm font-semibold text-[var(--text-primary)]">
                  {t('albums_page.media_upload.progress', 'Uploading files')}
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
      </div>
    </Modal>
  )
}

export default UploadToAlbumModal
