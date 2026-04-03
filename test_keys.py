import json
from olist_auth import OlistAuth, OlistClient
c = OlistClient(OlistAuth())

try:
    p = c.paginar('pedidos', params={'dataInicial': '2026-03-25', 'dataFinal': '2026-03-31'})
    for x in p:
        if x.get('id') == 927594608:
            print("Pedido 927594608:")
            print(json.dumps(x, indent=2))
except Exception as e:
    print("ERRO:", e)
