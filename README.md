# Scala Photo Solver MULTI

Obsługuje wiele zadań z jednego zdjęcia i zapisuje każde osobno do repo `zadania-scala`.

Podmień w repo `projekt`:
- server.js
- public/index.html
- package.json
- .gitignore
- .env.example

Potem:
git add .
git commit -m "Obsluga wielu zadan"
git push origin main

Render z Auto-Deploy wdroży zmianę.

ENV:
OPENAI_API_KEY
OPENAI_MODEL=gpt-5-mini
GITHUB_TOKEN
GITHUB_OWNER=krisu-sochan
GITHUB_REPO=zadania-scala
GITHUB_BRANCH=main
