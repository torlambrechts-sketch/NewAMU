import { useLearning } from '../../hooks/useLearning'
import { PIN_GREEN } from '../../components/learning/LearningLayout'

export function LearningSettings() {
  const { resetDemo } = useLearning()

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="font-serif text-3xl font-semibold text-[#2D403A]">Settings</h1>
        <p className="mt-2 text-sm text-neutral-600">Learning data is stored in localStorage for this demo.</p>
      </div>
      <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
        <h2 className="font-semibold text-[#2D403A]">Reset demo data</h2>
        <p className="mt-2 text-sm text-neutral-600">
          Clears courses, progress, and certificates and restores the seed &quot;Safety 101&quot; course.
        </p>
        <button
          type="button"
          onClick={() => {
            if (confirm('Reset all learning data in this browser?')) resetDemo()
          }}
          className="mt-4 rounded-lg px-4 py-2 text-sm font-medium text-white"
          style={{ backgroundColor: PIN_GREEN }}
        >
          Reset learning data
        </button>
      </div>
    </div>
  )
}
