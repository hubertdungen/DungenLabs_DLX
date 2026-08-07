/**
 * Recalcula todos os precos de uma vez.
 *
 * No dia a dia nao e preciso: o /admin calcula o preco de cada produto
 * quando gravas. Isto serve para quando muda um pressuposto que afecta
 * tudo — o filamento subiu, o cambio mexeu, a hora de maquina passou a
 * valer outra coisa. Edita admin/pricing.js e corre isto.
 *
 *     node scripts/recompute-prices.mjs           # mostra a tabela
 *     node scripts/recompute-prices.mjs --write   # grava
 */
import { createRequire } from "node:module";
import { readFileSync, writeFileSync } from "node:fs";

const require = createRequire(import.meta.url);
const { computePrice, hasCosting, ASSUNCOES } = require("../admin/pricing.js");

const CAMINHO = "data/shop.json";
const catalogo = JSON.parse(readFileSync(CAMINHO, "utf8"));
const gravar = process.argv.includes("--write");

const eur = (n) => (n === null || n === undefined ? "—" : Number(n).toFixed(2));

console.log(
  `\n${"produto".padEnd(30)} ${"desenho".padStart(8)} ${"producao".padStart(9)}` +
  ` ${"margem".padStart(7)} ${"actual".padStart(8)} ${"novo".padStart(8)} ${"lucro".padStart(7)}`
);
console.log("-".repeat(82));

let mudaram = 0;
const semCusto = [];

for (const produto of catalogo.products) {
  if (!hasCosting(produto)) {
    semCusto.push(produto.id);
    continue;
  }
  const r = computePrice(produto.costing);
  const mudou = produto.price !== r.price;
  if (mudou) mudaram++;

  console.log(
    `${produto.id.padEnd(30)} ${eur(r.cults).padStart(8)} ${eur(r.cost).padStart(9)}` +
    ` ${`${(r.margin * 100).toFixed(0)}%`.padStart(7)} ${eur(produto.price).padStart(8)}` +
    ` ${eur(r.price).padStart(8)} ${eur(r.profit).padStart(7)}${mudou ? "   <-- muda" : ""}`
  );
  produto.price = r.price;
}

console.log("-".repeat(82));
console.log(
  `pressupostos: USD->EUR ${ASSUNCOES.usdEur} · maquina ${ASSUNCOES.horaMaquina} EUR/h · ` +
  `PETG ${ASSUNCOES.filamento.PETG}/kg · ASA ${ASSUNCOES.filamento.ASA}/kg · ` +
  `minimo ${ASSUNCOES.precoMinimo}`
);
if (semCusto.length) {
  console.log(`preco manual (sem dados de custo): ${semCusto.join(", ")}`);
}
console.log(`${mudaram} preco(s) mudariam.`);

if (!gravar) {
  console.log("\n(nada foi gravado — usa --write)\n");
  process.exit(0);
}

writeFileSync(CAMINHO, `${JSON.stringify(catalogo, null, 2)}\n`);
console.log(`\n${CAMINHO} actualizado\n`);
