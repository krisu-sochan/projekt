import "dotenv/config";
import express from "express";
import multer from "multer";
import OpenAI from "openai";

const app = express();
const port = process.env.PORT || 3000;
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
app.use(express.static("public"));

function extractScalaCode(text) {
  const m = text.match(/```scala\s*([\s\S]*?)```/i) || text.match(/```\s*([\s\S]*?)```/);
  return m ? m[1].trim() : text.trim();
}

function slug(s) {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50) || "zadanie";
}

function taskPath(text) {
  const title = text.split("\n").map(x => x.replace(/^#+\s*/, "").trim()).find(x => x.length > 2 && !x.startsWith("```")) || "zadanie";
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").replace("T", "_").replace("Z", "");
  return `zadania/${stamp}_${slug(title)}/Main.scala`;
}

async function pushToGithub(code, aiText) {
  const { GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO } = process.env;
  const branch = process.env.GITHUB_BRANCH || "main";
  if (!GITHUB_TOKEN || !GITHUB_OWNER || !GITHUB_REPO) throw new Error("Brak konfiguracji GitHub na serwerze.");
  const path = taskPath(aiText);
  const encodedPath = path.split("/").map(encodeURIComponent).join("/");
  const url = `https://api.github.com/repos/${encodeURIComponent(GITHUB_OWNER)}/${encodeURIComponent(GITHUB_REPO)}/contents/${encodedPath}`;
  const r = await fetch(url, {
    method: "PUT",
    headers: {
      "Accept": "application/vnd.github+json",
      "Authorization": `Bearer ${GITHUB_TOKEN}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
      "User-Agent": "scala-photo-solver"
    },
    body: JSON.stringify({
      message: `Nowe zadanie Scala: ${path}`,
      content: Buffer.from(code, "utf8").toString("base64"),
      branch
    })
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`GitHub API ${r.status}: ${data.message || "błąd"}`);
  return { path, url: data?.content?.html_url, commitUrl: data?.commit?.html_url };
}

app.get("/api/config", (_req, res) => {
  res.json({
    owner: process.env.GITHUB_OWNER || "",
    repo: process.env.GITHUB_REPO || "",
    branch: process.env.GITHUB_BRANCH || "main",
    autoPush: Boolean(process.env.GITHUB_TOKEN && process.env.GITHUB_OWNER && process.env.GITHUB_REPO)
  });
});

app.post("/api/solve", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "Nie wybrano zdjęcia." });
    if (!process.env.OPENAI_API_KEY) return res.status(500).json({ error: "Brak OPENAI_API_KEY." });

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const imageUrl = `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;
    const response = await openai.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-5-mini",
      input: [{
        role: "user", content: [
          { type: "input_text", text: "Odczytaj zadanie ze zdjęcia i rozwiąż je w Scala 3. Zachowaj starter i ograniczenia z kartki. Najpierw krótki tytuł. Cały gotowy kod umieść w jednym bloku ```scala. Po kodzie krótkie wyjaśnienie." },
          { type: "input_image", image_url: imageUrl }
        ]
      }]
    });
    const result = response.output_text || "";
    const code = extractScalaCode(result);
    let github = null, githubError = null;
    try { github = await pushToGithub(code, result); }
    catch (e) { githubError = e.message; }
    res.json({ result, code, github, githubError });
  } catch (e) {
    res.status(500).json({ error: e.message || "Błąd serwera." });
  }
});

app.listen(port, () => console.log(`Scala Photo Solver działa na porcie ${port}`));
