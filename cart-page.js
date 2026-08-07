/**
 * Pagina do carrinho. O cart.js trata do estado e do checkout; isto so
 * desenha a lista completa e liga os dois botoes de pagamento.
 */
const page = document.querySelector("#cart-page");
const checkoutBox = document.querySelector("#cart-checkout");
const totalNode = document.querySelector("#cart-page-total");

if (new URLSearchParams(window.location.search).has("cancelled")) {
  const notice = document.querySelector("#cart-cancelled");
  if (notice) notice.hidden = false;
}

async function render() {
  const cart = window.DLXCart;
  if (!page || !cart) return;

  let resolved;
  try {
    resolved = await cart.resolve();
  } catch {
    page.innerHTML = '<p class="cart-empty">Could not load the catalogue. Please refresh.</p>';
    return;
  }

  if (!resolved.lines.length) {
    page.innerHTML = '<p class="cart-empty">Your cart is empty. <a href="/shop.html">Browse the shop</a>.</p>';
    checkoutBox.hidden = true;
    return;
  }

  page.replaceChildren();
  resolved.lines.forEach((line) => {
    const row = document.createElement("article");
    row.className = "cart-line cart-line-page";
    row.innerHTML = `
      <img src="/${line.product.cardImage || line.product.mainImage}" alt="" width="96" height="72">
      <div class="cart-line-copy">
        <strong>${line.product.title}</strong>
        <span>${line.colour} · ${cart.money(Math.round(line.product.price * 100), resolved.currency)} each</span>
      </div>
      <div class="cart-line-qty">
        <button type="button" data-step="-1" aria-label="Decrease quantity">−</button>
        <span>${line.quantity}</span>
        <button type="button" data-step="1" aria-label="Increase quantity">+</button>
      </div>
      <strong class="cart-line-total">${cart.money(line.lineTotal, resolved.currency)}</strong>
      <button type="button" class="cart-remove" aria-label="Remove ${line.product.title}">Remove</button>`;

    row.querySelectorAll("[data-step]").forEach((button) => {
      button.addEventListener("click", () =>
        cart.setQuantity(line.index, line.quantity + Number(button.dataset.step))
      );
    });
    row.querySelector(".cart-remove").addEventListener("click", () => cart.setQuantity(line.index, 0));

    page.append(row);
  });

  totalNode.textContent = cart.money(resolved.total, resolved.currency);
  const shippingNode = document.querySelector("#cart-page-shipping");
  if (shippingNode) shippingNode.textContent = cart.shippingNote(resolved.total, resolved.currency);
  checkoutBox.hidden = false;
}

document.querySelectorAll("[data-checkout]").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelector("#checkout-status").textContent = "";
    window.DLXCart.startCheckout(button.dataset.checkout, button);
  });
});

document.addEventListener("dlx:cart-render", render);
render();
