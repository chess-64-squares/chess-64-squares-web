import { AppDialog } from './AppDialog'
import { pieceImages } from './ChessBoard'
import type { Color } from '../types'

const options = [
  { value: 'q', label: 'Queen', piece: 'q' },
  { value: 'r', label: 'Rook', piece: 'r' },
  { value: 'b', label: 'Bishop', piece: 'b' },
  { value: 'n', label: 'Knight', piece: 'n' },
] as const

export type PromotionPiece = typeof options[number]['value']

export function PromotionDialog({
  color,
  onSelect,
  onCancel,
}: {
  color: Color
  onSelect: (piece: PromotionPiece) => void
  onCancel: () => void
}) {
  return (
    <AppDialog title="Choose promotion" message="Select the piece for your pawn promotion.">
      <div className="promotion-options">
        {options.map((option) => {
          const pieceCode = color === 'white' ? option.piece.toUpperCase() : option.piece
          return (
            <button className="promotion-option" key={option.value} onClick={() => onSelect(option.value)} type="button" title={option.label}>
              <img src={pieceImages[pieceCode]} alt={option.label} />
              <span>{option.label}</span>
            </button>
          )
        })}
      </div>
      <button className="button tertiary" onClick={onCancel}>Cancel</button>
    </AppDialog>
  )
}
