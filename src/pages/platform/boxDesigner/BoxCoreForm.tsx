import type { UiBoxCoreDesign } from '../../../types/uiBoxCore'
import { ColorField, NumberField, SelectField, TextField } from './sharedFields'
import { LABEL, PANEL, SECTION } from './fieldTokens'

type Props = {
  d: UiBoxCoreDesign
  update: (patch: Partial<UiBoxCoreDesign>) => void
}

export function BoxCoreForm({ d, update }: Props) {
  return (
    <>
      <section className={SECTION}>
        <h2 className="text-sm font-semibold text-white">Layout</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <TextField label="display" value={d.layout.display} onChange={(v) => update({ layout: { ...d.layout, display: v } })} />
          <TextField label="position" value={d.layout.position} onChange={(v) => update({ layout: { ...d.layout, position: v } })} />
          <TextField label="width" value={d.layout.width} onChange={(v) => update({ layout: { ...d.layout, width: v } })} />
          <TextField label="height" value={d.layout.height} onChange={(v) => update({ layout: { ...d.layout, height: v } })} />
          <TextField label="minHeight" value={d.layout.minHeight} onChange={(v) => update({ layout: { ...d.layout, minHeight: v } })} />
          <TextField label="margin" value={d.layout.margin} onChange={(v) => update({ layout: { ...d.layout, margin: v } })} />
          <TextField label="padding" value={d.layout.padding} onChange={(v) => update({ layout: { ...d.layout, padding: v } })} />
          <TextField label="overflow" value={d.layout.overflow} onChange={(v) => update({ layout: { ...d.layout, overflow: v } })} />
          <TextField label="zIndex" value={d.layout.zIndex} onChange={(v) => update({ layout: { ...d.layout, zIndex: v } })} />
        </div>
      </section>

      <section className={SECTION}>
        <h2 className="text-sm font-semibold text-white">Flexbox</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <TextField label="flexDirection" value={d.flexbox.flexDirection} onChange={(v) => update({ flexbox: { ...d.flexbox, flexDirection: v } })} />
          <TextField label="justifyContent" value={d.flexbox.justifyContent} onChange={(v) => update({ flexbox: { ...d.flexbox, justifyContent: v } })} />
          <TextField label="alignItems" value={d.flexbox.alignItems} onChange={(v) => update({ flexbox: { ...d.flexbox, alignItems: v } })} />
          <TextField label="gap" value={d.flexbox.gap} onChange={(v) => update({ flexbox: { ...d.flexbox, gap: v } })} />
          <TextField label="flexWrap" value={d.flexbox.flexWrap} onChange={(v) => update({ flexbox: { ...d.flexbox, flexWrap: v } })} />
        </div>
      </section>

      <section className={SECTION}>
        <h2 className="text-sm font-semibold text-white">Typografi</h2>
        <p className="mt-1 text-xs text-neutral-500">Base</p>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <TextField label="fontFamily" value={d.typography.base.fontFamily} onChange={(v) => update({ typography: { ...d.typography, base: { ...d.typography.base, fontFamily: v } } })} />
          <ColorField label="base color" value={d.typography.base.color} onChange={(v) => update({ typography: { ...d.typography, base: { ...d.typography.base, color: v } } })} />
          <SelectField
            label="textAlign"
            value={d.typography.base.textAlign as 'left' | 'center' | 'right' | 'justify'}
            options={[
              { value: 'left', label: 'left' },
              { value: 'center', label: 'center' },
              { value: 'right', label: 'right' },
              { value: 'justify', label: 'justify' },
            ]}
            onChange={(v) => update({ typography: { ...d.typography, base: { ...d.typography.base, textAlign: v } } })}
          />
          <TextField label="fontSize" value={d.typography.base.fontSize} onChange={(v) => update({ typography: { ...d.typography, base: { ...d.typography.base, fontSize: v } } })} />
          <TextField label="lineHeight" value={d.typography.base.lineHeight} onChange={(v) => update({ typography: { ...d.typography, base: { ...d.typography.base, lineHeight: v } } })} />
        </div>
        <p className="mt-4 text-xs text-neutral-500">Overskrift</p>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-neutral-300">
            <input
              type="checkbox"
              className="rounded border-white/20"
              checked={d.typography.heading.enabled}
              onChange={(e) => update({ typography: { ...d.typography, heading: { ...d.typography.heading, enabled: e.target.checked } } })}
            />
            Aktivert
          </label>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <TextField label="Tekst" value={d.typography.heading.text} onChange={(v) => update({ typography: { ...d.typography, heading: { ...d.typography.heading, text: v } } })} />
          <SelectField
            label="tag"
            value={d.typography.heading.tag}
            options={[
              { value: 'h1', label: 'h1' },
              { value: 'h2', label: 'h2' },
              { value: 'h3', label: 'h3' },
              { value: 'h4', label: 'h4' },
              { value: 'h5', label: 'h5' },
              { value: 'h6', label: 'h6' },
              { value: 'div', label: 'div' },
            ]}
            onChange={(v) => update({ typography: { ...d.typography, heading: { ...d.typography.heading, tag: v } } })}
          />
          <ColorField label="heading color" value={d.typography.heading.color} onChange={(v) => update({ typography: { ...d.typography, heading: { ...d.typography.heading, color: v } } })} />
          <TextField label="fontSize" value={d.typography.heading.fontSize} onChange={(v) => update({ typography: { ...d.typography, heading: { ...d.typography.heading, fontSize: v } } })} />
          <TextField label="fontWeight" value={d.typography.heading.fontWeight} onChange={(v) => update({ typography: { ...d.typography, heading: { ...d.typography.heading, fontWeight: v } } })} />
          <TextField label="lineHeight" value={d.typography.heading.lineHeight} onChange={(v) => update({ typography: { ...d.typography, heading: { ...d.typography.heading, lineHeight: v } } })} />
          <TextField label="letterSpacing" value={d.typography.heading.letterSpacing} onChange={(v) => update({ typography: { ...d.typography, heading: { ...d.typography.heading, letterSpacing: v } } })} />
          <TextField label="textTransform" value={d.typography.heading.textTransform} onChange={(v) => update({ typography: { ...d.typography, heading: { ...d.typography.heading, textTransform: v } } })} />
          <TextField label="marginBottom" value={d.typography.heading.marginBottom} onChange={(v) => update({ typography: { ...d.typography, heading: { ...d.typography.heading, marginBottom: v } } })} />
        </div>
      </section>

      <section className={SECTION}>
        <h2 className="text-sm font-semibold text-white">Styling og bakgrunn</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <ColorField label="backgroundColor" value={d.styling.backgroundColor} onChange={(v) => update({ styling: { ...d.styling, backgroundColor: v } })} />
          <NumberField label="opacity" value={d.styling.opacity} step={0.05} min={0} max={1} onChange={(v) => update({ styling: { ...d.styling, opacity: Math.min(1, Math.max(0, v)) } })} />
          <label className={`${LABEL} sm:col-span-2`}>
            backgroundGradient (CSS)
            <textarea
              value={d.styling.backgroundGradient}
              onChange={(e) => update({ styling: { ...d.styling, backgroundGradient: e.target.value } })}
              rows={2}
              placeholder="linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
              className={PANEL}
            />
          </label>
          <TextField label="backgroundImage" value={d.styling.backgroundImage} onChange={(v) => update({ styling: { ...d.styling, backgroundImage: v } })} />
          <TextField label="backgroundSize" value={d.styling.backgroundSize} onChange={(v) => update({ styling: { ...d.styling, backgroundSize: v } })} />
          <TextField label="backgroundPosition" value={d.styling.backgroundPosition} onChange={(v) => update({ styling: { ...d.styling, backgroundPosition: v } })} />
          <TextField label="backgroundAttachment" value={d.styling.backgroundAttachment} onChange={(v) => update({ styling: { ...d.styling, backgroundAttachment: v } })} />
          <TextField label="backgroundBlendMode" value={d.styling.backgroundBlendMode} onChange={(v) => update({ styling: { ...d.styling, backgroundBlendMode: v } })} />
        </div>
      </section>

      <section className={SECTION}>
        <h2 className="text-sm font-semibold text-white">Avanserte effekter</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <TextField label="backdropFilter" value={d.advancedVisuals.backdropFilter} onChange={(v) => update({ advancedVisuals: { ...d.advancedVisuals, backdropFilter: v } })} />
          <TextField label="filter" value={d.advancedVisuals.filter} onChange={(v) => update({ advancedVisuals: { ...d.advancedVisuals, filter: v } })} />
          <TextField label="clipPath" value={d.advancedVisuals.clipPath} onChange={(v) => update({ advancedVisuals: { ...d.advancedVisuals, clipPath: v } })} />
          <TextField label="mixBlendMode" value={d.advancedVisuals.mixBlendMode} onChange={(v) => update({ advancedVisuals: { ...d.advancedVisuals, mixBlendMode: v } })} />
        </div>
      </section>

      <section className={SECTION}>
        <h2 className="text-sm font-semibold text-white">Ramme og skygge</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <TextField label="borderWidth" value={d.borders.borderWidth} onChange={(v) => update({ borders: { ...d.borders, borderWidth: v } })} />
          <TextField label="borderStyle" value={d.borders.borderStyle} onChange={(v) => update({ borders: { ...d.borders, borderStyle: v } })} />
          <ColorField label="borderColor" value={d.borders.borderColor} onChange={(v) => update({ borders: { ...d.borders, borderColor: v } })} />
          <TextField label="borderRadius" value={d.borders.borderRadius} onChange={(v) => update({ borders: { ...d.borders, borderRadius: v } })} />
          <label className={`${LABEL} sm:col-span-2`}>
            boxShadow
            <textarea value={d.borders.boxShadow} onChange={(e) => update({ borders: { ...d.borders, boxShadow: e.target.value } })} rows={2} className={PANEL} />
          </label>
        </div>
      </section>

      <section className={SECTION}>
        <h2 className="text-sm font-semibold text-white">Transforms</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <NumberField label="scale" value={d.transforms.scale} step={0.05} min={0.1} max={3} onChange={(v) => update({ transforms: { ...d.transforms, scale: v } })} />
          <TextField label="rotate" value={d.transforms.rotate} onChange={(v) => update({ transforms: { ...d.transforms, rotate: v } })} />
          <TextField label="translateX" value={d.transforms.translateX} onChange={(v) => update({ transforms: { ...d.transforms, translateX: v } })} />
          <TextField label="translateY" value={d.transforms.translateY} onChange={(v) => update({ transforms: { ...d.transforms, translateY: v } })} />
          <TextField label="skewX" value={d.transforms.skewX} onChange={(v) => update({ transforms: { ...d.transforms, skewX: v } })} />
          <TextField label="skewY" value={d.transforms.skewY} onChange={(v) => update({ transforms: { ...d.transforms, skewY: v } })} />
          <TextField label="transformOrigin" value={d.transforms.transformOrigin} onChange={(v) => update({ transforms: { ...d.transforms, transformOrigin: v } })} />
        </div>
      </section>

      <section className={SECTION}>
        <h2 className="text-sm font-semibold text-white">Animasjon</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <TextField label="transitionProperty" value={d.animation.transitionProperty} onChange={(v) => update({ animation: { ...d.animation, transitionProperty: v } })} />
          <TextField label="transitionDuration" value={d.animation.transitionDuration} onChange={(v) => update({ animation: { ...d.animation, transitionDuration: v } })} />
          <TextField label="transitionTimingFunction" value={d.animation.transitionTimingFunction} onChange={(v) => update({ animation: { ...d.animation, transitionTimingFunction: v } })} />
          <TextField label="transitionDelay" value={d.animation.transitionDelay} onChange={(v) => update({ animation: { ...d.animation, transitionDelay: v } })} />
          <TextField label="entranceAnimation" value={d.animation.entranceAnimation} onChange={(v) => update({ animation: { ...d.animation, entranceAnimation: v } })} />
        </div>
      </section>

      <section className={SECTION}>
        <h2 className="text-sm font-semibold text-white">Interaksjon (hover)</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <TextField label="cursor" value={d.interaction.cursor} onChange={(v) => update({ interaction: { ...d.interaction, cursor: v } })} />
          <ColorField
            label="hover backgroundColor"
            value={d.interaction.hoverState.backgroundColor || '#ffffff'}
            onChange={(v) => update({ interaction: { ...d.interaction, hoverState: { ...d.interaction.hoverState, backgroundColor: v } } })}
          />
          <NumberField
            label="hover scale"
            value={d.interaction.hoverState.scale}
            step={0.05}
            min={0.5}
            max={2}
            onChange={(v) => update({ interaction: { ...d.interaction, hoverState: { ...d.interaction.hoverState, scale: v } } })}
          />
          <label className={`${LABEL} sm:col-span-2`}>
            hover boxShadow
            <textarea
              value={d.interaction.hoverState.boxShadow}
              onChange={(e) => update({ interaction: { ...d.interaction, hoverState: { ...d.interaction.hoverState, boxShadow: e.target.value } } })}
              rows={2}
              className={PANEL}
            />
          </label>
          <TextField label="hover rotate" value={d.interaction.hoverState.rotate} onChange={(v) => update({ interaction: { ...d.interaction, hoverState: { ...d.interaction.hoverState, rotate: v } } })} />
          <TextField label="onClick (merknad)" value={d.interaction.onClick} onChange={(v) => update({ interaction: { ...d.interaction, onClick: v } })} />
        </div>
      </section>

      <section className={SECTION}>
        <h2 className="text-sm font-semibold text-white">Data (valgfritt)</h2>
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
