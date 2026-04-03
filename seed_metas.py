import sqlite3

conn = sqlite3.connect('database.db')
c = conn.cursor()

# Metas baseadas na imagem do dashboard Olist
metas = [
    (854205016, 85000.0),   # Adriana
    (854206705, 85000.0),   # Maria Eduarda
    (912076899, 110000.0)   # Maria Daniele
]

c.executemany('''
    INSERT INTO metas_vendedores (id_olist, meta_mensal) 
    VALUES (?, ?) 
    ON CONFLICT(id_olist) DO UPDATE SET meta_mensal = excluded.meta_mensal
''', metas)

conn.commit()
conn.close()
print("Metas atualizadas com sucesso no banco de dados!")