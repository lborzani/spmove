// ─── Response types for ARTESP Metroferroviário API v1.0.0 ─────────────────

// ── /status/ ────────────────────────────────────────────────────────────────

export interface ApiEstacoes {
  total: number;
  nomes?: string[];
}

/** classificacao como STRING no /status/ — diferente do /ocorrencias/ */
export interface ApiLineStatus {
  situacao: string;
  descricao: string;
  /** "operacional" | "ignorar" | "problema" */
  classificacao: string;
  operacao_normal: boolean;
  atualizado_em: string;
  atualizado_ha: string;
}

export interface ApiLine {
  nome: string;
  codigo: string;
  ativa: boolean;
  status: ApiLineStatus;
  estacoes?: ApiEstacoes;
}

export interface ApiEmpresa {
  id: number;
  nome: string;
  fiscalizacao_artesp: boolean;
  linhas: ApiLine[];
}

export interface StatusResponse {
  meta: {
    versao: string;
    timestamp: string;
    filtros_aplicados: {
      empresa: number | null;
      linha: number | null;
      artesp_only: boolean;
    };
    total_linhas: number;
    total_empresas: number;
  };
  empresas: ApiEmpresa[];
}

// ── /ocorrencias/ ───────────────────────────────────────────────────────────

/** classificacao como OBJETO no /ocorrencias/ — inconsistência da API */
export interface ApiOcorrenciaClassificacao {
  tipo: 'operacional' | 'ignorar' | 'problema';
  label: string;
  conta_incidente: boolean;
}

export interface ApiOcorrencia {
  id: number;
  data_hora: string;
  linha: {
    /** ID interno do banco — NÃO é o número da linha. Usar .codigo */
    id: string;
    nome: string;
    codigo: string;
  };
  empresa: {
    id: number;
    nome: string;
    fiscalizacao_artesp: boolean;
  };
  situacao: string;
  descricao: string;
  classificacao: ApiOcorrenciaClassificacao;
}

export interface OcorrenciasResponse {
  meta: {
    versao: string;
    timestamp: string;
    filtros_aplicados: Record<string, unknown>;
    rate_limit?: {
      limite: number;
      janela: string;
      proxima_requisicao_em: string;
    };
  };
  ocorrencias: ApiOcorrencia[];
  sumario?: {
    total_ocorrencias: number;
    periodo: string;
    principais_linhas_afetadas: string[];
    tipos_principais_incidentes: string[];
  };
}

// ── /concessionarias/ ───────────────────────────────────────────────────────

export interface ConcessionariasResponse {
  meta: {
    versao: string;
    timestamp: string;
    total: number;
  };
  empresas: {
    id: number;
    nome: string;
    fiscalizacao_artesp: boolean;
    linhas: { nome: string; codigo: string }[];
  }[];
}
