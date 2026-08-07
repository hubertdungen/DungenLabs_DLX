/**
 * Testes do bilingue.
 *
 * O que interessa aqui e o comportamento nas margens: quem chega de
 * um browser portugues ve portugues sem carregar em nada, quem ja
 * escolheu uma lingua nao a ve mudar sozinha, e uma chave que ainda
 * nao esteja traduzida deixa o ingles ficar em vez de esvaziar o
 * elemento.
 *
 * Correr a partir da raiz do repositorio:
 *
 *     node scripts/test-i18n.mjs
 */
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";

const require = createRequire(import.meta.url);
const { JSDOM } = require("jsdom");

const i18nJs = readFileSync("i18n.js", "utf8");
const catalogo = JSON.parse(readFileSync("data/shop.json", "utf8"));

/**
 * Monta uma pagina com o i18n.js carregado.
 * `linguas` finge o que o browser do visitante diz preferir.
 *
 * Espera um instante antes de devolver: o i18n.js so traduz quando o
 * documento acaba de carregar, e no jsdom esse evento e assincrono.
 */
async function montar({ linguas = ["en-GB", "en"], guardada = null } = {}) {
  const dom = new JSDOM(
    `<!doctype html><html lang="en"><body>
       <nav><div id="nav-links"><a href="/">Home</a></div></nav>
       <h1 data-i18n="hero.h1">The half of the lab that builds for itself.</h1>
       <p data-i18n="chave.que.nao.existe">Untranslated on purpose.</p>
       <li data-i18n-html="shipping.s2html">Portugal: €4.90 tracked — <strong>free on orders over €30</strong>.</li>
       <button aria-label="Open navigation" data-i18n-attr="aria-label:nav.open">≡</button>
     </body></html>`,
    { url: "https://dlx.dungenlabs.com/", runScripts: "outside-only" }
  );
  const { window } = dom;

  Object.defineProperty(window.navigator, "languages", { value: linguas, configurable: true });
  Object.defineProperty(window.navigator, "language", { value: linguas[0], configurable: true });
  if (guardada) window.localStorage.setItem("dlx.lang", guardada);

  window.eval(i18nJs);
  await new Promise((r) => setTimeout(r, 40));
  return window;
}

const texto = (w, seletor) => w.document.querySelector(seletor).textContent;

let pass = 0;
let fail = 0;
const diz = (ok, t) => {
  console.log(`  ${ok ? "ok    " : "FALHOU"}  ${t}`);
  ok ? pass++ : fail++;
};

console.log("\nescolha da lingua:\n");

{
  const w = await montar({ linguas: ["en-GB", "en"] });
  diz(w.DLXi18n.language === "en", "browser ingles fica em ingles");
  diz(w.document.documentElement.lang === "en", "o atributo lang do documento acompanha");
  diz(texto(w, "h1").startsWith("The half"), "o texto original mantem-se");
}

{
  const w = await montar({ linguas: ["pt-PT", "pt", "en"] });
  diz(w.DLXi18n.language === "pt", "browser portugues passa a portugues");
  diz(w.document.documentElement.lang === "pt", "e o lang do documento tambem");
  diz(texto(w, "h1") === "A metade do laboratório que constrói para si própria.",
      "o titulo aparece traduzido");
}

{
  const w = await montar({ linguas: ["pt-BR"] });
  diz(w.DLXi18n.language === "pt", "pt-BR tambem conta como portugues");
}

{
  // Uma escolha explicita nao pode ser desfeita pelo browser na visita
  // seguinte — foi uma decisao de quem la esteve.
  const w = await montar({ linguas: ["pt-PT"], guardada: "en" });
  diz(w.DLXi18n.language === "en", "a escolha guardada ganha ao browser");
}

{
  const w = await montar({ linguas: ["en"], guardada: "xx" });
  diz(w.DLXi18n.language === "en", "uma lingua guardada invalida nao parte nada");
}

console.log("\naplicacao:\n");

{
  const w = await montar({ linguas: ["pt-PT"] });
  diz(texto(w, "[data-i18n='chave.que.nao.existe']") === "Untranslated on purpose.",
      "chave em falta deixa o ingles ficar, nao esvazia");
  diz(w.document.querySelector("li").innerHTML.includes("<strong>"),
      "o data-i18n-html preserva as marcas de dentro");
  diz(w.document.querySelector("li").textContent.includes("30 €"),
      "e traduz o conteudo");
  // Pelo atributo, e nao por "button": o botao de lingua e criado
  // dentro da navegacao e apanharia o primeiro lugar.
  diz(w.document.querySelector("[data-i18n-attr]").getAttribute("aria-label") === "Abrir navegação",
      "atributos tambem sao traduzidos");
}

console.log("\nbotao:\n");

{
  const w = await montar({ linguas: ["en"] });
  const botao = w.document.querySelector(".lang-toggle");
  diz(Boolean(botao), "o botao aparece na navegacao");
  // Mostra a lingua para onde leva, nao a que esta activa.
  diz(botao.textContent === "PT", "em ingles, o botao diz PT");

  botao.dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
  diz(w.DLXi18n.language === "pt", "carregar muda para portugues");
  diz(botao.textContent === "EN", "e o botao passa a dizer EN");
  diz(texto(w, "h1").startsWith("A metade"), "o texto muda com o clique");
  diz(w.localStorage.getItem("dlx.lang") === "pt", "a escolha fica guardada");

  botao.dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
  diz(texto(w, "h1").startsWith("The half"), "e volta atras sem restos");
}

console.log("\nordem de carregamento:\n");

{
  /**
   * O caso que partiu de verdade no browser.
   *
   * As paginas carregam os scripts com defer. Quando um script defer
   * corre, o readyState ja e "interactive" mas o DOMContentLoaded ainda
   * nao aconteceu — e o cart.js, que vem depois do i18n.js, ainda nao
   * criou o botao do carrinho. Traduzir nessa altura deixava o
   * "Cart" em ingles e punha o botao de lingua no fim da barra.
   */
  const dom = new JSDOM(
    `<!doctype html><html lang="en"><body><nav><div id="nav-links"><a href="/">Home</a></div></nav></body></html>`,
    { url: "https://dlx.dungenlabs.com/", runScripts: "outside-only" }
  );
  const { window } = dom;
  Object.defineProperty(window.navigator, "languages", { value: ["pt-PT"], configurable: true });
  Object.defineProperty(window.document, "readyState", { value: "interactive", configurable: true });
  window.fetch = async () => ({ ok: true, status: 200, json: async () => catalogo });

  window.eval(i18nJs);                                    // primeiro script defer
  window.eval(readFileSync("cart.js", "utf8"));           // segundo script defer
  window.document.dispatchEvent(new window.Event("DOMContentLoaded"));
  await new Promise((r) => setTimeout(r, 40));

  const nav = window.document.querySelector("#nav-links");
  const carrinho = nav.querySelector(".cart-button");
  const toggle = nav.querySelector(".lang-toggle");

  diz(Boolean(carrinho && toggle), "os dois botoes aparecem");
  diz(carrinho?.textContent.includes("Carrinho"),
      `o botao do carrinho e traduzido (diz "${carrinho?.textContent.trim()}")`);
  diz(
    toggle && carrinho &&
      (toggle.compareDocumentPosition(carrinho) & window.Node.DOCUMENT_POSITION_FOLLOWING) !== 0,
    "o botao de lingua fica antes do carrinho"
  );
}

console.log("\ncatalogo:\n");

{
  const semTraducao = catalogo.products.filter((p) => !p.title_pt);
  diz(semTraducao.length === 0,
      semTraducao.length
        ? `produtos sem titulo em portugues: ${semTraducao.map((p) => p.id).join(", ")}`
        : "todos os produtos tem titulo em portugues");

  const semResumo = catalogo.categories.filter((c) => !c.summary_pt);
  diz(semResumo.length === 0, "todas as seccoes tem resumo em portugues");
}

console.log(`\n${pass} passaram, ${fail} falharam\n`);
process.exit(fail ? 1 : 0);
