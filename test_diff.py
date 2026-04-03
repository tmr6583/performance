from olist_auth import OlistAuth, OlistClient
c = OlistClient(OlistAuth())

vendedores = [854205016, 854206705, 912076899] # Adriana, Eduarda, Daniele

for vend in vendedores:
    p = c.paginar('pedidos', params={'dataInicial': '2026-04-01', 'dataFinal': '2026-04-03', 'idVendedor': vend})
    somas = {}
    for x in p:
        v = float(x.get('valor') or 0)
        s = str(x.get('situacao'))
        somas[s] = somas.get(s, 0) + v
    print(f"Vendedor {vend}: {somas}")

p_all = c.paginar('pedidos', params={'dataInicial': '2026-04-01', 'dataFinal': '2026-04-03'})
somas_all = {}
for x in p_all:
    v = float(x.get('valor') or 0)
    s = str(x.get('situacao'))
    
    vend = x.get('idVendedor')
    if vend == 0 or not vend:
        if s == '1': print(f"Pedido SEM vendedor | sit: {s} | valor: {v}")
    
    somas_all[s] = somas_all.get(s, 0) + v

print("TOTAL GERAL DA CONTA (SITUACOES):", somas_all)