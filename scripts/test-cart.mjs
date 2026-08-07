/**
 * Testes do carrinho num DOM a serio.
 *
 * Existe por causa de um bug relatado pelo Hubert: os botoes + e - da
 * gaveta "nao funcionavam bem". Funcionavam — mas so devagar. Dois
 * cliques rapidos seguidos somavam um. O redesenho e assincrono, os
 * dois cliques liam a mesma quantidade antiga e escreviam o mesmo
 * numero, por isso o segundo perdia-se.
 *
 * A leitura do codigo nao mostrava isso; carregar nos botoes mostrou.
 * Daqui a dependencia do jsdom para testes.
 *
 * Correr a partir da raiz do repositorio:
 *
 *     node scripts/test-cart.mjs
 */
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";

const require = createRequire(import.meta.url);
const { JSDOM } = require("jsdom");

const catalogue = JSON.parse(readFileSync("data/shop.json", "utf8"));
const cartJs = readFileSync("cart.js", "utf8");

const vendaveis = catalogue.products.filter(
  (p) => typeof p.price === "number" && ["in-stock", "made-to-order"].includes(p.status)
);
if (vendaveis.length < 2) {
  console.error("Sao precisos dois produtos a venda para estes testes.");
  process.exit(1);
}
const [a, b] = vendaveis;

/** Monta uma pagina com o cart.js carregado e o carrinho semeado. */
async function montar(itens) {
  const dom = new JSDOM(
    `<!doctype html><html><body><nav><div id="nav-links"></div></nav></body></html>`,
    { url: "https://dlx.dungenlabs.com/", runScripts: "outside-only", pretendToBeVisual: true }
  );
  const { window } = dom;
  window.localStorage.setItem("dlx.cart.v1", JSON.stringify(itens));
  window.fetch = async () => ({ ok: true, status: 200, json: async () => catalogue });
  window.eval(cartJs);
  await window.DLXCart.open();
  await new Promise((r) => setTimeout(r, 60));
  return window;
}

const espera = () => new Promise((r) => setTimeout(r, 60));
const guardado = (w) => JSON.parse(w.localStorage.getItem("dlx.cart.v1"));
const linhas = (w) => w.document.querySelectorAll("#dlx-cart-lines .cart-line");
const mostrado = (w, i) => linhas(w)[i].querySelector(".cart-line-qty span").textContent;

function carregar(w, linha, passo) {
  linhas(w)[linha]
    .querySelector(`[data-step="${passo}"]`)
    .dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
}

let pass = 0;
let fail = 0;
const diz = (ok, texto) => {
  console.log(`  ${ok ? "ok    " : "FALHOU"}  ${texto}`);
  ok ? pass++ : fail++;
};

console.log("\ngaveta do carrinho:\n");

{
  const w = await montar([
    { id: a.id, quantity: 1, colour: "Deep Teal" },
    { id: b.id, quantity: 2, colour: "Coral" }
  ]);

  diz(linhas(w).length === 2, "desenha uma linha por artigo");

  carregar(w, 0, "1");
  await espera();
  diz(guardado(w)[0].quantity === 2, "o + soma um");
  diz(mostrado(w, 0) === "2", "e o ecra acompanha");

  carregar(w, 1, "1");
  await espera();
  diz(guardado(w)[1].quantity === 3, "o + na segunda linha mexe na segunda linha");
  diz(guardado(w)[0].quantity === 2, "e deixa a primeira em paz");

  carregar(w, 0, "-1");
  await espera();
  diz(guardado(w)[0].quantity === 1, "o - subtrai um");
}

{
  // O bug relatado. Sem esperar pelo redesenho entre os cliques.
  const w = await montar([{ id: a.id, quantity: 1, colour: "Deep Teal" }]);
  carregar(w, 0, "1");
  carregar(w, 0, "1");
  carregar(w, 0, "1");
  await espera();
  diz(guardado(w)[0].quantity === 4,
      `tres cliques rapidos somam tres (ficou ${guardado(w)[0].quantity})`);
}

{
  const w = await montar([
    { id: a.id, quantity: 1, colour: "Deep Teal" },
    { id: b.id, quantity: 1, colour: "Coral" }
  ]);
  carregar(w, 0, "-1");
  await espera();
  const restante = guardado(w);
  diz(restante.length === 1, "chegar a zero remove a linha");
  diz(restante[0].id === b.id, "e remove a linha certa, nao a primeira da lista");
}

{
  // O mesmo produto em duas cores sao duas linhas distintas: mexer numa
  // nao pode mexer na outra.
  const w = await montar([
    { id: a.id, quantity: 1, colour: "Deep Teal" },
    { id: a.id, quantity: 1, colour: "Coral" }
  ]);
  carregar(w, 1, "1");
  await espera();
  const cart = guardado(w);
  diz(cart[1].quantity === 2 && cart[0].quantity === 1,
      "duas cores do mesmo produto nao se confundem");
}

console.log(`\n${pass} passaram, ${fail} falharam\n`);
process.exit(fail ? 1 : 0);
