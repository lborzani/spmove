import type { StatusType } from './theme';

// ── Tipos base ───────────────────────────────────────────────────────────────

export interface Line {
  id: number;
  net: 'Metrô' | 'CPTM';
  num: string;
  name: string;
  color: string;
  status: StatusType;
  note: string;
  // campos extras vindos da API
  situacao?: string;
  atualizadoHa?: string;
  estacoes?: string[];
}

/** Ocorrência enriquecida com metadados locais (cor, rede) */
export interface RichOcorrencia {
  id: number;
  lineCode: string;
  lineName: string;
  lineColor: string;
  net: 'Metrô' | 'CPTM';
  empresa: string;
  situacao: string;
  descricao: string;
  status: StatusType;
  severity: 'critico' | 'aviso' | 'info';
  at: string;       // "HH:MM"
  dataHora: string; // ISO
}

// ── Filtros da Home ──────────────────────────────────────────────────────────

export const FILTERS = [
  { id: 'all',    label: 'Todas'        },
  { id: 'metro',  label: 'Metrô'        },
  { id: 'cptm',   label: 'CPTM'         },
  { id: 'issues', label: 'Com problema' },
] as const;

export type FilterId = (typeof FILTERS)[number]['id'];

// ── Transferências entre linhas por nome de estação ─────────────────────────

export const STATION_TRANSFERS: Record<string, string[]> = {
  'Luz':                   ['1', '4', '7', '10', '11'],
  'Sé':                    ['1', '3'],
  'República':             ['3', '4'],
  'Brás':                  ['3', '10', '11', '12'],
  'Tatuapé':               ['3', '11', '12'],
  'Paraíso':               ['1', '2'],
  'Ana Rosa':              ['1', '2'],
  'Faria Lima':            ['2', '4'],
  'Pinheiros':             ['4', '9'],
  'Lapa':                  ['7', '8', '9'],
  'Palmeiras-Barra Funda': ['3', '7', '8'],
  'Osasco':                ['8', '9'],
  'Vila Prudente':         ['2', '15'],
  'Chácara Klabin':        ['2', '5'],
  'Consolação':            ['2', '4'],
  'Tamanduateí':           ['2', '10'],
  'Engenheiro Goulart':    ['12', '13'],
  'Engº Goulart':          ['12', '13'],
};

// ── Estações estáticas (fallback para CPTM sem nomes na API) ─────────────────

export const STATIONS_FALLBACK: Record<number, string[]> = {
  1:  ['Tucuruvi', 'Carandiru', 'Tietê', 'Luz', 'Sé', 'Liberdade', 'Paraíso', 'Ana Rosa', 'Jabaquara'],
  2:  ['Vila Madalena', 'Faria Lima', 'Consolação', 'Paraíso', 'Ana Rosa', 'Vila Prudente'],
  3:  ['Palmeiras-Barra Funda', 'Marechal Deodoro', 'República', 'Sé', 'Brás', 'Tatuapé', 'Corinthians-Itaquera'],
  4:  ['Luz', 'República', 'Paulista', 'Faria Lima', 'Pinheiros', 'Butantã', 'Vila Sônia'],
  5:  ['Capão Redondo', 'Largo Treze', 'Santa Cruz', 'Chácara Klabin'],
  7:  ['Luz', 'Lapa', 'Pirituba', 'Perus', 'Jundiaí'],
  8:  ['Júlio Prestes', 'Lapa', 'Osasco', 'Carapicuíba', 'Itapevi'],
  9:  ['Osasco', 'Pinheiros', 'Vila Olímpia', 'Santo Amaro', 'Grajaú'],
  10: ['Luz', 'Brás', 'Mooca', 'Ipiranga', 'São Caetano', 'Mauá', 'Rio Grande da Serra'],
  11: ['Luz', 'Brás', 'Tatuapé', 'Guaianases', 'Estudantes'],
  12: ['Brás', 'Tatuapé', 'Engenheiro Goulart', 'Calmon Viana'],
  13: ['Engº Goulart', 'USP Leste', 'Aeroporto'],
  15: ['Vila Prudente', 'Oratório', 'São Lucas', 'Jardim Colonial'],
};
