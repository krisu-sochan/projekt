#!/bin/bash

# ===== KONFIGURACJA =====
QUESTION_FILE="$1"
RESPONSE_FILE="odp.txt"
REMOTE_BRANCH="main"

# ===== SPRAWDZENIA =====

if [ -z "$QUESTION_FILE" ]; then
    echo "Użycie:"
    echo "  ./ask.sh sciag.txt"
    exit 1
fi

if [ ! -f "$QUESTION_FILE" ]; then
    echo "Błąd: nie znaleziono pliku '$QUESTION_FILE'"
    exit 1
fi

if [ ! -d ".git" ]; then
    echo "Błąd: bieżący katalog nie jest repozytorium Git."
    exit 1
fi

echo "Przygotowywanie pytania..."

# usuwamy starą odpowiedź
rm -f "$RESPONSE_FILE"

# kopiujemy pytanie do repo
cp "$QUESTION_FILE" pytanie.txt

# ===== WYSŁANIE =====

git add pytanie.txt

if ! git commit -m "Nowe pytanie" >/dev/null 2>&1; then
    echo "Brak zmian do zatwierdzenia."
fi

echo "Wysyłanie do GitHub..."

if ! git push origin "$REMOTE_BRANCH"; then
    echo "Błąd podczas git push."
    exit 1
fi

echo "Pytanie wysłane."
echo
echo "Oczekiwanie na odpowiedź..."
echo

# ===== ODBIÓR =====

while true
do
    sleep 2

    if ! git pull --rebase origin "$REMOTE_BRANCH" >/dev/null 2>&1; then
        echo "Błąd podczas git pull."
        continue
    fi

    if [ -s "$RESPONSE_FILE" ]; then
        echo "========== ODPOWIEDŹ =========="
        cat "$RESPONSE_FILE"
        echo
        echo "==============================="

        # opcjonalnie usuń odpowiedź lokalnie
        # rm -f "$RESPONSE_FILE"

        exit 0
    fi
done