import styled from 'styled-components'

export const Table = styled.table.attrs({
  className:
    'w-full border-separate rounded-[22px] border overflow-hidden' as string,
})`
  border-spacing: 0;
  border-color: var(--border-subtle);
  background: var(--surface-strong);
  box-shadow: var(--shadow-card);

  & td:not(:last-child),
  & th:not(:last-child) {
    border-right: 1px solid;
    border-color: inherit;
  }

  & tr:first-child td {
    border-top: 1px solid;
    border-color: inherit;
  }

  & td {
    border-bottom: 1px solid;
    border-color: inherit;
  }
`

export const TableHeader = styled.thead.attrs({
  className: 'text-left',
})``

export const TableBody = styled.tbody.attrs({ className: '' as string })``

export const TableFooter = styled.tfoot.attrs({ className: '' as string })``

export const TableRow = styled.tr.attrs({ className: '' as string })``

export const TableCell = styled.td.attrs({
  className: 'px-4 py-3 align-top text-[0.95rem] text-[var(--text-primary)]' as string,
})``

export const TableHeaderCell = styled.th.attrs({
  className:
    'py-3 px-4 align-top text-xs uppercase tracking-[0.16em] font-bold' as string,
})`
  background: var(--surface-muted);
  color: var(--text-muted);
`

export const TableScrollWrapper = styled.div.attrs({
  className: 'block overflow-x-auto whitespace-nowrap rounded-[22px]' as string,
})``
