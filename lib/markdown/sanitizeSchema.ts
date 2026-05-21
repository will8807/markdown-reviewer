import { defaultSchema } from 'rehype-sanitize'
import type { Options as Schema } from 'rehype-sanitize'

type AttrList = NonNullable<NonNullable<Schema['attributes']>[string]>

function attrs(key: string, extra: AttrList): AttrList {
  const base = (defaultSchema.attributes?.[key] ?? []) as AttrList
  return [...base, ...extra]
}

export const sanitizeSchema: Schema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    // Allow shiki's style attributes for syntax highlighting
    pre: attrs('pre', ['style', 'tabIndex', ['className', /^shiki/]]),
    code: attrs('code', ['style']),
    span: attrs('span', ['style']),
    // Allow id attributes on headings for rehype-slug + rehype-autolink-headings
    h1: attrs('h1', ['id']),
    h2: attrs('h2', ['id']),
    h3: attrs('h3', ['id']),
    h4: attrs('h4', ['id']),
    h5: attrs('h5', ['id']),
    h6: attrs('h6', ['id']),
    a: attrs('a', ['ariaHidden']),
    // Allow data attributes used by the diff viewer
    '*': attrs('*', ['dataSourceStart', 'dataSourceEnd']),
    img: attrs('img', ['dataComparePath']),
  },
}
