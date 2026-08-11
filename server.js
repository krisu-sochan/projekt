import "dotenv/config";
import express from "express";
import multer from "multer";
import OpenAI from "openai";

const app = express();
const port = process.env.PORT || 3000;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Możesz przesłać tylko zdjęcie."));
    }
    cb(null, true);
  }
});

app.use(express.static("public"));

app.post("/api/solve", upload.single("image"), async (req, res) => {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({
        error: "Brak OPENAI_API_KEY w pliku .env."
      });
    }

    if (!req.file) {
      return res.status(400).json({ error: "Nie wybrano zdjęcia." });
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const base64 = req.file.buffer.toString("base64");
    const imageUrl = `data:${req.file.mimetype};base64,${base64}`;

    const response = await openai.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-5-mini",
      input: [{
        role: "user",
        content: [
          {
            type: "input_text",
            text: `
Odczytaj zadanie programistyczne ze zdjęcia i rozwiąż je w języku Scala 3.

Zasady:
- najpierw krótko przepisz rozpoznaną treść zadania,
- następnie podaj kompletne, gotowe rozwiązanie,
- kod ma się kompilować,
- przestrzegaj wszystkich ograniczeń widocznych na zdjęciu,
- gdy zadanie dotyczy Pekko Actors, użyj Scala 3 i Apache Pekko Typed,
- nie pomijaj importów ani obiektu @main,
- po kodzie dodaj krótkie wyjaśnienie,
- kod umieść w bloku z oznaczeniem scala.
            `.trim()
          },
          {
            type: "input_image",
            image_url: imageUrl
          }
        ]
      }]
    });

    res.json({ result: response.output_text });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: error?.message || "Nie udało się rozwiązać zadania."
    });
  }
});


function validateGitHubPart(value, name, pattern) {
  if (!value || !pattern.test(value)) {
    throw new Error(`Nieprawidłowe pole: ${name}.`);
  }
  return value;
}

app.use(express.json({ limit: "2mb" }));

app.post("/api/github/push", async (req, res) => {
  try {
    const token = process.env.GITHUB_TOKEN;
    if (!token) {
      return res.status(500).json({ error: "Brak GITHUB_TOKEN w pliku .env." });
    }

    const owner = validateGitHubPart(req.body.owner, "właściciel", /^[A-Za-z0-9_.-]+$/);
    const repo = validateGitHubPart(req.body.repo, "repozytorium", /^[A-Za-z0-9_.-]+$/);
    const branch = validateGitHubPart(req.body.branch || "main", "branch", /^[A-Za-z0-9_./-]+$/);
    const filePath = validateGitHubPart(req.body.path || "src/main/scala/Main.scala", "ścieżka", /^[A-Za-z0-9_./ -]+$/);
    const content = String(req.body.content || "").trim();
    const message = String(req.body.message || "Dodanie rozwiązania zadania ze zdjęcia").slice(0, 200);

    if (!content) {
      return res.status(400).json({ error: "Brak kodu do wysłania." });
    }

    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath.split('/').map(encodeURIComponent).join('/')}`;
    const headers = {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "scala-photo-solver"
    };

    let sha;
    const existing = await fetch(`${apiUrl}?ref=${encodeURIComponent(branch)}`, { headers });
    if (existing.ok) {
      const existingFile = await existing.json();
      sha = existingFile.sha;
    } else if (existing.status !== 404) {
      const details = await existing.json().catch(() => ({}));
      throw new Error(details.message || `GitHub zwrócił błąd ${existing.status}.`);
    }

    const body = {
      message,
      content: Buffer.from(content, "utf8").toString("base64"),
      branch,
      ...(sha ? { sha } : {})
    };

    const pushed = await fetch(apiUrl, {
      method: "PUT",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    const result = await pushed.json().catch(() => ({}));
    if (!pushed.ok) {
      throw new Error(result.message || `GitHub zwrócił błąd ${pushed.status}.`);
    }

    res.json({
      message: sha ? "Plik został zaktualizowany na GitHubie." : "Plik został utworzony na GitHubie.",
      url: result.content?.html_url || `https://github.com/${owner}/${repo}`
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error?.message || "Nie udało się wysłać kodu na GitHuba." });
  }
});

app.use((error, _req, res, _next) => {
  res.status(400).json({ error: error.message });
});

app.listen(port, () => {
  console.log(`Strona działa: http://localhost:${port}`);
});