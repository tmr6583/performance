import json
from olist_auth import OlistAuth, OlistClient
c = OlistClient(OlistAuth())
try:
    p = c.paginar('pedidos', params={'dataFaturamentoInicial': '2026-04-01', 'dataFaturamentoFinal': '2026-04-03'})
    total = sum(float(x.get('valor') or 0) for x in p)
    print("Total faturamento:", total)
    for x in p:
        if x.get('vendedor', {}).get('nome') == 'Maria Eduarda Franco Degenario':
            print(f"Eduarda Pedido {x.get('id')} valor={x.get('valor')} sit={x.get('situacao')}")
    total_eduarda = sum(float(x.get('valor') or 0) for x in p if x.get('vendedor', {}).get('nome') == 'Maria Eduarda Franco Degenario')
    print("Total Eduarda:", total_eduarda)
except Exception as e:
    print("ERRO:", e)
