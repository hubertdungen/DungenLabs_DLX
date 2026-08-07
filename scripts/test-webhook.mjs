/**
 * Testes do webhook de encomendas.
 *
 * O que se testa aqui e a porta: sem assinatura valida da Stripe, este
 * endereco esta aberto ao mundo e qualquer um inventa encomendas pagas.
 * Nenhum destes casos chega a enviar email nem a falar com a rede.
 *
 * Correr a partir da raiz do repositorio:
 *
 *     node scripts/test-webhook.mjs
 */
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

// Chaves de fachada: a verificacao da assinatura e feita localmente,
// nao chama a Stripe. Nenhuma delas e real nem precisa de ser.
process.env.STRIPE_SECRET_KEY = "sk_test_placeholder_para_testes";
process.env.STRIPE_WEBHOOK_SECRET = "whsec_placeholder_para_testes";

const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const { handler } = require("../netlify/functions/stripe-webhook.js");
const { customerEmail, ownerEmail } = require("../netlify/functions/_email.js");

let pass = 0;
let fail = 0;
const diz = (ok, texto) => {
  console.log(`  ${ok ? "ok    " : "FALHOU"}  ${texto}`);
  ok ? pass++ : fail++;
};

const chamar = (body, assinatura, metodo = "POST") =>
  handler({
    httpMethod: metodo,
    headers: assinatura ? { "stripe-signature": assinatura } : {},
    body,
    isBase64Encoded: false
  });

const assinar = (payload) =>
  stripe.webhooks.generateTestHeaderString({
    payload,
    secret: process.env.STRIPE_WEBHOOK_SECRET
  });

console.log("\nporta do webhook:\n");

{
  const r = await chamar("{}", "t=1,v1=naoevalido");
  diz(r.statusCode === 400, `assinatura inventada e recusada (HTTP ${r.statusCode})`);
}

{
  const r = await chamar(JSON.stringify({ type: "checkout.session.completed" }), undefined);
  diz(r.statusCode === 400, `sem cabecalho de assinatura e recusado (HTTP ${r.statusCode})`);
}

{
  // O ataque obvio: um corpo bem formado, a dizer que ha uma encomenda
  // paga, mas sem vir da Stripe.
  const forjado = JSON.stringify({
    type: "checkout.session.completed",
    data: { object: { id: "cs_test_forjado", payment_status: "paid" } }
  });
  const r = await chamar(forjado, "t=1,v1=" + "a".repeat(64));
  diz(r.statusCode === 400, `encomenda forjada e recusada (HTTP ${r.statusCode})`);
}

{
  const r = await chamar("{}", undefined, "GET");
  diz(r.statusCode === 405, `GET e recusado (HTTP ${r.statusCode})`);
}

{
  // Assinatura valida, mas de um evento que nao nos diz respeito.
  const payload = JSON.stringify({
    id: "evt_1",
    type: "payment_intent.created",
    data: { object: { id: "pi_1" } }
  });
  const r = await chamar(payload, assinar(payload));
  const body = JSON.parse(r.body);
  diz(r.statusCode === 200 && body.ignored === "payment_intent.created",
      "evento assinado mas irrelevante e ignorado sem erro");
}

{
  // Assinatura valida do evento certo: passa a porta. Falha a seguir a
  // tentar buscar a sessao a Stripe com uma chave de fachada, que e
  // exactamente onde deve falhar — a porta abriu.
  const payload = JSON.stringify({
    id: "evt_2",
    type: "checkout.session.completed",
    data: { object: { id: "cs_test_qualquer" } }
  });
  const r = await chamar(payload, assinar(payload));
  diz(r.statusCode !== 400, `assinatura legitima passa a verificacao (HTTP ${r.statusCode})`);
}

console.log("\nmodelos de email:\n");

const encomenda = {
  orderId: "DLX-TESTE01",
  currency: "eur",
  lines: [{ title: "Commander Deck Box", colour: "Deep Teal", quantity: 2, amount: 3180 }],
  totals: { subtotal: 3180, shipping: 490, total: 3670 },
  address: { line1: "Rua da Prata 80", postal_code: "1100-420", city: "Lisboa", country: "PT" },
  name: "Maria Fernandes",
  email: "maria@example.com",
  paymentRef: "pi_teste"
};

{
  const mail = customerEmail(encomenda);
  diz(mail.subject.includes("DLX-TESTE01"), "o assunto traz a referencia da encomenda");
  diz(mail.html.includes("€36.70"), "o total aparece no corpo");
  diz(mail.html.includes("Deep Teal"), "a cor escolhida aparece");
  diz(mail.html.includes("Rua da Prata 80"), "a morada aparece");
  diz(mail.text.length > 50, "ha versao em texto simples");
  diz(!mail.html.includes("<svg"), "nenhum SVG — os clientes de email nao o mostram");
}

{
  const mail = ownerEmail({ ...encomenda, totals: { subtotal: 3180, shipping: 0, total: 3180 } });
  diz(mail.subject.includes("€31.80"), "o assunto do aviso traz o valor");
  diz(mail.html.includes("Free"), "portes gratuitos aparecem como Free, nao como €0.00");
}

{
  // O nome vem do cliente e vai direito para dentro de HTML.
  const mail = customerEmail({
    ...encomenda,
    name: '<script>alert(1)</script>',
    address: { ...encomenda.address, line1: '<img src=x onerror=alert(1)>' }
  });
  diz(!mail.html.includes("<script>"), "nome com HTML e escapado");
  diz(!mail.html.includes("<img src=x"), "morada com HTML e escapada");
}

console.log(`\n${pass} passaram, ${fail} falharam\n`);
process.exit(fail ? 1 : 0);
