import json
from olist_auth import OlistAuth, OlistClient
c = OlistClient(OlistAuth())

try:
    p = c.paginar('notas', params={'dataEmissaoInicial': '2026-04-01', 'dataEmissaoFinal': '2026-04-03'})
    
    total = sum(float(x.get('valor') or 0) for x in p if str(x.get('situacao')) not in ('7', 'cancelada')) # 7=Cancelada? 
    print("Total (todas as sit):", sum(float(x.get('valor') or 0) for x in p))
    print("Total (exceto canceladas):", total)
    
    # Vamos ver quais situacoes existem:
    sits = set(str(x.get('situacao')) for x in p)
    print("Situacoes encontradas:", sits)
    
    for sit in sits:
        soma = sum(float(x.get('valor') or 0) for x in p if str(x.get('situacao')) == sit)
        print(f"Soma para sit {sit}: {soma}")
        
except Exception as e:
    print("ERRO:", e)
