"use strict";
/* Lance toutes les suites de tests (npm test). Chaque suite est un script Node
   indépendant ; la suite échoue si l'un d'eux sort avec un code non nul. */
const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const dir = __dirname;
const suites = fs.readdirSync(dir)
  .filter(f => f.endsWith(".js") && f !== "run-all.js")
  .sort();

let failed = [];
for (const file of suites) {
  const res = spawnSync(process.execPath, [path.join(dir, file)], { encoding: "utf8" });
  const lines = (res.stdout || "").trim().split("\n");
  const summary = lines[lines.length - 1] || "(aucune sortie)";
  const ok = res.status === 0;
  console.log((ok ? "OK    " : "ÉCHEC ") + file.padEnd(36) + summary);
  if (!ok) {
    failed.push(file);
    lines.filter(l => /^FAIL/.test(l)).forEach(l => console.log("        " + l));
    if (res.stderr) console.log(res.stderr.trim().split("\n").map(l => "        " + l).join("\n"));
  }
}
console.log(failed.length ? "\n" + failed.length + " suite(s) en échec : " + failed.join(", ")
                          : "\nToutes les suites passent (" + suites.length + ").");
process.exitCode = failed.length ? 1 : 0;
