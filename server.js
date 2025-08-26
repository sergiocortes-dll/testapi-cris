  // ---- IMPORTS ----
  import dotenv from "dotenv";
  import express from "express";
  import mysql from "mysql2/promise";
  import cors from "cors";
  import path from "path";
  import { fileURLToPath } from "url";
  import { GoogleGenerativeAI } from "@google/generative-ai";


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
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

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
    if (!prompt) return res.status(400).json({ error: "Falta el prompt" });

    try {
      const geminiResponse = await model.generateContent(`
        Convierte la siguiente petición en una consulta SQL válida solo para SELECT.
        No uses DELETE, INSERT ni UPDATE. Usa tablas del esquema ${process.env.DB_NAME}.
        Pregunta: "${prompt}"
      `);

      const sqlQuery = geminiResponse.response.text().trim();
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
  app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
  });
