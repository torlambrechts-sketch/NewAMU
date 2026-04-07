import type { UiTableCoreDesign } from '../../../types/uiTableCore'
import { ColorField, SelectField, TextField } from './sharedFields'
import { LABEL, PANEL, SECTION } from './fieldTokens'

type Props = {
  d: UiTableCoreDesign
  update: (patch: Partial<UiTableCoreDesign>) => void
}

export function TableCoreForm({ d, update }: Props) {
  return (
    <>
      <section className={SECTION}>
        <h2 className="text-sm font-semibold text-white">Skall (wrapper)</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <TextField label="width" value={d.shell.width} onChange={(v) => update({ shell: { ...d.shell, width: v } })} />
          <TextField label="maxWidth" value={d.shell.maxWidth} onChange={(v) => update({ shell: { ...d.shell, maxWidth: v } })} />
          <TextField label="margin" value={d.shell.margin} onChange={(v) => update({ shell: { ...d.shell, margin: v } })} />
          <TextField label="padding" value={d.shell.padding} onChange={(v) => update({ shell: { ...d.shell, padding: v } })} />
          <ColorField label="backgroundColor" value={d.shell.backgroundColor} onChange={(v) => update({ shell: { ...d.shell, backgroundColor: v } })} />
          <TextField label="overflow" value={d.shell.overflow} onChange={(v) => update({ shell: { ...d.shell, overflow: v } })} />
          <label className={`${LABEL} sm:col-span-2`}>
            backgroundGradient
            <textarea value={d.shell.backgroundGradient} onChange={(e) => update({ shell: { ...d.shell, backgroundGradient: e.target.value } })} rows={2} className={PANEL} />
          </label>
        </div>
      </section>

      <section className={SECTION}>
        <h2 className="text-sm font-semibold text-white">Tabell</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <TextField label="width" value={d.table.width} onChange={(v) => update({ table: { ...d.table, width: v } })} />
          <SelectField
            label="borderCollapse"
            value={d.table.borderCollapse}
            options={[
              { value: 'collapse', label: 'collapse' },
              { value: 'separate', label: 'separate' },
            ]}
            onChange={(v) => update({ table: { ...d.table, borderCollapse: v } })}
          />
          <SelectField
            label="tableLayout"
            value={d.table.tableLayout}
            options={[
              { value: 'auto', label: 'auto' },
              { value: 'fixed', label: 'fixed' },
            ]}
            onChange={(v) => update({ table: { ...d.table, tableLayout: v } })}
          />
          <TextField label="borderSpacing" value={d.table.borderSpacing} onChange={(v) => update({ table: { ...d.table, borderSpacing: v } })} />
        </div>
      </section>

      <section className={SECTION}>
        <h2 className="text-sm font-semibold text-white">Caption</h2>
        <div className="mt-3 flex flex-wrap gap-3">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-neutral-300">
            <input type="checkbox" className="rounded border-white/20" checked={d.caption.enabled} onChange={(e) => update({ caption: { ...d.caption, enabled: e.target.checked } })} />
            Aktivert
          </label>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <TextField label="text" value={d.caption.text} onChange={(v) => update({ caption: { ...d.caption, text: v } })} />
          <ColorField label="color" value={d.caption.color} onChange={(v) => update({ caption: { ...d.caption, color: v } })} />
          <TextField label="fontSize" value={d.caption.fontSize} onChange={(v) => update({ caption: { ...d.caption, fontSize: v } })} />
          <TextField label="fontWeight" value={d.caption.fontWeight} onChange={(v) => update({ caption: { ...d.caption, fontWeight: v } })} />
          <TextField label="padding" value={d.caption.padding} onChange={(v) => update({ caption: { ...d.caption, padding: v } })} />
          <SelectField
            label="captionSide"
            value={d.caption.captionSide}
            options={[
              { value: 'top', label: 'top' },
              { value: 'bottom', label: 'bottom' },
            ]}
            onChange={(v) => update({ caption: { ...d.caption, captionSide: v } })}
          />
        </div>
      </section>

      <section className={SECTION}>
        <h2 className="text-sm font-semibold text-white">Thead (hode)</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <ColorField label="backgroundColor" value={d.thead.backgroundColor} onChange={(v) => update({ thead: { ...d.thead, backgroundColor: v } })} />
          <TextField label="position" value={d.thead.position} onChange={(v) => update({ thead: { ...d.thead, position: v } })} />
          <TextField label="zIndex" value={d.thead.zIndex} onChange={(v) => update({ thead: { ...d.thead, zIndex: v } })} />
        </div>
      </section>

      <section className={SECTION}>
        <h2 className="text-sm font-semibold text-white">th (celler)</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <TextField label="padding" value={d.th.padding} onChange={(v) => update({ th: { ...d.th, padding: v } })} />
          <TextField label="fontSize" value={d.th.fontSize} onChange={(v) => update({ th: { ...d.th, fontSize: v } })} />
          <TextField label="fontWeight" value={d.th.fontWeight} onChange={(v) => update({ th: { ...d.th, fontWeight: v } })} />
          <TextField label="lineHeight" value={d.th.lineHeight} onChange={(v) => update({ th: { ...d.th, lineHeight: v } })} />
          <TextField label="letterSpacing" value={d.th.letterSpacing} onChange={(v) => update({ th: { ...d.th, letterSpacing: v } })} />
          <TextField label="textTransform" value={d.th.textTransform} onChange={(v) => update({ th: { ...d.th, textTransform: v } })} />
          <ColorField label="color" value={d.th.color} onChange={(v) => update({ th: { ...d.th, color: v } })} />
          <TextField label="textAlign" value={d.th.textAlign} onChange={(v) => update({ th: { ...d.th, textAlign: v } })} />
          <TextField label="borderBottomWidth" value={d.th.borderBottomWidth} onChange={(v) => update({ th: { ...d.th, borderBottomWidth: v } })} />
          <TextField label="borderBottomStyle" value={d.th.borderBottomStyle} onChange={(v) => update({ th: { ...d.th, borderBottomStyle: v } })} />
          <ColorField label="borderBottomColor" value={d.th.borderBottomColor} onChange={(v) => update({ th: { ...d.th, borderBottomColor: v } })} />
          <TextField label="whiteSpace" value={d.th.whiteSpace} onChange={(v) => update({ th: { ...d.th, whiteSpace: v } })} />
        </div>
      </section>

      <section className={SECTION}>
        <h2 className="text-sm font-semibold text-white">Tbody (rader)</h2>
        <div className="mt-3 flex flex-wrap gap-3">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-neutral-300">
            <input type="checkbox" className="rounded border-white/20" checked={d.tbody.zebra} onChange={(e) => update({ tbody: { ...d.tbody, zebra: e.target.checked } })} />
            Zebra-striper
          </label>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <ColorField label="oddRowBackground" value={d.tbody.oddRowBackground} onChange={(v) => update({ tbody: { ...d.tbody, oddRowBackground: v } })} />
          <ColorField label="evenRowBackground" value={d.tbody.evenRowBackground} onChange={(v) => update({ tbody: { ...d.tbody, evenRowBackground: v } })} />
          <ColorField label="rowHoverBackground" value={d.tbody.rowHoverBackground} onChange={(v) => update({ tbody: { ...d.tbody, rowHoverBackground: v } })} />
          <TextField label="rowTransition" value={d.tbody.rowTransition} onChange={(v) => update({ tbody: { ...d.tbody, rowTransition: v } })} />
        </div>
      </section>

      <section className={SECTION}>
        <h2 className="text-sm font-semibold text-white">td (celler)</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <TextField label="padding" value={d.td.padding} onChange={(v) => update({ td: { ...d.td, padding: v } })} />
          <TextField label="fontSize" value={d.td.fontSize} onChange={(v) => update({ td: { ...d.td, fontSize: v } })} />
          <TextField label="lineHeight" value={d.td.lineHeight} onChange={(v) => update({ td: { ...d.td, lineHeight: v } })} />
          <ColorField label="color" value={d.td.color} onChange={(v) => update({ td: { ...d.td, color: v } })} />
          <TextField label="borderBottomWidth" value={d.td.borderBottomWidth} onChange={(v) => update({ td: { ...d.td, borderBottomWidth: v } })} />
          <TextField label="borderBottomStyle" value={d.td.borderBottomStyle} onChange={(v) => update({ td: { ...d.td, borderBottomStyle: v } })} />
          <ColorField label="borderBottomColor" value={d.td.borderBottomColor} onChange={(v) => update({ td: { ...d.td, borderBottomColor: v } })} />
          <TextField label="verticalAlign" value={d.td.verticalAlign} onChange={(v) => update({ td: { ...d.td, verticalAlign: v } })} />
        </div>
      </section>

      <section className={SECTION}>
        <h2 className="text-sm font-semibold text-white">Ramme (wrapper)</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <TextField label="wrapperBorderWidth" value={d.borders.wrapperBorderWidth} onChange={(v) => update({ borders: { ...d.borders, wrapperBorderWidth: v } })} />
          <TextField label="wrapperBorderStyle" value={d.borders.wrapperBorderStyle} onChange={(v) => update({ borders: { ...d.borders, wrapperBorderStyle: v } })} />
          <ColorField label="wrapperBorderColor" value={d.borders.wrapperBorderColor} onChange={(v) => update({ borders: { ...d.borders, wrapperBorderColor: v } })} />
          <TextField label="wrapperBorderRadius" value={d.borders.wrapperBorderRadius} onChange={(v) => update({ borders: { ...d.borders, wrapperBorderRadius: v } })} />
          <label className={`${LABEL} sm:col-span-2`}>
            wrapperBoxShadow
            <textarea value={d.borders.wrapperBoxShadow} onChange={(e) => update({ borders: { ...d.borders, wrapperBoxShadow: e.target.value } })} rows={2} className={PANEL} />
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-neutral-300 sm:col-span-2">
            <input type="checkbox" className="rounded border-white/20" checked={d.borders.cellSeparator} onChange={(e) => update({ borders: { ...d.borders, cellSeparator: e.target.checked } })} />
            cellSeparator (vertikal linje)
          </label>
          <ColorField label="cellSeparatorColor" value={d.borders.cellSeparatorColor} onChange={(v) => update({ borders: { ...d.borders, cellSeparatorColor: v } })} />
        </div>
      </section>

      <section className={SECTION}>
        <h2 className="text-sm font-semibold text-white">Effekter og animasjon</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <TextField label="backdropFilter" value={d.advancedVisuals.backdropFilter} onChange={(v) => update({ advancedVisuals: { ...d.advancedVisuals, backdropFilter: v } })} />
          <TextField label="filter" value={d.advancedVisuals.filter} onChange={(v) => update({ advancedVisuals: { ...d.advancedVisuals, filter: v } })} />
          <TextField label="transitionProperty" value={d.animation.transitionProperty} onChange={(v) => update({ animation: { ...d.animation, transitionProperty: v } })} />
          <TextField label="transitionDuration" value={d.animation.transitionDuration} onChange={(v) => update({ animation: { ...d.animation, transitionDuration: v } })} />
          <TextField label="transitionTimingFunction" value={d.animation.transitionTimingFunction} onChange={(v) => update({ animation: { ...d.animation, transitionTimingFunction: v } })} />
        </div>
      </section>

      <section className={SECTION}>
        <h2 className="text-sm font-semibold text-white">Interaksjon</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <TextField label="rowCursor" value={d.interaction.rowCursor} onChange={(v) => update({ interaction: { ...d.interaction, rowCursor: v } })} />
          <TextField label="headerCursor" value={d.interaction.headerCursor} onChange={(v) => update({ interaction: { ...d.interaction, headerCursor: v } })} />
        </div>
      </section>

      <section className={SECTION}>
        <h2 className="text-sm font-semibold text-white">Data</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <TextField label="provider" value={d.data.provider} onChange={(v) => update({ data: { ...d.data, provider: v } })} />
          <TextField label="documentPath" value={d.data.documentPath} onChange={(v) => update({ data: { ...d.data, documentPath: v } })} />
          <label className="flex cursor-pointer items-center gap-2 text-sm text-neutral-300 sm:col-span-2">
            <input type="checkbox" className="rounded border-white/20" checked={d.data.bindToStyle} onChange={(e) => update({ data: { ...d.data, bindToStyle: e.target.checked } })} />
            bindToStyle
          </label>
        </div>
      </section>
    </>
  )
}
