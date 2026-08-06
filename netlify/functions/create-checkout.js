/**
 * Cria uma sessao de Stripe Checkout a partir do carrinho.
 *
 * O browser manda ids e quantidades; os precos saem do catalogo do lado
 * do servidor (ver _catalogue.js). A chave secreta da Stripe fica nas
 * variaveis de ambiente do Netlify e nunca chega ao cliente.
 */
const { priceCart } = require("./_catalogue");

const SHIPPING = [
  { label: "Portugal — tracked", amount: 490, minDays: 2, maxDays: 4 },
  { label: "European Union — tracked", amount: 1190, minDays: 4, maxDays: 8 }
];

const SHIP_TO = [
  "PT", "ES", "FR", "DE", "IT", "NL", "BE", "LU", "IE", "AT",
  "DK", "SE", "FI", "PL", "CZ", "SK", "SI", "HR", "HU", "RO",
  "BG", "GR", "EE", "LV", "LT", "MT", "CY"
];

function reply(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    body: JSON.stringify(body)
  };
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return reply(405, { error: "Method not allowed." });

  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) {
    // Sem chave configurada a loja nao fica partida: o cliente e mandado
    // para o formulario de encomenda, que continua a funcionar.
    return reply(503, {
      error: "Card checkout is not configured yet.",
      fallback: "/order.html"
    });
  }

  let priced;
  try {
    priced = priceCart(JSON.parse(event.body || "{}").items);
  } catch (error) {
    return reply(400, { error: error.message });
  }

  const proto = event.headers["x-forwarded-proto"] || "https";
  const origin = `${proto}://${event.headers.host}`;

  try {
    const stripe = require("stripe")(secret);

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: priced.lines.map((line) => ({
        quantity: line.quantity,
        price_data: {
          currency: priced.currency,
          unit_amount: line.unitAmount,
          product_data: {
            name: line.title,
            description: line.colour ? `Colour: ${line.colour}` : undefined,
            images: [`${origin}/${line.image}`.replace(/([^:]\/)\/+/g, "$1")]
          }
        }
      })),
      shipping_address_collection: { allowed_countries: SHIP_TO },
      shipping_options: SHIPPING.map((option) => ({
        shipping_rate_data: {
          type: "fixed_amount",
          display_name: option.label,
          fixed_amount: { amount: option.amount, currency: priced.currency },
          delivery_estimate: {
            minimum: { unit: "business_day", value: option.minDays },
            maximum: { unit: "business_day", value: option.maxDays }
          }
        }
      })),
      phone_number_collection: { enabled: false },
      success_url: `${origin}/thank-you.html?session={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/cart.html?cancelled=1`,
      // Guarda a escolha de cor para aparecer no painel de encomendas.
      metadata: {
        items: priced.lines
          .map((l) => `${l.quantity}x ${l.id}${l.colour ? ` (${l.colour})` : ""}`)
          .join("; ")
          .slice(0, 480)
      }
    });

    return reply(200, { url: session.url });
  } catch (error) {
    console.error("Stripe checkout failed", error);
    return reply(502, { error: "Could not start the payment. Please try again." });
  }
};
