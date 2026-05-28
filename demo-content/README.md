# Demo Project

Welcome to the demo content for Markdown Reviewer.

## Navigation

- [Advanced Topics](advanced.md)
- [Setup Guide](guide/setup.md)
- [Broken Link](this-file-does-not-exist.md)
- [Also Missing](guide/nonexistent.md)

## Project Files

- [package.json](package.json) — dependencies and scripts
- [tsconfig.json](tsconfig.json) — TypeScript configuration
- [Dockerfile](Dockerfile) — container image
- [eslint.config.js](eslint.config.js) — linting rules
- [config/site.yaml](config/site.yaml) — site metadata and nav
- [scripts/publish.sh](scripts/publish.sh) — CI publish script
- [src/lib/mdx.ts](src/lib/mdx.ts) — markdown rendering utility
- [src/components/DocLayout.tsx](src/components/DocLayout.tsx) — page layout component

## Features at a Glance

| Feature            | Status | Notes                        |
| ------------------ | ------ | ---------------------------- |
| GFM tables         | ✅     | Column alignment supported   |
| Task lists         | ✅     | Rendered as checkboxes       |
| Fenced code blocks | ✅     | Syntax highlighting via Shiki |
| Image rendering    | ✅     | With broken-image fallback   |
| Comment threads    | ✅     | Text-selection anchors       |

## Task List

- [x] Set up the project
- [x] Write the schema
- [ ] Add full-text search
- [ ] Export to PDF

## Code Example

```typescript
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import remarkRehype from 'remark-rehype'
import rehypeSanitize from 'rehype-sanitize'
import rehypeStringify from 'rehype-stringify'

const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkRehype)
  .use(rehypeSanitize)
  .use(rehypeStringify)

const html = String(await processor.process(markdown))
```

## Images

Working image:

![Project logo](assets/logo.png)

Missing image (should render a fallback):

![Missing asset](assets/missing.png)
