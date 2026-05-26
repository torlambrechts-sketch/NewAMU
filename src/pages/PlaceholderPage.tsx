import { Link } from 'react-router-dom'
import { PageContainer } from '../components/layout/PageContainer'

type Props = { title: string; description?: string }

export function PlaceholderPage({ title, description }: Props) {
  return (
    <PageContainer py="py-16">
      <h1
        className="text-2xl font-semibold text-neutral-900 md:text-3xl"
        style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}
      >
        {title}
      </h1>
      {description ? <p className="mt-2 text-neutral-600">{description}</p> : null}
      <p className="mt-6 text-sm text-neutral-500">
        This section is a placeholder. Wire it up when you define the rest of the product.
      </p>
      <Link
        to="/"
        className="mt-4 inline-block text-sm font-medium text-[#1a3d32] underline-offset-2 hover:underline"
      >
        ← Back to project dashboard
      </Link>
    </PageContainer>
  )
}
