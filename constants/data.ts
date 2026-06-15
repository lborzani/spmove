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
  at: string; // "HH:MM"
  dataHora: string; // ISO
}

// ── Filtros da Home ──────────────────────────────────────────────────────────

export const FILTERS = [
  { id: 'all', label: 'Todas' },
  { id: 'favorites', label: 'Favoritos' },
  { id: 'metro', label: 'Metrô' },
  { id: 'cptm', label: 'CPTM' },
  { id: 'issues', label: 'Com problema' },
] as const;

export type FilterId = (typeof FILTERS)[number]['id'];

// ── Transferências entre linhas por nome de estação ─────────────────────────

export const STATION_TRANSFERS: Record<string, string[]> = {
  Luz: ['1', '4', '7', '10', '11'],
  Sé: ['1', '3'],
  República: ['3', '4'],
  Brás: ['3', '10', '11', '12'],
  Tatuapé: ['3', '11', '12'],
  Paraíso: ['1', '2'],
  'Ana Rosa': ['1', '2'],
  'Faria Lima': ['4'],
  Pinheiros: ['4', '9'],
  Lapa: ['7', '8'],
  'Palmeiras-Barra Funda': ['3', '7', '8'],
  Osasco: ['8', '9'],
  'Presidente Altino': ['8', '9'],
  'Santo Amaro': ['5', '9'],
  'Vila Prudente': ['2', '15'],
  'Chácara Klabin': ['2', '5'],
  Tamanduateí: ['2', '10'],
  'Engenheiro Goulart': ['12', '13'],
};

// ── Estações estáticas (fallback para linhas sem dados na API) ────────────────

export const STATIONS_FALLBACK: Record<number, string[]> = {
  1: [
    'Tucuruvi',
    'Parada Inglesa',
    'Jardim São Paulo-Ayrton Senna',
    'Santana',
    'Carandiru',
    'Portuguesa-Tietê',
    'Armênia',
    'Tiradentes',
    'Luz',
    'São Bento',
    'Sé',
    'Japão-Liberdade',
    'São Joaquim',
    'Vergueiro',
    'Paraíso',
    'Ana Rosa',
    'Praça da Árvore',
    'Saúde',
    'Jabaquara',
  ],
  2: [
    'Vila Madalena',
    'Sumaré',
    'Clínicas',
    'Consolação',
    'Trianon-MASP',
    'Brigadeiro',
    'Paraíso',
    'Ana Rosa',
    'Chácara Klabin',
    'Alto do Ipiranga',
    'Santos-Imigrantes',
    'Tamanduateí',
    'Vila Prudente',
  ],
  3: [
    'Palmeiras-Barra Funda',
    'Marechal Deodoro',
    'Santa Cecília',
    'República',
    'Anhangabaú',
    'Sé',
    'Pedro II',
    'Brás',
    'Bresser-Mooca',
    'Tatuapé',
    'Carrão',
    'Penha',
    'Vila Matilde',
    'Guilhermina-Esperança',
    'Patriarca',
    'Arthur Alvim',
    'Corinthians-Itaquera',
  ],
  10: [
    'Luz',
    'Brás',
    'Mooca',
    'Ipiranga',
    'Tamanduateí',
    'São Caetano do Sul',
    'Utinga',
    'Prefeito Celso Daniel-Santo André',
    'Capuava',
    'Mauá',
    'Guapituba',
    'Ribeirão Pires',
    'Rio Grande da Serra',
  ],
  11: [
    'Luz',
    'Brás',
    'Tatuapé',
    'Penha',
    'Vila Matilde',
    'Guilhermina-Esperança',
    'Patriarca',
    'Arthur Alvim',
    'Corinthians-Itaquera',
    'Dom Bosco',
    'José Bonifácio',
    'Guaianases',
    'Antônio Gianetti Neto',
    'Estudantes',
    // API reporta 16 estações — verificar 2 estações faltantes
  ],
  12: [
    'Júlio Prestes',
    'Brás',
    'Tatuapé',
    'Engenheiro Goulart',
    'Jardim Helena-Vila Mara',
    'Itaim Paulista',
    'Jardim Romano',
    'Calmon Viana',
    // API reporta 13 estações — verificar estações faltantes
  ],
  13: ['Engenheiro Goulart', 'USP Leste', 'Aeroporto'],
  15: [
    'Vila Prudente',
    'Oratório',
    'São Lucas',
    'Camilo Haddad',
    'Vila Tolstói',
    'Vila União',
    'Jardim Planalto',
    'Sapopemba',
    'Fazenda da Juta',
    'São Mateus',
    'Jardim Colonial',
  ],
};
