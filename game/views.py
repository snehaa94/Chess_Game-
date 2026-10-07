import json
import chess

from django.http import JsonResponse
from django.shortcuts import render
from django.views.decorators.http import require_POST

SESSION_KEY = "chess_fen_history"

def _get_board(request):
    history = request.session.get(SESSION_KEY)
    if not history:
        history = [chess.Board().fen()]
        request.session[SESSION_KEY] = history
    return chess.Board(history[-1]), history

def _serialize(board, history):
    return {
        "fen": board.fen(),
        "board": board.board_fen(),
        "turn": "White" if board.turn == chess.WHITE else "Black",
        "status": _status(board),
        "history_count": max(0, len(history) - 1),
        "game_over": board.is_game_over(),
    }

def _status(board):
    if board.is_checkmate():
        winner = "Black" if board.turn == chess.WHITE else "White"
        return f"Checkmate — {winner} wins!"
    if board.is_stalemate():
        return "Draw — stalemate."
    if board.is_insufficient_material():
        return "Draw — insufficient material."
    if board.is_fivefold_repetition():
        return "Draw — fivefold repetition."
    if board.is_seventyfive_moves():
        return "Draw — 75-move rule."
    if board.is_check():
        side = "White" if board.turn == chess.WHITE else "Black"
        return f"{side} is in check."
    side = "White" if board.turn == chess.WHITE else "Black"
    return f"{side} to move."

def index(request):
    return render(request, "game/index.html")

@require_POST
def new_game(request):
    board = chess.Board()
    request.session[SESSION_KEY] = [board.fen()]
    request.session.modified = True
    return JsonResponse(_serialize(board, [board.fen()]))

@require_POST
def make_move(request):
    try:
        data = json.loads(request.body or "{}")
        source = data.get("source", "")
        target = data.get("target", "")
        promotion = data.get("promotion", "q").lower()
        if len(source) != 2 or len(target) != 2:
            raise ValueError("Invalid square.")

        board, history = _get_board(request)
        move = chess.Move.from_uci(source + target)

        # Auto-promote to queen unless the frontend explicitly requests another piece.
        if (
            board.piece_at(move.from_square)
            and board.piece_at(move.from_square).piece_type == chess.PAWN
            and chess.square_rank(move.to_square) in (0, 7)
        ):
            move = chess.Move(
                move.from_square,
                move.to_square,
                promotion={
                    "q": chess.QUEEN,
                    "r": chess.ROOK,
                    "b": chess.BISHOP,
                    "n": chess.KNIGHT,
                }.get(promotion, chess.QUEEN),
            )

        if move not in board.legal_moves:
            return JsonResponse({"ok": False, "error": "That move is not legal."}, status=400)

        san = board.san(move)
        board.push(move)
        history.append(board.fen())
        request.session[SESSION_KEY] = history[-100:]
        request.session.modified = True

        response = _serialize(board, request.session[SESSION_KEY])
        response.update({"ok": True, "san": san, "last_move": source + target})
        return JsonResponse(response)

    except (ValueError, KeyError, json.JSONDecodeError):
        return JsonResponse({"ok": False, "error": "Invalid move request."}, status=400)

@require_POST
def undo_move(request):
    board, history = _get_board(request)
    if len(history) <= 1:
        return JsonResponse({"ok": False, "error": "Nothing to undo."}, status=400)

    history.pop()
    board = chess.Board(history[-1])
    request.session[SESSION_KEY] = history
    request.session.modified = True
    response = _serialize(board, history)
    response["ok"] = True
    return JsonResponse(response)
