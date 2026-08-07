/**
 * Ingles e portugues.
 *
 * O HTML e escrito em ingles e continua a ser ingles com o JavaScript
 * desligado — o portugues e uma camada por cima, aplicada a elementos
 * marcados com data-i18n. Nenhuma pagina esta duplicada: manter duas
 * copias de cada ficheiro e a forma certa de as ver divergir.
 *
 * O dicionario vive aqui dentro em vez de num JSON a parte para nao
 * haver um pedido de rede entre desenhar a pagina e traduzi-la, que e o
 * que faz o texto saltar de uma lingua para a outra a vista do
 * visitante.
 *
 * Marcacao reconhecida:
 *
 *   data-i18n="chave"            substitui o texto do elemento
 *   data-i18n-html="chave"       substitui o HTML (copy com <strong>)
 *   data-i18n-attr="attr:chave"  substitui atributos, separados por virgula
 *
 * Uma chave em falta deixa o ingles ficar, que e o comportamento certo:
 * texto por traduzir e melhor do que texto em branco.
 */
(function () {
  "use strict";

  const STORAGE_KEY = "dlx.lang";
  const SUPPORTED = ["en", "pt"];

  const DICT = {
    pt: {
      /* --------------------------------------------------- navegacao */
      "nav.skip": "Saltar para o conteúdo",
      "nav.open": "Abrir navegação",
      "nav.home": "Início",
      "nav.shop": "Loja",
      "nav.capabilities": "Capacidades",
      "nav.workbench": "Bancada",
      "nav.dungenlabs": "DungenLabs",
      "nav.lang": "English",
      "nav.langLabel": "Mudar para inglês",

      /* ------------------------------------------------------- hero */
      "hero.eyebrow": "Uma divisão DungenLabs",
      "hero.h1": "A metade do laboratório que constrói para si própria.",
      "hero.p": "A DungenLabs resolve problemas de engenharia de outros. A DL X é o sentido contrário — investigação, protótipos experimentais e equipamento que o laboratório desenha, detém e vende em nome próprio.",
      "hero.cta1": "Ver a loja",
      "hero.cta2": "O que é a DL X?",

      /* -------------------------------------------------- ecossistema */
      "eco.eyebrow": "O ecossistema",
      "eco.h2": "Duas maneiras de trabalhar, um laboratório.",
      "eco.kicker": "A DungenLabs organiza-se em divisões que partilham bancada, ferramentas e identidade visual. O que muda entre elas é a quem pertence o trabalho.",
      "eco.dl.h3": "Engenharia para clientes",
      "eco.dl.p": "Trabalho por contrato: CAD, desenho de PCB, engenharia inversa e sistemas de campo, entregues sobre o caderno de encargos de um cliente. O problema vem de fora, e o prazo também.",
      "eco.dl.cta": "Serviços de engenharia",
      "eco.dlx.h3": "Investigação e produto próprio",
      "eco.dlx.p": "Trabalho que o laboratório começa por iniciativa própria. Ninguém o encomenda, ninguém marca o prazo, e o que sair pertence à DL X — incluindo o direito de o fabricar e vender.",
      "eco.dlx.cta": "Ver o que está à venda",

      /* ------------------------------------------------------ pilares */
      "pillars.eyebrow": "O que a DL X abrange",
      "pillars.h2": "Quatro tipos de trabalho.",
      "pillars.kicker": "A divisão existe para o que não cabe num projeto de cliente: ideias que vale a pena testar, ferramentas que vale a pena construir e equipamento que vale a pena possuir por inteiro.",
      "pillars.proto.h3": "Protótipos experimentais",
      "pillars.proto.p": "Feitos para responder a uma pergunta, não para satisfazer uma encomenda. A maioria fica na bancada — o objetivo é descobrir.",
      "pillars.product.h3": "Produtos próprios",
      "pillars.product.p": "Desenhos que o laboratório detém de ponta a ponta, fabricados em casa e vendidos diretamente, sem intermediário entre quem desenha e quem compra.",
      "pillars.partner.h3": "Parcerias estratégicas",
      "pillars.partner.p": "Desenvolvimento conjunto, em que a DL X traz capacidade de desenho, ferramenta e fabrico em pequena série para a ideia de outra pessoa.",
      "pillars.future.h3": "Tecnologias futuras",
      "pillars.future.p": "Trabalho de horizonte longo, sem cliente associado. A parte do laboratório que tem de se manter curiosa para se manter útil.",

      /* ------------------------------------------------- como se faz */
      "made.eyebrow": "Como é feito",
      "made.h2": "Impresso depois de encomendares.",
      "made.p1": "Não há armazém por trás desta loja. As encomendas entram no lote de impressão seguinte, e é por isso que os prazos são ditos em dias em vez de escondidos, e que variantes de cor ou gravação são uma conversa e não uma referência separada.",
      "made.p2": "Também significa que o catálogo se pode manter honesto: um produto é listado quando a geometria está validada e as tolerâncias são conhecidas, não quando chega um contentor.",
      "made.fact1": "dias úteis até ao envio",
      "made.fact2": "polímeros de engenharia",
      "made.fact3": "desenhado e impresso",

      /* -------------------------------------------------- em destaque */
      "featured.eyebrow": "Na loja agora",
      "featured.h2": "Caixa de Baralho Commander",
      "featured.p": "Uma abordagem de mala de campo ao armazenamento de cartas: casco chanfrado, protetores de canto, dobradiça impressa cativa e um fecho de atrito que sobrevive a uma mochila. Dimensionada para mais de 120 cartas com bolsa, com baía para tokens, em tampa com janela ou opaca.",
      "featured.fact1": "cartas com bolsa",
      "featured.fact2": "espessura de parede",
      "featured.fact3": "feito por encomenda",
      "featured.cta": "Ver o produto",

      /* -------------------------------------------------- capacidades */
      "cap.eyebrow": "Materiais e capacidades",
      "cap.h2": "Três processos, e para que serve cada um.",
      "cap.kicker": "Tudo aqui é feito em casa. A extrusão fechada cobre polímeros de engenharia e filamentos reforçados com fibra; a resina cobre o detalhe que a extrusão não alcança. Por que processo passa uma peça é uma decisão de desenho, não uma preferência — decorre do que a peça tem de aguentar.",
      "cap.eng.eyebrow": "Extrusão · câmara aquecida",
      "cap.eng.h3": "Polímeros de engenharia",
      "cap.eng.p": "Uma câmara fechada e ativamente aquecida, com um bico de alta temperatura, é o que faz o ABS, o ASA, o PC e o nylon comportarem-se em vez de empenarem e saltarem da base. É aqui que se faz tudo o que é estrutural, exterior ou exposto a calor.",
      "cap.fib.eyebrow": "Extrusão · endurecida",
      "cap.fib.h3": "Reforçado a fibra e multicor",
      "cap.fib.p": "Um percurso de material endurecido aceita filamento abrasivo com carga de carbono e de vidro, para peças que têm de se manter dimensionalmente honestas sob carga. A capacidade multimaterial põe a cor e as marcações na geometria, em vez de as imprimir por cima depois.",
      "cap.res.eyebrow": "MSLA · resina",
      "cap.res.h3": "Detalhe fino",
      "cap.res.p": "Estereolitografia mascarada para detalhes finos, paredes finas e superfícies que saem da base já lisas — caixas para pequena eletrónica, modelos de ajuste, peças de apresentação. Detalhe em vez de resistência, deliberadamente.",
      "cap.spec.envelope": "Volume",
      "cap.spec.materials": "Materiais",
      "cap.spec.layers": "Camadas",
      "cap.spec.layerRange": "Camadas",
      "cap.spec.strength": "Resistência",
      "cap.spec.colour": "Cor",
      "cap.spec.bestfor": "Melhor para",
      "cap.spec.process": "Processo",
      "cap.eng.envelope": "Até 300 mm ao cubo",
      "cap.eng.materials": "ABS, ASA, PC, PA, PETG",
      "cap.eng.layers": "0,1 – 0,3 mm",
      "cap.eng.strength": "A maior disponível aqui",
      "cap.fib.envelope": "Até 250 mm ao cubo",
      "cap.fib.materials": "Com carga de carbono e vidro, TPU, PLA",
      "cap.fib.colour": "Multimaterial numa só peça",
      "cap.fib.bestfor": "Gabaritos que não podem fletir",
      "cap.res.process": "SLA mascarada a 405 nm",
      "cap.res.layers": "A partir de 0,01 mm",
      "cap.res.materials": "Resinas padrão, tenazes e de fundição",
      "cap.res.bestfor": "Resolução que a extrusão não alcança",

      /* ---------------------------------------------------- materiais */
      "mat.h3": "Materiais em uso corrente",
      "mat.col1": "Material",
      "mat.col2": "Porque é escolhido",
      "mat.col3": "Uso típico",
      "mat.petg.why": "Tenaz, dimensionalmente estável, resiste a IPA e à maioria dos químicos de oficina",
      "mat.petg.use": "O predefinido para peças funcionais e caixas",
      "mat.asa.why": "Estável aos UV e tolerante ao calor; não fica baço ao ar livre",
      "mat.asa.use": "Tudo o que vive lá fora, ou perto de ar quente",
      "mat.abs.why": "Resistente ao impacto, alisável com solvente, maquina-se bem",
      "mat.abs.use": "Caixas que são manuseadas e deixadas cair",
      "mat.pla.why": "Maior detalhe e menos trabalho, mas amolece com o calor",
      "mat.pla.use": "Verificações de ajuste, gabaritos, peças de exposição",
      "mat.tpu.why": "Flexível e resistente à abrasão",
      "mat.tpu.use": "Juntas, amortecedores, alívios de tensão",
      "mat.pc.why": "Alta resistência à temperatura e resistência estrutural a sério",
      "mat.pc.use": "Suportes sujeitos a carga, ambientes quentes",
      "mat.pa.name": "Nylon (PA)",
      "mat.pa.why": "Baixo atrito e resistente à fadiga",
      "mat.pa.use": "Chumaceiras, dobradiças vivas, conjuntos móveis",
      "mat.cf.name": "Com carga de fibra (CF / GF)",
      "mat.cf.why": "Rígido e dimensionalmente estável, ao custo de um bico endurecido",
      "mat.cf.use": "Suportes e gabaritos que não podem fletir",
      "mat.resin.name": "Resina",
      "mat.resin.why": "Resolução que a extrusão não alcança",
      "mat.resin.use": "Caixas pequenas, detalhe fino, modelos de apresentação",

      /* ------------------------------------------------------ oficina */
      "shopcap.dfm.h3": "Desenho para fabrico",
      "shopcap.dfm.p": "As peças são desenhadas em torno da orientação de impressão, da estratégia de suportes e da tolerância desde o início, e não adaptadas a isso depois.",
      "shopcap.runs.h3": "Séries curtas",
      "shopcap.runs.p": "Lotes de dezenas e não de milhares, com a mesma geometria e os mesmos parâmetros de cada vez.",
      "shopcap.finish.h3": "Acabamento",
      "shopcap.finish.p": "Remoção de suportes, lixagem, insertos térmicos, ferragem cativa e alisamento com solvente onde o material o permite.",
      "shopcap.custom.h3": "Trabalho à medida",
      "shopcap.custom.p": "Variantes de cor, gravação e dimensão em qualquer desenho DL X — orçamentadas a pedido.",

      /* ------------------------------------------------------ contacto */
      "contact.eyebrow": "Contacto",
      "contact.h2": "Precisas de algo que não está listado?",
      "contact.kicker": "A DL X aceita séries à medida, variantes e gravação nos seus próprios produtos. Para trabalho de engenharia para clientes — CAD, PCB, sistemas de campo — isso vive no site principal da DungenLabs.",
      "contact.cta": "Iniciar um projeto",

      /* -------------------------------------------------------- rodape */
      "footer.dlx.p": "Investigação, desenvolvimento e produtos próprios. Uma divisão da DungenLabs, Lisboa.",
      "footer.shop": "Loja",
      "footer.tabletop": "Jogos de mesa",
      "footer.workshop": "Oficina e secretária",
      "footer.experimental": "Experimental",
      "footer.capabilities": "Materiais e capacidades",
      "footer.mainsite": "Site principal",
      "footer.workbench": "Bancada",
      "footer.start": "Iniciar um projeto",
      "footer.support": "Apoio",
      "footer.shipping": "Envios e devoluções",

      /* --------------------------------------------------------- loja */
      "shop.eyebrow": "DL X — Loja",
      "shop.h1": "Equipamento que saiu do laboratório.",
      "shop.kicker": "A DL X é a divisão de investigação e desenvolvimento da DungenLabs. O que se prova na bancada é refinado, documentado e listado aqui — impresso por encomenda em Lisboa, em polímeros de engenharia, com as tolerâncias ditas à partida.",
      "shop.viewTitle": "Loja",
      "shop.viewSummary": "Equipamento próprio da bancada DL X, impresso por encomenda em Lisboa.",
      "shop.allCategories": "Todas as secções",
      "shop.soldOut": "Esgotado",
      "nav.close": "Fechar navegação",
      "shop.empty": "Ainda não há nada nesta secção.",
      "shop.addToCart": "Adicionar ao carrinho",
      "shop.added": "Adicionado",
      "shop.requestQuote": "Pedir orçamento",
      "shop.colour": "Cor",
      "shop.comingSoon": "Em breve",
      "shop.madeToOrder": "Feito por encomenda",
      "shop.inStock": "Em stock",
      "shop.back": "Voltar",
      "shop.specs": "Características",

      /* ---------------------------------------------------- carrinho */
      "cart.button": "Carrinho",
      "cart.title": "Carrinho",
      "cart.drawerTitle": "O teu carrinho",
      "cart.close": "Fechar carrinho",
      "cart.h1": "Rever a encomenda",
      "cart.empty": "Ainda não há nada no carrinho.",
      "cart.emptyPage": "O carrinho está vazio.",
      "cart.browse": "Ver a loja",
      "cart.subtotal": "Subtotal",
      "cart.checkout": "Ir para o pagamento",
      "cart.payCard": "Pagar com cartão",
      "cart.payCrypto": "Pagar com cripto",
      "cart.starting": "A abrir…",
      "cart.each": "cada",
      "cart.remove": "Remover",
      "cart.increase": "Aumentar quantidade",
      "cart.decrease": "Diminuir quantidade",
      "cart.loadError": "Não foi possível carregar o catálogo.",
      "cart.cancelled": "O pagamento foi cancelado — não foi cobrado nada, e o carrinho está intacto.",
      "cart.shippingAtCheckout": "Portes calculados no pagamento.",
      "cart.freeShipping": "Envio gratuito e seguido em Portugal.",
      // {amount} e o valor dos portes, {short} o que falta para serem gratis.
      "cart.paidShipping": "{amount} de portes em Portugal — faltam {short} para envio gratuito.",
      "cart.paymentNote": "Os pagamentos com cartão passam pela Stripe. Em cripto aceitam-se Bitcoin, Ethereum, Litecoin, Monero e várias centenas de outras — a moeda escolhe-se na página de pagamento. Nenhum dos dois guarda dados de cartão ou de carteira neste site. As encomendas em cripto são cobradas com portes de UE porque não é recolhida morada à partida; se estiveres em Portugal, ou se a encomenda tiver direito a envio gratuito, a diferença é devolvida.",
      "cart.quoteNoteHtml": 'Preferes ser orçamentado primeiro, ou precisas de gravação ou de uma cor especial? <a href="/order.html">Envia antes um pedido de encomenda</a>.',

      /* -------------------------------------------------------- envios */
      "shipping.eyebrow": "Envios e devoluções",
      "shipping.h1": "Como as encomendas DL X são feitas e enviadas.",
      "shipping.kicker": "Quase tudo aqui é impresso depois de ser encomendado. Isso mantém o catálogo largo e o desperdício baixo, mas muda os prazos e as condições de devolução face a uma loja com armazém.",
      "shipping.production": "Tempo de produção",
      "shipping.prod1": "Artigos feitos por encomenda: 3 a 5 dias úteis até ao envio.",
      "shipping.prod2": "Artigos em stock: enviados no prazo de 1 dia útil.",
      "shipping.prod3": "Cores especiais, gravação ou variantes: orçamentadas caso a caso.",
      "shipping.h2": "Portes",
      "shipping.s1": "As encomendas são enviadas de Lisboa, Portugal.",
      "shipping.s2html": "Portugal: 4,90 € com seguimento — <strong>grátis em encomendas acima de 30 €</strong>.",
      "shipping.s3": "Resto da UE: 11,90 € com seguimento.",
      "shipping.s4": "Os portes são cobrados uma vez por encomenda, e não por artigo, sejam quantas peças forem na embalagem.",
      "shipping.s5": "As encomendas em cripto são cobradas à taxa da UE à partida, por não ser recolhida morada antes do pagamento. Se estiveres em Portugal, ou se a encomenda tiver direito a envio gratuito, a diferença é devolvida assim que a morada for conhecida.",
      "shipping.s6": "O seguimento é enviado por email assim que a encomenda é entregue aos correios.",
      "shipping.returns": "Devoluções",
      "shipping.ret1html": 'Se um artigo chegar danificado, defeituoso ou diferente do descrito, escreve para <a href="mailto:info@dungenlabs.com">info@dungenlabs.com</a> no prazo de 14 dias após a entrega e será substituído ou reembolsado, portes de devolução incluídos.',
      "shipping.ret2": "Ao abrigo do direito de consumo da UE, o direito de livre resolução de 14 dias não se aplica a bens feitos segundo especificações do consumidor ou claramente personalizados. Artigos feitos por encomenda e gravados não podem, por isso, ser devolvidos por simples mudança de ideias — mas se houver defeito, o parágrafo acima aplica-se por inteiro.",
      "shipping.warranty": "Garantia",
      "shipping.war1": "As peças impressas têm 2 anos de cobertura contra defeitos de fabrico, em linha com a garantia legal de conformidade da UE. Desgaste normal, danos por má utilização e deformação por calor — deixar peças ao sol ou dentro de um carro — não estão cobertos.",
      "shipping.contact": "Contacto",
      "shipping.conhtml": 'Dúvidas sobre uma encomenda, um prazo ou uma variante à medida: <a href="mailto:info@dungenlabs.com">info@dungenlabs.com</a>.',
      "shipping.back": "Voltar à loja",

      /* ---------------------------------------------------- encomenda */
      "order.eyebrow": "Encomenda",
      "order.h1": "Fazer uma encomenda",
      "order.intro": "Diz-nos o que precisas e recebes uma confirmação com o preço final, portes incluídos, normalmente no prazo de um dia útil. Não é cobrado nada até confirmares.",
      "order.product": "Produto",
      "order.quantity": "Quantidade",
      "order.colour": "Cor",
      "order.name": "O teu nome",
      "order.email": "Email",
      "order.country": "País de entrega",
      "order.notes": "Notas",
      "order.notesHint": "(gravação, variantes, prazos)",
      "order.submit": "Enviar pedido",
      "order.note": "Recebes uma resposta com o total, portes incluídos, antes de haver qualquer pagamento. As ligações de pagamento por cartão e cripto seguem com a confirmação.",
      "order.colourOther": "Outra — ver notas",

      /* ------------------------------------------------------ obrigado */
      "thanks.eyebrow": "Encomenda recebida",
      "thanks.h1": "Obrigado — já está na bancada.",
      "thanks.kicker": "O pagamento passou e a encomenda entrou na fila. Recebes em breve um email de confirmação com o recibo.",
      "thanks.next": "O que acontece a seguir",
      "thanks.next1": "A peça entra no lote de impressão seguinte, normalmente no prazo de um dia útil.",
      "thanks.next2": "A impressão e o acabamento levam 3 a 5 dias úteis nos artigos feitos por encomenda.",
      "thanks.next3": "Recebes um segundo email com o seguimento assim que a encomenda for enviada.",
      "thanks.wrong": "Algo errado?",
      "thanks.wrongP": "Se precisares de mudar a cor, a morada ou outra coisa qualquer, responde ao email de confirmação ou escreve para",
      "thanks.wrongP2": "— as alterações são fáceis antes de o lote começar.",
      "thanks.back": "Voltar à loja",

      /* ----------------------------------------------------------- 404 */
      "404.eyebrow": "Erro 404",
      "404.h1": "Essa peça não está no catálogo.",
      "404.kicker": "A página que procuravas não existe, ou mudou de sítio quando a loja foi reorganizada."
    }
  };

  /* ---------------------------------------------------------- escolha */

  /**
   * Lingua a usar. A escolha guardada manda sempre — quem carregou no
   * botao decidiu, e o browser nao tem de opinar outra vez.
   */
  function detectLanguage() {
    let guardada = null;
    try {
      guardada = localStorage.getItem(STORAGE_KEY);
    } catch {
      /* localStorage bloqueado: segue-se para a deteccao */
    }
    if (SUPPORTED.includes(guardada)) return guardada;

    const preferidas = navigator.languages || [navigator.language || "en"];
    return preferidas.some((tag) => String(tag).toLowerCase().startsWith("pt")) ? "pt" : "en";
  }

  let current = detectLanguage();

  const translate = (key) => (current === "en" ? null : DICT[current]?.[key] ?? null);

  /* ------------------------------------------------------- aplicacao */

  function applyTo(root) {
    root.querySelectorAll("[data-i18n]").forEach((node) => {
      if (!node.dataset.i18nOriginal) node.dataset.i18nOriginal = node.textContent;
      const traduzido = translate(node.dataset.i18n);
      node.textContent = traduzido ?? node.dataset.i18nOriginal;
    });

    root.querySelectorAll("[data-i18n-html]").forEach((node) => {
      if (!node.dataset.i18nOriginalHtml) node.dataset.i18nOriginalHtml = node.innerHTML;
      const traduzido = translate(node.dataset.i18nHtml);
      node.innerHTML = traduzido ?? node.dataset.i18nOriginalHtml;
    });

    root.querySelectorAll("[data-i18n-attr]").forEach((node) => {
      node.dataset.i18nAttr.split(",").forEach((par) => {
        const [attr, key] = par.split(":").map((s) => s.trim());
        if (!attr || !key) return;
        const guardado = `i18nAttr${attr.replace(/[^a-z]/gi, "")}`;
        if (!node.dataset[guardado]) node.dataset[guardado] = node.getAttribute(attr) || "";
        const traduzido = translate(key);
        node.setAttribute(attr, traduzido ?? node.dataset[guardado]);
      });
    });
  }

  function apply() {
    document.documentElement.lang = current;
    applyTo(document);
    document.dispatchEvent(new CustomEvent("dlx:lang-changed", { detail: current }));
  }

  function setLanguage(lang) {
    if (!SUPPORTED.includes(lang) || lang === current) return;
    current = lang;
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      /* sem localStorage a escolha nao sobrevive a navegacao; paciencia */
    }
    apply();
  }

  /* ----------------------------------------------------------- botao */

  function mountToggle() {
    const nav = document.querySelector("#nav-links");
    if (!nav || nav.querySelector(".lang-toggle")) return;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "lang-toggle";
    const pintar = () => {
      // O botao mostra a lingua para onde leva, nao a que esta activa.
      button.textContent = current === "pt" ? "EN" : "PT";
      button.setAttribute(
        "aria-label",
        current === "pt" ? "Switch to English" : "Mudar para português"
      );
    };
    pintar();
    button.addEventListener("click", () => {
      setLanguage(current === "pt" ? "en" : "pt");
      pintar();
    });

    // Antes do carrinho, que e sempre o ultimo elemento da navegacao.
    const carrinho = nav.querySelector(".cart-button");
    if (carrinho) nav.insertBefore(button, carrinho);
    else nav.append(button);
  }

  /* ------------------------------------------------------------ arranque */

  function start() {
    mountToggle();
    apply();
  }

  // Esperar tambem em "interactive", e nao so em "loading".
  //
  // Os scripts do site sao carregados com defer, e nessa altura o
  // readyState ja e "interactive" — o DOMContentLoaded ainda nao
  // aconteceu. Traduzir aqui apanhava a pagina antes de o cart.js
  // criar o botao do carrinho, que ficava por traduzir, e punha o
  // botao de lingua no sitio errado por o carrinho ainda nao existir.
  if (document.readyState === "complete") {
    start();
  } else {
    document.addEventListener("DOMContentLoaded", start);
  }

  // Conteudo desenhado depois (fichas de produto, linhas do carrinho)
  // pede a traducao quando acaba de se desenhar.
  document.addEventListener("dlx:content-rendered", (event) => {
    applyTo(event.detail instanceof Element ? event.detail : document);
  });

  window.DLXi18n = {
    get language() {
      return current;
    },
    set: setLanguage,
    t: (key, fallback) => translate(key) ?? fallback ?? key,
    apply: applyTo
  };
})();
