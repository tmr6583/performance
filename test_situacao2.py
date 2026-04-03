from olist_auth import OlistAuth, OlistClient
c = OlistClient(OlistAuth())
try:
    p = c.paginar('pedidos', params={'dataInicial': '2026-01-01', 'dataFinal': '2026-12-31'})
    situacoes = {}
    for x in p:
        s = x.get('situacao')
        situacoes[s] = situacoes.get(s, 0) + 1
    print("SITUAÇÕES ENCONTRADAS:", situacoes)
except Exception as e:
    print("ERR:", e)