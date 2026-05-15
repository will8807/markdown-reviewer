'use client'

interface Props {
  html: string
}

export default function MarkdownViewer({ html }: Props) {
  return (
    <article
      className="prose prose-zinc dark:prose-invert max-w-none p-8"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
