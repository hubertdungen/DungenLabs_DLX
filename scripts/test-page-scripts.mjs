/**
 * Carrega as paginas com os scripts todos, no mesmo escopo.
 *
 * Existe por causa de uma loja vazia em producao. O cart.js e o app.js
 * declaravam ambos `const t` no topo; scripts classicos partilham o
 * escopo global, por isso o segundo a carregar morria inteiro com
 * "redeclaration of const t" — e o segundo era o que desenhava os
 * produtos.
 *
 * Os outros testes nao apanharam nada disso porque carregavam cada
 * ficheiro com window.eval(), que lhe da um escopo proprio. Este usa
 * elementos <script> a serio, que e o que o browser faz.
 *
 *     node scripts/test-page-scripts.mjs
 */
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";

const require = createRequire(import.meta.url);
const { JSDOM } = require("jsdom");

const catalogo = JSON.parse(readFileSync("data/shop.json", "utf8"));

/** Que scripts e que cada pagina carrega, pela ordem do HTML. */
function scriptsDe(html) {
  return [...html.matchAll(/<script src="\/([^"]+)"[^>]*><\/script>/g)].map((m) => m[1]);
}

/**
 * Abre a pagina com os scripts injectados como <script> reais, para
 * partilharem o escopo global tal como no browser.
 */
async function abrir(ficheiro) {
  const html = readFileSync(ficheiro, "utf8");
  const scripts = scriptsDe(html);

  const dom = new JSDOM(html.replace(/<script src=[^>]+><\/script>/g, ""), {
    url: `https://dlx.dungenlabs.com/${ficheiro}`,
    runScripts: "dangerously",
    pretendToBeVisual: true
  });
  const { window } = dom;

  const erros = [];
  window.addEventListener("error", (e) => erros.push(e.message || String(e.error)));
  window.onerror = (msg) => erros.push(String(msg));

  window.fetch = async (url) => {
    if (String(url).includes("shop.json")) {
      return { ok: true, status: 200, json: async () => catalogo };
    }
    return { ok: false, status: 404, json: async () => ({}) };
  };
  window.matchMedia = () => ({ matches: false, addEventListener() {} });
  // O jsdom nao tem Web Animations API; o browser tem.
  window.Element.prototype.animate = () => ({ finished: Promise.resolve(), cancel() {} });

  for (const src of scripts) {
    const node = window.document.createElement("script");
    node.textContent = readFileSync(src, "utf8");
    window.document.body.append(node);
  }

  window.document.dispatchEvent(new window.Event("DOMContentLoaded"));
  await new Promise((r) => setTimeout(r, 150));

  return { window, erros, scripts };
}

let pass = 0;
let fail = 0;
const diz = (ok, t) => {
  console.log(`  ${ok ? "ok    " : "FALHOU"}  ${t}`);
  ok ? pass++ : fail++;
};

console.log("\nscripts das paginas, no mesmo escopo:\n");

for (const pagina of ["index.html", "shop.html", "cart.html", "order.html", "shipping.html"]) {
  const { window, erros, scripts } = await abrir(pagina);
  diz(erros.length === 0,
      `${pagina} (${scripts.length} scripts) carrega sem erros${erros.length ? ` — ${erros[0]}` : ""}`);

  // Um ficheiro que rebenta nao declara nada: se o cart.js morresse, o
  // DLXCart desaparecia sem mais aviso do que uma loja vazia.
  if (scripts.includes("cart.js")) {
    diz(Boolean(window.DLXCart), `${pagina}: o carrinho ficou disponivel`);
  }
  if (scripts.includes("i18n.js")) {
    diz(Boolean(window.DLXi18n), `${pagina}: o i18n ficou disponivel`);
  }
}

console.log("\na loja desenha:\n");

{
  const { window, erros } = await abrir("shop.html");
  const mosaico = window.document.querySelector("#shop-mosaic");
  diz(Boolean(mosaico), "a grelha existe");
  diz(mosaico && mosaico.children.length === catalogo.categories.length,
      `desenha uma secção por categoria (${mosaico ? mosaico.children.length : 0} de ${catalogo.categories.length})`);
  diz(erros.length === 0, "sem erros de JavaScript");

  const texto = mosaico ? mosaico.textContent : "";
  diz(catalogo.categories.every((c) => texto.includes(c.title)),
      "todas as secções aparecem pelo nome");
}

{
  // Entrar directamente numa categoria pelo endereco, como faz uma
  // ligacao do rodape.
  const html = readFileSync("shop.html", "utf8");
  const dom = new JSDOM(html.replace(/<script src=[^>]+><\/script>/g, ""), {
    url: "https://dlx.dungenlabs.com/shop.html#workshop",
    runScripts: "dangerously",
    pretendToBeVisual: true
  });
  const { window } = dom;
  window.fetch = async () => ({ ok: true, status: 200, json: async () => catalogo });
  window.matchMedia = () => ({ matches: false, addEventListener() {} });
  window.Element.prototype.animate = () => ({ finished: Promise.resolve(), cancel() {} });

  for (const src of scriptsDe(html)) {
    const node = window.document.createElement("script");
    node.textContent = readFileSync(src, "utf8");
    window.document.body.append(node);
  }
  window.document.dispatchEvent(new window.Event("DOMContentLoaded"));
  await new Promise((r) => setTimeout(r, 150));

  const mosaico = window.document.querySelector("#shop-mosaic");
  const esperados = catalogo.products.filter((p) => (p.categoryIds || []).includes("workshop"));
  diz(mosaico && mosaico.children.length >= esperados.length,
      `#workshop mostra os seus produtos (${mosaico ? mosaico.children.length : 0} azulejos, ${esperados.length} produtos)`);
}

console.log(`\n${pass} passaram, ${fail} falharam\n`);
process.exit(fail ? 1 : 0);
