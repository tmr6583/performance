import json
from olist_auth import OlistAuth, OlistClient
c = OlistClient(OlistAuth())

try:
    print("Buscando pedidos de marco...")
    p = c.paginar('pedidos', params={'dataInicial': '2026-03-25', 'dataFinal': '2026-03-31'})
    
    total_faturado_abril = 0
    for x in p:
        # A API de listagem não retorna dataFaturamento, então vamos verificar a situacao
        # Mas wait, a listagem retorna dataFaturamento?
        df = x.get('dataFaturamento')
        v = float(x.get('valor') or 0)
        
        if df and df.startswith('2026-04'):
            print(f"Pedido {x.get('id')} faturado em {df}: {v}")
            total_faturado_abril += v
            
    print("Total faturado em abril (criado em marco):", total_faturado_abril)
except Exception as e:
    print("ERRO:", e)
