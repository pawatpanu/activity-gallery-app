import React from 'react'
import { authToken } from '../../helpers/authentication'
import { useTranslation } from 'react-i18next'
import { OrderDirection } from '../../__generated__/globalTypes'
import { MediaOrdering, SetOrderingFn } from '../../hooks/useOrderingParams'
import Checkbox from '../../primitives/form/Checkbox'

import { ReactComponent as SortingIcon } from './icons/sorting.svg'
import { ReactComponent as DirectionIcon } from './icons/direction-arrow.svg'

import Dropdown from '../../primitives/form/Dropdown'
import classNames from 'classnames'

export type SortingOptionValue = 'date_shot' | 'updated_at' | 'title' | 'type'
export type SortingOption = { value: SortingOptionValue; label: string }

export type FavoriteCheckboxProps = {
  onlyFavorites: boolean
  setOnlyFavorites(favorites: boolean): void
}

export const FavoritesCheckbox = ({
  onlyFavorites,
  setOnlyFavorites,
}: FavoriteCheckboxProps) => {
  const { t } = useTranslation()

  return (
    <Checkbox
      className="mb-1"
      label={t('album_filter.only_favorites', 'Show only favorites')}
      checked={onlyFavorites}
      onChange={e => setOnlyFavorites(e.target.checked)}
    />
  )
}

type SortingOptionsProps = {
  ordering?: MediaOrdering
  setOrdering?: SetOrderingFn
  items?: SortingOption[]
}

const SortingOptions = ({
  setOrdering,
  ordering,
  items,
}: SortingOptionsProps) => {
  const { t } = useTranslation()

  const changeOrderDirection = () => {
    if (setOrdering && ordering) {
      setOrdering({
        orderDirection:
          ordering.orderDirection === OrderDirection.ASC
            ? OrderDirection.DESC
            : OrderDirection.ASC,
      })
    }
  }

  const changeOrderBy = (value: SortingOptionValue) => {
    if (setOrdering) {
      setOrdering({ orderBy: value })
    }
  }

  const defaultOptions = React.useMemo(
    () => [
      {
        value: 'date_shot',
        label: t('album_filter.sorting_options.date_shot', 'Date shot'),
      },
      {
        value: 'updated_at',
        label: t('album_filter.sorting_options.date_imported', 'Date imported'),
      },
      {
        value: 'title',
        label: t('album_filter.sorting_options.title', 'Title'),
      },
      {
        value: 'type',
        label: t('album_filter.sorting_options.type', 'Kind'),
      },
    ],
    [t]
  )

  const sortingOptions = items ?? defaultOptions

  return (
    <fieldset>
      <legend id="filter_group_sort-label" className="field-label">
        <SortingIcon
          className="mr-1 inline-block align-baseline"
          aria-hidden="true"
        />
        <span>{t('album_filter.sort', 'Sort')}</span>
      </legend>
      <div className="flex items-center gap-2">
        <Dropdown
          aria-labelledby="filter_group_sort-label"
          setSelected={changeOrderBy}
          value={ordering?.orderBy || undefined}
          items={sortingOptions}
          className="min-w-[190px]"
        />
        <button
          title={t('album_filter.sort_direction', 'Sort direction')}
          aria-label={t('album_filter.sort_direction', 'Sort direction')}
          aria-pressed={ordering?.orderDirection === OrderDirection.DESC}
          className={classNames(
            'inline-flex h-[46px] w-[46px] items-center justify-center rounded-[16px] border text-[var(--text-secondary)] transition-all duration-200 focus:outline-none',
            'border-[var(--border-subtle)] bg-[var(--surface-elevated)] hover:-translate-y-[1px] hover:border-[var(--border-strong)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)] focus:ring-[var(--shadow-focus)]',
            { 'flip-y': ordering?.orderDirection === OrderDirection.ASC }
          )}
          onClick={changeOrderDirection}
        >
          <DirectionIcon />
          <span className="sr-only">
            {ordering?.orderDirection === OrderDirection.ASC
              ? t('album_filter.order_direction.ascending', 'Ascending')
              : t('album_filter.order_direction.descending', 'Descending')}
          </span>
        </button>
      </div>
    </fieldset>
  )
}

type AlbumFilterProps = {
  onlyFavorites: boolean
  setOnlyFavorites?(favorites: boolean): void
  ordering?: MediaOrdering
  setOrdering?: SetOrderingFn
  sortingOptions?: SortingOption[]
}

const AlbumFilter = ({
  onlyFavorites,
  setOnlyFavorites,
  setOrdering,
  ordering,
  sortingOptions,
}: AlbumFilterProps) => {
  return (
    <div className="toolbar-group">
      {ordering && setOrdering ? (
        <SortingOptions
          ordering={ordering}
          setOrdering={setOrdering}
          items={sortingOptions}
        />
      ) : null}
      {authToken() && setOnlyFavorites && (
        <FavoritesCheckbox
          onlyFavorites={onlyFavorites}
          setOnlyFavorites={setOnlyFavorites}
        />
      )}
    </div>
  )
}

export default AlbumFilter
