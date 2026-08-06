/**
 * Leitura do catalogo do lado do servidor.
 *
 * Existe por uma unica razao: os precos nunca podem vir do browser. O
 * carrinho manda apenas ids e quantidades; os valores sao procurados
 * aqui, no ficheiro que o deploy incluiu. Sem isto, qualquer pessoa
 * editava o preco no devtools e comprava a um centimo.
 *
 * O data/shop.json chega junto das funcoes via `included_files` no
 * netlify.toml.
 */
const fs = require("fs");
const path = require("path");

const CANDIDATES = [
  path.join(process.cwd(), "data", "shop.json"),
  path.join(__dirname, "..", "..", "data", "shop.json"),
  path.join(__dirname, "data", "shop.json")
];

let cached = null;

function loadCatalogue() {
  if (cached) return cached;

  for (const candidate of CANDIDATES) {
    try {
      cached = JSON.parse(fs.readFileSync(candidate, "utf8"));
      return cached;
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  throw new Error("shop.json not found — check included_files in netlify.toml");
}

const SELLABLE = new Set(["in-stock", "made-to-order"]);
const MAX_QTY = 50;

/**
 * Valida o carrinho recebido e devolve linhas com precos de confianca.
 *
 * Rejeita — em vez de ignorar em silencio — tudo o que nao bata certo:
 * um produto que desapareceu do catalogo ou que deixou de estar a venda
 * tem de falhar de forma visivel, nao ser descartado do total.
 */
function priceCart(items) {
  const catalogue = loadCatalogue();
  const currency = (catalogue.currency || "EUR").toLowerCase();

  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("Cart is empty.");
  }
  if (items.length > 20) {
    throw new Error("Too many distinct items in one order.");
  }

  const lines = items.map((item) => {
    const product = catalogue.products.find((p) => p.id === item.id);
    if (!product) throw new Error(`Unknown product: ${item.id}`);
    if (!SELLABLE.has(product.status)) throw new Error(`${product.title} is not available to order.`);
    if (typeof product.price !== "number") throw new Error(`${product.title} has no published price.`);

    // Number() em vez de parseInt(): o parseInt aceitaria "1.5" e "3abc",
    // devolvendo 1 e 3 em silencio. Aqui uma quantidade malformada e
    // recusada em vez de adivinhada.
    const quantity = Number(item.quantity);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QTY) {
      throw new Error(`Invalid quantity for ${product.title}.`);
    }

    // A cor e escolha do cliente, nao afecta o preco: vai como nota.
    const colour = typeof item.colour === "string" ? item.colour.slice(0, 40) : "";

    return {
      id: product.id,
      title: product.title,
      colour,
      quantity,
      unitAmount: Math.round(product.price * 100),
      image: product.cardImage || product.mainImage
    };
  });

  const total = lines.reduce((sum, line) => sum + line.unitAmount * line.quantity, 0);
  return { currency, lines, total };
}

module.exports = { loadCatalogue, priceCart };
