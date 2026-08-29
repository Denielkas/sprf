const pool = require("../database/pool");
const PDFDocument = require("pdfkit");
const ExcelJS = require("exceljs");

const {
  gerarRelatorioFuncionario,
} = require("./relatorio.controller");


/* =========================================================
   FORMATAR SALDO
========================================================= */

function formatarSaldoMinutos(totalMinutos = 0) {
  const total = Number(totalMinutos) || 0;

  const sinal = total < 0 ? "-" : "+";

  const abs = Math.abs(total);

  const horas = Math.floor(abs / 60);
  const minutos = abs % 60;

  return `${sinal}${horas}h ${minutos}m`;
}


/* =========================================================
   NOME DO MÊS
========================================================= */

function nomeMes(mes) {
  const meses = [
    "",
    "Janeiro",
    "Fevereiro",
    "Março",
    "Abril",
    "Maio",
    "Junho",
    "Julho",
    "Agosto",
    "Setembro",
    "Outubro",
    "Novembro",
    "Dezembro",
  ];

  return meses[Number(mes)] || String(mes);
}


/* =========================================================
   OBTER EMPRESA DA REQUISIÇÃO

   REGRA PRINCIPAL:
   O SISTEMA DEVE IDENTIFICAR AUTOMATICAMENTE A EMPRESA
   DO USUÁRIO QUE ESTÁ LOGADO.
========================================================= */

function obterEmpresaIdDaRequisicao(req) {
  /*
    =======================================================
    1. PRIMEIRO TENTA PEGAR A EMPRESA DO USUÁRIO LOGADO
    =======================================================

    Dependendo do middleware utilizado no projeto,
    os dados podem estar em:

    req.user
    req.usuario
    req.admin

    Por isso verificamos todos.
  */

  const empresaIdUsuario = Number(
    req.user?.empresa_id ||
    req.usuario?.empresa_id ||
    req.admin?.empresa_id
  );

  if (
    Number.isInteger(empresaIdUsuario) &&
    empresaIdUsuario > 0
  ) {
    return empresaIdUsuario;
  }


  /*
    =======================================================
    DESCOBRIR ROLE
    =======================================================
  */

  const role = String(
    req.user?.role ||
    req.usuario?.role ||
    req.admin?.role ||
    ""
  ).trim();


  /*
    =======================================================
    2. SUPER ADMIN

    O super admin pode não possuir empresa fixa.

    Nesse caso ele pode informar empresa_id pela query,
    body ou params.
    =======================================================
  */

  if (role === "super_admin") {
    const empresaIdSelecionada = Number(
      req.query?.empresa_id ||
      req.body?.empresa_id ||
      req.params?.empresa_id
    );

    if (
      Number.isInteger(empresaIdSelecionada) &&
      empresaIdSelecionada > 0
    ) {
      return empresaIdSelecionada;
    }
  }


  /*
    =======================================================
    3. FALLBACK

    Mantemos compatibilidade com endpoints antigos que
    ainda estejam enviando empresa_id diretamente.
    =======================================================
  */

  const empresaIdRequisicao = Number(
    req.query?.empresa_id ||
    req.body?.empresa_id ||
    req.params?.empresa_id
  );

  if (
    Number.isInteger(empresaIdRequisicao) &&
    empresaIdRequisicao > 0
  ) {
    return empresaIdRequisicao;
  }


  /*
    =======================================================
    DEBUG

    Se chegar aqui significa que o middleware/token
    não disponibilizou empresa_id.
    =======================================================
  */

  console.error(
    "❌ Não foi possível identificar a empresa da requisição.",
    {
      user: req.user,
      usuario: req.usuario,
      admin: req.admin,
      query: req.query,
      body: req.body,
      params: req.params,
    }
  );

  return null;
}


/* =========================================================
   GARANTIR TABELA BANCO DE HORAS
   MULTIEMPRESA
========================================================= */

async function ensureBancoHorasTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS banco_horas_ajustes (
      id BIGSERIAL PRIMARY KEY,

      empresa_id BIGINT
        REFERENCES empresas(id)
        ON DELETE RESTRICT,

      funcionario_id BIGINT NOT NULL
        REFERENCES funcionarios(id)
        ON DELETE CASCADE,

      mes INTEGER NOT NULL,
      ano INTEGER NOT NULL,

      ajuste_minutos INTEGER
        NOT NULL DEFAULT 0,

      observacao TEXT,

      criado_em TIMESTAMP
        DEFAULT NOW(),

      atualizado_em TIMESTAMP
        DEFAULT NOW()
    );
  `);


  /*
    Caso a tabela seja de uma versão antiga do sistema,
    adiciona empresa_id.
  */

  await pool.query(`
    ALTER TABLE banco_horas_ajustes
    ADD COLUMN IF NOT EXISTS empresa_id
    BIGINT REFERENCES empresas(id)
    ON DELETE RESTRICT
  `);


  /* =====================================================
     MIGRAR AJUSTES ANTIGOS

     Descobre empresa_id através do funcionário.
  ===================================================== */

  const migracao = await pool.query(`
    UPDATE banco_horas_ajustes bha

    SET empresa_id = f.empresa_id

    FROM funcionarios f

    WHERE bha.funcionario_id = f.id
      AND bha.empresa_id IS NULL
      AND f.empresa_id IS NOT NULL
  `);


  if (migracao.rowCount > 0) {
    console.log(
      `✅ ${migracao.rowCount} ajuste(s) antigo(s) do banco de horas migrado(s) para empresas.`
    );
  }


  /* =====================================================
     REMOVER UNIQUE ANTIGO
  ===================================================== */

  await pool.query(`
    DO $$
    DECLARE
      constraint_name TEXT;
    BEGIN

      SELECT tc.constraint_name
      INTO constraint_name

      FROM information_schema.table_constraints tc

      WHERE tc.table_name = 'banco_horas_ajustes'
        AND tc.constraint_type = 'UNIQUE'
        AND tc.constraint_name <>
          'banco_horas_ajustes_empresa_func_mes_ano_key'

      LIMIT 1;

      IF constraint_name IS NOT NULL THEN
        EXECUTE format(
          'ALTER TABLE banco_horas_ajustes DROP CONSTRAINT IF EXISTS %I',
          constraint_name
        );
      END IF;

    END $$;
  `);


  /* =====================================================
     NOVA CONSTRAINT MULTIEMPRESA
  ===================================================== */

  await pool.query(`
    DO $$
    BEGIN

      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname =
          'banco_horas_ajustes_empresa_func_mes_ano_key'
      ) THEN

        ALTER TABLE banco_horas_ajustes

        ADD CONSTRAINT
          banco_horas_ajustes_empresa_func_mes_ano_key

        UNIQUE (
          empresa_id,
          funcionario_id,
          mes,
          ano
        );

      END IF;

    END $$;
  `);


  /* =====================================================
     ÍNDICES
  ===================================================== */

  await pool.query(`
    CREATE INDEX IF NOT EXISTS
      idx_banco_horas_empresa

    ON banco_horas_ajustes(
      empresa_id
    )
  `);


  await pool.query(`
    CREATE INDEX IF NOT EXISTS
      idx_banco_horas_empresa_funcionario

    ON banco_horas_ajustes(
      empresa_id,
      funcionario_id
    )
  `);


  await pool.query(`
    CREATE INDEX IF NOT EXISTS
      idx_banco_horas_empresa_periodo

    ON banco_horas_ajustes(
      empresa_id,
      mes,
      ano
    )
  `);
}


/* =========================================================
   BUSCAR EMPRESA
========================================================= */

async function buscarEmpresaPorId(empresaId) {
  const empresaIdNum = Number(empresaId);

  if (
    !Number.isInteger(empresaIdNum) ||
    empresaIdNum <= 0
  ) {
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

    LIMIT 1
    `,
    [empresaIdNum]
  );


  return rows[0] || null;
}


/* =========================================================
   BUSCAR FUNCIONÁRIO DA EMPRESA
========================================================= */

async function buscarFuncionarioDaEmpresa(
  funcionarioId,
  empresaId
) {
  const funcionarioIdNum =
    Number(funcionarioId);

  const empresaIdNum =
    Number(empresaId);


  if (
    !Number.isInteger(funcionarioIdNum) ||
    funcionarioIdNum <= 0 ||
    !Number.isInteger(empresaIdNum) ||
    empresaIdNum <= 0
  ) {
    return null;
  }


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

    LIMIT 1
    `,
    [
      funcionarioIdNum,
      empresaIdNum,
    ]
  );


  return rows[0] || null;
}


/* =========================================================
   GERAR RELATÓRIO DO FUNCIONÁRIO
========================================================= */

async function gerarRelatorioSeguro(
  funcionarioId,
  mes,
  ano,
  empresaId
) {
  const relatorio =
    await gerarRelatorioFuncionario(
      funcionarioId,
      mes,
      ano,
      empresaId
    );


  return Array.isArray(relatorio)
    ? relatorio
    : [];
}


/* =========================================================
   BUSCAR BANCO DE HORAS
========================================================= */

async function buscarBancoHorasInterno(
  mes,
  ano,
  funcionarioId,
  empresaId
) {
  let funcionariosQuery;


  /* =====================================================
     UM FUNCIONÁRIO
  ===================================================== */

  if (
    funcionarioId &&
    funcionarioId !== "todos"
  ) {
    funcionariosQuery =
      await pool.query(
        `
        SELECT
          id,
          empresa_id,
          nome,
          cpf

        FROM funcionarios

        WHERE id = $1
          AND empresa_id = $2

        ORDER BY nome ASC
        `,
        [
          Number(funcionarioId),
          Number(empresaId),
        ]
      );
  }


  /* =====================================================
     TODOS OS FUNCIONÁRIOS DA EMPRESA
  ===================================================== */

  else {
    funcionariosQuery =
      await pool.query(
        `
        SELECT
          id,
          empresa_id,
          nome,
          cpf

        FROM funcionarios

        WHERE empresa_id = $1

        ORDER BY nome ASC
        `,
        [Number(empresaId)]
      );
  }


  const funcionarios =
    funcionariosQuery.rows;


  const resultado = [];


  /* =====================================================
     CALCULAR FUNCIONÁRIO POR FUNCIONÁRIO
  ===================================================== */

  for (const funcionario of funcionarios) {
    const relatorio =
      await gerarRelatorioSeguro(
        funcionario.id,
        mes,
        ano,
        empresaId
      );


    /* ===================================================
       SALDO CALCULADO PELO SISTEMA
    =================================================== */

    const saldoSistema =
      relatorio.reduce(
        (acc, item) => {
          return (
            acc +
            (
              Number(
                item.saldo_bruto
              ) || 0
            )
          );
        },
        0
      );


    /* ===================================================
       AJUSTE MANUAL
    =================================================== */

    const ajusteQuery =
      await pool.query(
        `
        SELECT
          ajuste_minutos,
          observacao

        FROM banco_horas_ajustes

        WHERE empresa_id = $1
          AND funcionario_id = $2
          AND mes = $3
          AND ano = $4

        LIMIT 1
        `,
        [
          Number(empresaId),
          funcionario.id,
          Number(mes),
          Number(ano),
        ]
      );


    const ajuste =
      ajusteQuery.rows[0] || {
        ajuste_minutos: 0,
        observacao: "",
      };


    const ajusteMinutos =
      Number(
        ajuste.ajuste_minutos
      ) || 0;


    const observacao =
      String(
        ajuste.observacao || ""
      ).trim();


    /*
      Se a observação for exatamente "pago",
      o saldo final fica zerado.
    */

    const saldoFinal =
      observacao.toLowerCase() === "pago"
        ? 0
        : saldoSistema + ajusteMinutos;


    resultado.push({
      funcionario_id:
        funcionario.id,

      empresa_id:
        funcionario.empresa_id,

      nome:
        funcionario.nome,

      cpf:
        funcionario.cpf,

      saldo_sistema_minutos:
        saldoSistema,

      saldo_sistema_formatado:
        formatarSaldoMinutos(
          saldoSistema
        ),

      ajuste_minutos:
        ajusteMinutos,

      ajuste_formatado:
        formatarSaldoMinutos(
          ajusteMinutos
        ),

      observacao,

      saldo_final_minutos:
        saldoFinal,

      saldo_final_formatado:
        formatarSaldoMinutos(
          saldoFinal
        ),
    });
  }


  return resultado;
}


/* =========================================================
   LISTAR BANCO DE HORAS
========================================================= */

async function listarBancoHoras(req, res) {
  try {
    await ensureBancoHorasTable();


    const {
      mes,
      ano,
      funcionario_id,
    } = req.query;


    if (!mes || !ano) {
      return res.status(400).json({
        error:
          "Informe mês e ano.",
      });
    }


    /* ===================================================
       IDENTIFICAR EMPRESA AUTOMATICAMENTE
    =================================================== */

    const empresaId =
      obterEmpresaIdDaRequisicao(req);


    if (!empresaId) {
      return res.status(400).json({
        error:
          "Não foi possível identificar a empresa do usuário logado.",
      });
    }


    /* ===================================================
       VERIFICAR EMPRESA
    =================================================== */

    const empresa =
      await buscarEmpresaPorId(
        empresaId
      );


    if (!empresa) {
      return res.status(404).json({
        error:
          "Empresa não encontrada.",
      });
    }


    if (!empresa.ativo) {
      return res.status(403).json({
        error:
          "Empresa desativada.",
      });
    }


    /* ===================================================
       VERIFICAR FUNCIONÁRIO
    =================================================== */

    if (
      funcionario_id &&
      funcionario_id !== "todos"
    ) {
      const funcionario =
        await buscarFuncionarioDaEmpresa(
          funcionario_id,
          empresaId
        );


      if (!funcionario) {
        return res.status(404).json({
          error:
            "Funcionário não encontrado nesta empresa.",
        });
      }
    }


    const dados =
      await buscarBancoHorasInterno(
        mes,
        ano,
        funcionario_id,
        empresaId
      );


    return res.json(dados);

  } catch (err) {
    console.error(
      "Erro ao listar banco de horas:",
      err
    );


    return res.status(500).json({
      error:
        "Erro ao listar banco de horas.",

      detalhe:
        err.message,
    });
  }
}


/* =========================================================
   SALVAR AJUSTE
========================================================= */

async function salvarAjusteBancoHoras(
  req,
  res
) {
  try {
    await ensureBancoHorasTable();


    const {
      funcionario_id,
      mes,
      ano,
      ajuste_minutos,
      observacao,
    } = req.body;


    if (
      !funcionario_id ||
      !mes ||
      !ano
    ) {
      return res.status(400).json({
        error:
          "Funcionário, mês e ano são obrigatórios.",
      });
    }


    /* ===================================================
       IDENTIFICAR EMPRESA AUTOMATICAMENTE
    =================================================== */

    const empresaId =
      obterEmpresaIdDaRequisicao(req);


    if (!empresaId) {
      return res.status(400).json({
        error:
          "Não foi possível identificar a empresa do usuário logado.",
      });
    }


    /* ===================================================
       VERIFICAR EMPRESA
    =================================================== */

    const empresa =
      await buscarEmpresaPorId(
        empresaId
      );


    if (!empresa) {
      return res.status(404).json({
        error:
          "Empresa não encontrada.",
      });
    }


    if (!empresa.ativo) {
      return res.status(403).json({
        error:
          "Empresa desativada.",
      });
    }


    /* ===================================================
       VERIFICAR FUNCIONÁRIO
    =================================================== */

    const funcionario =
      await buscarFuncionarioDaEmpresa(
        funcionario_id,
        empresaId
      );


    if (!funcionario) {
      return res.status(404).json({
        error:
          "Funcionário não encontrado nesta empresa.",
      });
    }


    if (!funcionario.ativo) {
      return res.status(400).json({
        error:
          "Não é possível ajustar banco de horas de funcionário inativo.",
      });
    }


    /* ===================================================
       SALVAR
    =================================================== */

    await pool.query(
      `
      INSERT INTO banco_horas_ajustes (
        empresa_id,
        funcionario_id,
        mes,
        ano,
        ajuste_minutos,
        observacao,
        atualizado_em
      )

      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        NOW()
      )

      ON CONFLICT (
        empresa_id,
        funcionario_id,
        mes,
        ano
      )

      DO UPDATE SET
        ajuste_minutos =
          EXCLUDED.ajuste_minutos,

        observacao =
          EXCLUDED.observacao,

        atualizado_em =
          NOW()
      `,
      [
        Number(empresaId),
        funcionario.id,
        Number(mes),
        Number(ano),
        Number(ajuste_minutos) || 0,
        String(
          observacao || ""
        ).trim(),
      ]
    );


    return res.json({
      ok: true,

      message:
        "Ajuste salvo com sucesso.",

      empresa_id:
        empresaId,

      funcionario_id:
        funcionario.id,
    });

  } catch (err) {
    console.error(
      "Erro ao salvar ajuste:",
      err
    );


    return res.status(500).json({
      error:
        "Erro ao salvar ajuste.",

      detalhe:
        err.message,
    });
  }
}


/* =========================================================
   PDF BANCO DE HORAS
========================================================= */

async function gerarPdfBancoHoras(
  req,
  res
) {
  try {
    await ensureBancoHorasTable();


    const {
      mes,
      ano,
      funcionario_id,
    } = req.query;


    if (!mes || !ano) {
      return res.status(400).json({
        error:
          "Informe mês e ano.",
      });
    }


    /* ===================================================
       IDENTIFICAR EMPRESA AUTOMATICAMENTE
    =================================================== */

    const empresaId =
      obterEmpresaIdDaRequisicao(req);


    if (!empresaId) {
      return res.status(400).json({
        error:
          "Não foi possível identificar a empresa do usuário logado.",
      });
    }


    /* ===================================================
       EMPRESA
    =================================================== */

    const empresa =
      await buscarEmpresaPorId(
        empresaId
      );


    if (!empresa) {
      return res.status(404).json({
        error:
          "Empresa não encontrada.",
      });
    }


    if (!empresa.ativo) {
      return res.status(403).json({
        error:
          "Empresa desativada.",
      });
    }


    /* ===================================================
       FUNCIONÁRIO OPCIONAL
    =================================================== */

    if (
      funcionario_id &&
      funcionario_id !== "todos"
    ) {
      const funcionario =
        await buscarFuncionarioDaEmpresa(
          funcionario_id,
          empresaId
        );


      if (!funcionario) {
        return res.status(404).json({
          error:
            "Funcionário não encontrado nesta empresa.",
        });
      }
    }


    const dados =
      await buscarBancoHorasInterno(
        mes,
        ano,
        funcionario_id,
        empresaId
      );


    if (!dados.length) {
      return res.status(404).json({
        error:
          "Nenhum dado encontrado.",
      });
    }


    /* ===================================================
       CRIAR PDF
    =================================================== */

    const doc =
      new PDFDocument({
        margin: 30,
        size: "A4",
        layout: "landscape",
      });


    res.setHeader(
      "Content-Type",
      "application/pdf"
    );


    res.setHeader(
      "Content-Disposition",
      `inline; filename="banco_horas_${mes}_${ano}.pdf"`
    );


    doc.pipe(res);


    /* ===================================================
       CABEÇALHO
    =================================================== */

    doc
      .font("Helvetica-Bold")
      .fontSize(20)
      .text(
        "Banco de Horas",
        30,
        25
      );


    doc
      .font("Helvetica")
      .fontSize(11)
      .text(
        `Empresa: ${
          empresa.nome_fantasia ||
          empresa.nome
        }`,
        30,
        52
      );


    doc.text(
      `Período: ${nomeMes(mes)}/${ano}`,
      30,
      68
    );


    let y = 105;


    const colunas = {
      nome: 30,
      horas: 300,
      ajuste: 420,
      observacao: 530,
      saldo: 710,
    };


    function desenharCabecalho() {
      doc.save();


      doc
        .rect(
          30,
          y - 4,
          760,
          24
        )
        .fill("#1E293B");


      doc.restore();


      doc
        .fillColor("#FFFFFF")
        .font("Helvetica-Bold")
        .fontSize(10);


      doc.text(
        "Funcionário",
        colunas.nome,
        y
      );


      doc.text(
        "Horas",
        colunas.horas,
        y
      );


      doc.text(
        "Ajuste",
        colunas.ajuste,
        y
      );


      doc.text(
        "Observação",
        colunas.observacao,
        y
      );


      doc.text(
        "Saldo",
        colunas.saldo,
        y
      );


      doc.fillColor("#000000");


      y += 26;
    }


    desenharCabecalho();


    dados.forEach(
      (item, index) => {

        if (y > 520) {
          doc.addPage({
            margin: 30,
            size: "A4",
            layout: "landscape",
          });


          y = 40;


          desenharCabecalho();
        }


        if (index % 2 === 0) {
          doc.save();


          doc
            .rect(
              30,
              y - 3,
              760,
              22
            )
            .fill("#F8FAFC");


          doc.restore();
        }


        doc
          .font("Helvetica")
          .fontSize(10)
          .fillColor("#111827");


        doc.text(
          item.nome || "-",
          colunas.nome,
          y,
          {
            width: 250,
          }
        );


        doc.text(
          item.saldo_sistema_formatado ||
            "-",
          colunas.horas,
          y,
          {
            width: 90,
          }
        );


        doc.text(
          item.ajuste_formatado ||
            "-",
          colunas.ajuste,
          y,
          {
            width: 90,
          }
        );


        doc.text(
          item.observacao || "-",
          colunas.observacao,
          y,
          {
            width: 150,
          }
        );


        doc.text(
          item.saldo_final_formatado ||
            "-",
          colunas.saldo,
          y,
          {
            width: 80,
          }
        );


        y += 24;
      }
    );


    doc.end();

  } catch (err) {
    console.error(
      "Erro ao gerar PDF do banco de horas:",
      err
    );


    if (!res.headersSent) {
      return res.status(500).json({
        error:
          "Erro ao gerar PDF do banco de horas.",

        detalhe:
          err.message,
      });
    }
  }
}


/* =========================================================
   EXCEL BANCO DE HORAS
========================================================= */

async function gerarExcelBancoHoras(
  req,
  res
) {
  try {
    await ensureBancoHorasTable();


    const {
      mes,
      ano,
      funcionario_id,
    } = req.query;


    if (!mes || !ano) {
      return res.status(400).json({
        error:
          "Informe mês e ano.",
      });
    }


    /* ===================================================
       IDENTIFICAR EMPRESA AUTOMATICAMENTE
    =================================================== */

    const empresaId =
      obterEmpresaIdDaRequisicao(req);


    if (!empresaId) {
      return res.status(400).json({
        error:
          "Não foi possível identificar a empresa do usuário logado.",
      });
    }


    /* ===================================================
       EMPRESA
    =================================================== */

    const empresa =
      await buscarEmpresaPorId(
        empresaId
      );


    if (!empresa) {
      return res.status(404).json({
        error:
          "Empresa não encontrada.",
      });
    }


    if (!empresa.ativo) {
      return res.status(403).json({
        error:
          "Empresa desativada.",
      });
    }


    /* ===================================================
       FUNCIONÁRIO OPCIONAL
    =================================================== */

    if (
      funcionario_id &&
      funcionario_id !== "todos"
    ) {
      const funcionario =
        await buscarFuncionarioDaEmpresa(
          funcionario_id,
          empresaId
        );


      if (!funcionario) {
        return res.status(404).json({
          error:
            "Funcionário não encontrado nesta empresa.",
        });
      }
    }


    const dados =
      await buscarBancoHorasInterno(
        mes,
        ano,
        funcionario_id,
        empresaId
      );


    if (!dados.length) {
      return res.status(404).json({
        error:
          "Nenhum dado encontrado.",
      });
    }


    /* ===================================================
       WORKBOOK
    =================================================== */

    const workbook =
      new ExcelJS.Workbook();


    workbook.creator =
      "Sistema BatePonto";


    workbook.created =
      new Date();


    const sheet =
      workbook.addWorksheet(
        "Banco de Horas"
      );


    /* ===================================================
       LARGURA DAS COLUNAS
    =================================================== */

    sheet.getColumn("A").width = 35;
    sheet.getColumn("B").width = 18;
    sheet.getColumn("C").width = 18;
    sheet.getColumn("D").width = 25;
    sheet.getColumn("E").width = 18;


    /* ===================================================
       CABEÇALHO
    =================================================== */

    sheet.mergeCells("A1:E1");


    sheet.getCell("A1").value =
      "Banco de Horas";


    sheet.getCell("A1").font = {
      bold: true,
      size: 16,
    };


    sheet.getCell("A1").alignment = {
      horizontal: "center",
      vertical: "middle",
    };


    sheet.mergeCells("A2:E2");


    sheet.getCell("A2").value =
      `Empresa: ${
        empresa.nome_fantasia ||
        empresa.nome
      }`;


    sheet.getCell("A2").alignment = {
      horizontal: "center",
      vertical: "middle",
    };


    sheet.mergeCells("A3:E3");


    sheet.getCell("A3").value =
      `Período: ${nomeMes(mes)}/${ano}`;


    sheet.getCell("A3").alignment = {
      horizontal: "center",
      vertical: "middle",
    };


    /* ===================================================
       CABEÇALHO DA TABELA
    =================================================== */

    const headerRow =
      sheet.getRow(5);


    headerRow.values = [
      "Funcionário",
      "Horas",
      "Ajuste",
      "Observação",
      "Saldo",
    ];


    headerRow.eachCell(
      (cell) => {

        cell.font = {
          bold: true,
        };


        cell.alignment = {
          horizontal: "center",
          vertical: "middle",
        };


        cell.fill = {
          type: "pattern",
          pattern: "solid",

          fgColor: {
            argb: "D9E1F2",
          },
        };


        cell.border = {
          top: {
            style: "thin",
          },

          left: {
            style: "thin",
          },

          bottom: {
            style: "thin",
          },

          right: {
            style: "thin",
          },
        };
      }
    );


    /* ===================================================
       DADOS
    =================================================== */

    let linha = 6;


    dados.forEach(
      (item) => {

        const row =
          sheet.getRow(linha);


        row.values = [
          item.nome || "-",

          item.saldo_sistema_formatado ||
            "-",

          item.ajuste_formatado ||
            "-",

          item.observacao || "-",

          item.saldo_final_formatado ||
            "-",
        ];


        row.eachCell(
          (cell) => {

            cell.alignment = {
              horizontal: "center",
              vertical: "middle",
            };


            cell.border = {
              top: {
                style: "thin",
              },

              left: {
                style: "thin",
              },

              bottom: {
                style: "thin",
              },

              right: {
                style: "thin",
              },
            };
          }
        );


        linha++;
      }
    );


    /* ===================================================
       ENVIAR EXCEL
    =================================================== */

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );


    res.setHeader(
      "Content-Disposition",
      `attachment; filename="banco_horas_${mes}_${ano}.xlsx"`
    );


    await workbook.xlsx.write(res);


    return res.end();

  } catch (err) {
    console.error(
      "Erro ao gerar Excel do banco de horas:",
      err
    );


    if (!res.headersSent) {
      return res.status(500).json({
        error:
          "Erro ao gerar Excel do banco de horas.",

        detalhe:
          err.message,
      });
    }
  }
}


/* =========================================================
   EXPORTS
========================================================= */

module.exports = {
  listarBancoHoras,
  salvarAjusteBancoHoras,
  gerarPdfBancoHoras,
  gerarExcelBancoHoras,
};