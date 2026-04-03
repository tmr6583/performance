import sqlite3
import pandas as pd
conn = sqlite3.connect('database.db')
df = pd.read_sql_query("SELECT data, id_vendedor, nome_vendedor, faturamento_mes FROM performance_cache WHERE data = date('now') ORDER BY faturamento_mes DESC", conn)
print(df)
