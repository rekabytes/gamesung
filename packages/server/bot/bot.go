package bot

import (
	"math/rand"

	"github.com/notnil/chess"
)

var pieceValues = map[chess.PieceType]int{
	chess.Pawn:   100,
	chess.Knight: 320,
	chess.Bishop: 330,
	chess.Rook:   500,
	chess.Queen:  900,
	chess.King:   20000,
}

// Piece-square tables (white-perspective, rank 8 at index 0 .. rank 1 at index 7).
// Black mirrors the rank index. Values are added to the base material value.
// Source: simplified evaluation tables (Tomasz Michniewski / Chess Programming Wiki).
var pawnPST = [8][8]int{
	{0, 0, 0, 0, 0, 0, 0, 0},
	{50, 50, 50, 50, 50, 50, 50, 50},
	{10, 10, 20, 30, 30, 20, 10, 10},
	{5, 5, 10, 25, 25, 10, 5, 5},
	{0, 0, 0, 20, 20, 0, 0, 0},
	{5, -5, -10, 0, 0, -10, -5, 5},
	{5, 10, 10, -20, -20, 10, 10, 5},
	{0, 0, 0, 0, 0, 0, 0, 0},
}

var knightPST = [8][8]int{
	{-50, -40, -30, -30, -30, -30, -40, -50},
	{-40, -20, 0, 0, 0, 0, -20, -40},
	{-30, 0, 10, 15, 15, 10, 0, -30},
	{-30, 5, 15, 20, 20, 15, 5, -30},
	{-30, 0, 15, 20, 20, 15, 0, -30},
	{-30, 5, 10, 15, 15, 10, 5, -30},
	{-40, -20, 0, 5, 5, 0, -20, -40},
	{-50, -40, -30, -30, -30, -30, -40, -50},
}

// King PST for midgame: encourage castled position (corners), penalize center.
var kingPST = [8][8]int{
	{-30, -40, -40, -50, -50, -40, -40, -30},
	{-30, -40, -40, -50, -50, -40, -40, -30},
	{-30, -40, -40, -50, -50, -40, -40, -30},
	{-30, -40, -40, -50, -50, -40, -40, -30},
	{-20, -30, -30, -40, -40, -30, -30, -20},
	{-10, -20, -20, -20, -20, -20, -20, -10},
	{20, 20, 0, 0, 0, 0, 20, 20},
	{20, 30, 10, 0, 0, 10, 30, 20},
}

const (
	mateScore   = 99999
	mobilityMul = 2
)

type Bot struct {
	Depth int
	rng   *rand.Rand
}

func NewBot(depth int) *Bot {
	if depth < 1 {
		depth = 2
	}
	return &Bot{Depth: depth, rng: rand.New(rand.NewSource(rand.Int63()))}
}

func (b *Bot) GetMove(game *chess.Game) *chess.Move {
	validMoves := game.ValidMoves()
	if len(validMoves) == 0 {
		return nil
	}

	if b.Depth <= 1 {
		return b.pickBestMove(game, validMoves)
	}

	bestScore := -mateScore - 1
	candidates := []*chess.Move{}

	for _, move := range validMoves {
		cloned := game.Clone()
		if err := cloned.Move(move); err != nil {
			continue
		}

		score := -b.minimax(cloned, b.Depth-1, -mateScore, mateScore)
		if score > bestScore {
			bestScore = score
			candidates = []*chess.Move{move}
		} else if score == bestScore {
			candidates = append(candidates, move)
		}
	}

	if len(candidates) == 0 {
		return validMoves[b.rng.Intn(len(validMoves))]
	}
	return candidates[b.rng.Intn(len(candidates))]
}

func (b *Bot) minimax(game *chess.Game, depth int, alpha, beta int) int {
	if depth == 0 || game.Outcome() != chess.NoOutcome {
		return b.evaluate(game)
	}

	validMoves := game.ValidMoves()
	if len(validMoves) == 0 {
		return b.evaluate(game)
	}

	bestScore := -mateScore - 1
	for _, move := range validMoves {
		cloned := game.Clone()
		if err := cloned.Move(move); err != nil {
			continue
		}

		score := -b.minimax(cloned, depth-1, -beta, -alpha)
		if score > bestScore {
			bestScore = score
		}
		if score > alpha {
			alpha = score
		}
		if alpha >= beta {
			break
		}
	}

	return bestScore
}

func (b *Bot) evaluate(game *chess.Game) int {
	pos := game.Position()
	board := pos.Board()

	var score int

	for sq := chess.A1; sq <= chess.H8; sq++ {
		piece := board.Piece(sq)
		if piece == chess.NoPiece {
			continue
		}

		score += pieceScore(piece, sq)
	}

	moves := pos.ValidMoves()
	if pos.Turn() == chess.White {
		score += len(moves) * mobilityMul
	} else {
		score -= len(moves) * mobilityMul
	}

	if pos.Turn() == chess.Black {
		score = -score
	}

	return score
}

func (b *Bot) pickBestMove(game *chess.Game, moves []*chess.Move) *chess.Move {
	bestScore := -mateScore - 1
	candidates := []*chess.Move{}

	for _, move := range moves {
		cloned := game.Clone()
		if err := cloned.Move(move); err != nil {
			continue
		}

		score := b.evaluate(cloned)
		if score > bestScore {
			bestScore = score
			candidates = []*chess.Move{move}
		} else if score == bestScore {
			candidates = append(candidates, move)
		}
	}

	if len(candidates) == 0 {
		return moves[b.rng.Intn(len(moves))]
	}
	return candidates[b.rng.Intn(len(candidates))]
}

func pieceScore(piece chess.Piece, sq chess.Square) int {
	base := pieceValues[piece.Type()]

	var pst int
	rank := sq.Rank()
	file := sq.File()
	rankIdx := 7 - int(rank)
	if piece.Color() == chess.Black {
		rankIdx = int(rank)
	}

	switch piece.Type() {
	case chess.Pawn:
		pst = pawnPST[rankIdx][int(file)]
	case chess.Knight:
		pst = knightPST[rankIdx][int(file)]
	case chess.King:
		pst = kingPST[rankIdx][int(file)]
	}

	value := base + pst
	if piece.Color() == chess.White {
		return value
	}
	return -value
}
