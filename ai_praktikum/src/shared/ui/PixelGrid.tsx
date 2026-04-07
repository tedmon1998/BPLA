interface PixelGridProps {
  rows?: number
  cols?: number
}

export function PixelGrid({ rows = 10, cols = 8 }: PixelGridProps) {
  return (
    <div
      className="pixel-grid"
      style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
      aria-label="Сетка ввода"
    >
      {Array.from({ length: rows * cols }).map((_, index) => (
        <button
          key={index}
          type="button"
          className="pixel-cell"
          aria-label={`Ячейка ${index + 1}`}
        />
      ))}
    </div>
  )
}
