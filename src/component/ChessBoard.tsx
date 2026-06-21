import type { CSSProperties, DragEvent } from 'react'
import type { Color, Square } from '../types'

export const pieceImages: Record<string, string> = {
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
  const ranks = orientation === 'black' ? ['1', '2', '3', '4', '5', '6', '7', '8'] : ['8', '7', '6', '5', '4', '3', '2', '1']
  const files = orientation === 'black' ? ['h', 'g', 'f', 'e', 'd', 'c', 'b', 'a'] : ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']

  return (
    <div className="board-frame">
      <div className="chess-board" aria-label="Chess board">
        {squares.map((square) => {
          const position = getPosition(square.name, orientation)
          return (
            <button
              className={selectedSquare === square.name ? 'square selected' : 'square'}
              key={square.name}
              onClick={() => onSquareClick?.(square)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => onDrop?.(square, event)}
              style={{ '--file': position.file, '--rank': position.rank } as CSSProperties}
              type="button"
            >
              {square.piece && (
                <img src={pieceImages[square.piece]} alt={square.piece} draggable={!!onDragStart} onDragStart={(event) => onDragStart?.(square, event)} />
              )}
            </button>
          )
        })}
        <svg viewBox="0 0 100 100" className="coordinates" aria-hidden="true">
          {ranks.map((rank, index) => (
            <text key={rank} x="1.2" y={3.8 + index * 12.5} fontSize="2.8" className={index % 2 === 0 ? 'coordinate-light' : 'coordinate-dark'}>{rank}</text>
          ))}
          {files.map((file, index) => (
            <text key={file} x={10.1 + index * 12.5} y="98.6" fontSize="2.8" className={index % 2 === 0 ? 'coordinate-dark' : 'coordinate-light'}>{file}</text>
          ))}
        </svg>
      </div>
    </div>
  )
}

function getPosition(square: string, orientation: Color) {
  const file = square.charCodeAt(0) - 97
  const rank = 8 - Number(square[1])
  return orientation === 'black'
    ? { file: 7 - file, rank: 7 - rank }
    : { file, rank }
}
