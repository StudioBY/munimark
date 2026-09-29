/**
 * Structured data for crawlers and language models, rendered into the static
 * HTML. A plain <script>, not next/script: this is data, not code to execute.
 *
 * `<` is escaped so a value from the database (a Wikipedia lead, a name) can
 * never close the tag early — see the Next.js JSON-LD guide.
 */
export default function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }}
    />
  )
}
