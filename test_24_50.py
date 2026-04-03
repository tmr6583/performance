import json
from olist_auth import OlistAuth, OlistClient
c = OlistClient(OlistAuth())

try:
    p = c.paginar('pedidos', params={'dataInicial': '2026-03-25', 'dataFinal': '2026-03-31'})
    
    for x in p:
        v = float(x.get('valor') or 0)
        if v == 24.50 and str(x.get('situacao')) == '1':
            print(f"BINGO! Pedido {x.get('id')} de {v} em {x.get('data')}, vend: {x.get('vendedor', {}).get('nome')}")
except Exception as e:
    print("ERRO:", e)
