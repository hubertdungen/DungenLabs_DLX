/**
 * A formula do preco, num sitio so.
 *
 *     venda = (preco_cults + custo_producao) x (1 + margem)
 *
 * O preco do Cults3D representa o valor do desenho, que ja esta feito.
 * O custo de producao e material mais horas de maquina. Os portes nao
 * entram: sao cobrados a parte, uma vez por encomenda — ver
 * netlify/functions/_shipping.js.
 *
 * Isto corre em dois sitios e e o mesmo ficheiro nos dois:
 *
 *   - no /admin, quando gravas — ver o preSave em admin/index.html
 *   - no node, para recalcular tudo de uma vez quando um pressuposto
 *     muda (scripts/recompute-prices.mjs)
 *
 * Duas copias da formula acabariam por discordar uma da outra, e a
 * discordancia so apareceria na factura de alguem.
 */
(function (raiz, definir) {
  const api = definir();
  if (typeof module === "object" && module.exports) module.exports = api;
  else raiz.DLXPricing = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  /**
   * Pressupostos. Sao estimativas, nao leis — quando o filamento ou a
   * electricidade mudarem de preco, muda-se aqui e recalcula-se tudo.
   */
  const ASSUNCOES = {
    // Cambio usado para converter os precos do Cults3D, que estao em USD.
    usdEur: 0.92,

    // EUR por quilo, ja com o desperdicio de purga e falhas.
    filamento: {
      PLA: 20.0,
      PETG: 22.0,
      ABS: 22.0,
      ASA: 28.0,
      TPU: 32.0,
      PC: 38.0,
      PA: 42.0,
      CF: 45.0,
      Resina: 45.0
    },

    // EUR/h — electricidade, desgaste e amortizacao da maquina.
    horaMaquina: 0.6,

    // Abaixo disto o pedido da prejuizo mesmo com margem positiva:
    // embalagem, etiqueta e o tempo de o ir por no correio.
    precoMinimo: 4.9
  };

  /** Arredonda para o .90 do mesmo euro — convencao de retalho. */
  function arredonda(valor) {
    return Math.floor(valor) + 0.9;
  }

  /** Custo de produzir uma unidade, em euros. */
  function custoProducao({ grams = 0, hours = 0, material = "PETG" }) {
    const porQuilo = ASSUNCOES.filamento[material] ?? ASSUNCOES.filamento.PETG;
    return (Number(grams) / 1000) * porQuilo + Number(hours) * ASSUNCOES.horaMaquina;
  }

  /**
   * Preco de venda a partir dos dados de custo.
   *
   * Devolve tambem as parcelas, para o painel poder mostrar de onde veio
   * o numero em vez de o apresentar como se caisse do ceu.
   */
  function computePrice(costing) {
    if (!costing) return null;

    const cults = Number(costing.cultsUsd || 0) * ASSUNCOES.usdEur;
    const custo = custoProducao(costing);
    const margem = Number(costing.margin ?? 0.35);
    const base = (cults + custo) * (1 + margem);
    const venda = Math.max(arredonda(base), ASSUNCOES.precoMinimo);

    return {
      price: Number(venda.toFixed(2)),
      cults: Number(cults.toFixed(2)),
      cost: Number(custo.toFixed(2)),
      margin: margem,
      // Lucro real depois de pagar o desenho e a producao. Pode subir
      // acima da margem pedida quando o preco minimo entra em accao.
      profit: Number((venda - cults - custo).toFixed(2))
    };
  }

  /** Uma linha legivel, para o painel e para o terminal. */
  function explain(costing) {
    const r = computePrice(costing);
    if (!r) return "";
    return (
      `desenho ${r.cults.toFixed(2)} + producao ${r.cost.toFixed(2)}` +
      ` x ${(1 + r.margin).toFixed(2)} = ${r.price.toFixed(2)} EUR` +
      ` (lucro ${r.profit.toFixed(2)})`
    );
  }

  /** Um produto tem dados suficientes para ter o preco calculado? */
  const hasCosting = (produto) =>
    Boolean(produto && produto.costing && Number(produto.costing.grams) > 0);

  return { ASSUNCOES, computePrice, explain, hasCosting, custoProducao };
});
