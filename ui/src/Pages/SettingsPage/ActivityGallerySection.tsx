import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import urlJoin from 'url-join'
import { API_ENDPOINT } from '../../apolloClient'
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

type ActivityGalleryRoot = {
  title: string
  path: string
}

type ActivityGalleryConfigResponse = {
  roots: ActivityGalleryRoot[]
}

type ActivityGalleryActionResponse = {
  success: boolean
  message: string
  relativePath?: string
  files?: string[]
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

const ActivityGallerySection = () => {
  const { t } = useTranslation()
  const [roots, setRoots] = useState<ActivityGalleryRoot[]>([])
  const [selectedRoot, setSelectedRoot] = useState('')
  const [loadingRoots, setLoadingRoots] = useState(true)
  const [creatingAlbum, setCreatingAlbum] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [parentPath, setParentPath] = useState('')
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
          throw new Error(data.message || 'Could not load activity gallery config')
        }

        setRoots(data.roots)
        if (data.roots.length > 0) {
          setSelectedRoot(data.roots[0].path)
        }
      })
      .catch(error => {
        if (abortController.signal.aborted) return
        addMessage(
          t('settings.activity_gallery.load_failed.title', 'Activity gallery error'),
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
  }, [])

  const rootItems = useMemo<DropdownItem[]>(
    () =>
      roots.map(root => ({
        value: root.path,
        label: `${root.title} (${root.path})`,
      })),
    [roots]
  )

  const createAlbum = async () => {
    if (!selectedRoot) {
      addMessage(
        t('settings.activity_gallery.validation.title', 'Validation error'),
        t('settings.activity_gallery.validation.root_required', 'Please choose a root path'),
        true
      )
      return
    }

    if (!albumName.trim()) {
      addMessage(
        t('settings.activity_gallery.validation.title', 'Validation error'),
        t('settings.activity_gallery.validation.album_name_required', 'Album name is required'),
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
          parentPath,
          albumName,
        }),
      })

      const data = (await response.json()) as ActivityGalleryActionResponse
      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Could not create album')
      }

      setUploadAlbumPath(data.relativePath || '')
      setAlbumName('')
      setParentPath('')
      addMessage(
        t('settings.activity_gallery.create_success.title', 'Album created'),
        data.message
      )
    } catch (error) {
      addMessage(
        t('settings.activity_gallery.create_failed.title', 'Create album failed'),
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
        t('settings.activity_gallery.validation.title', 'Validation error'),
        t('settings.activity_gallery.validation.root_required', 'Please choose a root path'),
        true
      )
      return
    }

    if (!uploadAlbumPath.trim()) {
      addMessage(
        t('settings.activity_gallery.validation.title', 'Validation error'),
        t('settings.activity_gallery.validation.album_path_required', 'Album path is required'),
        true
      )
      return
    }

    if (!selectedFiles || selectedFiles.length === 0) {
      addMessage(
        t('settings.activity_gallery.validation.title', 'Validation error'),
        t('settings.activity_gallery.validation.files_required', 'Please choose one or more files'),
        true
      )
      return
    }

    const formData = new FormData()
    formData.append('rootPath', selectedRoot)
    formData.append('albumPath', uploadAlbumPath)
    Array.from(selectedFiles).forEach(file => formData.append('files', file))

    setUploading(true)
    try {
      const response = await fetch(ACTIVITY_GALLERY_UPLOAD_URL, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      })

      const data = (await response.json()) as ActivityGalleryActionResponse
      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Could not upload files')
      }

      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
      setSelectedFiles(null)

      addMessage(
        t('settings.activity_gallery.upload_success.title', 'Upload complete'),
        data.message
      )
    } catch (error) {
      addMessage(
        t('settings.activity_gallery.upload_failed.title', 'Upload failed'),
        error instanceof Error ? error.message : String(error),
        true
      )
    } finally {
      setUploading(false)
    }
  }

  return (
    <div>
      <SectionTitle>
        {t('settings.activity_gallery.title', 'Activity gallery')}
      </SectionTitle>
      <InputLabelDescription>
        {t(
          'settings.activity_gallery.description',
          'Create album folders and upload image files directly into the managed activity gallery media root.'
        )}
      </InputLabelDescription>

      <Loader active={loadingRoots} />

      {rootItems.length > 0 ? (
        <>
          <label htmlFor="activity_gallery_root_field">
            <InputLabelTitle>
              {t('settings.activity_gallery.root.label', 'Gallery root path')}
            </InputLabelTitle>
            <InputLabelDescription>
              {t(
                'settings.activity_gallery.root.description',
                'Choose which owned root path should receive new albums and uploaded files.'
              )}
            </InputLabelDescription>
          </label>
          <Dropdown
            id="activity_gallery_root_field"
            items={rootItems}
            selected={selectedRoot}
            setSelected={setSelectedRoot}
          />

          <div className="mt-4">
            <InputLabelTitle>
              {t('settings.activity_gallery.create.title', 'Create album')}
            </InputLabelTitle>
            <InputLabelDescription>
              {t(
                'settings.activity_gallery.create.description',
                'Create a new folder-based album under the selected root path. Parent path is optional for nested albums.'
              )}
            </InputLabelDescription>
            <div className="flex flex-col gap-2 max-w-2xl">
              <TextField
                aria-label="Album parent path"
                value={parentPath}
                onChange={event => setParentPath(event.target.value)}
                placeholder={t(
                  'settings.activity_gallery.create.parent_placeholder',
                  'optional parent path, e.g. 2026-04-events'
                )}
              />
              <TextField
                aria-label="Album name"
                value={albumName}
                onChange={event => setAlbumName(event.target.value)}
                placeholder={t(
                  'settings.activity_gallery.create.name_placeholder',
                  'album folder name, e.g. 2026-04-songkran-event'
                )}
              />
              <div>
                <Button disabled={creatingAlbum} onClick={createAlbum}>
                  {t('settings.activity_gallery.create.submit', 'Create album')}
                </Button>
              </div>
            </div>
          </div>

          <div className="mt-6">
            <InputLabelTitle>
              {t('settings.activity_gallery.upload.title', 'Upload images')}
            </InputLabelTitle>
            <InputLabelDescription>
              {t(
                'settings.activity_gallery.upload.description',
                'Upload one or more image files into an existing album path under the selected root.'
              )}
            </InputLabelDescription>
            <div className="flex flex-col gap-2 max-w-2xl">
              <TextField
                aria-label="Upload album path"
                value={uploadAlbumPath}
                onChange={event => setUploadAlbumPath(event.target.value)}
                placeholder={t(
                  'settings.activity_gallery.upload.album_placeholder',
                  'album path, e.g. 2026-04-songkran-event'
                )}
              />
              <input
                ref={fileInputRef}
                aria-label="Upload files"
                className="block text-sm"
                type="file"
                multiple
                accept="image/*"
                onChange={event => setSelectedFiles(event.target.files)}
              />
              <div>
                <Button disabled={uploading} onClick={uploadFiles}>
                  {t('settings.activity_gallery.upload.submit', 'Upload files')}
                </Button>
              </div>
            </div>
          </div>
        </>
      ) : (
        !loadingRoots && (
          <InputLabelDescription>
            {t(
              'settings.activity_gallery.no_roots',
              'No owned root albums are configured for the current user.'
            )}
          </InputLabelDescription>
        )
      )}
    </div>
  )
}

export default ActivityGallerySection
