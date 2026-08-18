import "dotenv/config";
import express from "express";
import multer from "multer";
import OpenAI from "openai";

const app = express();
const port = process.env.PORT || 3000;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(
    file.mimetype.startsWith("image/") ? null : new Error("Tylko zdjęcia."),
    file.mimetype.startsWith("image/")
  )
});

app.use(express.static("public"));

function cleanJson(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fenced ? fenced[1] : text;
  return raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1);
}

function safe(value) {
  return String(value || "zadanie")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50) || "zadanie";
}

function stamp() {
  return new Date().toISOString()
    .replace(/\.\d{3}Z$/, "")
    .replace("T", "_")
    .replace(/:/g, "-");
}

async function githubPut(path, content, message) {
  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;
  const branch = process.env.GITHUB_BRANCH || "main";

  if (!process.env.GITHUB_TOKEN || !owner || !repo) {
    throw new Error("Brak konfiguracji GitHub.");
  }

  const encoded = path.split("/").map(encodeURIComponent).join("/");
  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/${encoded}`,
    {
      method: "PUT",
      headers: {
        "Accept": "application/vnd.github+json",
        "Authorization": `Bearer ${process.env.GITHUB_TOKEN}`,
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
        "User-Agent": "scala-photo-solver"
      },
      body: JSON.stringify({
        message,
        content: Buffer.from(content, "utf8").toString("base64"),
        branch
      })
    }
  );

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`GitHub ${response.status}: ${data.message || "błąd"}`);
  }

  return {
    path,
    url: data?.content?.html_url,
    commitUrl: data?.commit?.html_url
  };
}

app.get("/api/config", (_req, res) => {
  res.json({
    githubOwner: process.env.GITHUB_OWNER || "",
    githubRepo: process.env.GITHUB_REPO || "",
    githubBranch: process.env.GITHUB_BRANCH || "main",
    autoPush: Boolean(process.env.GITHUB_TOKEN && process.env.GITHUB_OWNER && process.env.GITHUB_REPO)
  });
});

app.post("/api/solve", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "Nie wybrano zdjęcia." });
    if (!process.env.OPENAI_API_KEY) return res.status(500).json({ error: "Brak OPENAI_API_KEY." });

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const imageUrl = `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;

    const prompt = `
Przeanalizuj CAŁE zdjęcie kartki z zadaniami programistycznymi i rozwiąż WSZYSTKIE osobne zadania.

Jeśli widzisz "Zadanie 1", "Zadanie 2", "Zadanie 3", MUSISZ zwrócić trzy osobne elementy w tasks.
Nie kończ po pierwszym zadaniu.

Zasady:
- Scala 3.
- Przestrzegaj dokładnie wszystkich ograniczeń z kartki.
- Kod ma być prosty i typowy dla laboratoriów, bez długich komentarzy i ozdobnych bannerów.
- Nie dodawaj zbędnych funkcji ani zabezpieczeń.
- Jeśli zadanie zabrania var, pętli, rekurencji, metod standardowych itp., przestrzegaj tego.

Dla zadań z aktorami używaj WYŁĄCZNIE klasycznego Apache Pekko zgodnego ze stylem scala3-pekko.g8:
import org.apache.pekko.actor.*
class X extends Actor with ActorLogging
def receive: Receive = { ... }
ActorSystem(...)
Props(...)
context.actorOf(...)
context.become(...)

Nie używaj Pekko Typed, Behaviors ani ActorSystem[Command].

Zwróć WYŁĄCZNIE JSON:
{
  "tasks": [
    {
      "number": 1,
      "title": "krótki tytuł",
      "kind": "scala albo pekko",
      "recognizedText": "krótkie streszczenie zadania i ograniczeń",
      "code": "pełny kod Scala bez markdown",
      "explanation": "krótkie wyjaśnienie"
    }
  ]
}
`.trim();

    const response = await openai.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-5-mini",
      input: [{
        role: "user",
        content: [
          { type: "input_text", text: prompt },
          { type: "input_image", image_url: imageUrl }
        ]
      }]
    });

    let parsed;
    try {
      parsed = JSON.parse(cleanJson(response.output_text || ""));
    } catch {
      return res.status(500).json({ error: "Nie udało się rozdzielić zadań. Spróbuj zrobić wyraźniejsze zdjęcie." });
    }

    if (!Array.isArray(parsed.tasks) || parsed.tasks.length === 0) {
      return res.status(500).json({ error: "Nie rozpoznano zadań." });
    }

    const session = stamp();
    const tasks = [];

    for (let i = 0; i < parsed.tasks.length; i++) {
      const t = parsed.tasks[i];
      const number = Number(t.number) || i + 1;
      const title = String(t.title || `Zadanie ${number}`);
      const code = String(t.code || "").trim();

      if (!code) continue;

      const path = `zadania/${session}/zadanie-${number}-${safe(title)}/Main.scala`;
      let github = null;
      let githubError = null;

      try {
        github = await githubPut(path, code, `Zadanie ${number}: ${title}`);
      } catch (e) {
        githubError = e.message;
      }

      tasks.push({
        number,
        title,
        kind: String(t.kind || "scala"),
        recognizedText: String(t.recognizedText || ""),
        code,
        explanation: String(t.explanation || ""),
        github,
        githubError
      });
    }

    tasks.sort((a, b) => a.number - b.number);
    res.json({ count: tasks.length, session, tasks });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message || "Błąd." });
  }
});

app.listen(port, () => console.log(`Serwer działa na porcie ${port}`));