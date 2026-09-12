"use strict";
const http = require("node:http");

const target = process.env.LIVEVOZ_STAGE_HEALTH || "http://127.0.0.1:8080/health";
const req = http.get(target, { timeout: 3000 }, res => {
  let body = "";
  res.setEncoding("utf8");
  res.on("data", chunk => body += chunk);
  res.on("end", () => {
    if (res.statusCode !== 200) {
      console.error(`Stage Network respondió HTTP ${res.statusCode}`);
      process.exit(1);
    }
    try {
      const data = JSON.parse(body);
      if (!data.ok) throw new Error("health=false");
      console.log(`✓ Stage Network OK | protocolo ${data.protocol || "?"} | salas ${data.rooms ?? "?"} | clientes ${data.clients ?? "?"}`);
    } catch (error) {
      console.error("Respuesta de health inválida:", error.message);
      process.exit(1);
    }
  });
});
req.on("timeout", () => req.destroy(new Error("timeout")));
req.on("error", error => {
  console.error(`✗ Stage Network no disponible en ${target}: ${error.message}`);
  process.exit(1);
});
