/* Envolvido numa funcao de propósito.
 *
 * Estes ficheiros sao carregados como <script> normais, e scripts
 * normais partilham o escopo global: dois ficheiros a declarar
 * `const t` no topo fazem o segundo rebentar inteiro com
 * "redeclaration of const t" — e um ficheiro que rebenta nao desenha
 * nada. Foi assim que a loja ficou sem produtos.
 *
 * O corpo nao esta indentado para dentro do wrapper de proposito, para
 * o diff continuar legivel. O que importa e que nada aqui dentro chega
 * ao escopo global sem ser por window.
 */
(function () {
"use strict";

/**
 * Carrinho do DL X.
 *
 * Vive em localStorage e guarda apenas ids, quantidades e cor — nunca
 * precos. O total mostrado aqui e informativo; o valor cobrado e sempre
 * recalculado pelas funcoes do servidor a partir do catalogo. Se alguem
 * mexer no localStorage, o unico efeito e ver um numero errado ate ao
 * checkout, que corrige.
 *
 * Carregado em todas as paginas: mantem o contador no cabecalho e
 * desenha a gaveta lateral.
 */
const STORAGE_KEY = "dlx.cart.v1";

/**
 * Espelho das regras de netlify/functions/_shipping.js, so para escrever
 * a mensagem do envio gratuito. Quem decide o que e cobrado e o servidor:
 * mexer nisto aqui muda o texto, nao muda a factura.
 */
const FREE_NATIONAL_ABOVE = 3000;
const NATIONAL_SHIPPING = 490;

/** Traducao, se o i18n.js estiver carregado; senao fica o ingles. */
const t = (key, fallback) => window.DLXi18n?.t(key, fallback) ?? fallback;

const money = (cents, currency = "EUR") =>
  new Intl.NumberFormat(window.DLXi18n?.language === "pt" ? "pt-PT" : "en-IE", {
    style: "currency",
    currency
  }).format(cents / 100);

/** Mensagem de portes para um subtotal, em centimos. */
function shippingNote(subtotal, currency = "EUR") {
  if (subtotal === 0) return "";
  const falta = FREE_NATIONAL_ABOVE - subtotal;
  if (falta <= 0) return t("cart.freeShipping", "Free tracked delivery in Portugal.");
  return t("cart.paidShipping", "{amount} shipping in Portugal — add {short} for free delivery.")
    .replace("{amount}", money(NATIONAL_SHIPPING, currency))
    .replace("{short}", money(falta, currency));
}

/* ---------------------------------------------------------------- estado */

function readCart() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    if (!Array.isArray(raw)) return [];
    return raw
      .filter((item) => item && typeof item.id === "string")
      .map((item) => ({
        id: item.id,
        quantity: Math.min(Math.max(Number.parseInt(item.quantity, 10) || 1, 1), 50),
        colour: typeof item.colour === "string" ? item.colour : "Deep Teal"
      }));
  } catch {
    return [];
  }
}

function writeCart(items) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  document.dispatchEvent(new CustomEvent("dlx:cart-changed", { detail: items }));
}

function addToCart(id, quantity = 1, colour = "Deep Teal") {
  const items = readCart();
  const existing = items.find((item) => item.id === id && item.colour === colour);
  if (existing) existing.quantity = Math.min(existing.quantity + quantity, 50);
  else items.push({ id, quantity, colour });
  writeCart(items);
}

/**
 * Localiza uma linha por id e cor, e nao por posicao.
 *
 * A posicao muda quando uma linha e removida, e quem carrega no botao
 * tem na mao a posicao de quando o ecra foi desenhado. Id e cor sao o
 * que identifica a linha de facto — e addToCart ja junta repetidos.
 */
const findLine = (items, id, colour) =>
  items.findIndex((item) => item.id === id && item.colour === colour);

/**
 * Soma `delta` a quantidade de uma linha. Abaixo de 1 remove-a.
 *
 * Recebe o incremento em vez do valor final de proposito. O redesenho
 * do carrinho e assincrono, por isso dois cliques rapidos no "+" liam
 * os dois a mesma quantidade antiga e escreviam o mesmo numero: o
 * segundo clique perdia-se. Lendo o estado no momento do clique, cada
 * um conta.
 */
function stepQuantity(id, colour, delta) {
  const items = readCart();
  const i = findLine(items, id, colour);
  if (i === -1) return;
  const next = items[i].quantity + delta;
  if (next < 1) items.splice(i, 1);
  else items[i].quantity = Math.min(next, 50);
  writeCart(items);
}

/** Remove a linha por inteiro, qualquer que seja a quantidade. */
function removeLine(id, colour) {
  const items = readCart();
  const i = findLine(items, id, colour);
  if (i === -1) return;
  items.splice(i, 1);
  writeCart(items);
}

const cartCount = () => readCart().reduce((n, item) => n + item.quantity, 0);

/* -------------------------------------------------------------- catalogo */

let cataloguePromise = null;

function getCatalogue() {
  cataloguePromise ||= fetch("/data/shop.json", { cache: "no-cache" })
    .then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    })
    .catch((error) => {
      cataloguePromise = null;
      throw error;
    });
  return cataloguePromise;
}

/** Junta as linhas do carrinho aos dados do catalogo, descartando orfaos. */
async function resolveCart() {
  const catalogue = await getCatalogue();
  const currency = catalogue.currency || "EUR";
  const items = readCart();
  const lines = [];
  let dropped = false;

  items.forEach((item, index) => {
    const product = catalogue.products.find((p) => p.id === item.id);
    if (!product || typeof product.price !== "number") {
      dropped = true;
      return;
    }
    lines.push({ ...item, index, product, lineTotal: Math.round(product.price * 100) * item.quantity });
  });

  if (dropped) writeCart(lines.map(({ id, quantity, colour }) => ({ id, quantity, colour })));

  return { currency, lines, total: lines.reduce((sum, l) => sum + l.lineTotal, 0) };
}

/* ---------------------------------------------------------------- gaveta */

function buildDrawer() {
  if (document.querySelector("#dlx-cart-drawer")) return;

  const drawer = document.createElement("aside");
  drawer.id = "dlx-cart-drawer";
  drawer.className = "cart-drawer";
  drawer.hidden = true;
  drawer.setAttribute("aria-label", "Shopping cart");
  drawer.innerHTML = `
    <div class="cart-drawer-head">
      <strong data-i18n="cart.drawerTitle">Your cart</strong>
      <button type="button" class="cart-close" aria-label="Close cart"
              data-i18n-attr="aria-label:cart.close">&times;</button>
    </div>
    <div class="cart-drawer-body" id="dlx-cart-lines"></div>
    <div class="cart-drawer-foot">
      <div class="cart-total"><span data-i18n="cart.subtotal">Subtotal</span><strong id="dlx-cart-total">—</strong></div>
      <p class="cart-note" id="dlx-cart-shipping"></p>
      <a class="button" href="/cart.html" data-i18n="cart.checkout">Go to checkout</a>
    </div>`;

  const backdrop = document.createElement("div");
  backdrop.className = "cart-backdrop";
  backdrop.hidden = true;

  document.body.append(backdrop, drawer);

  const close = () => {
    drawer.hidden = true;
    backdrop.hidden = true;
    document.documentElement.classList.remove("cart-open");
  };
  drawer.querySelector(".cart-close").addEventListener("click", close);
  backdrop.addEventListener("click", close);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !drawer.hidden) close();
  });
}

async function openDrawer() {
  buildDrawer();
  const drawer = document.querySelector("#dlx-cart-drawer");
  const backdrop = document.querySelector(".cart-backdrop");
  drawer.hidden = false;
  backdrop.hidden = false;
  document.documentElement.classList.add("cart-open");
  await renderDrawer();
}

async function renderDrawer() {
  const host = document.querySelector("#dlx-cart-lines");
  const totalNode = document.querySelector("#dlx-cart-total");
  const shippingNode = document.querySelector("#dlx-cart-shipping");
  if (!host) return;

  let cart;
  try {
    cart = await resolveCart();
  } catch {
    host.innerHTML = `<p class="cart-empty">${t("cart.loadError", "Could not load the catalogue.")}</p>`;
    return;
  }

  if (!cart.lines.length) {
    host.innerHTML = `<p class="cart-empty">${t("cart.empty", "Nothing in the cart yet.")}</p>`;
    totalNode.textContent = money(0, cart.currency);
    if (shippingNode) shippingNode.textContent = "";
    return;
  }

  host.replaceChildren();
  cart.lines.forEach((line) => {
    const row = document.createElement("article");
    row.className = "cart-line";
    row.innerHTML = `
      <img src="/${line.product.cardImage || line.product.mainImage}" alt="" width="64" height="48">
      <div class="cart-line-copy">
        <strong>${line.product.title}</strong>
        <span>${line.colour}</span>
      </div>
      <div class="cart-line-qty">
        <button type="button" data-step="-1" aria-label="Decrease quantity"
                data-i18n-attr="aria-label:cart.decrease">−</button>
        <span>${line.quantity}</span>
        <button type="button" data-step="1" aria-label="Increase quantity"
                data-i18n-attr="aria-label:cart.increase">+</button>
      </div>
      <strong class="cart-line-total">${money(line.lineTotal, cart.currency)}</strong>`;

    row.querySelectorAll("[data-step]").forEach((button) => {
      button.addEventListener("click", () => {
        stepQuantity(line.id, line.colour, Number(button.dataset.step));
      });
    });
    host.append(row);
  });

  totalNode.textContent = money(cart.total, cart.currency);
  if (shippingNode) shippingNode.textContent = shippingNote(cart.total, cart.currency);

  // As linhas acabaram de nascer; o i18n.js ainda nao as viu.
  document.dispatchEvent(new CustomEvent("dlx:content-rendered", { detail: host.parentElement }));
}

/* -------------------------------------------------- botao no cabecalho */

function mountCartButton() {
  const nav = document.querySelector("#nav-links");
  if (!nav || nav.querySelector(".cart-button")) return;

  const button = document.createElement("button");
  button.type = "button";
  button.className = "cart-button";
  button.innerHTML =
    `<span data-i18n="cart.button">Cart</span> <span class="cart-count" data-cart-count>0</span>`;
  button.addEventListener("click", openDrawer);
  nav.append(button);
  refreshCount();
}

function refreshCount() {
  const count = cartCount();
  document.querySelectorAll("[data-cart-count]").forEach((node) => {
    node.textContent = String(count);
    node.classList.toggle("is-empty", count === 0);
  });
}

/* ------------------------------------------------------------- checkout */

/**
 * Envia o carrinho para a funcao indicada e segue para o pagamento.
 * Se o meio de pagamento ainda nao estiver configurado, o servidor
 * devolve um `fallback` e mandamos o cliente para o formulario.
 */
async function startCheckout(endpoint, button) {
  const items = readCart();
  if (!items.length) return;

  const original = button.textContent;
  button.disabled = true;
  button.textContent = t("cart.starting", "Starting…");

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items })
    });
    const data = await response.json();

    if (response.ok && data.url) {
      window.location.href = data.url;
      return;
    }
    if (data.fallback) {
      window.location.href = data.fallback;
      return;
    }
    throw new Error(data.error || "Checkout failed.");
  } catch (error) {
    button.disabled = false;
    button.textContent = original;
    const status = document.querySelector("#checkout-status");
    if (status) status.textContent = error.message;
    else alert(error.message);
  }
}

/* ----------------------------------------------------------------- init */

document.addEventListener("dlx:cart-changed", () => {
  refreshCount();
  if (!document.querySelector("#dlx-cart-drawer")?.hidden) renderDrawer();
  document.dispatchEvent(new CustomEvent("dlx:cart-render"));
});

// Mudar de lingua muda tambem o formato do dinheiro (1.234,56 € contra
// €1,234.56), por isso nao chega traduzir o texto: os valores tem de
// ser escritos outra vez.
document.addEventListener("dlx:lang-changed", () => {
  if (!document.querySelector("#dlx-cart-drawer")?.hidden) renderDrawer();
  document.dispatchEvent(new CustomEvent("dlx:cart-render"));
});

mountCartButton();
refreshCount();

window.DLXCart = {
  add: addToCart,
  read: readCart,
  step: stepQuantity,
  remove: removeLine,
  resolve: resolveCart,
  open: openDrawer,
  count: cartCount,
  money,
  shippingNote,
  startCheckout,
  FREE_NATIONAL_ABOVE
};
})();
