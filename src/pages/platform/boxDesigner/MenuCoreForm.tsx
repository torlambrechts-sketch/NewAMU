import type { UiMenuCoreDesign } from '../../../types/uiMenuCore'
import { ColorField, SelectField, TextField } from './sharedFields'
import { LABEL, PANEL, SECTION } from './fieldTokens'

type Props = {
  d: UiMenuCoreDesign
  update: (patch: Partial<UiMenuCoreDesign>) => void
}

export function MenuCoreForm({ d, update }: Props) {
  return (
    <>
      <section className={SECTION}>
        <h2 className="text-sm font-semibold text-white">Menylinje (bar)</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <TextField label="marginTop" value={d.bar.marginTop} onChange={(v) => update({ bar: { ...d.bar, marginTop: v } })} />
          <TextField label="overflow" value={d.bar.overflow} onChange={(v) => update({ bar: { ...d.bar, overflow: v } })} />
          <TextField label="borderRadius" value={d.bar.borderRadius} onChange={(v) => update({ bar: { ...d.bar, borderRadius: v } })} />
          <TextField label="borderWidth" value={d.bar.borderWidth} onChange={(v) => update({ bar: { ...d.bar, borderWidth: v } })} />
          <TextField label="borderStyle" value={d.bar.borderStyle} onChange={(v) => update({ bar: { ...d.bar, borderStyle: v } })} />
          <ColorField label="borderColor" value={d.bar.borderColor} onChange={(v) => update({ bar: { ...d.bar, borderColor: v } })} />
          <TextField label="borderTopWidth" value={d.bar.borderTopWidth} onChange={(v) => update({ bar: { ...d.bar, borderTopWidth: v } })} />
          <TextField label="borderBottomWidth" value={d.bar.borderBottomWidth} onChange={(v) => update({ bar: { ...d.bar, borderBottomWidth: v } })} />
          <label className={`${LABEL} sm:col-span-2`}>
            boxShadow
            <textarea value={d.bar.boxShadow} onChange={(e) => update({ bar: { ...d.bar, boxShadow: e.target.value } })} rows={2} className={PANEL} />
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-neutral-300 sm:col-span-2">
            <input
              type="checkbox"
              className="rounded border-white/20"
              checked={d.bar.omitBottomBorder}
              onChange={(e) => update({ bar: { ...d.bar, omitBottomBorder: e.target.checked } })}
            />
            omitBottomBorder (ingen nedre kant på baren)
          </label>
        </div>
      </section>

      <section className={SECTION}>
        <h2 className="text-sm font-semibold text-white">Farger</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <SelectField
            label="barTone"
            value={d.colors.barTone}
            options={[
              { value: 'accent', label: 'accent' },
              { value: 'slate', label: 'slate' },
            ]}
            onChange={(v) => update({ colors: { ...d.colors, barTone: v } })}
          />
          <ColorField label="accent" value={d.colors.accent} onChange={(v) => update({ colors: { ...d.colors, accent: v } })} />
          <ColorField label="slate" value={d.colors.slate} onChange={(v) => update({ colors: { ...d.colors, slate: v } })} />
        </div>
      </section>

      <section className={SECTION}>
        <h2 className="text-sm font-semibold text-white">Faner (layout)</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <SelectField
            label="tabLayout"
            value={d.tabLayout}
            options={[
              { value: 'rounded', label: 'rounded' },
              { value: 'squared', label: 'squared' },
              { value: 'flush', label: 'flush (helt ned)' },
            ]}
            onChange={(v) => update({ tabLayout: v })}
          />
          <SelectField
            label="tabRounding (når rounded)"
            value={d.tabRounding}
            options={[
              { value: 'none', label: 'none' },
              { value: 'xl', label: 'xl' },
              { value: 'full', label: 'full (pill)' },
            ]}
            onChange={(v) => update({ tabRounding: v })}
          />
          <SelectField
            label="activeFill"
            value={d.activeFill}
            options={[
              { value: 'cream', label: 'cream' },
              { value: 'white', label: 'white' },
            ]}
            onChange={(v) => update({ activeFill: v })}
          />
        </div>
      </section>

      <section className={SECTION}>
        <h2 className="text-sm font-semibold text-white">Aktiv fane</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <ColorField label="backgroundColor" value={d.activeTab.backgroundColor} onChange={(v) => update({ activeTab: { ...d.activeTab, backgroundColor: v } })} />
          <ColorField label="color" value={d.activeTab.color} onChange={(v) => update({ activeTab: { ...d.activeTab, color: v } })} />
          <TextField label="fontSize" value={d.activeTab.fontSize} onChange={(v) => update({ activeTab: { ...d.activeTab, fontSize: v } })} />
          <TextField label="fontWeight" value={d.activeTab.fontWeight} onChange={(v) => update({ activeTab: { ...d.activeTab, fontWeight: v } })} />
          <TextField label="padding" value={d.activeTab.padding} onChange={(v) => update({ activeTab: { ...d.activeTab, padding: v } })} />
          <TextField label="minHeight" value={d.activeTab.minHeight} onChange={(v) => update({ activeTab: { ...d.activeTab, minHeight: v } })} />
          <TextField label="borderRadius" value={d.activeTab.borderRadius} onChange={(v) => update({ activeTab: { ...d.activeTab, borderRadius: v } })} />
          <label className={`${LABEL} sm:col-span-2`}>
            boxShadow
            <textarea value={d.activeTab.boxShadow} onChange={(e) => update({ activeTab: { ...d.activeTab, boxShadow: e.target.value } })} rows={2} className={PANEL} />
          </label>
        </div>
      </section>

      <section className={SECTION}>
        <h2 className="text-sm font-semibold text-white">Inaktiv fane</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <ColorField label="color" value={d.inactiveTab.color} onChange={(v) => update({ inactiveTab: { ...d.inactiveTab, color: v } })} />
          <ColorField label="hoverBackground" value={d.inactiveTab.hoverBackground} onChange={(v) => update({ inactiveTab: { ...d.inactiveTab, hoverBackground: v } })} />
          <TextField label="fontSize" value={d.inactiveTab.fontSize} onChange={(v) => update({ inactiveTab: { ...d.inactiveTab, fontSize: v } })} />
          <TextField label="fontWeight" value={d.inactiveTab.fontWeight} onChange={(v) => update({ inactiveTab: { ...d.inactiveTab, fontWeight: v } })} />
          <TextField label="padding" value={d.inactiveTab.padding} onChange={(v) => update({ inactiveTab: { ...d.inactiveTab, padding: v } })} />
          <TextField label="minHeight" value={d.inactiveTab.minHeight} onChange={(v) => update({ inactiveTab: { ...d.inactiveTab, minHeight: v } })} />
          <TextField label="borderRadius" value={d.inactiveTab.borderRadius} onChange={(v) => update({ inactiveTab: { ...d.inactiveTab, borderRadius: v } })} />
        </div>
      </section>

      <section className={SECTION}>
        <h2 className="text-sm font-semibold text-white">Inner row</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <TextField label="display" value={d.innerRow.display} onChange={(v) => update({ innerRow: { ...d.innerRow, display: v } })} />
          <TextField label="flexWrap" value={d.innerRow.flexWrap} onChange={(v) => update({ innerRow: { ...d.innerRow, flexWrap: v } })} />
          <TextField label="alignItems" value={d.innerRow.alignItems} onChange={(v) => update({ innerRow: { ...d.innerRow, alignItems: v } })} />
          <TextField label="gap" value={d.innerRow.gap} onChange={(v) => update({ innerRow: { ...d.innerRow, gap: v } })} />
          <TextField label="padding" value={d.innerRow.padding} onChange={(v) => update({ innerRow: { ...d.innerRow, padding: v } })} />
          <TextField label="minHeight" value={d.innerRow.minHeight} onChange={(v) => update({ innerRow: { ...d.innerRow, minHeight: v } })} />
        </div>
      </section>

      <section className={SECTION}>
        <h2 className="text-sm font-semibold text-white">Animasjon</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <TextField label="transitionProperty" value={d.animation.transitionProperty} onChange={(v) => update({ animation: { ...d.animation, transitionProperty: v } })} />
          <TextField label="transitionDuration" value={d.animation.transitionDuration} onChange={(v) => update({ animation: { ...d.animation, transitionDuration: v } })} />
          <TextField label="transitionTimingFunction" value={d.animation.transitionTimingFunction} onChange={(v) => update({ animation: { ...d.animation, transitionTimingFunction: v } })} />
        </div>
      </section>

      <section className={SECTION}>
        <h2 className="text-sm font-semibold text-white">Demo-etiketter</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <TextField label="activeLabel" value={d.demo.activeLabel} onChange={(v) => update({ demo: { ...d.demo, activeLabel: v } })} />
          <TextField label="inactiveLabel" value={d.demo.inactiveLabel} onChange={(v) => update({ demo: { ...d.demo, inactiveLabel: v } })} />
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

      <section className={SECTION}>
        <h2 className="text-sm font-semibold text-white">Interaksjon</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <TextField label="cursor" value={d.interaction.cursor} onChange={(v) => update({ interaction: { ...d.interaction, cursor: v } })} />
        </div>
      </section>
    </>
  )
}
