import type { ReactNode } from 'react'

interface ModuleAdminShellProps {
  title: string
  description?: string
  tabs: {
    key: string
    label: string
    icon: ReactNode
  }[]
  activeTab: string
  onTabChange: (key: string) => void
  children: ReactNode
}

export function ModuleAdminShell({
  title,
  description,
  tabs,
  activeTab,
  onTabChange,
  children,
}: ModuleAdminShellProps) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-neutral-900">{title}</h2>
        {description && <p className="mt-1 text-sm text-neutral-600">{description}</p>}
      </div>

      {/* Mobile tab strip */}
      <div className="flex gap-2 overflow-x-auto pb-1 lg:hidden">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => onTabChange(tab.key)}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium whitespace-nowrap ${
              activeTab === tab.key
                ? 'border-[#1a3d32] bg-[#1a3d32]/10 text-[#1a3d32]'
                : 'border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50'
            }`}
          >
            <span className="shrink-0">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-[16rem_1fr]">
        {/* Desktop hub menu */}
        <aside className="hidden lg:block">
          <div className="space-y-1">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => onTabChange(tab.key)}
                className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                  activeTab === tab.key
                    ? 'border-[#1a3d32] bg-[#1a3d32]/10 text-[#1a3d32]'
                    : 'border-transparent text-neutral-600 hover:border-neutral-200 hover:bg-white'
                }`}
              >
                <span className="shrink-0">{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </aside>

        <div className="min-w-0">{children}</div>
      </div>
    </div>
  )
}
