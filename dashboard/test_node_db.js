const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('../database.db');
const dbRows = db.prepare(`
      SELECT 
        pc.*, 
        COALESCE(m.meta_mensal, 0) as meta_mensal 
      FROM performance_cache pc
      LEFT JOIN metas_vendedores m ON pc.id_vendedor = m.id_olist
      WHERE pc.data = '2026-04-03' 
      ORDER BY pc.valor_mes DESC
`).all();
console.log(dbRows);
