import { gql } from '@apollo/client'
import { saveTokenCookie } from '../../helpers/authentication'
import styled from 'styled-components'
import urlJoin from 'url-join'
import { API_ENDPOINT } from '../../apolloClient'

export const INITIAL_SETUP_QUERY = gql`
  query CheckInitialSetup {
    siteInfo {
      initialSetup
    }
  }
`

export function login(token: string) {
  saveTokenCookie(token)
  window.location.href = `${import.meta.env.BASE_URL}`
}

export const providerAuthEnabled =
  String(import.meta.env.REACT_APP_PROVIDER_AUTH_ENABLED || '').toLowerCase() ===
    '1' ||
  String(import.meta.env.REACT_APP_PROVIDER_AUTH_ENABLED || '').toLowerCase() ===
    'true'

export const providerAuthStartURL = urlJoin(API_ENDPOINT, '/auth/provider/start')

export const Container = styled.div.attrs({ className: 'mt-20' })``
