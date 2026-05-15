# Advanced Topics

This document covers advanced usage patterns.

## Anchor Types

The comment system supports several anchor types for precise location tracking.

### Text Selection

Select any text and click **Comment** to attach a thread. The anchor stores:

- `selectedText` — the highlighted string
- `prefix` / `suffix` — surrounding context for re-anchoring after edits
- `charStart` / `charEnd` — character offsets within the file

### Heading Anchors

Click the link icon next to a heading to anchor a comment to that heading.

## Sanitization

Markdown is treated as **untrusted input**. The pipeline applies `rehype-sanitize`
with an explicit allowlist derived from the GitHub Flavored Markdown spec:

```html
<!-- Allowed -->
<h1> through <h6>, <p>, <ul>, <ol>, <li>, <table>, <thead>, <tbody>,
<tr>, <th>, <td>, <pre>, <code>, <blockquote>, <strong>, <em>,
<a href="...">, <img src="..." alt="...">

<!-- Stripped -->
<script>, <style>, <iframe>, <form>, onerror=, onclick=, javascript:
```

## Path Safety

Every file path requested from the API is validated against the configured
source root before any filesystem access:

```typescript
import { assertSafe } from '@/lib/sources/pathSafety'

// Throws if path escapes the root (e.g. ../../etc/passwd)
assertSafe(sourceRoot, requestedPath)
```

## Related

- [Back to README](README.md)
- [Setup Guide](guide/setup.md)
