interface ProtocolPanelProps {
  title?: string
  lines: string[]
}

export function ProtocolPanel({
  title = 'Протокол выполнения',
  lines,
}: ProtocolPanelProps) {
  return (
    <article className="panel">
      <h3>{title}</h3>
      <div className="protocol-box">
        <ol>
          {lines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ol>
      </div>
    </article>
  )
}
