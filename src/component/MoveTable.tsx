export function MoveTable({ rows, emptyText }: { rows: { number: number; white: string; black: string }[]; emptyText: string }) {
  return (
    <div className="moves-table">
      <div className="moves-head"><span>#</span><span>White</span><span>Black</span></div>
      {rows.length === 0 && <span className="empty compact">{emptyText}</span>}
      {rows.map((row) => (
        <div className="moves-row" key={row.number}>
          <span>{row.number}</span>
          <span>{row.white}</span>
          <span>{row.black}</span>
        </div>
      ))}
    </div>
  )
}
