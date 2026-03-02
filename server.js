/**
 * HOME IMPROVEMENT TRACKER — BACKEND
 * Stack: Node.js + Express + Supabase (PostgreSQL)
 *
 * Setup:
 *   npm install express @supabase/supabase-js cors dotenv jsonwebtoken bcryptjs
 *   Create a .env file with SUPABASE_URL, SUPABASE_SERVICE_KEY, and JWT_SECRET
 *   node server.js
 *
 * API runs on http://localhost:4000
 *
 * ─── CHANGES FROM ORIGINAL ───────────────────────────────────────────────────
 *  1. Added `jsonwebtoken` and `bcryptjs` imports
 *  2. Added `users` table helper (auto-created via SQL comment below)
 *  3. Added POST /api/auth/signup  — hash password, insert user, return JWT
 *  4. Added POST /api/auth/login   — verify password, return JWT
 *  5. Added `authenticate` middleware — verifies Bearer JWT on protected routes
 *  6. All original routes remain completely unchanged
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * DATABASE: Run this SQL in Supabase SQL editor before starting:
 *
 *   CREATE TABLE IF NOT EXISTS users (
 *     id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
 *     name       TEXT        NOT NULL,
 *     email      TEXT        NOT NULL UNIQUE,
 *     password   TEXT        NOT NULL,
 *     created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
 *   );
 */

require("dotenv").config();
const express   = require("express");
const cors      = require("cors");
const jwt       = require("jsonwebtoken");
const bcrypt    = require("bcryptjs");
const { createClient } = require("@supabase/supabase-js");

const JWT_SECRET = process.env.JWT_SECRET || "change-this-secret-in-production";

// ─── Supabase Client ─────────────────────────────────────────────────────────
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY   // Service role key — backend only!
);

// ─── App Setup ───────────────────────────────────────────────────────────────
const app = express();
app.use(cors({ origin: ["https://your-app-name.vercel.app", "http://localhost:5173"], credentials: true }));
app.use(express.json());

// ─── Error Handler Helper ─────────────────────────────────────────────────────
const handleError = (res, error, status = 500) => {
  console.error("[Error]", error?.message || error);
  res.status(status).json({ error: error?.message || "Internal server error" });
};

// ─── Middleware: Request Logger ───────────────────────────────────────────────
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// ════════════════════════════════════════════════════════════════════════════
//  NEW: JWT Authentication Middleware
//  Attach to any route that should require a logged-in user.
// ════════════════════════════════════════════════════════════════════════════
const authenticate = (req, res, next) => {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith("Bearer "))
    return res.status(401).json({ error: "Missing or invalid Authorization header." });
  try {
    req.user = jwt.verify(auth.split(" ")[1], JWT_SECRET); // { id, name, email }
    next();
  } catch {
    res.status(401).json({ error: "Token expired or invalid. Please sign in again." });
  }
};

// ════════════════════════════════════════════════════════════════════════════
//  NEW: Auth Routes
// ════════════════════════════════════════════════════════════════════════════

/**
 * POST /api/auth/signup
 * Body: { name, email, password }
 * Returns: { token, user: { id, name, email } }
 */
app.post("/api/auth/signup", async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ error: "Name, email and password are required." });
    if (password.length < 6)
      return res.status(400).json({ error: "Password must be at least 6 characters." });

    // Check duplicate email
    const { data: existing } = await supabase
      .from("users").select("id").eq("email", email).maybeSingle();
    if (existing)
      return res.status(409).json({ error: "An account with this email already exists." });

    // Hash password and insert
    const hashed = await bcrypt.hash(password, 12);
    const { data, error } = await supabase
      .from("users")
      .insert([{ name, email, password: hashed }])
      .select("id, name, email")
      .single();

    if (error) return handleError(res, error);

    const token = jwt.sign({ id: data.id, name: data.name, email: data.email }, JWT_SECRET, { expiresIn: "7d" });
    res.status(201).json({ token, user: data });
  } catch (e) { handleError(res, e); }
});

/**
 * POST /api/auth/login
 * Body: { email, password }
 * Returns: { token, user: { id, name, email } }
 */
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: "Email and password are required." });

    const { data: user, error } = await supabase
      .from("users").select("id, name, email, password").eq("email", email).maybeSingle();

    if (error) return handleError(res, error);
    if (!user) return res.status(401).json({ error: "No account found with that email." });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: "Incorrect password." });

    const token = jwt.sign({ id: user.id, name: user.name, email: user.email }, JWT_SECRET, { expiresIn: "7d" });
    res.json({ token, user: { id: user.id, name: user.name, email: user.email } });
  } catch (e) { handleError(res, e); }
});

// ════════════════════════════════════════════════════════════════════════════
//  PROJECTS  (unchanged — authenticate middleware added)
// ════════════════════════════════════════════════════════════════════════════

app.get("/api/projects", authenticate, async (_req, res) => {
  try {
    const { data, error } = await supabase
      .from("projects")
      .select(`*, tasks(id, completed), materials(id, total_cost)`)
      .order("created_at", { ascending: false });

    if (error) return handleError(res, error);

    const projects = data.map((p) => {
      const totalTasks = p.tasks?.length || 0;
      const doneTasks  = p.tasks?.filter((t) => t.completed).length || 0;
      const progress_pct = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;
      const spent = p.materials?.reduce((sum, m) => sum + Number(m.total_cost || 0), 0) || 0;
      return { ...p, tasks: undefined, materials: undefined, progress_pct, spent };
    });

    res.json(projects);
  } catch (e) { handleError(res, e); }
});

app.get("/api/projects/:id", authenticate, async (req, res) => {
  try {
    const { data: p, error } = await supabase
      .from("projects")
      .select(`*, tasks(id, completed), materials(id, total_cost)`)
      .eq("id", req.params.id).single();

    if (error) return handleError(res, error, 404);

    const totalTasks   = p.tasks?.length || 0;
    const doneTasks    = p.tasks?.filter((t) => t.completed).length || 0;
    const progress_pct = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;
    const spent        = p.materials?.reduce((sum, m) => sum + Number(m.total_cost || 0), 0) || 0;

    res.json({ ...p, tasks: undefined, materials: undefined, progress_pct, spent });
  } catch (e) { handleError(res, e); }
});

app.post("/api/projects", authenticate, async (req, res) => {
  try {
    const { name, category, budget, deadline, notes, permit_required } = req.body;
    if (!name) return res.status(400).json({ error: "Project name is required." });

    const { data, error } = await supabase.from("projects").insert([{
      name, category: category || "other", budget: parseFloat(budget) || 0,
      deadline: deadline || null, notes: notes || null,
      permit_required: permit_required || false,
      permit_status: permit_required ? "pending" : "n/a", status: "planning",
    }]).select().single();

    if (error) return handleError(res, error);
    res.status(201).json({ ...data, progress_pct: 0, spent: 0 });
  } catch (e) { handleError(res, e); }
});

app.patch("/api/projects/:id", authenticate, async (req, res) => {
  try {
    const allowed = ["name", "category", "budget", "deadline", "notes", "status", "permit_required", "permit_status"];
    const updates = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)));
    if (!Object.keys(updates).length) return res.status(400).json({ error: "No valid fields to update." });

    const { data, error } = await supabase.from("projects")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", req.params.id).select().single();

    if (error) return handleError(res, error);
    res.json(data);
  } catch (e) { handleError(res, e); }
});

app.delete("/api/projects/:id", authenticate, async (req, res) => {
  try {
    const { error } = await supabase.from("projects").delete().eq("id", req.params.id);
    if (error) return handleError(res, error);
    res.json({ success: true });
  } catch (e) { handleError(res, e); }
});

// ════════════════════════════════════════════════════════════════════════════
//  TASKS  (unchanged — authenticate added)
// ════════════════════════════════════════════════════════════════════════════

app.get("/api/projects/:id/tasks", authenticate, async (req, res) => {
  try {
    const { data, error } = await supabase.from("tasks").select("*")
      .eq("project_id", req.params.id).order("created_at", { ascending: true });
    if (error) return handleError(res, error);
    res.json(data);
  } catch (e) { handleError(res, e); }
});

app.post("/api/projects/:id/tasks", authenticate, async (req, res) => {
  try {
    const { name, priority, assignee, due_date, notes } = req.body;
    if (!name) return res.status(400).json({ error: "Task name is required." });

    const { data, error } = await supabase.from("tasks").insert([{
      project_id: req.params.id, name, priority: priority || "medium",
      assignee: assignee || null, due_date: due_date || null,
      notes: notes || null, completed: false,
    }]).select().single();

    if (error) return handleError(res, error);
    res.status(201).json(data);
  } catch (e) { handleError(res, e); }
});

app.patch("/api/tasks/:id", authenticate, async (req, res) => {
  try {
    const allowed = ["name", "completed", "priority", "assignee", "due_date", "notes"];
    const updates = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)));

    const { data, error } = await supabase.from("tasks")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", req.params.id).select().single();

    if (error) return handleError(res, error);
    res.json(data);
  } catch (e) { handleError(res, e); }
});

app.delete("/api/tasks/:id", authenticate, async (req, res) => {
  try {
    const { error } = await supabase.from("tasks").delete().eq("id", req.params.id);
    if (error) return handleError(res, error);
    res.json({ success: true });
  } catch (e) { handleError(res, e); }
});

// ════════════════════════════════════════════════════════════════════════════
//  MATERIALS  (unchanged — authenticate added)
// ════════════════════════════════════════════════════════════════════════════

app.get("/api/projects/:id/materials", authenticate, async (req, res) => {
  try {
    const { data, error } = await supabase.from("materials").select("*")
      .eq("project_id", req.params.id).order("created_at", { ascending: true });
    if (error) return handleError(res, error);
    res.json(data);
  } catch (e) { handleError(res, e); }
});

app.post("/api/projects/:id/materials", authenticate, async (req, res) => {
  try {
    const { name, quantity, unit, unit_cost, notes } = req.body;
    if (!name) return res.status(400).json({ error: "Material name is required." });

    const qty = parseFloat(quantity) || 1;
    const cost = parseFloat(unit_cost) || 0;

    const { data, error } = await supabase.from("materials").insert([{
      project_id: req.params.id, name, quantity: qty, unit: unit || "unit",
      unit_cost: cost, total_cost: qty * cost, notes: notes || null, purchased: false,
    }]).select().single();

    if (error) return handleError(res, error);
    res.status(201).json(data);
  } catch (e) { handleError(res, e); }
});

app.patch("/api/materials/:id", authenticate, async (req, res) => {
  try {
    const allowed = ["name", "quantity", "unit", "unit_cost", "purchased", "notes"];
    const updates = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)));

    if (updates.quantity !== undefined || updates.unit_cost !== undefined) {
      const { data: ex } = await supabase.from("materials").select("quantity, unit_cost").eq("id", req.params.id).single();
      const qty  = parseFloat(updates.quantity  ?? ex?.quantity  ?? 1);
      const cost = parseFloat(updates.unit_cost ?? ex?.unit_cost ?? 0);
      updates.total_cost = qty * cost;
    }

    const { data, error } = await supabase.from("materials")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", req.params.id).select().single();

    if (error) return handleError(res, error);
    res.json(data);
  } catch (e) { handleError(res, e); }
});

app.delete("/api/materials/:id", authenticate, async (req, res) => {
  try {
    const { error } = await supabase.from("materials").delete().eq("id", req.params.id);
    if (error) return handleError(res, error);
    res.json({ success: true });
  } catch (e) { handleError(res, e); }
});

// ════════════════════════════════════════════════════════════════════════════
//  CONTRACTORS  (unchanged — authenticate added)
// ════════════════════════════════════════════════════════════════════════════

app.get("/api/projects/:id/contractors", authenticate, async (req, res) => {
  try {
    const { data, error } = await supabase.from("contractors").select("*")
      .eq("project_id", req.params.id).order("created_at", { ascending: true });
    if (error) return handleError(res, error);
    res.json(data);
  } catch (e) { handleError(res, e); }
});

app.post("/api/projects/:id/contractors", authenticate, async (req, res) => {
  try {
    const { name, specialty, phone, email, notes } = req.body;
    if (!name) return res.status(400).json({ error: "Contractor name is required." });

    const { data, error } = await supabase.from("contractors").insert([{
      project_id: req.params.id, name, specialty: specialty || null,
      phone: phone || null, email: email || null, notes: notes || null,
    }]).select().single();

    if (error) return handleError(res, error);
    res.status(201).json(data);
  } catch (e) { handleError(res, e); }
});

app.delete("/api/contractors/:id", authenticate, async (req, res) => {
  try {
    const { error } = await supabase.from("contractors").delete().eq("id", req.params.id);
    if (error) return handleError(res, error);
    res.json({ success: true });
  } catch (e) { handleError(res, e); }
});

// ════════════════════════════════════════════════════════════════════════════
//  MAINTENANCE  (unchanged — authenticate added)
// ════════════════════════════════════════════════════════════════════════════

app.get("/api/maintenance", authenticate, async (_req, res) => {
  try {
    const { data, error } = await supabase.from("maintenance_tasks").select("*")
      .order("due_date", { ascending: true });
    if (error) return handleError(res, error);
    res.json(data);
  } catch (e) { handleError(res, e); }
});

app.post("/api/maintenance", authenticate, async (req, res) => {
  try {
    const { task_name, due_date, recurrence, notes } = req.body;
    if (!task_name) return res.status(400).json({ error: "Task name is required." });

    const { data, error } = await supabase.from("maintenance_tasks").insert([{
      task_name, due_date: due_date || null,
      recurrence: recurrence || "none", notes: notes || null, completed: false,
    }]).select().single();

    if (error) return handleError(res, error);
    res.status(201).json(data);
  } catch (e) { handleError(res, e); }
});

app.patch("/api/maintenance/:id", authenticate, async (req, res) => {
  try {
    const allowed = ["task_name", "due_date", "completed", "recurrence", "notes"];
    const updates = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)));

    const { data, error } = await supabase.from("maintenance_tasks")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", req.params.id).select().single();

    if (error) return handleError(res, error);
    res.json(data);
  } catch (e) { handleError(res, e); }
});

app.delete("/api/maintenance/:id", authenticate, async (req, res) => {
  try {
    const { error } = await supabase.from("maintenance_tasks").delete().eq("id", req.params.id);
    if (error) return handleError(res, error);
    res.json({ success: true });
  } catch (e) { handleError(res, e); }
});

// ─── Health Check & Start ─────────────────────────────────────────────────────
app.get("/health", (_req, res) =>
  res.json({ status: "ok", timestamp: new Date().toISOString() }));

app.use((_req, res) => res.status(404).json({ error: "Route not found" }));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`\n🏡 Renova Backend running on http://localhost:${PORT}`);
  console.log(`   Supabase URL: ${process.env.SUPABASE_URL || "(not set — check .env)"}\n`);
});
