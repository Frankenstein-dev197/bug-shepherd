import express from "express";
import cors from "cors";
// Importation des types et utilitaires depuis nos packages de workspace internes
import type { User, Bug } from "@optimus/types";
import { formatDate, capitalize } from "@optimus/utils";

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// mock data utilisant le type exporté du workspace @optimus/types
const mockUser: User = {
  id: "usr_1",
  name: "jules devops",
  email: "jules@optimus.io",
  role: "admin",
  createdAt: new Date().toISOString(),
};

const mockBugs: Bug[] = [
  {
    id: "bug_1",
    title: "build failure in core monorepo setup",
    description: "pnpm build was failing due to complex circular dependencies.",
    severity: "critical",
    status: "in_progress",
    assigneeId: "usr_1",
    reporterId: "usr_2",
    createdAt: new Date().toISOString(),
  },
  {
    id: "bug_2",
    title: "unrecognized tailwind configuration inside UI package",
    description: "Tailwind components weren't sharing variables correctly.",
    severity: "high",
    status: "new",
    reporterId: "usr_3",
    createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
  }
];

// Endpoint Santé/Index
app.get("/", (req, res) => {
  res.json({
    status: "healthy",
    service: "optimus-api",
    timestamp: formatDate(new Date().toISOString()),
    user: {
      ...mockUser,
      name: capitalize(mockUser.name)
    }
  });
});

// Endpoint Bugs
app.get("/api/bugs", (req, res) => {
  const formattedBugs = mockBugs.map(bug => ({
    ...bug,
    title: capitalize(bug.title),
    formattedDate: formatDate(bug.createdAt)
  }));
  res.json(formattedBugs);
});

// Endpoint Post Bug
app.post("/api/bugs", (req, res) => {
  const { title, description, severity } = req.body;
  if (!title || !description) {
    return res.status(400).json({ error: "Title and description are required" });
  }

  const newBug: Bug = {
    id: `bug_${mockBugs.length + 1}`,
    title: title,
    description: description,
    severity: severity || "medium",
    status: "new",
    reporterId: "usr_web",
    createdAt: new Date().toISOString(),
  };

  mockBugs.push(newBug);
  res.status(201).json({
    ...newBug,
    title: capitalize(newBug.title),
    formattedDate: formatDate(newBug.createdAt)
  });
});

app.listen(port, () => {
  console.log(`[Optimus API] Server running at http://localhost:${port}`);
});
