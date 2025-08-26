// ---- IMPORTS ----
import { GoogleGenerativeAI } from "@google/generative-ai";
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import mysql from "mysql2/promise";
import path from "path";
import { fileURLToPath } from "url";

// ---- CONFIGURACIONES ----
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// __dirname y __filename en ESModules:
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public"))); // Servir frontend

// Config DB (pool de conexiones)
const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

// Config Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ---- ESQUEMA DB ----
let schemaDescription = "";

async function loadSchema() {
  try {
    const [rows] = await db.query(
      `
      SELECT TABLE_NAME, COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = ?
      ORDER BY TABLE_NAME, ORDINAL_POSITION
      `,
      [process.env.DB_NAME]
    );

    // Agrupar por tabla
    const schema = rows.reduce((acc, row) => {
      acc[row.TABLE_NAME] = acc[row.TABLE_NAME] || [];
      acc[row.TABLE_NAME].push(row.COLUMN_NAME);
      return acc;
    }, {});

    // Texto legible para el prompt
    schemaDescription = Object.entries(schema)
      .map(([table, cols]) => `${table}: ${cols.join(", ")}`)
      .join("\n");

    console.log("📋 Esquema cargado:\n", schemaDescription);
  } catch (err) {
    console.error("❌ Error cargando esquema:", err.message);
  }
}

// ---- RUTAS ----

// 1. API DB → ejecuta consultas SQL
app.get("/api/db", async (req, res) => {
  const query = req.query.q;
  if (!query) return res.status(400).json({ error: "Falta el parámetro q" });

  try {
    const [rows] = await db.query(query);
    res.json(rows);
  } catch (error) {
    console.error("Error en DB:", error.message);
    res.status(500).json({ error: "Error al ejecutar consulta" });
  }
});

// 2. API Gemini → convierte lenguaje natural en SQL y consulta DB
app.post("/api/gemini", async (req, res) => {
  const { prompt } = req.body;
  if (!prompt) {
    return res.status(400).json({ error: "Falta el prompt" });
  }

  // Helper para generar SQL con un modelo específico
  const generateSQL = async (modelName) => {
    const currentModel = genAI.getGenerativeModel({ model: modelName });
    const response = await currentModel.generateContent(`
      Convierte la siguiente petición en una consulta SQL válida solo para SELECT.
      No uses DELETE, INSERT ni UPDATE.
      Usa exclusivamente las siguientes tablas y columnas del esquema:
      ${schemaDescription}

      Pregunta: "${prompt}"

      Solo devuelve la consulta SQL a menos de que sea un error, si un error existiese devuelvelo en el formato: \"Error: {mensaje de error}\"
      Devuelve solo la consulta SQL en texto plano, sin explicaciones, sin comentarios y sin markdown.
    `);
    return response.response.text().trim();
  };

  try {
    let sqlQuery;
    try {
      // Intentar primero con pro
      sqlQuery = await generateSQL("gemini-1.5-pro");
    } catch (error) {
      if (error.message.includes("429")) {
        console.warn(
          "⚠️ Límite alcanzado en gemini-1.5-pro, cambiando a flash..."
        );
        sqlQuery = await generateSQL("gemini-1.5-flash");
      } else {
        throw error;
      }
    }

    // Seguridad: solo permitir SELECT
    if (!/^select/i.test(sqlQuery)) {
      return res.status(400).json({
        error: "Consulta no permitida",
        sql: sqlQuery,
      });
    }

    console.log("Consulta generada por Gemini:", sqlQuery);
    const [rows] = await db.query(sqlQuery);
    res.json({ sql: sqlQuery, data: rows });
  } catch (error) {
    console.error("Error en Gemini:", error.message);
    res.status(500).json({ error: "Error al procesar la consulta con Gemini" });
  }
});

// 3. Fallback → servir index.html
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ---- INICIAR SERVIDOR ----
app.listen(PORT, async () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
  await loadSchema();
});
