export function MoveTable(
  { rows, emptyText, activeMoveIndex }:
    { rows: { number: number; white: string; black: string }[]; emptyText: string; activeMoveIndex?: number }
) {
  return (
    <div className="moves-table">
      <div className="moves-head"><span>#</span><span>White</span><span>Black</span></div>
      {rows.length === 0 && <span className="empty compact">{emptyText}</span>}
      {rows.map((row) => {
        const whiteMoveIndex = row.number * 2 - 1
        const blackMoveIndex = row.number * 2

        return (
          <div className="moves-row" key={row.number}>
            <span>{row.number}</span>
            <span className={activeMoveIndex === whiteMoveIndex ? 'move-active' : undefined}>{row.white}</span>
            <span className={activeMoveIndex === blackMoveIndex ? 'move-active' : undefined}>{row.black}</span>
          </div>
        )
      })}
    </div>
  )
}
