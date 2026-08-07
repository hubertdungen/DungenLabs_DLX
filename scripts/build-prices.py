#!/usr/bin/env python3
"""Calcula os precos de venda e escreve-os no catalogo.

Formula definida pelo Hubert:

    venda = (preco_cults + custo_producao) x (1 + margem) + portes

O preco do Cults3D representa o valor do desenho — do trabalho de CAD
que ja esta feito. O custo de producao e material mais horas de
maquina. Os portes vao dentro do preco, para que o valor anunciado
seja o valor pago (ver PORTES_INCLUIDOS abaixo).

Correr a partir da raiz do repositorio:

    python3 scripts/build-prices.py           # mostra a tabela
    python3 scripts/build-prices.py --write   # grava em data/shop.json
"""
import json
import pathlib
import sys

# --- pressupostos -----------------------------------------------------
USD_EUR = 0.92          # cambio usado para converter os precos do Cults3D
FILAMENTO = {"PETG": 22.0, "ASA": 28.0}   # EUR por kg
HORA_MAQUINA = 0.60     # EUR/h — electricidade, desgaste e amortizacao
PORTES_INCLUIDOS = 4.90  # correio registado nacional, ja dentro do preco

# Um artigo pequeno nao pode sair mais barato do que custa embalar e
# atender: abaixo disto o pedido da prejuizo mesmo com margem positiva.
PRECO_MINIMO = 6.90

PRODUTOS = [
    # id                          cults$  gramas  horas  material  margem
    ("adaptus-clamp",               7.42,     55,   4.5,  "PETG",   0.20),
    ("qidi-ptfe-aligner",           1.70,     22,   1.5,  "PETG",   0.35),
    ("qidi-exhaust-elbow",          0.00,     55,   3.5,  "ASA",    0.40),
    ("qidi-power-switch-cover",     0.00,     15,   1.0,  "PETG",   0.40),
    ("mtg-commander-box-windowed",  0.00,    185,  12.0,  "PETG",   0.35),
    ("mtg-commander-box-basic",     0.00,    175,  11.0,  "PETG",   0.35),
]


def custo_producao(gramas, horas, material):
    return gramas / 1000 * FILAMENTO[material] + horas * HORA_MAQUINA


def arredonda(valor):
    """Arredonda para o .90 seguinte — convencao de retalho."""
    inteiro = int(valor)
    return inteiro - 0.10 if valor <= inteiro - 0.10 else inteiro + 0.90


def calcula():
    linhas = []
    for pid, cults_usd, gramas, horas, material, margem in PRODUTOS:
        cults = cults_usd * USD_EUR
        custo = custo_producao(gramas, horas, material)
        base = (cults + custo) * (1 + margem)
        venda = max(arredonda(base + PORTES_INCLUIDOS), PRECO_MINIMO)
        linhas.append({
            "id": pid, "cults": cults, "custo": custo, "margem": margem,
            "base": base, "venda": venda,
            "lucro": venda - PORTES_INCLUIDOS - cults - custo
        })
    return linhas


def main():
    linhas = calcula()

    print(f"\n{'produto':30} {'cults':>7} {'custo':>7} {'margem':>7} "
          f"{'portes':>7} {'VENDA':>8} {'lucro':>7}")
    print("-" * 80)
    for l in linhas:
        print(f"{l['id']:30} {l['cults']:7.2f} {l['custo']:7.2f} "
              f"{l['margem'] * 100:6.0f}% {PORTES_INCLUIDOS:7.2f} "
              f"{l['venda']:8.2f} {l['lucro']:7.2f}")
    print("-" * 80)
    print(f"pressupostos: USD->EUR {USD_EUR} · maquina {HORA_MAQUINA} EUR/h · "
          f"PETG {FILAMENTO['PETG']}/kg · ASA {FILAMENTO['ASA']}/kg")
    print(f"portes de {PORTES_INCLUIDOS} EUR incluidos no preco "
          f"(envio nacional gratuito no checkout)\n")

    if "--write" not in sys.argv:
        print("(usa --write para gravar em data/shop.json)\n")
        return

    p = pathlib.Path("data/shop.json")
    d = json.loads(p.read_text())
    precos = {l["id"]: round(l["venda"], 2) for l in linhas}
    for prod in d["products"]:
        if prod["id"] in precos:
            prod["price"] = precos[prod["id"]]
    p.write_text(json.dumps(d, indent=2, ensure_ascii=False) + "\n")
    print(f"data/shop.json actualizado com {len(precos)} precos\n")


if __name__ == "__main__":
    main()
