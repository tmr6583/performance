import json
from olist_auth import OlistAuth, OlistClient
c = OlistClient(OlistAuth())
p = c.paginar('pedidos', params={'dataInicial': '2026-04-01', 'dataFinal': '2026-04-03'})

sums_by_sit = {}
for x in p:
    v = float(x.get('valor') or 0)
    s = str(x.get('situacao'))
    sums_by_sit[s] = sums_by_sit.get(s, 0) + v

print("Somas por situação:")
for k, v in sums_by_sit.items():
    print(f"Situação {k}: {v:.2f}")

