import styled from 'styled-components'

export const SidebarSection = styled.div.attrs({
  className: 'mx-3 mb-5 rounded-[22px] border px-4 py-4',
})`
  background: var(--surface-strong);
  border-color: var(--border-subtle);
  box-shadow: var(--shadow-card);
`

export const SidebarSectionTitle = styled.h2.attrs({
  className:
    'mb-3 text-[0.75rem] font-bold uppercase tracking-[0.18em]' as string,
})`
  color: var(--text-muted);
`
