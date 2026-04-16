import React from 'react'
import Layout from '../../components/layout/Layout'
import { useTranslation } from 'react-i18next'
import TimelineGallery from '../../components/timelineGallery/TimelineGallery'

const TimelinePage = () => {
  const { t } = useTranslation()

  return (
    <>
      <Layout title={t('photos_page.title', 'Timeline')}>
        <div className="mb-8">
          <h1 className="page-title">{t('photos_page.title', 'Timeline')}</h1>
          <p className="page-subtitle">
            {t(
              'photos_page.description',
              'Browse recent uploads in a calm, chronological gallery with refined filters and quick visual scanning.'
            )}
          </p>
        </div>
        <TimelineGallery />
      </Layout>
    </>
  )
}

export default TimelinePage
