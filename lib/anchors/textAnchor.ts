export interface TextAnchorData {
  filePath: string
  selectedText: string
  prefix: string
  suffix: string
  charStart: number
  charEnd: number
}

const CONTEXT_LENGTH = 64

export function serializeSelection(
  text: string,
  selectionStart: number,
  selectionEnd: number,
  filePath: string
): TextAnchorData {
  const prefix = text.slice(Math.max(0, selectionStart - CONTEXT_LENGTH), selectionStart)
  const suffix = text.slice(selectionEnd, selectionEnd + CONTEXT_LENGTH)
  return {
    filePath,
    selectedText: text.slice(selectionStart, selectionEnd),
    prefix,
    suffix,
    charStart: selectionStart,
    charEnd: selectionEnd,
  }
}

export interface AnchorLocation {
  charStart: number
  charEnd: number
  exact: boolean
}

export function findAnchor(text: string, anchor: TextAnchorData): AnchorLocation | null {
  // 1. Try exact match with context
  const withContext = anchor.prefix + anchor.selectedText + anchor.suffix
  const contextIdx = text.indexOf(withContext)
  if (contextIdx !== -1) {
    const start = contextIdx + anchor.prefix.length
    return { charStart: start, charEnd: start + anchor.selectedText.length, exact: true }
  }

  // 2. Try prefix + selected text
  const withPrefix = anchor.prefix + anchor.selectedText
  const prefixIdx = text.indexOf(withPrefix)
  if (prefixIdx !== -1) {
    const start = prefixIdx + anchor.prefix.length
    return { charStart: start, charEnd: start + anchor.selectedText.length, exact: false }
  }

  // 3. Fall back to selectedText alone (first occurrence)
  const textIdx = text.indexOf(anchor.selectedText)
  if (textIdx !== -1) {
    return {
      charStart: textIdx,
      charEnd: textIdx + anchor.selectedText.length,
      exact: false,
    }
  }

  return null
}
