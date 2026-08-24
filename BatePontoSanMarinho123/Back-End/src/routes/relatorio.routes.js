const express = require("express");
const router = express.Router();

const PDFDocument = require("pdfkit");
const ExcelJS = require("exceljs");

const pool = require("../database/pool");

const {
  relatorioFuncionario,
  relatorioTodosFuncionarios,
} = require("../controllers/relatorio.controller");

const { auth } = require("../middlewares/auth");


/* =========================================================
   FUNÇÕES AUXILIARES
========================================================= */

function obterDadosEmpresa(cnpj = "") {
  const cnpjLimpo = String(cnpj).replace(/\D/g, "");

  if (cnpjLimpo === "52830136000122") {
    return {
      nome: "SM MARINHO LTDA",
      cnpj: "52.830.136/0001-22",
    };
  }

  if (cnpjLimpo === "60871302000167") {
    return {
      nome: "SAN MARINHO HOTEL LTDA",
      cnpj: "60.871.302/0001-67",
    };
  }

  return {
    nome: "EMPRESA NÃO INFORMADA",
    cnpj: "CNPJ NÃO INFORMADO",
  };
}


function somarSaldo(registros = []) {
  return registros.reduce((acc, item) => {
    if (
      item.folga ||
      item.atestado ||
      item.ferias ||
      item.falta ||
      item.feriado
    ) {
      return acc;
    }

    const saldo = Number(item.saldo_bruto) || 0;

    if (saldo > 0 && saldo <= 15) {
      return acc;
    }

    return acc + saldo;
  }, 0);
}


function formatarSaldoMinutos(totalMinutos = 0) {
  const total = Number(totalMinutos) || 0;

  const sinal = total < 0 ? "-" : "+";

  const abs = Math.abs(total);

  const horas = Math.floor(abs / 60);
  const minutos = abs % 60;

  return `${sinal}${horas}h ${minutos}m`;
}


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


function formatarPeriodoBonito(mes, ano) {
  return `${nomeMes(mes)}/${ano}`;
}


function limparTexto(valor, fallback = "-") {
  if (
    valor === null ||
    valor === undefined ||
    valor === ""
  ) {
    return fallback;
  }

  const texto = String(valor).trim();

  if (
    texto === "--:--" ||
    texto === "--"
  ) {
    return fallback;
  }

  return texto;
}


function textoStatus(item) {
  if (item.falta) {
    return "FALTA";
  }

  if (item.falta_justificada) {
    return "FALTA JUSTIFICADA";
  }

  if (item.feriado) {
    return "FERIADO";
  }

  if (item.folga) {
    return "FOLGA";
  }

  if (item.atestado) {
    return "ATESTADO";
  }

  if (item.ferias) {
    return "FÉRIAS";
  }

  return "-";
}


function corStatus(item) {
  if (item.falta) {
    return "FF0000";
  }

  if (item.falta_justificada) {
    return "C00000";
  }

  if (item.feriado) {
    return "FF0000";
  }

  if (item.folga) {
    return "0070C0";
  }

  if (item.atestado) {
    return "C65911";
  }

  if (item.ferias) {
    return "7030A0";
  }

  return "0070C0";
}


function corFundoStatus(item) {
  if (item.falta) {
    return "FFFFFF";
  }

  if (item.falta_justificada) {
    return "F4CCCC";
  }

  if (item.feriado) {
    return "B4C7E7";
  }

  if (item.folga) {
    return "D9EAF7";
  }

  if (item.atestado) {
    return "FCE4D6";
  }

  if (item.ferias) {
    return "E4DFEC";
  }

  return "EDEDED";
}


function getNomeDiaSemanaPorDataBR(dataBR) {
  if (!dataBR) {
    return "-";
  }

  const partes = String(dataBR).split("/");

  if (partes.length !== 3) {
    return "-";
  }

  const dia = Number(partes[0]);
  const mes = Number(partes[1]);
  const ano = Number(partes[2]);

  if (!dia || !mes || !ano) {
    return "-";
  }

  const data = new Date(
    ano,
    mes - 1,
    dia
  );

  const dias = [
    "Domingo",
    "Segunda",
    "Terça",
    "Quarta",
    "Quinta",
    "Sexta",
    "Sábado",
  ];

  return dias[data.getDay()] || "-";
}


function dataBRParaDate(dataBR) {
  if (!dataBR) {
    return null;
  }

  const partes = String(dataBR).split("/");

  if (partes.length !== 3) {
    return null;
  }

  const dia = Number(partes[0]);
  const mes = Number(partes[1]);
  const ano = Number(partes[2]);

  if (!dia || !mes || !ano) {
    return null;
  }

  return new Date(
    ano,
    mes - 1,
    dia
  );
}


/* =========================================================
   FUNÇÕES DE HORÁRIO
========================================================= */

function formatarHoraExcelAutomatico(valor) {
  if (
    valor === null ||
    valor === undefined
  ) {
    return "";
  }

  let texto = String(valor).replace(/\D/g, "");

  if (!texto) {
    return "";
  }

  if (texto.length === 1) {
    texto = `0${texto}:00`;
  } else if (texto.length === 2) {
    texto = `${texto}:00`;
  } else if (texto.length === 3) {
    texto =
      `0${texto[0]}:${texto.slice(1)}`;
  } else if (texto.length >= 4) {
    texto =
      `${texto.slice(0, 2)}:${texto.slice(2, 4)}`;
  }

  return texto;
}


function horaParaNumeroExcel(valor) {
  const textoFormatado =
    formatarHoraExcelAutomatico(valor);

  if (!textoFormatado) {
    return "";
  }

  const partes =
    textoFormatado.split(":");

  if (partes.length < 2) {
    return "";
  }

  const h = Number(partes[0]);
  const m = Number(partes[1]);

  if (
    Number.isNaN(h) ||
    Number.isNaN(m)
  ) {
    return "";
  }

  return (h * 60 + m) / 1440;
}


function horaParaTextoSemSoma(valor) {
  if (
    valor === null ||
    valor === undefined ||
    valor === "" ||
    valor === "NaN" ||
    valor === "NaN:NaN"
  ) {
    return "";
  }

  let texto = String(valor).trim();

  if (
    texto === "NaN" ||
    texto === "NaN:NaN" ||
    texto.includes("Invalid")
  ) {
    return "";
  }

  if (texto.includes(":")) {
    const partes = texto.split(":");

    const h = Number(partes[0]);
    const m = Number(partes[1]);

    if (
      Number.isNaN(h) ||
      Number.isNaN(m)
    ) {
      return "";
    }

    return (
      `${String(h).padStart(2, "0")}` +
      `${String(m).padStart(2, "0")}`
    );
  }

  texto = texto.replace(/\D/g, "");

  if (!texto) {
    return "";
  }

  if (texto.length === 3) {
    texto = `0${texto}`;
  }

  return texto.slice(0, 4);
}


function horaParaTextoPDF(valor) {
  const texto =
    limparTexto(valor, "");

  if (!texto) {
    return "-";
  }

  return texto.replace(/:/g, "");
}


function temHorario(item) {
  return !!(
    limparTexto(item.entrada, "") ||
    limparTexto(item.intervalo_inicio, "") ||
    limparTexto(item.intervalo_fim, "") ||
    limparTexto(item.saida, "")
  );
}


/* =========================================================
   FÓRMULAS EXCEL
========================================================= */

function formulaDiaSemanaExcel(rowNumber) {
  return `IF(A${rowNumber}="","",CHOOSE(WEEKDAY(A${rowNumber},1),"Domingo","Segunda","Terça","Quarta","Quinta","Sexta","Sábado"))`;
}


function formulaHDia(rowNumber) {
  return `IFERROR(
    IF(
      AND(C${rowNumber}<>"",D${rowNumber}<>"",E${rowNumber}<>"",F${rowNumber}<>""),
      
      IF(
        D${rowNumber}<C${rowNumber},
        1-C${rowNumber}+D${rowNumber},
        D${rowNumber}-C${rowNumber}
      )
      +
      IF(
        F${rowNumber}<E${rowNumber},
        1-E${rowNumber}+F${rowNumber},
        F${rowNumber}-E${rowNumber}
      ),

      IF(
        AND(
          C${rowNumber}<>"",
          D${rowNumber}<>"",
          E${rowNumber}="",
          F${rowNumber}=""
        ),

        IF(
          D${rowNumber}<C${rowNumber},
          1-C${rowNumber}+D${rowNumber},
          D${rowNumber}-C${rowNumber}
        ),

        IF(
          AND(
            C${rowNumber}<>"",
            D${rowNumber}="",
            E${rowNumber}="",
            F${rowNumber}<>""
          ),

          IF(
            F${rowNumber}<C${rowNumber},
            1-C${rowNumber}+F${rowNumber},
            F${rowNumber}-C${rowNumber}
          ),

          ""
        )
      )
    ),
    ""
  )`.replace(/\s+/g, " ");
}


function formulaAtraso(rowNumber) {
  return `IFERROR(IF(OR(A${rowNumber}="",C${rowNumber}="",G${rowNumber}=""),"",IF((VLOOKUP(B${rowNumber},$L$6:$M$13,2,FALSE)-G${rowNumber})<=0,"",VLOOKUP(B${rowNumber},$L$6:$M$13,2,FALSE)-G${rowNumber})),"")`;
}


function formulaHoraExtra(
  rowNumber,
  funcionario
) {
  const nome = String(
    funcionario.nome || ""
  )
    .trim()
    .toUpperCase();

  if (nome === "DENIEL") {
    return `IFERROR(IF(OR(A${rowNumber}="",C${rowNumber}="",G${rowNumber}=""),"",IF((G${rowNumber}-VLOOKUP(B${rowNumber},$L$6:$M$13,2,FALSE))<=0,"",G${rowNumber}-VLOOKUP(B${rowNumber},$L$6:$M$13,2,FALSE))),"")`;
  }

  return `IFERROR(IF(OR(A${rowNumber}="",C${rowNumber}="",G${rowNumber}=""),"",IF((G${rowNumber}-VLOOKUP(B${rowNumber},$L$6:$M$13,2,FALSE))<=TIME(0,15,0),"",G${rowNumber}-VLOOKUP(B${rowNumber},$L$6:$M$13,2,FALSE))),"")`;
}

/* =========================================================
   PDF
========================================================= */

function desenharTabelaFuncionario(
  doc,
  funcionario,
  dados,
  mes,
  ano
) {
  const empresa = obterDadosEmpresa(
    funcionario.cnpj_empresa
  );

  const pageWidth =
    doc.page.width -
    doc.page.margins.left -
    doc.page.margins.right;

  const x =
    doc.page.margins.left;

  let y = 25;

  /* =====================================================
     CABEÇALHO
  ===================================================== */

  doc
    .font("Helvetica-Bold")
    .fontSize(15)
    .text(
      "RELATÓRIO DE PONTO",
      x,
      y,
      {
        width: pageWidth,
        align: "center",
      }
    );

  y += 22;

  doc
    .font("Helvetica")
    .fontSize(9)
    .text(
      `Período: ${formatarPeriodoBonito(
        mes,
        ano
      )}`,
      x,
      y
    );

  y += 14;

  doc.text(
    `Funcionário: ${funcionario.nome || "-"}`,
    x,
    y
  );

  y += 14;

  doc.text(
    `CPF: ${funcionario.cpf || "-"}`,
    x,
    y
  );

  y += 14;

  doc.text(
    `Empresa: ${empresa.nome}`,
    x,
    y
  );

  y += 14;

  doc.text(
    `CNPJ: ${empresa.cnpj}`,
    x,
    y
  );

  y += 22;

  /* =====================================================
     COLUNAS
  ===================================================== */

  const colunas = [
    {
      titulo: "Data",
      largura: 52,
    },
    {
      titulo: "Dia",
      largura: 57,
    },
    {
      titulo: "Entrada",
      largura: 52,
    },
    {
      titulo: "Int. Início",
      largura: 55,
    },
    {
      titulo: "Int. Fim",
      largura: 50,
    },
    {
      titulo: "Saída",
      largura: 52,
    },
    {
      titulo: "Total",
      largura: 52,
    },
    {
      titulo: "Saldo",
      largura: 58,
    },
    {
      titulo: "Status",
      largura: 100,
    },
  ];

  const alturaCabecalho = 20;
  const alturaLinha = 18;

  /* =====================================================
     FUNÇÃO CABEÇALHO DA TABELA
  ===================================================== */

  function desenharCabecalhoTabela() {
    let atualX = x;

    doc
      .font("Helvetica-Bold")
      .fontSize(7);

    for (const coluna of colunas) {
      doc.rect(
        atualX,
        y,
        coluna.largura,
        alturaCabecalho
      ).stroke();

      doc.text(
        coluna.titulo,
        atualX + 2,
        y + 6,
        {
          width:
            coluna.largura - 4,
          align: "center",
        }
      );

      atualX += coluna.largura;
    }

    y += alturaCabecalho;
  }

  desenharCabecalhoTabela();

  /* =====================================================
     LINHAS
  ===================================================== */

  doc
    .font("Helvetica")
    .fontSize(7);

  for (const item of dados) {
    /*
      Se estiver chegando ao final da página,
      cria uma nova página.
    */
    if (
      y + alturaLinha >
      doc.page.height -
        doc.page.margins.bottom -
        25
    ) {
      doc.addPage({
        size: "A4",
        layout: "landscape",
        margin: 20,
      });

      y = 25;

      desenharCabecalhoTabela();
    }

    const diaSemana =
      getNomeDiaSemanaPorDataBR(
        item.data
      );

    const saldoMinutos =
      Number(item.saldo_bruto) || 0;

    let saldoTexto = "-";

    if (
      !item.folga &&
      !item.atestado &&
      !item.ferias &&
      !item.falta &&
      !item.feriado
    ) {
      if (
        saldoMinutos > 0 &&
        saldoMinutos <= 15
      ) {
        saldoTexto = "+0h 0m";
      } else {
        saldoTexto =
          formatarSaldoMinutos(
            saldoMinutos
          );
      }
    }

    const valores = [
      limparTexto(item.data),
      diaSemana,

      horaParaTextoPDF(
        item.entrada
      ),

      horaParaTextoPDF(
        item.intervalo_inicio
      ),

      horaParaTextoPDF(
        item.intervalo_fim
      ),

      horaParaTextoPDF(
        item.saida
      ),

      limparTexto(
        item.total_horas
      ),

      saldoTexto,

      textoStatus(item),
    ];

    let atualX = x;

    for (
      let i = 0;
      i < colunas.length;
      i++
    ) {
      const coluna = colunas[i];

      doc.rect(
        atualX,
        y,
        coluna.largura,
        alturaLinha
      ).stroke();

      doc.text(
        valores[i],
        atualX + 2,
        y + 5,
        {
          width:
            coluna.largura - 4,

          height:
            alturaLinha - 4,

          align: "center",

          ellipsis: true,
        }
      );

      atualX += coluna.largura;
    }

    y += alturaLinha;
  }

  /* =====================================================
     SALDO FINAL
  ===================================================== */

  const saldoFinal =
    somarSaldo(dados);

  y += 10;

  if (
    y + 45 >
    doc.page.height -
      doc.page.margins.bottom
  ) {
    doc.addPage({
      size: "A4",
      layout: "landscape",
      margin: 20,
    });

    y = 30;
  }

  doc
    .font("Helvetica-Bold")
    .fontSize(10)
    .text(
      `Saldo do período: ${formatarSaldoMinutos(
        saldoFinal
      )}`,
      x,
      y
    );

  y += 35;

  /* =====================================================
     ASSINATURA
  ===================================================== */

  const larguraAssinatura = 240;

  const assinaturaX =
    x +
    (
      pageWidth -
      larguraAssinatura
    ) /
      2;

  doc
    .moveTo(
      assinaturaX,
      y
    )
    .lineTo(
      assinaturaX +
        larguraAssinatura,
      y
    )
    .stroke();

  y += 5;

  doc
    .font("Helvetica")
    .fontSize(8)
    .text(
      funcionario.nome || "",
      assinaturaX,
      y,
      {
        width:
          larguraAssinatura,

        align: "center",
      }
    );
}


/* =========================================================
   EXCEL - TABELA NORMAL
========================================================= */

function criarTabelaExcelFuncionario(
  ws,
  funcionario,
  dados,
  mes,
  ano
) {
  const empresa =
    obterDadosEmpresa(
      funcionario.cnpj_empresa
    );

  /* =====================================================
     LARGURA DAS COLUNAS
  ===================================================== */

  ws.columns = [
    { width: 13 }, // A Data
    { width: 15 }, // B Dia
    { width: 12 }, // C Entrada
    { width: 12 }, // D Intervalo início
    { width: 12 }, // E Intervalo fim
    { width: 12 }, // F Saída
    { width: 13 }, // G Horas dia
    { width: 13 }, // H Atraso
    { width: 13 }, // I Hora extra
    { width: 23 }, // J Status
    { width: 3 },  // K
    { width: 15 }, // L
    { width: 15 }, // M
  ];

  /* =====================================================
     CABEÇALHO
  ===================================================== */

  ws.mergeCells("A1:J1");

  ws.getCell("A1").value =
    "RELATÓRIO DE PONTO";

  ws.getCell("A1").font = {
    bold: true,
    size: 16,
  };

  ws.getCell("A1").alignment = {
    horizontal: "center",
    vertical: "middle",
  };

  ws.getRow(1).height = 24;

  ws.mergeCells("A2:J2");

  ws.getCell("A2").value =
    `Funcionário: ${funcionario.nome || "-"}`;

  ws.getCell("A2").font = {
    bold: true,
  };

  ws.mergeCells("A3:J3");

  ws.getCell("A3").value =
    `CPF: ${funcionario.cpf || "-"}`;

  ws.mergeCells("A4:J4");

  ws.getCell("A4").value =
    `Empresa: ${empresa.nome} - CNPJ: ${empresa.cnpj}`;

  ws.mergeCells("A5:J5");

  ws.getCell("A5").value =
    `Período: ${formatarPeriodoBonito(
      mes,
      ano
    )}`;

  /* =====================================================
     CABEÇALHO DA TABELA
  ===================================================== */

  const cabecalhos = [
    "Data",
    "Dia",
    "Entrada",
    "Intervalo Início",
    "Intervalo Fim",
    "Saída",
    "Horas Dia",
    "Atraso",
    "Hora Extra",
    "Status",
  ];

  cabecalhos.forEach(
    (titulo, index) => {
      const cell =
        ws.getCell(
          6,
          index + 1
        );

      cell.value = titulo;

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

  /* =====================================================
     TABELA AUXILIAR DE CARGA HORÁRIA
     L:M
  ===================================================== */

  ws.getCell("L5").value =
    "Dia";

  ws.getCell("M5").value =
    "Carga";

  ws.getCell("L5").font = {
    bold: true,
  };

  ws.getCell("M5").font = {
    bold: true,
  };

  const tabelaCarga = [
    ["Domingo", 0],
    ["Segunda", 8],
    ["Terça", 8],
    ["Quarta", 8],
    ["Quinta", 8],
    ["Sexta", 8],
    ["Sábado", 0],
    ["Feriado", 0],
  ];

  tabelaCarga.forEach(
    (linha, index) => {
      const row =
        6 + index;

      ws.getCell(
        `L${row}`
      ).value = linha[0];

      ws.getCell(
        `M${row}`
      ).value =
        linha[1] / 24;

      ws.getCell(
        `M${row}`
      ).numFmt =
        "[h]:mm";
    }
  );

  /* =====================================================
     DADOS
  ===================================================== */

  let rowNumber = 7;

  for (const item of dados) {
    const dataObj =
      dataBRParaDate(
        item.data
      );

    const row =
      ws.getRow(
        rowNumber
      );

    /* DATA */

    row.getCell(1).value =
      dataObj || "";

    if (dataObj) {
      row.getCell(1).numFmt =
        "dd/mm/yyyy";
    }

    /* DIA */

    row.getCell(2).value = {
      formula:
        formulaDiaSemanaExcel(
          rowNumber
        ),
    };

    /* HORÁRIOS */

    row.getCell(3).value =
      horaParaNumeroExcel(
        item.entrada
      );

    row.getCell(4).value =
      horaParaNumeroExcel(
        item.intervalo_inicio
      );

    row.getCell(5).value =
      horaParaNumeroExcel(
        item.intervalo_fim
      );

    row.getCell(6).value =
      horaParaNumeroExcel(
        item.saida
      );

    for (
      let col = 3;
      col <= 6;
      col++
    ) {
      row.getCell(col).numFmt =
        "hh:mm";
    }

    /* HORAS DO DIA */

    if (
      temHorario(item)
    ) {
      row.getCell(7).value = {
        formula:
          formulaHDia(
            rowNumber
          ),
      };

      row.getCell(7).numFmt =
        "[h]:mm";
    } else {
      row.getCell(7).value =
        "";
    }

    /* ATRASO */

    if (
      !item.folga &&
      !item.atestado &&
      !item.ferias &&
      !item.falta &&
      !item.feriado
    ) {
      row.getCell(8).value = {
        formula:
          formulaAtraso(
            rowNumber
          ),
      };

      row.getCell(8).numFmt =
        "[h]:mm";
    } else {
      row.getCell(8).value =
        "";
    }

    /* HORA EXTRA */

    if (
      !item.folga &&
      !item.atestado &&
      !item.ferias &&
      !item.falta &&
      !item.feriado
    ) {
      row.getCell(9).value = {
        formula:
          formulaHoraExtra(
            rowNumber,
            funcionario
          ),
      };

      row.getCell(9).numFmt =
        "[h]:mm";
    } else {
      row.getCell(9).value =
        "";
    }

    /* STATUS */

    row.getCell(10).value =
      textoStatus(item);

    row.getCell(10).font = {
      bold:
        textoStatus(item) !== "-",

      color: {
        argb:
          corStatus(item),
      },
    };

    if (
      textoStatus(item) !== "-"
    ) {
      row.getCell(10).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: {
          argb:
            corFundoStatus(
              item
            ),
        },
      };
    }

    /* BORDAS */

    for (
      let col = 1;
      col <= 10;
      col++
    ) {
      const cell =
        row.getCell(col);

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

      cell.alignment = {
        horizontal: "center",
        vertical: "middle",
      };
    }

    rowNumber++;
  }

  /* =====================================================
     TOTAIS
  ===================================================== */

  const primeiraLinha = 7;
  const ultimaLinha =
    rowNumber - 1;

  const linhaTotal =
    rowNumber + 1;

  ws.getCell(
    `F${linhaTotal}`
  ).value = "TOTAL:";

  ws.getCell(
    `F${linhaTotal}`
  ).font = {
    bold: true,
  };

  if (
    ultimaLinha >=
    primeiraLinha
  ) {
    ws.getCell(
      `G${linhaTotal}`
    ).value = {
      formula:
        `SUM(G${primeiraLinha}:G${ultimaLinha})`,
    };

    ws.getCell(
      `H${linhaTotal}`
    ).value = {
      formula:
        `SUM(H${primeiraLinha}:H${ultimaLinha})`,
    };

    ws.getCell(
      `I${linhaTotal}`
    ).value = {
      formula:
        `SUM(I${primeiraLinha}:I${ultimaLinha})`,
    };

    ws.getCell(
      `G${linhaTotal}`
    ).numFmt = "[h]:mm";

    ws.getCell(
      `H${linhaTotal}`
    ).numFmt = "[h]:mm";

    ws.getCell(
      `I${linhaTotal}`
    ).numFmt = "[h]:mm";
  }

  for (
    let col = 6;
    col <= 9;
    col++
  ) {
    ws.getCell(
      linhaTotal,
      col
    ).font = {
      bold: true,
    };

    ws.getCell(
      linhaTotal,
      col
    ).border = {
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

  /* =====================================================
     CONGELAR CABEÇALHO
  ===================================================== */

  ws.views = [
    {
      state: "frozen",
      ySplit: 6,
    },
  ];
}


/* =========================================================
   EXCEL SEM SOMA
========================================================= */

function criarTabelaExcelSemSoma(
  ws,
  funcionario,
  dados,
  mes,
  ano
) {
  const empresa =
    obterDadosEmpresa(
      funcionario.cnpj_empresa
    );

  ws.columns = [
    { width: 13 },
    { width: 15 },
    { width: 12 },
    { width: 12 },
    { width: 12 },
    { width: 12 },
    { width: 15 },
    { width: 25 },
  ];

  /* =====================================================
     CABEÇALHO
  ===================================================== */

  ws.mergeCells("A1:H1");

  ws.getCell("A1").value =
    "RELATÓRIO DE PONTO";

  ws.getCell("A1").font = {
    bold: true,
    size: 16,
  };

  ws.getCell("A1").alignment = {
    horizontal: "center",
  };

  ws.mergeCells("A2:H2");

  ws.getCell("A2").value =
    `Funcionário: ${funcionario.nome || "-"}`;

  ws.mergeCells("A3:H3");

  ws.getCell("A3").value =
    `CPF: ${funcionario.cpf || "-"}`;

  ws.mergeCells("A4:H4");

  ws.getCell("A4").value =
    `Empresa: ${empresa.nome} - CNPJ: ${empresa.cnpj}`;

  ws.mergeCells("A5:H5");

  ws.getCell("A5").value =
    `Período: ${formatarPeriodoBonito(
      mes,
      ano
    )}`;

  const headers = [
    "Data",
    "Dia",
    "Entrada",
    "Intervalo Início",
    "Intervalo Fim",
    "Saída",
    "Total",
    "Status",
  ];

  headers.forEach(
    (titulo, index) => {
      const cell =
        ws.getCell(
          6,
          index + 1
        );

      cell.value = titulo;

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

  /* =====================================================
     DADOS
  ===================================================== */

  let rowNumber = 7;

  for (const item of dados) {
    const row =
      ws.getRow(
        rowNumber
      );

    const dataObj =
      dataBRParaDate(
        item.data
      );

    row.getCell(1).value =
      dataObj || "";

    if (dataObj) {
      row.getCell(1).numFmt =
        "dd/mm/yyyy";
    }

    row.getCell(2).value =
      getNomeDiaSemanaPorDataBR(
        item.data
      );

    row.getCell(3).value =
      horaParaTextoSemSoma(
        item.entrada
      );

    row.getCell(4).value =
      horaParaTextoSemSoma(
        item.intervalo_inicio
      );

    row.getCell(5).value =
      horaParaTextoSemSoma(
        item.intervalo_fim
      );

    row.getCell(6).value =
      horaParaTextoSemSoma(
        item.saida
      );

    row.getCell(7).value =
      limparTexto(
        item.total_horas,
        ""
      );

    row.getCell(8).value =
      textoStatus(item);

    /*
      Força horários como TEXTO.
      Ex.: 0530, 1730.
    */
    for (
      let col = 3;
      col <= 6;
      col++
    ) {
      row.getCell(col).numFmt =
        "@";
    }

    if (
      textoStatus(item) !== "-"
    ) {
      row.getCell(8).font = {
        bold: true,

        color: {
          argb:
            corStatus(item),
        },
      };

      row.getCell(8).fill = {
        type: "pattern",
        pattern: "solid",

        fgColor: {
          argb:
            corFundoStatus(
              item
            ),
        },
      };
    }

    for (
      let col = 1;
      col <= 8;
      col++
    ) {
      const cell =
        row.getCell(col);

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

      cell.alignment = {
        horizontal: "center",
        vertical: "middle",
      };
    }

    rowNumber++;
  }

  ws.views = [
    {
      state: "frozen",
      ySplit: 6,
    },
  ];
}

/* =========================================================
   MULTIEMPRESA
   DESCOBRIR EMPRESA DA REQUISIÇÃO
========================================================= */

function obterEmpresaIdDaRequisicao(req) {
  /*
    ADMIN DA EMPRESA

    A empresa vem obrigatoriamente do token.
    Não confiamos no empresa_id enviado pela URL.
  */
  if (req.user?.role === "admin_empresa") {
    const empresaId = Number(
      req.user.empresa_id
    );

    if (
      Number.isInteger(empresaId) &&
      empresaId > 0
    ) {
      return empresaId;
    }

    return null;
  }

  /*
    SUPER ADMIN

    O Super Admin pode escolher qual empresa
    deseja consultar usando:

    ?empresa_id=1
  */
  if (req.user?.role === "super_admin") {
    const empresaId = Number(
      req.query.empresa_id
    );

    if (
      Number.isInteger(empresaId) &&
      empresaId > 0
    ) {
      return empresaId;
    }

    return null;
  }

  return null;
}


/* =========================================================
   BUSCAR FUNCIONÁRIO
   MULTIEMPRESA
========================================================= */

async function buscarFuncionarioPorId(
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

  const result = await pool.query(
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
      saida

    FROM funcionarios

    WHERE id = $1
      AND empresa_id = $2
      AND ativo = true

    LIMIT 1
    `,
    [
      funcionarioIdNum,
      empresaIdNum,
    ]
  );

  return result.rows[0] || null;
}


/* =========================================================
   BUSCAR DADOS DO RELATÓRIO
   MULTIEMPRESA
========================================================= */

async function buscarDadosRelatorioFuncionario(
  funcionarioId,
  mes,
  ano,
  empresaId
) {
  /*
    Como relatorioFuncionario é um controller
    Express, criamos uma requisição interna.

    A empresa já foi validada pela rota real.
  */

  const fakeReq = {
    params: {
      id: funcionarioId,
    },

    query: {
      mes,
      ano,
      empresa_id: empresaId,
    },

    user: {
      role: "super_admin",
      empresa_id: null,
    },
  };

  let dados = null;
  let statusCode = 200;

  const fakeRes = {
    json(data) {
      dados = data;
      return data;
    },

    status(code) {
      statusCode = code;
      return this;
    },
  };

  await relatorioFuncionario(
    fakeReq,
    fakeRes
  );

  if (statusCode >= 400) {
    return [];
  }

  return Array.isArray(dados)
    ? dados
    : [];
}


/* =========================================================
   ROTAS PDF
========================================================= */


/* =========================================================
   PDF - TODOS OS FUNCIONÁRIOS
========================================================= */

router.get(
  "/pdf/todos",
  auth,
  async (req, res) => {
    const { mes, ano } = req.query;

    try {
      if (!mes || !ano) {
        return res.status(400).json({
          error: "Informe mês e ano.",
        });
      }

      const empresaId =
        obterEmpresaIdDaRequisicao(req);

      if (!empresaId) {
        return res.status(400).json({
          error: "Empresa não informada.",
        });
      }

      /* =========================================
         BUSCAR SOMENTE FUNCIONÁRIOS
         DA EMPRESA
      ========================================= */

      const funcionariosQuery =
        await pool.query(
          `
          SELECT
            id,
            empresa_id,
            nome,
            cpf,
            cnpj_empresa

          FROM funcionarios

          WHERE ativo = true
            AND empresa_id = $1

          ORDER BY nome ASC
          `,
          [empresaId]
        );

      if (
        funcionariosQuery.rows.length === 0
      ) {
        return res.status(404).json({
          error:
            "Nenhum funcionário encontrado.",
        });
      }

      /* =========================================
         CRIAR PDF
      ========================================= */

      const doc = new PDFDocument({
        size: "A4",
        layout: "landscape",
        margin: 20,
      });

      res.setHeader(
        "Content-Type",
        "application/pdf"
      );

      res.setHeader(
        "Content-Disposition",
        `inline; filename="relatorio_todos_${mes}_${ano}.pdf"`
      );

      doc.pipe(res);

      let gerouAlgumFuncionario = false;
      let primeiro = true;

      /* =========================================
         GERAR RELATÓRIO DE CADA FUNCIONÁRIO
      ========================================= */

      for (
        const funcionarioBase
        of funcionariosQuery.rows
      ) {
        const funcionario =
          await buscarFuncionarioPorId(
            funcionarioBase.id,
            empresaId
          );

        if (!funcionario) {
          continue;
        }

        const dadosFuncionario =
          await buscarDadosRelatorioFuncionario(
            funcionario.id,
            mes,
            ano,
            empresaId
          );

        if (
          !dadosFuncionario.length
        ) {
          continue;
        }

        if (!primeiro) {
          doc.addPage({
            size: "A4",
            layout: "landscape",
            margin: 20,
          });
        }

        desenharTabelaFuncionario(
          doc,
          funcionario,
          dadosFuncionario,
          mes,
          ano
        );

        primeiro = false;
        gerouAlgumFuncionario = true;
      }

      if (!gerouAlgumFuncionario) {
        doc
          .font("Helvetica")
          .fontSize(12)
          .text(
            "Nenhum registro encontrado para o período informado.",
            20,
            30
          );
      }

      doc.end();

    } catch (err) {
      console.error(
        "Erro ao gerar PDF de todos:",
        err
      );

      if (!res.headersSent) {
        return res.status(500).json({
          error:
            "Erro ao gerar PDF de todos.",
        });
      }
    }
  }
);


/* =========================================================
   PDF - UM FUNCIONÁRIO
========================================================= */

router.get(
  "/pdf/:funcId",
  auth,
  async (req, res) => {
    const { funcId } = req.params;
    const { mes, ano } = req.query;

    try {
      if (
        !funcId ||
        !mes ||
        !ano
      ) {
        return res.status(400).json({
          error:
            "Informe funcionário, mês e ano.",
        });
      }

      const empresaId =
        obterEmpresaIdDaRequisicao(req);

      if (!empresaId) {
        return res.status(400).json({
          error:
            "Empresa não informada.",
        });
      }

      /* =========================================
         FUNCIONÁRIO DA EMPRESA
      ========================================= */

      const funcionario =
        await buscarFuncionarioPorId(
          funcId,
          empresaId
        );

      if (!funcionario) {
        return res.status(404).json({
          error:
            "Funcionário não encontrado.",
        });
      }

      /* =========================================
         RELATÓRIO
      ========================================= */

      const dadosFuncionario =
        await buscarDadosRelatorioFuncionario(
          funcionario.id,
          mes,
          ano,
          empresaId
        );

      if (
        !dadosFuncionario.length
      ) {
        return res.status(404).json({
          error:
            "Nenhum registro encontrado.",
        });
      }

      /* =========================================
         GERAR PDF
      ========================================= */

      const doc =
        new PDFDocument({
          size: "A4",
          layout: "landscape",
          margin: 20,
        });

      res.setHeader(
        "Content-Type",
        "application/pdf"
      );

      res.setHeader(
        "Content-Disposition",
        `inline; filename="relatorio_${funcId}_${mes}_${ano}.pdf"`
      );

      doc.pipe(res);

      desenharTabelaFuncionario(
        doc,
        funcionario,
        dadosFuncionario,
        mes,
        ano
      );

      doc.end();

    } catch (err) {
      console.error(
        "Erro ao gerar PDF:",
        err
      );

      if (!res.headersSent) {
        return res.status(500).json({
          error:
            "Erro ao gerar PDF.",
        });
      }
    }
  }
);


/* =========================================================
   ROTAS EXCEL
========================================================= */


/* =========================================================
   EXCEL - TODOS OS FUNCIONÁRIOS
========================================================= */

router.get(
  "/excel/todos",
  auth,
  async (req, res) => {
    const { mes, ano } = req.query;

    try {
      if (!mes || !ano) {
        return res.status(400).json({
          error:
            "Informe mês e ano.",
        });
      }

      const empresaId =
        obterEmpresaIdDaRequisicao(req);

      if (!empresaId) {
        return res.status(400).json({
          error:
            "Empresa não informada.",
        });
      }

      /* =========================================
         FUNCIONÁRIOS DA EMPRESA
      ========================================= */

      const funcionariosQuery =
        await pool.query(
          `
          SELECT
            id,
            empresa_id,
            nome,
            cpf,
            cnpj_empresa

          FROM funcionarios

          WHERE ativo = true
            AND empresa_id = $1

          ORDER BY nome ASC
          `,
          [empresaId]
        );

      if (
        funcionariosQuery.rows.length === 0
      ) {
        return res.status(404).json({
          error:
            "Nenhum funcionário encontrado.",
        });
      }

      /* =========================================
         WORKBOOK
      ========================================= */

      const workbook =
        new ExcelJS.Workbook();

      workbook.creator =
        "Sistema BatePonto";

      workbook.created =
        new Date();

      workbook.properties.date1904 =
        true;

      let gerouAlgumFuncionario =
        false;

      /* =========================================
         UMA ABA POR FUNCIONÁRIO
      ========================================= */

      for (
        const funcionarioBase
        of funcionariosQuery.rows
      ) {
        const funcionario =
          await buscarFuncionarioPorId(
            funcionarioBase.id,
            empresaId
          );

        if (!funcionario) {
          continue;
        }

        const dadosFuncionario =
          await buscarDadosRelatorioFuncionario(
            funcionario.id,
            mes,
            ano,
            empresaId
          );

        if (
          !dadosFuncionario.length
        ) {
          continue;
        }

        /* =====================================
           NOME DA ABA
        ===================================== */

        let nomeAba = String(
          funcionario.nome ||
          `Func_${funcionario.id}`
        ).trim();

        if (!nomeAba) {
          nomeAba =
            `Func_${funcionario.id}`;
        }

        nomeAba = nomeAba
          .replace(
            /[\\/*?:[\]]/g,
            ""
          )
          .substring(0, 31);

        /*
          Evitar abas duplicadas.
        */

        let nomeAbaFinal =
          nomeAba;

        let contador = 2;

        while (
          workbook.getWorksheet(
            nomeAbaFinal
          )
        ) {
          const sufixo =
            `_${contador}`;

          nomeAbaFinal =
            nomeAba.substring(
              0,
              31 - sufixo.length
            ) +
            sufixo;

          contador++;
        }

        const ws =
          workbook.addWorksheet(
            nomeAbaFinal
          );

        criarTabelaExcelFuncionario(
          ws,
          funcionario,
          dadosFuncionario,
          mes,
          ano
        );

        gerouAlgumFuncionario =
          true;
      }

      if (!gerouAlgumFuncionario) {
        const ws =
          workbook.addWorksheet(
            "Relatório"
          );

        ws.getCell("A1").value =
          "Nenhum registro encontrado para o período informado.";
      }

      /* =========================================
         ENVIAR EXCEL
      ========================================= */

      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );

      res.setHeader(
        "Content-Disposition",
        `attachment; filename="relatorio_todos_${mes}_${ano}.xlsx"`
      );

      await workbook.xlsx.write(
        res
      );

      return res.end();

    } catch (err) {
      console.error(
        "Erro ao gerar Excel de todos:",
        err
      );

      if (!res.headersSent) {
        return res.status(500).json({
          error:
            "Erro ao gerar Excel de todos.",
        });
      }
    }
  }
);


/* =========================================================
   EXCEL SEM SOMA - UM FUNCIONÁRIO
========================================================= */

router.get(
  "/excel-sem-soma/:funcId",
  auth,
  async (req, res) => {
    const { funcId } = req.params;
    const { mes, ano } = req.query;

    try {
      if (
        !funcId ||
        !mes ||
        !ano
      ) {
        return res.status(400).json({
          error:
            "Informe funcionário, mês e ano.",
        });
      }

      const empresaId =
        obterEmpresaIdDaRequisicao(req);

      if (!empresaId) {
        return res.status(400).json({
          error:
            "Empresa não informada.",
        });
      }

      /* =========================================
         FUNCIONÁRIO
      ========================================= */

      const funcionario =
        await buscarFuncionarioPorId(
          funcId,
          empresaId
        );

      if (!funcionario) {
        return res.status(404).json({
          error:
            "Funcionário não encontrado.",
        });
      }

      /* =========================================
         DADOS
      ========================================= */

      const dadosFuncionario =
        await buscarDadosRelatorioFuncionario(
          funcionario.id,
          mes,
          ano,
          empresaId
        );

      if (
        !dadosFuncionario.length
      ) {
        return res.status(404).json({
          error:
            "Nenhum registro encontrado.",
        });
      }

      /* =========================================
         EXCEL
      ========================================= */

      const workbook =
        new ExcelJS.Workbook();

      workbook.creator =
        "Sistema BatePonto";

      workbook.created =
        new Date();

      const ws =
        workbook.addWorksheet(
          "Excel Sem Soma"
        );

      criarTabelaExcelSemSoma(
        ws,
        funcionario,
        dadosFuncionario,
        mes,
        ano
      );

      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );

      res.setHeader(
        "Content-Disposition",
        `attachment; filename="excel_sem_soma_${funcId}_${mes}_${ano}.xlsx"`
      );

      await workbook.xlsx.write(
        res
      );

      return res.end();

    } catch (err) {
      console.error(
        "Erro ao gerar Excel sem soma:",
        err
      );

      if (!res.headersSent) {
        return res.status(500).json({
          error:
            "Erro ao gerar Excel sem soma.",
        });
      }
    }
  }
);


/* =========================================================
   EXCEL - UM FUNCIONÁRIO
========================================================= */

router.get(
  "/excel/:funcId",
  auth,
  async (req, res) => {
    const { funcId } = req.params;
    const { mes, ano } = req.query;

    try {
      if (
        !funcId ||
        !mes ||
        !ano
      ) {
        return res.status(400).json({
          error:
            "Informe funcionário, mês e ano.",
        });
      }

      const empresaId =
        obterEmpresaIdDaRequisicao(req);

      if (!empresaId) {
        return res.status(400).json({
          error:
            "Empresa não informada.",
        });
      }

      /* =========================================
         FUNCIONÁRIO
      ========================================= */

      const funcionario =
        await buscarFuncionarioPorId(
          funcId,
          empresaId
        );

      if (!funcionario) {
        return res.status(404).json({
          error:
            "Funcionário não encontrado.",
        });
      }

      /* =========================================
         DADOS
      ========================================= */

      const dadosFuncionario =
        await buscarDadosRelatorioFuncionario(
          funcionario.id,
          mes,
          ano,
          empresaId
        );

      if (
        !dadosFuncionario.length
      ) {
        return res.status(404).json({
          error:
            "Nenhum registro encontrado.",
        });
      }

      /* =========================================
         EXCEL
      ========================================= */

      const workbook =
        new ExcelJS.Workbook();

      workbook.creator =
        "Sistema BatePonto";

      workbook.created =
        new Date();

      const ws =
        workbook.addWorksheet(
          "Relatório"
        );

      criarTabelaExcelFuncionario(
        ws,
        funcionario,
        dadosFuncionario,
        mes,
        ano
      );

      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );

      res.setHeader(
        "Content-Disposition",
        `attachment; filename="relatorio_${funcId}_${mes}_${ano}.xlsx"`
      );

      await workbook.xlsx.write(
        res
      );

      return res.end();

    } catch (err) {
      console.error(
        "Erro ao gerar Excel:",
        err
      );

      if (!res.headersSent) {
        return res.status(500).json({
          error:
            "Erro ao gerar Excel.",
        });
      }
    }
  }
);


/* =========================================================
   ROTAS JSON
========================================================= */

/*
  IMPORTANTE:

  /todos precisa ficar ANTES de /:id.

  Caso contrário, o Express poderia interpretar
  "todos" como se fosse o ID de um funcionário.
*/

router.get(
  "/todos",
  auth,
  relatorioTodosFuncionarios
);


router.get(
  "/:id",
  auth,
  relatorioFuncionario
);


/* =========================================================
   EXPORT
========================================================= */

module.exports = router;