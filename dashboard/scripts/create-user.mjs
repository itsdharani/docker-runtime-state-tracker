import { randomBytes, scryptSync } from "node:crypto";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import pg from "pg";

const [username, role = "ADMIN"] = process.argv.slice(2);
if (!username || !["ADMIN", "VIEWER"].includes(role)) throw new Error("Usage: node scripts/create-user.mjs <username> [ADMIN|VIEWER]");
const prompt = createInterface({ input: stdin, output: stdout });
const password = await prompt.question("Password (12+ characters): ");
prompt.close();
if (password.length < 12) throw new Error("Password must contain at least 12 characters");
const salt = randomBytes(16).toString("hex");
const hash = `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
const pool = new pg.Pool({ host:process.env.PGHOST, port:Number(process.env.PGPORT||5432), database:process.env.PGDATABASE, user:process.env.PGUSER, password:process.env.PGPASSWORD });
try { await pool.query("INSERT INTO app_user (username,password_hash,role) VALUES ($1,$2,$3)", [username,hash,role]); stdout.write(`Created ${username} (${role})\n`); }
finally { await pool.end(); }
