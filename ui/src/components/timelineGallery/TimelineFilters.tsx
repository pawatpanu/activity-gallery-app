import { useQuery } from '@apollo/client'
import gql from 'graphql-tag'
import React from 'react'
import { useTranslation } from 'react-i18next'
import Dropdown, { DropdownItem } from '../../primitives/form/Dropdown'
import { FavoriteCheckboxProps, FavoritesCheckbox } from '../album/AlbumFilter'

import { ReactComponent as DateIcon } from './icons/date.svg'
import { earliestMedia } from './__generated__/earliestMedia'

const EARLIEST_MEDIA_QUERY = gql`
  query earliestMedia {
    myMedia(
      order: { order_by: "date_shot", order_direction: ASC }
      paginate: { limit: 1 }
    ) {
      id
      date
    }
  }
`

type DateSelectorProps = {
  filterDate: string | null
  setFilterDate(date: string | null): void
}

const DateSelector = ({ filterDate, setFilterDate }: DateSelectorProps) => {
  const { t } = useTranslation()

  const { data, loading } = useQuery<earliestMedia>(EARLIEST_MEDIA_QUERY)

  let items: DropdownItem[] = [
    {
      value: 'all',
      label: t('timeline_filter.date.dropdown_all', 'From today'),
    },
  ]

  if (data) {
    if (data.myMedia.length != 0) {
      const dateStr = data.myMedia[0].date
      const date = new Date(dateStr)
      const now = new Date()

      const currentYear = now.getFullYear()
      const earliestYear = date.getFullYear()

      const years: number[] = []
      for (let i = currentYear - 1; i >= earliestYear; i--) {
        years.push(i)
      }

      const yearItems = years.map<DropdownItem>(x => ({
        value: `${x}`,
        label: t('timeline_filter.date.dropdown_year', '{{year}} and earlier', {
          year: x,
        }),
      }))
      items = [...items, ...yearItems]
    }
  }

  return (
    <fieldset>
      <legend id="filter_group_date-label" className="field-label">
        <DateIcon
          className="mr-1 inline-block align-baseline"
          aria-hidden="true"
        />
        <span>{t('timeline_filter.date.label', 'Date')}</span>
      </legend>
      <div>
        <Dropdown
          aria-labelledby="filter_group_date-label"
          setSelected={date =>
            date == 'all' ? setFilterDate(null) : setFilterDate(date)
          }
          value={filterDate || 'all'}
          items={items}
          disabled={loading}
          className="min-w-[190px]"
        />
      </div>
    </fieldset>
  )
}

type TimelineFiltersProps = DateSelectorProps & FavoriteCheckboxProps

const TimelineFilters = ({
  onlyFavorites,
  setOnlyFavorites,
  filterDate,
  setFilterDate,
}: TimelineFiltersProps) => {
  return (
    <div className="content-toolbar mb-6">
      <DateSelector filterDate={filterDate} setFilterDate={setFilterDate} />
      <FavoritesCheckbox
        onlyFavorites={onlyFavorites}
        setOnlyFavorites={setOnlyFavorites}
      />
    </div>
  )
}

export default TimelineFilters
