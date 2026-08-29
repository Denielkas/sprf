const pool =
  require("../database/pool");

const {
  garantirTabelaLogs,
} = require("../services/log.service");


/* =========================================================
   LISTAR LOGS

   SOMENTE SUPER ADMIN
========================================================= */

async function listarLogs(req, res) {
  try {
    await garantirTabelaLogs();


    const {
      empresa_id,
      tipo,
      busca,
      data_inicio,
      data_fim,
      pagina = 1,
      limite = 50,
    } = req.query;


    /* =====================================================
       PAGINAÇÃO
    ===================================================== */

    let paginaNumero =
      Number(pagina);

    let limiteNumero =
      Number(limite);


    if (
      !Number.isInteger(paginaNumero) ||
      paginaNumero < 1
    ) {
      paginaNumero = 1;
    }


    if (
      !Number.isInteger(limiteNumero) ||
      limiteNumero < 1
    ) {
      limiteNumero = 50;
    }


    if (limiteNumero > 200) {
      limiteNumero = 200;
    }


    const offset =
      (paginaNumero - 1) *
      limiteNumero;


    /* =====================================================
       FILTROS
    ===================================================== */

    const filtros = [];

    const valores = [];


    /* =====================================================
       EMPRESA
    ===================================================== */

    if (
      empresa_id !== undefined &&
      empresa_id !== null &&
      empresa_id !== "" &&
      empresa_id !== "todas"
    ) {
      const empresaId =
        Number(empresa_id);


      if (
        !Number.isInteger(empresaId) ||
        empresaId <= 0
      ) {
        return res.status(400).json({
          error:
            "empresa_id inválido.",
        });
      }


      valores.push(
        empresaId
      );

      filtros.push(
        `l.empresa_id = $${valores.length}`
      );
    }


    /* =====================================================
       TIPO
    ===================================================== */

    if (
      tipo &&
      tipo !== "todos"
    ) {
      valores.push(
        String(tipo)
      );

      filtros.push(
        `l.tipo = $${valores.length}`
      );
    }


    /* =====================================================
       DATA INICIAL
    ===================================================== */

    if (data_inicio) {
      valores.push(
        data_inicio
      );

      filtros.push(
        `l.created_at >= $${valores.length}::date`
      );
    }


    /* =====================================================
       DATA FINAL

       Inclui o dia inteiro.
    ===================================================== */

    if (data_fim) {
      valores.push(
        data_fim
      );

      filtros.push(
        `l.created_at < ($${valores.length}::date + INTERVAL '1 day')`
      );
    }


    /* =====================================================
       BUSCA
    ===================================================== */

    if (
      busca &&
      String(busca).trim()
    ) {
      valores.push(
        `%${String(busca).trim()}%`
      );

      const pos =
        valores.length;

      filtros.push(`
        (
          l.username ILIKE $${pos}
          OR l.acao ILIKE $${pos}
          OR l.descricao ILIKE $${pos}
          OR e.nome ILIKE $${pos}
          OR e.nome_fantasia ILIKE $${pos}
          OR f.nome ILIKE $${pos}
        )
      `);
    }


    const where =
      filtros.length > 0
        ? `WHERE ${filtros.join(
            " AND "
          )}`
        : "";


    /* =====================================================
       TOTAL
    ===================================================== */

    const totalResult =
      await pool.query(
        `
        SELECT
          COUNT(*)::int AS total

        FROM logs_sistema l

        LEFT JOIN empresas e
          ON e.id = l.empresa_id

        LEFT JOIN funcionarios f
          ON f.id = l.funcionario_id

        ${where}
        `,
        valores
      );


    const total =
      totalResult.rows[0]?.total ||
      0;


    /* =====================================================
       LISTAGEM
    ===================================================== */

    const valoresLista = [
      ...valores,
      limiteNumero,
      offset,
    ];


    const limitePos =
      valores.length + 1;

    const offsetPos =
      valores.length + 2;


    const result =
      await pool.query(
        `
        SELECT
          l.id,

          l.empresa_id,

          COALESCE(
            e.nome_fantasia,
            e.nome,
            'Sistema'
          ) AS empresa_nome,

          l.usuario_id,

          l.username,

          l.role,

          l.funcionario_id,

          f.nome AS funcionario_nome,

          l.tipo,

          l.acao,

          l.descricao,

          l.ip,

          l.dados,

          l.created_at

        FROM logs_sistema l

        LEFT JOIN empresas e
          ON e.id = l.empresa_id

        LEFT JOIN funcionarios f
          ON f.id = l.funcionario_id

        ${where}

        ORDER BY
          l.created_at DESC,
          l.id DESC

        LIMIT $${limitePos}

        OFFSET $${offsetPos}
        `,
        valoresLista
      );


    /* =====================================================
       RESPOSTA
    ===================================================== */

    return res.json({
      ok: true,

      pagina:
        paginaNumero,

      limite:
        limiteNumero,

      total,

      total_paginas:
        Math.max(
          1,
          Math.ceil(
            total /
            limiteNumero
          )
        ),

      logs:
        result.rows,
    });

  } catch (err) {
    console.error(
      "❌ Erro ao listar logs:",
      err
    );

    return res.status(500).json({
      error:
        "Erro ao carregar logs do sistema.",
    });
  }
}


/* =========================================================
   TIPOS DISPONÍVEIS
========================================================= */

async function listarTiposLog(
  req,
  res
) {
  try {
    await garantirTabelaLogs();


    const result =
      await pool.query(`
        SELECT DISTINCT
          tipo

        FROM logs_sistema

        WHERE tipo IS NOT NULL

        ORDER BY tipo ASC
      `);


    return res.json({
      ok: true,

      tipos:
        result.rows.map(
          (item) =>
            item.tipo
        ),
    });

  } catch (err) {
    console.error(
      "❌ Erro ao listar tipos:",
      err
    );

    return res.status(500).json({
      error:
        "Erro ao carregar tipos de log.",
    });
  }
}


module.exports = {
  listarLogs,
  listarTiposLog,
};