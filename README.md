# ♟️ Python Chess Game

A complete browser-based chess game built with **Python + Django + HTML + CSS + JavaScript**.

## Features

- Full standard chess rules powered by `python-chess`
- Legal move validation on the Python backend
- Interactive responsive chessboard
- Check, checkmate, stalemate and draw detection
- Castling, en passant and pawn promotion
- Move history with algebraic notation
- Captured pieces display
- New Game / Undo buttons
- Board flip button
- Mobile-friendly UI
- No database required
- Render deployment configuration included

## Project structure

```text
python_chess_game/
├── manage.py
├── requirements.txt
├── Procfile
├── render.yaml
├── README.md
├── chessgame/
│   ├── __init__.py
│   ├── settings.py
│   ├── urls.py
│   ├── wsgi.py
│   └── asgi.py
└── game/
    ├── __init__.py
    ├── apps.py
    ├── urls.py
    ├── views.py
    ├── templates/game/index.html
    └── static/game/
        ├── style.css
        └── app.js
```

## Run locally

```bash
python -m venv venv
```

Windows PowerShell:

```powershell
.\venv\Scripts\Activate.ps1
```

Install packages:

```bash
pip install -r requirements.txt
```

Start server:

```bash
python manage.py runserver
```

Open:

```text
http://127.0.0.1:8000/
```

## Deploy to Render

1. Push this project to GitHub.
2. Create a new **Web Service** on Render.
3. Connect the GitHub repository.
4. Render will use `render.yaml`, or enter:
   - Build command: `pip install -r requirements.txt`
   - Start command: `gunicorn chessgame.wsgi:application`
5. Deploy.
6. Render gives you a public `onrender.com` URL.

## Interview explanation

### Architecture

```text
Browser
   │
   │ HTML/CSS/JavaScript
   ▼
Django URL → View
   │
   │ JSON move request
   ▼
python-chess
   │
   ├── validates legal move
   ├── updates board
   ├── detects check/checkmate/draw
   └── generates move notation
   │
   ▼
JSON response → JavaScript updates UI
```

### Why Python backend?

The frontend should not be trusted to decide whether a move is legal. The Django backend uses `python-chess` as the authoritative chess-rule engine.

### API endpoints

- `POST /api/game/new/` — creates a new game
- `POST /api/game/move/` — validates and applies a move
- `POST /api/game/undo/` — undoes the previous move

The game state is stored in the browser session, so no database is necessary for this version.
