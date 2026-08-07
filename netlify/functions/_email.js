/**
 * Emails de encomenda — o desenho e o envio.
 *
 * Escrito em tabelas com estilos em linha, que e o que os clientes de
 * email percebem. O Gmail deita fora <style> em boa parte dos casos, o
 * Outlook usa o motor do Word, e nenhum deles renderiza SVG — daqui o
 * cabecalho ser um PNG (ver scripts/build-email-logo.sh).
 *
 * Envio pelo Resend: 3000 emails por mes de graca, sem mensalidade, que
 * e a mesma regra que escolheu a Stripe e o NOWPayments. Chamado por
 * fetch, sem SDK — e um POST com JSON.
 */

const RESEND_API = "https://api.resend.com/emails";
const SITE = "https://dlx.dungenlabs.com";

const TEAL = "#12373F";
const CORAL = "#EB826C";
const INK = "#1B1B1B";
const MUTED = "#6B7A7D";
const LINE = "#E3E8E8";

const money = (cents, currency = "EUR") =>
  new Intl.NumberFormat("en-IE", { style: "currency", currency: currency.toUpperCase() })
    .format((cents || 0) / 100);

/** Tudo o que vem do cliente passa por aqui antes de entrar no HTML. */
const esc = (valor) =>
  String(valor ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/* ------------------------------------------------------------ pecas */

const header = `
  <tr><td style="padding:0;">
    <img src="${SITE}/images/brand/dlx-email-header.png" width="600" height="150"
         alt="DL X" style="display:block;width:100%;max-width:600px;height:auto;border:0;">
  </td></tr>`;

const footer = `
  <tr><td style="padding:28px 32px 36px;background:${TEAL};color:#C9D6D8;font:13px/1.6 Helvetica,Arial,sans-serif;">
    <p style="margin:0 0 6px;color:#FFFFFF;font-weight:bold;letter-spacing:.06em;">DL X</p>
    <p style="margin:0 0 14px;">Research, development and proprietary products.<br>A division of DungenLabs, Lisbon.</p>
    <p style="margin:0;">
      <a href="mailto:info@dungenlabs.com" style="color:${CORAL};text-decoration:none;">info@dungenlabs.com</a>
      &nbsp;·&nbsp;
      <a href="${SITE}/shipping.html" style="color:${CORAL};text-decoration:none;">Shipping &amp; returns</a>
      &nbsp;·&nbsp;
      <a href="https://dungenlabs.com" style="color:${CORAL};text-decoration:none;">dungenlabs.com</a>
    </p>
  </td></tr>`;

/** Envolve o conteudo na moldura de 600px, centrada. */
const shell = (inner) => `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only"></head>
<body style="margin:0;padding:0;background:#F2F4F4;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F2F4F4;">
    <tr><td align="center" style="padding:24px 12px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0"
             style="width:600px;max-width:100%;background:#FFFFFF;border-radius:4px;overflow:hidden;">
        ${header}
        ${inner}
        ${footer}
      </table>
    </td></tr>
  </table>
</body></html>`;

/** Tabela dos artigos, partilhada pelos dois emails. */
function itemsTable(lines, currency) {
  const rows = lines
    .map(
      (l) => `
      <tr>
        <td style="padding:12px 0;border-bottom:1px solid ${LINE};font:14px/1.5 Helvetica,Arial,sans-serif;color:${INK};">
          <strong>${esc(l.title)}</strong>
          ${l.colour ? `<br><span style="color:${MUTED};font-size:13px;">Colour: ${esc(l.colour)}</span>` : ""}
        </td>
        <td align="center" style="padding:12px 8px;border-bottom:1px solid ${LINE};font:14px Helvetica,Arial,sans-serif;color:${MUTED};white-space:nowrap;">
          × ${l.quantity}
        </td>
        <td align="right" style="padding:12px 0;border-bottom:1px solid ${LINE};font:14px Helvetica,Arial,sans-serif;color:${INK};white-space:nowrap;">
          ${money(l.amount, currency)}
        </td>
      </tr>`
    )
    .join("");

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>`;
}

/** Linhas de subtotal / portes / total. */
function totalsTable(totals, currency) {
  const linha = (rotulo, valor, forte = false) => `
    <tr>
      <td style="padding:${forte ? "12px 0 0" : "6px 0 0"};font:${forte ? "bold 16px" : "14px"} Helvetica,Arial,sans-serif;color:${forte ? INK : MUTED};">${rotulo}</td>
      <td align="right" style="padding:${forte ? "12px 0 0" : "6px 0 0"};font:${forte ? "bold 16px" : "14px"} Helvetica,Arial,sans-serif;color:${forte ? INK : MUTED};white-space:nowrap;">${valor}</td>
    </tr>`;

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;">
    ${linha("Subtotal", money(totals.subtotal, currency))}
    ${linha("Shipping", totals.shipping === 0 ? "Free" : money(totals.shipping, currency))}
    ${linha("Total", money(totals.total, currency), true)}
  </table>`;
}

/** Morada em bloco, pronta a copiar para a etiqueta. */
function addressBlock(address, name) {
  if (!address) return "";
  const partes = [
    name,
    address.line1,
    address.line2,
    [address.postal_code, address.city].filter(Boolean).join(" "),
    address.state,
    address.country
  ].filter(Boolean);
  return partes.map(esc).join("<br>");
}

/* ------------------------------------------------------------ modelos */

/** Confirmacao para quem comprou. */
function customerEmail(order) {
  const { orderId, lines, totals, currency, address, name } = order;
  const inner = `
    <tr><td style="padding:36px 32px 0;">
      <p style="margin:0 0 6px;font:600 12px Helvetica,Arial,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:${CORAL};">Order confirmed</p>
      <h1 style="margin:0 0 8px;font:bold 26px/1.25 Helvetica,Arial,sans-serif;color:${TEAL};">Thank you${name ? `, ${esc(name.split(" ")[0])}` : ""}.</h1>
      <p style="margin:0 0 4px;font:15px/1.6 Helvetica,Arial,sans-serif;color:${INK};">Your order is in. Reference <strong>${esc(orderId)}</strong>.</p>
      <p style="margin:0 0 28px;font:14px/1.6 Helvetica,Arial,sans-serif;color:${MUTED};">Almost everything here is printed after you order it, so allow 3–5 working days before dispatch. Tracking follows by email as soon as the parcel is handed over.</p>
    </td></tr>

    <tr><td style="padding:0 32px;">
      ${itemsTable(lines, currency)}
      ${totalsTable(totals, currency)}
    </td></tr>

    ${
      address
        ? `<tr><td style="padding:28px 32px 0;">
             <p style="margin:0 0 6px;font:600 12px Helvetica,Arial,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:${MUTED};">Shipping to</p>
             <p style="margin:0;font:14px/1.6 Helvetica,Arial,sans-serif;color:${INK};">${addressBlock(address, name)}</p>
           </td></tr>`
        : ""
    }

    <tr><td style="padding:28px 32px 36px;">
      <p style="margin:0;font:13px/1.6 Helvetica,Arial,sans-serif;color:${MUTED};">
        Something wrong with the order? Reply to this email, or write to
        <a href="mailto:info@dungenlabs.com" style="color:${TEAL};">info@dungenlabs.com</a>, quoting ${esc(orderId)}.
      </p>
    </td></tr>`;

  const text = [
    `Order confirmed — ${orderId}`,
    "",
    ...lines.map((l) => `${l.quantity}x ${l.title}${l.colour ? ` (${l.colour})` : ""} — ${money(l.amount, currency)}`),
    "",
    `Subtotal: ${money(totals.subtotal, currency)}`,
    `Shipping: ${totals.shipping === 0 ? "Free" : money(totals.shipping, currency)}`,
    `Total: ${money(totals.total, currency)}`,
    "",
    "Made to order — allow 3-5 working days before dispatch.",
    "DL X, a division of DungenLabs, Lisbon — info@dungenlabs.com"
  ].join("\n");

  return { subject: `DL X order ${orderId} confirmed`, html: shell(inner), text };
}

/** Aviso operacional para a caixa do Hubert. */
function ownerEmail(order) {
  const { orderId, lines, totals, currency, address, name, email, phone, paymentRef } = order;
  const inner = `
    <tr><td style="padding:36px 32px 0;">
      <p style="margin:0 0 6px;font:600 12px Helvetica,Arial,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:${CORAL};">New order</p>
      <h1 style="margin:0 0 8px;font:bold 26px/1.25 Helvetica,Arial,sans-serif;color:${TEAL};">${money(totals.total, currency)} — ${esc(orderId)}</h1>
      <p style="margin:0 0 28px;font:14px/1.6 Helvetica,Arial,sans-serif;color:${MUTED};">Paid. Print list below.</p>
    </td></tr>

    <tr><td style="padding:0 32px;">
      ${itemsTable(lines, currency)}
      ${totalsTable(totals, currency)}
    </td></tr>

    <tr><td style="padding:28px 32px 0;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F6F8F8;border-left:3px solid ${CORAL};">
        <tr><td style="padding:16px 18px;font:14px/1.7 Helvetica,Arial,sans-serif;color:${INK};">
          <strong style="display:block;margin-bottom:8px;font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:${MUTED};">Ship to</strong>
          ${addressBlock(address, name) || '<span style="color:' + MUTED + ';">No address collected</span>'}
          <br><br>
          <a href="mailto:${esc(email)}" style="color:${TEAL};">${esc(email)}</a>${phone ? `<br>${esc(phone)}` : ""}
        </td></tr>
      </table>
    </td></tr>

    <tr><td style="padding:24px 32px 36px;">
      <p style="margin:0;font:13px/1.6 Helvetica,Arial,sans-serif;color:${MUTED};">Payment reference ${esc(paymentRef || "—")}.</p>
    </td></tr>`;

  const text = [
    `NEW ORDER ${orderId} — ${money(totals.total, currency)}`,
    "",
    ...lines.map((l) => `${l.quantity}x ${l.title}${l.colour ? ` (${l.colour})` : ""}`),
    "",
    "Ship to:",
    (addressBlock(address, name) || "No address collected").replace(/<br>/g, "\n"),
    email,
    phone || ""
  ].join("\n");

  return { subject: `New order ${orderId} — ${money(totals.total, currency)}`, html: shell(inner), text };
}

/* ------------------------------------------------------------- envio */

/**
 * Envia por Resend. Lanca se a chave nao estiver configurada ou se a
 * API recusar — quem chama decide se isso justifica pedir nova
 * tentativa a Stripe.
 */
async function sendEmail({ to, subject, html, text, replyTo }) {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY is not set");

  // O dominio tem de estar verificado no Resend para enviar de
  // @dungenlabs.com. Antes disso, poe ORDER_FROM=onboarding@resend.dev.
  const from = process.env.ORDER_FROM || "DL X <orders@dungenlabs.com>";

  const response = await fetch(RESEND_API, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [to], subject, html, text, reply_to: replyTo })
  });

  if (!response.ok) {
    const detalhe = await response.text().catch(() => "");
    throw new Error(`Resend refused the message (${response.status}): ${detalhe.slice(0, 200)}`);
  }
  return response.json();
}

module.exports = { customerEmail, ownerEmail, sendEmail, money };
