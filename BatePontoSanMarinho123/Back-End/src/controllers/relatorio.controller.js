const pool = require("../database/pool");

const {
  calcularDia,
  formatarSaldo,
} = require("../utils/calculos");


/* =========================================================
   GARANTIR TABELA FUNÇÕES
   MULTIEMPRESA
========================================================= */

async function garantirTabelaFuncoes() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS funcoes (
      id BIGSERIAL PRIMARY KEY,

      empresa_id BIGINT
        REFERENCES empresas(id)
        ON DELETE RESTRICT,

      nome VARCHAR(150) NOT NULL,

      created_at TIMESTAMP
        DEFAULT NOW(),

      updated_at TIMESTAMP
        DEFAULT NOW()
    );
  `);

  await pool.query(`
    ALTER TABLE funcoes
    ADD COLUMN IF NOT EXISTS empresa_id
    BIGINT REFERENCES empresas(id)
    ON DELETE RESTRICT
  `);

  await pool.query(`
    ALTER TABLE funcoes
    ADD COLUMN IF NOT EXISTS updated_at
    TIMESTAMP DEFAULT NOW()
  `);

  await pool.query(`
    DO $$
    DECLARE
      constraint_record RECORD;
    BEGIN

      FOR constraint_record IN
        SELECT tc.constraint_name
        FROM information_schema.table_constraints tc
        INNER JOIN information_schema.constraint_column_usage ccu
          ON tc.constraint_name = ccu.constraint_name
         AND tc.constraint_schema = ccu.constraint_schema
        WHERE tc.table_name = 'funcoes'
          AND tc.constraint_type = 'UNIQUE'
          AND ccu.column_name = 'nome'
      LOOP

        EXECUTE format(
          'ALTER TABLE funcoes DROP CONSTRAINT IF EXISTS %I',
          constraint_record.constraint_name
        );

      END LOOP;

    END $$;
  `);

  const migracao = await pool.query(`
    UPDATE funcoes fn
    SET empresa_id = origem.empresa_id
    FROM (
      SELECT
        funcao_id,
        MIN(empresa_id) AS empresa_id
      FROM funcionarios
      WHERE funcao_id IS NOT NULL
        AND empresa_id IS NOT NULL
      GROUP BY funcao_id
    ) origem
    WHERE fn.id = origem.funcao_id
      AND fn.empresa_id IS NULL
  `);

  if (migracao.rowCount > 0) {
    console.log(
      `✅ ${migracao.rowCount} função(ões) antiga(s) vinculada(s) às empresas.`
    );
  }

  await pool.query(`
    CREATE INDEX IF NOT EXISTS
    idx_funcoes_empresa_id
    ON funcoes(empresa_id)
  `);

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS
    idx_funcoes_empresa_nome_unique
    ON funcoes(
      empresa_id,
      LOWER(nome)
    )
    WHERE empresa_id IS NOT NULL
  `);
}


/* =========================================================
   FUNCIONÁRIOS
   MULTIEMPRESA
========================================================= */

async function garantirTabelaFuncionarios() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS funcionarios (
      id BIGSERIAL PRIMARY KEY,

      empresa_id BIGINT
        REFERENCES empresas(id)
        ON DELETE RESTRICT,

      nome VARCHAR(200) NOT NULL,

      cpf VARCHAR(20) NOT NULL,

      cnpj_empresa VARCHAR(20),

      chegada TIME,
      intervalo_inicio TIME,
      intervalo_fim TIME,
      saida TIME,

      funcao_id BIGINT
        REFERENCES funcoes(id)
        ON DELETE SET NULL,

      ativo BOOLEAN
        NOT NULL DEFAULT true,

      created_at TIMESTAMP
        DEFAULT NOW(),

      updated_at TIMESTAMP
        DEFAULT NOW()
    );
  `);

  await pool.query(`
    ALTER TABLE funcionarios
    ADD COLUMN IF NOT EXISTS empresa_id
    BIGINT REFERENCES empresas(id)
    ON DELETE RESTRICT
  `);

  await pool.query(`
    ALTER TABLE funcionarios
    ADD COLUMN IF NOT EXISTS cnpj_empresa
    VARCHAR(20)
  `);

  await pool.query(`
    ALTER TABLE funcionarios
    ADD COLUMN IF NOT EXISTS funcao_id
    BIGINT REFERENCES funcoes(id)
    ON DELETE SET NULL
  `);

  await pool.query(`
    ALTER TABLE funcionarios
    ADD COLUMN IF NOT EXISTS ativo
    BOOLEAN NOT NULL DEFAULT true
  `);

  await pool.query(`
    ALTER TABLE funcionarios
    ADD COLUMN IF NOT EXISTS created_at
    TIMESTAMP DEFAULT NOW()
  `);

  await pool.query(`
    ALTER TABLE funcionarios
    ADD COLUMN IF NOT EXISTS updated_at
    TIMESTAMP DEFAULT NOW()
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS
    idx_funcionarios_empresa_id
    ON funcionarios(empresa_id)
  `);
}


/* =========================================================
   PONTOS
   MULTIEMPRESA
========================================================= */

async function garantirTabelaPontos() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS pontos (
      id BIGSERIAL PRIMARY KEY,

      empresa_id BIGINT
        REFERENCES empresas(id)
        ON DELETE RESTRICT,

      funcionario_id BIGINT NOT NULL
        REFERENCES funcionarios(id)
        ON DELETE CASCADE,

      tipo TEXT NOT NULL,

      marcado_em TIMESTAMP
        DEFAULT NOW(),

      data_referencia DATE,

      CHECK (
        tipo IN (
          'entrada',
          'intervalo_inicio',
          'intervalo_fim',
          'saida',
          'auto'
        )
      )
    );
  `);

  await pool.query(`
    ALTER TABLE pontos
    ADD COLUMN IF NOT EXISTS empresa_id
    BIGINT REFERENCES empresas(id)
    ON DELETE RESTRICT
  `);

  await pool.query(`
    ALTER TABLE pontos
    ADD COLUMN IF NOT EXISTS data_referencia
    DATE
  `);

  const migracao = await pool.query(`
    UPDATE pontos p
    SET empresa_id = f.empresa_id
    FROM funcionarios f
    WHERE p.funcionario_id = f.id
      AND p.empresa_id IS NULL
      AND f.empresa_id IS NOT NULL
  `);

  if (migracao.rowCount > 0) {
    console.log(
      `✅ ${migracao.rowCount} ponto(s) antigo(s) vinculado(s) às empresas.`
    );
  }

  await pool.query(`
    CREATE INDEX IF NOT EXISTS
    idx_pontos_empresa_id
    ON pontos(empresa_id)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS
    idx_pontos_empresa_funcionario
    ON pontos(
      empresa_id,
      funcionario_id
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS
    idx_pontos_empresa_data
    ON pontos(
      empresa_id,
      marcado_em
    )
  `);
}


/* =========================================================
   FALTAS / FOLGAS / FÉRIAS / FERIADOS
   MULTIEMPRESA
========================================================= */

async function garantirTabelaFaltas() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS faltas_ajustes (
      id BIGSERIAL PRIMARY KEY,

      empresa_id BIGINT
        REFERENCES empresas(id)
        ON DELETE RESTRICT,

      funcionario_id BIGINT NOT NULL
        REFERENCES funcionarios(id)
        ON DELETE CASCADE,

      data DATE NOT NULL,

      falta BOOLEAN
        NOT NULL DEFAULT false,

      folga BOOLEAN
        NOT NULL DEFAULT false,

      ferias BOOLEAN
        NOT NULL DEFAULT false,

      falta_justificada BOOLEAN
        NOT NULL DEFAULT false,

      justificativa_falta TEXT,

      feriado BOOLEAN
        NOT NULL DEFAULT false,

      created_at TIMESTAMP
        DEFAULT NOW(),

      updated_at TIMESTAMP
        DEFAULT NOW()
    );
  `);

  await pool.query(`
    ALTER TABLE faltas_ajustes
    ADD COLUMN IF NOT EXISTS empresa_id
    BIGINT REFERENCES empresas(id)
    ON DELETE RESTRICT
  `);

  await pool.query(`
    ALTER TABLE faltas_ajustes
    ADD COLUMN IF NOT EXISTS folga
    BOOLEAN NOT NULL DEFAULT false
  `);

  await pool.query(`
    ALTER TABLE faltas_ajustes
    ADD COLUMN IF NOT EXISTS ferias
    BOOLEAN NOT NULL DEFAULT false
  `);

  await pool.query(`
    ALTER TABLE faltas_ajustes
    ADD COLUMN IF NOT EXISTS falta_justificada
    BOOLEAN NOT NULL DEFAULT false
  `);

  await pool.query(`
    ALTER TABLE faltas_ajustes
    ADD COLUMN IF NOT EXISTS justificativa_falta
    TEXT
  `);

  await pool.query(`
    ALTER TABLE faltas_ajustes
    ADD COLUMN IF NOT EXISTS feriado
    BOOLEAN NOT NULL DEFAULT false
  `);

  await pool.query(`
    ALTER TABLE faltas_ajustes
    ADD COLUMN IF NOT EXISTS created_at
    TIMESTAMP DEFAULT NOW()
  `);

  await pool.query(`
    ALTER TABLE faltas_ajustes
    ADD COLUMN IF NOT EXISTS updated_at
    TIMESTAMP DEFAULT NOW()
  `);

  const migracao = await pool.query(`
    UPDATE faltas_ajustes fa
    SET empresa_id = f.empresa_id
    FROM funcionarios f
    WHERE fa.funcionario_id = f.id
      AND fa.empresa_id IS NULL
      AND f.empresa_id IS NOT NULL
  `);

  if (migracao.rowCount > 0) {
    console.log(
      `✅ ${migracao.rowCount} ajuste(s) antigo(s) de faltas vinculado(s) às empresas.`
    );
  }

  await pool.query(`
    CREATE INDEX IF NOT EXISTS
    idx_faltas_empresa_id
    ON faltas_ajustes(empresa_id)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS
    idx_faltas_empresa_funcionario
    ON faltas_ajustes(
      empresa_id,
      funcionario_id
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS
    idx_faltas_empresa_data
    ON faltas_ajustes(
      empresa_id,
      data
    )
  `);
}


/* =========================================================
   ATESTADOS
   MULTIEMPRESA
========================================================= */

async function garantirTabelaAtestados() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS atestados (
      id BIGSERIAL PRIMARY KEY,

      empresa_id BIGINT
        REFERENCES empresas(id)
        ON DELETE RESTRICT,

      funcionario_id BIGINT NOT NULL
        REFERENCES funcionarios(id)
        ON DELETE CASCADE,

      data_inicio DATE NOT NULL,
      data_fim DATE NOT NULL,

      arquivo TEXT NOT NULL,

      repor_horas BOOLEAN
        NOT NULL DEFAULT false,

      created_at TIMESTAMP
        DEFAULT NOW()
    );
  `);

  await pool.query(`
    ALTER TABLE atestados
    ADD COLUMN IF NOT EXISTS empresa_id
    BIGINT REFERENCES empresas(id)
    ON DELETE RESTRICT
  `);

  await pool.query(`
    ALTER TABLE atestados
    ADD COLUMN IF NOT EXISTS repor_horas
    BOOLEAN NOT NULL DEFAULT false
  `);

  const migracao = await pool.query(`
    UPDATE atestados a
    SET empresa_id = f.empresa_id
    FROM funcionarios f
    WHERE a.funcionario_id = f.id
      AND a.empresa_id IS NULL
      AND f.empresa_id IS NOT NULL
  `);

  if (migracao.rowCount > 0) {
    console.log(
      `✅ ${migracao.rowCount} atestado(s) antigo(s) vinculado(s) às empresas.`
    );
  }

  await pool.query(`
    CREATE INDEX IF NOT EXISTS
    idx_atestados_empresa_id
    ON atestados(empresa_id)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS
    idx_atestados_empresa_funcionario
    ON atestados(
      empresa_id,
      funcionario_id
    )
  `);
}


/* =========================================================
   GARANTIR TODAS AS TABELAS
========================================================= */

async function garantirTabelas() {
  await garantirTabelaFuncoes();
  await garantirTabelaFuncionarios();
  await garantirTabelaPontos();
  await garantirTabelaFaltas();
  await garantirTabelaAtestados();
}


/* =========================================================
   DESCOBRIR EMPRESA DA REQUISIÇÃO
   CORRIGIDO
========================================================= */

function obterEmpresaIdDaRequisicao(req) {
  const role = String(
    req.user?.role || ""
  )
    .trim()
    .toLowerCase();

  /*
    ADMIN / RH / PONTO

    Todos estes usuários pertencem a uma empresa.
    Portanto a empresa vem obrigatoriamente do JWT.
  */

  if (
    role === "admin_empresa" ||
    role === "rh_empresa" ||
    role === "ponto_empresa"
  ) {
    const empresaId = Number(
      req.user?.empresa_id
    );

    if (
      Number.isInteger(empresaId) &&
      empresaId > 0
    ) {
      return empresaId;
    }

    console.error(
      "Usuário autenticado sem empresa_id:",
      {
        id: req.user?.id,
        username: req.user?.username,
        role: req.user?.role,
        empresa_id: req.user?.empresa_id,
      }
    );

    return null;
  }

  /*
    SUPER ADMIN

    Pode selecionar uma empresa.
  */

  if (role === "super_admin") {
    const empresaId = Number(
      req.query?.empresa_id
    );

    if (
      Number.isInteger(empresaId) &&
      empresaId > 0
    ) {
      return empresaId;
    }

    /*
      Se futuramente o super admin tiver
      empresa_id no JWT também aceitamos.
    */

    const empresaJwt = Number(
      req.user?.empresa_id
    );

    if (
      Number.isInteger(empresaJwt) &&
      empresaJwt > 0
    ) {
      return empresaJwt;
    }

    return null;
  }

  console.error(
    "Não foi possível descobrir a empresa:",
    {
      user: req.user,
    }
  );

  return null;
}


/* =========================================================
   GERAR RELATÓRIO DE UM FUNCIONÁRIO
========================================================= */

async function gerarRelatorioFuncionario(
  id,
  mes,
  ano,
  empresa_id
) {
  await garantirTabelas();

  const funcionarioId = Number(id);
  const mesNum = Number(mes);
  const anoNum = Number(ano);
  const empresaId = Number(empresa_id);

  if (
    !Number.isInteger(funcionarioId) ||
    funcionarioId <= 0 ||
    !Number.isInteger(empresaId) ||
    empresaId <= 0 ||
    !Number.isInteger(mesNum) ||
    mesNum < 1 ||
    mesNum > 12 ||
    !Number.isInteger(anoNum) ||
    anoNum < 2000
  ) {
    throw new Error("Parâmetros inválidos.");
  }

  const empresaQuery = await pool.query(
    `
    SELECT
      id,
      ativo
    FROM empresas
    WHERE id = $1
    LIMIT 1
    `,
    [empresaId]
  );

  if (empresaQuery.rows.length === 0) {
    throw new Error("Empresa não encontrada.");
  }

  if (!empresaQuery.rows[0].ativo) {
    throw new Error("Empresa desativada.");
  }

  const funcionarioQuery = await pool.query(
    `
    SELECT
      id,
      empresa_id,
      nome,
      cpf,
      cnpj_empresa,
      chegada,
      intervalo_inicio,
      intervalo_fim,
      saida,
      ativo
    FROM funcionarios
    WHERE id = $1
      AND empresa_id = $2
      AND ativo = true
    LIMIT 1
    `,
    [funcionarioId, empresaId]
  );

  if (funcionarioQuery.rows.length === 0) {
    throw new Error("Funcionário não encontrado.");
  }

  const funcionario =
    funcionarioQuery.rows[0];

  const mesStr =
    String(mesNum).padStart(2, "0");

  const inicioBusca =
    `${anoNum}-${mesStr}-01 00:00:00`;

  const fimBuscaDate =
    new Date(
      anoNum,
      mesNum,
      2
    );

  const fimBusca =
    `${fimBuscaDate.getFullYear()}-${String(
      fimBuscaDate.getMonth() + 1
    ).padStart(2, "0")}-${String(
      fimBuscaDate.getDate()
    ).padStart(2, "0")} 00:00:00`;

  const pontosQuery = `
    SELECT
      p.id,
      p.empresa_id,
      p.funcionario_id,
      p.tipo,
      p.marcado_em,
      p.data_referencia,

      f.nome,
      f.cpf,
      f.chegada,

      f.intervalo_inicio
        AS regra_int_in,

      f.intervalo_fim
        AS regra_int_fi,

      f.saida
        AS regra_saida

    FROM pontos p

    INNER JOIN funcionarios f
      ON f.id = p.funcionario_id
     AND f.empresa_id = p.empresa_id

    WHERE p.funcionario_id = $1
      AND p.empresa_id = $2

      AND (
        (
          p.data_referencia IS NULL
          AND p.marcado_em >= $3::timestamp
          AND p.marcado_em < $4::timestamp
        )

        OR

        (
          p.data_referencia IS NOT NULL
          AND EXTRACT(MONTH FROM p.data_referencia) = $5
          AND EXTRACT(YEAR FROM p.data_referencia) = $6
        )
      )

    ORDER BY
      COALESCE(
        p.data_referencia,
        p.marcado_em::date
      ) ASC,
      p.marcado_em ASC,
      p.id ASC
  `;

  const { rows } =
    await pool.query(
      pontosQuery,
      [
        funcionarioId,
        empresaId,
        inicioBusca,
        fimBusca,
        mesNum,
        anoNum,
      ]
    );

  const primeiroDiaMes =
    `${anoNum}-${mesStr}-01`;

  const ultimoDiaMes =
    `${anoNum}-${mesStr}-${String(
      new Date(
        anoNum,
        mesNum,
        0
      ).getDate()
    ).padStart(2, "0")}`;

  const atestadosQuery =
    await pool.query(
      `
    SELECT
      id,
      empresa_id,
      funcionario_id,
      data_inicio,
      data_fim,
      arquivo,
      repor_horas
    FROM atestados
    WHERE funcionario_id = $1
      AND empresa_id = $2
      AND data_inicio <= $4::date
      AND data_fim >= $3::date
    ORDER BY data_inicio ASC, id ASC
    `,
      [
        funcionarioId,
        empresaId,
        primeiroDiaMes,
        ultimoDiaMes,
      ]
    );

  const faltasQuery =
    await pool.query(
      `
      SELECT
        data,
        falta,
        folga,
        ferias,
        falta_justificada,
        justificativa_falta,
        feriado
      FROM faltas_ajustes
      WHERE funcionario_id = $1
        AND empresa_id = $2
        AND data >= $3::date
        AND data <= $4::date
      ORDER BY data ASC
      `,
      [
        funcionarioId,
        empresaId,
        primeiroDiaMes,
        ultimoDiaMes,
      ]
    );

  const mapaAjustes = {};

  for (const item of faltasQuery.rows) {
    const d = new Date(item.data);

    d.setHours(0, 0, 0, 0);

    const chave =
      `${d.getFullYear()}-${String(
        d.getMonth() + 1
      ).padStart(2, "0")}-${String(
        d.getDate()
      ).padStart(2, "0")}`;

    mapaAjustes[chave] = {
      falta: !!item.falta,
      folga: !!item.folga,
      ferias: !!item.ferias,
      falta_justificada:
        !!item.falta_justificada,
      justificativa_falta:
        item.justificativa_falta || "",
      feriado:
        !!item.feriado,
    };
  }

  const listaAtestados =
    atestadosQuery.rows;

  function diaTemAtestado(data) {
    if (!data) {
      return null;
    }

    const diaRef =
      new Date(data);

    diaRef.setHours(
      0,
      0,
      0,
      0
    );

    for (
      const atestado
      of listaAtestados
    ) {
      const inicio =
        new Date(
          atestado.data_inicio
        );

      const fim =
        new Date(
          atestado.data_fim
        );

      inicio.setHours(
        0,
        0,
        0,
        0
      );

      fim.setHours(
        23,
        59,
        59,
        999
      );

      if (
        diaRef >= inicio &&
        diaRef <= fim
      ) {
        return {
          /* =====================================
             ID DO ATESTADO
          ===================================== */

          id:
            Number(
              atestado.id
            ),

          atestado_id:
            Number(
              atestado.id
            ),

          empresa_id:
            Number(
              atestado.empresa_id
            ),

          funcionario_id:
            Number(
              atestado.funcionario_id
            ),

          arquivo:
            atestado.arquivo,

          repor_horas:
            !!atestado.repor_horas,
        };
      }
    }

    return null;
  }

  function zerarHora(data) {
    const d =
      new Date(data);

    d.setHours(
      0,
      0,
      0,
      0
    );

    return d;
  }

  function formatarChaveDia(data) {
    const d =
      zerarHora(data);

    return `${d.getFullYear()}-${String(
      d.getMonth() + 1
    ).padStart(2, "0")}-${String(
      d.getDate()
    ).padStart(2, "0")}`;
  }

  function horaParaMinutos(valor) {
    if (!valor) {
      return null;
    }

    const texto =
      String(valor).slice(0, 5);

    const [h, m] =
      texto
        .split(":")
        .map(Number);

    if (
      Number.isNaN(h) ||
      Number.isNaN(m)
    ) {
      return null;
    }

    return h * 60 + m;
  }

  function funcionarioTrabalhaMadrugada() {
    const entradaMin =
      horaParaMinutos(
        funcionario.chegada
      );

    const saidaMin =
      horaParaMinutos(
        funcionario.saida
      );

    if (
      entradaMin == null ||
      saidaMin == null
    ) {
      return false;
    }

    return saidaMin <= entradaMin;
  }

  function formatarChaveDiaRelatorio(row) {
    if (row.data_referencia) {
      const dataRef =
        new Date(
          row.data_referencia
        );

      dataRef.setHours(
        0,
        0,
        0,
        0
      );

      return `${dataRef.getFullYear()}-${String(
        dataRef.getMonth() + 1
      ).padStart(2, "0")}-${String(
        dataRef.getDate()
      ).padStart(2, "0")}`;
    }

    const data =
      zerarHora(
        row.marcado_em
      );

    const tipo =
      String(row.tipo || "")
        .trim()
        .toLowerCase();

    if (
      funcionarioTrabalhaMadrugada() &&
      tipo !== "entrada"
    ) {
      const dataHora =
        new Date(
          row.marcado_em
        );

      const minutosBatida =
        dataHora.getHours() *
        60 +
        dataHora.getMinutes();

      const saidaMin =
        horaParaMinutos(
          funcionario.saida
        );

      if (
        saidaMin != null &&
        minutosBatida <=
        saidaMin + 180
      ) {
        data.setDate(
          data.getDate() - 1
        );
      }
    }

    return `${data.getFullYear()}-${String(
      data.getMonth() + 1
    ).padStart(2, "0")}-${String(
      data.getDate()
    ).padStart(2, "0")}`;
  }

  function formatarHora(data) {
    if (!data) {
      return "";
    }

    return new Date(
      data
    ).toLocaleTimeString(
      "pt-BR",
      {
        hour: "2-digit",
        minute: "2-digit",
      }
    );
  }

  function linhaBaseResposta(
    dataAtual,
    extras = {}
  ) {
    return {
      empresa_id:
        empresaId,

      funcionario_id:
        funcionario.id,

      data:
        dataAtual.toLocaleDateString(
          "pt-BR"
        ),

      nome:
        funcionario.nome,

      cpf:
        funcionario.cpf,

      entrada: "",
      intervalo_inicio: "",
      intervalo_fim: "",
      saida: "",

      total_horas: "",

      saldo_bruto: 0,

      atraso_total:
        formatarSaldo(0),

      atestado: false,

      /* ID utilizado para abrir o PDF */
      atestado_id: null,

      atestado_repor_horas:
        false,

      arquivo_atestado:
        null,

      falta: false,
      folga: false,
      ferias: false,

      falta_justificada:
        false,

      justificativa_falta:
        "",

      feriado: false,

      ids_originais: {},

      ...extras,
    };
  }

  function criarLinhaBase(row) {
    return {
      ids_originais: {
        entrada_id: null,
        intervalo_inicio_id: null,
        intervalo_fim_id: null,
        saida_id: null,
      },

      entrada: null,
      intervalo_inicio: null,
      intervalo_fim: null,
      saida: null,

      nome:
        row?.nome ||
        funcionario.nome,

      cpf:
        row?.cpf ||
        funcionario.cpf,

      regras: {
        entrada:
          row?.chegada ||
          funcionario.chegada,

        intervalo_in:
          row?.regra_int_in ||
          funcionario.intervalo_inicio,

        intervalo_fi:
          row?.regra_int_fi ||
          funcionario.intervalo_fim,

        saida:
          row?.regra_saida ||
          funcionario.saida,
      },
    };
  }

  function linhaTemAlgumaBatida(linha) {
    return !!(
      linha.entrada ||
      linha.intervalo_inicio ||
      linha.intervalo_fim ||
      linha.saida
    );
  }

  function adicionarCampo(
    linha,
    tipo,
    row
  ) {
    const dataHora =
      new Date(row.marcado_em);

    if (tipo === "entrada") {
      linha.entrada = dataHora;
      linha.ids_originais.entrada_id =
        row.id;
      return;
    }

    if (tipo === "intervalo_inicio") {
      linha.intervalo_inicio =
        dataHora;

      linha.ids_originais
        .intervalo_inicio_id =
        row.id;

      return;
    }

    if (tipo === "intervalo_fim") {
      linha.intervalo_fim =
        dataHora;

      linha.ids_originais
        .intervalo_fim_id =
        row.id;

      return;
    }

    if (tipo === "saida") {
      linha.saida = dataHora;
      linha.ids_originais.saida_id =
        row.id;
    }
  }

  function toMinutos(valor) {
    if (!valor) return null;

    if (valor instanceof Date) {
      return (
        valor.getHours() *
        60 +
        valor.getMinutes()
      );
    }

    const texto =
      String(valor).slice(
        0,
        5
      );

    const [h, m] =
      texto
        .split(":")
        .map(Number);

    if (
      Number.isNaN(h) ||
      Number.isNaN(m)
    ) {
      return null;
    }

    return h * 60 + m;
  }

  function escolherMaisProximo(
    lista,
    regraHora
  ) {
    if (
      !lista.length ||
      !regraHora
    ) {
      return null;
    }

    const regraMin =
      toMinutos(regraHora);

    if (regraMin == null) {
      return null;
    }

    let melhor = null;
    let menorDiff = Infinity;

    for (const item of lista) {
      const minutos =
        toMinutos(
          new Date(
            item.marcado_em
          )
        );

      const diff =
        Math.abs(
          minutos -
          regraMin
        );

      if (diff < menorDiff) {
        menorDiff = diff;
        melhor = item;
      }
    }

    return melhor;
  }

  function removerItemPorId(
    lista,
    idRemover
  ) {
    const idx =
      lista.findIndex(
        (item) =>
          item.id === idRemover
      );

    if (idx >= 0) {
      lista.splice(
        idx,
        1
      );
    }
  }

  function montarLinhasDoDia(lista) {
    if (
      !lista ||
      lista.length === 0
    ) {
      return [];
    }

    const linhas = [];

    const primeiraLinha =
      criarLinhaBase(lista[0]);

    linhas.push(primeiraLinha);

    const entradas = [];
    const intervalosInicio = [];
    const intervalosFim = [];
    const saidas = [];
    const autos = [];

    for (const row of lista) {
      const tipo =
        String(row.tipo || "")
          .trim()
          .toLowerCase();

      if (tipo === "entrada") {
        entradas.push(row);
      } else if (
        tipo === "intervalo_inicio"
      ) {
        intervalosInicio.push(row);
      } else if (
        tipo === "intervalo_fim"
      ) {
        intervalosFim.push(row);
      } else if (
        tipo === "saida"
      ) {
        saidas.push(row);
      } else if (
        tipo === "auto"
      ) {
        autos.push(row);
      }
    }

    if (entradas.length > 0) {
      adicionarCampo(
        primeiraLinha,
        "entrada",
        entradas.shift()
      );
    } else if (
      autos.length > 0
    ) {
      adicionarCampo(
        primeiraLinha,
        "entrada",
        autos.shift()
      );
    }

    let principalIntervaloInicio =
      escolherMaisProximo(
        intervalosInicio,
        primeiraLinha.regras.intervalo_in
      );

    if (
      !principalIntervaloInicio &&
      autos.length > 0
    ) {
      principalIntervaloInicio =
        autos.shift();
    }

    if (principalIntervaloInicio) {
      adicionarCampo(
        primeiraLinha,
        "intervalo_inicio",
        principalIntervaloInicio
      );

      removerItemPorId(
        intervalosInicio,
        principalIntervaloInicio.id
      );
    }

    let principalIntervaloFim =
      escolherMaisProximo(
        intervalosFim,
        primeiraLinha.regras.intervalo_fi
      );

    if (
      !principalIntervaloFim &&
      autos.length > 0
    ) {
      principalIntervaloFim =
        autos.shift();
    }

    if (principalIntervaloFim) {
      adicionarCampo(
        primeiraLinha,
        "intervalo_fim",
        principalIntervaloFim
      );

      removerItemPorId(
        intervalosFim,
        principalIntervaloFim.id
      );
    }

    if (saidas.length > 0) {
      adicionarCampo(
        primeiraLinha,
        "saida",
        saidas.shift()
      );
    } else if (
      autos.length > 0
    ) {
      adicionarCampo(
        primeiraLinha,
        "saida",
        autos.shift()
      );
    }

    while (
      intervalosInicio.length > 0 ||
      intervalosFim.length > 0
    ) {
      const linha =
        criarLinhaBase(lista[0]);

      if (
        intervalosInicio.length > 0
      ) {
        adicionarCampo(
          linha,
          "intervalo_inicio",
          intervalosInicio.shift()
        );
      }

      if (
        intervalosFim.length > 0
      ) {
        adicionarCampo(
          linha,
          "intervalo_fim",
          intervalosFim.shift()
        );
      }

      if (
        linhaTemAlgumaBatida(
          linha
        )
      ) {
        linhas.push(linha);
      }
    }

    while (
      entradas.length > 0 ||
      saidas.length > 0
    ) {
      const linha =
        criarLinhaBase(lista[0]);

      if (
        entradas.length > 0
      ) {
        adicionarCampo(
          linha,
          "entrada",
          entradas.shift()
        );
      }

      if (
        saidas.length > 0
      ) {
        adicionarCampo(
          linha,
          "saida",
          saidas.shift()
        );
      }

      if (
        linhaTemAlgumaBatida(
          linha
        )
      ) {
        linhas.push(linha);
      }
    }

    while (autos.length > 0) {
      const linha =
        criarLinhaBase(lista[0]);

      const a1 =
        autos.shift();

      adicionarCampo(
        linha,
        "entrada",
        a1
      );

      if (autos.length > 0) {
        const a2 =
          autos.shift();

        adicionarCampo(
          linha,
          "saida",
          a2
        );
      }

      if (
        linhaTemAlgumaBatida(
          linha
        )
      ) {
        linhas.push(linha);
      }
    }

    return linhas.filter(
      (linha) =>
        linhaTemAlgumaBatida(
          linha
        )
    );
  }

  const pontosPorDia = {};

  for (const row of rows) {
    const chaveDia =
      formatarChaveDiaRelatorio(
        row
      );

    if (!pontosPorDia[chaveDia]) {
      pontosPorDia[chaveDia] =
        [];
    }

    pontosPorDia[chaveDia].push(
      row
    );
  }

  const turnosPorDia = {};

  for (
    const [chaveDia, lista]
    of Object.entries(
      pontosPorDia
    )
  ) {
    turnosPorDia[chaveDia] =
      montarLinhasDoDia(
        lista
      );
  }

  const final = [];

  const diasNoMes =
    new Date(
      anoNum,
      mesNum,
      0
    ).getDate();

  for (
    let dia = 1;
    dia <= diasNoMes;
    dia++
  ) {
    const dataAtual =
      new Date(
        anoNum,
        mesNum - 1,
        dia
      );

    dataAtual.setHours(
      0,
      0,
      0,
      0
    );

    const chaveDia =
      formatarChaveDia(
        dataAtual
      );

    const turnosDoDia =
      turnosPorDia[chaveDia] ||
      [];

    const atestadoInfo =
      diaTemAtestado(
        dataAtual
      );

    /* =====================================================
       ID DO ATESTADO
    ===================================================== */

    const atestadoId =
      atestadoInfo?.atestado_id
        ? Number(
          atestadoInfo.atestado_id
        )
        : null;


    /* =====================================================
       ARQUIVO
    ===================================================== */

    const arquivoAtestado =
      atestadoInfo?.arquivo ||
      null;


    /* =====================================================
       REPOR HORAS
    ===================================================== */

    const atestadoReporHoras =
      !!atestadoInfo?.repor_horas;

    const ajusteDia =
      mapaAjustes[chaveDia] ||
      {
        falta: false,
        folga: false,
        ferias: false,
        falta_justificada: false,
        justificativa_falta: "",
        feriado: false,
      };

    const faltaDoDia =
      !!ajusteDia.falta;

    const folgaDoDia =
      !!ajusteDia.folga;

    const feriasDoDia =
      !!ajusteDia.ferias;

    const faltaJustificadaDoDia =
      !!ajusteDia.falta_justificada;

    const feriadoDoDia =
      !!ajusteDia.feriado;

    const atestadoDoDia =
      !!arquivoAtestado;

    if (
      atestadoDoDia &&
      atestadoReporHoras
    ) {
      const entradaMin =
        horaParaMinutos(
          funcionario.chegada
        );

      const intervaloInicioMin =
        horaParaMinutos(
          funcionario.intervalo_inicio
        );

      const intervaloFimMin =
        horaParaMinutos(
          funcionario.intervalo_fim
        );

      const saidaMin =
        horaParaMinutos(
          funcionario.saida
        );

      let minutosPrevistos = 0;

      if (
        entradaMin != null &&
        intervaloInicioMin != null &&
        intervaloFimMin != null &&
        saidaMin != null
      ) {
        let primeiroPeriodo =
          intervaloInicioMin -
          entradaMin;

        let segundoPeriodo =
          saidaMin -
          intervaloFimMin;

        if (
          primeiroPeriodo < 0
        ) {
          primeiroPeriodo +=
            1440;
        }

        if (
          segundoPeriodo < 0
        ) {
          segundoPeriodo +=
            1440;
        }

        minutosPrevistos =
          primeiroPeriodo +
          segundoPeriodo;
      }

      let minutosTrabalhados =
        0;

      let linhaComBatida =
        null;

      if (
        turnosDoDia.length > 0
      ) {
        linhaComBatida =
          turnosDoDia[0];

        const calculadoBatidas =
          calcularDia({
            pontos:
              linhaComBatida,

            regras:
              linhaComBatida.regras,

            ehLinhaExtra:
              false,

            falta:
              false,
          });

        const totalTexto =
          calculadoBatidas.total_horas ||
          "";

        const partes =
          String(totalTexto)
            .replace("h", ":")
            .replace("m", "")
            .split(":");

        const h =
          Number(partes[0]);

        const m =
          Number(partes[1]);

        if (
          !Number.isNaN(h) &&
          !Number.isNaN(m)
        ) {
          minutosTrabalhados =
            h * 60 + m;
        }
      }

      const minutosFaltantes =
        Math.max(
          0,
          minutosPrevistos -
          minutosTrabalhados
        );

      const saldoAtestado =
        -Math.abs(
          minutosFaltantes
        );

      final.push(
        linhaBaseResposta(
          dataAtual,
          {
            entrada:
              linhaComBatida?.entrada
                ? formatarHora(
                  linhaComBatida.entrada
                )
                : "",

            intervalo_inicio:
              linhaComBatida?.intervalo_inicio
                ? formatarHora(
                  linhaComBatida.intervalo_inicio
                )
                : "",

            intervalo_fim:
              linhaComBatida?.intervalo_fim
                ? formatarHora(
                  linhaComBatida.intervalo_fim
                )
                : "",

            saida:
              linhaComBatida?.saida
                ? formatarHora(
                  linhaComBatida.saida
                )
                : "",

            total_horas:
              minutosTrabalhados > 0
                ? `${Math.floor(
                  minutosTrabalhados / 60
                )}h ${minutosTrabalhados % 60
                }m`
                : "",

            saldo_bruto:
              saldoAtestado,

            atraso_total:
              formatarSaldo(
                saldoAtestado
              ),

            atestado:
              true,

            atestado_id:
              atestadoId,

            atestado_repor_horas:
              true,

            arquivo_atestado:
              arquivoAtestado,

            feriado:
              feriadoDoDia,

            ids_originais:
              linhaComBatida?.ids_originais ||
              {},
          }
        )
      );

      continue;
    }

    if (faltaDoDia) {
      final.push(
        linhaBaseResposta(
          dataAtual,
          {
            saldo_bruto: 0,

            atraso_total:
              formatarSaldo(0),

            falta: true,

            feriado:
              feriadoDoDia,
          }
        )
      );

      continue;
    }

    if (faltaJustificadaDoDia) {
      const regrasFaltaJustificada = {
        entrada:
          funcionario.chegada,

        intervalo_in:
          funcionario.intervalo_inicio,

        intervalo_fi:
          funcionario.intervalo_fim,

        saida:
          funcionario.saida,
      };

      const calculadoFaltaJustificada =
        calcularDia({
          pontos: {},

          regras:
            regrasFaltaJustificada,

          ehLinhaExtra:
            false,

          falta:
            true,
        });

      const saldo =
        Number(
          calculadoFaltaJustificada.saldo_bruto
        ) || 0;

      final.push(
        linhaBaseResposta(
          dataAtual,
          {
            entrada:
              calculadoFaltaJustificada.entrada ||
              "",

            intervalo_inicio:
              calculadoFaltaJustificada.intervalo_inicio ||
              "",

            intervalo_fim:
              calculadoFaltaJustificada.intervalo_fim ||
              "",

            saida:
              calculadoFaltaJustificada.saida ||
              "",

            saldo_bruto:
              saldo,

            atraso_total:
              formatarSaldo(
                saldo
              ),

            falta_justificada:
              true,

            justificativa_falta:
              ajusteDia.justificativa_falta ||
              "",

            feriado:
              feriadoDoDia,
          }
        )
      );

      continue;
    }

    if (folgaDoDia) {
      final.push(
        linhaBaseResposta(
          dataAtual,
          {
            folga: true,
            feriado:
              feriadoDoDia,
          }
        )
      );

      continue;
    }

    if (feriasDoDia) {
      final.push(
        linhaBaseResposta(
          dataAtual,
          {
            ferias: true,
            feriado:
              feriadoDoDia,
          }
        )
      );

      continue;
    }

    if (turnosDoDia.length > 0) {
      const intervalosExtrasPrimeiraLinha =
        [];

      turnosDoDia.forEach(
        (turno, index) => {
          if (index === 0) {
            return;
          }

          const ehLinhaSoDeIntervalo =
            !turno.entrada &&
            !turno.saida &&
            turno.intervalo_inicio &&
            turno.intervalo_fim;

          if (ehLinhaSoDeIntervalo) {
            intervalosExtrasPrimeiraLinha.push({
              inicio:
                turno.intervalo_inicio,

              fim:
                turno.intervalo_fim,
            });
          }
        }
      );

      turnosDoDia.forEach(
        (turno, index) => {
          let result = {
            entrada:
              formatarHora(
                turno.entrada
              ),

            intervalo_inicio:
              formatarHora(
                turno.intervalo_inicio
              ),

            intervalo_fim:
              formatarHora(
                turno.intervalo_fim
              ),

            saida:
              formatarHora(
                turno.saida
              ),

            total_horas: "",

            saldo_bruto: 0,
          };

          const ehLinhaSoDeIntervalo =
            !turno.entrada &&
            !turno.saida &&
            turno.intervalo_inicio &&
            turno.intervalo_fim;

          const pontosCalculo =
            index === 0
              ? {
                ...turno,

                intervalosExtras:
                  intervalosExtrasPrimeiraLinha,
              }
              : turno;

          if (turno.entrada) {
            const calculado =
              calcularDia({
                pontos:
                  pontosCalculo,

                regras:
                  turno.regras,

                ehLinhaExtra:
                  index > 0,

                falta:
                  false,
              });

            result = {
              entrada:
                calculado.entrada ||
                formatarHora(
                  turno.entrada
                ),

              intervalo_inicio:
                calculado.intervalo_inicio ||
                formatarHora(
                  turno.intervalo_inicio
                ),

              intervalo_fim:
                calculado.intervalo_fim ||
                formatarHora(
                  turno.intervalo_fim
                ),

              saida:
                calculado.saida ||
                formatarHora(
                  turno.saida
                ),

              total_horas:
                calculado.total_horas ||
                "",

              saldo_bruto:
                Number(
                  calculado.saldo_bruto
                ) || 0,
            };
          } else if (
            ehLinhaSoDeIntervalo
          ) {
            result = {
              entrada: "",

              intervalo_inicio:
                formatarHora(
                  turno.intervalo_inicio
                ),

              intervalo_fim:
                formatarHora(
                  turno.intervalo_fim
                ),

              saida: "",

              total_horas: "",

              saldo_bruto: 0,
            };
          }

          final.push({
            empresa_id:
              empresaId,

            funcionario_id:
              funcionario.id,

            data:
              dataAtual.toLocaleDateString(
                "pt-BR"
              ),

            nome:
              turno.nome ||
              funcionario.nome,

            cpf:
              turno.cpf ||
              funcionario.cpf,

            entrada:
              result.entrada ||
              "",

            intervalo_inicio:
              result.intervalo_inicio ||
              "",

            intervalo_fim:
              result.intervalo_fim ||
              "",

            saida:
              result.saida ||
              "",

            total_horas:
              result.total_horas ||
              "",

            saldo_bruto:
              Number(
                result.saldo_bruto
              ) || 0,

            atraso_total:
              formatarSaldo(
                Number(
                  result.saldo_bruto
                ) || 0
              ),

            atestado:
              atestadoDoDia,

            atestado_id:
              atestadoId,

            atestado_repor_horas:
              false,

            arquivo_atestado:
              arquivoAtestado,
            falta: false,
            folga: false,
            ferias: false,

            falta_justificada:
              false,

            justificativa_falta:
              "",

            feriado:
              feriadoDoDia,

            ids_originais:
              turno.ids_originais ||
              {},
          });
        }
      );
    } else {
      final.push(
        linhaBaseResposta(
          dataAtual,
          {
            atestado:
              atestadoDoDia,

            atestado_id:
              atestadoId,

            atestado_repor_horas:
              false,

            arquivo_atestado:
              arquivoAtestado,

            feriado:
              feriadoDoDia,
          }
        )
      );
    }
  }

  return final;
}


/* =========================================================
   RELATÓRIO DE UM FUNCIONÁRIO
========================================================= */

async function relatorioFuncionario(
  req,
  res
) {
  try {
    const { id } =
      req.params;

    const {
      mes,
      ano,
    } = req.query;

    const empresaId =
      obterEmpresaIdDaRequisicao(
        req
      );

    console.log(
      "📊 RELATÓRIO:",
      {
        usuario:
          req.user?.username,

        role:
          req.user?.role,

        empresa_id:
          req.user?.empresa_id,

        empresa_identificada:
          empresaId,

        funcionario:
          id,

        mes,
        ano,
      }
    );

    if (!empresaId) {
      return res
        .status(400)
        .json({
          error:
            "Não foi possível identificar a empresa do usuário logado.",
        });
    }

    const dados =
      await gerarRelatorioFuncionario(
        id,
        mes,
        ano,
        empresaId
      );

    return res.json(
      dados
    );
  } catch (error) {
    console.error(
      "Erro ao gerar relatório do funcionário:",
      error
    );

    if (
      error.message ===
      "Funcionário não encontrado." ||
      error.message ===
      "Empresa não encontrada."
    ) {
      return res
        .status(404)
        .json({
          error:
            error.message,
        });
    }

    if (
      error.message ===
      "Empresa desativada."
    ) {
      return res
        .status(403)
        .json({
          error:
            error.message,
        });
    }

    if (
      error.message ===
      "Parâmetros inválidos."
    ) {
      return res
        .status(400)
        .json({
          error:
            error.message,
        });
    }

    return res
      .status(500)
      .json({
        error:
          error.message ||
          "Erro ao gerar relatório.",
      });
  }
}


/* =========================================================
   RELATÓRIO DE TODOS OS FUNCIONÁRIOS
========================================================= */

async function relatorioTodosFuncionarios(
  req,
  res
) {
  try {
    const {
      mes,
      ano,
    } = req.query;

    const mesNum =
      Number(mes);

    const anoNum =
      Number(ano);

    if (
      !Number.isInteger(mesNum) ||
      mesNum < 1 ||
      mesNum > 12 ||
      !Number.isInteger(anoNum) ||
      anoNum < 2000
    ) {
      return res
        .status(400)
        .json({
          error:
            "Mês e ano são obrigatórios e devem ser válidos.",
        });
    }

    const empresaId =
      obterEmpresaIdDaRequisicao(
        req
      );

    console.log(
      "📊 RELATÓRIO TODOS:",
      {
        usuario:
          req.user?.username,

        role:
          req.user?.role,

        empresa_id_jwt:
          req.user?.empresa_id,

        empresa_identificada:
          empresaId,

        mes:
          mesNum,

        ano:
          anoNum,
      }
    );

    if (!empresaId) {
      return res
        .status(400)
        .json({
          error:
            "Não foi possível identificar a empresa do usuário logado.",
        });
    }

    const empresaResult =
      await pool.query(
        `
        SELECT
          id,
          nome,
          nome_fantasia,
          ativo
        FROM empresas
        WHERE id = $1
        LIMIT 1
        `,
        [empresaId]
      );

    if (
      empresaResult.rows.length === 0
    ) {
      return res
        .status(404)
        .json({
          error:
            "Empresa não encontrada.",
        });
    }

    const empresa =
      empresaResult.rows[0];

    if (!empresa.ativo) {
      return res
        .status(403)
        .json({
          error:
            "Empresa desativada.",
        });
    }

    const {
      rows: funcionarios,
    } =
      await pool.query(
        `
        SELECT
          id,
          empresa_id,
          nome,
          cpf
        FROM funcionarios
        WHERE empresa_id = $1
          AND ativo = true
        ORDER BY nome ASC
        `,
        [empresaId]
      );

    const relatorios = [];

    for (
      const funcionario
      of funcionarios
    ) {
      const dados =
        await gerarRelatorioFuncionario(
          funcionario.id,
          mesNum,
          anoNum,
          empresaId
        );

      relatorios.push({
        funcionario: {
          id:
            funcionario.id,

          empresa_id:
            funcionario.empresa_id,

          nome:
            funcionario.nome,

          cpf:
            funcionario.cpf,
        },

        dados,
      });
    }

    return res.json({
      ok: true,

      empresa: {
        id:
          empresa.id,

        nome:
          empresa.nome_fantasia ||
          empresa.nome,
      },

      mes:
        mesNum,

      ano:
        anoNum,

      total_funcionarios:
        funcionarios.length,

      relatorios,
    });
  } catch (error) {
    console.error(
      "Erro ao gerar relatório de todos:",
      error
    );

    return res
      .status(500)
      .json({
        error:
          error.message ||
          "Erro ao gerar relatório.",
      });
  }
}


/* =========================================================
   EXPORTS
========================================================= */

module.exports = {
  gerarRelatorioFuncionario,
  relatorioFuncionario,
  relatorioTodosFuncionarios,
};