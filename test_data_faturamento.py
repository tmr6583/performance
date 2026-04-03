import json
from olist_auth import OlistAuth, OlistClient
c = OlistClient(OlistAuth())
try:
    p = c.paginar('pedidos', params={'dataFaturamentoInicial': '2026-04-01', 'dataFaturamentoFinal': '2026-04-03', 'idVendedor': 854206705})
    for x in p:
        print(f"Pedido {x.get('id')} sit={x.get('situacao')} data={x.get('data')}")
except Exception as e:
    print("ERRO:", e)
