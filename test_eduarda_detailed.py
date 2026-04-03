import json
from olist_auth import OlistAuth, OlistClient
c = OlistClient(OlistAuth())
p = c.paginar('pedidos', params={'dataInicial': '2026-04-01', 'dataFinal': '2026-04-03', 'idVendedor': 854206705})

total_faturamento_esperado = 10496.85
print("Faturamento esperado: 10496.85\n")

for x in p:
    v = float(x.get('valor') or 0)
    s = str(x.get('situacao'))
    desconto = float(x.get('desconto') or 0)
    frete = float(x.get('frete') or 0)
    id = x.get('id')
    print(f"Pedido {id}: Sit {s} | Valor: {v:.2f} | Frete: {frete:.2f} | Desconto: {desconto:.2f}")

print("\n---")
v_total = sum(float(x.get('valor') or 0) for x in p)
print("Total bruto (v):", v_total)
print("Total sit 1 (v):", sum(float(x.get('valor') or 0) for x in p if str(x.get('situacao')) == '1'))
print("Total sit 0 (v):", sum(float(x.get('valor') or 0) for x in p if str(x.get('situacao')) == '0'))
print("Total sit 2 (v):", sum(float(x.get('valor') or 0) for x in p if str(x.get('situacao')) == '2'))
