/**
 * Cria uma factura de cripto para o carrinho, via NOWPayments.
 *
 * Escolhida por cobrar so comissao por venda, sem mensalidade — a mesma
 * regra que levou a Stripe para os cartoes. Aceita BTC, ETH, LTC, XMR e
 * varias centenas de outras moedas, e o cliente escolhe qual na pagina
 * de pagamento.
 *
 * Como no checkout de cartao, os precos saem do catalogo do servidor.
 */
const { priceCart } = require("./_catalogue");
const { EU, shippingOptions } = require("./_shipping");

const API = "https://api.nowpayments.io/v1/invoice";

function reply(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    body: JSON.stringify(body)
  };
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return reply(405, { error: "Method not allowed." });

  const apiKey = process.env.NOWPAYMENTS_API_KEY;
  if (!apiKey) {
    return reply(503, {
      error: "Crypto checkout is not configured yet.",
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

  // O NOWPayments nao recolhe morada, por isso nao da para saber o
  // destino nem aplicar o envio gratuito nacional. Cobra-se a taxa mais
  // alta — a da UE — e devolve-se o excedente depois de sabermos para
  // onde vai. Fica dito no cart.html, ao lado do botao.
  //
  // Se a encomenda ja passa do limite do envio gratuito, quem for
  // nacional recebe os 11.90 de volta por inteiro.
  const nacionalGratis = shippingOptions(priced.total)[0].amount === 0;
  const shipping = EU.amount;
  const orderId = `DLX-${Date.now().toString(36).toUpperCase()}`;

  try {
    const response = await fetch(API, {
      method: "POST",
      headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        price_amount: Number(((priced.total + shipping) / 100).toFixed(2)),
        price_currency: priced.currency,
        order_id: orderId,
        // O reembolso dos portes so se sabe depois de o cliente dar a
        // morada, por isso fica aqui escrito quanto ha a devolver a quem
        // for nacional — e o unico campo que o NOWPayments devolve.
        order_description: `${priced.lines.map((l) => `${l.quantity}x ${l.title}`).join(", ")}`
          .slice(0, 200) +
          ` [PT: refund ${((nacionalGratis ? shipping : shipping - 490) / 100).toFixed(2)}]`,
        success_url: `${origin}/thank-you.html?order=${orderId}`,
        cancel_url: `${origin}/cart.html?cancelled=1`
      })
    });

    const data = await response.json();
    if (!response.ok || !data.invoice_url) {
      console.error("NOWPayments rejected the invoice", data);
      return reply(502, { error: "Could not start the crypto payment. Please try again." });
    }

    return reply(200, { url: data.invoice_url, orderId });
  } catch (error) {
    console.error("Crypto checkout failed", error);
    return reply(502, { error: "Could not start the crypto payment. Please try again." });
  }
};
