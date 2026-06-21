import type { DragEvent } from 'react'
import type { Color, Square } from '../types'

const pieceImages: Record<string, string> = {
  p: new URL('../assets/chess/chessman/default/bp.png', import.meta.url).href,
  r: new URL('../assets/chess/chessman/default/br.png', import.meta.url).href,
  n: new URL('../assets/chess/chessman/default/bn.png', import.meta.url).href,
  b: new URL('../assets/chess/chessman/default/bb.png', import.meta.url).href,
  q: new URL('../assets/chess/chessman/default/bq.png', import.meta.url).href,
  k: new URL('../assets/chess/chessman/default/bk.png', import.meta.url).href,
  P: new URL('../assets/chess/chessman/default/wp.png', import.meta.url).href,
  R: new URL('../assets/chess/chessman/default/wr.png', import.meta.url).href,
  N: new URL('../assets/chess/chessman/default/wn.png', import.meta.url).href,
  B: new URL('../assets/chess/chessman/default/wb.png', import.meta.url).href,
  Q: new URL('../assets/chess/chessman/default/wq.png', import.meta.url).href,
  K: new URL('../assets/chess/chessman/default/wk.png', import.meta.url).href,
}

export function ChessBoard({
  squares,
  orientation,
  selectedSquare,
  onDragStart,
  onDrop,
  onSquareClick,
}: {
  squares: Square[]
  orientation: Color
  selectedSquare?: string | null
  onDragStart?: (square: Square, event: DragEvent<HTMLImageElement>) => void
  onDrop?: (square: Square, event: DragEvent<HTMLButtonElement>) => void
  onSquareClick?: (square: Square) => void
}) {
  const files = orientation === 'black' ? ['h', 'g', 'f', 'e', 'd', 'c', 'b', 'a'] : ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
  const ranks = orientation === 'black' ? ['1', '2', '3', '4', '5', '6', '7', '8'] : ['8', '7', '6', '5', '4', '3', '2', '1']

  return (
    <div className="board-frame">
      <div className="rank-labels" aria-hidden="true">
        {ranks.map((rank) => <span key={rank}>{rank}</span>)}
      </div>
      <div className="chess-board" aria-label="Chess board">
        {squares.map((square) => (
          <button className={selectedSquare === square.name ? 'square selected' : 'square'} key={square.name} onClick={() => onSquareClick?.(square)} onDragOver={(event) => event.preventDefault()} onDrop={(event) => onDrop?.(square, event)} type="button">
            {square.piece && (
              <img src={pieceImages[square.piece]} alt={square.piece} draggable={!!onDragStart} onDragStart={(event) => onDragStart?.(square, event)} />
            )}
          </button>
        ))}
      </div>
      <div className="file-labels" aria-hidden="true">
        {files.map((file) => <span key={file}>{file}</span>)}
      </div>
    </div>
  )
}
