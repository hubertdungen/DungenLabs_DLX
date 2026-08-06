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

## Checkout

Stripe **Payment Links**, not the Stripe SDK. Each product's buy button is a
plain link to a checkout page hosted by Stripe.

This matters for two reasons: no API key ever reaches the browser, and the
Content-Security-Policy in `netlify.toml` stays as tight as the main site's —
no `script-src` or `connect-src` exception is needed for payments.

To list a product for sale:

1. Stripe Dashboard → Payment Links → create a link for the product.
2. Set its success URL to `https://dlx.dungenlabs.com/thank-you.html`.
3. Paste the link into `checkoutUrl`, via `/admin` or the JSON.

Cost is per-sale commission only, with no monthly fee. The same pattern works
for crypto via NOWPayments or Coinbase Commerce — create a link, paste it into
`cryptoCheckoutUrl`, and a second button appears.

## Deployment

Netlify builds from `main`. There is no build step; `publish = "."`.

### Required environment variables

Set in Netlify → Site configuration → Environment variables. Needed only for the
CMS login — the public site works without them.

| Variable | Source |
|---|---|
| `GITHUB_OAUTH_CLIENT_ID` | GitHub → Settings → Developer settings → OAuth Apps |
| `GITHUB_OAUTH_CLIENT_SECRET` | Same app |

The OAuth app's *Authorization callback URL* must be
`https://dlx.dungenlabs.com/api/callback`.

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
