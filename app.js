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

const toggle = document.querySelector(".mobile-toggle");
const navLinks = document.querySelector("#nav-links");

if (toggle && navLinks) {
  toggle.addEventListener("click", () => {
    const open = navLinks.classList.toggle("is-open");
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute(
      "aria-label",
      open ? t("nav.close", "Close navigation") : t("nav.open", "Open navigation")
    );
  });

  navLinks.addEventListener("click", (event) => {
    if (event.target.tagName === "A") {
      navLinks.classList.remove("is-open");
      toggle.setAttribute("aria-expanded", "false");
    }
  });
}

/* --- Loja ---------------------------------------------------
 *
 * Uma grelha de produtos, como qualquer loja: tudo visivel a primeira,
 * filtros por seccao, preco e "Adicionar" no proprio cartao. Clicar no
 * cartao abre a pagina do produto no mesmo sitio. O estado vive no hash
 * (#seccao ou #seccao/produto), para que qualquer vista seja partilhavel.
 *
 * O mesmo codigo desenha a montra da pagina inicial: <div data-shop-grid
 * data-limit="8" data-link="/shop.html"> mostra os primeiros 8 sem filtros
 * e manda os cliques para a loja.
 */
const shopRoot = document.querySelector("[data-shop-grid]");
const isShowcase = Boolean(shopRoot?.dataset.link);
let shop = null;
let view = { categoryId: null, productId: null };

function createElement(tagName, className, text) {
  const node = document.createElement(tagName);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

/** Traducao, se o i18n.js estiver carregado; senao fica o ingles. */
const t = (key, fallback) => window.DLXi18n?.t(key, fallback) ?? fallback;

/** Campo do catalogo na lingua activa ("title_pt" ao lado de "title"); sem traducao fica o ingles. */
function localised(entry, campo) {
  if (!entry) return "";
  const pt = window.DLXi18n?.language === "pt" ? entry[`${campo}_pt`] : null;
  return pt || entry[campo] || "";
}

/** Formata o preco na moeda definida no shop.json; null significa "sem preco publicado". */
function formatPrice(value) {
  if (typeof value !== "number") return null;
  return new Intl.NumberFormat(window.DLXi18n?.language === "pt" ? "pt-PT" : "en-IE", {
    style: "currency",
    currency: shop.currency || "EUR"
  }).format(value);
}

const STATUS_KEYS = {
  "in-stock": ["shop.inStock", "In stock"],
  "made-to-order": ["shop.madeToOrder", "Made to order"],
  "coming-soon": ["shop.comingSoon", "Coming soon"],
  "sold-out": ["shop.soldOut", "Sold out"]
};

const statusLabel = (status) => {
  const par = STATUS_KEYS[status];
  return par ? t(par[0], par[1]) : status;
};

const COLOURS = ["Deep Teal", "Coral", "Matte Black", "Light Grey"];

const getCategory = (id) => shop.categories.find((c) => c.id === id) || null;
const getProduct = (id) => shop.products.find((p) => p.id === id) || null;
const isSellable = (p) => p.status !== "coming-soon" && p.status !== "sold-out";
const inCategory = (id) => shop.products.filter((p) => (p.categoryIds || []).includes(id));

function productHref(product, categoryId) {
  const hash = `#${categoryId || product.categoryIds?.[0] || "all"}/${product.id}`;
  return isShowcase ? `${shopRoot.dataset.link}${hash}` : hash;
}

/** Botao que poe uma unidade no carrinho e abre o carrinho. */
function addButton(product, colourOf, className = "button") {
  const add = createElement("button", className, t("shop.addToCart", "Add to cart"));
  add.type = "button";
  add.addEventListener("click", () => {
    window.DLXCart?.add(product.id, 1, colourOf());
    add.textContent = `${t("shop.added", "Added")} ✓`;
    setTimeout(() => { add.textContent = t("shop.addToCart", "Add to cart"); }, 1400);
    window.DLXCart?.open();
  });
  return add;
}

function productCard(product, categoryId) {
  const card = createElement("article", "product-card");
  const href = productHref(product, categoryId);

  const media = createElement("a", "product-card-media");
  media.href = href;
  media.tabIndex = -1;
  media.setAttribute("aria-hidden", "true");
  const img = document.createElement("img");
  img.src = `/${product.cardImage || product.mainImage}`.replace(/^\/+/, "/");
  img.alt = "";
  img.loading = "lazy";
  img.width = 600;
  img.height = 600;
  media.append(img);

  const body = createElement("div", "product-card-body");
  const title = createElement("h3", "product-card-title");
  const link = createElement("a", "", localised(product, "title"));
  link.href = href;
  title.append(link);
  body.append(title, createElement("p", "product-card-summary", localised(product, "summary")));

  const foot = createElement("div", "product-card-foot");
  const price = createElement("div", "product-card-price");
  price.append(createElement("strong", "", formatPrice(product.price) || t("shop.onRequest", "Price on request")));
  price.append(createElement("span", "", statusLabel(product.status)));
  foot.append(price);
  if (isSellable(product) && typeof product.price === "number") {
    foot.append(addButton(product, () => COLOURS[0], "button button-small"));
  }
  body.append(foot);

  card.append(media, body);
  return card;
}

function renderFilters(activeId) {
  const bar = createElement("div", "shop-filters");
  bar.setAttribute("role", "group");
  bar.setAttribute("aria-label", t("shop.filterLabel", "Filter by section"));

  const entries = [{ id: null, title: t("shop.all", "All"), count: shop.products.length }]
    .concat(shop.categories.map((c) => ({ id: c.id, title: localised(c, "title"), count: inCategory(c.id).length })))
    .filter((e) => e.count > 0);

  entries.forEach((entry) => {
    const chip = createElement("a", "shop-filter");
    chip.href = entry.id ? `#${entry.id}` : "#all";
    chip.append(document.createTextNode(entry.title), createElement("span", "shop-filter-count", String(entry.count)));
    if (entry.id === activeId) chip.setAttribute("aria-current", "true");
    bar.append(chip);
  });
  return bar;
}

function renderGrid(categoryId) {
  const limit = Number(shopRoot.dataset.limit) || Infinity;
  const products = (categoryId ? inCategory(categoryId) : shop.products).slice(0, limit);

  if (!isShowcase) shopRoot.append(renderFilters(categoryId));

  const grid = createElement("div", "product-grid");
  products.forEach((p) => grid.append(productCard(p, categoryId)));
  if (!products.length) grid.append(createElement("p", "shop-empty", t("shop.empty", "Nothing listed here yet.")));
  shopRoot.append(grid);
}

function renderDetail(product, categoryId) {
  const detail = createElement("article", "product-detail");

  const back = createElement("a", "product-back", `← ${t("shop.backToShop", "All products")}`);
  back.href = getCategory(categoryId) ? `#${categoryId}` : "#all";
  shopRoot.append(back);

  // Galeria: imagem grande + miniaturas que a trocam.
  const images = [{ src: product.mainImage, alt: product.mainImageAlt }]
    .concat((product.gallery || []).map((g) => ({ src: g.src, alt: g.alt })))
    .filter((img, i, all) => img.src && all.findIndex((o) => o.src === img.src) === i);

  const gallery = createElement("div", "product-gallery");
  const main = document.createElement("img");
  main.className = "product-gallery-main";
  main.src = `/${images[0].src}`;
  main.alt = images[0].alt || localised(product, "title");
  gallery.append(main);

  if (images.length > 1) {
    const thumbs = createElement("div", "product-thumbs");
    images.forEach((img, i) => {
      const b = createElement("button", "product-thumb");
      b.type = "button";
      b.setAttribute("aria-label", img.alt || `Image ${i + 1}`);
      if (i === 0) b.setAttribute("aria-current", "true");
      const tImg = document.createElement("img");
      tImg.src = `/${img.src}`;
      tImg.alt = "";
      tImg.loading = "lazy";
      b.append(tImg);
      b.addEventListener("click", () => {
        main.src = `/${img.src}`;
        main.alt = img.alt || "";
        thumbs.querySelectorAll("[aria-current]").forEach((n) => n.removeAttribute("aria-current"));
        b.setAttribute("aria-current", "true");
      });
      thumbs.append(b);
    });
    gallery.append(thumbs);
  }

  const info = createElement("div", "product-info");
  info.append(createElement("p", "eyebrow", localised(getCategory(categoryId) || getCategory(product.categoryIds?.[0]), "title")));
  info.append(createElement("h1", "product-title", localised(product, "title")));
  info.append(createElement("p", "product-summary", localised(product, "summary")));

  const priceRow = createElement("p", "product-price");
  priceRow.append(createElement("strong", "", formatPrice(product.price) || t("shop.onRequest", "Price on request")));
  priceRow.append(createElement("span", "", statusLabel(product.status)));
  info.append(priceRow);

  if (isSellable(product)) {
    const colourRow = createElement("div", "buy-colour");
    const colourLabel = createElement("label", "", t("shop.colour", "Colour"));
    colourLabel.htmlFor = `colour-${product.id}`;
    const colour = document.createElement("select");
    colour.id = `colour-${product.id}`;
    COLOURS.forEach((name) => colour.append(new Option(name)));
    colourRow.append(colourLabel, colour);
    info.append(colourRow);

    const actions = createElement("div", "buy-actions");
    if (typeof product.price === "number") actions.append(addButton(product, () => colour.value));
    const quote = createElement("a", "button secondary", t("shop.requestQuote", "Request a quote"));
    quote.href = `/order.html?product=${encodeURIComponent(product.id)}`;
    actions.append(quote);
    info.append(actions);
    info.append(createElement("p", "buy-note", t("shop.buyNote",
      "Printed to order in Lisbon, dispatched in 3–5 working days. Shipping €4.90 in Portugal, free over €30.")));
  } else {
    const actions = createElement("div", "buy-actions");
    const notify = createElement("a", "button", t("shop.notify", "Notify me"));
    notify.href = `mailto:info@dungenlabs.com?subject=${encodeURIComponent(`DL X — ${product.title}`)}`;
    actions.append(notify);
    info.append(actions);
  }

  if (product.description) {
    info.append(createElement("h2", "product-subhead", t("shop.details", "Details")));
    info.append(createElement("p", "product-description", localised(product, "description")));
  }

  if (Array.isArray(product.specs) && product.specs.length) {
    info.append(createElement("h2", "product-subhead", t("shop.specs", "Specifications")));
    const list = createElement("dl", "buy-specs");
    product.specs.forEach((spec) => {
      list.append(createElement("dt", "", spec.label), createElement("dd", "", spec.value));
    });
    info.append(list);
  }

  detail.append(gallery, info);
  shopRoot.append(detail);
}

function render() {
  if (!shopRoot || !shop) return;
  shopRoot.replaceChildren();
  const product = !isShowcase && getProduct(view.productId);
  // Na pagina do produto o titulo e o do produto; o cabecalho da loja sai.
  const head = document.querySelector(".shop-head");
  if (head) head.hidden = Boolean(product);
  if (product) {
    renderDetail(product, view.categoryId);
    document.title = `${localised(product, "title")} | DL X`;
  } else {
    renderGrid(isShowcase ? null : view.categoryId);
  }
}

function readHash() {
  const [categoryId, productId] = window.location.hash.replace(/^#/, "").split("/");
  return {
    categoryId: getCategory(categoryId) ? categoryId : null,
    productId: productId && getProduct(productId) ? productId : null
  };
}

/**
 * Pagina de encomenda: preenche o produto a partir de ?product=<id>.
 *
 * O campo fica readonly em vez de hidden — quem encomenda tem de poder ver
 * o que esta a pedir, e o valor vai a mesma no email do Netlify. Se o id
 * nao existir no catalogo, o campo abre editavel para nao bloquear ninguem.
 */
async function initOrderForm() {
  const field = document.querySelector("#order-product");
  if (!field) return;

  const productId = new URLSearchParams(window.location.search).get("product");
  if (!productId) {
    field.readOnly = false;
    field.placeholder = "Which product?";
    return;
  }

  let catalogue;
  try {
    const response = await fetch("/data/shop.json", { cache: "no-cache" });
    catalogue = await response.json();
  } catch (error) {
    field.readOnly = false;
    field.value = productId;
    console.error("DL X order: failed to load catalogue", error);
    return;
  }

  const product = catalogue.products.find((item) => item.id === productId);
  if (!product) {
    field.readOnly = false;
    field.value = productId;
    return;
  }

  field.value = product.title;

  const heading = document.querySelector("#order-heading");
  if (heading) heading.textContent = `Order — ${product.title}`;
  document.title = `Order ${product.title} | DL X`;

  const summary = document.querySelector("#order-summary");
  const image = document.querySelector("#order-image");
  const title = document.querySelector("#order-product-title");
  const price = document.querySelector("#order-product-price");

  if (summary && image && title && price) {
    image.src = product.cardImage || product.mainImage;
    image.alt = product.cardImageAlt || product.mainImageAlt || "";
    title.textContent = localised(product, "title");
    price.textContent = typeof product.price === "number"
      ? `${new Intl.NumberFormat("en-IE", { style: "currency", currency: catalogue.currency || "EUR" }).format(product.price)} each, before shipping`
      : "Price on request";
    summary.hidden = false;
  }
}

initOrderForm();

async function init() {
  if (!shopRoot) return;

  try {
    const response = await fetch("/data/shop.json", { cache: "no-cache" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    shop = await response.json();
  } catch (error) {
    shopRoot.append(createElement("p", "shop-empty",
      "The product list could not be loaded. Please refresh, or email info@dungenlabs.com."));
    console.error("DL X shop: failed to load catalogue", error);
    return;
  }

  view = readHash();
  render();

  window.addEventListener("hashchange", () => {
    view = readHash();
    render();
    // Abrir um produto leva ao topo dele; voltar a grelha fica onde estava.
    if (view.productId) shopRoot.scrollIntoView({ block: "start" });
  });

  // Mudar de lingua muda rotulos, botoes e o formato do preco, todos
  // escritos em codigo: desenhar outra vez e o mais simples.
  document.addEventListener("dlx:lang-changed", () => render());
}

init();
})();
