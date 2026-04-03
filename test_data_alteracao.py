import json
from olist_auth import OlistAuth, OlistClient
c = OlistClient(OlistAuth())

try:
    p = c.paginar('pedidos', params={'dataAlteracaoInicial': '2026-04-01', 'dataAlteracaoFinal': '2026-04-03'})
    
    total = 0
    for x in p:
        if str(x.get('situacao')) == '1':
            total += float(x.get('valor') or 0)
    print("Total Faturado com dataAlteracao:", total)

except Exception as e:
    print("ERRO:", e)
