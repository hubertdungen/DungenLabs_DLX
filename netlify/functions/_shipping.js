/**
 * Regras de portes — um unico sitio.
 *
 * Ate agora os portes estavam dentro do preco de cada artigo, o que
 * cobrava 4.90 EUR por artigo numa encomenda que segue toda na mesma
 * caixa: tres artigos pagavam 14.70 EUR de correio. Agora o preco e so
 * do produto e os portes sao cobrados uma vez, sobre a encomenda.
 *
 * O checkout de cartao e o de cripto importam daqui, para nao haver dois
 * sitios a discordar sobre quanto custa o envio.
 */

// Acima deste subtotal o envio nacional nao se cobra. Nao se aplica a UE:
// um envio para fora custa duas a tres vezes mais e nao se paga sozinho.
const FREE_NATIONAL_ABOVE = 3000; // centimos

const NATIONAL = { code: "national", label: "Portugal — tracked", amount: 490, minDays: 2, maxDays: 4 };
const EU = { code: "eu", label: "European Union — tracked", amount: 1190, minDays: 4, maxDays: 8 };

/**
 * Opcoes de envio para um dado subtotal, em centimos.
 * O rotulo do envio nacional muda quando fica gratuito, para o cliente
 * perceber porque e que o valor desapareceu.
 */
function shippingOptions(subtotal) {
  const free = subtotal >= FREE_NATIONAL_ABOVE;
  return [
    free
      ? { ...NATIONAL, label: "Portugal — tracked, free over €30", amount: 0 }
      : NATIONAL,
    EU
  ];
}

/**
 * Quanto falta para o envio nacional ficar gratuito, em centimos.
 * Zero quando ja la esta. Serve so para a mensagem no carrinho.
 */
const amountToFreeShipping = (subtotal) => Math.max(FREE_NATIONAL_ABOVE - subtotal, 0);

module.exports = {
  FREE_NATIONAL_ABOVE,
  NATIONAL,
  EU,
  shippingOptions,
  amountToFreeShipping
};
