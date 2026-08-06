# DL X — dlx.dungenlabs.com

Site and shop for **DL X**, the DungenLabs research and development division
(brand manual, section 11 — *Submarcas*).

Static site on Netlify. No database, no application server: `data/shop.json`
is the catalogue, and a commit to it is a deploy.

## Why this is a separate site

The brand manual (page 27) removed the shop from `dungenlabs.com` on purpose,
so the main site could stay focused on explaining the company and converting
visitors into contacts. DL X is the division that owns proprietary products, so
the shop belongs here instead.

The same manual (section 11) requires sub-brands to stay visually inside the DL
system and never read as independent identities. That is why `styles.css` is a
copy of the DungenLabs stylesheet and `styles-dlx.css` only adds what the shop
needs — it never redefines colours, type or grid.

## Layout

```
index.html          DL X landing page
shop.html           Catalogue — category → product → detail gallery
shipping.html       Shipping, returns and warranty
thank-you.html      Post-checkout landing (Stripe success URL)
404.html

app.js              Nav + gallery engine, reads /data/shop.json
styles.css          Inherited from dungenlabs.com — do not fork, re-copy
styles-dlx.css      DL X layer only

data/shop.json      The catalogue
admin/              Decap CMS panel
netlify/functions/  GitHub OAuth for the CMS
images/             brand/, products/, categories/
```

The gallery deliberately mirrors the DungenLabs Workbench: same class names,
same mosaic grid, same FLIP transitions. Restyling one restyles both.

## Editing the catalogue

Go to `/admin`, sign in with GitHub. Saving commits to `data/shop.json` and
Netlify rebuilds in about a minute. Rows drag to reorder, and the order in the
panel is the order on the site.

To edit by hand instead, change `data/shop.json` and push — same result.

### Product fields worth knowing

| Field | Effect |
|---|---|
| `status` | `in-stock`, `made-to-order`, `coming-soon`, `sold-out`. The last two hide the buy buttons. |
| `price` | Omit or set `null` to show *Price on request*. |
| `checkoutUrl` | Stripe Payment Link. Empty falls back to an email enquiry button. |
| `cryptoCheckoutUrl` | Optional second button — NOWPayments or Coinbase Commerce. |
| `layout` | Tile size in the mosaic: `standard`, `wide`, `tall`, `featured`. |
| `categoryIds` | Must match a category `id`. A product can sit in several. |

## Cart and checkout

```
shop.html ──add──▶ localStorage ──▶ cart.html
                                      │
                                      ├─▶ POST /api/checkout ────────▶ Stripe Checkout
                                      ├─▶ POST /api/crypto-checkout ─▶ NOWPayments
                                      └─▶ /order.html ───────────────▶ Netlify Forms
```

**Prices are never trusted from the browser.** The cart in `localStorage` holds
only product ids, quantities and a colour choice. Both checkout functions call
`priceCart()` in `netlify/functions/_catalogue.js`, which looks every line up in
`data/shop.json` server-side and rejects anything that does not check out —
unknown id, product not on sale, no published price, malformed quantity. A
tampered cart cannot change what is charged; at worst the shopper sees a wrong
subtotal until checkout corrects it.

`data/shop.json` reaches the functions through `included_files` in
`netlify.toml`. If that entry is removed, checkout fails closed with
*"shop.json not found"* rather than falling back to client prices.

**Card** — Stripe Checkout Session, created server-side. The secret key stays in
Netlify's environment. Shipping is a Stripe shipping option (€4.90 Portugal,
€11.90 rest of EU) so the address and rate are collected on Stripe's page.

**Crypto** — NOWPayments invoice: Bitcoin, Ethereum, Litecoin, Monero and
several hundred others, with the coin chosen on the payment page. NOWPayments
does not collect a shipping address, so the EU rate is included in the invoice
total and the difference refunded for domestic orders — stated on `cart.html`.

**Quote request** — `/order.html`, a Netlify Form. This is the path for
engraving, custom colours or anything needing a conversation first. It is also
the automatic fallback: if `STRIPE_SECRET_KEY` is missing the function replies
`503` with `{"fallback": "/order.html"}` and the shopper is redirected there, so
an unconfigured payment provider never produces a dead button.

Both providers charge per-sale commission with no monthly fee.

## Where orders arrive

There is no orders database, by design — each provider already has one:

| Channel | Where to look |
|---|---|
| Card payments | Stripe Dashboard → Payments. The colour choice is in the session metadata. |
| Crypto payments | NOWPayments Dashboard → Payments, matched by the `DLX-…` order id. |
| Quote requests | Netlify → Forms → `dlx-order`, with email notifications. |

`/admin` manages the catalogue. It deliberately does not show orders: giving the
CMS token access to customer data would widen what a stolen admin session is
worth, and every provider above already has a better view of it.

## Deployment

Netlify builds from `main`. There is no build step; `publish = "."`.

### Required environment variables

Set in Netlify → Site configuration → Environment variables. Needed only for the
CMS login — the public site works without them.

| Variable | Source | Notes |
|---|---|---|
| `STRIPE_SECRET_KEY` | Stripe Dashboard → Developers → API keys | Card checkout. Without it, buyers fall back to `/order.html` |
| `NOWPAYMENTS_API_KEY` | NOWPayments → Settings → API keys | Crypto checkout. Same fallback |
| `GITHUB_OAUTH_CLIENT_ID` | GitHub → Settings → Developer settings → OAuth Apps | CMS login |
| `GITHUB_OAUTH_CLIENT_SECRET` | Same app | Never commit this |
| `GITHUB_OAUTH_SCOPE` | optional | Defaults to `public_repo`. See below. |

Use Stripe's **test** key (`sk_test_…`) first — card `4242 4242 4242 4242`, any
future expiry — and switch to the live key once an end-to-end order works.

The OAuth app's *Authorization callback URL* must be
`https://dlx.dungenlabs.com/api/callback`.

## Security of the admin panel

`/admin` can commit to this repository, so it is the most sensitive surface on
the site. The decisions behind it:

**Who can get in.** There is no separate password to leak. Authentication is
GitHub OAuth, and Decap additionally requires the account to have write access
to this repo — so access equals the repo's collaborator list. Removing someone
from the repo removes their admin access, with nothing else to revoke.

**Token scope.** `auth.js` requests `public_repo`, not `repo`. This matters:
`repo` would grant the issued token read/write over *every* private repository
on the account, so a token stolen from the browser would reach far beyond this
site. `public_repo` cannot touch private repositories at all.

> This is why the repo should stay **public**. If it is made private,
> `GITHUB_OAUTH_SCOPE` has to be raised to `repo`, and that widened blast radius
> is the real cost of privacy here — not the visibility of the source, which is
> served to every visitor anyway.

**Supply chain.** The Decap bundle is committed under `admin/vendor/decap/`
rather than loaded from unpkg. A CDN serving the admin panel would be able to
push code that commits to the repo on your behalf, and Subresource Integrity
does not help because the bundle lazy-loads further chunks at runtime. Updating
is a deliberate, reviewable commit — see `admin/vendor/decap/VERSION`.

**CSRF on the OAuth flow.** `auth.js` issues a random `state` and stores it in a
`HttpOnly; Secure; SameSite=Lax` cookie. `callback.js` refuses any callback whose
`state` does not match, so a login cannot be initiated from somewhere else.

**Token delivery.** The callback page posts the token only to the exact site
origin, never `*`, and only after the opener has answered from that same origin.
Without that check any page that opened the popup could collect a write token.

**Isolation.** The admin's looser CSP — it needs inline styles and the GitHub
API — applies only to `/admin/*`. The public site keeps the same strict policy
as `dungenlabs.com`, and the shop needs no exception because checkout is a plain
link rather than an embedded SDK.

**No secrets in the browser.** The OAuth client secret lives only in Netlify's
environment and is used only inside the function. No Stripe key is published,
because Payment Links carry no key.

## Local preview

```sh
python3 -m http.server 8080
```

Then open `http://localhost:8080`. The catalogue loads over `fetch`, so opening
`index.html` as a `file://` URL will not work. `/admin` needs the deployed
functions and will not authenticate locally.

## Known gaps

- **Prices are placeholders.** `39.90` and `34.90` were assumed, not costed.
- **`checkoutUrl` is empty on every product**, so buy buttons currently fall
  back to email enquiry. Fill them in once the Stripe links exist.
- **Product renders are 1.3 MB PNGs.** They were downscaled with a pure-Python
  script because this build host has no image tooling. Install `webp` and
  re-export to get them to roughly 150 KB.
- **The VESA adapter is a placeholder listing** — geometry exists, photography
  and pricing do not.
- Other DL X candidates not yet listed: filament turner, paper towel holder,
  power connector cover.
