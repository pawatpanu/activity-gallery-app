import React, { useState, useRef, useEffect } from 'react'
import styled from 'styled-components'
import { useLazyQuery, gql } from '@apollo/client'
import { debounce, DebouncedFn } from '../../helpers/utils'
import { ProtectedImage } from '../photoGallery/ProtectedMedia'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  searchQuery,
  searchQuery_search_albums,
  searchQuery_search_media,
} from './__generated__/searchQuery'
import classNames from 'classnames'

const SEARCH_QUERY = gql`
  query searchQuery($query: String!) {
    search(query: $query) {
      query
      albums {
        id
        title
        thumbnail {
          thumbnail {
            url
          }
        }
      }
      media {
        id
        title
        thumbnail {
          url
        }
        album {
          id
        }
      }
    }
  }
`

const SearchWrapper = styled.div.attrs({
  className: 'w-full max-w-xl lg:relative',
})``

const SearchBar = () => {
  const { t } = useTranslation()
  const [fetchSearches, fetchResult] = useLazyQuery<searchQuery>(SEARCH_QUERY)
  const [query, setQuery] = useState('')
  const [fetched, setFetched] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const inputEl = useRef<HTMLInputElement>(null)

  type QueryFn = (query: string) => void

  const debouncedFetch = useRef<null | DebouncedFn<QueryFn>>(null)
  useEffect(() => {
    debouncedFetch.current = debounce<QueryFn>(query => {
      fetchSearches({ variables: { query } })
      setFetched(true)
      setExpanded(true)
    }, 250)

    return () => {
      debouncedFetch.current?.cancel()
    }
  }, [])

  const fetchEvent = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.persist()

    setQuery(e.target.value)
    if (e.target.value.trim() != '' && debouncedFetch.current) {
      debouncedFetch.current(e.target.value.trim())
    } else {
      setFetched(false)
    }
  }

  const location = useLocation()
  useEffect(() => {
    setExpanded(false)
    setQuery('')
  }, [location])

  const [selectedItem, setSelectedItem] = useState<number | null>(null)

  const searchData = fetchResult.data
  let media = searchData?.search.media || []
  let albums = searchData?.search.albums || []

  albums = albums.slice(0, 5)
  media = media.slice(0, 5)

  const selectedItemId =
    selectedItem !== null
      ? [...albums.map(x => x.id), ...media.map(x => x.id)][selectedItem]
      : null

  useEffect(() => {
    const elem = inputEl.current
    if (!elem) return

    const focusEvent = () => {
      setExpanded(true)
    }

    const blurEvent = () => {
      setExpanded(false)
    }

    elem.addEventListener('focus', focusEvent)
    elem.addEventListener('blur', blurEvent)

    return () => {
      elem.removeEventListener('focus', focusEvent)
      elem.removeEventListener('blur', blurEvent)
    }
  }, [inputEl])

  useEffect(() => {
    setSelectedItem(null)
  }, [searchData])

  useEffect(() => {
    const totalItems = albums.length + media.length

    const keydownEvent = (event: KeyboardEvent) => {
      if (!expanded) return

      if (event.key == 'ArrowDown') {
        event.preventDefault()
        setSelectedItem(i => (i === null ? 0 : Math.min(totalItems - 1, i + 1)))
      } else if (event.key == 'ArrowUp') {
        event.preventDefault()
        setSelectedItem(i => (i === null ? 0 : Math.max(0, i - 1)))
      } else if (event.key == 'Escape') {
        // setExpanded(false)
        inputEl.current?.blur()
      }
    }

    document.addEventListener('keydown', keydownEvent)

    return () => {
      document.removeEventListener('keydown', keydownEvent)
    }
  }, [searchData])

  let results = null
  if (query.trim().length > 0 && fetched) {
    results = (
      <SearchResults
        albums={albums}
        media={media}
        query={fetchResult.data?.search.query || ''}
        selectedItem={selectedItem}
        setSelectedItem={setSelectedItem}
        loading={fetchResult.loading}
        expanded={expanded}
      />
    )
  }

  return (
    <SearchWrapper>
      <input
        ref={inputEl}
        autoComplete="off"
        aria-controls="search-results"
        aria-haspopup="listbox"
        aria-autocomplete="list"
        aria-activedescendant={
          selectedItemId ? `search-item-${selectedItemId}` : ''
        }
        aria-expanded={expanded}
        className="relative z-10 min-h-[50px] w-full rounded-[18px] border border-[var(--border-subtle)] bg-[var(--surface-inset)] px-4 py-3 text-[0.96rem] text-[var(--text-primary)] shadow-[inset_0_1px_0_rgba(255,255,255,0.3)] outline-none transition-all duration-200 placeholder:text-[var(--text-muted)] focus:border-[rgba(108,132,255,0.48)] focus:bg-[var(--surface-elevated)] focus:ring-[var(--shadow-focus)]"
        type="search"
        placeholder={t('header.search.placeholder', 'Search')}
        onChange={fetchEvent}
        value={query}
      />
      {results}
    </SearchWrapper>
  )
}

const ResultTitle = styled.h1.attrs({
  className:
    'mx-1 mb-2 mt-5 text-[0.72rem] font-bold uppercase tracking-[0.2em] text-[var(--text-muted)]',
})``

type SearchResultsProps = {
  albums: searchQuery_search_albums[]
  media: searchQuery_search_media[]
  loading: boolean
  selectedItem: number | null
  setSelectedItem: React.Dispatch<React.SetStateAction<number | null>>
  query: string
  expanded: boolean
}

const SearchResults = ({
  albums,
  media,
  loading,
  selectedItem,
  setSelectedItem,
  query,
  expanded,
}: SearchResultsProps) => {
  const { t } = useTranslation()

  const albumElements = albums.map((album, i) => (
    <AlbumRow
      key={album.id}
      query={query}
      album={album}
      selected={selectedItem == i}
      setSelected={() => setSelectedItem(i)}
    />
  ))

  const mediaElements = media.map((media, i) => (
    <PhotoRow
      key={media.id}
      query={query}
      media={media}
      selected={selectedItem == i + albumElements.length}
      setSelected={() => setSelectedItem(i + albumElements.length)}
    />
  ))

  let message = null
  if (loading) message = t('header.search.loading', 'Loading results...')
  else if (media.length == 0 && albums.length == 0)
    message = t('header.search.no_results', 'No results found')

  if (message) message = <div className="mt-8 text-center">{message}</div>

  return (
    <div
      id="search-results"
      role="listbox"
      className={classNames(
        'absolute left-0 right-0 top-[78px] z-0 h-[calc(100vh-164px)] overflow-y-auto border px-4 pb-4 pt-2',
        'rounded-[24px] lg:top-[58px] lg:max-h-[560px]',
        { hidden: !expanded }
      )}
      style={{
        background: 'var(--surface-elevated)',
        borderColor: 'var(--border-subtle)',
        boxShadow: 'var(--shadow-medium)',
      }}
      tabIndex={-1}
      onMouseDown={e => {
        // Prevent input blur event
        e.preventDefault()
      }}
    >
      {message}
      {albumElements.length > 0 && (
        <>
          <ResultTitle>
            {t('header.search.result_type.albums', 'Albums')}
          </ResultTitle>
          <ul aria-label="albums">{albumElements}</ul>
        </>
      )}
      {mediaElements.length > 0 && (
        <>
          <ResultTitle>
            {t('header.search.result_type.media', 'Media')}
          </ResultTitle>
          <ul aria-label="media">{mediaElements}</ul>
        </>
      )}
    </div>
  )
}

type SearchRowProps = {
  id: string
  link: string
  preview: React.ReactNode
  label: React.ReactNode
  selected: boolean
  setSelected(): void
}

const SearchRow = ({
  id,
  link,
  preview,
  label,
  selected,
  setSelected,
}: SearchRowProps) => {
  const rowEl = useRef<HTMLLIElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    const keydownEvent = (event: KeyboardEvent) => {
      if (event.key == 'Enter') navigate(link)
    }

    document.addEventListener('keydown', keydownEvent)

    return () => {
      document.removeEventListener('keydown', keydownEvent)
    }
  })

  if (selected) {
    rowEl.current?.scrollIntoView({
      block: 'nearest',
    })
  }

  return (
    <li
      id={`search-item-${id}`}
      ref={rowEl}
      role="option"
      aria-selected={selected}
      onMouseOver={() => setSelected()}
      className={classNames('rounded p-1 mt-1', {
        'bg-[var(--surface-muted)] shadow-[inset_0_1px_0_rgba(255,255,255,0.3)]': selected,
      })}
    >
      <NavLink to={link} className="flex items-center" tabIndex={-1}>
        {preview}
        <span className="flex-grow pl-2 text-sm">{label}</span>
      </NavLink>
    </li>
  )
}

type PhotoRowArgs = {
  query: string
  media: searchQuery_search_media
  selected: boolean
  setSelected(): void
}

const PhotoRow = ({ query, media, selected, setSelected }: PhotoRowArgs) => (
  <SearchRow
    key={media.id}
    id={media.id}
    link={`/album/${media.album.id}`}
    preview={
      <ProtectedImage
        src={media?.thumbnail?.url}
        className="h-14 w-14 rounded-[16px] object-cover"
      />
    }
    label={searchHighlighted(query, media.title)}
    selected={selected}
    setSelected={setSelected}
  />
)

type AlbumRowArgs = {
  query: string
  album: searchQuery_search_albums
  selected: boolean
  setSelected(): void
}

const AlbumRow = ({ query, album, selected, setSelected }: AlbumRowArgs) => (
  <SearchRow
    key={album.id}
    id={album.id}
    link={`/album/${album.id}`}
    preview={
      <ProtectedImage
        src={album?.thumbnail?.thumbnail?.url}
        className="h-14 w-14 rounded-[16px] object-cover"
      />
    }
    label={searchHighlighted(query, album.title)}
    selected={selected}
    setSelected={setSelected}
  />
)

const searchHighlighted = (query: string, text: string) => {
  const i = text.toLowerCase().indexOf(query.toLowerCase())

  if (i == -1) {
    return text
  }

  const start = text.substring(0, i)
  const middle = text.substring(i, i + query.length)
  const end = text.substring(i + query.length)

  return (
    <span>
      {start}
      <span className="font-semibold whitespace-pre text-[var(--text-primary)]">{middle}</span>
      {end}
    </span>
  )
}

export default SearchBar
