import React, { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import urlJoin from 'url-join'
import { API_ENDPOINT } from '../../apolloClient'
import Loader from '../../primitives/Loader'
import { Button } from '../../primitives/form/Input'
import { InputLabelDescription, SectionTitle } from './SettingsPage'

const ACTIVITY_GALLERY_HEALTH_URL = urlJoin(
  API_ENDPOINT,
  '/activity-gallery/health'
)
const ACTIVITY_GALLERY_DELETE_MEDIA_URL = urlJoin(
  API_ENDPOINT,
  '/activity-gallery/media'
)

type HealthTotals = {
  albumCount: number
  mediaCount: number
  mediaBytes: number
  diskTotalBytes: number
  diskUsedBytes: number
  diskFreeBytes: number
  diskUsagePercent: number
  duplicateGroups: number
  duplicateMediaCount: number
  qualityWarningCount: number
  missingFileCount: number
}

type RootHealth = {
  title: string
  path: string
  albumCount: number
  mediaCount: number
  mediaBytes: number
  directoryBytes: number
  diskTotalBytes: number
  diskUsedBytes: number
  diskFreeBytes: number
  diskUsagePercent: number
}

type MediaNotice = {
  id: number
  title: string
  albumId: number
  albumTitle: string
  albumPath: string
  path: string
  fileSize: number
  width: number
  height: number
}

type DuplicateGroup = {
  key: string
  fileSize: number
  title: string
  media: MediaNotice[]
}

type QualityWarning = MediaNotice & {
  reason: string
}

type HealthResponse = {
  generatedAt: string
  totals: HealthTotals
  roots: RootHealth[]
  duplicateGroups: DuplicateGroup[]
  qualityWarnings: QualityWarning[]
}

const numberFormatter = new Intl.NumberFormat('th-TH')

const formatBytes = (bytes: number) => {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let value = bytes
  let unitIndex = 0
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex += 1
  }
  return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`
}

const formatPercent = (value: number) => `${Math.round(value || 0)}%`

const SystemHealthSection = () => {
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [cleaningIds, setCleaningIds] = useState<number[]>([])
  const [error, setError] = useState('')

  const loadHealth = async (signal?: AbortSignal) => {
    setError('')
    const response = await fetch(ACTIVITY_GALLERY_HEALTH_URL, {
      credentials: 'include',
      signal,
    })
    const data = (await response.json()) as HealthResponse & {
      message?: string
    }

    if (!response.ok) {
      throw new Error(data.message || 'Could not load system health')
    }

    setHealth(data)
  }

  useEffect(() => {
    const abortController = new AbortController()

    loadHealth(abortController.signal)
      .catch(loadError => {
        if (!abortController.signal.aborted) {
          setError(loadError.message)
        }
      })
      .finally(() => {
        if (!abortController.signal.aborted) {
          setLoading(false)
        }
      })

    return () => abortController.abort()
  }, [])

  const statusTone = useMemo(() => {
    if (!health) return 'normal'
    if (
      health.totals.diskUsagePercent >= 90 ||
      health.totals.missingFileCount > 0
    ) {
      return 'danger'
    }
    if (
      health.totals.diskUsagePercent >= 80 ||
      health.totals.duplicateMediaCount > 0 ||
      health.totals.qualityWarningCount > 0
    ) {
      return 'warning'
    }
    return 'normal'
  }, [health])

  const refreshHealth = async () => {
    setRefreshing(true)
    try {
      await loadHealth()
    } catch (loadError) {
      setError((loadError as Error).message)
    } finally {
      setRefreshing(false)
    }
  }

  const deleteMediaIds = async (ids: number[], confirmMessage: string) => {
    const uniqueIds = Array.from(new Set(ids)).filter(Boolean)
    if (uniqueIds.length === 0) return
    if (!window.confirm(confirmMessage)) return

    setCleaningIds(current => [...current, ...uniqueIds])
    setError('')
    try {
      for (const mediaId of uniqueIds) {
        const response = await fetch(
          urlJoin(ACTIVITY_GALLERY_DELETE_MEDIA_URL, mediaId),
          {
            method: 'DELETE',
            credentials: 'include',
          }
        )
        const data = (await response.json()) as {
          success?: boolean
          message?: string
        }
        if (!response.ok || !data.success) {
          throw new Error(data.message || 'Could not delete media')
        }
      }
      await loadHealth()
    } catch (deleteError) {
      setError((deleteError as Error).message)
    } finally {
      setCleaningIds(current =>
        current.filter(mediaId => !uniqueIds.includes(mediaId))
      )
    }
  }

  const deleteDuplicateCopies = (group: DuplicateGroup) => {
    const copyIds = group.media.slice(1).map(media => media.id)
    void deleteMediaIds(
      copyIds,
      `ลบรูปซ้ำ ${copyIds.length} ไฟล์ โดยเก็บไฟล์แรกไว้ใช่ไหม?`
    )
  }

  const deleteQualityWarning = (media: QualityWarning) => {
    void deleteMediaIds(
      [media.id],
      `ลบ "${media.title || media.id}" ใช่ไหม?`
    )
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SectionTitle nospace>สุขภาพระบบ</SectionTitle>
        <Button
          background="white"
          disabled={refreshing}
          onClick={refreshHealth}
          variant="default"
        >
          รีเฟรช
        </Button>
      </div>

      <div className="section-card">
        <Loader active={loading} />

        {error ? (
          <div className="rounded-[18px] border border-[rgba(217,83,113,0.2)] bg-[var(--danger-surface)] p-4 text-sm font-medium text-[var(--danger-text)]">
            {error}
          </div>
        ) : null}

        {health ? (
          <div className="space-y-5">
            <div
              className={
                statusTone === 'danger'
                  ? 'rounded-[20px] border border-[rgba(217,83,113,0.22)] bg-[var(--danger-surface)] p-4'
                  : statusTone === 'warning'
                    ? 'rounded-[20px] border border-[rgba(215,151,58,0.24)] bg-[rgba(255,247,232,0.86)] p-4'
                    : 'rounded-[20px] border border-[var(--border-subtle)] bg-[var(--surface-elevated)] p-4'
              }
            >
              <div className="text-sm font-semibold text-[var(--text-primary)]">
                แจ้งเตือนผู้นำเข้ารูป
              </div>
              <InputLabelDescription>
                {health.totals.duplicateMediaCount > 0 ||
                health.totals.qualityWarningCount > 0 ||
                health.totals.missingFileCount > 0
                  ? 'มีรายการที่ควรตรวจสอบก่อนนำรูปไปใช้งานจริง'
                  : 'ยังไม่พบรายการผิดปกติจากข้อมูลที่ระบบตรวจได้'}
              </InputLabelDescription>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <HealthMetric
                label="พื้นที่คงเหลือ"
                value={formatBytes(health.totals.diskFreeBytes)}
                detail={`ใช้แล้ว ${formatPercent(health.totals.diskUsagePercent)}`}
              />
              <HealthMetric
                label="พื้นที่สื่อในระบบ"
                value={formatBytes(health.totals.mediaBytes)}
                detail={`${numberFormatter.format(health.totals.mediaCount)} ไฟล์`}
              />
              <HealthMetric
                label="รูปซ้ำที่น่าสงสัย"
                value={numberFormatter.format(health.totals.duplicateMediaCount)}
                detail={`${numberFormatter.format(health.totals.duplicateGroups)} กลุ่ม`}
              />
              <HealthMetric
                label="รูปที่ควรตรวจสอบ"
                value={numberFormatter.format(health.totals.qualityWarningCount)}
                detail={
                  health.totals.missingFileCount > 0
                    ? `ไฟล์หาย ${numberFormatter.format(health.totals.missingFileCount)}`
                    : `${numberFormatter.format(health.totals.albumCount)} อัลบั้ม`
                }
              />
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              {health.roots.map(root => (
                <RootHealthCard key={root.path} root={root} />
              ))}
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <NoticeList
                emptyText="ไม่พบรูปซ้ำจากชื่อไฟล์และขนาดไฟล์เดียวกัน"
                items={health.duplicateGroups}
                onDeleteGroup={deleteDuplicateCopies}
                cleaningIds={cleaningIds}
                title="รูปซ้ำที่ควรเคลียร์"
              />
              <QualityList
                emptyText="ไม่พบรูปความละเอียดต่ำ ไฟล์เล็กผิดปกติ หรือไฟล์ต้นฉบับหาย"
                items={health.qualityWarnings}
                onDeleteMedia={deleteQualityWarning}
                cleaningIds={cleaningIds}
                title="รูปไม่ชัด/ข้อมูลไม่ครบ"
              />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}

type HealthMetricProps = {
  label: string
  value: string
  detail: string
}

const HealthMetric = ({ label, value, detail }: HealthMetricProps) => (
  <div className="rounded-[20px] border border-[var(--border-subtle)] bg-[var(--surface-elevated)] p-4">
    <div className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--text-muted)]">
      {label}
    </div>
    <div className="mt-2 text-2xl font-bold text-[var(--text-primary)]">
      {value}
    </div>
    <div className="mt-1 text-sm text-[var(--text-secondary)]">{detail}</div>
  </div>
)

type RootHealthCardProps = {
  root: RootHealth
}

const RootHealthCard = ({ root }: RootHealthCardProps) => (
  <div className="rounded-[20px] border border-[var(--border-subtle)] bg-[var(--surface-elevated)] p-4">
    <div className="flex items-start justify-between gap-3">
      <div>
        <div className="text-base font-bold text-[var(--text-primary)]">
          {root.title}
        </div>
        <div className="mt-1 break-all text-xs text-[var(--text-muted)]">
          {root.path}
        </div>
      </div>
      <div className="text-right text-sm font-semibold text-[var(--text-primary)]">
        {formatPercent(root.diskUsagePercent)}
      </div>
    </div>
    <div className="mt-4 h-2 overflow-hidden rounded-full bg-[rgba(127,139,163,0.18)]">
      <div
        className="brand-surface-bg h-full rounded-full"
        style={{ width: `${Math.min(root.diskUsagePercent || 0, 100)}%` }}
      />
    </div>
    <div className="mt-3 grid gap-2 text-sm text-[var(--text-secondary)] sm:grid-cols-2">
      <div>เหลือ {formatBytes(root.diskFreeBytes)}</div>
      <div>คลังนี้ {formatBytes(root.directoryBytes)}</div>
      <div>{numberFormatter.format(root.mediaCount)} ไฟล์</div>
      <div>{numberFormatter.format(root.albumCount)} อัลบั้ม</div>
    </div>
  </div>
)

type NoticeListProps = {
  title: string
  emptyText: string
  items: DuplicateGroup[]
  onDeleteGroup: (group: DuplicateGroup) => void
  cleaningIds: number[]
}

const NoticeList = ({
  title,
  emptyText,
  items,
  onDeleteGroup,
  cleaningIds,
}: NoticeListProps) => (
  <div className="rounded-[20px] border border-[var(--border-subtle)] bg-[var(--surface-elevated)] p-4">
    <div className="text-base font-bold text-[var(--text-primary)]">
      {title}
    </div>
    {items.length === 0 ? (
      <InputLabelDescription>{emptyText}</InputLabelDescription>
    ) : (
      <div className="mt-3 space-y-3">
        {items.map(group => (
          <div
            className="rounded-[16px] border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-3"
            key={group.key}
          >
            <div className="font-semibold text-[var(--text-primary)]">
              {group.title || 'ไม่มีชื่อ'}
            </div>
            <div className="mt-1 text-sm text-[var(--text-secondary)]">
              {group.media.length} ไฟล์ · {formatBytes(group.fileSize)}
            </div>
            <div className="mt-2 space-y-1">
              {group.media.map(media => (
                <MediaNoticeLink key={media.id} media={media} />
              ))}
            </div>
            <Button
              className="mt-3"
              disabled={group.media
                .slice(1)
                .some(media => cleaningIds.includes(media.id))}
              onClick={() => onDeleteGroup(group)}
              variant="negative"
            >
              ลบสำเนา
            </Button>
          </div>
        ))}
      </div>
    )}
  </div>
)

type QualityListProps = {
  title: string
  emptyText: string
  items: QualityWarning[]
  onDeleteMedia: (media: QualityWarning) => void
  cleaningIds: number[]
}

const QualityList = ({
  title,
  emptyText,
  items,
  onDeleteMedia,
  cleaningIds,
}: QualityListProps) => (
  <div className="rounded-[20px] border border-[var(--border-subtle)] bg-[var(--surface-elevated)] p-4">
    <div className="text-base font-bold text-[var(--text-primary)]">
      {title}
    </div>
    {items.length === 0 ? (
      <InputLabelDescription>{emptyText}</InputLabelDescription>
    ) : (
      <div className="mt-3 space-y-2">
        {items.map(media => (
          <div
            className="rounded-[16px] border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-3"
            key={`${media.reason}-${media.id}`}
          >
            <div className="text-sm font-semibold text-[var(--danger-text)]">
              {media.reason}
            </div>
            <MediaNoticeLink media={media} />
            <div className="mt-1 text-xs text-[var(--text-muted)]">
              {media.width && media.height
                ? `${numberFormatter.format(media.width)} x ${numberFormatter.format(media.height)} px`
                : 'ไม่มีข้อมูลขนาดรูป'}{' '}
              · {formatBytes(media.fileSize)}
            </div>
            <Button
              className="mt-3"
              disabled={cleaningIds.includes(media.id)}
              onClick={() => onDeleteMedia(media)}
              variant="negative"
            >
              ลบรูปนี้
            </Button>
          </div>
        ))}
      </div>
    )}
  </div>
)

type MediaNoticeLinkProps = {
  media: MediaNotice
}

const MediaNoticeLink = ({ media }: MediaNoticeLinkProps) => (
  <Link
    className="block text-sm font-medium text-[var(--text-primary)] hover:text-[var(--brand-primary)]"
    to={`/album/${media.albumId}`}
  >
    {media.albumTitle || media.albumPath} / {media.title || `#${media.id}`}
  </Link>
)

export default SystemHealthSection
