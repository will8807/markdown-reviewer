interface Props {
  content: string
}

export default function CodeListing({ content }: Props) {
  const lines = content === '' ? [] : content.replace(/\n$/, '').split('\n')

  return (
    <pre data-testid="code-listing" className="font-mono text-xs leading-5 overflow-x-auto">
      <table className="border-collapse w-full">
        <tbody>
          {lines.map((line, i) => (
            <tr key={i} data-testid="code-line">
              <td
                data-testid="code-line-number"
                className="select-none text-right text-zinc-400 dark:text-zinc-600 pr-4 pl-3 w-12 border-r border-zinc-200 dark:border-zinc-700"
              >
                {i + 1}
              </td>
              <td data-testid="code-line-content" className="px-4 whitespace-pre">
                {line}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </pre>
  )
}
