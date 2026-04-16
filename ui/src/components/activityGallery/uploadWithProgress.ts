import urlJoin from 'url-join'
import { API_ENDPOINT } from '../../apolloClient'

export type UploadProgressCallback = (loaded: number, total: number) => void

export type ActivityGalleryActionResponse = {
  success: boolean
  message: string
  relativePath?: string
  rootPath?: string
  activityPath?: string
  files?: string[]
}

export const ACTIVITY_GALLERY_CONFIG_URL = urlJoin(
  API_ENDPOINT,
  '/activity-gallery/config'
)
export const ACTIVITY_GALLERY_CREATE_ALBUM_URL = urlJoin(
  API_ENDPOINT,
  '/activity-gallery/albums'
)
export const ACTIVITY_GALLERY_UPLOAD_URL = urlJoin(
  API_ENDPOINT,
  '/activity-gallery/upload'
)
export const ACTIVITY_GALLERY_ALBUM_UPLOAD_URL = urlJoin(
  API_ENDPOINT,
  '/activity-gallery/albums'
)
export const ACTIVITY_GALLERY_DELETE_MEDIA_URL = urlJoin(
  API_ENDPOINT,
  '/activity-gallery/media'
)

export const uploadFilesWithProgress = (
  rootPath: string,
  albumPath: string,
  files: File[],
  onProgress?: UploadProgressCallback
) =>
  new Promise<ActivityGalleryActionResponse>((resolve, reject) => {
    if (files.length === 0) {
      resolve({
        success: true,
        message: 'No files to upload',
        relativePath: albumPath,
        rootPath,
        files: [],
      })
      return
    }

    const formData = new FormData()
    formData.append('rootPath', rootPath)
    formData.append('albumPath', albumPath)
    files.forEach(file => formData.append('files', file))

    const request = new XMLHttpRequest()
    request.open('POST', ACTIVITY_GALLERY_UPLOAD_URL, true)
    request.withCredentials = true

    request.upload.onprogress = event => {
      if (event.lengthComputable && onProgress) {
        onProgress(event.loaded, event.total)
      }
    }

    request.onerror = () => {
      reject(new Error('Could not upload files'))
    }

    request.onload = () => {
      try {
        const data = JSON.parse(
          request.responseText || '{}'
        ) as ActivityGalleryActionResponse

        if (request.status < 200 || request.status >= 300 || !data.success) {
          reject(new Error(data.message || 'Could not upload files'))
          return
        }

        resolve(data)
      } catch (error) {
        reject(
          error instanceof Error
            ? error
            : new Error('Could not parse upload response')
        )
      }
    }

    request.send(formData)
  })

export const uploadFilesToAlbumWithProgress = (
  albumId: string,
  files: File[],
  onProgress?: UploadProgressCallback
) =>
  new Promise<ActivityGalleryActionResponse>((resolve, reject) => {
    if (files.length === 0) {
      resolve({
        success: true,
        message: 'No files to upload',
        files: [],
      })
      return
    }

    const formData = new FormData()
    files.forEach(file => formData.append('files', file))

    const request = new XMLHttpRequest()
    request.open(
      'POST',
      urlJoin(ACTIVITY_GALLERY_ALBUM_UPLOAD_URL, albumId, 'upload'),
      true
    )
    request.withCredentials = true

    request.upload.onprogress = event => {
      if (event.lengthComputable && onProgress) {
        onProgress(event.loaded, event.total)
      }
    }

    request.onerror = () => {
      reject(new Error('Could not upload files'))
    }

    request.onload = () => {
      try {
        const data = JSON.parse(
          request.responseText || '{}'
        ) as ActivityGalleryActionResponse

        if (request.status < 200 || request.status >= 300 || !data.success) {
          reject(new Error(data.message || 'Could not upload files'))
          return
        }

        resolve(data)
      } catch (error) {
        reject(
          error instanceof Error
            ? error
            : new Error('Could not parse upload response')
        )
      }
    }

    request.send(formData)
  })
