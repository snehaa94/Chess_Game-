const boardEl = document.getElementById("chessboard");
const statusEl = document.getElementById("status");
const turnPill = document.getElementById("turnPill");
const movesEl = document.getElementById("moves");
const moveCountEl = document.getElementById("moveCount");
const whiteCapturedEl = document.getElementById("whiteCaptured");
const blackCapturedEl = document.getElementById("blackCaptured");

const PIECES = {
    wK:"♔", wQ:"♕", wR:"♖", wB:"♗", wN:"♘", wP:"♙",
    bK:"♚", bQ:"♛", bR:"♜", bB:"♝", bN:"♞", bP:"♟"
};
const pieceValues = {p:1,n:3,b:3,r:5,q:9,k:0};

let state = { board: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR", turn:"White", status:"White to move.", history_count:0, game_over:false };
let selected = null;
let legalTargets = [];
let flipped = false;
let moveHistory = [];
let capturedWhite = [];
let capturedBlack = [];

function csrf() {
    return window.CHESS_CSRF;
}

async function post(url, body={}) {
    const response = await fetch(url, {
        method:"POST",
        headers:{
            "Content-Type":"application/json",
            "X-CSRFToken": csrf()
        },
        credentials:"same-origin",
        body: JSON.stringify(body)
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Request failed");
    return data;
}

function fenToBoard(fenBoard) {
    const rows = fenBoard.split("/");
    const result = [];
    for (const row of rows) {
        const expanded = [];
        for (const ch of row) {
            if (/[1-8]/.test(ch)) {
                for (let i=0;i<Number(ch);i++) expanded.push(null);
            } else {
                expanded.push(ch);
            }
        }
        result.push(expanded);
    }
    return result;
}

function squareName(row, col) {
    return "abcdefgh"[col] + (8-row);
}

function render() {
    const board = fenToBoard(state.board);
    boardEl.innerHTML = "";
    for (let visualRow=0; visualRow<8; visualRow++) {
        for (let visualCol=0; visualCol<8; visualCol++) {
            const row = flipped ? 7-visualRow : visualRow;
            const col = flipped ? 7-visualCol : visualCol;
            const sq = squareName(row,col);
            const piece = board[row][col];

            const cell = document.createElement("div");
            cell.className = "square " + ((row+col)%2===0 ? "light" : "dark");
            cell.dataset.square = sq;

            if (selected === sq) cell.classList.add("selected");
            if (legalTargets.includes(sq)) {
                cell.classList.add(piece ? "capture" : "legal");
            }

            if (piece) {
                const color = piece === piece.toUpperCase() ? "w" : "b";
                cell.textContent = PIECES[color + piece.toUpperCase()];
                cell.title = sq;
            }

            if (visualRow === 7) {
                const file = document.createElement("span");
                file.className = "coord-file";
                file.textContent = "abcdefgh"[col];
                cell.appendChild(file);
            }
            if (visualCol === 0) {
                const rank = document.createElement("span");
                rank.className = "coord-rank";
                rank.textContent = 8-row;
                cell.appendChild(rank);
            }

            cell.addEventListener("click", () => handleSquare(sq));
            boardEl.appendChild(cell);
        }
    }
    statusEl.textContent = state.status;
    turnPill.textContent = state.game_over ? "GAME OVER" : state.turn.toUpperCase() + "'S TURN";
    moveCountEl.textContent = `${state.history_count} move${state.history_count===1?"":"s"}`;
    renderMoves();
    renderCaptured();
}

function handleSquare(sq) {
    if (state.game_over) return;

    const board = fenToBoard(state.board);
    const col = "abcdefgh".indexOf(sq[0]);
    const row = 8-Number(sq[1]);
    const piece = board[row][col];

    if (!selected) {
        if (!piece) return;
        const isWhite = piece === piece.toUpperCase();
        if ((state.turn === "White") !== isWhite) return;
        selected = sq;
        legalTargets = []; // backend remains authoritative
        // Highlight candidate destinations using a simple UI heuristic.
        legalTargets = candidateSquares(sq, board);
        render();
        return;
    }

    if (sq === selected) {
        selected = null;
        legalTargets = [];
        render();
        return;
    }

    if (piece && ((state.turn === "White") === (piece === piece.toUpperCase()))) {
        selected = sq;
        legalTargets = candidateSquares(sq, board);
        render();
        return;
    }

    makeMove(selected, sq);
}

function candidateSquares(from, board) {
    // Visual candidates only. The Python backend performs the real legality check.
    const file = "abcdefgh".indexOf(from[0]);
    const rank = Number(from[1]);
    const p = board[8-rank][file];
    if (!p) return [];
    const white = p === p.toUpperCase();
    const type = p.toLowerCase();
    const out = [];

    function add(r,c) {
        if (r<0||r>7||c<0||c>7) return false;
        const target = board[r][c];
        if (!target) { out.push(squareName(r,c)); return true; }
        if ((target === target.toUpperCase()) !== white) out.push(squareName(r,c));
        return false;
    }

    if (type === "n") {
        [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]].forEach(([dr,dc])=>add(8-rank+dr,file+dc));
    } else if (type === "k") {
        for(let dr=-1;dr<=1;dr++) for(let dc=-1;dc<=1;dc++) if(dr||dc) add(8-rank+dr,file+dc);
    } else {
        const dirs = [];
        if(type==="b"||type==="q") dirs.push([-1,-1],[-1,1],[1,-1],[1,1]);
        if(type==="r"||type==="q") dirs.push([-1,0],[1,0],[0,-1],[0,1]);
        if(type==="p") {
            const dir = white ? -1 : 1;
            add(8-rank+dir,file);
            if ((white && rank===2) || (!white && rank===7)) add(8-rank+2*dir,file);
            [[dir,-1],[dir,1]].forEach(([dr,dc])=>{
                const rr=8-rank+dr, cc=file+dc;
                if(rr>=0&&rr<8&&cc>=0&&cc<8&&board[rr][cc] && ((board[rr][cc]===board[rr][cc].toUpperCase())!==white)) out.push(squareName(rr,cc));
            });
        } else {
            for (const [dr,dc] of dirs) {
                let rr=8-rank+dr, cc=file+dc;
                while(rr>=0&&rr<8&&cc>=0&&cc<8) {
                    if(!add(rr,cc)) break;
                    rr+=dr; cc+=dc;
                }
            }
        }
    }
    return out;
}

async function makeMove(source,target) {
    try {
        const data = await post("/api/game/move/", {source,target,promotion:"q"});
        state = data;
        moveHistory.push(data.san);
        selected = null;
        legalTargets = [];
        render();
    } catch (err) {
        statusEl.textContent = err.message;
        selected = null;
        legalTargets = [];
        render();
    }
}

function renderMoves() {
    if (!moveHistory.length) {
        movesEl.innerHTML = '<p class="empty">Your moves will appear here.</p>';
        return;
    }
    movesEl.innerHTML = "";
    for (let i=0;i<moveHistory.length;i+=2) {
        const row = document.createElement("div");
        row.className = "move-row";
        row.innerHTML = `<span class="move-no">${Math.floor(i/2)+1}.</span><span>${moveHistory[i]||""}</span><span>${moveHistory[i+1]||""}</span>`;
        movesEl.appendChild(row);
    }
    movesEl.scrollTop = movesEl.scrollHeight;
}

function renderCaptured() {
    whiteCapturedEl.textContent = capturedWhite.join("");
    blackCapturedEl.textContent = capturedBlack.join("");
}

document.getElementById("newGame").addEventListener("click", async () => {
    const data = await post("/api/game/new/");
    state = data;
    selected = null;
    legalTargets = [];
    moveHistory = [];
    capturedWhite = [];
    capturedBlack = [];
    render();
});

document.getElementById("undo").addEventListener("click", async () => {
    try {
        const data = await post("/api/game/undo/");
        state = data;
        selected = null;
        legalTargets = [];
        moveHistory.pop();
        render();
    } catch (err) {
        statusEl.textContent = err.message;
    }
});

document.getElementById("flip").addEventListener("click", () => {
    flipped = !flipped;
    render();
});

render();
