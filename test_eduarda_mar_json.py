import json
from olist_auth import OlistAuth, OlistClient
c = OlistClient(OlistAuth())
p = c.paginar('pedidos', params={'dataInicial': '2026-03-20', 'dataFinal': '2026-04-03', 'idVendedor': 854206705})

for x in p:
    if x.get('id') == 927982825:
        print(json.dumps(x, indent=2))
