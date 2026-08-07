/**
 * Vista em tabela do catalogo.
 *
 * O painel do Decap edita um produto de cada vez, num formulario
 * comprido. Isso e bom para escrever a descricao de um produto novo e
 * mau para o que se faz mais vezes: olhar para tudo ao mesmo tempo,
 * corrigir tres precos, mudar dois estados, reordenar.
 *
 * Esta pagina faz a segunda coisa. A primeira continua a ser em /admin.
 *
 * Nao ha servidor por tras: le e grava data/shop.json directamente na
 * API do GitHub, com o mesmo token OAuth que o Decap usa. O token fica
 * so em memoria — fechar o separador obriga a entrar outra vez, que e o
 * que se quer numa pagina com permissao de escrita no repositorio.
 */
(function () {
  "use strict";

  const REPO = "hubertdungen/DungenLabs_DLX";
  const BRANCH = "main";
  const FICHEIRO = "data/shop.json";
  const API = `https://api.github.com/repos/${REPO}/contents/${FICHEIRO}`;

  const MATERIAIS = ["PLA", "PETG", "ABS", "ASA", "TPU", "PC", "PA", "CF", "Resina"];
  const MARGENS = [0.2, 0.25, 0.3, 0.35, 0.4];
  const ESTADOS = [
    ["in-stock", "Em stock"],
    ["made-to-order", "Por encomenda"],
    ["coming-soon", "Em breve"],
    ["sold-out", "Esgotado"]
  ];

  /* ------------------------------------------------------------ estado */

  let token = null;
  let catalogo = null;
  let sha = null;        // versao do ficheiro de onde partimos
  let sujo = false;      // ha alteracoes por gravar?

  const $ = (sel) => document.querySelector(sel);

  function marcarSujo() {
    sujo = true;
    $("#save").disabled = false;
    $("#estado").textContent = "alterações por gravar";
    $("#estado").className = "aviso";
  }

  /* -------------------------------------------------------------- base64 */

  // O JSON tem acentos, e o btoa so aceita bytes. Passa-se por UTF-8
  // primeiro, senao "Secretária" parte a codificacao.
  function paraBase64(texto) {
    const bytes = new TextEncoder().encode(texto);
    let binario = "";
    for (const b of bytes) binario += String.fromCharCode(b);
    return btoa(binario);
  }

  function deBase64(b64) {
    const limpo = b64.replace(/\s/g, "");
    const binario = atob(limpo);
    const bytes = Uint8Array.from(binario, (c) => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  }

  /* ---------------------------------------------------------------- auth */

  /**
   * Repete o aperto de mao que o Decap faz com netlify/functions/auth.js
   * e callback.js. O popup manda "authorizing:github", respondemos, e
   * ele devolve o token.
   */
  function entrar() {
    return new Promise((resolve, reject) => {
      const popup = window.open("/api/auth", "dlx-oauth", "width=680,height=760");
      if (!popup) return reject(new Error("O browser bloqueou a janela de autenticação."));

      function aoReceber(evento) {
        if (evento.origin !== window.location.origin) return;
        const dados = evento.data;
        if (typeof dados !== "string") return;

        if (dados === "authorizing:github") {
          popup.postMessage("ready", window.location.origin);
          return;
        }
        if (dados.startsWith("authorization:github:success:")) {
          window.removeEventListener("message", aoReceber);
          popup.close();
          resolve(JSON.parse(dados.slice("authorization:github:success:".length)).token);
        }
        if (dados.startsWith("authorization:github:error:")) {
          window.removeEventListener("message", aoReceber);
          popup.close();
          const erro = JSON.parse(dados.slice("authorization:github:error:".length));
          reject(new Error(erro.message || "Falhou a autenticação."));
        }
      }

      window.addEventListener("message", aoReceber);
    });
  }

  /* ------------------------------------------------------------ github */

  async function carregar() {
    const r = await fetch(`${API}?ref=${BRANCH}`, {
      headers: { Authorization: `token ${token}`, Accept: "application/vnd.github+json" },
      cache: "no-store"
    });
    if (!r.ok) throw new Error(`Não consegui ler o catálogo (HTTP ${r.status}).`);
    const dados = await r.json();
    sha = dados.sha;
    catalogo = JSON.parse(deBase64(dados.content));
  }

  async function gravar() {
    const problemas = validar();
    if (problemas.length) {
      $("#estado").textContent = problemas[0];
      $("#estado").className = "erro";
      return;
    }

    $("#save").disabled = true;
    $("#estado").textContent = "a gravar…";
    $("#estado").className = "";

    const r = await fetch(API, {
      method: "PUT",
      headers: {
        Authorization: `token ${token}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        message: "catalogue: edit from the table view",
        content: paraBase64(`${JSON.stringify(catalogo, null, 2)}\n`),
        sha,
        branch: BRANCH
      })
    });

    if (r.status === 409) {
      // Alguem gravou pelo Decap entretanto. Escrever por cima apagava
      // o trabalho dessa pessoa em silencio.
      $("#estado").textContent =
        "O catálogo mudou noutro sítio entretanto. Recarrega a página e repete — para não apagar o que lá está.";
      $("#estado").className = "erro";
      return;
    }
    if (!r.ok) {
      $("#estado").textContent = `Não consegui gravar (HTTP ${r.status}).`;
      $("#estado").className = "erro";
      $("#save").disabled = false;
      return;
    }

    sha = (await r.json()).content.sha;
    sujo = false;
    $("#estado").textContent = "gravado — o site reconstrói em cerca de um minuto";
    $("#estado").className = "ok";
  }

  /** Coisas que nao devem chegar ao ficheiro. */
  function validar() {
    const problemas = [];
    const vistos = new Set();
    const seccoes = new Set(catalogo.categories.map((c) => c.id));

    catalogo.products.forEach((p, i) => {
      if (!p.id || !/^[a-z0-9-]+$/.test(p.id)) {
        problemas.push(`Linha ${i + 1}: o ID "${p.id || ""}" tem de ser minúsculas, números e hífens.`);
      }
      if (vistos.has(p.id)) problemas.push(`Há dois produtos com o ID "${p.id}".`);
      vistos.add(p.id);

      if (!p.title) problemas.push(`Linha ${i + 1}: falta o título.`);
      (p.categoryIds || []).forEach((c) => {
        if (!seccoes.has(c)) problemas.push(`Linha ${i + 1}: a secção "${c}" não existe.`);
      });
    });
    return problemas;
  }

  /* ----------------------------------------------------------- desenho */

  const euros = (n) =>
    typeof n === "number" ? `${n.toFixed(2).replace(".", ",")} €` : "—";

  function campo(tipo, valor, aoMudar, extra = {}) {
    const input = document.createElement("input");
    input.type = tipo;
    input.value = valor ?? "";
    Object.assign(input, extra);
    input.addEventListener("change", () => {
      aoMudar(tipo === "number" ? Number(input.value) : input.value);
      marcarSujo();
      desenhar();
    });
    return input;
  }

  function escolha(opcoes, valor, aoMudar) {
    const select = document.createElement("select");
    opcoes.forEach(([v, rotulo]) => {
      const o = document.createElement("option");
      o.value = String(v);
      o.textContent = rotulo;
      if (String(v) === String(valor)) o.selected = true;
      select.append(o);
    });
    select.addEventListener("change", () => {
      aoMudar(select.value);
      marcarSujo();
      desenhar();
    });
    return select;
  }

  function celula(linha, conteudo, classe) {
    const td = document.createElement("td");
    if (classe) td.className = classe;
    if (conteudo instanceof Node) td.append(conteudo);
    else td.textContent = conteudo ?? "";
    linha.append(td);
    return td;
  }

  function desenhar() {
    const corpo = $("#linhas");
    corpo.replaceChildren();

    catalogo.products.forEach((p, indice) => {
      const tr = document.createElement("tr");
      p.costing = p.costing || {};
      const calculado = window.DLXPricing.hasCosting(p)
        ? window.DLXPricing.computePrice(p.costing)
        : null;

      // miniatura
      const img = document.createElement("img");
      img.src = `/${p.cardImage || p.mainImage || ""}`;
      img.alt = "";
      img.className = "mini";
      img.loading = "lazy";
      celula(tr, img, "col-img");

      // titulo em duas linguas
      const titulos = document.createElement("div");
      titulos.className = "titulos";
      titulos.append(
        campo("text", p.title, (v) => { p.title = v; }, { placeholder: "Título (EN)" }),
        campo("text", p.title_pt, (v) => { p.title_pt = v; }, { placeholder: "Título (PT)" })
      );
      const id = document.createElement("code");
      id.textContent = p.id;
      titulos.append(id);
      celula(tr, titulos, "col-titulo");

      celula(tr, escolha(ESTADOS, p.status, (v) => { p.status = v; }), "col-estado");

      // custo
      const custo = document.createElement("div");
      custo.className = "custo";
      custo.append(
        campo("number", p.costing.grams, (v) => { p.costing.grams = v; }, { min: 0, step: 1, title: "gramas" }),
        campo("number", p.costing.hours, (v) => { p.costing.hours = v; }, { min: 0, step: 0.5, title: "horas" }),
        escolha(MATERIAIS.map((m) => [m, m]), p.costing.material || "PETG", (v) => { p.costing.material = v; }),
        escolha(MARGENS.map((m) => [m, `${Math.round(m * 100)}%`]), p.costing.margin ?? 0.35,
          (v) => { p.costing.margin = Number(v); }),
        campo("number", p.costing.cultsUsd, (v) => { p.costing.cultsUsd = v; },
          { min: 0, step: 0.01, title: "preço no Cults3D, em dólares" })
      );
      celula(tr, custo, "col-custo");

      // preco
      const preco = document.createElement("div");
      preco.className = "preco";
      if (calculado) {
        p.price = calculado.price;
        const valor = document.createElement("strong");
        valor.textContent = euros(calculado.price);
        const detalhe = document.createElement("span");
        detalhe.textContent = `lucro ${euros(calculado.profit)}`;
        preco.append(valor, detalhe);
      } else {
        preco.append(
          campo("number", p.price, (v) => { p.price = v || null; }, { step: 0.1, min: 0, placeholder: "manual" })
        );
        const nota = document.createElement("span");
        nota.textContent = "sem dados de custo";
        preco.append(nota);
      }
      celula(tr, preco, "col-preco");

      // ordem e remocao
      const accoes = document.createElement("div");
      accoes.className = "accoes";
      const mover = (delta) => {
        const destino = indice + delta;
        if (destino < 0 || destino >= catalogo.products.length) return;
        const [movido] = catalogo.products.splice(indice, 1);
        catalogo.products.splice(destino, 0, movido);
        marcarSujo();
        desenhar();
      };
      const subir = document.createElement("button");
      subir.type = "button";
      subir.textContent = "↑";
      subir.title = "Subir";
      subir.addEventListener("click", () => mover(-1));
      const descer = document.createElement("button");
      descer.type = "button";
      descer.textContent = "↓";
      descer.title = "Descer";
      descer.addEventListener("click", () => mover(1));
      const abrir = document.createElement("a");
      abrir.href = `/shop.html#${(p.categoryIds || [])[0] || ""}/${p.id}`;
      abrir.target = "_blank";
      abrir.rel = "noreferrer";
      abrir.textContent = "ver";
      abrir.title = "Abrir no site";
      accoes.append(subir, descer, abrir);
      celula(tr, accoes, "col-accoes");

      corpo.append(tr);
    });

    $("#contagem").textContent =
      `${catalogo.products.length} produtos · ${catalogo.categories.length} secções`;
  }

  /* ---------------------------------------------------------- arranque */

  async function iniciar() {
    $("#entrar").disabled = true;
    $("#estado").textContent = "a autenticar…";
    try {
      token = await entrar();
      $("#estado").textContent = "a carregar o catálogo…";
      await carregar();
      $("#login").hidden = true;
      $("#tabela-wrap").hidden = false;
      $("#save").hidden = false;
      $("#dica").hidden = false;
      $("#estado").textContent = "carregado";
      $("#estado").className = "ok";
      desenhar();
    } catch (erro) {
      $("#estado").textContent = erro.message;
      $("#estado").className = "erro";
      $("#entrar").disabled = false;
    }
  }

  $("#entrar").addEventListener("click", iniciar);
  $("#save").addEventListener("click", () => gravar().catch((e) => {
    $("#estado").textContent = e.message;
    $("#estado").className = "erro";
    $("#save").disabled = false;
  }));

  // Fechar com alteracoes por gravar perde-as: o token so vive nesta
  // pagina, nao ha rascunho nenhum guardado.
  window.addEventListener("beforeunload", (e) => {
    if (!sujo) return;
    e.preventDefault();
    e.returnValue = "";
  });
})();
