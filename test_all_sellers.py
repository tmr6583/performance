import json
from olist_auth import OlistAuth, OlistClient
c = OlistClient(OlistAuth())
p = c.paginar('pedidos', params={'dataInicial': '2026-04-01', 'dataFinal': '2026-04-03'})

sums = {}
for x in p:
    v = float(x.get('valor') or 0)
    s = str(x.get('situacao'))
    vendedor = x.get('vendedor', {}).get('nome', 'Sem Vendedor')
    if vendedor not in sums:
        sums[vendedor] = {'total': 0, '1': 0, '0': 0}
    sums[vendedor]['total'] += v
    if s == '1': sums[vendedor]['1'] += v
    if s == '0': sums[vendedor]['0'] += v

for k, v in sums.items():
    print(f"{k}: Total={v['total']:.2f} | 1={v['1']:.2f} | 0={v['0']:.2f}")
