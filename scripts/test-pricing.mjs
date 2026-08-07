/**
 * Testes da valorizacao do carrinho — o caminho que decide quanto e
 * cobrado a um cliente.
 *
 * Os valores esperados sao lidos do proprio catalogo, nunca escritos a
 * mao: um teste que fixa "16.90" parte-se sempre que um preco muda e
 * acaba por ser desligado, que e o pior sitio para ter um teste
 * desligado. Aqui verifica-se o comportamento — o preco vem do
 * servidor, as quantidades multiplicam, o que o cliente manda e
 * ignorado — e isso mantem-se verdade a qualquer preco.
 *
 * Correr a partir da raiz do repositorio:
 *
 *     node scripts/test-pricing.mjs
 */
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";

const require = createRequire(import.meta.url);
const { priceCart } = require("../netlify/functions/_catalogue.js");

const catalogue = JSON.parse(readFileSync("data/shop.json", "utf8"));
const sellable = catalogue.products.filter(
  (p) => typeof p.price === "number" && ["in-stock", "made-to-order"].includes(p.status)
);
const unavailable = catalogue.products.find(
  (p) => !["in-stock", "made-to-order"].includes(p.status)
);

if (sellable.length < 2) {
  console.error("O catalogo precisa de pelo menos dois produtos a venda para estes testes.");
  process.exit(1);
}

const [first, second] = sellable;
const cents = (product) => Math.round(product.price * 100);

let pass = 0;
let fail = 0;

function check(label, fn, expect) {
  try {
    const result = fn();
    if (expect === "throws") {
      console.log(`  FALHOU  ${label} — devia ter recusado`);
      fail++;
      return;
    }
    const ok = expect(result);
    console.log(`  ${ok ? "ok     " : "FALHOU "} ${label}`);
    ok ? pass++ : fail++;
  } catch (error) {
    if (expect === "throws") {
      console.log(`  ok      ${label} — recusado: "${error.message}"`);
      pass++;
    } else {
      console.log(`  FALHOU  ${label} — lancou "${error.message}"`);
      fail++;
    }
  }
}

console.log(`\ncatalogo: ${sellable.length} produtos a venda\n`);
console.log("valorizacao:");

check("o preco vem do catalogo, nao do pedido",
  () => priceCart([{ id: first.id, quantity: 1 }]),
  (r) => r.total === cents(first));

check("quantidades multiplicam",
  () => priceCart([{ id: first.id, quantity: 3 }]),
  (r) => r.total === cents(first) * 3);

check("varias linhas somam",
  () => priceCart([{ id: first.id, quantity: 2 }, { id: second.id, quantity: 1 }]),
  (r) => r.total === cents(first) * 2 + cents(second));

check("a cor viaja como nota",
  () => priceCart([{ id: first.id, quantity: 1, colour: "Coral" }]),
  (r) => r.lines[0].colour === "Coral");

console.log("\ntentativas de manipulacao:");

check("preco enviado pelo cliente e ignorado",
  () => priceCart([{ id: first.id, quantity: 1, price: 0.01, unitAmount: 1 }]),
  (r) => r.total === cents(first));

check("produto inexistente", () => priceCart([{ id: "../../etc/passwd", quantity: 1 }]), "throws");
check("quantidade zero", () => priceCart([{ id: first.id, quantity: 0 }]), "throws");
check("quantidade negativa", () => priceCart([{ id: first.id, quantity: -5 }]), "throws");
check("quantidade absurda", () => priceCart([{ id: first.id, quantity: 99999 }]), "throws");
check("quantidade fraccionaria", () => priceCart([{ id: first.id, quantity: 1.5 }]), "throws");
check("quantidade como texto", () => priceCart([{ id: first.id, quantity: "3abc" }]), "throws");
check("carrinho vazio", () => priceCart([]), "throws");
check("nao e um array", () => priceCart(first.id), "throws");
check("demasiadas linhas",
  () => priceCart(Array(25).fill({ id: first.id, quantity: 1 })), "throws");
check("cor gigante e truncada",
  () => priceCart([{ id: first.id, quantity: 1, colour: "z".repeat(5000) }]),
  (r) => r.lines[0].colour.length === 40);

if (unavailable) {
  check(`produto nao a venda (${unavailable.status})`,
    () => priceCart([{ id: unavailable.id, quantity: 1 }]), "throws");
}

console.log(`\n${pass} passaram, ${fail} falharam\n`);
process.exit(fail ? 1 : 0);
