import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MessageState } from '../../components/messages/Messages'
import { NotificationType } from '../../__generated__/globalTypes'
import Dropdown, { DropdownItem } from '../../primitives/form/Dropdown'
import { Button, TextField } from '../../primitives/form/Input'
import Loader from '../../primitives/Loader'
import {
  InputLabelDescription,
  InputLabelTitle,
  SectionTitle,
} from './SettingsPage'
import {
  ActivityGalleryActionResponse,
  ACTIVITY_GALLERY_CONFIG_URL,
  ACTIVITY_GALLERY_CREATE_ALBUM_URL,
  uploadFilesWithProgress,
} from '../../components/activityGallery/uploadWithProgress'

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
}

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

const ActivityGallerySection = () => {
  const { t } = useTranslation()
  const [roots, setRoots] = useState<ActivityGalleryRoot[]>([])
  const [selectedRoot, setSelectedRoot] = useState('')
  const [selectedActivityPath, setSelectedActivityPath] =
    useState<string>(NEW_ACTIVITY_VALUE)
  const [loadingRoots, setLoadingRoots] = useState(true)
  const [creatingAlbum, setCreatingAlbum] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)
  const [uploadSummary, setUploadSummary] = useState('')
  const [activityName, setActivityName] = useState('')
  const [albumName, setAlbumName] = useState('')
  const [uploadAlbumPath, setUploadAlbumPath] = useState('')
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const abortController = new AbortController()

    fetch(ACTIVITY_GALLERY_CONFIG_URL, {
      credentials: 'include',
      signal: abortController.signal,
    })
      .then(async response => {
        const data = (await response.json()) as ActivityGalleryConfigResponse & {
          message?: string
        }

        if (!response.ok) {
          throw new Error(
            data.message || 'Could not load activity gallery config'
          )
        }

        setRoots(data.roots)
        if (data.roots.length > 0) {
          setSelectedRoot(data.roots[0].path)
          setSelectedActivityPath(
            data.roots[0].activities?.[0]?.relativePath || NEW_ACTIVITY_VALUE
          )
        }
      })
      .catch(error => {
        if (abortController.signal.aborted) return
        addMessage(
          t(
            'settings.activity_gallery.load_failed.title',
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
  }, [t])

  useEffect(() => {
    if (!selectedRoot) return

    const matchedRoot = roots.find(root => root.path === selectedRoot)
    setSelectedActivityPath(
      matchedRoot?.activities?.[0]?.relativePath || NEW_ACTIVITY_VALUE
    )
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
          'settings.activity_gallery.activity_selector.new',
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

  const createAlbum = async () => {
    if (!selectedRoot) {
      addMessage(
        t('settings.activity_gallery.validation.title', 'ข้อมูลไม่ครบ'),
        t(
          'settings.activity_gallery.validation.root_required',
          'กรุณาเลือกคลังหลัก'
        ),
        true
      )
      return
    }

    if (
      selectedActivityPath === NEW_ACTIVITY_VALUE &&
      !activityName.trim()
    ) {
      addMessage(
        t('settings.activity_gallery.validation.title', 'ข้อมูลไม่ครบ'),
        t(
          'settings.activity_gallery.validation.activity_name_required',
          'กรุณาระบุชื่อกิจกรรม'
        ),
        true
      )
      return
    }

    if (!albumName.trim()) {
      addMessage(
        t('settings.activity_gallery.validation.title', 'ข้อมูลไม่ครบ'),
        t(
          'settings.activity_gallery.validation.album_name_required',
          'กรุณาระบุชื่ออัลบั้ม'
        ),
        true
      )
      return
    }

    setCreatingAlbum(true)
    try {
      const response = await fetch(ACTIVITY_GALLERY_CREATE_ALBUM_URL, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          rootPath: selectedRoot,
          activityName:
            selectedActivityPath === NEW_ACTIVITY_VALUE ? activityName : undefined,
          activityPath:
            selectedActivityPath !== NEW_ACTIVITY_VALUE
              ? selectedActivityPath
              : undefined,
          albumName,
        }),
      })

      const data = (await response.json()) as ActivityGalleryActionResponse
      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Could not create album')
      }

      setUploadAlbumPath(data.relativePath || '')
      setUploadProgress(null)
      setUploadSummary('')
      setAlbumName('')
      if (selectedActivityPath === NEW_ACTIVITY_VALUE) {
        setActivityName('')
      }

      addMessage(
        t(
          'settings.activity_gallery.create_success.title',
          'เพิ่มอัลบั้มสำเร็จ'
        ),
        data.message
      )
    } catch (error) {
      addMessage(
        t(
          'settings.activity_gallery.create_failed.title',
          'เพิ่มอัลบั้มไม่สำเร็จ'
        ),
        error instanceof Error ? error.message : String(error),
        true
      )
    } finally {
      setCreatingAlbum(false)
    }
  }

  const uploadFiles = async () => {
    if (!selectedRoot) {
      addMessage(
        t('settings.activity_gallery.validation.title', 'ข้อมูลไม่ครบ'),
        t(
          'settings.activity_gallery.validation.root_required',
          'กรุณาเลือกคลังหลัก'
        ),
        true
      )
      return
    }

    if (!uploadAlbumPath.trim()) {
      addMessage(
        t('settings.activity_gallery.validation.title', 'ข้อมูลไม่ครบ'),
        t(
          'settings.activity_gallery.validation.album_path_required',
          'กรุณาระบุอัลบั้มปลายทาง'
        ),
        true
      )
      return
    }

    if (!selectedFiles || selectedFiles.length === 0) {
      addMessage(
        t('settings.activity_gallery.validation.title', 'ข้อมูลไม่ครบ'),
        t(
          'settings.activity_gallery.validation.files_required',
          'กรุณาเลือกไฟล์รูปอย่างน้อย 1 ไฟล์'
        ),
        true
      )
      return
    }

    setUploading(true)
    setUploadProgress(0)
    setUploadSummary(
      t(
        'settings.activity_gallery.upload.progress_summary',
        `กำลังอัปโหลด ${selectedFiles.length} ไฟล์`
      )
    )

    try {
      const files = Array.from(selectedFiles)
      const data = await uploadFilesWithProgress(
        selectedRoot,
        uploadAlbumPath,
        files,
        (loaded, total) => {
          const percent = total ? Math.round((loaded / total) * 100) : 100
          setUploadProgress(percent)
        }
      )

      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
      setSelectedFiles(null)

      addMessage(
        t('settings.activity_gallery.upload_success.title', 'เพิ่มรูปสำเร็จ'),
        data.message
      )
    } catch (error) {
      addMessage(
        t('settings.activity_gallery.upload_failed.title', 'เพิ่มรูปไม่สำเร็จ'),
        error instanceof Error ? error.message : String(error),
        true
      )
    } finally {
      setUploading(false)
      setTimeout(() => {
        setUploadProgress(null)
        setUploadSummary('')
      }, 600)
    }
  }

  return (
    <div>
      <SectionTitle>
        {t('settings.activity_gallery.title', 'จัดการคลังภาพกิจกรรม')}
      </SectionTitle>
      <div className="section-card">
        <InputLabelDescription>
          {t(
            'settings.activity_gallery.description',
            'สร้างอัลบั้มภายใต้กิจกรรม และอัปโหลดรูปภาพเข้าคลังภาพกิจกรรมได้จากหน้านี้'
          )}
        </InputLabelDescription>

        <Loader active={loadingRoots} />

        {rootItems.length > 0 ? (
          <div className="control-stack">
            <label htmlFor="activity_gallery_root_field">
              <InputLabelTitle>
                {t('settings.activity_gallery.root.label', 'คลังหลัก')}
              </InputLabelTitle>
              <InputLabelDescription>
                {t(
                  'settings.activity_gallery.root.description',
                  'เลือกคลังหลักที่ใช้เก็บกิจกรรมและอัลบั้มของหน่วยงาน'
                )}
              </InputLabelDescription>
            </label>
            <Dropdown
              id="activity_gallery_root_field"
              items={rootItems}
              selected={selectedRoot}
              setSelected={setSelectedRoot}
            />

            <div className="mt-2 grid gap-5 xl:grid-cols-2">
              <div className="rounded-[22px] border border-[var(--border-subtle)] bg-[var(--surface-elevated)] p-5 shadow-[var(--shadow-card)]">
                <InputLabelTitle>
                  {t('settings.activity_gallery.create.title', 'เพิ่มอัลบั้ม')}
                </InputLabelTitle>
                <InputLabelDescription>
                  {t(
                    'settings.activity_gallery.create.description',
                    'กำหนดกิจกรรมก่อน แล้วสร้างอัลบั้มย่อยภายใต้กิจกรรมนั้น'
                  )}
                </InputLabelDescription>
                <div className="control-stack max-w-2xl">
                  <div>
                    <InputLabelTitle>
                      {t(
                        'settings.activity_gallery.activity_selector.label',
                        'เลือกกิจกรรมที่มีอยู่'
                      )}
                    </InputLabelTitle>
                    <Dropdown
                      id="settings_activity_gallery_activity"
                      items={activityItems}
                      selected={selectedActivityPath}
                      setSelected={setSelectedActivityPath}
                    />
                  </div>

                  {selectedActivityPath === NEW_ACTIVITY_VALUE ? (
                    <TextField
                      aria-label="ชื่อกิจกรรม"
                      value={activityName}
                      onChange={event => setActivityName(event.target.value)}
                      placeholder={t(
                        'settings.activity_gallery.create.activity_placeholder',
                        'เช่น สงกรานต์ 2569, ประชุมวิชาการ, กีฬาสี'
                      )}
                    />
                  ) : null}

                  <InputLabelDescription>
                    {t(
                      'settings.activity_gallery.create.activity_description',
                      'ชื่อกิจกรรมใช้สำหรับจัดหมวดหมู่อัลบั้มที่เกี่ยวข้องกัน เช่น สงกรานต์ 2569, ประชุมวิชาการ, กีฬาสี'
                    )}
                  </InputLabelDescription>

                  <TextField
                    aria-label="ชื่ออัลบั้ม"
                    value={albumName}
                    onChange={event => setAlbumName(event.target.value)}
                    placeholder={t(
                      'settings.activity_gallery.create.name_placeholder',
                      'เช่น วันแรก, พิธีเปิด, มอบรางวัล'
                    )}
                  />
                  <div>
                    <Button
                      disabled={creatingAlbum}
                      onClick={createAlbum}
                      variant="positive"
                    >
                      {t(
                        'settings.activity_gallery.create.submit',
                        'เพิ่มอัลบั้ม'
                      )}
                    </Button>
                  </div>
                </div>
              </div>

              <div className="rounded-[22px] border border-[var(--border-subtle)] bg-[var(--surface-elevated)] p-5 shadow-[var(--shadow-card)]">
                <InputLabelTitle>
                  {t('settings.activity_gallery.upload.title', 'เพิ่มรูป')}
                </InputLabelTitle>
                <InputLabelDescription>
                  {t(
                    'settings.activity_gallery.upload.description',
                    'อัปโหลดรูปภาพเข้าอัลบั้มที่มีอยู่ โดยระบุอัลบั้มปลายทางในรูปแบบ กิจกรรม/อัลบั้ม'
                  )}
                </InputLabelDescription>
                <div className="control-stack max-w-2xl">
                  <TextField
                    aria-label="อัลบั้มปลายทาง"
                    value={uploadAlbumPath}
                    onChange={event => setUploadAlbumPath(event.target.value)}
                    placeholder={t(
                      'settings.activity_gallery.upload.album_placeholder',
                      'เช่น สงกรานต์ 2569/วันแรก'
                    )}
                  />
                  <InputLabelDescription>
                    {t(
                      'settings.activity_gallery.upload.album_description',
                      'ระบุชื่อกิจกรรมและชื่ออัลบั้มที่ต้องการเพิ่มรูป เช่น สงกรานต์ 2569/วันแรก'
                    )}
                  </InputLabelDescription>
                  <input
                    ref={fileInputRef}
                    aria-label="Upload files"
                    className="file-picker"
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={event => setSelectedFiles(event.target.files)}
                  />
                  <div>
                    <Button
                      disabled={uploading}
                      onClick={uploadFiles}
                      variant="positive"
                    >
                      {t(
                        'settings.activity_gallery.upload.submit',
                        'เพิ่มรูป'
                      )}
                    </Button>
                  </div>
                  {uploading && uploadProgress !== null && (
                    <div className="rounded-[18px] border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-4">
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <div className="text-sm font-semibold text-[var(--text-primary)]">
                          {t(
                            'settings.activity_gallery.upload.progress',
                            'กำลังอัปโหลดรูป'
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
                          className="h-full rounded-full bg-[var(--brand-surface)] transition-all duration-200"
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          !loadingRoots && (
            <InputLabelDescription>
              {t(
                'settings.activity_gallery.no_roots',
                'ยังไม่มีคลังหลักที่ผู้ใช้คนปัจจุบันสามารถจัดการได้'
              )}
            </InputLabelDescription>
          )
        )}
      </div>
    </div>
  )
}

export default ActivityGallerySection
