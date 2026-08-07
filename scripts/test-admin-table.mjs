/**
 * Testes da vista em tabela do catalogo.
 *
 * Esta pagina tem permissao de escrita no repositorio, por isso o que
 * interessa testar e: o token so e aceite da nossa propria origem, o
 * preco recalcula quando se mexe no custo, e gravar por cima do
 * trabalho de outra pessoa e recusado em vez de silencioso.
 *
 * Correr a partir da raiz do repositorio:
 *
 *     node scripts/test-admin-table.mjs
 */
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";

const require = createRequire(import.meta.url);
const { JSDOM } = require("jsdom");

const html = readFileSync("admin/table.html", "utf8");
const pricingJs = readFileSync("admin/pricing.js", "utf8");
const tableJs = readFileSync("admin/table.js", "utf8");
const catalogo = JSON.parse(readFileSync("data/shop.json", "utf8"));

const ORIGEM = "https://dlx.dungenlabs.com";
const espera = (ms = 40) => new Promise((r) => setTimeout(r, ms));

/**
 * Monta a pagina com o GitHub e o popup do OAuth fingidos.
 * `respostas` permite a cada teste decidir o que a API devolve.
 */
function montar({ tokenDeOutraOrigem = false, respostaPut } = {}) {
  const dom = new JSDOM(html.replace(/<script src=[^>]+><\/script>/g, ""), {
    url: `${ORIGEM}/admin/table.html`,
    runScripts: "outside-only"
  });
  const { window } = dom;

  window.TextEncoder = TextEncoder;
  window.TextDecoder = TextDecoder;

  const pedidos = [];
  const conteudo = Buffer.from(`${JSON.stringify(catalogo, null, 2)}\n`, "utf8").toString("base64");

  window.fetch = async (url, opcoes = {}) => {
    pedidos.push({ url: String(url), opcoes });
    if ((opcoes.method || "GET") === "GET") {
      return { ok: true, status: 200, json: async () => ({ sha: "sha-inicial", content: conteudo }) };
    }
    if (respostaPut) return respostaPut;
    return { ok: true, status: 200, json: async () => ({ content: { sha: "sha-novo" } }) };
  };

  // Popup fingido, com a mesma sequencia do callback.js:
  //   1. o popup anuncia-se ao opener
  //   2. o opener responde
  //   3. o popup entrega o token
  //
  // O passo 1 tem de ser assincrono. Mandado no proprio window.open,
  // chegava antes de a pagina ter registado o ouvinte — que foi
  // exactamente o que fez este teste falhar da primeira vez.
  window.open = () => {
    setTimeout(() => {
      window.dispatchEvent(
        new window.MessageEvent("message", { data: "authorizing:github", origin: ORIGEM })
      );
    }, 0);

    return {
      close() {},
      postMessage() {
        const payload = JSON.stringify({ token: "gho_token_de_teste", provider: "github" });
        window.dispatchEvent(
          new window.MessageEvent("message", {
            data: `authorization:github:success:${payload}`,
            origin: tokenDeOutraOrigem ? "https://sitio-mau.example" : ORIGEM
          })
        );
      }
    };
  };

  window.eval(pricingJs);
  window.eval(tableJs);

  return { window, pedidos };
}

let pass = 0;
let fail = 0;
const diz = (ok, t) => {
  console.log(`  ${ok ? "ok    " : "FALHOU"}  ${t}`);
  ok ? pass++ : fail++;
};

const linhas = (w) => w.document.querySelectorAll("#linhas tr");

console.log("\nentrada:\n");

{
  const { window: w } = montar();
  w.document.querySelector("#entrar").click();
  await espera(80);

  diz(w.document.querySelector("#tabela-wrap").hidden === false, "a tabela aparece depois de entrar");
  diz(linhas(w).length === catalogo.products.length,
      `uma linha por produto (${linhas(w).length})`);
  diz(w.document.querySelector("#save").hidden === false, "o botao de gravar fica visivel");
  diz(w.document.querySelector("#save").disabled === true, "e comeca desactivado, sem alteracoes");
}

{
  // O token nunca pode ser aceite de uma janela de outra origem: quem
  // conseguisse abrir esta pagina roubava escrita no repositorio.
  const { window: w } = montar({ tokenDeOutraOrigem: true });
  w.document.querySelector("#entrar").click();
  await espera(80);
  diz(w.document.querySelector("#tabela-wrap").hidden === true,
      "um token vindo de outra origem e ignorado");
}

console.log("\nedicao:\n");

{
  const { window: w } = montar();
  w.document.querySelector("#entrar").click();
  await espera(80);

  const primeira = linhas(w)[0];
  const gramas = primeira.querySelector('.custo input[title="gramas"]');
  const precoAntes = primeira.querySelector(".preco strong").textContent;

  gramas.value = String(Number(gramas.value) * 3);
  gramas.dispatchEvent(new w.Event("change"));
  await espera();

  const precoDepois = linhas(w)[0].querySelector(".preco strong").textContent;
  diz(precoAntes !== precoDepois, `triplicar o material sobe o preco (${precoAntes} → ${precoDepois})`);
  diz(w.document.querySelector("#save").disabled === false, "gravar fica disponivel");
  diz(w.document.querySelector("#estado").className === "aviso", "avisa que ha alteracoes por gravar");
}

{
  const { window: w } = montar();
  w.document.querySelector("#entrar").click();
  await espera(80);

  const antes = [...linhas(w)].map((tr) => tr.querySelector("code").textContent);
  linhas(w)[0].querySelector('.accoes button[title="Descer"]').click();
  await espera();
  const depois = [...linhas(w)].map((tr) => tr.querySelector("code").textContent);

  diz(depois[0] === antes[1] && depois[1] === antes[0], "descer troca a linha com a de baixo");
}

console.log("\ngravacao:\n");

{
  const { window: w, pedidos } = montar();
  w.document.querySelector("#entrar").click();
  await espera(80);

  const gramas = linhas(w)[0].querySelector('.custo input[title="gramas"]');
  gramas.value = "999";
  gramas.dispatchEvent(new w.Event("change"));
  await espera();

  w.document.querySelector("#save").click();
  await espera(80);

  const put = pedidos.find((p) => p.opcoes.method === "PUT");
  diz(Boolean(put), "grava com um PUT");

  const corpo = JSON.parse(put.opcoes.body);
  diz(corpo.sha === "sha-inicial", "envia o sha de onde partiu, para o GitHub detetar conflitos");
  diz(corpo.branch === "main", "grava no branch main");

  const gravado = JSON.parse(Buffer.from(corpo.content, "base64").toString("utf8"));
  diz(gravado.products[0].costing.grams === 999, "as alteracoes chegam ao ficheiro");
  diz(gravado.products[0].price > catalogo.products[0].price,
      "e o preco recalculado vai junto");
  diz(gravado.products.length === catalogo.products.length, "nao perde produtos pelo caminho");
  diz(JSON.stringify(gravado.categories) === JSON.stringify(catalogo.categories),
      "e nao mexe no que nao foi editado");
  diz(w.document.querySelector("#estado").className === "ok", "diz que gravou");
}

{
  // Alguem gravou pelo Decap entretanto.
  const { window: w } = montar({ respostaPut: { ok: false, status: 409, json: async () => ({}) } });
  w.document.querySelector("#entrar").click();
  await espera(80);

  const gramas = linhas(w)[0].querySelector('.custo input[title="gramas"]');
  gramas.value = "123";
  gramas.dispatchEvent(new w.Event("change"));
  await espera();

  w.document.querySelector("#save").click();
  await espera(80);

  const estado = w.document.querySelector("#estado");
  diz(estado.className === "erro", "um conflito e mostrado como erro");
  diz(estado.textContent.toLowerCase().includes("recarrega"),
      "e diz o que fazer, em vez de escrever por cima");
}

console.log("\ncodificacao:\n");

{
  const { window: w, pedidos } = montar();
  w.document.querySelector("#entrar").click();
  await espera(80);

  const titulo = linhas(w)[0].querySelector('input[placeholder="Título (PT)"]');
  titulo.value = "Secretária — acentuação à prova";
  titulo.dispatchEvent(new w.Event("change"));
  await espera();

  w.document.querySelector("#save").click();
  await espera(80);

  const put = pedidos.find((p) => p.opcoes.method === "PUT");
  const gravado = JSON.parse(
    Buffer.from(JSON.parse(put.opcoes.body).content, "base64").toString("utf8")
  );
  diz(gravado.products[0].title_pt === "Secretária — acentuação à prova",
      "acentos sobrevivem ao base64");
}

console.log(`\n${pass} passaram, ${fail} falharam\n`);
process.exit(fail ? 1 : 0);
