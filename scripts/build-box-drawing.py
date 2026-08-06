#!/usr/bin/env python3
"""Gera o desenho tecnico da Commander Deck Box.

As cotas nao sao inventadas: saem do mesmo ficheiro de parametros que
alimenta o modelo em Fusion 360, por isso o desenho e o produto nao
podem divergir. Correr a partir da raiz do repositorio:

    python3 scripts/build-box-drawing.py

Escreve images/products/mtg-box-technical.svg
"""
import pathlib

# --- parametros (commander_box_parameters_fusion360.csv) --------------
P = {
    "card_w": 63.0, "card_h": 88.0,
    "inner_w": 72.0, "inner_d": 102.0, "inner_h": 96.0,
    "wall": 2.8, "floor": 3.0, "lid_h": 14.0,
    "main_chamfer": 4.0, "bumper_w": 8.0,
}
P["outer_w"] = P["inner_w"] + P["wall"] * 2      # 77.6
P["outer_d"] = P["inner_d"] + P["wall"] * 2      # 107.6
P["outer_h"] = P["inner_h"] + P["floor"]         # 99.0
P["total_h"] = P["outer_h"] + P["lid_h"]         # 113.0

TEAL, CORAL, WHITE = "#12373F", "#EB826C", "#F4F8F8"
LINE, DIM = "rgba(244,248,248,0.85)", "rgba(244,248,248,0.4)"

S = 4.0          # px por mm
W, H = 1280, 800


def mm(v):
    return v * S


def chamfered(x, y, w, h, c):
    """Rectangulo com os quatro cantos cortados a 45 graus."""
    return (f"M{x + c},{y} L{x + w - c},{y} L{x + w},{y + c} "
            f"L{x + w},{y + h - c} L{x + w - c},{y + h} "
            f"L{x + c},{y + h} L{x},{y + h - c} L{x},{y + c} Z")


def dim_h(x0, x1, y, label):
    """Cota horizontal com setas e texto centrado."""
    return f"""
  <g class="dim">
    <line x1="{x0}" y1="{y}" x2="{x1}" y2="{y}"/>
    <line x1="{x0}" y1="{y - 6}" x2="{x0}" y2="{y + 6}"/>
    <line x1="{x1}" y1="{y - 6}" x2="{x1}" y2="{y + 6}"/>
    <text x="{(x0 + x1) / 2}" y="{y - 10}" text-anchor="middle">{label}</text>
  </g>"""


def dim_v(x, y0, y1, label):
    """Cota vertical; o texto roda para acompanhar a linha."""
    return f"""
  <g class="dim">
    <line x1="{x}" y1="{y0}" x2="{x}" y2="{y1}"/>
    <line x1="{x - 6}" y1="{y0}" x2="{x + 6}" y2="{y0}"/>
    <line x1="{x - 6}" y1="{y1}" x2="{x + 6}" y2="{y1}"/>
    <text x="{x - 10}" y="{(y0 + y1) / 2}" text-anchor="middle"
          transform="rotate(-90 {x - 10} {(y0 + y1) / 2})">{label}</text>
  </g>"""


def build():
    parts = []

    # ---- alcado frontal ---------------------------------------------
    fw, fh = mm(P["outer_w"]), mm(P["outer_h"])
    lh = mm(P["lid_h"])
    ch = mm(P["main_chamfer"])
    fx, fy = 210, 170

    parts.append(f'  <path class="shell" d="{chamfered(fx, fy + lh, fw, fh, ch)}"/>')
    parts.append(f'  <path class="lid" d="{chamfered(fx, fy, fw, lh, ch)}"/>')

    # bumpers de canto
    bw = mm(P["bumper_w"])
    for bx in (fx, fx + fw - bw):
        parts.append(f'  <rect class="bumper" x="{bx}" y="{fy + lh + ch}" '
                     f'width="{bw}" height="{fh - ch * 2}"/>')

    # sulcos decorativos
    for i in range(3):
        gy = fy + lh + fh * 0.62 + i * 11
        parts.append(f'  <line class="groove" x1="{fx + bw + 14}" y1="{gy}" '
                     f'x2="{fx + fw - bw - 14}" y2="{gy}"/>')

    # dobradica
    parts.append(f'  <line class="hinge" x1="{fx + 6}" y1="{fy + lh}" '
                 f'x2="{fx + fw - 6}" y2="{fy + lh}"/>')
    # trinco
    parts.append(f'  <rect class="latch" x="{fx + fw / 2 - 16}" y="{fy + lh - 7}" '
                 f'width="32" height="22" rx="2"/>')

    parts.append(dim_h(fx, fx + fw, fy - 26, f'{P["outer_w"]:.1f} mm'))
    parts.append(dim_v(fx - 30, fy, fy + lh + fh, f'{P["total_h"]:.0f} mm'))
    parts.append(dim_v(fx + fw + 30, fy, fy + lh, f'lid {P["lid_h"]:.0f}'))
    parts.append(f'  <text class="caption" x="{fx + fw / 2}" y="{fy + lh + fh + 44}" '
                 f'text-anchor="middle">FRONT ELEVATION</text>')

    # ---- corte lateral ----------------------------------------------
    sw = mm(P["outer_d"])
    sx, sy = 760, fy

    parts.append(f'  <path class="shell" d="{chamfered(sx, sy + lh, sw, fh, ch)}"/>')
    parts.append(f'  <path class="lid" d="{chamfered(sx, sy, sw, lh, ch)}"/>')

    # cavidade interna
    wl, fl = mm(P["wall"]), mm(P["floor"])
    ix, iy = sx + wl, sy + lh + 0
    iw, ih = mm(P["inner_d"]), mm(P["inner_h"])
    parts.append(f'  <rect class="cavity" x="{ix}" y="{iy}" width="{iw}" height="{ih}"/>')

    # baralho de cartas dentro da cavidade
    cardh = mm(P["card_h"])
    parts.append(f'  <rect class="cards" x="{ix + 10}" y="{iy + ih - cardh}" '
                 f'width="{iw - 20}" height="{cardh}"/>')
    for i in range(22):
        lx = ix + 12 + i * ((iw - 24) / 22)
        parts.append(f'  <line class="card-edge" x1="{lx}" y1="{iy + ih - cardh + 6}" '
                     f'x2="{lx}" y2="{iy + ih - 6}"/>')

    parts.append(dim_h(sx, sx + sw, sy - 26, f'{P["outer_d"]:.1f} mm'))
    parts.append(dim_h(ix, ix + iw, iy + ih + 30, f'inner {P["inner_d"]:.0f} mm'))
    parts.append(dim_v(sx + sw + 30, iy, iy + ih, f'inner {P["inner_h"]:.0f}'))

    # chamada para a espessura da parede
    parts.append(f'''
  <g class="callout">
    <line x1="{sx + wl / 2}" y1="{iy + 30}" x2="{sx - 46}" y2="{iy - 6}"/>
    <circle cx="{sx + wl / 2}" cy="{iy + 30}" r="3"/>
    <text x="{sx - 50}" y="{iy - 10}" text-anchor="end">wall {P["wall"]} mm</text>
  </g>''')

    parts.append(f'  <text class="caption" x="{sx + sw / 2}" y="{sy + lh + fh + 44}" '
                 f'text-anchor="middle">SECTION — 120+ SLEEVED CARDS</text>')

    body = "\n".join(parts)

    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}"
     role="img" aria-label="Technical drawing of the DL X Commander deck box: front elevation and section, dimensioned in millimetres">
  <defs>
    <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
      <path d="M40 0H0v40" fill="none" stroke="rgba(235,130,108,0.10)" stroke-width="1"/>
    </pattern>
    <style>
      .shell  {{ fill: #0e2c33; stroke: {LINE}; stroke-width: 2; }}
      .lid    {{ fill: #16424c; stroke: {LINE}; stroke-width: 2; }}
      .bumper {{ fill: rgba(235,130,108,0.16); stroke: {CORAL}; stroke-width: 1.5; }}
      .groove {{ stroke: rgba(244,248,248,0.28); stroke-width: 3; stroke-linecap: round; }}
      .hinge  {{ stroke: {CORAL}; stroke-width: 3; stroke-linecap: round; }}
      .latch  {{ fill: {CORAL}; }}
      .cavity {{ fill: rgba(5,6,6,0.5); stroke: rgba(244,248,248,0.35);
                 stroke-width: 1.5; stroke-dasharray: 7 5; }}
      .cards  {{ fill: rgba(235,130,108,0.13); stroke: {CORAL}; stroke-width: 1.5; }}
      .card-edge {{ stroke: rgba(235,130,108,0.55); stroke-width: 1; }}
      .dim line   {{ stroke: {DIM}; stroke-width: 1; }}
      .dim text   {{ fill: {WHITE}; font-family: Orbitron, Arial, sans-serif;
                     font-size: 15px; letter-spacing: 0.06em; }}
      .callout line   {{ stroke: {DIM}; stroke-width: 1; }}
      .callout circle {{ fill: {CORAL}; }}
      .callout text   {{ fill: {WHITE}; font-family: Orbitron, Arial, sans-serif;
                         font-size: 15px; }}
      .caption {{ fill: rgba(244,248,248,0.55); font-family: Orbitron, Arial, sans-serif;
                  font-size: 14px; letter-spacing: 0.22em; }}
      .stamp   {{ fill: rgba(244,248,248,0.4); font-family: Orbitron, Arial, sans-serif;
                  font-size: 13px; letter-spacing: 0.2em; }}
    </style>
  </defs>

  <rect width="{W}" height="{H}" fill="{TEAL}"/>
  <rect width="{W}" height="{H}" fill="url(#grid)"/>

{body}

  <text class="stamp" x="60" y="72">DL X — COMMANDER DECK BOX</text>
  <text class="stamp" x="60" y="96" opacity="0.7">DIMENSIONS IN MILLIMETRES · V1</text>
  <line x1="60" y1="112" x2="420" y2="112" stroke="{CORAL}" stroke-width="2"/>
  <text class="stamp" x="{W - 60}" y="{H - 40}" text-anchor="end">PETG / ASA · FDM</text>
</svg>
'''


if __name__ == "__main__":
    out = pathlib.Path("images/products/mtg-box-technical.svg")
    out.write_text(build())
    print(f"escrito {out} ({out.stat().st_size} bytes)")
