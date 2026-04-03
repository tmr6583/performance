import sqlite3
import pandas as pd
from olist_auth import OlistAuth, OlistClient
c = OlistClient(OlistAuth())

p = c.paginar('pedidos', params={'dataInicial': '2026-04-01', 'dataFinal': '2026-04-03', 'idVendedor': 854206705})
total_1 = 0
for x in p:
    if str(x.get('situacao')) == '1':
        total_1 += float(x.get('valor') or 0)
print("Eduarda (Aprovados criados em Abril):", total_1)

p2 = c.paginar('pedidos', params={'dataInicial': '2026-04-01', 'dataFinal': '2026-04-03', 'idVendedor': 912076899})
total_2 = 0
for x in p2:
    if str(x.get('situacao')) == '1':
        total_2 += float(x.get('valor') or 0)
print("Daniele (Aprovados criados em Abril):", total_2)
