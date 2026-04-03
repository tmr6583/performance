from olist_auth import OlistAuth, OlistClient
c = OlistClient(OlistAuth())
p = c.paginar('pedidos', params={'dataInicial': '2026-04-01', 'dataFinal': '2026-04-03', 'idVendedor': 854206705})

sums = {"todas": 0.0, "0": 0.0, "1": 0.0, "2": 0.0}

for x in p:
    v = float(x.get('valor') or 0)
    s = str(x.get('situacao'))
    sums["todas"] += v
    if s in sums: sums[s] += v
    else: sums[s] = v

print("Eduarda (R$ 10.496,85):")
for k, v in sums.items():
    print(f" Situação {k}: R$ {v:.2f}")