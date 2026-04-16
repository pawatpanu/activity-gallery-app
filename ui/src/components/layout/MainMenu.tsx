import React from 'react'
import { NavLink } from 'react-router-dom'
import { useQuery, gql } from '@apollo/client'
import { authToken } from '../../helpers/authentication'
import { useTranslation } from 'react-i18next'
import { mapboxEnabledQuery } from '../../__generated__/mapboxEnabledQuery'
import { tailwindClassNames } from '../../helpers/utils'
import { faceDetectionEnabled } from './__generated__/faceDetectionEnabled'

export const MAPBOX_QUERY = gql`
  query mapboxEnabledQuery {
    mapboxToken
  }
`

export const FACE_DETECTION_ENABLED_QUERY = gql`
  query faceDetectionEnabled {
    siteInfo {
      faceDetectionEnabled
    }
  }
`

type MenuButtonProps = {
  to: string
  exact: boolean
  label: string
  caption: string
  accent: string
  icon?: React.ReactNode
}

const MenuButton = ({
  to,
  exact,
  label,
  caption,
  accent,
  icon,
}: MenuButtonProps) => {
  return (
    <NavLink
      to={to}
      end={exact}
      className={({ isActive }) =>
        tailwindClassNames(
          'group block rounded-[20px] outline-none transition-all duration-200 focus:ring-[var(--shadow-focus)]',
          isActive
            ? 'bg-[var(--surface-strong)] border border-[var(--border-subtle)] shadow-[var(--shadow-card)]'
            : 'border border-transparent hover:bg-[rgba(255,255,255,0.48)]'
        )
      }
    >
      {({ isActive }) => (
        <div className="flex items-center gap-3 px-3 py-3 lg:px-4">
          <div
            className={tailwindClassNames(
              'flex h-12 w-12 shrink-0 items-center justify-center rounded-[16px] text-white transition-transform duration-200 lg:h-11 lg:w-11',
              isActive ? 'scale-100 shadow-[0_12px_24px_rgba(22,32,51,0.18)]' : 'group-hover:scale-[1.04]'
            )}
            style={{ background: accent }}
          >
            {icon}
          </div>
          <div className="hidden min-w-0 lg:block">
            <div className="text-[0.98rem] font-semibold tracking-[-0.02em] text-[var(--text-primary)]">
              {label}
            </div>
            <div className="truncate text-xs text-[var(--text-muted)]">{caption}</div>
          </div>
        </div>
      )}
    </NavLink>
  )
}

const MenuSeparator = () => (
  <div className="my-4 hidden h-px bg-[linear-gradient(90deg,transparent,rgba(127,139,163,0.26),transparent)] lg:block" />
)

export const MainMenu = () => {
  const { t } = useTranslation()

  const mapboxQuery = authToken()
    ? useQuery<mapboxEnabledQuery>(MAPBOX_QUERY)
    : null
  const faceDetectionEnabledQuery = authToken()
    ? useQuery<faceDetectionEnabled>(FACE_DETECTION_ENABLED_QUERY)
    : null

  const mapboxEnabled = !!mapboxQuery?.data?.mapboxToken
  const faceDetectionEnabled =
    !!faceDetectionEnabledQuery?.data?.siteInfo?.faceDetectionEnabled

  return (
    <div className="fixed inset-x-0 bottom-0 z-30 px-3 pb-3 pt-2 lg:inset-x-auto lg:bottom-auto lg:left-8 lg:top-5 lg:w-[260px] lg:px-0 lg:pb-0 lg:pt-0">
      <div
        className="overflow-hidden rounded-[28px] border px-2 py-2 shadow-[var(--shadow-soft)] lg:px-3 lg:py-4"
        style={{
          background: 'var(--sidebar-bg)',
          borderColor: 'var(--sidebar-border)',
          backdropFilter: 'blur(24px)',
        }}
      >
        <div className="hidden px-3 pb-4 lg:block">
          <div className="text-[0.72rem] font-bold uppercase tracking-[0.24em] text-[var(--text-muted)]">
            Workspace
          </div>
          <div className="mt-2 text-lg font-semibold tracking-[-0.03em] text-[var(--text-primary)]">
            Activity Gallery
          </div>
          <div className="mt-1 text-sm text-[var(--text-secondary)]">
            Curated media collections and albums
          </div>
        </div>
        <ul className="grid grid-cols-4 gap-2 lg:grid-cols-1 lg:gap-1">
          <MenuButton
            to="/timeline"
            exact
            label={t('sidemenu.photos', 'Timeline')}
            caption="Chronological gallery"
            accent="linear-gradient(135deg, #6dc1ff 0%, #4f83ff 100%)"
            icon={
              <svg viewBox="0 0 24 24" fill="white" className="h-6 w-6">
                <path d="M5.62503136,14 L9.60031266,17.978 L5.38724257,24 L2.99995461,24 C1.45289603,24 0.179346174,22.8289699 0.0173498575,21.3249546 L5.62503136,14 Z M15.7557572,10 L24.0173027,21.526562 C23.7684095,22.9323278 22.5405695,24 21.0633614,24 L21.0633614,24 L5.88324257,24 L15.7557572,10 Z" />
              </svg>
            }
          />
          <MenuButton
            to="/albums"
            exact
            label={t('sidemenu.albums', 'Albums')}
            caption="Managed collections"
            accent="linear-gradient(135deg, #ff8f64 0%, #f25076 100%)"
            icon={
              <svg viewBox="0 0 24 24" fill="white" className="h-6 w-6">
                <path d="M19,2 C19.5522847,2 20,2.44771525 20,3 L20,21 C20,21.5522847 19.5522847,22 19,22 L6,22 C4.8954305,22 4,21.1045695 4,20 L4,4 C4,2.8954305 4.8954305,2 6,2 L19,2 Z M14.1465649,9 L10.9177928,13.7443828 L8.72759325,11.2494916 L6,15 L18,15 L14.1465649,9 Z M11,9 C10.4477153,9 10,9.44771525 10,10 C10,10.5522847 10.4477153,11 11,11 C11.5522847,11 12,10.5522847 12,10 C12,9.44771525 11.5522847,9 11,9 Z" />
              </svg>
            }
          />
          {mapboxEnabled ? (
            <MenuButton
              to="/places"
              exact
              label={t('sidemenu.places', 'Places')}
              caption="Location clusters"
              accent="linear-gradient(135deg, #71d68c 0%, #3fb970 100%)"
              icon={
                <svg viewBox="0 0 24 24" fill="white" className="h-6 w-6">
                  <path d="M2.4,3.34740684 C2.47896999,3.34740684 2.55617307,3.37078205 2.62188008,3.41458672 L8,7 L8,21 L2.4452998,17.2968665 C2.16710114,17.1114008 2,16.7991694 2,16.4648162 L2,3.74740684 C2,3.52649294 2.1790861,3.34740684 2.4,3.34740684 Z M14.5,3 L14.5,17 L8.5,21 L8.5,7 L14.5,3 Z M15,3 L21.4961389,6.71207939 C21.8077139,6.89012225 22,7.22146569 22,7.58032254 L22,20.3107281 C22,20.531642 21.8209139,20.7107281 21.6,20.7107281 C21.5303892,20.7107281 21.4619835,20.692562 21.4015444,20.6580254 L15,17 L15,3 Z" />
                </svg>
              }
            />
          ) : null}
          {faceDetectionEnabled ? (
            <MenuButton
              to="/people"
              exact
              label={t('sidemenu.people', 'People')}
              caption="Face groups"
              accent="linear-gradient(135deg, #ffc970 0%, #f6a93c 100%)"
              icon={
                <svg viewBox="0 0 24 24" fill="white" className="h-6 w-6">
                  <path d="M15.713873,14.2127622 C17.4283917,14.8986066 18.9087267,16.0457918 20.0014344,17.5008819 C20,19.1568542 18.6568542,20.5 17,20.5 L7,20.5 C5.34314575,20.5 4,19.1568542 4,17.5 L4.09169034,17.3788798 C5.17486154,15.981491 6.62020934,14.878942 8.28693513,14.2120314 C9.30685583,15.018595 10.5972088,15.5 12,15.5 C13.3092718,15.5 14.5205974,15.0806428 15.5069849,14.3689203 L15.713873,14.2127622 L15.713873,14.2127622 Z M12,4 C15.0375661,4 17.5,6.46243388 17.5,9.5 C17.5,12.5375661 15.0375661,15 12,15 C8.96243388,15 6.5,12.5375661 6.5,9.5 C6.5,6.46243388 8.96243388,4 12,4 Z" />
                </svg>
              }
            />
          ) : null}
          <MenuSeparator />
          <MenuButton
            to="/settings"
            exact
            label={t('sidemenu.settings', 'Settings')}
            caption="Preferences and scanner"
            accent="linear-gradient(135deg, #9cbfd0 0%, #6e92ac 100%)"
            icon={
              <svg viewBox="0 0 24 24" fill="white" className="h-6 w-6">
                <path d="M13.1773557,19.4081222 L13,21 L11,21 L10.8236372,19.4082786 C11.2068889,19.4686524 11.5997836,19.5 12,19.5 C12.400562,19.5 12.7937897,19.4685982 13.1773557,19.4081222 Z M18.0703854,16.4054981 L19.0710678,17.6568542 L17.6568542,19.0710678 L16.4054981,18.0703854 C17.0439038,17.6062707 17.6062707,17.0439038 18.0703854,16.4054981 Z M5.92961463,16.4054981 C6.3937293,17.0439038 6.95609622,17.6062707 7.59450194,18.0703854 L6.34314575,19.0710678 L4.92893219,17.6568542 Z M12,5 C15.0375661,5 17.5,7.46243388 17.5,10.5 C17.5,13.5375661 15.0375661,16 12,16 C8.96243388,16 6.5,13.5375661 6.5,10.5 C6.5,7.46243388 8.96243388,5 12,5 Z M12,8 C10.6192881,8 9.5,9.11928813 9.5,10.5 C9.5,11.8807119 10.6192881,13 12,13 C13.3807119,13 14.5,11.8807119 14.5,10.5 C14.5,9.11928813 13.3807119,8 12,8 Z" />
              </svg>
            }
          />
        </ul>
      </div>
    </div>
  )
}

export default MainMenu
