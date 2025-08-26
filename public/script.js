document.getElementById("consultaForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const pregunta = document.getElementById("pregunta").value;
  const resultadoDiv = document.getElementById("resultado");
  const respuestaPre = document.getElementById("respuesta");

  respuestaPre.textContent = "⏳ Consultando...";
  resultadoDiv.classList.remove("hidden");

  try {
    const response = await fetch("http://localhost:3000/api/gemini", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: pregunta }), // 👈 Aquí se cambia a 'prompt'
    });

    if (!response.ok) {
      throw new Error("Error en el servidor");
    }

    const data = await response.json();

    respuestaPre.textContent = `
Pregunta: ${pregunta}
Endpoint usado: /api/gemini
SQL generada: ${data.sql || "N/A"}
Datos: ${JSON.stringify(data.data, null, 2)}
    `;
  } catch (error) {
    respuestaPre.textContent = "❌ Error: " + error.message;
  }
});
