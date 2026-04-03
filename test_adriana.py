from olist_auth import OlistAuth, OlistClient
c = OlistClient(OlistAuth())
p = c.paginar('pedidos', params={'dataInicial': '2026-04-01', 'dataFinal': '2026-04-03', 'idVendedor': 854205016})

# Vamos testar várias combinações de situação para ver qual bate com R$ 6.568,75
sums = {
    "todas": 0.0,
    "0": 0.0,
    "1": 0.0,
    "2": 0.0,
    "3": 0.0,
    "4": 0.0,
    "5": 0.0,
    "6": 0.0,
    "7": 0.0,
}

for x in p:
    v = float(x.get('valor') or 0)
    s = str(x.get('situacao'))
    sums["todas"] += v
    if s in sums:
        sums[s] += v
    else:
        sums[s] = v

print("Somas isoladas:")
for k, v in sums.items():
    print(f" Situação {k}: R$ {v:.2f}")

print("\nPossíveis combinações de Faturamento para bater R$ 6.568,75:")
# Testar combinações (ex: 1+3+4, apenas 3, etc)
print("  Situação 1:", sums["1"])
print("  Situação 3+4+5+6:", sums["3"] + sums["4"] + sums["5"] + sums["6"])
print("  Situação 0+1:", sums["0"] + sums["1"])