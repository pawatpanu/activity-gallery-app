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

type ActivityGalleryActivity = {
  title: string
  relativePath: string
}

type ActivityGalleryRoot = {
  title: string
  path: string
  activities?: ActivityGalleryActivity[]
}

type ActivityGalleryConfigResponse = {
  roots: ActivityGalleryRoot[]
  message?: string
}

type UploadBatch = {
  files: File[]
  label: string
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
const NEW_ACTIVITY_VALUE = '__new_activity__'

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
  const [selectedActivityPath, setSelectedActivityPath] =
    useState<string>(NEW_ACTIVITY_VALUE)
  const [loadingRoots, setLoadingRoots] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)
  const [uploadStage, setUploadStage] = useState('')
  const [uploadSummary, setUploadSummary] = useState('')
  const [activityName, setActivityName] = useState('')
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
          throw new Error(
            data.message || 'Could not load activity gallery config'
          )
        }

        setRoots(data.roots)
        const firstRootPath = data.roots.length > 0 ? data.roots[0].path : ''
        const firstActivityPath =
          data.roots[0]?.activities?.[0]?.relativePath || NEW_ACTIVITY_VALUE

        setSelectedRoot(current => current || firstRootPath)
        setSelectedActivityPath(current =>
          current === NEW_ACTIVITY_VALUE || current ? current : firstActivityPath
        )
      })
      .catch(error => {
        if (abortController.signal.aborted) return
        addMessage(
          t(
            'albums_page.activity_gallery.load_failed.title',
            'โหลดข้อมูลกิจกรรมไม่สำเร็จ'
          ),
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

  useEffect(() => {
    if (!selectedRoot) return

    const matchedRoot = roots.find(root => root.path === selectedRoot)
    const activityPath = matchedRoot?.activities?.[0]?.relativePath
    setSelectedActivityPath(activityPath || NEW_ACTIVITY_VALUE)
  }, [roots, selectedRoot])

  const rootItems = useMemo<DropdownItem[]>(
    () =>
      roots.map(root => ({
        value: root.path,
        label: root.title,
      })),
    [roots]
  )

  const selectedRootConfig = useMemo(
    () => roots.find(root => root.path === selectedRoot),
    [roots, selectedRoot]
  )

  const activityItems = useMemo<DropdownItem[]>(
    () => [
      {
        value: NEW_ACTIVITY_VALUE,
        label: t(
          'albums_page.activity_gallery.activity_selector.new',
          'สร้างกิจกรรมใหม่'
        ),
      },
      ...((selectedRootConfig?.activities || []).map(activity => ({
        value: activity.relativePath,
        label: activity.title,
      })) as DropdownItem[]),
    ],
    [selectedRootConfig?.activities, t]
  )

  const resetForm = () => {
    setActivityName('')
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

    if (!parentAlbumId && !selectedRoot) {
      addMessage(
        t('albums_page.activity_gallery.validation.title', 'ข้อมูลไม่ครบ'),
        t(
          'albums_page.activity_gallery.validation.root_required',
          'กรุณาเลือกคลังหลัก'
        ),
        true
      )
      return
    }

    if (
      !parentAlbumId &&
      selectedActivityPath === NEW_ACTIVITY_VALUE &&
      !activityName.trim()
    ) {
      addMessage(
        t('albums_page.activity_gallery.validation.title', 'ข้อมูลไม่ครบ'),
        t(
          'albums_page.activity_gallery.validation.activity_name_required',
          'กรุณาระบุชื่อกิจกรรม'
        ),
        true
      )
      return
    }

    if (!albumName.trim()) {
      addMessage(
        t('albums_page.activity_gallery.validation.title', 'ข้อมูลไม่ครบ'),
        t(
          'albums_page.activity_gallery.validation.album_name_required',
          'กรุณาระบุชื่ออัลบั้ม'
        ),
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
          activityName:
            !parentAlbumId && selectedActivityPath === NEW_ACTIVITY_VALUE
              ? activityName
              : undefined,
          activityPath:
            !parentAlbumId && selectedActivityPath !== NEW_ACTIVITY_VALUE
              ? selectedActivityPath
              : undefined,
          albumName,
        }),
      })

      const data = (await response.json()) as ActivityGalleryActionResponse
      if (!response.ok || !data.success || !data.relativePath) {
        throw new Error(data.message || 'Could not create album')
      }

      const createdRootPath = data.rootPath || selectedRoot
      const uploadBatches: UploadBatch[] = [
        {
          files: mainImage ? [mainImage] : [],
          label: t(
            'albums_page.activity_gallery.progress.cover',
            'กำลังอัปโหลดรูปหลัก'
          ),
        },
        {
          files: albumImages ? (Array.from(albumImages) as File[]) : [],
          label: t(
            'albums_page.activity_gallery.progress.media',
            'กำลังอัปโหลดรูปภายในอัลบั้ม'
          ),
        },
      ].filter(batch => batch.files.length > 0)

      const totalBytes = uploadBatches.reduce(
        (sum, batch) =>
          sum + batch.files.reduce((acc, file) => acc + file.size, 0),
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
            `กำลังอัปโหลด ${files.length} ไฟล์ ขั้นตอนที่ ${batchIndex + 1} จาก ${uploadBatches.length}`
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
            t(
              'albums_page.activity_gallery.progress.cover',
              'กำลังอัปโหลดรูปหลัก'
            ),
            [mainImage],
            0
          )
        )
        completedBytes += mainImage.size
      }

      if (albumImages && albumImages.length > 0) {
        const files = Array.from(albumImages) as File[]
        await uploadFilesWithProgress(
          createdRootPath,
          data.relativePath,
          files,
          trackBatchProgress(
            t(
              'albums_page.activity_gallery.progress.media',
              'กำลังอัปโหลดรูปภายในอัลบั้ม'
            ),
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
            `อัปโหลดสำเร็จ ${totalFiles} ไฟล์`
          )
        )
      }

      addMessage(
        t(
          'albums_page.activity_gallery.create_success.title',
          'เพิ่มอัลบั้มสำเร็จ'
        ),
        t(
          'albums_page.activity_gallery.create_success.description',
          'สร้างอัลบั้มและเพิ่มรูปภาพเรียบร้อยแล้ว'
        )
      )

      resetForm()
      onClose()
      onCompleted?.()
    } catch (error) {
      addMessage(
        t(
          'albums_page.activity_gallery.create_failed.title',
          'เพิ่มอัลบั้มไม่สำเร็จ'
        ),
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
      title={t('albums_page.activity_gallery.modal.title', 'เพิ่มอัลบั้ม')}
      description={t(
        parentAlbumId
          ? 'albums_page.activity_gallery.modal.description_child'
          : 'albums_page.activity_gallery.modal.description',
        parentAlbumId
          ? `สร้างอัลบั้มใหม่ภายใต้ ${parentAlbumTitle || 'กิจกรรมนี้'} พร้อมเลือกรูปหลักและเพิ่มรูปภายในอัลบั้มได้ในหน้าต่างเดียว`
          : 'สร้างอัลบั้มใหม่ภายใต้กิจกรรม พร้อมเลือกรูปหลักและเพิ่มรูปภายในอัลบั้มได้ในหน้าต่างเดียว'
      )}
      actions={[
        {
          key: 'cancel',
          label: t('general.action.cancel', 'ยกเลิก'),
          onClick: () => {
            if (!submitting) onClose()
          },
          disabled: submitting,
        },
        {
          key: 'create',
          label: t(
            'albums_page.activity_gallery.modal.submit',
            'เพิ่มอัลบั้ม'
          ),
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
                    {t('albums_page.activity_gallery.root.label', 'คลังหลัก')}
                  </span>
                </label>
                <Dropdown
                  id="activity_gallery_modal_root"
                  items={rootItems}
                  selected={selectedRoot}
                  setSelected={setSelectedRoot}
                />
                <p className="field-help">
                  {t(
                    'albums_page.activity_gallery.root.description',
                    'เลือกคลังหลักที่ใช้เก็บกิจกรรมและอัลบั้มของหน่วยงาน'
                  )}
                </p>
              </div>
            )}

            {!parentAlbumId && (
              <>
                <div>
                  <label htmlFor="activity_gallery_modal_activity">
                    <span className="field-label">
                      {t(
                        'albums_page.activity_gallery.activity_selector.label',
                        'เลือกกิจกรรมที่มีอยู่'
                      )}
                    </span>
                  </label>
                  <Dropdown
                    id="activity_gallery_modal_activity"
                    items={activityItems}
                    selected={selectedActivityPath}
                    setSelected={setSelectedActivityPath}
                  />
                </div>

                {selectedActivityPath === NEW_ACTIVITY_VALUE ? (
                  <TextField
                    label={t(
                      'albums_page.activity_gallery.activity_name.label',
                      'ชื่อกิจกรรม'
                    )}
                    value={activityName}
                    onChange={event => setActivityName(event.target.value)}
                    placeholder={t(
                      'albums_page.activity_gallery.activity_name.placeholder',
                      'เช่น สงกรานต์ 2569, ประชุมวิชาการ, กีฬาสี'
                    )}
                    fullWidth
                  />
                ) : null}

                <p className="field-help">
                  {t(
                    'albums_page.activity_gallery.activity_name.description',
                    'ชื่อกิจกรรมใช้สำหรับจัดหมวดหมู่อัลบั้มที่เกี่ยวข้องกัน เช่น สงกรานต์ 2569, ประชุมวิชาการ, กีฬาสี'
                  )}
                </p>
              </>
            )}

            <TextField
              label={t(
                'albums_page.activity_gallery.album_name.label',
                'ชื่ออัลบั้ม'
              )}
              value={albumName}
              onChange={event => setAlbumName(event.target.value)}
              placeholder={t(
                'albums_page.activity_gallery.album_name.placeholder',
                'เช่น วันแรก, พิธีเปิด, มอบรางวัล'
              )}
              fullWidth
            />

            <label className="block text-sm">
              <span className="field-label">
                {t(
                  'albums_page.activity_gallery.main_image.label',
                  'รูปหลัก'
                )}
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
                {t(
                  'albums_page.activity_gallery.album_images.label',
                  'รูปภายในอัลบั้ม'
                )}
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
                    {uploadStage ||
                      t(
                        'albums_page.activity_gallery.progress.default',
                        'กำลังอัปโหลดไฟล์'
                      )}
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
                    className="brand-surface-bg h-full rounded-full transition-all duration-200"
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
                'ยังไม่มีคลังหลักที่ผู้ใช้คนปัจจุบันสามารถจัดการได้'
              )}
            </p>
          )
        )}
      </div>
    </Modal>
  )
}

export default ActivityGalleryModal
