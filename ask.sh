#!/bin/bash



read -p "Pytanie: " QUESTION

echo "$QUESTION" > pytanie.txt

git add pytanie.txt
git commit -m "Nowe pytanie" >/dev/null 2>&1
git push >/dev/null 2>&1

echo "Oczekiwanie na odpowiedź..."

while true
do
    git pull >/dev/null 2>&1

    if [ -f odp.txt ] && [ -s odp.txt ]; then
        echo
        echo "========== ODPOWIEDŹ =========="
        cat odp.txt
        echo
        echo "==============================="
        break
    fi

    sleep 3
done
