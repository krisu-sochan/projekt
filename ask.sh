#!/bin/bash

INPUT_FILE=$1

if [ ! -f "$INPUT_FILE" ]; then
    exit 1
fi

mkdir -p requests
mkdir -p responses

ID=$(date +%s)

cp "$INPUT_FILE" "requests/$ID.txt"

git add requests/$ID.txt
git commit -m "task-$ID" >/dev/null 2>&1
git push >/dev/null 2>&1

while true
do
    git pull >/dev/null 2>&1

    if [ -f "responses/$ID.txt" ]; then

        cp "responses/$ID.txt" "odpowiedz.txt"

        break
    fi

    sleep 5
done

exit 0