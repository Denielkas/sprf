const pool = require("../database/pool");
const { onlyDigits } = require("../utils/cpf");

/* =========================================
   VALIDAR EMPRESA DO PONTO
========================================= */
async function buscarEmpresaAtiva(empresaId) {
  const id = Number(empresaId);

  if (!Number.isInteger(id) || id <= 0) {
    return null;
  }

  const { rows } = await pool.query(
    `
    SELECT
      id,
      nome,
      nome_fantasia,
      ativo
    FROM empresas
    WHERE id = $1
      AND ativo = true
    LIMIT 1
    `,
    [id]
  );

  return rows[0] || null;
}


/* =========================================
   BUSCAR FUNCIONÁRIO DA EMPRESA
========================================= */
async function buscarFuncionarioDaEmpresa(
  funcionarioId,
  empresaId
) {
  const { rows } = await pool.query(
    `
    SELECT
      id,
      empresa_id,
      nome,
      cpf,
      ativo
    FROM funcionarios
    WHERE id = $1
      AND empresa_id = $2
      AND ativo = true
    LIMIT 1
    `,
    [
      funcionarioId,
      empresaId,
    ]
  );

  return rows[0] || null;
}

/* =========================================
   GARANTE TABELA FUNCOES
========================================= */
async function garantirTabelaFuncoes() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS funcoes (
      id BIGSERIAL PRIMARY KEY,
      nome VARCHAR(150) NOT NULL UNIQUE,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);
}

/* =========================================
   GARANTE TABELA FUNCIONARIOS
   MULTIEMPRESA
========================================= */
async function garantirTabelaFuncionarios() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS funcionarios (
      id BIGSERIAL PRIMARY KEY,

      empresa_id BIGINT REFERENCES empresas(id) ON DELETE RESTRICT,

      nome VARCHAR(200) NOT NULL,
      cpf VARCHAR(20) NOT NULL,

      chegada TIME,
      intervalo_inicio TIME,
      intervalo_fim TIME,
      saida TIME,

      funcao_id BIGINT REFERENCES funcoes(id) ON DELETE SET NULL,

      cnpj_empresa VARCHAR(20),

      ativo BOOLEAN NOT NULL DEFAULT true,

      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );
  `);

  /* =========================================
     EMPRESA
  ========================================= */

  await pool.query(`
    ALTER TABLE funcionarios
    ADD COLUMN IF NOT EXISTS empresa_id
    BIGINT REFERENCES empresas(id) ON DELETE RESTRICT
  `);

  /* =========================================
     FUNÇÃO
  ========================================= */

  await pool.query(`
    ALTER TABLE funcionarios
    ADD COLUMN IF NOT EXISTS funcao_id
    BIGINT REFERENCES funcoes(id) ON DELETE SET NULL
  `);

  /* =========================================
     CNPJ / UNIDADE
  ========================================= */

  await pool.query(`
    ALTER TABLE funcionarios
    ADD COLUMN IF NOT EXISTS cnpj_empresa VARCHAR(20)
  `);

  /* =========================================
     ATIVO
  ========================================= */

  await pool.query(`
    ALTER TABLE funcionarios
    ADD COLUMN IF NOT EXISTS ativo
    BOOLEAN NOT NULL DEFAULT true
  `);

  /* =========================================
     DATAS
  ========================================= */

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

  /* =========================================
     ÍNDICE EMPRESA
  ========================================= */

  await pool.query(`
    CREATE INDEX IF NOT EXISTS
    idx_funcionarios_empresa_id
    ON funcionarios(empresa_id)
  `);
}

/* =========================================
   GARANTE TABELA PONTOS
   MULTIEMPRESA
========================================= */
async function garantirTabelaPontos() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS pontos (
      id BIGSERIAL PRIMARY KEY,

      empresa_id BIGINT REFERENCES empresas(id) ON DELETE RESTRICT,

      funcionario_id BIGINT NOT NULL
        REFERENCES funcionarios(id)
        ON DELETE CASCADE,

      tipo TEXT NOT NULL,

      marcado_em TIMESTAMP DEFAULT NOW(),

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

  /* =========================================
     ADICIONAR EMPRESA EM BANCO EXISTENTE
  ========================================= */

  await pool.query(`
    ALTER TABLE pontos
    ADD COLUMN IF NOT EXISTS empresa_id
    BIGINT REFERENCES empresas(id) ON DELETE RESTRICT
  `);

  /* =========================================
     ÍNDICES
  ========================================= */

  await pool.query(`
    CREATE INDEX IF NOT EXISTS
    idx_pontos_empresa_id
    ON pontos(empresa_id)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS
    idx_pontos_funcionario_id
    ON pontos(funcionario_id)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS
    idx_pontos_empresa_funcionario
    ON pontos(empresa_id, funcionario_id)
  `);
}


/* =========================================
   MIGRAR PONTOS ANTIGOS PARA EMPRESA
========================================= */
async function migrarEmpresaPontosAntigos() {
  try {
    /*
      Pega a empresa do funcionário e coloca
      nos pontos antigos que ainda estão sem empresa.
    */

    const result = await pool.query(`
      UPDATE pontos p

      SET empresa_id = f.empresa_id

      FROM funcionarios f

      WHERE p.funcionario_id = f.id
        AND p.empresa_id IS NULL
        AND f.empresa_id IS NOT NULL
    `);

    if (result.rowCount > 0) {
      console.log(
        `✅ ${result.rowCount} ponto(s) antigo(s) vinculado(s) às empresas.`
      );
    }
  } catch (err) {
    console.error(
      "❌ Erro ao migrar empresa dos pontos antigos:",
      err
    );

    throw err;
  }
}

/* =========================================
   GARANTE TABELA FALTAS / AJUSTES
   MULTIEMPRESA
========================================= */
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

      falta BOOLEAN NOT NULL DEFAULT false,
      folga BOOLEAN NOT NULL DEFAULT false,
      ferias BOOLEAN NOT NULL DEFAULT false,

      falta_justificada BOOLEAN
        NOT NULL DEFAULT false,

      justificativa_falta TEXT,

      feriado BOOLEAN
        NOT NULL DEFAULT false,

      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW(),

      UNIQUE (funcionario_id, data)
    );
  `);

  /* =========================================
     EMPRESA EM BANCO JÁ EXISTENTE
  ========================================= */

  await pool.query(`
    ALTER TABLE faltas_ajustes
    ADD COLUMN IF NOT EXISTS empresa_id
    BIGINT REFERENCES empresas(id)
    ON DELETE RESTRICT
  `);

  /* =========================================
     COLUNAS ANTIGAS
  ========================================= */

  await pool.query(`
    ALTER TABLE faltas_ajustes
    ADD COLUMN IF NOT EXISTS falta
    BOOLEAN NOT NULL DEFAULT false
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

  /* =========================================
     MIGRAR REGISTROS ANTIGOS
  ========================================= */

  await pool.query(`
    UPDATE faltas_ajustes fa

    SET empresa_id = f.empresa_id

    FROM funcionarios f

    WHERE fa.funcionario_id = f.id
      AND fa.empresa_id IS NULL
      AND f.empresa_id IS NOT NULL
  `);

  /* =========================================
     ÍNDICES
  ========================================= */

  await pool.query(`
    CREATE INDEX IF NOT EXISTS
    idx_faltas_ajustes_empresa

    ON faltas_ajustes(empresa_id)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS
    idx_faltas_ajustes_empresa_funcionario

    ON faltas_ajustes(
      empresa_id,
      funcionario_id
    )
  `);
}

/* =========================================
   GARANTE TABELA ATESTADOS
   MULTIEMPRESA
========================================= */
async function garantirTabelaAtestados() {
  /* Cria a tabela caso ainda não exista */
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

      created_at TIMESTAMP DEFAULT NOW()
    );
  `);

  /* Adiciona empresa_id se a tabela já existia */
  await pool.query(`
    ALTER TABLE atestados
    ADD COLUMN IF NOT EXISTS empresa_id
    BIGINT REFERENCES empresas(id)
    ON DELETE RESTRICT
  `);

  /* Garante a coluna repor_horas */
  await pool.query(`
    ALTER TABLE atestados
    ADD COLUMN IF NOT EXISTS repor_horas
    BOOLEAN NOT NULL DEFAULT false
  `);

  /* =========================================
     MIGRAR ATESTADOS ANTIGOS

     Os atestados que já existem recebem
     automaticamente a empresa do funcionário.
  ========================================= */
  const resultado = await pool.query(`
    UPDATE atestados a

    SET empresa_id = f.empresa_id

    FROM funcionarios f

    WHERE a.funcionario_id = f.id
      AND a.empresa_id IS NULL
      AND f.empresa_id IS NOT NULL
  `);

  if (resultado.rowCount > 0) {
    console.log(
      `✅ ${resultado.rowCount} atestado(s) antigo(s) vinculado(s) às empresas.`
    );
  }

  /* =========================================
     ÍNDICES
  ========================================= */
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


/* =========================================
   GARANTE TODAS AS TABELAS
========================================= */
async function garantirTabelas() {
  await garantirTabelaFuncoes();

  await garantirTabelaFuncionarios();

  await garantirTabelaPontos();

  /* Preenche empresa_id dos pontos antigos */
  await migrarEmpresaPontosAntigos();

  await garantirTabelaFaltas();

  await garantirTabelaAtestados();
}

/* =========================================
   HELPERS TIMEZONE
========================================= */
function agoraSP() {
  return new Date(
    new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" })
  );
}

function dataHojeISO() {
  const agora = agoraSP();
  const ano = agora.getFullYear();
  const mes = String(agora.getMonth() + 1).padStart(2, "0");
  const dia = String(agora.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

function dataHoraAgoraSQL() {
  const agora = agoraSP();
  const data = dataHojeISO();
  const hora = String(agora.getHours()).padStart(2, "0");
  const minuto = String(agora.getMinutes()).padStart(2, "0");
  const segundo = String(agora.getSeconds()).padStart(2, "0");
  return `${data} ${hora}:${minuto}:${segundo}`;
}

function montarDataHora(dataBR, hora) {
  if (!dataBR || !hora) return null;

  const [d, m, a] = String(dataBR).split("/");
  if (!d || !m || !a) return null;

  return `${a}-${String(m).padStart(2, "0")}-${String(d).padStart(
    2,
    "0"
  )} ${hora}:00`;
}

function montarDataHoraComDia(data, hora, adicionarDias = 0) {
  if (!data || !hora) return null;

  let ano;
  let mes;
  let dia;

  /* =====================================
     FORMATO BR: DD/MM/YYYY
  ===================================== */

  if (String(data).includes("/")) {
    const partes = String(data).split("/");

    dia = Number(partes[0]);
    mes = Number(partes[1]);
    ano = Number(partes[2]);
  }

  /* =====================================
     FORMATO ISO: YYYY-MM-DD
  ===================================== */

  else if (String(data).includes("-")) {
    const partes = String(data).split("-");

    ano = Number(partes[0]);
    mes = Number(partes[1]);
    dia = Number(partes[2]);
  }

  else {
    return null;
  }

  if (
    !Number.isInteger(ano) ||
    !Number.isInteger(mes) ||
    !Number.isInteger(dia)
  ) {
    return null;
  }

  const dataObj = new Date(
    ano,
    mes - 1,
    dia,
    12,
    0,
    0
  );

  dataObj.setDate(
    dataObj.getDate() + adicionarDias
  );

  const anoFinal =
    dataObj.getFullYear();

  const mesFinal =
    String(
      dataObj.getMonth() + 1
    ).padStart(2, "0");

  const diaFinal =
    String(
      dataObj.getDate()
    ).padStart(2, "0");

  return `${anoFinal}-${mesFinal}-${diaFinal} ${hora}:00`;
}

function dataBRparaISO(dataBR) {
  if (!dataBR) return null;

  const [d, m, a] = String(dataBR).split("/");
  if (!d || !m || !a) return null;

  return `${a}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function normalizarHora(valor) {
  if (!valor) return null;
  const texto = String(valor).trim();
  if (texto.length >= 5) return texto.slice(0, 5);
  return null;
}

/* =========================================
   BUSCAS DE PONTO
========================================= */
async function buscarPontosHoje(funcionario_id) {
  const hoje = dataHojeISO();

  const { rows } = await pool.query(
    `
    SELECT id, tipo, marcado_em
    FROM pontos
    WHERE funcionario_id = $1
      AND marcado_em::date = $2::date
    ORDER BY marcado_em ASC, id ASC
    `,
    [funcionario_id, hoje]
  );

  return rows;
}

async function buscarBatidasTurnoAberto(funcionario_id) {
  const { rows } = await pool.query(
    `
    SELECT id, tipo, marcado_em
    FROM pontos
    WHERE funcionario_id = $1
      AND marcado_em >= (NOW() - INTERVAL '36 hours')
    ORDER BY marcado_em ASC, id ASC
    `,
    [funcionario_id]
  );

  if (!rows.length) return [];

  let indiceUltimaSaida = -1;

  for (let i = rows.length - 1; i >= 0; i--) {
    if (rows[i].tipo === "saida") {
      indiceUltimaSaida = i;
      break;
    }
  }

  const abertas = rows.slice(indiceUltimaSaida + 1);
  const temEntradaAberta = abertas.some((p) => p.tipo === "entrada");

  if (!temEntradaAberta) return [];

  return abertas;
}

async function buscarUltimaBatidaAberta(funcionario_id) {
  const abertas = await buscarBatidasTurnoAberto(funcionario_id);
  if (!abertas.length) return null;
  return abertas[abertas.length - 1];
}

/* =========================================
   PERMISSÕES DOS BOTÕES
========================================= */
function getPermissoesPorUltimaBatida(ultimaBatida) {
  const permissoes = {
    entrada: false,
    intervalo_inicio: false,
    intervalo_fim: false,
    saida: false,
  };

  if (!ultimaBatida) {
    permissoes.entrada = true;
    return permissoes;
  }

  if (ultimaBatida === "entrada") {
    permissoes.intervalo_inicio = true;
    permissoes.saida = true;
    return permissoes;
  }

  if (ultimaBatida === "intervalo_inicio") {
    permissoes.intervalo_fim = true;
    return permissoes;
  }

  if (ultimaBatida === "intervalo_fim") {
    permissoes.intervalo_inicio = true;
    permissoes.saida = true;
    return permissoes;
  }

  if (ultimaBatida === "saida") {
    permissoes.entrada = true;
    return permissoes;
  }

  permissoes.entrada = true;
  return permissoes;
}

/* =========================================
   BUSCAR TURNO ABERTO DO FUNCIONÁRIO
========================================= */
async function buscarTurnoAberto(funcionarioId, empresaId) {
  /*
    Procura a última entrada das últimas 36 horas
    que ainda não possui uma saída fechando o turno.
  */

  const entradaResult = await pool.query(
    `
    SELECT
      id,
      empresa_id,
      funcionario_id,
      tipo,
      marcado_em

    FROM pontos

    WHERE funcionario_id = $1
      AND empresa_id = $2
      AND tipo = 'entrada'
      AND marcado_em >= NOW() - INTERVAL '36 hours'

    ORDER BY marcado_em DESC

    LIMIT 1
    `,
    [
      funcionarioId,
      empresaId,
    ]
  );

  if (entradaResult.rows.length === 0) {
    return null;
  }

  const entrada = entradaResult.rows[0];

  /*
    Pega todas as batidas a partir dessa entrada.
  */

  const batidasResult = await pool.query(
    `
    SELECT
      id,
      empresa_id,
      funcionario_id,
      tipo,
      marcado_em

    FROM pontos

    WHERE funcionario_id = $1
      AND empresa_id = $2
      AND marcado_em >= $3

    ORDER BY marcado_em ASC, id ASC
    `,
    [
      funcionarioId,
      empresaId,
      entrada.marcado_em,
    ]
  );

  const batidas = batidasResult.rows;

  /*
    Se já existe saída, esse turno está fechado.
  */

  const possuiSaida = batidas.some(
    (ponto) => ponto.tipo === "saida"
  );

  if (possuiSaida) {
    return null;
  }

  /*
    Segurança: um turno normal possui no máximo:

    1 - entrada
    2 - intervalo_inicio
    3 - intervalo_fim
    4 - saida
  */

  return {
    entrada,
    batidas,
  };
}

/* =========================================
   STATUS DAS BATIDAS
   MULTIEMPRESA
========================================= */

exports.statusBatidas = async (req, res) => {
  try {
    await garantirTabelas();

    const funcionarioId = Number(
      req.params.funcionario_id
    );

    /*
      Para GET vamos receber empresa_id pela query:

      /status-batidas/5?empresa_id=1
    */
    const empresaId = Number(
      req.query.empresa_id
    );

    if (
      !Number.isInteger(funcionarioId) ||
      funcionarioId <= 0
    ) {
      return res.status(400).json({
        error: "Funcionário inválido.",
      });
    }

    if (
      !Number.isInteger(empresaId) ||
      empresaId <= 0
    ) {
      return res.status(400).json({
        error: "Empresa não informada.",
      });
    }

    /* =========================================
       EMPRESA
    ========================================= */

    const empresa = await buscarEmpresaAtiva(
      empresaId
    );

    if (!empresa) {
      return res.status(404).json({
        error: "Empresa não encontrada ou desativada.",
      });
    }

    /* =========================================
       FUNCIONÁRIO
    ========================================= */

    const funcionario =
      await buscarFuncionarioDaEmpresa(
        funcionarioId,
        empresaId
      );

    if (!funcionario) {
      return res.status(404).json({
        error: "Funcionário não encontrado.",
      });
    }

    /* =========================================
       BUSCAR TURNO ABERTO
    ========================================= */

    const turno = await buscarTurnoAberto(
      funcionarioId,
      empresaId
    );

    /* =========================================
       SEM TURNO
    ========================================= */

    if (!turno) {
      return res.json({
        ok: true,

        funcionario_id: funcionario.id,
        funcionario_nome: funcionario.nome,

        empresa_id: empresa.id,

        empresa_nome:
          empresa.nome_fantasia ||
          empresa.nome,

        turno_aberto: false,

        proxima_batida: "entrada",

        batidas: [],
      });
    }

    /*
      Segurança adicional.

      buscarTurnoAberto ainda trabalha pelo
      funcionário. Conferimos a empresa dos
      pontos encontrados.
    */
    const quantidade =
      turno.batidas.length;

    let proximaBatida = null;

    if (quantidade === 1) {
      proximaBatida = "intervalo_inicio";
    } else if (quantidade === 2) {
      proximaBatida = "intervalo_fim";
    } else if (quantidade === 3) {
      proximaBatida = "saida";
    }

    return res.json({
      ok: true,

      funcionario_id: funcionario.id,
      funcionario_nome: funcionario.nome,

      empresa_id: empresa.id,

      empresa_nome:
        empresa.nome_fantasia ||
        empresa.nome,

      turno_aberto: quantidade < 4,

      proxima_batida: proximaBatida,

      batidas: turno.batidas,
    });

  } catch (err) {
    console.error(
      "Erro ao consultar status das batidas:",
      err
    );

    return res.status(500).json({
      error: "Erro ao consultar status das batidas.",
    });
  }
};

/* =========================================
   BATER PONTO AUTOMATICAMENTE
   MULTIEMPRESA
========================================= */
exports.auto = async (req, res) => {
  try {
    await garantirTabelas();

    const funcionarioId = Number(req.body.funcionario_id);
    const empresaId = Number(req.body.empresa_id);

    /* =========================================
       VALIDAÇÕES
    ========================================= */

    if (
      !Number.isInteger(funcionarioId) ||
      funcionarioId <= 0
    ) {
      return res.status(400).json({
        error: "Funcionário inválido.",
      });
    }

    if (
      !Number.isInteger(empresaId) ||
      empresaId <= 0
    ) {
      return res.status(400).json({
        error: "Empresa não informada.",
      });
    }

    /* =========================================
       VERIFICAR EMPRESA
    ========================================= */

    const empresa = await buscarEmpresaAtiva(empresaId);

    if (!empresa) {
      return res.status(404).json({
        error: "Empresa não encontrada ou desativada.",
      });
    }

    /* =========================================
       VERIFICAR FUNCIONÁRIO DA EMPRESA
    ========================================= */

    const funcionario =
      await buscarFuncionarioDaEmpresa(
        funcionarioId,
        empresaId
      );

    if (!funcionario) {
      return res.status(404).json({
        error: "Funcionário não encontrado.",
      });
    }

    /* =========================================
       BUSCAR TURNO ABERTO
    ========================================= */

    const turno = await buscarTurnoAberto(
      funcionarioId,
      empresaId
    );

    let tipo;

    /* =========================================
       DEFINIR PRÓXIMA BATIDA
    ========================================= */

    if (!turno) {
      tipo = "entrada";
    } else {
      const quantidade = turno.batidas.length;

      if (quantidade === 1) {
        tipo = "intervalo_inicio";
      } else if (quantidade === 2) {
        tipo = "intervalo_fim";
      } else if (quantidade === 3) {
        tipo = "saida";
      } else {
        return res.status(400).json({
          error: "Todas as batidas deste turno já foram realizadas.",
        });
      }
    }

    /* =========================================
       REGISTRAR BATIDA

       Agora empresa_id também é salvo.
    ========================================= */

    const { rows } = await pool.query(
      `
  INSERT INTO pontos (
    empresa_id,
    funcionario_id,
    tipo,
    marcado_em
  )

  VALUES (
    $1,
    $2,
    $3,
    NOW()
  )

  RETURNING
    id,
    empresa_id,
    funcionario_id,
    tipo,
    marcado_em
  `,
      [
        empresaId,
        funcionarioId,
        tipo,
      ]
    );

    const ponto = rows[0];

    /* =========================================
       RESPOSTA
    ========================================= */

    return res.status(201).json({
      ok: true,

      message: "Ponto registrado com sucesso.",

      empresa: {
        id: empresa.id,
        nome:
          empresa.nome_fantasia ||
          empresa.nome,
      },

      funcionario: {
        id: funcionario.id,
        nome: funcionario.nome,
      },

      ponto,
    });

  } catch (err) {
    console.error(
      "Erro ao registrar ponto automático:",
      err
    );

    return res.status(500).json({
      error: "Erro ao registrar ponto.",
    });
  }
};

/* =========================================
   BATER PONTO MANUAL PELOS BOTÕES
   MULTIEMPRESA
========================================= */
exports.bater = async (req, res) => {
  try {
    await garantirTabelas();

    const funcionarioId = Number(req.body.funcionario_id);
    const empresaId = Number(req.body.empresa_id);
    const tipo = String(req.body.tipo || "").trim().toLowerCase();

    /* =========================================
       VALIDAÇÕES
    ========================================= */

    if (!Number.isInteger(funcionarioId) || funcionarioId <= 0) {
      return res.status(400).json({
        error: "Funcionário inválido.",
      });
    }

    if (!Number.isInteger(empresaId) || empresaId <= 0) {
      return res.status(400).json({
        error: "Empresa não informada.",
      });
    }

    const tiposPermitidos = [
      "entrada",
      "intervalo_inicio",
      "intervalo_fim",
      "saida",
    ];

    if (!tiposPermitidos.includes(tipo)) {
      return res.status(400).json({
        error: "Tipo de ponto inválido.",
      });
    }

    /* =========================================
       VERIFICAR EMPRESA
    ========================================= */

    const empresa = await buscarEmpresaAtiva(empresaId);

    if (!empresa) {
      return res.status(404).json({
        error: "Empresa não encontrada ou desativada.",
      });
    }

    /* =========================================
       VERIFICAR FUNCIONÁRIO DA EMPRESA
    ========================================= */

    const funcionario = await buscarFuncionarioDaEmpresa(
      funcionarioId,
      empresaId
    );

    if (!funcionario) {
      return res.status(404).json({
        error: "Funcionário não encontrado.",
      });
    }

    /* =========================================
       BUSCAR TURNO ABERTO DA EMPRESA
    ========================================= */

    const turno = await buscarTurnoAberto(
      funcionarioId,
      empresaId
    );

    let ultimaBatida = null;

    if (turno && turno.batidas.length > 0) {
      ultimaBatida =
        turno.batidas[turno.batidas.length - 1].tipo;
    }

    /* =========================================
       PERMISSÕES DA SEQUÊNCIA

       Mantemos a regra que seu sistema já usa.
    ========================================= */

    const permissoes =
      getPermissoesPorUltimaBatida(ultimaBatida);

    if (!permissoes[tipo]) {
      return res.status(403).json({
        error: "Esta batida não está liberada agora.",
        ultima_batida: ultimaBatida,
        permissoes,
      });
    }

    /* =========================================
       DATA/HORA
    ========================================= */

    const marcado_em = dataHoraAgoraSQL();

    /* =========================================
       REGISTRAR PONTO COM EMPRESA
    ========================================= */

    const { rows } = await pool.query(
      `
      INSERT INTO pontos (
        empresa_id,
        funcionario_id,
        tipo,
        marcado_em
      )

      VALUES (
        $1,
        $2,
        $3,
        $4
      )

      RETURNING
        id,
        empresa_id,
        funcionario_id,
        tipo,
        marcado_em
      `,
      [
        empresaId,
        funcionarioId,
        tipo,
        marcado_em,
      ]
    );

    return res.json({
      ok: true,

      message: "Ponto registrado com sucesso.",

      empresa: {
        id: empresa.id,
        nome: empresa.nome_fantasia || empresa.nome,
      },

      funcionario: {
        id: funcionario.id,
        nome: funcionario.nome,
      },

      ponto: rows[0],
    });

  } catch (err) {
    console.error("Erro ao lançar ponto:", err);

    return res.status(500).json({
      error: "Erro ao lançar ponto.",
    });
  }
};

/* =========================================
   INSERIR PONTO MANUAL
   MULTIEMPRESA
========================================= */
exports.inserirManual = async (req, res) => {
  try {
    await garantirTabelas();

    const funcionarioId = Number(req.body.funcionario_id);
    const empresaId = Number(req.body.empresa_id);

    const tipo = String(req.body.tipo || "")
      .trim()
      .toLowerCase();

    const data = String(req.body.data || "").trim();
    const hora = String(req.body.hora || "").trim();

    /* =========================================
       VALIDAR FUNCIONÁRIO
    ========================================= */

    if (
      !Number.isInteger(funcionarioId) ||
      funcionarioId <= 0
    ) {
      return res.status(400).json({
        error: "Funcionário inválido.",
      });
    }

    /* =========================================
       VALIDAR EMPRESA
    ========================================= */

    if (
      !Number.isInteger(empresaId) ||
      empresaId <= 0
    ) {
      return res.status(400).json({
        error: "Empresa não informada.",
      });
    }

    /* =========================================
       VALIDAR TIPO
    ========================================= */

    const tiposPermitidos = [
      "entrada",
      "intervalo_inicio",
      "intervalo_fim",
      "saida",
    ];

    if (!tiposPermitidos.includes(tipo)) {
      return res.status(400).json({
        error: "Tipo de ponto inválido.",
      });
    }

    /* =========================================
       VALIDAR DATA
       formato: YYYY-MM-DD
    ========================================= */

    if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) {
      return res.status(400).json({
        error: "Data inválida. Use YYYY-MM-DD.",
      });
    }

    /* =========================================
       VALIDAR HORA
       formato: HH:MM
    ========================================= */

    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(hora)) {
      return res.status(400).json({
        error: "Hora inválida. Use HH:MM.",
      });
    }

    /* =========================================
       VERIFICAR EMPRESA
    ========================================= */

    const empresa = await buscarEmpresaAtiva(
      empresaId
    );

    if (!empresa) {
      return res.status(404).json({
        error:
          "Empresa não encontrada ou desativada.",
      });
    }

    /* =========================================
       VERIFICAR FUNCIONÁRIO DA EMPRESA
    ========================================= */

    const funcionario =
      await buscarFuncionarioDaEmpresa(
        funcionarioId,
        empresaId
      );

    if (!funcionario) {
      return res.status(404).json({
        error: "Funcionário não encontrado.",
      });
    }

    /* =========================================
       DATA/HORA DA BATIDA

       IMPORTANTE:
       Aqui a data enviada é a data real que será
       gravada na batida.
    ========================================= */

    const marcadoEm = `${data} ${hora}:00`;

    /* =========================================
       REGISTRAR PONTO
    ========================================= */

    const { rows } = await pool.query(
      `
      INSERT INTO pontos (
        empresa_id,
        funcionario_id,
        tipo,
        marcado_em
      )

      VALUES (
        $1,
        $2,
        $3,
        $4::timestamp
      )

      RETURNING
        id,
        empresa_id,
        funcionario_id,
        tipo,
        marcado_em
      `,
      [
        empresaId,
        funcionarioId,
        tipo,
        marcadoEm,
      ]
    );

    return res.status(201).json({
      ok: true,

      message:
        "Ponto manual registrado com sucesso.",

      empresa: {
        id: empresa.id,
        nome:
          empresa.nome_fantasia ||
          empresa.nome,
      },

      funcionario: {
        id: funcionario.id,
        nome: funcionario.nome,
      },

      ponto: rows[0],
    });

  } catch (err) {
    console.error(
      "Erro ao inserir ponto manual:",
      err
    );

    return res.status(500).json({
      error: "Erro ao inserir ponto manual.",
    });
  }
};

/* =========================================
   AJUSTAR
   MULTIEMPRESA
========================================= */
exports.ajustar = async (req, res) => {
  const client = await pool.connect();

  try {
    await garantirTabelas();
    await client.query("BEGIN");

    const {
      funcionario_id,
      empresa_id,
      data,

      ids_originais = {},

      entrada,
      intervalo,
      retorno,
      saida,

      falta = false,
      folga = false,
      ferias = false,

      falta_justificada = false,
      justificativa_falta = "",

      feriado = false,
    } = req.body;

    const funcionarioId = Number(funcionario_id);
    const empresaId = Number(empresa_id);

    /* =========================================
       VALIDAÇÕES
    ========================================= */

    if (
      !Number.isInteger(funcionarioId) ||
      funcionarioId <= 0
    ) {
      await client.query("ROLLBACK");

      return res.status(400).json({
        error: "Funcionário inválido.",
      });
    }

    if (
      !Number.isInteger(empresaId) ||
      empresaId <= 0
    ) {
      await client.query("ROLLBACK");

      return res.status(400).json({
        error: "Empresa não informada.",
      });
    }

    if (!data) {
      await client.query("ROLLBACK");

      return res.status(400).json({
        error: "Data é obrigatória.",
      });
    }

    const dataISO = dataBRparaISO(data);

    if (!dataISO) {
      await client.query("ROLLBACK");

      return res.status(400).json({
        error: "Data inválida.",
      });
    }

    /* =========================================
       VERIFICAR EMPRESA
    ========================================= */

    const { rows: empresas } = await client.query(
      `
      SELECT
        id,
        nome,
        nome_fantasia,
        ativo

      FROM empresas

      WHERE id = $1
        AND ativo = true

      LIMIT 1
      `,
      [empresaId]
    );

    if (empresas.length === 0) {
      await client.query("ROLLBACK");

      return res.status(404).json({
        error: "Empresa não encontrada ou desativada.",
      });
    }

    const empresa = empresas[0];

    /* =========================================
       VERIFICAR FUNCIONÁRIO DA EMPRESA
    ========================================= */

    const { rows: funcionarios } = await client.query(
      `
      SELECT
        id,
        empresa_id,
        nome,
        cpf,
        ativo

      FROM funcionarios

      WHERE id = $1
        AND empresa_id = $2

      LIMIT 1
      `,
      [
        funcionarioId,
        empresaId,
      ]
    );

    if (funcionarios.length === 0) {
      await client.query("ROLLBACK");

      return res.status(404).json({
        error: "Funcionário não encontrado.",
      });
    }

    const funcionario = funcionarios[0];

    /* =========================================
       FLAGS
    ========================================= */

    const faltaBool = !!falta;
    const folgaBool = !!folga;
    const feriasBool = !!ferias;

    const faltaJustificadaBool =
      !!falta_justificada;

    const feriadoBool = !!feriado;

    const {
      entrada_id,
      intervalo_inicio_id,
      intervalo_fim_id,
      saida_id,
    } = ids_originais;

    /* =========================================
       SALVAR AJUSTES DO DIA
    ========================================= */

    await client.query(
      `
      INSERT INTO faltas_ajustes (
  empresa_id,
  funcionario_id,
  data,
  falta,
  folga,
  ferias,
  falta_justificada,
  justificativa_falta,
  feriado,
  updated_at
)

VALUES (
  $1,
  $2,
  $3,
  $4,
  $5,
  $6,
  $7,
  $8,
  $9,
  NOW()
)

ON CONFLICT (funcionario_id, data)

DO UPDATE SET
  empresa_id = EXCLUDED.empresa_id,
  falta = EXCLUDED.falta,
  folga = EXCLUDED.folga,
  ferias = EXCLUDED.ferias,
  falta_justificada =
    EXCLUDED.falta_justificada,
  justificativa_falta =
    EXCLUDED.justificativa_falta,
  feriado = EXCLUDED.feriado,
  updated_at = NOW()
      `,
      [
        empresaId,
        funcionarioId,
        dataISO,

        faltaBool,
        folgaBool,
        feriasBool,

        faltaJustificadaBool,

        faltaJustificadaBool
          ? String(
            justificativa_falta || ""
          ).trim()
          : null,

        feriadoBool,
      ]
    );

    /* =========================================
       FALTA / FOLGA / FÉRIAS /
       FALTA JUSTIFICADA
    ========================================= */

    if (
      faltaBool ||
      folgaBool ||
      feriasBool ||
      faltaJustificadaBool
    ) {
      /*
        IMPORTANTE:

        Agora só remove pontos que pertencem
        à empresa correta.
      */

      await client.query(
        `
  DELETE FROM pontos

  WHERE funcionario_id = $1
    AND empresa_id = $2
    AND marcado_em::date = $3::date
  `,
        [
          funcionarioId,
          empresaId,
          dataISO,
        ]
      );

      await client.query("COMMIT");

      return res.json({
        ok: true,

        empresa_id: empresaId,
        funcionario_id: funcionarioId,

        falta: faltaBool,
        folga: folgaBool,
        ferias: feriasBool,

        falta_justificada:
          faltaJustificadaBool,

        justificativa_falta:
          faltaJustificadaBool
            ? String(
              justificativa_falta || ""
            ).trim()
            : "",

        feriado: feriadoBool,

        ids_originais: {},

        message: faltaBool
          ? "Falta registrada com sucesso."
          : folgaBool
            ? "Folga registrada com sucesso."
            : feriasBool
              ? "Férias registrada com sucesso."
              : "Falta justificada registrada com sucesso.",
      });
    }

    /* =========================================
       ATUALIZAR OU CRIAR PONTO
    ========================================= */

    async function atualizarOuCriar(
      idExistente,
      tipoPonto,
      horaPonto,
      adicionarDias = 0
    ) {
      /* =====================================
         HORÁRIO FOI REMOVIDO
      ===================================== */

      if (!horaPonto) {
        if (idExistente) {
          await client.query(
            `
            DELETE FROM pontos

            WHERE id = $1
              AND funcionario_id = $2
              AND empresa_id = $3
            `,
            [
              idExistente,
              funcionarioId,
              empresaId,
            ]
          );
        }

        return null;
      }

      /* =====================================
         MONTAR DATA/HORA

         Preserva sua regra da madrugada.
      ===================================== */

      const dataHora =
        montarDataHoraComDia(
          data,
          horaPonto,
          adicionarDias
        );

      /* =====================================
         ATUALIZAR PONTO EXISTENTE
      ===================================== */

      if (idExistente) {
        const result = await client.query(
          `
          UPDATE pontos

          SET
            marcado_em = $1,
            tipo = $2,
            empresa_id = $3

          WHERE id = $4
            AND funcionario_id = $5
            AND empresa_id = $3

          RETURNING id
          `,
          [
            dataHora,
            tipoPonto,
            empresaId,
            idExistente,
            funcionarioId,
          ]
        );

        /*
          Segurança:

          Se alguém mandar ID de um ponto
          pertencente a outra empresa,
          não alteramos.
        */

        if (result.rowCount === 0) {
          throw new Error(
            "Ponto não encontrado para este funcionário e empresa."
          );
        }

        return idExistente;
      }

      /* =====================================
         CRIAR NOVO PONTO
      ===================================== */

      const { rows } = await client.query(
        `
        INSERT INTO pontos (
          empresa_id,
          funcionario_id,
          tipo,
          marcado_em
        )

        VALUES (
          $1,
          $2,
          $3,
          $4
        )

        RETURNING id
        `,
        [
          empresaId,
          funcionarioId,
          tipoPonto,
          dataHora,
        ]
      );

      return rows[0].id;
    }

    /* =========================================
       NORMALIZAR HORÁRIOS
    ========================================= */

    const horas = {
      entrada: normalizarHora(entrada),

      intervalo:
        normalizarHora(intervalo),

      retorno:
        normalizarHora(retorno),

      saida:
        normalizarHora(saida),
    };

    /* =========================================
       IDENTIFICAR VIRADA DA MEIA-NOITE

       MANTIVEMOS SUA REGRA.
    ========================================= */

    function passouMeiaNoite(
      horaAnterior,
      horaAtual
    ) {
      if (!horaAnterior || !horaAtual) {
        return false;
      }

      return horaAtual < horaAnterior;
    }

    const dias = {
      entrada: 0,
      intervalo: 0,
      retorno: 0,
      saida: 0,
    };

    /* =========================================
       INTERVALO
    ========================================= */

    if (
      passouMeiaNoite(
        horas.entrada,
        horas.intervalo
      )
    ) {
      dias.intervalo = 1;
    }

    /* =========================================
       RETORNO
    ========================================= */

    if (
      passouMeiaNoite(
        horas.intervalo ||
        horas.entrada,

        horas.retorno
      )
    ) {
      dias.retorno = 1;
    }

    /* =========================================
       SAÍDA
    ========================================= */

    const ultimaHora =
      horas.retorno ||
      horas.intervalo ||
      horas.entrada;

    if (
      passouMeiaNoite(
        ultimaHora,
        horas.saida
      )
    ) {
      dias.saida = 1;
    }

    /*
      Exemplo:

      data = 26/08/2026

      entrada = 17:30
      saída   = 05:30

      resultado:

      entrada:
      26/08/2026 17:30

      saída:
      27/08/2026 05:30

      Mas continua pertencendo à jornada
      iniciada no dia 26.
    */

    /* =========================================
       SALVAR HORÁRIOS
    ========================================= */

    const novosIds = {
      entrada_id:
        await atualizarOuCriar(
          entrada_id,
          "entrada",
          entrada,
          dias.entrada
        ),

      intervalo_inicio_id:
        await atualizarOuCriar(
          intervalo_inicio_id,
          "intervalo_inicio",
          intervalo,
          dias.intervalo
        ),

      intervalo_fim_id:
        await atualizarOuCriar(
          intervalo_fim_id,
          "intervalo_fim",
          retorno,
          dias.retorno
        ),

      saida_id:
        await atualizarOuCriar(
          saida_id,
          "saida",
          saida,
          dias.saida
        ),
    };

    /* =========================================
       LIMPAR FLAGS
    ========================================= */

    await client.query(
      `
      UPDATE faltas_ajustes

      SET
        falta = false,
        folga = false,
        ferias = false,

        falta_justificada = false,

        justificativa_falta = null,

        feriado = $4,

        updated_at = NOW()

      WHERE funcionario_id = $1
    AND empresa_id = $2
    AND data = $3
      `,
      [
        funcionarioId,
        empresaId,
        dataISO,
        feriadoBool,
      ]
    );

    /* =========================================
       COMMIT
    ========================================= */

    await client.query("COMMIT");

    return res.json({
      ok: true,

      empresa: {
        id: empresa.id,

        nome:
          empresa.nome_fantasia ||
          empresa.nome,
      },

      funcionario: {
        id: funcionario.id,
        nome: funcionario.nome,
      },

      falta: false,
      folga: false,
      ferias: false,

      falta_justificada: false,

      justificativa_falta: "",

      feriado: feriadoBool,

      ids_originais: novosIds,

      message:
        "Horários ajustados com sucesso.",
    });

  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch (_) { }

    console.error(
      "Erro ao ajustar horários:",
      err
    );

    return res.status(500).json({
      error:
        err.message ||
        "Erro ao ajustar horários.",
    });

  } finally {
    client.release();
  }
};

/* =========================================
   LIMPAR BATIDAS DO DIA
   MULTIEMPRESA
========================================= */
exports.limparBatidasDoDia = async (req, res) => {
  try {
    await garantirTabelas();

    const funcionarioId = Number(
      req.body.funcionario_id
    );

    const empresaId = Number(
      req.body.empresa_id
    );

    const { data } = req.body;

    /* =========================================
       VALIDAR FUNCIONÁRIO
    ========================================= */

    if (
      !Number.isInteger(funcionarioId) ||
      funcionarioId <= 0
    ) {
      return res.status(400).json({
        error: "Funcionário inválido.",
      });
    }

    /* =========================================
       VALIDAR EMPRESA
    ========================================= */

    if (
      !Number.isInteger(empresaId) ||
      empresaId <= 0
    ) {
      return res.status(400).json({
        error: "Empresa não informada.",
      });
    }

    if (!data) {
      return res.status(400).json({
        error: "Data é obrigatória.",
      });
    }

    /* =========================================
       CONVERTER DATA
    ========================================= */

    const dataISO = dataBRparaISO(data);

    if (!dataISO) {
      return res.status(400).json({
        error: "Data inválida.",
      });
    }

    /* =========================================
       VERIFICAR EMPRESA
    ========================================= */

    const empresa = await buscarEmpresaAtiva(
      empresaId
    );

    if (!empresa) {
      return res.status(404).json({
        error:
          "Empresa não encontrada ou desativada.",
      });
    }

    /* =========================================
       VERIFICAR FUNCIONÁRIO DA EMPRESA
    ========================================= */

    const funcionario =
      await buscarFuncionarioDaEmpresa(
        funcionarioId,
        empresaId
      );

    if (!funcionario) {
      return res.status(404).json({
        error: "Funcionário não encontrado.",
      });
    }

    /* =========================================
       EXCLUIR SOMENTE DA EMPRESA CORRETA
    ========================================= */

    const result = await pool.query(
      `
      DELETE FROM pontos

      WHERE funcionario_id = $1
        AND empresa_id = $2
        AND marcado_em::date = $3::date
      `,
      [
        funcionarioId,
        empresaId,
        dataISO,
      ]
    );

    return res.json({
      ok: true,

      empresa_id: empresaId,
      funcionario_id: funcionarioId,

      removidas: result.rowCount || 0,

      message:
        "Batidas do dia removidas com sucesso.",
    });

  } catch (err) {
    console.error(
      "Erro ao limpar batidas do dia:",
      err
    );

    return res.status(500).json({
      error:
        "Erro ao limpar batidas do dia.",
    });
  }
};

/* =========================================
   LANÇAR HORÁRIO PADRÃO NO MÊS
   MULTIEMPRESA + TURNO NOTURNO
========================================= */
exports.lancarHorarioPadraoMes = async (req, res) => {
  const client = await pool.connect();

  try {
    await garantirTabelas();
    await client.query("BEGIN");

    const {
      funcionario_id,
      empresa_id,
      mes,
      ano,
    } = req.body;

    const funcionarioId = Number(funcionario_id);
    const empresaId = Number(empresa_id);
    const mesNum = Number(mes);
    const anoNum = Number(ano);

    /* =========================================
       VALIDAÇÕES
    ========================================= */

    if (
      !Number.isInteger(funcionarioId) ||
      funcionarioId <= 0
    ) {
      await client.query("ROLLBACK");

      return res.status(400).json({
        error: "Funcionário inválido.",
      });
    }

    if (
      !Number.isInteger(empresaId) ||
      empresaId <= 0
    ) {
      await client.query("ROLLBACK");

      return res.status(400).json({
        error: "Empresa não informada.",
      });
    }

    if (
      !Number.isInteger(mesNum) ||
      !Number.isInteger(anoNum)
    ) {
      await client.query("ROLLBACK");

      return res.status(400).json({
        error: "Mês e ano são obrigatórios.",
      });
    }

    if (mesNum < 1 || mesNum > 12) {
      await client.query("ROLLBACK");

      return res.status(400).json({
        error: "Mês inválido.",
      });
    }

    /* =========================================
       VERIFICAR EMPRESA
    ========================================= */

    const { rows: empresas } = await client.query(
      `
      SELECT
        id,
        nome,
        nome_fantasia,
        ativo

      FROM empresas

      WHERE id = $1
        AND ativo = true

      LIMIT 1
      `,
      [empresaId]
    );

    if (empresas.length === 0) {
      await client.query("ROLLBACK");

      return res.status(404).json({
        error: "Empresa não encontrada ou desativada.",
      });
    }

    const empresa = empresas[0];

    /* =========================================
       BUSCAR FUNCIONÁRIO DA EMPRESA
    ========================================= */

    const { rows: funcionarios } =
      await client.query(
        `
        SELECT
          id,
          empresa_id,
          nome,
          chegada,
          intervalo_inicio,
          intervalo_fim,
          saida

        FROM funcionarios

        WHERE id = $1
          AND empresa_id = $2
          AND ativo = true

        LIMIT 1
        `,
        [
          funcionarioId,
          empresaId,
        ]
      );

    if (funcionarios.length === 0) {
      await client.query("ROLLBACK");

      return res.status(404).json({
        error: "Funcionário não encontrado.",
      });
    }

    const funcionario = funcionarios[0];

    /* =========================================
       HORÁRIO PADRÃO
    ========================================= */

    const horaEntrada =
      normalizarHora(funcionario.chegada);

    const horaIntervaloInicio =
      normalizarHora(
        funcionario.intervalo_inicio
      );

    const horaIntervaloFim =
      normalizarHora(
        funcionario.intervalo_fim
      );

    const horaSaida =
      normalizarHora(funcionario.saida);

    if (
      !horaEntrada ||
      !horaIntervaloInicio ||
      !horaIntervaloFim ||
      !horaSaida
    ) {
      await client.query("ROLLBACK");

      return res.status(400).json({
        error:
          "O funcionário não possui horário padrão completo cadastrado.",
      });
    }

    /* =========================================
       CALCULAR VIRADA DA MEIA-NOITE
    ========================================= */

    function passouMeiaNoite(
      horaAnterior,
      horaAtual
    ) {
      if (!horaAnterior || !horaAtual) {
        return false;
      }

      return horaAtual < horaAnterior;
    }

    let diaEntrada = 0;
    let diaIntervaloInicio = 0;
    let diaIntervaloFim = 0;
    let diaSaida = 0;

    if (
      passouMeiaNoite(
        horaEntrada,
        horaIntervaloInicio
      )
    ) {
      diaIntervaloInicio = 1;
    }

    /*
      Se o intervalo já ocorreu no dia seguinte,
      o retorno também precisa permanecer nele,
      mesmo que numericamente a hora do retorno
      seja maior que a hora do intervalo.
    */

    diaIntervaloFim = diaIntervaloInicio;

    if (
      passouMeiaNoite(
        horaIntervaloInicio,
        horaIntervaloFim
      )
    ) {
      diaIntervaloFim =
        diaIntervaloInicio + 1;
    }

    /*
      A saída começa no mesmo "dia lógico"
      do retorno.
    */

    diaSaida = diaIntervaloFim;

    if (
      passouMeiaNoite(
        horaIntervaloFim,
        horaSaida
      )
    ) {
      diaSaida =
        diaIntervaloFim + 1;
    }

    /* =========================================
       QUANTIDADE DE DIAS DO MÊS
    ========================================= */

    const diasNoMes = new Date(
      anoNum,
      mesNum,
      0
    ).getDate();

    let diasInseridos = 0;
    let diasIgnorados = 0;

    const detalhes = [];

    /* =========================================
       PERCORRER MÊS
    ========================================= */

    for (
      let dia = 1;
      dia <= diasNoMes;
      dia++
    ) {
      const dataISO =
        `${anoNum}-${String(mesNum).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;

      /* =====================================
         VERIFICAR PONTOS EXISTENTES

         Consideramos a DATA DA JORNADA.
      ===================================== */

      const { rows: pontosExistentes } =
        await client.query(
          `
          SELECT id

          FROM pontos

          WHERE funcionario_id = $1
            AND empresa_id = $2
            AND tipo = 'entrada'
            AND marcado_em::date = $3::date

          LIMIT 1
          `,
          [
            funcionarioId,
            empresaId,
            dataISO,
          ]
        );

      if (pontosExistentes.length > 0) {
        diasIgnorados++;

        detalhes.push({
          data: dataISO,
          status: "ignorado",
          motivo: "Já possui ponto lançado",
        });

        continue;
      }

      /* =====================================
         FALTA / FOLGA / FÉRIAS
      ===================================== */

      const { rows: ajusteExistente } =
        await client.query(
          `
    SELECT
      id,
      falta,
      folga,
      ferias,
      falta_justificada

    FROM faltas_ajustes

    WHERE funcionario_id = $1
      AND empresa_id = $2
      AND data = $3::date

    LIMIT 1
    `,
          [
            funcionarioId,
            empresaId,
            dataISO,
          ]
        );

      if (
        ajusteExistente.length > 0 &&
        (
          ajusteExistente[0].falta ||
          ajusteExistente[0].folga ||
          ajusteExistente[0].ferias ||
          ajusteExistente[0].falta_justificada
        )
      ) {
        diasIgnorados++;

        const ajuste = ajusteExistente[0];

        detalhes.push({
          data: dataISO,
          status: "ignorado",

          motivo: ajuste.falta
            ? "Dia marcado como falta"
            : ajuste.folga
              ? "Dia marcado como folga"
              : ajuste.ferias
                ? "Dia marcado como férias"
                : "Dia marcado como falta justificada",
        });

        continue;
      }

      /* =====================================
         ATESTADO
      ===================================== */

      const { rows: atestadoExistente } =
        await client.query(
          `
          SELECT id

          FROM atestados

          WHERE funcionario_id = $1
            AND $2::date
                BETWEEN data_inicio::date
                AND data_fim::date

          LIMIT 1
          `,
          [
            funcionarioId,
            dataISO,
          ]
        );

      if (atestadoExistente.length > 0) {
        diasIgnorados++;

        detalhes.push({
          data: dataISO,
          status: "ignorado",
          motivo: "Dia com atestado",
        });

        continue;
      }

      /* =====================================
         MONTAR DATAS/HORAS

         Usa a mesma lógica que já existe
         no ajuste manual.
      ===================================== */

      const entradaDataHora =
        montarDataHoraComDia(
          dataISO,
          horaEntrada,
          diaEntrada
        );

      const intervaloInicioDataHora =
        montarDataHoraComDia(
          dataISO,
          horaIntervaloInicio,
          diaIntervaloInicio
        );

      const intervaloFimDataHora =
        montarDataHoraComDia(
          dataISO,
          horaIntervaloFim,
          diaIntervaloFim
        );

      const saidaDataHora =
        montarDataHoraComDia(
          dataISO,
          horaSaida,
          diaSaida
        );

      /* =====================================
         INSERIR AS 4 BATIDAS
      ===================================== */

      await client.query(
        `
        INSERT INTO pontos (
          empresa_id,
          funcionario_id,
          tipo,
          marcado_em
        )

        VALUES
          ($1, $2, 'entrada', $3),
          ($1, $2, 'intervalo_inicio', $4),
          ($1, $2, 'intervalo_fim', $5),
          ($1, $2, 'saida', $6)
        `,
        [
          empresaId,
          funcionarioId,

          entradaDataHora,
          intervaloInicioDataHora,
          intervaloFimDataHora,
          saidaDataHora,
        ]
      );

      /* =====================================
         LIMPAR AJUSTES
      ===================================== */

      await client.query(
        `
  INSERT INTO faltas_ajustes (
    empresa_id,
    funcionario_id,
    data,
    falta,
    folga,
    ferias,
    falta_justificada,
    justificativa_falta,
    feriado,
    updated_at
  )

  VALUES (
    $1,
    $2,
    $3::date,
    false,
    false,
    false,
    false,
    null,
    false,
    NOW()
  )

  ON CONFLICT (
    funcionario_id,
    data
  )

  DO UPDATE SET
    empresa_id = EXCLUDED.empresa_id,
    falta = false,
    folga = false,
    ferias = false,
    falta_justificada = false,
    justificativa_falta = null,
    updated_at = NOW()
  `,
        [
          empresaId,
          funcionarioId,
          dataISO,
        ]
      );

      diasInseridos++;

      detalhes.push({
        data: dataISO,
        status: "inserido",
      });
    }

    /* =========================================
       FINALIZAR
    ========================================= */

    await client.query("COMMIT");

    return res.json({
      ok: true,

      message:
        "Horário padrão lançado com sucesso.",

      empresa: {
        id: empresa.id,

        nome:
          empresa.nome_fantasia ||
          empresa.nome,
      },

      funcionario: funcionario.nome,

      dias_inseridos: diasInseridos,
      dias_ignorados: diasIgnorados,

      detalhes,
    });

  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch (_) { }

    console.error(
      "Erro ao lançar horário padrão do mês:",
      err
    );

    return res.status(500).json({
      error:
        "Erro ao lançar horário padrão do mês.",
    });

  } finally {
    client.release();
  }
};

/* =========================================
   BUSCAR FUNCIONÁRIO POR CPF
   MULTIEMPRESA
========================================= */
exports.buscarPorCPF = async (req, res) => {
  try {
    await garantirTabelas();

    /* =========================================
       CPF
    ========================================= */

    const cpf = onlyDigits(req.params.cpf);

    /*
      Como esta é uma rota GET pública,
      receberemos a empresa pela query:

      /api/ponto/cpf/12345678901?empresa_id=1
    */

    const empresaId = Number(req.query.empresa_id);

    /* =========================================
       VALIDAR CPF
    ========================================= */

    if (!cpf) {
      return res.status(400).json({
        error: "CPF inválido.",
      });
    }

    /* =========================================
       VALIDAR EMPRESA
    ========================================= */

    if (
      !Number.isInteger(empresaId) ||
      empresaId <= 0
    ) {
      return res.status(400).json({
        error: "Empresa não informada.",
      });
    }

    /* =========================================
       VERIFICAR EMPRESA
    ========================================= */

    const empresa = await buscarEmpresaAtiva(
      empresaId
    );

    if (!empresa) {
      return res.status(404).json({
        error: "Empresa não encontrada ou desativada.",
      });
    }

    /* =========================================
       BUSCAR FUNCIONÁRIO

       IMPORTANTE:
       CPF + empresa_id
    ========================================= */

    const { rows } = await pool.query(
      `
      SELECT
        f.id,
        f.empresa_id,
        f.nome,
        f.cpf,
        f.cnpj_empresa,
        f.chegada,
        f.intervalo_inicio,
        f.intervalo_fim,
        f.saida,
        f.ativo,

        fc.nome AS funcao_nome

      FROM funcionarios f

      LEFT JOIN funcoes fc
        ON fc.id = f.funcao_id

      WHERE f.cpf = $1
        AND f.empresa_id = $2
        AND f.ativo = true

      LIMIT 1
      `,
      [
        cpf,
        empresaId,
      ]
    );

    /* =========================================
       NÃO ENCONTROU
    ========================================= */

    if (rows.length === 0) {
      return res.status(404).json({
        error: "Funcionário não encontrado.",
      });
    }

    const funcionario = rows[0];

    /* =========================================
       RESPOSTA
    ========================================= */

    return res.json({
      ok: true,

      empresa: {
        id: empresa.id,

        nome:
          empresa.nome_fantasia ||
          empresa.nome,
      },

      funcionario: {
        id: funcionario.id,
        empresa_id: funcionario.empresa_id,
        nome: funcionario.nome,
        cpf: funcionario.cpf,
        cnpj_empresa: funcionario.cnpj_empresa,
        funcao_nome: funcionario.funcao_nome,

        chegada: funcionario.chegada,
        intervalo_inicio:
          funcionario.intervalo_inicio,
        intervalo_fim:
          funcionario.intervalo_fim,
        saida: funcionario.saida,

        ativo: funcionario.ativo,
      },
    });

  } catch (err) {
    console.error(
      "Erro ao buscar funcionário por CPF:",
      err
    );

    return res.status(500).json({
      error: "Erro ao buscar funcionário por CPF.",
    });
  }
};