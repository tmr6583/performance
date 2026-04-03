from olist_auth import OlistAuth, OlistClient
c = OlistClient(OlistAuth())
p = c.paginar('pedidos', params={'dataInicial': '2026-04-01', 'dataFinal': '2026-04-03', 'idVendedor': 854206705})
print("Pedidos Eduarda Abril")
sums = {}
for x in p:
    v = float(x.get('valor') or 0)
    s = str(x.get('situacao'))
    sums[s] = sums.get(s, 0) + v
    print(f"Pedido {x.get('numeroPedido')} | Sit: {s} | Valor: {v}")
print("SOMAS:", sums)