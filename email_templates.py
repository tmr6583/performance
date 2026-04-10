"""Templates HTML para os e-mails de performance."""

import html as _html
from datetime import date


# ── Helpers ────────────────────────────────────────────────────────────────

_MESES = [
    "", "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
]


def _esc(text: object) -> str:
    """Escapa caracteres HTML para prevenir XSS."""
    return _html.escape(str(text))


def _fmt_brl(valor: float) -> str:
    return f"R$ {valor:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")


def _fmt_data(iso: str | None = None) -> str:
    d = date.fromisoformat(iso) if iso else date.today()
    return f"{d.day:02d} de {_MESES[d.month]} de {d.year}"


def _fmt_mes_ano(iso: str | None = None) -> str:
    d = date.fromisoformat(iso) if iso else date.today()
    return f"{_MESES[d.month]} de {d.year}"


_BASE_STYLE = """
<style>
  body { margin: 0; padding: 0; background: #f1f5f9; font-family: 'Segoe UI', Arial, sans-serif; }
  .wrap { max-width: 580px; margin: 32px auto; background: #ffffff;
          border-radius: 10px; overflow: hidden;
          box-shadow: 0 4px 24px rgba(11,61,143,.12); }
  .wrap-admin { max-width: 1040px; margin: 32px auto; background: #ffffff;
                border-radius: 10px; overflow: hidden;
                box-shadow: 0 4px 24px rgba(11,61,143,.12); }
  .header { background: linear-gradient(135deg, #0B3D8F 0%, #1156C7 60%, #3A9BD5 100%);
            padding: 32px 36px 28px; text-align: center; }
  .header h1 { margin: 0 0 4px; color: #fff; font-size: 22px; font-weight: 700; }
  .header p  { margin: 0; color: rgba(255,255,255,.72); font-size: 13px; }
  .accent-bar { width: 56px; height: 4px; background: #FFD000;
                border-radius: 2px; margin: 14px auto 0; }
  .body { padding: 28px 36px; }
  .section-title { font-size: 11px; font-weight: 700; letter-spacing: .1em;
                   text-transform: uppercase; color: #5A7296; margin: 0 0 14px; }
  .kpi-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin-bottom: 24px; }
  .kpi { background: #EAF4FF; border-radius: 8px; padding: 16px 14px; text-align: center; }
  .kpi .label { font-size: 11px; color: #5A7296; font-weight: 600;
                text-transform: uppercase; letter-spacing: .07em; }
  .kpi .val   { font-size: 20px; font-weight: 800; color: #0B3D8F; margin-top: 4px; }
  .kpi .sub   { font-size: 11px; color: #5A7296; margin-top: 2px; }
  .divider { height: 1px; background: #C9DDEF; margin: 20px 0; }
  .footer { background: #0B3D8F; padding: 18px 36px; text-align: center;
            color: rgba(255,255,255,.55); font-size: 12px; }
  .footer strong { color: rgba(255,255,255,.85); }
  table.perf-table { width: 100%; border-collapse: collapse; font-size: 13px; }
  table.perf-table th { background: #EAF4FF; color: #5A7296; font-size: 11px;
                        text-transform: uppercase; letter-spacing: .07em;
                        padding: 10px 12px; text-align: left; }
  table.perf-table td { padding: 11px 12px; border-bottom: 1px solid #C9DDEF; color: #1A2F5E; }
  table.perf-table tr:last-child td { border-bottom: none; }
  table.perf-table .total td { background: #EAF4FF; font-weight: 800; color: #0B3D8F; }
  .text-right { text-align: right; }
  @media (max-width: 500px) {
    .kpi-grid { grid-template-columns: 1fr 1fr; }
    .body, .header { padding-left: 20px; padding-right: 20px; }
  }
</style>
"""


# ── Template individual (vendedora) ────────────────────────────────────────

def vendedora_html(
    nome: str,
    pedidos_dia: int,
    valor_dia: float,
    ticket_dia: float,
    pedidos_mes: int,
    valor_mes: float,
    faturamento_mes: float,
    ticket_mes: float,
    meta_mensal: float = 0.0,
    perc_meta: float = 0.0,
    falta_meta: float = 0.0,
    data: str | None = None,
) -> str:
    """Gera HTML do e-mail individual da vendedora."""
    data_exib = _fmt_data(data)
    mes_exib  = _fmt_mes_ano(data)
    sem_dados = pedidos_dia == 0 and pedidos_mes == 0

    aviso_html = ""
    if sem_dados:
        aviso_html = """
        <div style="background:#FFF8E1;border-left:4px solid #FFD000;
                    padding:12px 16px;border-radius:4px;margin-bottom:20px;
                    font-size:13px;color:#7A5C00;">
          Nenhum pedido registrado neste período.
        </div>
        """

    meta_html = ""
    if meta_mensal and meta_mensal > 0:
        meta_html = f"""
        <div class="kpi-grid" style="grid-template-columns:1fr 1fr 1fr">
          <div class="kpi">
            <div class="label">Meta Mensal</div>
            <div class="val" style="font-size:15px">{_fmt_brl(meta_mensal)}</div>
          </div>
          <div class="kpi">
            <div class="label">% da Meta</div>
            <div class="val">{perc_meta:.2f}%</div>
          </div>
          <div class="kpi">
            <div class="label">Faltam</div>
            <div class="val" style="font-size:15px">{_fmt_brl(falta_meta)}</div>
          </div>
        </div>
        """

    return f"""<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8">{_BASE_STYLE}</head>
<body>
<div class="wrap">

  <div class="header">
    <h1>Olá, {_esc(nome)}!</h1>
    <p>Seu desempenho em {mes_exib}</p>
    <div class="accent-bar"></div>
  </div>

  <div class="body">
    {aviso_html}

    <div class="section-title">Mês Corrente — {mes_exib}</div>
    <div class="kpi-grid" style="grid-template-columns:1fr 1fr; margin-bottom:12px;">
      <div class="kpi">
        <div class="label">Vendas no mês</div>
        <div class="val" style="font-size:15px">{_fmt_brl(valor_mes)}</div>
      </div>
      <div class="kpi">
        <div class="label">Faturamento no mês</div>
        <div class="val" style="font-size:15px">{_fmt_brl(faturamento_mes)}</div>
      </div>
    </div>
    <div class="kpi-grid" style="grid-template-columns:1fr 1fr; margin-bottom:12px;">
      <div class="kpi">
        <div class="label">Pedidos no mês</div>
        <div class="val">{pedidos_mes}</div>
      </div>
      <div class="kpi">
        <div class="label">Ticket Médio</div>
        <div class="val" style="font-size:15px">{_fmt_brl(ticket_mes)}</div>
      </div>
    </div>
    {meta_html}

  </div>

  <div class="footer">
    Gerado em {data_exib} &nbsp;·&nbsp;
    <strong>Betina Limpeza</strong>
  </div>

</div>
</body>
</html>"""


# ── Template consolidado (admins) ──────────────────────────────────────────

def admin_html(
    vendedoras: list[dict],
    data: str | None = None,
) -> str:
    """Gera HTML do e-mail de resumo da equipe para administradores.

    Args:
        vendedoras: Lista de dicts com keys:
            nome_vendedor, pedidos_dia, valor_dia,
            pedidos_mes, valor_mes
        data: Data ISO (YYYY-MM-DD); padrão: hoje.
    """
    data_exib = _fmt_data(data)
    mes_exib  = _fmt_mes_ano(data)

    total_pd  = sum(int(v.get("pedidos_dia", 0) or 0) for v in vendedoras)
    total_vd  = sum(float(v.get("valor_dia", 0.0) or 0.0) for v in vendedoras)
    total_pm  = sum(int(v.get("pedidos_mes", 0) or 0) for v in vendedoras)
    total_vm  = sum(float(v.get("valor_mes", 0.0) or 0.0) for v in vendedoras)
    total_meta = sum(float(v.get("meta_mensal", 0.0) or 0.0) for v in vendedoras)
    total_faturamento = sum(float(v.get("faturamento_mes", 0.0) or 0.0) for v in vendedoras)
    total_realizado = (total_faturamento / total_meta) * 100 if total_meta > 0 else 0.0

    linhas_html = ""
    for v in sorted(vendedoras, key=lambda x: float(x.get("faturamento_mes", 0.0) or 0.0), reverse=True):
        meta = float(v.get("meta_mensal", 0.0) or 0.0)
        faturamento = float(v.get("faturamento_mes", 0.0) or 0.0)
        realizado = (faturamento / meta) * 100 if meta > 0 else 0.0
        linhas_html += f"""
        <tr>
          <td>{_esc(v.get('nome_vendedor', '—'))}</td>
          <td class="text-right">{_fmt_brl(meta)}</td>
          <td class="text-right">{_fmt_brl(v.get('valor_mes', 0.0))}</td>
          <td class="text-right">{_fmt_brl(faturamento)}</td>
          <td class="text-right">{f"{realizado:.2f}%" if meta > 0 else "-"}</td>
        </tr>"""

    return f"""<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8">{_BASE_STYLE}</head>
<body>
<div class="wrap-admin">

  <div class="header">
    <h1>Desempenho da Equipe</h1>
    <p>{mes_exib} — Relatório de {data_exib}</p>
    <div class="accent-bar"></div>
  </div>

  <div class="body">

    <div class="section-title">Totais da Equipe — {mes_exib}</div>
    <div class="kpi-grid" style="grid-template-columns:1fr 1fr 1fr 1fr;margin-bottom:24px">
      <div class="kpi">
        <div class="label">Pedidos Hoje</div>
        <div class="val">{total_pd}</div>
      </div>
      <div class="kpi">
        <div class="label">Faturado Hoje</div>
        <div class="val" style="font-size:15px">{_fmt_brl(total_vd)}</div>
      </div>
      <div class="kpi">
        <div class="label">Pedidos no Mês</div>
        <div class="val">{total_pm}</div>
      </div>
      <div class="kpi">
        <div class="label">VENDIDO no Mês</div>
        <div class="val" style="font-size:15px">{_fmt_brl(total_vm)}</div>
      </div>
    </div>

    <div class="divider"></div>

    <div class="section-title">Desempenho por Vendedor — {mes_exib}</div>
    <div style="overflow-x:auto">
      <table class="perf-table">
        <thead>
          <tr>
            <th>Vendedor</th>
            <th class="text-right">Meta do mês</th>
            <th class="text-right">Vendas no mês</th>
            <th class="text-right">Faturamento no mês</th>
            <th class="text-right">Realizado</th>
          </tr>
        </thead>
        <tbody>
          {linhas_html}
        </tbody>
        <tfoot>
          <tr class="total">
            <td>Totais</td>
            <td class="text-right">{_fmt_brl(total_meta)}</td>
            <td class="text-right">{_fmt_brl(total_vm)}</td>
            <td class="text-right">{_fmt_brl(total_faturamento)}</td>
            <td class="text-right">{f"{total_realizado:.2f}%" if total_meta > 0 else "-"}</td>
          </tr>
        </tfoot>
      </table>
    </div>

  </div>

  <div class="footer">
    Gerado em {data_exib} &nbsp;·&nbsp;
    <strong>Betina Limpeza</strong>
  </div>

</div>
</body>
</html>"""
