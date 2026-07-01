import type { StatusResponse, OcorrenciasResponse } from '@/types/api';
import type { Line, RichOcorrencia } from '@/constants/data';
import type { StatusType } from '@/constants/theme';

const BASE = `${process.env.EXPO_PUBLIC_BACKEND_URL}/api/metro`;

// ── Metadados estáticos que a API não fornece ────────────────────────────────
// (cores oficiais + rede — nunca mudam)

export const LINE_META: Record<
  string,
  {
    color: string;
    net: 'Metrô' | 'CPTM';
    shortName: string;
  }
> = {
  '1': { color: '#0157a8', net: 'Metrô', shortName: 'Azul' },
  '2': { color: '#00824c', net: 'Metrô', shortName: 'Verde' },
  '3': { color: '#ee372f', net: 'Metrô', shortName: 'Vermelha' },
  '4': { color: '#fbb918', net: 'Metrô', shortName: 'Amarela' },
  '5': { color: '#8a428a', net: 'Metrô', shortName: 'Lilás' },
  '7': { color: '#c00f31', net: 'CPTM', shortName: 'Rubi' },
  '8': { color: '#888a8c', net: 'CPTM', shortName: 'Diamante' },
  '9': { color: '#008b6c', net: 'CPTM', shortName: 'Esmeralda' },
  '10': { color: '#08acac', net: 'CPTM', shortName: 'Turquesa' },
  '11': { color: '#ee5a3a', net: 'CPTM', shortName: 'Coral' },
  '12': { color: '#142e8e', net: 'CPTM', shortName: 'Safira' },
  '13': { color: '#098345', net: 'CPTM', shortName: 'Jade' },
  '15': { color: '#9b9b9b', net: 'Metrô', shortName: 'Prata' },
};

// ── Mapeamento situacao → StatusType ────────────────────────────────────────
// classificacaoTipo vem como string no /status/, como objeto.tipo no /ocorrencias/

export function mapSituacao(situacao: string, classificacaoTipo: string): StatusType {
  if (classificacaoTipo === 'problema') return 'parado';
  if (classificacaoTipo === 'ignorar') return 'normal'; // fora do horário

  switch (situacao) {
    case 'Operação Normal':
    case 'Operação Encerrada':
      return 'normal';
    case 'Velocidade Reduzida':
    case 'Maiores Intervalos':
      return 'lento';
    case 'Operação Parcial':
    case 'Circulação de Trens':
    case 'Atividade Programada':
      return 'atencao';
    case 'Dados Indisponíveis':
      return 'parado';
    default:
      return 'normal';
  }
}

// ── Helpers de data ──────────────────────────────────────────────────────────

export function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}

export function daysAgoISO(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
}

// ── Fetch /status/ ───────────────────────────────────────────────────────────

export async function fetchStatus(): Promise<Line[]> {
  const res = await fetch(`${BASE}/status/`, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`/status/ HTTP ${res.status}`);

  const data: StatusResponse = await res.json();
  const lines: Line[] = [];

  for (const empresa of data.empresas) {
    for (const apiLine of empresa.linhas) {
      const meta = LINE_META[apiLine.codigo];
      if (!meta) continue; // linha desconhecida, pular

      const statusType = mapSituacao(apiLine.status.situacao, apiLine.status.classificacao);

      lines.push({
        id: parseInt(apiLine.codigo, 10),
        net: meta.net,
        num: apiLine.codigo,
        name: meta.shortName,
        color: meta.color,
        status: statusType,
        note: apiLine.status.descricao || apiLine.status.situacao,
        isEncerrado:
          apiLine.status.situacao === 'Operação Encerrada' ||
          apiLine.status.classificacao === 'ignorar' ||
          (!apiLine.ativa && apiLine.status.classificacao !== 'problema'),
        situacao: apiLine.status.situacao,
        atualizadoHa: apiLine.status.atualizado_ha,
        estacoes: apiLine.estacoes?.nomes?.length ? apiLine.estacoes.nomes : undefined,
      });
    }
  }

  // ordenar pelo número da linha
  return lines.sort((a, b) => parseInt(a.num) - parseInt(b.num));
}

// ── Fetch /ocorrencias/ ──────────────────────────────────────────────────────

export async function fetchOcorrencias(
  dataInicio: string,
  dataFim: string,
): Promise<RichOcorrencia[]> {
  const url = `${BASE}/ocorrencias/?data_inicio=${dataInicio}&data_fim=${dataFim}`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`/ocorrencias/ HTTP ${res.status}`);

  const data: OcorrenciasResponse = await res.json();
  const ocorrencias = data.ocorrencias ?? [];

  return ocorrencias
    .filter((o) => o.classificacao.conta_incidente) // só incidentes reais
    .map((o) => {
      const meta = LINE_META[o.linha.codigo];
      const statusType = mapSituacao(o.situacao, o.classificacao.tipo);
      const date = new Date(o.data_hora);
      const at = date.toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
      });

      // derivar severity para notificações
      const severity: 'critico' | 'aviso' | 'info' =
        o.classificacao.tipo === 'problema'
          ? 'critico'
          : ['Velocidade Reduzida', 'Maiores Intervalos', 'Operação Parcial'].includes(o.situacao)
            ? 'aviso'
            : 'info';

      return {
        id: o.id,
        lineCode: o.linha.codigo,
        lineName: meta?.shortName ?? o.linha.nome,
        lineColor: meta?.color ?? '#888',
        net: meta?.net ?? 'CPTM',
        empresa: o.empresa.nome,
        situacao: o.situacao,
        descricao: o.descricao,
        status: statusType,
        severity,
        at,
        dataHora: o.data_hora,
      } satisfies RichOcorrencia;
    });
}
