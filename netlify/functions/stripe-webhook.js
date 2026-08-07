/**
 * Avisos de encomenda paga.
 *
 * A Stripe chama esta funcao quando um pagamento fecha. Daqui saem dois
 * emails: um para o Hubert, com a morada e as cores, e uma confirmacao
 * para quem comprou.
 *
 * Porque e que isto e um webhook e nao a pagina de agradecimento: a
 * pagina de agradecimento so corre se o browser la chegar. Quem fecha o
 * separador depois de pagar nunca a abre, e a encomenda passava
 * despercebida. O webhook vem da Stripe, nao do cliente.
 *
 * E porque e que a assinatura importa: sem a verificar, este endereco
 * fica aberto ao mundo e qualquer um pode inventar encomendas pagas.
 */
const { customerEmail, ownerEmail, sendEmail } = require("./_email");

function reply(statusCode, body) {
  return { statusCode, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
}

/** Referencia curta, legivel ao telefone. A da Stripe tem 66 caracteres. */
const orderRef = (session) => `DLX-${session.id.slice(-8).toUpperCase()}`;

/** Le a morada, que a Stripe foi mudando de sitio entre versoes da API. */
const shippingOf = (session) =>
  session.collected_information?.shipping_details ||
  session.shipping_details ||
  { address: session.customer_details?.address, name: session.customer_details?.name };

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return reply(405, { error: "Method not allowed." });

  const secret = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !webhookSecret) {
    console.error("Webhook called but STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET is missing");
    return reply(503, { error: "Not configured." });
  }

  const stripe = require("stripe")(secret);

  // A assinatura e calculada sobre os bytes exactos que a Stripe
  // enviou. Voltar a serializar o JSON muda espacos e ordem e a
  // verificacao falha, por isso o corpo tem de vir em bruto.
  const raw = event.isBase64Encoded
    ? Buffer.from(event.body, "base64").toString("utf8")
    : event.body;

  let stripeEvent;
  try {
    stripeEvent = stripe.webhooks.constructEvent(
      raw,
      event.headers["stripe-signature"],
      webhookSecret
    );
  } catch (error) {
    console.error("Webhook signature rejected", error.message);
    return reply(400, { error: "Invalid signature." });
  }

  if (stripeEvent.type !== "checkout.session.completed") {
    return reply(200, { ignored: stripeEvent.type });
  }

  const sessionId = stripeEvent.data.object.id;

  let session;
  try {
    session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["line_items.data.price.product", "shipping_cost.shipping_rate"]
    });
  } catch (error) {
    console.error("Could not load the session", error.message);
    return reply(500, { error: "Could not load the session." });
  }

  if (session.payment_status !== "paid") {
    return reply(200, { ignored: `payment_status=${session.payment_status}` });
  }

  const shipping = shippingOf(session);
  const order = {
    orderId: orderRef(session),
    currency: session.currency,
    lines: (session.line_items?.data || []).map((li) => ({
      title: li.description,
      // A cor viajou como descricao do produto — ver create-checkout.js.
      colour: (li.price?.product?.description || "").replace(/^Colour:\s*/i, ""),
      quantity: li.quantity,
      amount: li.amount_total
    })),
    totals: {
      subtotal: session.amount_subtotal,
      shipping: session.shipping_cost?.amount_total ?? 0,
      total: session.amount_total
    },
    address: shipping?.address,
    name: shipping?.name || session.customer_details?.name,
    email: session.customer_details?.email,
    phone: session.customer_details?.phone,
    paymentRef: typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id
  };

  const notify = process.env.ORDER_NOTIFY_EMAIL || "info@dungenlabs.com";

  // O aviso ao Hubert vai primeiro, e e o unico que justifica pedir
  // nova tentativa a Stripe: se falhar, a encomenda existe e ninguem
  // sabe dela. A Stripe repete durante tres dias.
  try {
    const mail = ownerEmail(order);
    await sendEmail({ to: notify, replyTo: order.email, ...mail });
  } catch (error) {
    console.error("Order notification failed", error.message);
    return reply(500, { error: "Notification failed." });
  }

  // A confirmacao ao cliente ja nao pede repeticao. Se falhasse com 500,
  // a Stripe repetia o evento inteiro e o Hubert recebia o aviso outra
  // vez — nao ha aqui registo que permita evitar duplicados.
  if (order.email) {
    try {
      const mail = customerEmail(order);
      await sendEmail({ to: order.email, replyTo: notify, ...mail });
    } catch (error) {
      console.error(`Customer confirmation failed for ${order.orderId}`, error.message);
    }
  }

  return reply(200, { received: order.orderId });
};
