const pool = require("../database/pool");
const { onlyDigits } = require("../utils/cpf");

const {
  registrarLog,
} = require("../services/log.service");

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
      nome,
      cpf,
      empresa_id,
      ativo
    FROM funcionarios
    WHERE id = $1
      AND empresa_id = $2
      AND ativo = TRUE
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
========================================= */
async function garantirTabelaFuncionarios() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS funcionarios (
      id BIGSERIAL PRIMARY KEY,

      empresa_id BIGINT
        REFERENCES empresas(id)
        ON DELETE RESTRICT,

      nome VARCHAR(200) NOT NULL,
      cpf VARCHAR(20) NOT NULL,

      chegada TIME,
      intervalo_inicio TIME,
      intervalo_fim TIME,
      saida TIME,

      funcao_id BIGINT
        REFERENCES funcoes(id)
        ON DELETE SET NULL,

      cnpj_empresa VARCHAR(20),

      ativo BOOLEAN NOT NULL DEFAULT true,

      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
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
    ADD COLUMN IF NOT EXISTS funcao_id
    BIGINT REFERENCES funcoes(id)
    ON DELETE SET NULL
  `);

  await pool.query(`
    ALTER TABLE funcionarios
    ADD COLUMN IF NOT EXISTS cnpj_empresa
    VARCHAR(20)
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


/* =========================================
   GARANTE TABELA PONTOS
   + SUPORTE PARA BATIDAS OFFLINE
========================================= */
async function garantirTabelaPontos() {
  /* =====================================
     CRIAR TABELA CASO NÃO EXISTA
  ===================================== */

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

      marcado_em TIMESTAMP DEFAULT NOW(),

      offline_uuid UUID,

      origem VARCHAR(30)
        NOT NULL DEFAULT 'online',

      marcado_offline BOOLEAN
        NOT NULL DEFAULT FALSE,

      horario_dispositivo TIMESTAMP,

      sincronizado_em TIMESTAMP,

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


  /* =====================================
     EMPRESA
  ===================================== */

  await pool.query(`
    ALTER TABLE pontos
    ADD COLUMN IF NOT EXISTS empresa_id
    BIGINT REFERENCES empresas(id)
    ON DELETE RESTRICT
  `);


  /* =====================================
     UUID DA BATIDA OFFLINE

     Este UUID é criado no terminal.

     Ele impede que a mesma batida seja
     sincronizada duas vezes.
  ===================================== */

  await pool.query(`
    ALTER TABLE pontos
    ADD COLUMN IF NOT EXISTS offline_uuid
    UUID
  `);


  /* =====================================
     ORIGEM

     Exemplos:
     online
     offline
     manual
     automatico
  ===================================== */

  await pool.query(`
    ALTER TABLE pontos
    ADD COLUMN IF NOT EXISTS origem
    VARCHAR(30)
    NOT NULL DEFAULT 'online'
  `);


  /* =====================================
     IDENTIFICA SE FOI MARCADO SEM INTERNET
  ===================================== */

  await pool.query(`
    ALTER TABLE pontos
    ADD COLUMN IF NOT EXISTS marcado_offline
    BOOLEAN
    NOT NULL DEFAULT FALSE
  `);


  /* =====================================
     HORÁRIO ORIGINAL DO DISPOSITIVO

     Exemplo:

     funcionário bateu 08:00 sem internet
     internet voltou 09:30

     horario_dispositivo = 08:00
     sincronizado_em     = 09:30
  ===================================== */

  await pool.query(`
    ALTER TABLE pontos
    ADD COLUMN IF NOT EXISTS horario_dispositivo
    TIMESTAMP
  `);


  /* =====================================
     MOMENTO EM QUE CHEGOU AO SERVIDOR
  ===================================== */

  await pool.query(`
    ALTER TABLE pontos
    ADD COLUMN IF NOT EXISTS sincronizado_em
    TIMESTAMP
  `);


  /* =====================================
     ÍNDICES JÁ EXISTENTES
  ===================================== */

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
    ON pontos(
      empresa_id,
      funcionario_id
    )
  `);


  /* =====================================
     PROTEÇÃO CONTRA DUPLICIDADE OFFLINE

     Duas sincronizações com o mesmo UUID
     não poderão criar dois pontos.
  ===================================== */

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS
    idx_pontos_offline_uuid

    ON pontos(offline_uuid)

    WHERE offline_uuid IS NOT NULL
  `);
}


/* =========================================
   MIGRAR PONTOS ANTIGOS PARA EMPRESA
========================================= */
async function migrarEmpresaPontosAntigos() {
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
}


/* =========================================
   GARANTE TABELA FALTAS / AJUSTES
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

  await pool.query(`
    ALTER TABLE faltas_ajustes
    ADD COLUMN IF NOT EXISTS empresa_id
    BIGINT REFERENCES empresas(id)
    ON DELETE RESTRICT
  `);

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

  await pool.query(`
    UPDATE faltas_ajustes fa

    SET empresa_id = f.empresa_id

    FROM funcionarios f

    WHERE fa.funcionario_id = f.id
      AND fa.empresa_id IS NULL
      AND f.empresa_id IS NOT NULL
  `);

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS
    uq_faltas_ajustes_funcionario_data

    ON faltas_ajustes (
      funcionario_id,
      data
    )
  `);

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
========================================= */
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

      created_at TIMESTAMP DEFAULT NOW()
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

  await pool.query(`
    UPDATE atestados a

    SET empresa_id = f.empresa_id

    FROM funcionarios f

    WHERE a.funcionario_id = f.id
      AND a.empresa_id IS NULL
      AND f.empresa_id IS NOT NULL
  `);

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
  await migrarEmpresaPontosAntigos();
  await garantirTabelaFaltas();
  await garantirTabelaAtestados();
}


/* =========================================
   TIMEZONE
========================================= */
function agoraSP() {
  return new Date(
    new Date().toLocaleString(
      "en-US",
      {
        timeZone: "America/Sao_Paulo",
      }
    )
  );
}

function dataHojeISO() {
  const agora = agoraSP();

  const ano = agora.getFullYear();

  const mes = String(
    agora.getMonth() + 1
  ).padStart(2, "0");

  const dia = String(
    agora.getDate()
  ).padStart(2, "0");

  return `${ano}-${mes}-${dia}`;
}

function dataHoraAgoraSQL() {
  const agora = agoraSP();

  const data = dataHojeISO();

  const hora = String(
    agora.getHours()
  ).padStart(2, "0");

  const minuto = String(
    agora.getMinutes()
  ).padStart(2, "0");

  const segundo = String(
    agora.getSeconds()
  ).padStart(2, "0");

  return `${data} ${hora}:${minuto}:${segundo}`;
}


function montarDataHoraComDia(
  data,
  hora,
  adicionarDias = 0
) {
  if (!data || !hora) {
    return null;
  }

  let ano;
  let mes;
  let dia;

  if (String(data).includes("/")) {
    const partes =
      String(data).split("/");

    dia = Number(partes[0]);
    mes = Number(partes[1]);
    ano = Number(partes[2]);
  } else if (
    String(data).includes("-")
  ) {
    const partes =
      String(data).split("-");

    ano = Number(partes[0]);
    mes = Number(partes[1]);
    dia = Number(partes[2]);
  } else {
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
    dataObj.getDate() +
    adicionarDias
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

  return (
    `${anoFinal}-${mesFinal}-${diaFinal} ` +
    `${hora}:00`
  );
}


function dataBRparaISO(dataBR) {
  if (!dataBR) {
    return null;
  }

  const [d, m, a] =
    String(dataBR).split("/");

  if (!d || !m || !a) {
    return null;
  }

  return (
    `${a}-` +
    `${String(m).padStart(2, "0")}-` +
    `${String(d).padStart(2, "0")}`
  );
}


function normalizarHora(valor) {
  if (!valor) {
    return null;
  }

  const texto =
    String(valor).trim();

  if (texto.length >= 5) {
    return texto.slice(0, 5);
  }

  return null;
}


/* =========================================================
   BUSCAR TURNO ABERTO
========================================================= */
async function buscarTurnoAberto(
  funcionarioId,
  empresaId
) {
  const { rows } =
    await pool.query(
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
        AND marcado_em >=
            NOW() - INTERVAL '36 hours'

      ORDER BY
        marcado_em ASC,
        id ASC
      `,
      [
        funcionarioId,
        empresaId,
      ]
    );

  if (!rows.length) {
    return null;
  }

  let indiceUltimaSaida = -1;

  for (
    let i = rows.length - 1;
    i >= 0;
    i--
  ) {
    if (rows[i].tipo === "saida") {
      indiceUltimaSaida = i;
      break;
    }
  }

  const depoisDaUltimaSaida =
    rows.slice(
      indiceUltimaSaida + 1
    );

  if (!depoisDaUltimaSaida.length) {
    return null;
  }

  const indiceEntrada =
    depoisDaUltimaSaida.findIndex(
      (ponto) =>
        ponto.tipo === "entrada"
    );

  if (indiceEntrada === -1) {
    return null;
  }

  const batidas =
    depoisDaUltimaSaida.slice(
      indiceEntrada
    );

  if (!batidas.length) {
    return null;
  }

  return {
    entrada: batidas[0],
    batidas,
  };
}


/* =========================================
   PEGAR ÚLTIMA BATIDA
========================================= */
function obterUltimaBatidaDoTurno(
  turno
) {
  if (
    !turno ||
    !Array.isArray(turno.batidas) ||
    turno.batidas.length === 0
  ) {
    return null;
  }

  return turno.batidas[
    turno.batidas.length - 1
  ];
}


/* =========================================================
   PERMISSÕES
========================================================= */
function getPermissoesPorUltimaBatida(
  ultimaBatida
) {
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

  switch (ultimaBatida) {
    case "entrada":
      permissoes.intervalo_inicio =
        true;

      permissoes.saida =
        true;
      break;

    case "intervalo_inicio":
      permissoes.intervalo_fim =
        true;
      break;

    case "intervalo_fim":
      permissoes.intervalo_inicio =
        true;

      permissoes.saida =
        true;
      break;

    case "saida":
      permissoes.entrada =
        true;
      break;

    default:
      permissoes.entrada =
        true;
  }

  return permissoes;
}


/* =========================================
   RESUMO PARA FRONTEND
========================================= */
function montarResumoBatidas(turno) {
  const resumo = {
    entrada: null,
    intervalo_inicio: null,
    intervalo_fim: null,
    saida: null,
  };

  if (
    !turno ||
    !Array.isArray(turno.batidas)
  ) {
    return resumo;
  }

  for (
    const ponto of turno.batidas
  ) {
    switch (ponto.tipo) {
      case "entrada":
        resumo.entrada =
          ponto.marcado_em;
        break;

      case "intervalo_inicio":
        resumo.intervalo_inicio =
          ponto.marcado_em;
        break;

      case "intervalo_fim":
        resumo.intervalo_fim =
          ponto.marcado_em;
        break;

      case "saida":
        resumo.saida =
          ponto.marcado_em;
        break;

      default:
        break;
    }
  }

  return resumo;
}

/* =========================================================
   STATUS DAS BATIDAS
========================================================= */
exports.statusBatidas =
  async (req, res) => {
    try {
      await garantirTabelas();

      const funcionarioId =
        Number(
          req.params.funcionario_id
        );

      /*
        IMPORTANTE:
        empresa vem SEMPRE do JWT.
      */
      const empresaId =
        Number(
          req.user?.empresa_id
        );

      console.log(
        "========== STATUS BATIDAS =========="
      );

      console.log({
        funcionarioId,
        empresaId,
        user: req.user,
      });

      /* =====================================
         VALIDAÇÕES
      ===================================== */

      if (
        !Number.isInteger(
          funcionarioId
        ) ||
        funcionarioId <= 0
      ) {
        return res
          .status(400)
          .json({
            error:
              "Funcionário inválido.",
          });
      }

      if (
        !Number.isInteger(
          empresaId
        ) ||
        empresaId <= 0
      ) {
        return res
          .status(400)
          .json({
            error:
              "Empresa não informada.",
          });
      }

      /* =====================================
         EMPRESA
      ===================================== */

      const empresa =
        await buscarEmpresaAtiva(
          empresaId
        );

      if (!empresa) {
        return res
          .status(404)
          .json({
            error:
              "Empresa não encontrada ou desativada.",
          });
      }

      /* =====================================
         FUNCIONÁRIO
      ===================================== */

      const funcionario =
        await buscarFuncionarioDaEmpresa(
          funcionarioId,
          empresaId
        );

      if (!funcionario) {
        return res
          .status(404)
          .json({
            error:
              "Funcionário não encontrado.",
          });
      }

      /* =====================================
         TURNO
      ===================================== */

      const turno =
        await buscarTurnoAberto(
          funcionarioId,
          empresaId
        );

      const ultimaBatidaRegistro =
        obterUltimaBatidaDoTurno(
          turno
        );

      const ultimaBatida =
        ultimaBatidaRegistro?.tipo ||
        null;

      /* =====================================
         PERMISSÕES
      ===================================== */

      const permissoes =
        getPermissoesPorUltimaBatida(
          ultimaBatida
        );

      /* =====================================
         PRÓXIMA BATIDA
      ===================================== */

      let proximaBatida = null;

      if (permissoes.entrada) {
        proximaBatida =
          "entrada";
      } else if (
        permissoes.intervalo_fim
      ) {
        proximaBatida =
          "intervalo_fim";
      } else if (
        permissoes.intervalo_inicio
      ) {
        proximaBatida =
          "intervalo_inicio";
      } else if (
        permissoes.saida
      ) {
        proximaBatida =
          "saida";
      }

      const resumoBatidas =
        montarResumoBatidas(
          turno
        );

      console.log(
        "STATUS CALCULADO =>",
        {
          funcionario_id:
            funcionarioId,

          empresa_id:
            empresaId,

          turno_aberto:
            Boolean(turno),

          ultima_batida:
            ultimaBatida,

          permissoes,
        }
      );

      console.log(
        "====================================="
      );

      return res.json({
        ok: true,

        funcionario_id:
          funcionario.id,

        funcionario_nome:
          funcionario.nome,

        empresa_id:
          empresa.id,

        empresa_nome:
          empresa.nome_fantasia ||
          empresa.nome,

        turno_aberto:
          Boolean(turno),

        ultima_batida:
          ultimaBatida,

        proxima_batida:
          proximaBatida,

        permissoes,

        batidas:
          resumoBatidas,

        historico_turno:
          turno?.batidas || [],
      });

    } catch (err) {
      console.error(
        "Erro ao consultar status das batidas:",
        err
      );

      return res
        .status(500)
        .json({
          error:
            "Erro ao consultar status das batidas.",
        });
    }
  };


/* =========================================================
   BATER PONTO PELOS BOTÕES
========================================================= */
exports.bater =
  async (req, res) => {
    try {
      await garantirTabelas();

      const funcionarioId =
        Number(
          req.body.funcionario_id
        );

      /*
        SEGURANÇA:

        empresa NÃO vem do body.
        Vem exclusivamente do JWT.
      */
      const empresaId =
        Number(
          req.user?.empresa_id
        );

      const tipo =
        String(
          req.body.tipo || ""
        )
          .trim()
          .toLowerCase();

      console.log(
        "========== BATER PONTO =========="
      );

      console.log({
        funcionarioId,
        empresaId,
        tipo,
        body: req.body,
        user: req.user,
      });

      /* =====================================
         VALIDAÇÕES
      ===================================== */

      if (
        !Number.isInteger(
          funcionarioId
        ) ||
        funcionarioId <= 0
      ) {
        return res
          .status(400)
          .json({
            error:
              "Funcionário inválido.",
          });
      }

      if (
        !Number.isInteger(
          empresaId
        ) ||
        empresaId <= 0
      ) {
        return res
          .status(400)
          .json({
            error:
              "Empresa não informada.",
          });
      }

      const tiposPermitidos = [
        "entrada",
        "intervalo_inicio",
        "intervalo_fim",
        "saida",
      ];

      if (
        !tiposPermitidos.includes(
          tipo
        )
      ) {
        return res
          .status(400)
          .json({
            error:
              "Tipo de ponto inválido.",
          });
      }

      /* =====================================
         EMPRESA
      ===================================== */

      const empresa =
        await buscarEmpresaAtiva(
          empresaId
        );

      if (!empresa) {
        return res
          .status(404)
          .json({
            error:
              "Empresa não encontrada ou desativada.",
          });
      }

      /* =====================================
         FUNCIONÁRIO

         Aqui garantimos também que o
         funcionário pertence à empresa
         do terminal autenticado.
      ===================================== */

      const funcionario =
        await buscarFuncionarioDaEmpresa(
          funcionarioId,
          empresaId
        );

      if (!funcionario) {
        return res
          .status(404)
          .json({
            error:
              "Funcionário não encontrado nesta empresa.",
          });
      }

      /* =====================================
         ESTADO ANTES DA BATIDA
      ===================================== */

      const turno =
        await buscarTurnoAberto(
          funcionarioId,
          empresaId
        );

      const ultimaBatidaRegistro =
        obterUltimaBatidaDoTurno(
          turno
        );

      const ultimaBatida =
        ultimaBatidaRegistro?.tipo ||
        null;

      const permissoes =
        getPermissoesPorUltimaBatida(
          ultimaBatida
        );

      console.log(
        "ESTADO ANTES DA BATIDA =>",
        {
          ultima_batida:
            ultimaBatida,

          tipo_solicitado:
            tipo,

          permissoes,
        }
      );

      /* =====================================
         BLOQUEAR BATIDA INVÁLIDA
      ===================================== */

      if (!permissoes[tipo]) {
        console.log(
          "❌ BATIDA BLOQUEADA"
        );

        console.log(
          "================================="
        );

        return res
          .status(403)
          .json({
            ok: false,

            error:
              "Esta batida não está liberada agora.",

            tipo_solicitado:
              tipo,

            ultima_batida:
              ultimaBatida,

            permissoes,
          });
      }

      /* =====================================
         REGISTRAR PONTO
      ===================================== */

      const marcadoEm =
        dataHoraAgoraSQL();

      const { rows } =
        await pool.query(
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

      /*
        IMPORTANTE:

        Só agora "ponto" existe.

        No código anterior o registrarLog()
        estava antes deste INSERT e tentava
        acessar ponto.id e funcionario.nome
        antes deles existirem.
      */
      const ponto =
        rows[0];

      /* =====================================
         REGISTRAR LOG DA BATIDA
      ===================================== */

      const nomesBatidas = {
        entrada:
          "Entrada",

        intervalo_inicio:
          "Início do intervalo",

        intervalo_fim:
          "Retorno do intervalo",

        saida:
          "Saída",
      };

      await registrarLog({
        req,

        empresa_id:
          empresaId,

        funcionario_id:
          funcionario.id,

        tipo:
          "PONTO",

        acao:
          `PONTO_${tipo.toUpperCase()}`,

        descricao:
          `${funcionario.nome} registrou ${nomesBatidas[tipo]}.`,

        dados: {
          ponto_id:
            ponto.id,

          funcionario_id:
            funcionario.id,

          funcionario_nome:
            funcionario.nome,

          tipo:
            ponto.tipo,

          marcado_em:
            ponto.marcado_em,

          origem:
            "terminal_botoes",
        },
      });

      /* =====================================
         RECALCULAR PELO BANCO

         Não presumimos o estado.
         Consultamos novamente o banco depois
         da inserção.
      ===================================== */

      const turnoAtualizado =
        await buscarTurnoAberto(
          funcionarioId,
          empresaId
        );

      const ultimaAtualizadaRegistro =
        obterUltimaBatidaDoTurno(
          turnoAtualizado
        );

      const ultimaAtualizada =
        ultimaAtualizadaRegistro?.tipo ||
        null;

      const novasPermissoes =
        getPermissoesPorUltimaBatida(
          ultimaAtualizada
        );

      const novasBatidas =
        montarResumoBatidas(
          turnoAtualizado
        );

      console.log(
        "✅ PONTO REGISTRADO =>",
        {
          ponto,

          ultima_batida:
            ultimaAtualizada,

          permissoes:
            novasPermissoes,
        }
      );

      console.log(
        "================================="
      );

      return res
        .status(201)
        .json({
          ok: true,

          message:
            "Ponto registrado com sucesso.",

          empresa: {
            id:
              empresa.id,

            nome:
              empresa.nome_fantasia ||
              empresa.nome,
          },

          funcionario: {
            id:
              funcionario.id,

            nome:
              funcionario.nome,
          },

          ponto,

          ultima_batida:
            ultimaAtualizada,

          permissoes:
            novasPermissoes,

          batidas:
            novasBatidas,

          turno_aberto:
            Boolean(
              turnoAtualizado
            ),
        });

    } catch (err) {
      console.error(
        "Erro ao lançar ponto:",
        err
      );

      return res
        .status(500)
        .json({
          error:
            "Erro ao lançar ponto.",
        });
    }
  };


/* =========================================================
   BATER AUTOMATICAMENTE
========================================================= */
exports.auto =
  async (req, res) => {
    try {
      await garantirTabelas();

      const funcionarioId =
        Number(
          req.body.funcionario_id
        );

      /*
        SEGURANÇA:

        empresa vem exclusivamente do JWT.
      */
      const empresaId =
        Number(
          req.user?.empresa_id
        );

      /* =====================================
         VALIDAÇÕES
      ===================================== */

      if (
        !Number.isInteger(
          funcionarioId
        ) ||
        funcionarioId <= 0
      ) {
        return res
          .status(400)
          .json({
            error:
              "Funcionário inválido.",
          });
      }

      if (
        !Number.isInteger(
          empresaId
        ) ||
        empresaId <= 0
      ) {
        return res
          .status(400)
          .json({
            error:
              "Empresa não informada.",
          });
      }

      /* =====================================
         EMPRESA
      ===================================== */

      const empresa =
        await buscarEmpresaAtiva(
          empresaId
        );

      if (!empresa) {
        return res
          .status(404)
          .json({
            error:
              "Empresa não encontrada ou desativada.",
          });
      }

      /* =====================================
         FUNCIONÁRIO
      ===================================== */

      const funcionario =
        await buscarFuncionarioDaEmpresa(
          funcionarioId,
          empresaId
        );

      if (!funcionario) {
        return res
          .status(404)
          .json({
            error:
              "Funcionário não encontrado nesta empresa.",
          });
      }

      /* =====================================
         DESCOBRIR ESTADO ATUAL
      ===================================== */

      const turno =
        await buscarTurnoAberto(
          funcionarioId,
          empresaId
        );

      const ultimaRegistro =
        obterUltimaBatidaDoTurno(
          turno
        );

      const ultimaBatida =
        ultimaRegistro?.tipo ||
        null;

      let tipo;

      if (!ultimaBatida) {
        tipo =
          "entrada";

      } else if (
        ultimaBatida === "entrada"
      ) {
        tipo =
          "intervalo_inicio";

      } else if (
        ultimaBatida ===
        "intervalo_inicio"
      ) {
        tipo =
          "intervalo_fim";

      } else if (
        ultimaBatida ===
        "intervalo_fim"
      ) {
        tipo =
          "saida";

      } else {
        tipo =
          "entrada";
      }

      /* =====================================
         REGISTRAR
      ===================================== */

      const marcadoEm =
        dataHoraAgoraSQL();

      const { rows } =
        await pool.query(
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

      const ponto =
        rows[0];

      /* =====================================
         LOG DO PONTO AUTOMÁTICO
      ===================================== */

      const nomesBatidas = {
        entrada:
          "Entrada",

        intervalo_inicio:
          "Início do intervalo",

        intervalo_fim:
          "Retorno do intervalo",

        saida:
          "Saída",
      };

      await registrarLog({
        req,

        empresa_id:
          empresaId,

        funcionario_id:
          funcionario.id,

        tipo:
          "PONTO",

        acao:
          `PONTO_${tipo.toUpperCase()}`,

        descricao:
          `${funcionario.nome} registrou ${nomesBatidas[tipo]} automaticamente.`,

        dados: {
          ponto_id:
            ponto.id,

          funcionario_id:
            funcionario.id,

          funcionario_nome:
            funcionario.nome,

          tipo:
            ponto.tipo,

          marcado_em:
            ponto.marcado_em,

          origem:
            "automatico",
        },
      });

      /* =====================================
         RESPOSTA
      ===================================== */

      return res
        .status(201)
        .json({
          ok: true,

          message:
            "Ponto registrado com sucesso.",

          empresa: {
            id:
              empresa.id,

            nome:
              empresa.nome_fantasia ||
              empresa.nome,
          },

          funcionario: {
            id:
              funcionario.id,

            nome:
              funcionario.nome,
          },

          ponto,
        });

    } catch (err) {
      console.error(
        "Erro ao registrar ponto automático:",
        err
      );

      return res
        .status(500)
        .json({
          error:
            "Erro ao registrar ponto.",
        });
    }
  };

  /* =========================================================
   INSERIR PONTO MANUAL
========================================================= */
exports.inserirManual =
  async (req, res) => {
    try {
      await garantirTabelas();

      const funcionarioId =
        Number(
          req.body.funcionario_id
        );

      /*
        SEGURANÇA:

        Como esta rota é do RH da empresa,
        NÃO usamos empresa_id enviado pelo frontend.

        A empresa vem exclusivamente do JWT.
      */
      const empresaId =
        Number(
          req.user?.empresa_id
        );

      const tipo =
        String(
          req.body.tipo || ""
        )
          .trim()
          .toLowerCase();

      let data =
        String(
          req.body.data || ""
        ).trim();

      const hora =
        String(
          req.body.hora || ""
        ).trim();

      /* =====================================
         ACEITAR DATA YYYY-MM-DD OU DD/MM/YYYY
      ===================================== */

      if (
        /^\d{2}\/\d{2}\/\d{4}$/.test(
          data
        )
      ) {
        data =
          dataBRparaISO(data);
      }

      /* =====================================
         VALIDAR FUNCIONÁRIO
      ===================================== */

      if (
        !Number.isInteger(
          funcionarioId
        ) ||
        funcionarioId <= 0
      ) {
        return res
          .status(400)
          .json({
            error:
              "Funcionário inválido.",
          });
      }

      /* =====================================
         VALIDAR EMPRESA
      ===================================== */

      if (
        !Number.isInteger(
          empresaId
        ) ||
        empresaId <= 0
      ) {
        return res
          .status(400)
          .json({
            error:
              "Empresa não informada.",
          });
      }

      /* =====================================
         VALIDAR TIPO
      ===================================== */

      const tiposPermitidos = [
        "entrada",
        "intervalo_inicio",
        "intervalo_fim",
        "saida",
      ];

      if (
        !tiposPermitidos.includes(
          tipo
        )
      ) {
        return res
          .status(400)
          .json({
            error:
              "Tipo de ponto inválido.",
          });
      }

      /* =====================================
         VALIDAR DATA
      ===================================== */

      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(
          data
        )
      ) {
        return res
          .status(400)
          .json({
            error:
              "Data inválida. Use YYYY-MM-DD.",
          });
      }

      /* =====================================
         VALIDAR HORA
      ===================================== */

      if (
        !/^([01]\d|2[0-3]):[0-5]\d$/.test(
          hora
        )
      ) {
        return res
          .status(400)
          .json({
            error:
              "Hora inválida. Use HH:MM.",
          });
      }

      /* =====================================
         EMPRESA
      ===================================== */

      const empresa =
        await buscarEmpresaAtiva(
          empresaId
        );

      if (!empresa) {
        return res
          .status(404)
          .json({
            error:
              "Empresa não encontrada ou desativada.",
          });
      }

      /* =====================================
         FUNCIONÁRIO DA EMPRESA
      ===================================== */

      const funcionario =
        await buscarFuncionarioDaEmpresa(
          funcionarioId,
          empresaId
        );

      if (!funcionario) {
        return res
          .status(404)
          .json({
            error:
              "Funcionário não encontrado nesta empresa.",
          });
      }

      /* =====================================
         MONTAR DATA/HORA
      ===================================== */

      const marcadoEm =
        `${data} ${hora}:00`;

      /* =====================================
         INSERIR PONTO
      ===================================== */

      const { rows } =
        await pool.query(
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

      const ponto =
        rows[0];

      /* =====================================
         REGISTRAR LOG
      ===================================== */

      const nomesBatidas = {
        entrada:
          "Entrada",

        intervalo_inicio:
          "Início do intervalo",

        intervalo_fim:
          "Retorno do intervalo",

        saida:
          "Saída",
      };

      await registrarLog({
        req,

        empresa_id:
          empresaId,

        funcionario_id:
          funcionario.id,

        tipo:
          "PONTO",

        acao:
          "PONTO_MANUAL",

        descricao:
          `Ponto manual de ${funcionario.nome}: ${nomesBatidas[tipo]}.`,

        dados: {
          ponto_id:
            ponto.id,

          funcionario_id:
            funcionario.id,

          funcionario_nome:
            funcionario.nome,

          tipo:
            ponto.tipo,

          tipo_descricao:
            nomesBatidas[tipo],

          data,

          hora,

          marcado_em:
            ponto.marcado_em,

          origem:
            "manual_rh",
        },
      });

      /* =====================================
         RESPOSTA
      ===================================== */

      return res
        .status(201)
        .json({
          ok: true,

          message:
            "Ponto manual registrado com sucesso.",

          empresa: {
            id:
              empresa.id,

            nome:
              empresa.nome_fantasia ||
              empresa.nome,
          },

          funcionario: {
            id:
              funcionario.id,

            nome:
              funcionario.nome,
          },

          ponto,
        });

    } catch (err) {
      console.error(
        "Erro ao inserir ponto manual:",
        err
      );

      return res
        .status(500)
        .json({
          error:
            "Erro ao inserir ponto manual.",
        });
    }
  };


/* =========================================================
   AJUSTAR PONTO
========================================================= */
exports.ajustar =
  async (req, res) => {
    const client =
      await pool.connect();

    try {
      await garantirTabelas();

      await client.query(
        "BEGIN"
      );

      const {
        funcionario_id,

        /*
          empresa_id não é mais utilizado
          como fonte de segurança.

          Mesmo que venha no body,
          a empresa verdadeira será a do JWT.
        */
        data,

        ids_originais = {},

        entrada,
        intervalo,
        retorno,
        saida,

        falta = false,
        folga = false,
        ferias = false,

        falta_justificada =
          false,

        justificativa_falta =
          "",

        feriado = false,
      } = req.body;

      /* =====================================
         IDs
      ===================================== */

      const funcionarioId =
        Number(
          funcionario_id
        );

      /*
        SEGURANÇA MULTIEMPRESA:

        RH só pode ajustar funcionário
        pertencente à própria empresa.
      */
      const empresaId =
        Number(
          req.user?.empresa_id
        );

      /* =====================================
         VALIDAR FUNCIONÁRIO
      ===================================== */

      if (
        !Number.isInteger(
          funcionarioId
        ) ||
        funcionarioId <= 0
      ) {
        await client.query(
          "ROLLBACK"
        );

        return res
          .status(400)
          .json({
            error:
              "Funcionário inválido.",
          });
      }

      /* =====================================
         VALIDAR EMPRESA
      ===================================== */

      if (
        !Number.isInteger(
          empresaId
        ) ||
        empresaId <= 0
      ) {
        await client.query(
          "ROLLBACK"
        );

        return res
          .status(400)
          .json({
            error:
              "Empresa não informada.",
          });
      }

      /* =====================================
         VALIDAR DATA
      ===================================== */

      if (!data) {
        await client.query(
          "ROLLBACK"
        );

        return res
          .status(400)
          .json({
            error:
              "Data é obrigatória.",
          });
      }

      let dataISO;

      if (
        /^\d{4}-\d{2}-\d{2}$/.test(
          String(data)
        )
      ) {
        dataISO =
          String(data);
      } else {
        dataISO =
          dataBRparaISO(data);
      }

      if (!dataISO) {
        await client.query(
          "ROLLBACK"
        );

        return res
          .status(400)
          .json({
            error:
              "Data inválida.",
          });
      }

      /* =====================================
         EMPRESA
      ===================================== */

      const empresa =
        await buscarEmpresaAtiva(
          empresaId
        );

      if (!empresa) {
        await client.query(
          "ROLLBACK"
        );

        return res
          .status(404)
          .json({
            error:
              "Empresa não encontrada ou desativada.",
          });
      }

      /* =====================================
         FUNCIONÁRIO DA EMPRESA
      ===================================== */

      const funcionario =
        await buscarFuncionarioDaEmpresa(
          funcionarioId,
          empresaId
        );

      if (!funcionario) {
        await client.query(
          "ROLLBACK"
        );

        return res
          .status(404)
          .json({
            error:
              "Funcionário não encontrado nesta empresa.",
          });
      }

      /* =====================================
         NORMALIZAR BOOLEANOS
      ===================================== */

      const faltaBool =
        falta === true ||
        falta === "true" ||
        falta === 1 ||
        falta === "1";

      const folgaBool =
        folga === true ||
        folga === "true" ||
        folga === 1 ||
        folga === "1";

      const feriasBool =
        ferias === true ||
        ferias === "true" ||
        ferias === 1 ||
        ferias === "1";

      const faltaJustificadaBool =
        falta_justificada === true ||
        falta_justificada === "true" ||
        falta_justificada === 1 ||
        falta_justificada === "1";

      const feriadoBool =
        feriado === true ||
        feriado === "true" ||
        feriado === 1 ||
        feriado === "1";

      /* =====================================
         NÃO PERMITIR VÁRIAS SITUAÇÕES
         AO MESMO TEMPO
      ===================================== */

      const totalSituacoes =
        [
          faltaBool,
          folgaBool,
          feriasBool,
          faltaJustificadaBool,
        ].filter(Boolean).length;

      if (totalSituacoes > 1) {
        await client.query(
          "ROLLBACK"
        );

        return res
          .status(400)
          .json({
            error:
              "Marque apenas uma opção entre falta, folga, férias e falta justificada.",
          });
      }

      /* =====================================
         FALTA JUSTIFICADA PRECISA
         DE JUSTIFICATIVA
      ===================================== */

      if (
        faltaJustificadaBool &&
        !String(
          justificativa_falta || ""
        ).trim()
      ) {
        await client.query(
          "ROLLBACK"
        );

        return res
          .status(400)
          .json({
            error:
              "Informe a justificativa da falta.",
          });
      }

      /* =====================================
         HORÁRIOS
      ===================================== */

      const horas = {
        entrada:
          normalizarHora(
            entrada
          ),

        intervalo:
          normalizarHora(
            intervalo
          ),

        retorno:
          normalizarHora(
            retorno
          ),

        saida:
          normalizarHora(
            saida
          ),
      };

      /* =====================================
         IDS ORIGINAIS
      ===================================== */

      const entrada_id =
        Number(
          ids_originais?.entrada_id ||
          ids_originais?.entrada ||
          0
        ) || null;

      const intervalo_inicio_id =
        Number(
          ids_originais
            ?.intervalo_inicio_id ||
          ids_originais
            ?.intervalo_inicio ||
          0
        ) || null;

      const intervalo_fim_id =
        Number(
          ids_originais
            ?.intervalo_fim_id ||
          ids_originais
            ?.intervalo_fim ||
          0
        ) || null;

      const saida_id =
        Number(
          ids_originais?.saida_id ||
          ids_originais?.saida ||
          0
        ) || null;

      /* =====================================
         FUNÇÃO PARA VALIDAR SE O ID
         REALMENTE PERTENCE AO FUNCIONÁRIO
         E À EMPRESA
      ===================================== */

      async function validarPontoOriginal(
        pontoId
      ) {
        if (!pontoId) {
          return null;
        }

        const { rows } =
          await client.query(
            `
            SELECT
              id,
              empresa_id,
              funcionario_id,
              tipo,
              marcado_em

            FROM pontos

            WHERE id = $1
              AND funcionario_id = $2
              AND empresa_id = $3

            LIMIT 1
            `,
            [
              pontoId,
              funcionarioId,
              empresaId,
            ]
          );

        return rows[0] || null;
      }

      /* =====================================
         VALIDAR IDS RECEBIDOS

         Isso impede alterar um ponto de outro
         funcionário/empresa passando outro ID.
      ===================================== */

      const pontosOriginais = {
        entrada:
          await validarPontoOriginal(
            entrada_id
          ),

        intervalo_inicio:
          await validarPontoOriginal(
            intervalo_inicio_id
          ),

        intervalo_fim:
          await validarPontoOriginal(
            intervalo_fim_id
          ),

        saida:
          await validarPontoOriginal(
            saida_id
          ),
      };

      if (
        entrada_id &&
        !pontosOriginais.entrada
      ) {
        await client.query(
          "ROLLBACK"
        );

        return res
          .status(403)
          .json({
            error:
              "A entrada informada não pertence a este funcionário/empresa.",
          });
      }

      if (
        intervalo_inicio_id &&
        !pontosOriginais.intervalo_inicio
      ) {
        await client.query(
          "ROLLBACK"
        );

        return res
          .status(403)
          .json({
            error:
              "O intervalo informado não pertence a este funcionário/empresa.",
          });
      }

      if (
        intervalo_fim_id &&
        !pontosOriginais.intervalo_fim
      ) {
        await client.query(
          "ROLLBACK"
        );

        return res
          .status(403)
          .json({
            error:
              "O retorno informado não pertence a este funcionário/empresa.",
          });
      }

      if (
        saida_id &&
        !pontosOriginais.saida
      ) {
        await client.query(
          "ROLLBACK"
        );

        return res
          .status(403)
          .json({
            error:
              "A saída informada não pertence a este funcionário/empresa.",
          });
      }

      /* =====================================
         CASO SEJA:
         FALTA
         FOLGA
         FÉRIAS
         FALTA JUSTIFICADA
      ===================================== */

      if (
        faltaBool ||
        folgaBool ||
        feriasBool ||
        faltaJustificadaBool
      ) {
        /*
          Removemos somente as batidas que
          pertencem à jornada/data que está
          sendo ajustada.

          Janela de 36 horas mantém suporte
          aos funcionários da madrugada.
        */

        await client.query(
          `
          DELETE FROM pontos

          WHERE funcionario_id = $1
            AND empresa_id = $2

            AND marcado_em >=
                $3::date

            AND marcado_em <
                (
                  $3::date +
                  INTERVAL '36 hours'
                )
          `,
          [
            funcionarioId,
            empresaId,
            dataISO,
          ]
        );

        /* ===================================
           SALVAR SITUAÇÃO DO DIA
        =================================== */

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

            created_at,
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

            NOW(),
            NOW()
          )

          ON CONFLICT (
            funcionario_id,
            data
          )

          DO UPDATE SET

            empresa_id =
              EXCLUDED.empresa_id,

            falta =
              EXCLUDED.falta,

            folga =
              EXCLUDED.folga,

            ferias =
              EXCLUDED.ferias,

            falta_justificada =
              EXCLUDED.falta_justificada,

            justificativa_falta =
              EXCLUDED.justificativa_falta,

            feriado =
              EXCLUDED.feriado,

            updated_at =
              NOW()
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
                  justificativa_falta
                ).trim()
              : null,

            feriadoBool,
          ]
        );

        /* ===================================
           COMMIT
        =================================== */

        await client.query(
          "COMMIT"
        );

        /* ===================================
           REGISTRAR LOG
        =================================== */

        const acaoAjuste =
          faltaBool
            ? "FALTA_REGISTRADA"
            : folgaBool
              ? "FOLGA_REGISTRADA"
              : feriasBool
                ? "FERIAS_REGISTRADA"
                : "FALTA_JUSTIFICADA_REGISTRADA";

        const descricaoAjuste =
          faltaBool
            ? `Falta registrada para ${funcionario.nome}.`
            : folgaBool
              ? `Folga registrada para ${funcionario.nome}.`
              : feriasBool
                ? `Férias registradas para ${funcionario.nome}.`
                : `Falta justificada registrada para ${funcionario.nome}.`;

        await registrarLog({
          req,

          empresa_id:
            empresaId,

          funcionario_id:
            funcionario.id,

          tipo:
            "AJUSTE",

          acao:
            acaoAjuste,

          descricao:
            descricaoAjuste,

          dados: {
            funcionario_id:
              funcionario.id,

            funcionario_nome:
              funcionario.nome,

            data:
              dataISO,

            falta:
              faltaBool,

            folga:
              folgaBool,

            ferias:
              feriasBool,

            falta_justificada:
              faltaJustificadaBool,

            justificativa:
              faltaJustificadaBool
                ? String(
                    justificativa_falta ||
                    ""
                  ).trim()
                : null,

            feriado:
              feriadoBool,
          },
        });

        /* ===================================
           RESPOSTA
        =================================== */

        return res.json({
          ok: true,

          empresa_id:
            empresaId,

          funcionario_id:
            funcionarioId,

          falta:
            faltaBool,

          folga:
            folgaBool,

          ferias:
            feriasBool,

          falta_justificada:
            faltaJustificadaBool,

          justificativa_falta:
            faltaJustificadaBool
              ? String(
                  justificativa_falta
                ).trim()
              : "",

          feriado:
            feriadoBool,

          message:
            faltaBool
              ? "Falta registrada com sucesso."
              : folgaBool
                ? "Folga registrada com sucesso."
                : feriasBool
                  ? "Férias registradas com sucesso."
                  : "Falta justificada registrada com sucesso.",
        });
      }

            /* =========================================
         AJUSTAR HORÁRIOS NORMAIS
      ========================================= */

      /*
        Se chegou aqui, o dia não está sendo
        marcado como falta, folga, férias
        ou falta justificada.

        Portanto removemos qualquer situação
        anterior salva para esta data.
      */

      await client.query(
        `
        DELETE FROM faltas_ajustes

        WHERE funcionario_id = $1
          AND empresa_id = $2
          AND data = $3::date
        `,
        [
          funcionarioId,
          empresaId,
          dataISO,
        ]
      );

      /* =========================================
         FUNÇÃO PARA CONVERTER HORA EM MINUTOS
      ========================================= */

      function horaParaMinutos(hora) {
        if (!hora) {
          return null;
        }

        const [
          horas,
          minutos,
        ] = hora
          .split(":")
          .map(Number);

        if (
          !Number.isInteger(horas) ||
          !Number.isInteger(minutos)
        ) {
          return null;
        }

        return (
          horas * 60 +
          minutos
        );
      }

      /* =========================================
         DESCOBRIR O DIA DE CADA BATIDA

         IMPORTANTE PARA JORNADA NOTURNA:

         Exemplo:

         Jornada referente ao dia 26:

         Entrada:   17:30 -> dia 26
         Intervalo: 23:30 -> dia 26
         Retorno:   00:30 -> dia 27
         Saída:     05:30 -> dia 27

         Mesmo retorno/saída acontecendo
         fisicamente no dia 27, continuam
         pertencendo à jornada iniciada no dia 26.
      ========================================= */

      const entradaMinutos =
        horaParaMinutos(
          horas.entrada
        );

      const intervaloMinutos =
        horaParaMinutos(
          horas.intervalo
        );

      const retornoMinutos =
        horaParaMinutos(
          horas.retorno
        );

      const saidaMinutos =
        horaParaMinutos(
          horas.saida
        );

      let diaEntrada = 0;
      let diaIntervalo = 0;
      let diaRetorno = 0;
      let diaSaida = 0;

      /*
        "ultimoMinutoAbsoluto" permite
        acompanhar quando houve virada
        de meia-noite.
      */
      let ultimoMinutoAbsoluto =
        null;

      function calcularDiaBatida(
        minutos
      ) {
        if (minutos === null) {
          return 0;
        }

        /*
          Primeira batida sempre começa
          no dia de referência.
        */
        if (
          ultimoMinutoAbsoluto ===
          null
        ) {
          ultimoMinutoAbsoluto =
            minutos;

          return 0;
        }

        let candidato =
          minutos;

        /*
          Se o horário ficou menor que
          o anterior, significa que
          provavelmente passou da
          meia-noite.

          Somamos 24 horas até ficar
          cronologicamente depois da
          batida anterior.
        */
        while (
          candidato <
          ultimoMinutoAbsoluto
        ) {
          candidato +=
            24 * 60;
        }

        ultimoMinutoAbsoluto =
          candidato;

        return Math.floor(
          candidato /
          (24 * 60)
        );
      }

      /*
        Calculamos seguindo a ordem
        real da jornada.
      */

      if (
        entradaMinutos !== null
      ) {
        diaEntrada =
          calcularDiaBatida(
            entradaMinutos
          );
      }

      if (
        intervaloMinutos !== null
      ) {
        diaIntervalo =
          calcularDiaBatida(
            intervaloMinutos
          );
      }

      if (
        retornoMinutos !== null
      ) {
        diaRetorno =
          calcularDiaBatida(
            retornoMinutos
          );
      }

      if (
        saidaMinutos !== null
      ) {
        diaSaida =
          calcularDiaBatida(
            saidaMinutos
          );
      }

      /* =========================================
         MONTAR DATAS/HORAS COMPLETAS
      ========================================= */

      const marcadoEntrada =
        horas.entrada
          ? montarDataHoraComDia(
              dataISO,
              horas.entrada,
              diaEntrada
            )
          : null;

      const marcadoIntervalo =
        horas.intervalo
          ? montarDataHoraComDia(
              dataISO,
              horas.intervalo,
              diaIntervalo
            )
          : null;

      const marcadoRetorno =
        horas.retorno
          ? montarDataHoraComDia(
              dataISO,
              horas.retorno,
              diaRetorno
            )
          : null;

      const marcadoSaida =
        horas.saida
          ? montarDataHoraComDia(
              dataISO,
              horas.saida,
              diaSaida
            )
          : null;

      console.log(
        "========== AJUSTE DE HORÁRIOS =========="
      );

      console.log({
        empresa_id:
          empresaId,

        funcionario_id:
          funcionarioId,

        funcionario:
          funcionario.nome,

        data_referencia:
          dataISO,

        entrada: {
          hora:
            horas.entrada,

          dia_adicional:
            diaEntrada,

          marcado_em:
            marcadoEntrada,
        },

        intervalo: {
          hora:
            horas.intervalo,

          dia_adicional:
            diaIntervalo,

          marcado_em:
            marcadoIntervalo,
        },

        retorno: {
          hora:
            horas.retorno,

          dia_adicional:
            diaRetorno,

          marcado_em:
            marcadoRetorno,
        },

        saida: {
          hora:
            horas.saida,

          dia_adicional:
            diaSaida,

          marcado_em:
            marcadoSaida,
        },
      });

      console.log(
        "========================================="
      );

      /* =========================================
         NOVOS IDS
      ========================================= */

      const novosIds = {
        entrada_id:
          null,

        intervalo_inicio_id:
          null,

        intervalo_fim_id:
          null,

        saida_id:
          null,
      };

      /* =========================================
         FUNÇÃO AUXILIAR PARA ATUALIZAR
         OU INSERIR UMA BATIDA
      ========================================= */

      async function salvarBatida({
        pontoOriginal,
        tipo,
        marcadoEm,
      }) {
        /*
          Se não existe horário novo,
          removemos a batida antiga,
          caso ela exista.
        */
        if (!marcadoEm) {
          if (pontoOriginal?.id) {
            await client.query(
              `
              DELETE FROM pontos

              WHERE id = $1
                AND funcionario_id = $2
                AND empresa_id = $3
              `,
              [
                pontoOriginal.id,
                funcionarioId,
                empresaId,
              ]
            );
          }

          return null;
        }

        /*
          Se já existe um ponto original,
          atualizamos exatamente aquele ID.
        */
        if (pontoOriginal?.id) {
          const { rows } =
            await client.query(
              `
              UPDATE pontos

              SET
                tipo = $1,
                marcado_em =
                  $2::timestamp,
                empresa_id = $3

              WHERE id = $4
                AND funcionario_id = $5
                AND empresa_id = $3

              RETURNING
                id,
                empresa_id,
                funcionario_id,
                tipo,
                marcado_em
              `,
              [
                tipo,
                marcadoEm,
                empresaId,
                pontoOriginal.id,
                funcionarioId,
              ]
            );

          return (
            rows[0] ||
            null
          );
        }

        /*
          Caso não exista ID original,
          criamos uma nova batida.
        */
        const { rows } =
          await client.query(
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

        return (
          rows[0] ||
          null
        );
      }

      /* =========================================
         SALVAR ENTRADA
      ========================================= */

      const pontoEntrada =
        await salvarBatida({
          pontoOriginal:
            pontosOriginais.entrada,

          tipo:
            "entrada",

          marcadoEm:
            marcadoEntrada,
        });

      novosIds.entrada_id =
        pontoEntrada?.id ||
        null;

      /* =========================================
         SALVAR INÍCIO DO INTERVALO
      ========================================= */

      const pontoIntervalo =
        await salvarBatida({
          pontoOriginal:
            pontosOriginais
              .intervalo_inicio,

          tipo:
            "intervalo_inicio",

          marcadoEm:
            marcadoIntervalo,
        });

      novosIds.intervalo_inicio_id =
        pontoIntervalo?.id ||
        null;

      /* =========================================
         SALVAR RETORNO DO INTERVALO
      ========================================= */

      const pontoRetorno =
        await salvarBatida({
          pontoOriginal:
            pontosOriginais
              .intervalo_fim,

          tipo:
            "intervalo_fim",

          marcadoEm:
            marcadoRetorno,
        });

      novosIds.intervalo_fim_id =
        pontoRetorno?.id ||
        null;

      /* =========================================
         SALVAR SAÍDA
      ========================================= */

      const pontoSaida =
        await salvarBatida({
          pontoOriginal:
            pontosOriginais.saida,

          tipo:
            "saida",

          marcadoEm:
            marcadoSaida,
        });

      novosIds.saida_id =
        pontoSaida?.id ||
        null;

      /* =========================================
         SALVAR FERIADO, CASO NECESSÁRIO
      ========================================= */

      if (feriadoBool) {
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

            created_at,
            updated_at
          )

          VALUES (
            $1,
            $2,
            $3,

            false,
            false,
            false,

            false,
            NULL,

            true,

            NOW(),
            NOW()
          )

          ON CONFLICT (
            funcionario_id,
            data
          )

          DO UPDATE SET

            empresa_id =
              EXCLUDED.empresa_id,

            falta =
              false,

            folga =
              false,

            ferias =
              false,

            falta_justificada =
              false,

            justificativa_falta =
              NULL,

            feriado =
              true,

            updated_at =
              NOW()
          `,
          [
            empresaId,
            funcionarioId,
            dataISO,
          ]
        );
      }

      /* =========================================
         COMMIT
      ========================================= */

      await client.query(
        "COMMIT"
      );

      /* =========================================
         LOG DO AJUSTE

         O log é feito DEPOIS do COMMIT.
         Assim não registramos como concluída
         uma alteração que sofreu rollback.
      ========================================= */

      await registrarLog({
        req,

        empresa_id:
          empresaId,

        funcionario_id:
          funcionario.id,

        tipo:
          "AJUSTE",

        acao:
          "HORARIOS_AJUSTADOS",

        descricao:
          `Horários de ${funcionario.nome} foram ajustados pelo RH.`,

        dados: {
          funcionario_id:
            funcionario.id,

          funcionario_nome:
            funcionario.nome,

          data_referencia:
            dataISO,

          horarios: {
            entrada:
              horas.entrada,

            intervalo:
              horas.intervalo,

            retorno:
              horas.retorno,

            saida:
              horas.saida,
          },

          datas_reais: {
            entrada:
              marcadoEntrada,

            intervalo:
              marcadoIntervalo,

            retorno:
              marcadoRetorno,

            saida:
              marcadoSaida,
          },

          virada_dia: {
            entrada:
              diaEntrada,

            intervalo:
              diaIntervalo,

            retorno:
              diaRetorno,

            saida:
              diaSaida,
          },

          ids:
            novosIds,

          feriado:
            feriadoBool,

          origem:
            "ajuste_relatorio",
        },
      });

      /* =========================================
         RESPOSTA
      ========================================= */

      return res.json({
        ok: true,

        message:
          "Horários ajustados com sucesso.",

        empresa: {
          id:
            empresa.id,

          nome:
            empresa.nome_fantasia ||
            empresa.nome,
        },

        funcionario: {
          id:
            funcionario.id,

          nome:
            funcionario.nome,
        },

        data_referencia:
          dataISO,

        horarios: {
          entrada:
            horas.entrada,

          intervalo:
            horas.intervalo,

          retorno:
            horas.retorno,

          saida:
            horas.saida,
        },

        datas_reais: {
          entrada:
            marcadoEntrada,

          intervalo:
            marcadoIntervalo,

          retorno:
            marcadoRetorno,

          saida:
            marcadoSaida,
        },

        ids:
          novosIds,

        feriado:
          feriadoBool,
      });

    } catch (err) {
      /* =========================================
         ROLLBACK
      ========================================= */

      try {
        await client.query(
          "ROLLBACK"
        );
      } catch (
        rollbackError
      ) {
        console.error(
          "Erro no rollback do ajuste:",
          rollbackError
        );
      }

      console.error(
        "Erro ao ajustar ponto:",
        err
      );

      return res
        .status(500)
        .json({
          error:
            "Erro ao ajustar ponto.",
        });

    } finally {
      client.release();
    }
  };


/* =========================================================
   LIMPAR BATIDAS DO DIA
========================================================= */
exports.limparBatidasDoDia =
  async (req, res) => {
    try {
      await garantirTabelas();

      const funcionarioId =
        Number(
          req.body.funcionario_id
        );

      /*
        SEGURANÇA:
        empresa exclusivamente do JWT.
      */
      const empresaId =
        Number(
          req.user?.empresa_id
        );

      let data =
        String(
          req.body.data || ""
        ).trim();

      /* =====================================
         ACEITAR DD/MM/YYYY
      ===================================== */

      if (
        /^\d{2}\/\d{2}\/\d{4}$/.test(
          data
        )
      ) {
        data =
          dataBRparaISO(
            data
          );
      }

      /* =====================================
         VALIDAR FUNCIONÁRIO
      ===================================== */

      if (
        !Number.isInteger(
          funcionarioId
        ) ||
        funcionarioId <= 0
      ) {
        return res
          .status(400)
          .json({
            error:
              "Funcionário inválido.",
          });
      }

      /* =====================================
         VALIDAR EMPRESA
      ===================================== */

      if (
        !Number.isInteger(
          empresaId
        ) ||
        empresaId <= 0
      ) {
        return res
          .status(400)
          .json({
            error:
              "Empresa não informada.",
          });
      }

      /* =====================================
         VALIDAR DATA
      ===================================== */

      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(
          data
        )
      ) {
        return res
          .status(400)
          .json({
            error:
              "Data inválida.",
          });
      }

      /* =====================================
         EMPRESA
      ===================================== */

      const empresa =
        await buscarEmpresaAtiva(
          empresaId
        );

      if (!empresa) {
        return res
          .status(404)
          .json({
            error:
              "Empresa não encontrada ou desativada.",
          });
      }

      /* =====================================
         FUNCIONÁRIO
      ===================================== */

      const funcionario =
        await buscarFuncionarioDaEmpresa(
          funcionarioId,
          empresaId
        );

      if (!funcionario) {
        return res
          .status(404)
          .json({
            error:
              "Funcionário não encontrado nesta empresa.",
          });
      }

      const dataISO =
        data;

      /* =====================================
         EXCLUIR BATIDAS

         Mantemos janela de 36 horas para
         jornada noturna.
      ===================================== */

      const result =
        await pool.query(
          `
          DELETE FROM pontos

          WHERE funcionario_id = $1
            AND empresa_id = $2

            AND marcado_em >=
                $3::date

            AND marcado_em <
                (
                  $3::date +
                  INTERVAL '36 hours'
                )
          `,
          [
            funcionarioId,
            empresaId,
            dataISO,
          ]
        );

      /* =====================================
         LOG DA EXCLUSÃO
      ===================================== */

      await registrarLog({
        req,

        empresa_id:
          empresaId,

        funcionario_id:
          funcionario.id,

        tipo:
          "PONTO",

        acao:
          "BATIDAS_REMOVIDAS",

        descricao:
          `${result.rowCount || 0} batida(s) de ${funcionario.nome} foram removidas.`,

        dados: {
          funcionario_id:
            funcionario.id,

          funcionario_nome:
            funcionario.nome,

          data_referencia:
            dataISO,

          quantidade:
            result.rowCount ||
            0,

          origem:
            "limpar_dia_rh",
        },
      });

      return res.json({
        ok: true,

        empresa_id:
          empresaId,

        funcionario_id:
          funcionarioId,

        data:
          dataISO,

        removidas:
          result.rowCount ||
          0,

        message:
          "Batidas do dia removidas com sucesso.",
      });

    } catch (err) {
      console.error(
        "Erro ao limpar batidas do dia:",
        err
      );

      return res
        .status(500)
        .json({
          error:
            "Erro ao limpar batidas do dia.",
        });
    }
  };

  /* =========================================================
   LANÇAR HORÁRIO PADRÃO NO MÊS
========================================================= */
exports.lancarHorarioPadraoMes =
  async (req, res) => {
    const client =
      await pool.connect();

    try {
      await garantirTabelas();

      await client.query(
        "BEGIN"
      );

      const {
        funcionario_id,
        mes,
        ano,
      } = req.body;

      const funcionarioId =
        Number(
          funcionario_id
        );

      /*
        SEGURANÇA:

        empresa NÃO vem do body.
        Vem exclusivamente do JWT do RH.
      */
      const empresaId =
        Number(
          req.user?.empresa_id
        );

      const mesNum =
        Number(mes);

      const anoNum =
        Number(ano);

      /* =====================================
         VALIDAR FUNCIONÁRIO
      ===================================== */

      if (
        !Number.isInteger(
          funcionarioId
        ) ||
        funcionarioId <= 0
      ) {
        await client.query(
          "ROLLBACK"
        );

        return res
          .status(400)
          .json({
            error:
              "Funcionário inválido.",
          });
      }

      /* =====================================
         VALIDAR EMPRESA
      ===================================== */

      if (
        !Number.isInteger(
          empresaId
        ) ||
        empresaId <= 0
      ) {
        await client.query(
          "ROLLBACK"
        );

        return res
          .status(400)
          .json({
            error:
              "Empresa não informada.",
          });
      }

      /* =====================================
         VALIDAR MÊS / ANO
      ===================================== */

      if (
        !Number.isInteger(
          mesNum
        ) ||
        !Number.isInteger(
          anoNum
        )
      ) {
        await client.query(
          "ROLLBACK"
        );

        return res
          .status(400)
          .json({
            error:
              "Mês e ano são obrigatórios.",
          });
      }

      if (
        mesNum < 1 ||
        mesNum > 12
      ) {
        await client.query(
          "ROLLBACK"
        );

        return res
          .status(400)
          .json({
            error:
              "Mês inválido.",
          });
      }

      /* =====================================
         EMPRESA
      ===================================== */

      const {
        rows: empresas,
      } =
        await client.query(
          `
          SELECT
            id,
            nome,
            nome_fantasia,
            ativo

          FROM empresas

          WHERE id = $1
            AND ativo = TRUE

          LIMIT 1
          `,
          [
            empresaId,
          ]
        );

      if (!empresas.length) {
        await client.query(
          "ROLLBACK"
        );

        return res
          .status(404)
          .json({
            error:
              "Empresa não encontrada ou desativada.",
          });
      }

      const empresa =
        empresas[0];

      /* =====================================
         FUNCIONÁRIO

         Precisa obrigatoriamente pertencer
         à empresa do usuário autenticado.
      ===================================== */

      const {
        rows: funcionarios,
      } =
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
            AND ativo = TRUE

          LIMIT 1
          `,
          [
            funcionarioId,
            empresaId,
          ]
        );

      if (!funcionarios.length) {
        await client.query(
          "ROLLBACK"
        );

        return res
          .status(404)
          .json({
            error:
              "Funcionário não encontrado nesta empresa.",
          });
      }

      const funcionario =
        funcionarios[0];

      /* =====================================
         HORÁRIO PADRÃO
      ===================================== */

      const horaEntrada =
        normalizarHora(
          funcionario.chegada
        );

      const horaIntervaloInicio =
        normalizarHora(
          funcionario.intervalo_inicio
        );

      const horaIntervaloFim =
        normalizarHora(
          funcionario.intervalo_fim
        );

      const horaSaida =
        normalizarHora(
          funcionario.saida
        );

      if (
        !horaEntrada ||
        !horaIntervaloInicio ||
        !horaIntervaloFim ||
        !horaSaida
      ) {
        await client.query(
          "ROLLBACK"
        );

        return res
          .status(400)
          .json({
            error:
              "O funcionário não possui horário padrão completo cadastrado.",
          });
      }

      /* =====================================
         CONVERTER HORA PARA MINUTOS
      ===================================== */

      function horaParaMinutos(
        hora
      ) {
        if (!hora) {
          return null;
        }

        const [
          h,
          m,
        ] =
          hora
            .split(":")
            .map(Number);

        if (
          !Number.isInteger(h) ||
          !Number.isInteger(m)
        ) {
          return null;
        }

        return (
          h * 60 +
          m
        );
      }

      /* =====================================
         CALCULAR VIRADA DE DIA

         Exemplo:

         Entrada   17:30 -> dia 0
         Intervalo 23:30 -> dia 0
         Retorno   00:30 -> dia 1
         Saída     05:30 -> dia 1

         Dessa forma a jornada continua
         pertencendo ao dia da entrada.
      ===================================== */

      const horariosMinutos = [
        horaParaMinutos(
          horaEntrada
        ),

        horaParaMinutos(
          horaIntervaloInicio
        ),

        horaParaMinutos(
          horaIntervaloFim
        ),

        horaParaMinutos(
          horaSaida
        ),
      ];

      const diasAdicionais = [
        0,
        0,
        0,
        0,
      ];

      let ultimoAbsoluto =
        horariosMinutos[0];

      for (
        let i = 1;
        i <
        horariosMinutos.length;
        i++
      ) {
        let atual =
          horariosMinutos[i];

        /*
          Enquanto o horário atual estiver
          cronologicamente antes do anterior,
          avançamos um dia.
        */
        while (
          atual <
          ultimoAbsoluto
        ) {
          atual +=
            24 * 60;
        }

        diasAdicionais[i] =
          Math.floor(
            atual /
            (24 * 60)
          );

        ultimoAbsoluto =
          atual;
      }

      const [
        diaEntrada,
        diaIntervaloInicio,
        diaIntervaloFim,
        diaSaida,
      ] =
        diasAdicionais;

      console.log(
        "========== HORÁRIO PADRÃO =========="
      );

      console.log({
        funcionario_id:
          funcionarioId,

        funcionario:
          funcionario.nome,

        empresa_id:
          empresaId,

        horario: {
          entrada:
            horaEntrada,

          intervalo_inicio:
            horaIntervaloInicio,

          intervalo_fim:
            horaIntervaloFim,

          saida:
            horaSaida,
        },

        dias_adicionais: {
          entrada:
            diaEntrada,

          intervalo_inicio:
            diaIntervaloInicio,

          intervalo_fim:
            diaIntervaloFim,

          saida:
            diaSaida,
        },
      });

      console.log(
        "====================================="
      );

      /* =====================================
         QUANTIDADE DE DIAS DO MÊS
      ===================================== */

      const diasNoMes =
        new Date(
          anoNum,
          mesNum,
          0
        ).getDate();

      let diasInseridos = 0;
      let diasIgnorados = 0;

      const detalhes = [];

      /* =====================================
         PERCORRER TODOS OS DIAS
      ===================================== */

      for (
        let dia = 1;
        dia <= diasNoMes;
        dia++
      ) {
        const dataISO =
          `${anoNum}-` +
          `${String(
            mesNum
          ).padStart(2, "0")}-` +
          `${String(
            dia
          ).padStart(2, "0")}`;

        /* ===================================
           VERIFICAR SE JÁ EXISTE ENTRADA
           PARA ESTA JORNADA
        =================================== */

        const {
          rows: pontosExistentes,
        } =
          await client.query(
            `
            SELECT
              id

            FROM pontos

            WHERE funcionario_id = $1
              AND empresa_id = $2
              AND tipo = 'entrada'
              AND marcado_em::date =
                  $3::date

            LIMIT 1
            `,
            [
              funcionarioId,
              empresaId,
              dataISO,
            ]
          );

        if (
          pontosExistentes.length >
          0
        ) {
          diasIgnorados++;

          detalhes.push({
            data:
              dataISO,

            status:
              "ignorado",

            motivo:
              "Já possui ponto lançado",
          });

          continue;
        }

        /* ===================================
           VERIFICAR FALTA / FOLGA /
           FÉRIAS / FALTA JUSTIFICADA
        =================================== */

        const {
          rows: ajusteExistente,
        } =
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
          ajusteExistente.length >
          0 &&
          (
            ajusteExistente[0]
              .falta ||

            ajusteExistente[0]
              .folga ||

            ajusteExistente[0]
              .ferias ||

            ajusteExistente[0]
              .falta_justificada
          )
        ) {
          diasIgnorados++;

          const ajuste =
            ajusteExistente[0];

          detalhes.push({
            data:
              dataISO,

            status:
              "ignorado",

            motivo:
              ajuste.falta
                ? "Dia marcado como falta"
                : ajuste.folga
                  ? "Dia marcado como folga"
                  : ajuste.ferias
                    ? "Dia marcado como férias"
                    : "Dia marcado como falta justificada",
          });

          continue;
        }

        /* ===================================
           VERIFICAR ATESTADO
        =================================== */

        const {
          rows: atestadoExistente,
        } =
          await client.query(
            `
            SELECT
              id

            FROM atestados

            WHERE funcionario_id = $1
              AND empresa_id = $2

              AND $3::date
                  BETWEEN
                    data_inicio::date
                  AND
                    data_fim::date

            LIMIT 1
            `,
            [
              funcionarioId,
              empresaId,
              dataISO,
            ]
          );

        if (
          atestadoExistente.length >
          0
        ) {
          diasIgnorados++;

          detalhes.push({
            data:
              dataISO,

            status:
              "ignorado",

            motivo:
              "Dia com atestado",
          });

          continue;
        }

        /* ===================================
           MONTAR DATAS REAIS DAS BATIDAS
        =================================== */

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

        /* ===================================
           INSERIR AS QUATRO BATIDAS
        =================================== */

        await client.query(
          `
          INSERT INTO pontos (
            empresa_id,
            funcionario_id,
            tipo,
            marcado_em
          )

          VALUES
            (
              $1,
              $2,
              'entrada',
              $3::timestamp
            ),

            (
              $1,
              $2,
              'intervalo_inicio',
              $4::timestamp
            ),

            (
              $1,
              $2,
              'intervalo_fim',
              $5::timestamp
            ),

            (
              $1,
              $2,
              'saida',
              $6::timestamp
            )
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

        /* ===================================
           LIMPAR SITUAÇÕES DO DIA

           Como acabamos de lançar horário
           normal, não pode continuar marcado
           como falta/folga/férias etc.
        =================================== */

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
            NULL,

            false,

            NOW()
          )

          ON CONFLICT (
            funcionario_id,
            data
          )

          DO UPDATE SET

            empresa_id =
              EXCLUDED.empresa_id,

            falta =
              false,

            folga =
              false,

            ferias =
              false,

            falta_justificada =
              false,

            justificativa_falta =
              NULL,

            updated_at =
              NOW()
          `,
          [
            empresaId,
            funcionarioId,
            dataISO,
          ]
        );

        diasInseridos++;

        detalhes.push({
          data:
            dataISO,

          status:
            "inserido",

          horarios: {
            entrada:
              entradaDataHora,

            intervalo_inicio:
              intervaloInicioDataHora,

            intervalo_fim:
              intervaloFimDataHora,

            saida:
              saidaDataHora,
          },
        });
      }

      /* =====================================
         COMMIT
      ===================================== */

      await client.query(
        "COMMIT"
      );

      /* =====================================
         REGISTRAR LOG

         Somente depois do COMMIT.
      ===================================== */

      await registrarLog({
        req,

        empresa_id:
          empresaId,

        funcionario_id:
          funcionario.id,

        tipo:
          "AJUSTE",

        acao:
          "HORARIO_PADRAO_MES",

        descricao:
          `Horário padrão mensal lançado para ${funcionario.nome}.`,

        dados: {
          funcionario_id:
            funcionario.id,

          funcionario_nome:
            funcionario.nome,

          mes:
            mesNum,

          ano:
            anoNum,

          horario_padrao: {
            entrada:
              horaEntrada,

            intervalo_inicio:
              horaIntervaloInicio,

            intervalo_fim:
              horaIntervaloFim,

            saida:
              horaSaida,
          },

          jornada_noturna: {
            entrada_dia:
              diaEntrada,

            intervalo_inicio_dia:
              diaIntervaloInicio,

            intervalo_fim_dia:
              diaIntervaloFim,

            saida_dia:
              diaSaida,
          },

          dias_inseridos:
            diasInseridos,

          dias_ignorados:
            diasIgnorados,

          origem:
            "horario_padrao_mes",
        },
      });

      /* =====================================
         RESPOSTA
      ===================================== */

      return res.json({
        ok: true,

        message:
          "Horário padrão lançado com sucesso.",

        empresa: {
          id:
            empresa.id,

          nome:
            empresa.nome_fantasia ||
            empresa.nome,
        },

        funcionario:
          funcionario.nome,

        mes:
          mesNum,

        ano:
          anoNum,

        dias_inseridos:
          diasInseridos,

        dias_ignorados:
          diasIgnorados,

        detalhes,
      });

    } catch (err) {
      /* =====================================
         ROLLBACK
      ===================================== */

      try {
        await client.query(
          "ROLLBACK"
        );
      } catch (
        rollbackError
      ) {
        console.error(
          "Erro no rollback do horário padrão:",
          rollbackError
        );
      }

      console.error(
        "Erro ao lançar horário padrão do mês:",
        err
      );

      return res
        .status(500)
        .json({
          error:
            "Erro ao lançar horário padrão do mês.",
        });

    } finally {
      client.release();
    }
  };

  /* =========================================================
   SINCRONIZAR BATIDAS FEITAS OFFLINE

   POST /api/ponto/sincronizar-offline

   SEGURANÇA:
   - empresa vem do JWT
   - funcionário precisa pertencer à empresa
   - UUID impede duplicação
========================================================= */
exports.sincronizarOffline =
  async (req, res) => {
    const client =
      await pool.connect();

    try {
      await garantirTabelas();

      /* =====================================
         EMPRESA DO TERMINAL

         NUNCA usar empresa_id do body como
         fonte de autorização.
      ===================================== */

      const empresaId =
        Number(
          req.user?.empresa_id
        );

      if (
        !Number.isInteger(
          empresaId
        ) ||
        empresaId <= 0
      ) {
        return res
          .status(403)
          .json({
            error:
              "Empresa do terminal não identificada.",
          });
      }


      /* =====================================
         EMPRESA PRECISA ESTAR ATIVA
      ===================================== */

      const empresa =
        await buscarEmpresaAtiva(
          empresaId
        );

      if (!empresa) {
        return res
          .status(403)
          .json({
            error:
              "Empresa não encontrada ou desativada.",
          });
      }


      /* =====================================
         RECEBER FILA
      ===================================== */

      const pontos =
  Array.isArray(
    req.body?.pontos
  )
    ? [...req.body.pontos].sort(
        (a, b) => {
          const dataA =
            new Date(
              a?.horario_dispositivo
            ).getTime();

          const dataB =
            new Date(
              b?.horario_dispositivo
            ).getTime();

          if (
            Number.isNaN(dataA) ||
            Number.isNaN(dataB)
          ) {
            return 0;
          }

          return dataA - dataB;
        }
      )
    : [];


      if (!pontos.length) {
        return res
          .status(400)
          .json({
            error:
              "Nenhuma batida offline enviada.",
          });
      }


      /*
        Proteção contra uma requisição
        exageradamente grande.
      */

      if (pontos.length > 100) {
        return res
          .status(400)
          .json({
            error:
              "Envie no máximo 100 batidas por sincronização.",
          });
      }


      const tiposPermitidos =
        new Set([
          "entrada",
          "intervalo_inicio",
          "intervalo_fim",
          "saida",
        ]);


      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;


      const resultados = [];


      /* =====================================
         PROCESSAR CADA BATIDA

         Usamos uma transação individual por
         batida para uma inválida não impedir
         as demais.
      ===================================== */

      for (const item of pontos) {
        const offlineUuid =
          String(
            item?.offline_uuid ||
            ""
          ).trim();


        const funcionarioId =
          Number(
            item?.funcionario_id
          );


        const tipo =
          String(
            item?.tipo ||
            ""
          )
            .trim()
            .toLowerCase();


        const horarioDispositivo =
          String(
            item?.horario_dispositivo ||
            ""
          ).trim();


        /* ===================================
           VALIDAR UUID
        =================================== */

        if (
          !uuidRegex.test(
            offlineUuid
          )
        ) {
          resultados.push({
            offline_uuid:
              offlineUuid ||
              null,

            status:
              "rejeitado",

            error:
              "UUID offline inválido.",
          });

          continue;
        }


        /* ===================================
           VALIDAR FUNCIONÁRIO
        =================================== */

        if (
          !Number.isInteger(
            funcionarioId
          ) ||
          funcionarioId <= 0
        ) {
          resultados.push({
            offline_uuid:
              offlineUuid,

            status:
              "rejeitado",

            error:
              "Funcionário inválido.",
          });

          continue;
        }


        /* ===================================
           VALIDAR TIPO
        =================================== */

        if (
          !tiposPermitidos.has(
            tipo
          )
        ) {
          resultados.push({
            offline_uuid:
              offlineUuid,

            status:
              "rejeitado",

            error:
              "Tipo de batida inválido.",
          });

          continue;
        }


        /* ===================================
           VALIDAR DATA/HORA
        =================================== */

        if (!horarioDispositivo) {
          resultados.push({
            offline_uuid:
              offlineUuid,

            status:
              "rejeitado",

            error:
              "Horário do dispositivo não informado.",
          });

          continue;
        }


        const dataHora =
          new Date(
            horarioDispositivo
          );


        if (
          Number.isNaN(
            dataHora.getTime()
          )
        ) {
          resultados.push({
            offline_uuid:
              offlineUuid,

            status:
              "rejeitado",

            error:
              "Horário do dispositivo inválido.",
          });

          continue;
        }


        /* ===================================
           NÃO ACEITAR HORÁRIO MUITO À FRENTE

           Permitimos até 5 minutos para
           pequenas diferenças de relógio.
        =================================== */

        const cincoMinutos =
          5 * 60 * 1000;


        if (
          dataHora.getTime() >
          Date.now() +
          cincoMinutos
        ) {
          resultados.push({
            offline_uuid:
              offlineUuid,

            status:
              "rejeitado",

            error:
              "Horário da batida está no futuro.",
          });

          continue;
        }


        /* ===================================
           VERIFICAR DUPLICIDADE
        =================================== */

        const duplicado =
          await client.query(
            `
            SELECT
              id,
              tipo,
              marcado_em

            FROM pontos

            WHERE offline_uuid = $1

            LIMIT 1
            `,
            [
              offlineUuid,
            ]
          );


        if (
          duplicado.rows.length
        ) {
          resultados.push({
            offline_uuid:
              offlineUuid,

            status:
              "ja_sincronizado",

            ponto_id:
              duplicado.rows[0].id,
          });

          continue;
        }


        /* ===================================
           FUNCIONÁRIO DA EMPRESA

           Isso impede enviar ID de funcionário
           pertencente a outra empresa.
        =================================== */

        const funcionario =
          await buscarFuncionarioDaEmpresa(
            funcionarioId,
            empresaId
          );


        if (!funcionario) {
          resultados.push({
            offline_uuid:
              offlineUuid,

            status:
              "rejeitado",

            error:
              "Funcionário não encontrado nesta empresa.",
          });

          continue;
        }


        /* ===================================
           CONVERTER PARA HORÁRIO DE
           SÃO PAULO

           Precisamos salvar a hora em que
           realmente ocorreu a batida, e não
           o horário em que sincronizou.
        =================================== */

        const horarioSP =
          new Date(
            dataHora.toLocaleString(
              "en-US",
              {
                timeZone:
                  "America/Sao_Paulo",
              }
            )
          );


        const ano =
          horarioSP.getFullYear();


        const mes =
          String(
            horarioSP.getMonth() + 1
          ).padStart(
            2,
            "0"
          );


        const dia =
          String(
            horarioSP.getDate()
          ).padStart(
            2,
            "0"
          );


        const hora =
          String(
            horarioSP.getHours()
          ).padStart(
            2,
            "0"
          );


        const minuto =
          String(
            horarioSP.getMinutes()
          ).padStart(
            2,
            "0"
          );


        const segundo =
          String(
            horarioSP.getSeconds()
          ).padStart(
            2,
            "0"
          );


        const marcadoEm =
          `${ano}-${mes}-${dia} ` +
          `${hora}:${minuto}:${segundo}`;


        /* ===================================
           TRANSAÇÃO DA BATIDA
        =================================== */

        try {
          await client.query(
            "BEGIN"
          );


          /* =================================
             BLOQUEIO POR FUNCIONÁRIO

             Evita duas sincronizações
             simultâneas bagunçarem a ordem.
          ================================= */

          await client.query(
            `
            SELECT id

            FROM funcionarios

            WHERE id = $1
              AND empresa_id = $2

            FOR UPDATE
            `,
            [
              funcionarioId,
              empresaId,
            ]
          );


          /* =================================
             VERIFICAR NOVAMENTE UUID
             DENTRO DA TRANSAÇÃO
          ================================= */

          const uuidDentroTransacao =
            await client.query(
              `
              SELECT id

              FROM pontos

              WHERE offline_uuid = $1

              LIMIT 1
              `,
              [
                offlineUuid,
              ]
            );


          if (
            uuidDentroTransacao
              .rows.length
          ) {
            await client.query(
              "ROLLBACK"
            );

            resultados.push({
              offline_uuid:
                offlineUuid,

              status:
                "ja_sincronizado",

              ponto_id:
                uuidDentroTransacao
                  .rows[0].id,
            });

            continue;
          }


          /* =================================
             DESCOBRIR ÚLTIMA BATIDA ANTES
             DESTA BATIDA OFFLINE

             IMPORTANTE:

             Não usamos simplesmente o estado
             atual do banco.

             Se o funcionário ficou horas
             offline, podem chegar:

             08:00 entrada
             12:00 intervalo
             13:00 retorno
             17:00 saída

             Elas serão processadas em ordem
             pelo frontend posteriormente.
          ================================= */

          const ultimaAntes =
            await client.query(
              `
              SELECT
                id,
                tipo,
                marcado_em

              FROM pontos

              WHERE funcionario_id = $1
                AND empresa_id = $2
                AND marcado_em <
                    $3::timestamp
                AND marcado_em >=
                    (
                      $3::timestamp -
                      INTERVAL '36 hours'
                    )

              ORDER BY
                marcado_em DESC,
                id DESC

              LIMIT 1
              `,
              [
                funcionarioId,
                empresaId,
                marcadoEm,
              ]
            );


          const ultimaBatida =
            ultimaAntes.rows[0]
              ?.tipo ||
            null;


          const permissoes =
            getPermissoesPorUltimaBatida(
              ultimaBatida
            );


          if (!permissoes[tipo]) {
            await client.query(
              "ROLLBACK"
            );

            resultados.push({
              offline_uuid:
                offlineUuid,

              status:
                "rejeitado",

              error:
                "Sequência de batida inválida.",

              tipo_solicitado:
                tipo,

              ultima_batida:
                ultimaBatida,

              permissoes,
            });

            continue;
          }


          /* =================================
             INSERIR PONTO OFFLINE
          ================================= */

          const insert =
            await client.query(
              `
              INSERT INTO pontos (
                empresa_id,
                funcionario_id,
                tipo,
                marcado_em,

                offline_uuid,
                origem,
                marcado_offline,
                horario_dispositivo,
                sincronizado_em
              )

              VALUES (
                $1,
                $2,
                $3,
                $4::timestamp,

                $5::uuid,
                'offline',
                TRUE,
                $4::timestamp,
                NOW()
              )

              RETURNING
                id,
                empresa_id,
                funcionario_id,
                tipo,
                marcado_em,
                offline_uuid,
                origem,
                marcado_offline,
                horario_dispositivo,
                sincronizado_em
              `,
              [
                empresaId,
                funcionarioId,
                tipo,
                marcadoEm,
                offlineUuid,
              ]
            );


          const ponto =
            insert.rows[0];


          await client.query(
            "COMMIT"
          );


          /* =================================
             LOG

             Depois do COMMIT.
          ================================= */

          try {
            const nomesBatidas = {
              entrada:
                "Entrada",

              intervalo_inicio:
                "Início do intervalo",

              intervalo_fim:
                "Retorno do intervalo",

              saida:
                "Saída",
            };


            await registrarLog({
              req,

              empresa_id:
                empresaId,

              funcionario_id:
                funcionario.id,

              tipo:
                "PONTO",

              acao:
                `PONTO_OFFLINE_${tipo.toUpperCase()}`,

              descricao:
                `${funcionario.nome} teve ${nomesBatidas[tipo]} offline sincronizada.`,

              dados: {
                ponto_id:
                  ponto.id,

                offline_uuid:
                  offlineUuid,

                funcionario_id:
                  funcionario.id,

                funcionario_nome:
                  funcionario.nome,

                tipo:
                  ponto.tipo,

                marcado_em:
                  ponto.marcado_em,

                horario_dispositivo:
                  ponto.horario_dispositivo,

                sincronizado_em:
                  ponto.sincronizado_em,

                origem:
                  "terminal_offline",
              },
            });

          } catch (logError) {
            /*
              O ponto já foi salvo.

              Um problema no log não deve
              transformar uma sincronização
              concluída em erro.
            */

            console.error(
              "Erro ao registrar log da sincronização offline:",
              logError
            );
          }


          resultados.push({
            offline_uuid:
              offlineUuid,

            status:
              "sincronizado",

            ponto_id:
              ponto.id,

            funcionario_id:
              funcionario.id,

            funcionario_nome:
              funcionario.nome,

            tipo:
              ponto.tipo,

            marcado_em:
              ponto.marcado_em,

            sincronizado_em:
              ponto.sincronizado_em,
          });

        } catch (erroBatida) {
          /* =================================
             ROLLBACK DA BATIDA
          ================================= */

          try {
            await client.query(
              "ROLLBACK"
            );
          } catch (_) {
            // nada
          }


          /*
            23505 =
            violação de UNIQUE.

            Neste caso provavelmente outro
            processo acabou de sincronizar
            o mesmo UUID.
          */

          if (
            erroBatida?.code ===
            "23505"
          ) {
            resultados.push({
              offline_uuid:
                offlineUuid,

              status:
                "ja_sincronizado",
            });

            continue;
          }


          console.error(
            "Erro em uma batida offline:",
            erroBatida
          );


          resultados.push({
            offline_uuid:
              offlineUuid,

            status:
              "erro",

            error:
              "Não foi possível sincronizar esta batida.",
          });
        }
      }


      /* =====================================
         CONTADORES
      ===================================== */

      const sincronizados =
        resultados.filter(
          (item) =>
            item.status ===
            "sincronizado"
        ).length;


      const jaSincronizados =
        resultados.filter(
          (item) =>
            item.status ===
            "ja_sincronizado"
        ).length;


      const rejeitados =
        resultados.filter(
          (item) =>
            item.status ===
            "rejeitado"
        ).length;


      const erros =
        resultados.filter(
          (item) =>
            item.status ===
            "erro"
        ).length;


      /* =====================================
         RESPOSTA
      ===================================== */

      return res.json({
        ok: true,

        empresa_id:
          empresaId,

        recebidos:
          pontos.length,

        sincronizados,

        ja_sincronizados:
          jaSincronizados,

        rejeitados,

        erros,

        resultados,
      });

    } catch (err) {
      console.error(
        "Erro geral na sincronização offline:",
        err
      );


      return res
        .status(500)
        .json({
          error:
            "Erro ao sincronizar batidas offline.",
        });

    } finally {
      client.release();
    }
  };

  /* =========================================================
   BUSCAR FUNCIONÁRIO POR CPF
   + PONTOS DA JORNADA DE HOJE
========================================================= */
exports.buscarPorCPF =
  async (req, res) => {
    try {
      await garantirTabelas();

      /* =========================================
         CPF
      ========================================= */

      const cpf =
        onlyDigits(
          req.params.cpf
        );

      /* =========================================
         EMPRESA

         A empresa vem exclusivamente do JWT.
         Não confiamos em empresa_id enviado
         pelo frontend.
      ========================================= */

      const empresaId =
        Number(
          req.user?.empresa_id
        );

      console.log(
        "========== CONSULTA CPF =========="
      );

      console.log({
        cpf,
        empresaId,
        user: req.user,
      });

      /* =========================================
         VALIDAR CPF
      ========================================= */

      if (!cpf) {
        return res
          .status(400)
          .json({
            error:
              "CPF inválido.",
          });
      }

      /* =========================================
         VALIDAR EMPRESA
      ========================================= */

      if (
        !Number.isInteger(
          empresaId
        ) ||
        empresaId <= 0
      ) {
        return res
          .status(400)
          .json({
            error:
              "Empresa não informada.",
          });
      }

      /* =========================================
         EMPRESA
      ========================================= */

      const empresa =
        await buscarEmpresaAtiva(
          empresaId
        );

      if (!empresa) {
        return res
          .status(404)
          .json({
            error:
              "Empresa não encontrada ou desativada.",
          });
      }

      /* =========================================
         FUNCIONÁRIO

         CPF + empresa são obrigatórios.

         Isso impede que um terminal de uma
         empresa encontre funcionário cadastrado
         em outra empresa.
      ========================================= */

      const {
        rows: funcionarios,
      } =
        await pool.query(
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
            ON fc.id =
               f.funcao_id

          WHERE
            f.cpf = $1

            AND f.empresa_id = $2

            AND f.ativo = TRUE

          LIMIT 1
          `,
          [
            cpf,
            empresaId,
          ]
        );

      if (
        !funcionarios.length
      ) {
        return res
          .status(404)
          .json({
            error:
              "Funcionário não encontrado nesta empresa.",
          });
      }

      const funcionario =
        funcionarios[0];

      console.log(
        "👤 FUNCIONÁRIO ENCONTRADO:",
        {
          id:
            funcionario.id,

          nome:
            funcionario.nome,

          empresa_id:
            funcionario.empresa_id,
        }
      );

      /* =========================================
         DEFESA EXTRA DE EMPRESA
      ========================================= */

      if (
        Number(
          funcionario.empresa_id
        ) !== empresaId
      ) {
        console.error(
          "❌ BLOQUEIO MULTIEMPRESA:",
          {
            empresa_token:
              empresaId,

            empresa_funcionario:
              funcionario.empresa_id,

            funcionario_id:
              funcionario.id,
          }
        );

        return res
          .status(403)
          .json({
            error:
              "Funcionário não pertence a esta empresa.",
          });
      }

      /* =====================================================
         DATA DE HOJE

         Utilizamos o horário de São Paulo,
         igual ao restante do sistema.
      ===================================================== */

      const hoje =
        dataHojeISO();

      /* =====================================================
         BUSCAR PONTOS

         Buscamos a partir do início do dia atual
         até 36 horas depois.

         Isso permite encontrar jornadas como:

         dia 26:
         Entrada -> 17:30

         dia 27:
         Saída -> 05:30

         A saída continua fazendo parte da
         jornada iniciada no dia 26.
      ===================================================== */

      const {
        rows: pontosBanco,
      } =
        await pool.query(
          `
          SELECT
            p.id,
            p.empresa_id,
            p.funcionario_id,
            p.tipo,
            p.marcado_em,

            TO_CHAR(
              p.marcado_em,
              'YYYY-MM-DD'
            ) AS data,

            TO_CHAR(
              p.marcado_em,
              'HH24:MI'
            ) AS hora

          FROM pontos p

          WHERE
            p.funcionario_id = $1

            AND p.empresa_id = $2

            AND p.marcado_em >=
                $3::date

            AND p.marcado_em <
                (
                  $3::date
                  +
                  INTERVAL '36 hours'
                )

          ORDER BY
            p.marcado_em ASC,
            p.id ASC
          `,
          [
            funcionario.id,
            empresaId,
            hoje,
          ]
        );

      /* =====================================================
         SEPARAR SOMENTE JORNADAS QUE COMEÇARAM HOJE

         O período de 36 horas pode encontrar:

         - jornada iniciada hoje;
         - saída amanhã;
         - uma nova entrada amanhã.

         A nova entrada de amanhã NÃO pode
         aparecer no resumo de hoje.
      ===================================================== */

      const pontos = [];

      let jornadaIniciada =
        false;

      for (
        const ponto
        of pontosBanco
      ) {
        /* =====================================
           ENTRADA
        ===================================== */

        if (
          ponto.tipo ===
          "entrada"
        ) {
          /*
            A entrada só inicia uma jornada
            deste resumo quando ocorreu
            exatamente na data de hoje.
          */

          if (
            String(
              ponto.data
            ) === hoje
          ) {
            jornadaIniciada =
              true;

            pontos.push(
              ponto
            );
          } else {
            /*
              Encontramos uma entrada do
              dia seguinte.

              Portanto ela não pertence
              ao resumo do dia atual.
            */
            jornadaIniciada =
              false;
          }

          continue;
        }

        /* =====================================
           DEMAIS BATIDAS
        ===================================== */

        if (
          jornadaIniciada
        ) {
          pontos.push(
            ponto
          );

          /* ===================================
             SAÍDA FECHA A JORNADA
          =================================== */

          if (
            ponto.tipo ===
            "saida"
          ) {
            jornadaIniciada =
              false;
          }
        }
      }

      /* =====================================================
         LOGS DE DEBUG
      ===================================================== */

      console.log(
        "📅 DATA CONSULTADA:",
        hoje
      );

      console.log(
        "🕒 PONTOS ENCONTRADOS NO BANCO:",
        pontosBanco
      );

      console.log(
        "✅ PONTOS DO RESUMO:",
        pontos
      );

      console.log(
        "=========================================="
      );

      /* =====================================================
         NÃO REGISTRAMOS LOG DE CONSULTA CPF

         Motivo:

         Essa rota é utilizada frequentemente
         pelo terminal.

         Registrar cada consulta criaria milhares
         de logs desnecessários.

         Os eventos importantes ficam registrados:

         - Entrada
         - Intervalo
         - Retorno
         - Saída
         - Ponto manual
         - Ajustes
         - Falta
         - Folga
         - Férias
         - Falta justificada
         - Exclusão de batidas
         - Horário padrão mensal
      ===================================================== */

      /* =====================================================
         RESPOSTA
      ===================================================== */

      return res.json({
        ok: true,

        /* =====================================
           EMPRESA
        ===================================== */

        empresa: {
          id:
            empresa.id,

          nome:
            empresa.nome_fantasia ||
            empresa.nome,
        },

        /* =====================================
           FUNCIONÁRIO
        ===================================== */

        funcionario: {
          id:
            funcionario.id,

          empresa_id:
            funcionario.empresa_id,

          nome:
            funcionario.nome,

          cpf:
            funcionario.cpf,

          cnpj_empresa:
            funcionario.cnpj_empresa,

          funcao_nome:
            funcionario.funcao_nome,

          chegada:
            funcionario.chegada,

          intervalo_inicio:
            funcionario.intervalo_inicio,

          intervalo_fim:
            funcionario.intervalo_fim,

          saida:
            funcionario.saida,

          ativo:
            funcionario.ativo,
        },

        /* =====================================
           PONTOS
        ===================================== */

        pontos,

        /* =====================================
           INFORMAÇÕES AUXILIARES
        ===================================== */

        data:
          hoje,

        total_pontos:
          pontos.length,
      });

    } catch (err) {
      console.error(
        "❌ Erro ao buscar funcionário por CPF:",
        err
      );

      return res
        .status(500)
        .json({
          error:
            "Erro ao buscar funcionário por CPF.",
        });
    }
  };

