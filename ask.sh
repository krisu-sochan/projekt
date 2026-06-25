#!/bin/bash

QUESTION_FILE="$1"
RESPONSE_FILE="odp.txt"

if [ -z "$QUESTION_FILE" ]; then
    echo "Użycie:"
    echo "./ask.sh sciag.txt"
    exit 1
fi

if [ ! -f "$QUESTION_FILE" ]; then
    echo "Nie znaleziono pliku."
    exit 1
fi

echo "Synchronizacja..."

git pull --rebase origin main

if [ $? -ne 0 ]; then
    echo "Błąd git pull."
    exit 1
fi

rm -f "$RESPONSE_FILE"

cp "$QUESTION_FILE" pytanie.txt

git add pytanie.txt

git commit -m "Nowe pytanie" >/dev/null 2>&1

echo "Wysyłanie..."

git push origin main

if [ $? -ne 0 ]; then
    echo "Błąd git push."
    exit 1
fi

echo
echo "Oczekiwanie na odpowiedź..."
echo

while true
do
    sleep 2

    git pull --rebase origin main >/dev/null 2>&1

    if [ -s "$RESPONSE_FILE" ]; then

        echo
        echo "==============================="
        cat "$RESPONSE_FILE"
        echo
        echo "==============================="

        exit 0
    fi

done