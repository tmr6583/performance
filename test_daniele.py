from olist_auth import OlistAuth, OlistClient
c = OlistClient(OlistAuth())
p = c.paginar('pedidos', params={'dataInicial': '2026-04-01', 'dataFinal': '2026-04-03', 'idVendedor': 912076899})
total = 0
for x in p:
    total += float(x.get('valor'))
    print(x.get('situacao'), x.get('numeroPedido'), x.get('valor'))
print("Total:", total)