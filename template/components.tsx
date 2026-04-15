import type { ReactNode } from 'react'

export type PageShellProps = {
  title: string
  description?: string
  actions?: ReactNode
  children: ReactNode
}

export function PageShell({ title, description, actions, children }: PageShellProps) {
  return (
    <section className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 md:px-8">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1
            className="text-2xl font-semibold text-neutral-900 md:text-3xl"
            style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}
          >
            {title}
          </h1>
          {description ? <p className="text-sm text-neutral-600 md:text-base">{description}</p> : null}
        </div>
        {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
      </header>
      <div className="space-y-4">{children}</div>
    </section>
  )
}

export type ModuleListViewProps = {
  toolbar?: ReactNode
  filters?: ReactNode
  list: ReactNode
  emptyState?: ReactNode
}

export function ModuleListView({ toolbar, filters, list, emptyState }: ModuleListViewProps) {
  return (
    <div className="space-y-3 rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
      {toolbar ? <div className="flex flex-wrap items-center justify-between gap-2">{toolbar}</div> : null}
      {filters ? <div className="flex flex-wrap items-center gap-2">{filters}</div> : null}
      <div>{list}</div>
      {emptyState ? <div className="text-sm text-neutral-500">{emptyState}</div> : null}
    </div>
  )
}

export type ModuleDetailViewProps = {
  summary?: ReactNode
  content: ReactNode
  sidebar?: ReactNode
  footer?: ReactNode
}

export function ModuleDetailView({ summary, content, sidebar, footer }: ModuleDetailViewProps) {
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="space-y-4">
        {summary ? <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">{summary}</div> : null}
        <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">{content}</div>
        {footer ? <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">{footer}</div> : null}
      </div>
      {sidebar ? <aside className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">{sidebar}</aside> : null}
    </div>
  )
}

export type FormModalProps = {
  open: boolean
  title: string
  description?: string
  children: ReactNode
  actions?: ReactNode
}

export function FormModal({ open, title, description, children, actions }: FormModalProps) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-2xl rounded-xl bg-white p-5 shadow-xl">
        <header className="mb-4 space-y-1">
          <h2 className="text-lg font-semibold text-neutral-900">{title}</h2>
          {description ? <p className="text-sm text-neutral-600">{description}</p> : null}
        </header>
        <div className="space-y-4">{children}</div>
        {actions ? <footer className="mt-5 flex items-center justify-end gap-2">{actions}</footer> : null}
      </div>
    </div>
  )
}

export type DataTableColumn<Row> = {
  key: keyof Row | string
  header: string
  className?: string
  render?: (row: Row) => ReactNode
}

export type DataTableProps<Row> = {
  columns: DataTableColumn<Row>[]
  rows: Row[]
  getRowKey: (row: Row, index: number) => string
  emptyLabel?: string
}

export function DataTable<Row>({
  columns,
  rows,
  getRowKey,
  emptyLabel = 'No data available.',
}: DataTableProps<Row>) {
  return (
    <div className="overflow-x-auto rounded-lg border border-neutral-200">
      <table className="min-w-full divide-y divide-neutral-200 text-sm">
        <thead className="bg-neutral-50">
          <tr>
            {columns.map((column) => (
              <th
                key={String(column.key)}
                scope="col"
                className={`px-3 py-2 text-left font-medium text-neutral-700 ${column.className ?? ''}`}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100 bg-white">
          {rows.map((row, index) => (
            <tr key={getRowKey(row, index)} className="align-top">
              {columns.map((column) => {
                const key = String(column.key)
                const value =
                  typeof row === 'object' && row !== null
                    ? (row as Record<string, unknown>)[key]
                    : undefined
                return (
                  <td key={key} className={`px-3 py-2 text-neutral-800 ${column.className ?? ''}`}>
                    {column.render ? column.render(row) : String(value ?? '')}
                  </td>
                )
              })}
            </tr>
          ))}
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-3 py-8 text-center text-neutral-500">
                {emptyLabel}
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  )
}
