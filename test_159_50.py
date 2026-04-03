import json
from olist_auth import OlistAuth, OlistClient
c = OlistClient(OlistAuth())
p = c.paginar('pedidos', params={'dataInicial': '2026-04-01', 'dataFinal': '2026-04-03'})

for x in p:
    v = float(x.get('valor') or 0)
    if v == 159.50:
        print(f"Pedido {x.get('id')} valor={v} sit={x.get('situacao')} vend={x.get('vendedor', {}).get('nome')}")
