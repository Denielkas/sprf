const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");

require("dotenv").config();

/* =========================================================
   ROTAS
========================================================= */

const authRoutes =
  require("./routes/auth.routes");

const funcionariosRoutes =
  require("./routes/funcionarios.routes");

const pontoRoutes =
  require("./routes/ponto.routes");

const relatorioRoutes =
  require("./routes/relatorio.routes");

const funcaoRoutes =
  require("./routes/funcao.routes");

const atestadoRoutes =
  require("./routes/atestado.routes");

const bancoHorasRoutes =
  require("./routes/bancoHoras.routes");

const empresaRoutes =
  require("./routes/empresa.routes");

/* =========================================================
   CNPJS DAS EMPRESAS
========================================================= */

const empresaCnpjRoutes =
  require("./routes/empresaCnpj.routes");

/* =========================================================
   UPLOADS DAS EMPRESAS
========================================================= */

const empresaUploadRoutes =
  require("./routes/empresaUpload.routes");

/* =========================================================
   LOGS DO SISTEMA

   NOVO:
   Painel de logs acessível pelo Super Admin.
========================================================= */

const logRoutes =
  require("./routes/log.routes");

/* =========================================================
   APP
========================================================= */

const app = express();

/* =========================================================
   MIDDLEWARES
========================================================= */

app.use(
  cors({
    origin: true,
    credentials: true,
  })
);

app.use(
  express.json({
    limit: "15mb",
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: "15mb",
  })
);

/* =========================================================
   PASTA DE UPLOADS

   Se UPLOADS_DIR não estiver definido:

   Back-End/
      uploads/
         empresas/
========================================================= */

const uploadsPath =
  process.env.UPLOADS_DIR
    ? path.resolve(
        process.env.UPLOADS_DIR
      )
    : path.resolve(
        __dirname,
        "../uploads"
      );

/* =========================================================
   PASTA EMPRESAS
========================================================= */

const empresasUploadsPath =
  path.join(
    uploadsPath,
    "empresas"
  );

/* =========================================================
   RELATÓRIOS
========================================================= */

const relatoriosPath =
  path.resolve(
    __dirname,
    "relatorios"
  );

/* =========================================================
   CRIAR PASTAS
========================================================= */

if (
  !fs.existsSync(
    uploadsPath
  )
) {
  fs.mkdirSync(
    uploadsPath,
    {
      recursive: true,
    }
  );
}

if (
  !fs.existsSync(
    empresasUploadsPath
  )
) {
  fs.mkdirSync(
    empresasUploadsPath,
    {
      recursive: true,
    }
  );
}

if (
  !fs.existsSync(
    relatoriosPath
  )
) {
  fs.mkdirSync(
    relatoriosPath,
    {
      recursive: true,
    }
  );
}

/* =========================================================
   DEBUG DAS PASTAS
========================================================= */

console.log(
  "=========================================="
);

console.log(
  "📂 Uploads:",
  uploadsPath
);

console.log(
  "🏢 Imagens empresas:",
  empresasUploadsPath
);

console.log(
  "📄 Relatórios:",
  relatoriosPath
);

console.log(
  "=========================================="
);

/* =========================================================
   ARQUIVOS ESTÁTICOS
========================================================= */

app.use(
  "/uploads",
  express.static(
    uploadsPath
  )
);

/* =========================================================
   RELATÓRIOS ESTÁTICOS
========================================================= */

app.use(
  "/relatorios",
  express.static(
    relatoriosPath
  )
);

/* =========================================================
   ROTA DE TESTE
========================================================= */

app.get(
  "/",
  (_req, res) => {
    return res.send(
      "API SPRF rodando com sucesso 🚀"
    );
  }
);

/* =========================================================
   TESTE DE UPLOADS
========================================================= */

app.get(
  "/api/teste-uploads",
  (_req, res) => {
    let arquivos = [];

    try {
      if (
        fs.existsSync(
          empresasUploadsPath
        )
      ) {
        arquivos =
          fs.readdirSync(
            empresasUploadsPath
          );
      }
    } catch (error) {
      console.error(
        "Erro ao listar uploads:",
        error
      );
    }

    return res.json({
      ok: true,

      uploadsPath,

      empresasUploadsPath,

      arquivos,
    });
  }
);

/* =========================================================
   AUTH
========================================================= */

app.use(
  "/api/auth",
  authRoutes
);

/* =========================================================
   EMPRESAS
========================================================= */

app.use(
  "/api/empresas",
  empresaUploadRoutes
);

app.use(
  "/api/empresas",
  empresaRoutes
);

/* =========================================================
   CNPJS DAS EMPRESAS

   GET
   /api/empresa-cnpjs

   POST
   /api/empresa-cnpjs

   PUT
   /api/empresa-cnpjs/:id

   PATCH
   /api/empresa-cnpjs/:id/principal

   DELETE
   /api/empresa-cnpjs/:id
========================================================= */

app.use(
  "/api/empresa-cnpjs",
  empresaCnpjRoutes
);

/* =========================================================
   FUNCIONÁRIOS
========================================================= */

app.use(
  "/api/funcionarios",
  funcionariosRoutes
);

/* =========================================================
   PONTO
========================================================= */

app.use(
  "/api/ponto",
  pontoRoutes
);

/* =========================================================
   RELATÓRIO
========================================================= */

app.use(
  "/api/relatorio",
  relatorioRoutes
);

/* =========================================================
   FUNÇÕES
========================================================= */

app.use(
  "/api/funcoes",
  funcaoRoutes
);

/* =========================================================
   ATESTADOS
========================================================= */

app.use(
  "/api/atestado",
  atestadoRoutes
);

/* =========================================================
   BANCO DE HORAS
========================================================= */

app.use(
  "/api/banco-horas",
  bancoHorasRoutes
);

/* =========================================================
   LOGS DO SISTEMA

   GET /api/logs
   GET /api/logs/tipos

   IMPORTANTE:
   A proteção de Super Admin fica dentro de log.routes.js.
========================================================= */

app.use(
  "/api/logs",
  logRoutes
);

/* =========================================================
   404

   SEMPRE DEVE FICAR DEPOIS DE TODAS AS ROTAS
========================================================= */

app.use(
  (req, res) => {
    return res
      .status(404)
      .json({
        error:
          "Rota não encontrada.",

        method:
          req.method,

        path:
          req.originalUrl,
      });
  }
);

/* =========================================================
   TRATAMENTO GLOBAL DE ERROS
========================================================= */

app.use(
  (
    err,
    req,
    res,
    next
  ) => {
    console.error(
      "🔥 ERRO GLOBAL:"
    );

    console.error(
      err
    );

    /* =====================================================
       ERRO DE PDF
    ===================================================== */

    if (
      err?.message ===
      "Somente arquivos PDF são permitidos."
    ) {
      return res
        .status(400)
        .json({
          error:
            err.message,
        });
    }

    /* =====================================================
       ERRO DE IMAGEM
    ===================================================== */

    if (
      err?.message ===
      "Somente imagens JPG, JPEG, PNG ou WEBP são permitidas."
    ) {
      return res
        .status(400)
        .json({
          error:
            err.message,
        });
    }

    /* =====================================================
       ARQUIVO MUITO GRANDE
    ===================================================== */

    if (
      err?.code ===
      "LIMIT_FILE_SIZE"
    ) {
      return res
        .status(400)
        .json({
          error:
            "O arquivo excede o limite de 10MB.",
        });
    }

    /* =====================================================
       MUITOS ARQUIVOS
    ===================================================== */

    if (
      err?.code ===
      "LIMIT_FILE_COUNT"
    ) {
      return res
        .status(400)
        .json({
          error:
            "Quantidade máxima de arquivos excedida.",
        });
    }

    /* =====================================================
       CAMPO DE UPLOAD ERRADO
    ===================================================== */

    if (
      err?.code ===
      "LIMIT_UNEXPECTED_FILE"
    ) {
      return res
        .status(400)
        .json({
          error:
            "Campo de arquivo inválido.",
        });
    }

    /* =====================================================
       ERRO GENÉRICO
    ===================================================== */

    return res
      .status(500)
      .json({
        error:
          "Erro interno do servidor.",
      });
  }
);

/* =========================================================
   PORTA
========================================================= */

const PORT =
  Number(
    process.env.PORT
  ) ||
  4000;

/* =========================================================
   INICIAR SERVIDOR
========================================================= */

app.listen(
  PORT,
  "0.0.0.0",
  () => {
    console.log(
      `🚀 API SPRF rodando na porta ${PORT}`
    );

    console.log(
      `🔗 Local: http://127.0.0.1:${PORT}`
    );

    console.log(
      `🖼 Teste uploads: http://127.0.0.1:${PORT}/api/teste-uploads`
    );

    console.log(
      `🏢 CNPJs: http://127.0.0.1:${PORT}/api/empresa-cnpjs`
    );

    console.log(
      `📋 Logs: http://127.0.0.1:${PORT}/api/logs`
    );
  }
);