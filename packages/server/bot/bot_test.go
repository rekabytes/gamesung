package bot

import (
	"testing"

	"github.com/notnil/chess"
)

func TestGetMoveReturnsNonKnightFromStart(t *testing.T) {
	notKnight := 0
	for i := 0; i < 50; i++ {
		g := chess.NewGame()
		b := NewBot(2)
		m := b.GetMove(g)
		if m == nil {
			t.Fatalf("expected a move, got nil")
		}
		p := g.Position().Board().Piece(m.S1())
		if p.Type() != chess.Knight {
			notKnight++
		}
	}
	if notKnight == 0 {
		t.Fatalf("expected bot to play at least one non-knight move across 50 trials")
	}
}

func TestGetMoveReturnsValidMove(t *testing.T) {
	g := chess.NewGame()
	b := NewBot(2)
	m := b.GetMove(g)
	if m == nil {
		t.Fatalf("expected a move, got nil")
	}
	if err := g.Move(m); err != nil {
		t.Fatalf("bot returned an illegal move: %v", err)
	}
}
