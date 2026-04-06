import { PRODUCT_ROADMAP } from '../data/productRoadmap'

export function ProductRoadmapList() {
  return (
    <ul className="mt-8 space-y-4">
      {PRODUCT_ROADMAP.map((item) => (
        <li
          key={item.title}
          className="rounded-xl border border-neutral-200/90 bg-[#faf8f4]/80 p-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold text-[#1a3d32]">{item.title}</h2>
            <span className="rounded-full bg-white px-2.5 py-0.5 text-xs font-medium text-neutral-600 ring-1 ring-neutral-200">
              {item.status}
            </span>
          </div>
          <p className="mt-2 text-sm text-neutral-600">{item.body}</p>
        </li>
      ))}
    </ul>
  )
}
