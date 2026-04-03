import json
from olist_auth import OlistAuth, OlistClient
c = OlistClient(OlistAuth())
p = c.paginar('pedidos', params={'dataInicial': '2026-03-20', 'dataFinal': '2026-04-03', 'idVendedor': 854206705})

for x in p:
    v = float(x.get('valor') or 0)
    s = str(x.get('situacao'))
    id = x.get('id')
    data_criacao = x.get('data')
    if v == 135.00 or v == 159.50:
        print(f"BINGO! Pedido {id}: Sit {s} | Valor: {v:.2f} | Data: {data_criacao}")
