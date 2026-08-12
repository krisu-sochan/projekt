# Scala Photo Solver – auto GitHub

## Najlepszy układ
- `projekt` – repo z tą stroną, podpięte do Render
- `zadania-scala` – osobne repo na wygenerowane zadania

## Render / Environment Variables
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-5-mini
GITHUB_TOKEN=...
GITHUB_OWNER=twoj_login
GITHUB_REPO=zadania-scala
GITHUB_BRANCH=main

Token GitHub: dostęp tylko do repo `zadania-scala`, permission `Contents: Read and write`.

## Laptop
Pierwszy raz:
`git clone https://github.com/TWOJ_LOGIN/zadania-scala.git`

Później:
`cd zadania-scala`
`git pull`

Każde zadanie trafia do `zadania/<data>_<tytul>/Main.scala`.
