const toggle = document.querySelector(".mobile-toggle");
const navLinks = document.querySelector("#nav-links");

if (toggle && navLinks) {
  toggle.addEventListener("click", () => {
    const open = navLinks.classList.toggle("is-open");
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Close navigation" : "Open navigation");
  });

  navLinks.addEventListener("click", (event) => {
    if (event.target.tagName === "A") {
      navLinks.classList.remove("is-open");
      toggle.setAttribute("aria-expanded", "false");
    }
  });
}

const mosaicRoot = document.querySelector("#shop-mosaic");
const viewTitle = document.querySelector("#shop-view-title");
const viewSummary = document.querySelector("#shop-view-summary");
const breadcrumb = document.querySelector("#shop-breadcrumb");
const resetButton = document.querySelector("[data-shop-reset]");

const shopState = { mode: "categories", categoryId: null, productId: null };
let shop = null;

function createElement(tagName, className, text) {
  const node = document.createElement(tagName);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function getCategory(categoryId) {
  return shop.categories.find((item) => item.id === categoryId) || null;
}

function getProduct(productId) {
  return shop.products.find((item) => item.id === productId) || null;
}

function getProductsForCategory(categoryId) {
  return shop.products.filter((product) => (product.categoryIds || []).includes(categoryId));
}

function getLayoutClass(entry) {
  const layout = entry.layout || "standard";
  if (layout === "wide" || layout === "featured") return "span-wide";
  if (layout === "tall") return "span-tall";
  return "span-standard";
}

/** Formata o preco na moeda definida no shop.json; null significa "sem preco publicado". */
function formatPrice(value) {
  if (typeof value !== "number") return null;
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: shop.currency || "EUR"
  }).format(value);
}

const STATUS_LABELS = {
  "in-stock": "In stock",
  "made-to-order": "Made to order",
  "coming-soon": "Coming soon",
  "sold-out": "Sold out"
};

function createMosaicTile({ key, className, image, imageAlt, label, title, summary, button = true }) {
  const tile = document.createElement(button ? "button" : "article");
  tile.className = `mosaic-tile ${className || ""}`.trim();
  tile.setAttribute("data-mosaic-key", key);
  if (button) tile.type = "button";

  if (image) {
    const media = document.createElement("img");
    media.className = "mosaic-image";
    media.src = image;
    media.alt = imageAlt || "";
    media.loading = "lazy";
    tile.append(media);
  }

  if (label || title || summary) {
    const overlay = createElement("span", "mosaic-overlay");
    if (label) overlay.append(createElement("span", "mosaic-label", label));
    if (title) overlay.append(createElement("strong", "", title));
    if (summary) overlay.append(createElement("em", "", summary));
    tile.append(overlay);
  }

  return tile;
}

function createTags(tags) {
  const row = createElement("span", "tag-row");
  (Array.isArray(tags) ? tags : []).forEach((tag) => row.append(createElement("span", "tag", tag)));
  return row;
}

function appendTags(tile, tags) {
  tile.querySelector(".mosaic-overlay")?.append(createTags(tags));
}

/** Etiqueta de preco/estado que aparece no canto do cartao. */
function appendPriceBadge(tile, product) {
  const price = formatPrice(product.price);
  const status = STATUS_LABELS[product.status] || "";
  if (!price && !status) return;

  const badge = createElement("span", "price-badge");
  if (price) badge.append(createElement("strong", "", price));
  if (status) badge.append(createElement("span", "price-badge-status", status));
  if (product.status === "coming-soon" || product.status === "sold-out") {
    badge.classList.add("is-muted");
  }
  tile.append(badge);
}

function captureTileRects() {
  const rects = new Map();
  if (!mosaicRoot) return rects;
  mosaicRoot.querySelectorAll("[data-mosaic-key]").forEach((tile) => {
    rects.set(tile.getAttribute("data-mosaic-key"), tile.getBoundingClientRect());
  });
  return rects;
}

function animateTiles(previousRects) {
  if (!mosaicRoot || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  mosaicRoot.querySelectorAll("[data-mosaic-key]").forEach((tile) => {
    const previous = previousRects.get(tile.getAttribute("data-mosaic-key"));
    const current = tile.getBoundingClientRect();
    tile.style.transformOrigin = "top left";

    if (previous) {
      tile.animate(
        [
          {
            transform: `translate(${previous.left - current.left}px, ${previous.top - current.top}px) `
              + `scale(${previous.width / Math.max(current.width, 1)}, ${previous.height / Math.max(current.height, 1)})`,
            opacity: 0.82
          },
          { transform: "translate(0, 0) scale(1, 1)", opacity: 1 }
        ],
        { duration: 520, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" }
      );
    } else {
      tile.animate(
        [
          { transform: "translateY(18px) scale(0.96)", opacity: 0 },
          { transform: "translateY(0) scale(1)", opacity: 1 }
        ],
        { duration: 420, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" }
      );
    }
  });
}

function updateChrome({ mode, category, product }) {
  if (!viewTitle || !viewSummary || !breadcrumb) return;

  if (mode === "categories") {
    viewTitle.textContent = "Shop";
    viewSummary.textContent = "Proprietary hardware from the DL X bench, printed to order in Lisbon.";
    breadcrumb.textContent = "Shop";
  } else if (mode === "category" && category) {
    viewTitle.textContent = category.title;
    viewSummary.textContent = category.summary;
    breadcrumb.textContent = `Shop / ${category.title}`;
  } else if (mode === "product" && category && product) {
    viewTitle.textContent = product.title;
    viewSummary.textContent = product.summary;
    breadcrumb.textContent = `Shop / ${category.title} / ${product.title}`;
  }

  if (resetButton) resetButton.hidden = mode === "categories";
}

function renderCategoriesView() {
  mosaicRoot.dataset.mode = "categories";

  shop.categories.forEach((category) => {
    const count = getProductsForCategory(category.id).length;
    const tile = createMosaicTile({
      key: `category-${category.id}`,
      className: `category-card ${getLayoutClass(category)}`,
      image: category.image,
      imageAlt: category.imageAlt,
      label: count === 1 ? "1 item" : `${count} items`,
      title: category.title,
      summary: category.summary
    });
    tile.addEventListener("click", () =>
      transition({ mode: "category", categoryId: category.id, productId: null })
    );
    mosaicRoot.append(tile);
  });
}

function renderCategoryView(categoryId) {
  const category = getCategory(categoryId);
  if (!category) return renderCategoriesView();

  mosaicRoot.dataset.mode = "category";

  const feature = createMosaicTile({
    key: `category-${category.id}`,
    className: "category-card-feature span-wide",
    image: category.image,
    imageAlt: category.imageAlt,
    label: "Category",
    title: category.title,
    summary: category.summary,
    button: false
  });
  mosaicRoot.append(feature);

  const products = getProductsForCategory(categoryId);

  if (!products.length) {
    const empty = createMosaicTile({
      key: `empty-${category.id}`,
      className: "project-copy-tile span-standard",
      title: "Nothing listed yet",
      summary: "This category is being prepared. Get in touch if you need something specific.",
      button: false
    });
    mosaicRoot.append(empty);
  }

  products.forEach((product) => {
    const tile = createMosaicTile({
      key: `product-${product.id}`,
      className: `project-card-mosaic ${getLayoutClass(product)}`,
      image: product.cardImage || product.mainImage,
      imageAlt: product.cardImageAlt || product.mainImageAlt,
      label: product.stageLabel || "Product",
      title: product.title,
      summary: product.summary
    });
    appendTags(tile, product.tags);
    appendPriceBadge(tile, product);
    tile.addEventListener("click", () =>
      transition({ mode: "product", categoryId: category.id, productId: product.id })
    );
    mosaicRoot.append(tile);
  });

  const back = createMosaicTile({
    key: "back-to-categories",
    className: "project-copy-tile span-standard",
    title: "All categories",
    summary: "Back to the full DL X catalogue."
  });
  back.addEventListener("click", () =>
    transition({ mode: "categories", categoryId: category.id, productId: null })
  );
  mosaicRoot.append(back);
}

/** Painel de compra: precos, estado e os botoes de checkout do produto. */
function createBuyPanel(product) {
  const panel = createElement("article", "buy-panel");
  panel.setAttribute("data-mosaic-key", `buy-${product.id}`);

  const price = formatPrice(product.price);
  panel.append(createElement("span", "mosaic-label", STATUS_LABELS[product.status] || "Availability"));
  panel.append(createElement("strong", "buy-price", price || "Price on request"));

  if (Array.isArray(product.specs) && product.specs.length) {
    const list = createElement("dl", "buy-specs");
    product.specs.forEach((spec) => {
      list.append(createElement("dt", "", spec.label));
      list.append(createElement("dd", "", spec.value));
    });
    panel.append(list);
  }

  const sellable = product.status !== "coming-soon" && product.status !== "sold-out";

  if (sellable) {
    const colourRow = createElement("div", "buy-colour");
    const colourLabel = createElement("label", "", "Colour");
    colourLabel.htmlFor = `colour-${product.id}`;
    const colour = document.createElement("select");
    colour.id = `colour-${product.id}`;
    ["Deep Teal", "Coral", "Matte Black", "Light Grey"].forEach((name) => {
      const option = document.createElement("option");
      option.textContent = name;
      colour.append(option);
    });
    colourRow.append(colourLabel, colour);
    panel.append(colourRow);

    const actions = createElement("div", "buy-actions");

    const add = createElement("button", "button", "Add to cart");
    add.type = "button";
    add.addEventListener("click", () => {
      window.DLXCart?.add(product.id, 1, colour.value);
      add.textContent = "Added ✓";
      setTimeout(() => { add.textContent = "Add to cart"; }, 1400);
      window.DLXCart?.open();
    });

    const request = createElement("a", "button secondary", "Request a quote");
    request.href = `/order.html?product=${encodeURIComponent(product.id)}`;

    actions.append(add, request);
    panel.append(actions);
    panel.append(createElement("p", "buy-note",
      "Printed to order in Lisbon. Card and crypto accepted at checkout; shipping added there."));
  } else {
    const actions = createElement("div", "buy-actions");
    const notify = createElement("a", "button", "Notify me");
    notify.href = `mailto:info@dungenlabs.com?subject=${encodeURIComponent(`DL X — ${product.title}`)}`;
    actions.append(notify);
    panel.append(actions);
    panel.append(createElement("p", "buy-note", "Not on sale yet — email to be told when it is."));
  }

  return panel;
}

function renderProductView(categoryId, productId) {
  const category = getCategory(categoryId);
  const product = getProduct(productId);
  if (!category || !product) return renderCategoryView(categoryId);

  mosaicRoot.dataset.mode = "product";

  const hero = createMosaicTile({
    key: `product-${product.id}`,
    className: "project-detail-hero span-wide",
    image: product.mainImage,
    imageAlt: product.mainImageAlt,
    label: product.stageLabel || "Product",
    title: product.title,
    summary: product.summary,
    button: false
  });
  appendTags(hero, product.tags);
  mosaicRoot.append(hero);

  mosaicRoot.append(createBuyPanel(product));

  if (product.description) {
    const copy = createMosaicTile({
      key: `copy-${product.id}`,
      className: "project-copy-tile span-standard",
      title: "Details",
      summary: product.description,
      button: false
    });
    mosaicRoot.append(copy);
  }

  (product.gallery || []).forEach((item, index) => {
    const tile = createMosaicTile({
      key: `gallery-${product.id}-${index}`,
      className: `project-card-mosaic ${item.ratio === "wide" ? "span-wide" : "span-standard"}`,
      image: item.src,
      imageAlt: item.alt,
      summary: item.caption || "",
      button: false
    });
    mosaicRoot.append(tile);
  });

  const back = createMosaicTile({
    key: "back-to-category",
    className: "project-copy-tile span-standard",
    title: `Back to ${category.title}`,
    summary: "Return to the category listing."
  });
  back.addEventListener("click", () =>
    transition({ mode: "category", categoryId: category.id, productId: null })
  );
  mosaicRoot.append(back);
}

function render() {
  if (!mosaicRoot || !shop) return;
  mosaicRoot.replaceChildren();

  if (shopState.mode === "product") renderProductView(shopState.categoryId, shopState.productId);
  else if (shopState.mode === "category") renderCategoryView(shopState.categoryId);
  else renderCategoriesView();

  updateChrome({
    mode: shopState.mode,
    category: getCategory(shopState.categoryId),
    product: getProduct(shopState.productId)
  });
}

function transition(nextState) {
  const previousRects = captureTileRects();
  Object.assign(shopState, nextState);
  render();
  animateTiles(previousRects);
  syncHash();
}

/** O estado da galeria vive no hash, para que qualquer produto seja partilhavel por link. */
function syncHash() {
  const { mode, categoryId, productId } = shopState;
  const hash = mode === "product" ? `#${categoryId}/${productId}` : mode === "category" ? `#${categoryId}` : "";
  history.replaceState(null, "", hash || window.location.pathname);
}

function readHash() {
  const raw = window.location.hash.replace(/^#/, "");
  if (!raw) return { mode: "categories", categoryId: null, productId: null };

  const [categoryId, productId] = raw.split("/");
  if (productId && getProduct(productId)) return { mode: "product", categoryId, productId };
  if (getCategory(categoryId)) return { mode: "category", categoryId, productId: null };
  return { mode: "categories", categoryId: null, productId: null };
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
    title.textContent = product.title;
    price.textContent = typeof product.price === "number"
      ? `${new Intl.NumberFormat("en-IE", { style: "currency", currency: catalogue.currency || "EUR" }).format(product.price)} each, before shipping`
      : "Price on request";
    summary.hidden = false;
  }
}

initOrderForm();

async function init() {
  if (!mosaicRoot) return;

  try {
    const response = await fetch("/data/shop.json", { cache: "no-cache" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    shop = await response.json();
  } catch (error) {
    mosaicRoot.append(
      createMosaicTile({
        key: "load-error",
        className: "project-copy-tile span-wide",
        title: "Catalogue unavailable",
        summary: "The product list could not be loaded. Please refresh, or email info@dungenlabs.com.",
        button: false
      })
    );
    console.error("DL X shop: failed to load catalogue", error);
    return;
  }

  Object.assign(shopState, readHash());
  render();
  animateTiles(new Map());

  resetButton?.addEventListener("click", () =>
    transition({ mode: "categories", categoryId: null, productId: null })
  );
  window.addEventListener("hashchange", () => transition(readHash()));
}

init();
