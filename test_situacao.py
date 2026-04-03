from olist_auth import OlistAuth, OlistClient
c = OlistClient(OlistAuth())
p = c.paginar('pedidos', params={'dataInicial': '2026-03-01', 'dataFinal': '2026-04-03'})
for x in p:
    if x.get('valor') == '314.44' or x.get('situacao') == 2:
        print("SITUACAO:", x.get('situacao'))
        print(x)