# Scala ze zdjęcia + GitHub

Strona odczytuje zadanie ze zdjęcia, generuje kod Scala 3 i pozwala wysłać gotowy plik do repozytorium GitHub.

## Uruchomienie

1. Zainstaluj Node.js.
2. Otwórz terminal w folderze projektu.
3. Wpisz `npm install`.
4. Skopiuj `.env.example` jako `.env`.
5. Wpisz w `.env` klucz OpenAI oraz token GitHub.
6. Uruchom `npm start`.
7. Otwórz `http://localhost:3000`.

## Token GitHub

Utwórz fine-grained personal access token tylko dla wybranego repozytorium. Nadaj mu uprawnienie:

- Repository permissions → Contents → Read and write

Nie umieszczaj tokenu w pliku HTML. Token powinien pozostać tylko w `.env` na serwerze.

## Wysyłanie kodu

Po wygenerowaniu rozwiązania wpisz:

- nazwę użytkownika GitHub,
- nazwę repozytorium,
- branch, zwykle `main`,
- ścieżkę, np. `src/main/scala/Main.scala`,
- opis commita.

Przycisk „Wyślij na GitHuba” utworzy plik albo zaktualizuje istniejący.
