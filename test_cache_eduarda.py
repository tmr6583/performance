import sqlite3
import pandas as pd
conn = sqlite3.connect('database.db')
df = pd.read_sql_query("SELECT id_pedido, data_faturamento, situacao, valor, id_vendedor FROM pedidos_cache WHERE id_vendedor = 854206705 AND data_faturamento LIKE '2026-04%'", conn)
print("Eduarda cache:")
print(df)
print("Total Eduarda no Cache Abril:", df['valor'].sum())
