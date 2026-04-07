import type { UiButtonCoreDesign } from '../../../types/uiButtonCore'
import { ColorField, NumberField, SelectField, TextField } from './sharedFields'
import { LABEL, PANEL, SECTION } from './fieldTokens'

type Props = {
  d: UiButtonCoreDesign
  update: (patch: Partial<UiButtonCoreDesign>) => void
}

export function ButtonCoreForm({ d, update }: Props) {
  return (
    <>
      <section className={SECTION}>
        <h2 className="text-sm font-semibold text-white">Layout</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <TextField label="display" value={d.layout.display} onChange={(v) => update({ layout: { ...d.layout, display: v } })} />
          <TextField label="position" value={d.layout.position} onChange={(v) => update({ layout: { ...d.layout, position: v } })} />
          <TextField label="width" value={d.layout.width} onChange={(v) => update({ layout: { ...d.layout, width: v } })} />
          <TextField label="minWidth" value={d.layout.minWidth} onChange={(v) => update({ layout: { ...d.layout, minWidth: v } })} />
          <TextField label="height" value={d.layout.height} onChange={(v) => update({ layout: { ...d.layout, height: v } })} />
          <TextField label="minHeight" value={d.layout.minHeight} onChange={(v) => update({ layout: { ...d.layout, minHeight: v } })} />
          <TextField label="padding" value={d.layout.padding} onChange={(v) => update({ layout: { ...d.layout, padding: v } })} />
          <TextField label="margin" value={d.layout.margin} onChange={(v) => update({ layout: { ...d.layout, margin: v } })} />
          <TextField label="borderRadius" value={d.layout.borderRadius} onChange={(v) => update({ layout: { ...d.layout, borderRadius: v } })} />
          <TextField label="gap" value={d.layout.gap} onChange={(v) => update({ layout: { ...d.layout, gap: v } })} />
          <TextField label="alignItems" value={d.layout.alignItems} onChange={(v) => update({ layout: { ...d.layout, alignItems: v } })} />
          <TextField label="justifyContent" value={d.layout.justifyContent} onChange={(v) => update({ layout: { ...d.layout, justifyContent: v } })} />
        </div>
      </section>

      <section className={SECTION}>
        <h2 className="text-sm font-semibold text-white">Typografi</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <TextField label="fontFamily" value={d.typography.fontFamily} onChange={(v) => update({ typography: { ...d.typography, fontFamily: v } })} />
          <TextField label="fontSize" value={d.typography.fontSize} onChange={(v) => update({ typography: { ...d.typography, fontSize: v } })} />
          <TextField label="fontWeight" value={d.typography.fontWeight} onChange={(v) => update({ typography: { ...d.typography, fontWeight: v } })} />
          <TextField label="lineHeight" value={d.typography.lineHeight} onChange={(v) => update({ typography: { ...d.typography, lineHeight: v } })} />
          <TextField label="letterSpacing" value={d.typography.letterSpacing} onChange={(v) => update({ typography: { ...d.typography, letterSpacing: v } })} />
          <TextField label="textTransform" value={d.typography.textTransform} onChange={(v) => update({ typography: { ...d.typography, textTransform: v } })} />
          <ColorField label="color" value={d.typography.color} onChange={(v) => update({ typography: { ...d.typography, color: v } })} />
          <SelectField
            label="textAlign"
            value={d.typography.textAlign as 'left' | 'center' | 'right'}
            options={[
              { value: 'left', label: 'left' },
              { value: 'center', label: 'center' },
              { value: 'right', label: 'right' },
            ]}
            onChange={(v) => update({ typography: { ...d.typography, textAlign: v } })}
          />
        </div>
      </section>

      <section className={SECTION}>
        <h2 className="text-sm font-semibold text-white">Standard (default)</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <ColorField label="backgroundColor" value={d.defaultState.backgroundColor} onChange={(v) => update({ defaultState: { ...d.defaultState, backgroundColor: v } })} />
          <label className={`${LABEL} sm:col-span-2`}>
            backgroundGradient
            <textarea value={d.defaultState.backgroundGradient} onChange={(e) => update({ defaultState: { ...d.defaultState, backgroundGradient: e.target.value } })} rows={2} className={PANEL} />
          </label>
          <TextField label="borderWidth" value={d.defaultState.borderWidth} onChange={(v) => update({ defaultState: { ...d.defaultState, borderWidth: v } })} />
          <TextField label="borderStyle" value={d.defaultState.borderStyle} onChange={(v) => update({ defaultState: { ...d.defaultState, borderStyle: v } })} />
          <ColorField label="borderColor" value={d.defaultState.borderColor} onChange={(v) => update({ defaultState: { ...d.defaultState, borderColor: v } })} />
          <label className={`${LABEL} sm:col-span-2`}>
            boxShadow
            <textarea value={d.defaultState.boxShadow} onChange={(e) => update({ defaultState: { ...d.defaultState, boxShadow: e.target.value } })} rows={2} className={PANEL} />
          </label>
          <NumberField label="opacity" value={d.defaultState.opacity} step={0.05} min={0} max={1} onChange={(v) => update({ defaultState: { ...d.defaultState, opacity: Math.min(1, Math.max(0, v)) } })} />
        </div>
      </section>

      <section className={SECTION}>
        <h2 className="text-sm font-semibold text-white">Hover</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <ColorField label="backgroundColor" value={d.hoverState.backgroundColor} onChange={(v) => update({ hoverState: { ...d.hoverState, backgroundColor: v } })} />
          <ColorField label="color" value={d.hoverState.color} onChange={(v) => update({ hoverState: { ...d.hoverState, color: v } })} />
          <ColorField label="borderColor" value={d.hoverState.borderColor} onChange={(v) => update({ hoverState: { ...d.hoverState, borderColor: v } })} />
          <label className={`${LABEL} sm:col-span-2`}>
            boxShadow
            <textarea value={d.hoverState.boxShadow} onChange={(e) => update({ hoverState: { ...d.hoverState, boxShadow: e.target.value } })} rows={2} className={PANEL} />
          </label>
          <NumberField label="scale" value={d.hoverState.scale} step={0.05} min={0.5} max={2} onChange={(v) => update({ hoverState: { ...d.hoverState, scale: v } })} />
          <TextField label="rotate" value={d.hoverState.rotate} onChange={(v) => update({ hoverState: { ...d.hoverState, rotate: v } })} />
        </div>
      </section>

      <section className={SECTION}>
        <h2 className="text-sm font-semibold text-white">Active (trykk)</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <ColorField label="backgroundColor" value={d.activeState.backgroundColor} onChange={(v) => update({ activeState: { ...d.activeState, backgroundColor: v } })} />
          <ColorField label="color" value={d.activeState.color} onChange={(v) => update({ activeState: { ...d.activeState, color: v } })} />
          <NumberField label="scale" value={d.activeState.scale} step={0.05} min={0.5} max={2} onChange={(v) => update({ activeState: { ...d.activeState, scale: v } })} />
          <label className={`${LABEL} sm:col-span-2`}>
            boxShadow
            <textarea value={d.activeState.boxShadow} onChange={(e) => update({ activeState: { ...d.activeState, boxShadow: e.target.value } })} rows={2} className={PANEL} />
          </label>
        </div>
      </section>

      <section className={SECTION}>
        <h2 className="text-sm font-semibold text-white">Focus (tastatur)</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <TextField label="outline" value={d.focusState.outline} onChange={(v) => update({ focusState: { ...d.focusState, outline: v } })} />
          <TextField label="outlineOffset" value={d.focusState.outlineOffset} onChange={(v) => update({ focusState: { ...d.focusState, outlineOffset: v } })} />
          <label className={`${LABEL} sm:col-span-2`}>
            boxShadow
            <textarea value={d.focusState.boxShadow} onChange={(e) => update({ focusState: { ...d.focusState, boxShadow: e.target.value } })} rows={2} className={PANEL} />
          </label>
        </div>
      </section>

      <section className={SECTION}>
        <h2 className="text-sm font-semibold text-white">Disabled</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <NumberField label="opacity" value={d.disabledState.opacity} step={0.05} min={0} max={1} onChange={(v) => update({ disabledState: { ...d.disabledState, opacity: v } })} />
          <TextField label="cursor" value={d.disabledState.cursor} onChange={(v) => update({ disabledState: { ...d.disabledState, cursor: v } })} />
          <ColorField label="backgroundColor" value={d.disabledState.backgroundColor} onChange={(v) => update({ disabledState: { ...d.disabledState, backgroundColor: v } })} />
          <ColorField label="color" value={d.disabledState.color} onChange={(v) => update({ disabledState: { ...d.disabledState, color: v } })} />
        </div>
      </section>

      <section className={SECTION}>
        <h2 className="text-sm font-semibold text-white">Effekter</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <TextField label="backdropFilter" value={d.advancedVisuals.backdropFilter} onChange={(v) => update({ advancedVisuals: { ...d.advancedVisuals, backdropFilter: v } })} />
          <TextField label="filter" value={d.advancedVisuals.filter} onChange={(v) => update({ advancedVisuals: { ...d.advancedVisuals, filter: v } })} />
        </div>
      </section>

      <section className={SECTION}>
        <h2 className="text-sm font-semibold text-white">Animasjon</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <TextField label="transitionProperty" value={d.animation.transitionProperty} onChange={(v) => update({ animation: { ...d.animation, transitionProperty: v } })} />
          <TextField label="transitionDuration" value={d.animation.transitionDuration} onChange={(v) => update({ animation: { ...d.animation, transitionDuration: v } })} />
          <TextField label="transitionTimingFunction" value={d.animation.transitionTimingFunction} onChange={(v) => update({ animation: { ...d.animation, transitionTimingFunction: v } })} />
          <TextField label="transitionDelay" value={d.animation.transitionDelay} onChange={(v) => update({ animation: { ...d.animation, transitionDelay: v } })} />
        </div>
      </section>

      <section className={SECTION}>
        <h2 className="text-sm font-semibold text-white">Interaksjon</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <TextField label="cursor" value={d.interaction.cursor} onChange={(v) => update({ interaction: { ...d.interaction, cursor: v } })} />
          <TextField label="userSelect" value={d.interaction.userSelect} onChange={(v) => update({ interaction: { ...d.interaction, userSelect: v } })} />
          <TextField label="pointerEvents" value={d.interaction.pointerEvents} onChange={(v) => update({ interaction: { ...d.interaction, pointerEvents: v } })} />
        </div>
      </section>

      <section className={SECTION}>
        <h2 className="text-sm font-semibold text-white">Demo</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <TextField label="label" value={d.demo.label} onChange={(v) => update({ demo: { ...d.demo, label: v } })} />
          <label className="flex cursor-pointer items-center gap-2 text-sm text-neutral-300 sm:col-span-2">
            <input type="checkbox" className="rounded border-white/20" checked={d.demo.showDisabledPreview} onChange={(e) => update({ demo: { ...d.demo, showDisabledPreview: e.target.checked } })} />
            Vis disabled-forhåndsvisning
          </label>
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
