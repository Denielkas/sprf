const pool = require("../database/pool");
const fs = require("fs");
const path = require("path");


/* =========================================================
   PASTA DE UPLOADS
========================================================= */

const PASTA_UPLOADS =
  process.env.UPLOADS_DIR ||
  path.join(
    __dirname,
    "../../uploads"
  );


/* =========================================================
   OBTER EMPRESA DA REQUISIÇÃO
========================================================= */

function obterEmpresaIdDaRequisicao(req) {
  /*
    ADMIN_EMPRESA

    A empresa SEMPRE vem do token.

    Mesmo que tente enviar outra empresa
    pelo body/query, será ignorada.
  */

  if (
    req.user?.role ===
    "admin_empresa"
  ) {
    const empresaId =
      Number(
        req.user.empresa_id
      );

    if (
      Number.isInteger(
        empresaId
      ) &&
      empresaId > 0
    ) {
      return empresaId;
    }

    return null;
  }


  /*
    SUPER_ADMIN

    Pode escolher empresa.

    GET:
    ?empresa_id=1

    POST/DELETE:
    {
      "empresa_id": 1
    }
  */

  if (
    req.user?.role ===
    "super_admin"
  ) {
    const empresaId =
      Number(
        req.query?.empresa_id ||
        req.body?.empresa_id
      );

    if (
      Number.isInteger(
        empresaId
      ) &&
      empresaId > 0
    ) {
      return empresaId;
    }

    return null;
  }


  return null;
}


/* =========================================================
   GARANTIR TABELA ATESTADOS
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


  /* =========================================
     empresa_id
  ========================================= */

  await pool.query(`
    ALTER TABLE atestados
    ADD COLUMN IF NOT EXISTS empresa_id
    BIGINT REFERENCES empresas(id)
    ON DELETE RESTRICT
  `);


  /* =========================================
     repor_horas
  ========================================= */

  await pool.query(`
    ALTER TABLE atestados
    ADD COLUMN IF NOT EXISTS repor_horas
    BOOLEAN NOT NULL DEFAULT false
  `);


  /* =========================================
     MIGRAR ATESTADOS ANTIGOS
  ========================================= */

  const migracao =
    await pool.query(`
      UPDATE atestados a

      SET empresa_id = f.empresa_id

      FROM funcionarios f

      WHERE a.funcionario_id = f.id
        AND a.empresa_id IS NULL
        AND f.empresa_id IS NOT NULL
    `);


  if (
    migracao.rowCount > 0
  ) {
    console.log(
      `✅ ${migracao.rowCount} atestado(s) antigo(s) vinculado(s) às empresas.`
    );
  }


  /* =========================================
     ÍNDICES
  ========================================= */

  await pool.query(`
    CREATE INDEX IF NOT EXISTS
    idx_atestados_empresa_id

    ON atestados(
      empresa_id
    )
  `);


  await pool.query(`
    CREATE INDEX IF NOT EXISTS
    idx_atestados_empresa_funcionario

    ON atestados(
      empresa_id,
      funcionario_id
    )
  `);


  await pool.query(`
    CREATE INDEX IF NOT EXISTS
    idx_atestados_empresa_periodo

    ON atestados(
      empresa_id,
      funcionario_id,
      data_inicio,
      data_fim
    )
  `);
}


/* =========================================================
   CONVERTER DATA BR -> ISO
========================================================= */

function converterDataBRparaISO(data) {
  if (!data) {
    return null;
  }


  const valor =
    String(data).trim();


  /*
    Aceita:

    23/08/2026
  */

  if (
    /^\d{2}\/\d{2}\/\d{4}$/.test(
      valor
    )
  ) {
    const [
      dia,
      mes,
      ano,
    ] =
      valor.split("/");


    return `${ano}-${mes}-${dia}`;
  }


  /*
    Também aceita:

    2026-08-23
  */

  if (
    /^\d{4}-\d{2}-\d{2}$/.test(
      valor
    )
  ) {
    return valor;
  }


  return null;
}


/* =========================================================
   VERIFICAR EMPRESA
========================================================= */

async function buscarEmpresa(
  empresaId
) {
  const { rows } =
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


  return rows[0] || null;
}


/* =========================================================
   VERIFICAR FUNCIONÁRIO DA EMPRESA
========================================================= */

async function buscarFuncionarioDaEmpresa(
  funcionarioId,
  empresaId,
  somenteAtivo = false
) {
  let query = `
    SELECT
      id,
      empresa_id,
      nome,
      cpf,
      ativo

    FROM funcionarios

    WHERE id = $1
      AND empresa_id = $2
  `;


  if (somenteAtivo) {
    query += `
      AND ativo = true
    `;
  }


  query += `
    LIMIT 1
  `;


  const { rows } =
    await pool.query(
      query,
      [
        funcionarioId,
        empresaId,
      ]
    );


  return rows[0] || null;
}


/* =========================================================
   REMOVER ARQUIVO FÍSICO COM SEGURANÇA
========================================================= */

function removerArquivoFisico(
  arquivo
) {
  if (!arquivo) {
    return;
  }


  const nomeSeguro =
    path.basename(
      arquivo
    );


  const caminho =
    path.join(
      PASTA_UPLOADS,
      nomeSeguro
    );


  if (
    !fs.existsSync(
      caminho
    )
  ) {
    return;
  }


  try {
    fs.unlinkSync(
      caminho
    );
  } catch (error) {
    console.error(
      "Erro ao excluir arquivo físico:",
      error
    );
  }
}


/* =========================================================
   SALVAR ATESTADO
========================================================= */

async function salvarAtestado(
  req,
  res
) {
  let arquivoRecebido = null;


  try {
    await garantirTabelaAtestados();


    const {
      funcionario_id,
      data_inicio,
      data_fim,
      repor_horas,
    } = req.body;


    /* =====================================================
       PEGAR EMPRESA CORRETAMENTE
    ===================================================== */

    const empresaId =
      obterEmpresaIdDaRequisicao(
        req
      );


    if (!empresaId) {
      if (req.file?.filename) {
        removerArquivoFisico(
          req.file.filename
        );
      }


      return res
        .status(400)
        .json({
          error:
            "Empresa não informada.",
        });
    }


    /* =====================================================
       FUNCIONÁRIO
    ===================================================== */

    const funcionarioId =
      Number(
        funcionario_id
      );


    if (
      !Number.isInteger(
        funcionarioId
      ) ||
      funcionarioId <= 0
    ) {
      if (req.file?.filename) {
        removerArquivoFisico(
          req.file.filename
        );
      }


      return res
        .status(400)
        .json({
          error:
            "Funcionário inválido.",
        });
    }


    /* =====================================================
       DATAS
    ===================================================== */

    const dataInicioISO =
      converterDataBRparaISO(
        data_inicio
      );


    const dataFimISO =
      converterDataBRparaISO(
        data_fim
      );


    if (
      !dataInicioISO ||
      !dataFimISO
    ) {
      if (req.file?.filename) {
        removerArquivoFisico(
          req.file.filename
        );
      }


      return res
        .status(400)
        .json({
          error:
            "Data de início ou data de fim inválida.",
        });
    }


    if (
      dataInicioISO >
      dataFimISO
    ) {
      if (req.file?.filename) {
        removerArquivoFisico(
          req.file.filename
        );
      }


      return res
        .status(400)
        .json({
          error:
            "A data de início não pode ser maior que a data de fim.",
        });
    }


    /* =====================================================
       EMPRESA
    ===================================================== */

    const empresa =
      await buscarEmpresa(
        empresaId
      );


    if (!empresa) {
      if (req.file?.filename) {
        removerArquivoFisico(
          req.file.filename
        );
      }


      return res
        .status(404)
        .json({
          error:
            "Empresa não encontrada.",
        });
    }


    if (!empresa.ativo) {
      if (req.file?.filename) {
        removerArquivoFisico(
          req.file.filename
        );
      }


      return res
        .status(403)
        .json({
          error:
            "Empresa desativada.",
        });
    }


    /* =====================================================
       FUNCIONÁRIO PRECISA PERTENCER À EMPRESA
    ===================================================== */

    const funcionario =
      await buscarFuncionarioDaEmpresa(
        funcionarioId,
        empresaId,
        true
      );


    if (!funcionario) {
      if (req.file?.filename) {
        removerArquivoFisico(
          req.file.filename
        );
      }


      return res
        .status(404)
        .json({
          error:
            "Funcionário não encontrado nesta empresa.",
        });
    }


    /* =====================================================
       ARQUIVO
    ===================================================== */

    if (!req.file) {
      return res
        .status(400)
        .json({
          error:
            "Arquivo PDF é obrigatório.",
        });
    }


    arquivoRecebido =
      path.basename(
        req.file.filename
      );


    const caminhoArquivo =
      path.join(
        PASTA_UPLOADS,
        arquivoRecebido
      );


    if (
      !fs.existsSync(
        caminhoArquivo
      )
    ) {
      return res
        .status(500)
        .json({
          error:
            "Arquivo não foi salvo fisicamente.",
        });
    }


    /* =====================================================
       REPOR HORAS
    ===================================================== */

    const reporHoras =
      repor_horas === true ||
      repor_horas === "true" ||
      repor_horas === 1 ||
      repor_horas === "1";


    /* =====================================================
       SALVAR
    ===================================================== */

    const { rows } =
      await pool.query(
        `
        INSERT INTO atestados (
          empresa_id,
          funcionario_id,
          data_inicio,
          data_fim,
          arquivo,
          repor_horas
        )

        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6
        )

        RETURNING
          id,
          empresa_id,
          funcionario_id,
          data_inicio,
          data_fim,
          arquivo,
          repor_horas,
          created_at
        `,
        [
          empresaId,
          funcionarioId,
          dataInicioISO,
          dataFimISO,
          arquivoRecebido,
          reporHoras,
        ]
      );


    const atestado =
      rows[0];


    /* =====================================================
       RESPOSTA

       Agora usamos o ID do atestado.
       Não precisamos expor o nome do arquivo
       na URL.
    ===================================================== */

    return res
      .status(201)
      .json({
        ok: true,

        message:
          "Atestado salvo com sucesso.",

        atestado,

        url:
          `/api/atestado/${atestado.id}/arquivo`,
      });

  } catch (error) {
    console.error(
      "🔥 ERRO AO SALVAR ATESTADO:",
      error
    );


    /*
      Se o Multer já salvou o arquivo mas
      ocorreu erro antes do INSERT, removemos
      o arquivo órfão.
    */

    if (
      arquivoRecebido
    ) {
      removerArquivoFisico(
        arquivoRecebido
      );
    }


    return res
      .status(500)
      .json({
        error:
          "Erro ao salvar atestado.",
      });
  }
}


/* =========================================================
   REMOVER ATESTADO
   MULTIEMPRESA
========================================================= */

async function removerAtestado(
  req,
  res
) {
  try {
    await garantirTabelaAtestados();


    const {
      funcionario_id,
      data,
    } = req.body;


    /* =====================================================
       EMPRESA
    ===================================================== */

    const empresaId =
      obterEmpresaIdDaRequisicao(
        req
      );


    if (!empresaId) {
      return res
        .status(400)
        .json({
          error:
            "Empresa não informada.",
        });
    }


    /* =====================================================
       FUNCIONÁRIO
    ===================================================== */

    const funcionarioId =
      Number(
        funcionario_id
      );


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


    /* =====================================================
       DATA
    ===================================================== */

    const dataISO =
      converterDataBRparaISO(
        data
      );


    if (!dataISO) {
      return res
        .status(400)
        .json({
          error:
            "Data inválida.",
        });
    }


    /* =====================================================
       EMPRESA
    ===================================================== */

    const empresa =
      await buscarEmpresa(
        empresaId
      );


    if (!empresa) {
      return res
        .status(404)
        .json({
          error:
            "Empresa não encontrada.",
        });
    }


    if (!empresa.ativo) {
      return res
        .status(403)
        .json({
          error:
            "Empresa desativada.",
        });
    }


    /* =====================================================
       FUNCIONÁRIO DA EMPRESA
    ===================================================== */

    const funcionario =
      await buscarFuncionarioDaEmpresa(
        funcionarioId,
        empresaId,
        false
      );


    if (!funcionario) {
      return res
        .status(404)
        .json({
          error:
            "Funcionário não encontrado nesta empresa.",
        });
    }


    /* =====================================================
       BUSCAR ATESTADO
    ===================================================== */

    const { rows } =
      await pool.query(
        `
        SELECT
          id,
          empresa_id,
          funcionario_id,
          arquivo

        FROM atestados

        WHERE empresa_id = $1
          AND funcionario_id = $2

          AND $3::date
            BETWEEN data_inicio
            AND data_fim

        ORDER BY id DESC

        LIMIT 1
        `,
        [
          empresaId,
          funcionarioId,
          dataISO,
        ]
      );


    if (
      rows.length === 0
    ) {
      return res
        .status(404)
        .json({
          error:
            "Atestado não encontrado para esta data.",
        });
    }


    const atestado =
      rows[0];


    /* =====================================================
       DELETE PROTEGIDO POR EMPRESA
    ===================================================== */

    const resultadoDelete =
      await pool.query(
        `
        DELETE FROM atestados

        WHERE id = $1
          AND empresa_id = $2
          AND funcionario_id = $3
        `,
        [
          atestado.id,
          empresaId,
          funcionarioId,
        ]
      );


    if (
      resultadoDelete.rowCount === 0
    ) {
      return res
        .status(404)
        .json({
          error:
            "Atestado não encontrado.",
        });
    }


    /* =====================================================
       REMOVER ARQUIVO
    ===================================================== */

    removerArquivoFisico(
      atestado.arquivo
    );


    return res.json({
      ok: true,

      empresa_id:
        empresaId,

      funcionario_id:
        funcionarioId,

      message:
        "Atestado removido com sucesso.",
    });

  } catch (error) {
    console.error(
      "🔥 ERRO AO REMOVER ATESTADO:",
      error
    );


    return res
      .status(500)
      .json({
        error:
          "Erro ao remover atestado.",
      });
  }
}


/* =========================================================
   VISUALIZAR ATESTADO PELO ID
   PROTEGIDO POR EMPRESA
========================================================= */

async function visualizarAtestado(
  req,
  res
) {
  try {
    await garantirTabelaAtestados();


    /* =====================================================
       ID DO ATESTADO
    ===================================================== */

    const atestadoId =
      Number(
        req.params.id
      );


    if (
      !Number.isInteger(
        atestadoId
      ) ||
      atestadoId <= 0
    ) {
      return res
        .status(400)
        .json({
          error:
            "ID do atestado inválido.",
        });
    }


    /* =====================================================
       EMPRESA
    ===================================================== */

    const empresaId =
      obterEmpresaIdDaRequisicao(
        req
      );


    if (!empresaId) {
      return res
        .status(400)
        .json({
          error:
            "Empresa não informada.",
        });
    }


    /* =====================================================
       EMPRESA ATIVA
    ===================================================== */

    const empresa =
      await buscarEmpresa(
        empresaId
      );


    if (!empresa) {
      return res
        .status(404)
        .json({
          error:
            "Empresa não encontrada.",
        });
    }


    if (!empresa.ativo) {
      return res
        .status(403)
        .json({
          error:
            "Empresa desativada.",
        });
    }


    /* =====================================================
       BUSCAR ATESTADO

       ID + EMPRESA
    ===================================================== */

    const { rows } =
      await pool.query(
        `
        SELECT
          a.id,
          a.empresa_id,
          a.funcionario_id,
          a.arquivo,

          f.nome AS funcionario_nome

        FROM atestados a

        INNER JOIN funcionarios f
          ON f.id =
             a.funcionario_id

         AND f.empresa_id =
             a.empresa_id

        WHERE a.id = $1
          AND a.empresa_id = $2

        LIMIT 1
        `,
        [
          atestadoId,
          empresaId,
        ]
      );


    /*
      Retornamos 404 em vez de informar
      que existe em outra empresa.
    */

    if (
      rows.length === 0
    ) {
      return res
        .status(404)
        .json({
          error:
            "Atestado não encontrado.",
        });
    }


    const atestado =
      rows[0];


    /* =====================================================
       PROTEGER CONTRA PATH TRAVERSAL
    ===================================================== */

    const nomeSeguro =
      path.basename(
        atestado.arquivo
      );


    if (
      nomeSeguro !==
      atestado.arquivo
    ) {
      console.error(
        "Nome de arquivo inválido no banco:",
        atestado.arquivo
      );


      return res
        .status(400)
        .json({
          error:
            "Arquivo inválido.",
        });
    }


    /* =====================================================
       CAMINHO FÍSICO
    ===================================================== */

    const caminhoArquivo =
      path.join(
        PASTA_UPLOADS,
        nomeSeguro
      );


    if (
      !fs.existsSync(
        caminhoArquivo
      )
    ) {
      return res
        .status(404)
        .json({
          error:
            "Arquivo físico não encontrado.",
        });
    }


    /* =====================================================
       GARANTIR QUE É ARQUIVO
    ===================================================== */

    const stats =
      fs.statSync(
        caminhoArquivo
      );


    if (
      !stats.isFile()
    ) {
      return res
        .status(404)
        .json({
          error:
            "Arquivo não encontrado.",
        });
    }


    /* =====================================================
       ENVIAR PDF
    ===================================================== */

    res.setHeader(
      "Content-Type",
      "application/pdf"
    );


    res.setHeader(
      "Content-Disposition",
      `inline; filename="atestado-${atestado.id}.pdf"`
    );


    res.setHeader(
      "X-Content-Type-Options",
      "nosniff"
    );


    res.setHeader(
      "Cache-Control",
      "private, no-store"
    );


    return res.sendFile(
      caminhoArquivo
    );

  } catch (error) {
    console.error(
      "🔥 ERRO AO VISUALIZAR ATESTADO:",
      error
    );


    if (
      !res.headersSent
    ) {
      return res
        .status(500)
        .json({
          error:
            "Erro ao abrir atestado.",
        });
    }
  }
}


/* =========================================================
   EXPORTS
========================================================= */

module.exports = {
  salvarAtestado,
  removerAtestado,
  visualizarAtestado,
};