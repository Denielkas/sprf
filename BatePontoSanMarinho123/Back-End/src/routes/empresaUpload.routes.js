const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const router = express.Router();

/* =========================================================
   MIDDLEWARES
========================================================= */

const {
  auth,
  somenteSuperAdmin,
} = require("../middlewares/auth");

/* =========================================================
   CONTROLLER
========================================================= */

const {
  uploadLogoEmpresa,
  uploadFundoEmpresa,
  visualizarLogoEmpresa,
  visualizarFundoEmpresa,
} = require("../controllers/empresaUpload.controller");

/* =========================================================
   PASTA BASE DOS UPLOADS

   IMPORTANTE:
   Essa configuração deve ser igual à utilizada no
   empresaUpload.controller.js e no server.js.

   Estrutura final:

   Back-End/
   ├── src/
   ├── uploads/
   │   └── empresas/
   │       ├── empresa-1-logo-....
   │       └── empresa-1-fundo-....
========================================================= */

const UPLOADS_DIR =
  process.env.UPLOADS_DIR ||
  path.join(
    __dirname,
    "../../uploads"
  );

const PASTA_EMPRESAS =
  path.join(
    UPLOADS_DIR,
    "empresas"
  );

/* =========================================================
   GARANTIR PASTA
========================================================= */

if (
  !fs.existsSync(
    PASTA_EMPRESAS
  )
) {
  fs.mkdirSync(
    PASTA_EMPRESAS,
    {
      recursive: true,
    }
  );
}

console.log(
  "📁 Upload de empresas:",
  PASTA_EMPRESAS
);

/* =========================================================
   STORAGE DO MULTER
========================================================= */

const storage =
  multer.diskStorage({
    /* =====================================================
       DESTINO
    ===================================================== */

    destination: (
      req,
      file,
      cb
    ) => {
      cb(
        null,
        PASTA_EMPRESAS
      );
    },

    /* =====================================================
       NOME DO ARQUIVO
    ===================================================== */

    filename: (
      req,
      file,
      cb
    ) => {
      try {
        const extensao =
          path
            .extname(
              file.originalname
            )
            .toLowerCase();

        const empresaId =
          req.params.id ||
          "sem-id";

        let tipo =
          "imagem";

        /*
          Verificamos o fieldname primeiro.

          Isso é mais seguro do que depender apenas
          da URL.
        */

        if (
          file.fieldname ===
          "arquivo"
        ) {
          if (
            req.originalUrl.includes(
              "/logo"
            )
          ) {
            tipo =
              "logo";
          }

          if (
            req.originalUrl.includes(
              "/fundo"
            )
          ) {
            tipo =
              "fundo";
          }
        }

        /* =================================================
           IDENTIFICADOR ÚNICO
        ================================================= */

        const identificador =
          `${Date.now()}-${Math.round(
            Math.random() *
              1e9
          )}`;

        /* =================================================
           NOME FINAL
        ================================================= */

        const nomeArquivo =
          `empresa-${empresaId}-${tipo}-${identificador}${extensao}`;

        console.log(
          "📄 Nome do upload:",
          nomeArquivo
        );

        return cb(
          null,
          nomeArquivo
        );
      } catch (err) {
        return cb(
          err
        );
      }
    },
  });

/* =========================================================
   FILTRO DE IMAGENS
========================================================= */

const fileFilter = (
  req,
  file,
  cb
) => {
  try {
    const extensao =
      path
        .extname(
          file.originalname
        )
        .toLowerCase();

    const extensoesPermitidas =
      [
        ".jpg",
        ".jpeg",
        ".png",
        ".webp",
      ];

    const mimesPermitidos =
      [
        "image/jpeg",
        "image/png",
        "image/webp",
      ];

    const extensaoValida =
      extensoesPermitidas.includes(
        extensao
      );

    const mimeValido =
      mimesPermitidos.includes(
        file.mimetype
      );

    /* =====================================================
       ARQUIVO INVÁLIDO
    ===================================================== */

    if (
      !extensaoValida ||
      !mimeValido
    ) {
      return cb(
        new Error(
          "Somente imagens JPG, JPEG, PNG ou WEBP são permitidas."
        )
      );
    }

    /* =====================================================
       ARQUIVO VÁLIDO
    ===================================================== */

    return cb(
      null,
      true
    );
  } catch (err) {
    return cb(
      err
    );
  }
};

/* =========================================================
   CONFIGURAÇÃO DO MULTER
========================================================= */

const upload =
  multer({
    storage,

    fileFilter,

    limits: {
      /*
        10 MB por imagem.
      */

      fileSize:
        10 *
        1024 *
        1024,

      /*
        Cada rota recebe somente uma imagem.
      */

      files: 1,
    },
  });

/* =========================================================
   UPLOAD DA LOGO

   POST:
   /api/empresas/:id/logo

   Exemplo:

   POST /api/empresas/1/logo

   Body:
   multipart/form-data

   campo:
   arquivo
========================================================= */

router.post(
  "/:id/logo",

  auth,

  somenteSuperAdmin,

  upload.single(
    "arquivo"
  ),

  uploadLogoEmpresa
);

/* =========================================================
   UPLOAD DO FUNDO

   POST:
   /api/empresas/:id/fundo

   Exemplo:

   POST /api/empresas/1/fundo

   Body:
   multipart/form-data

   campo:
   arquivo
========================================================= */

router.post(
  "/:id/fundo",

  auth,

  somenteSuperAdmin,

  upload.single(
    "arquivo"
  ),

  uploadFundoEmpresa
);

/* =========================================================
   VISUALIZAR LOGO

   GET:
   /api/empresas/:id/logo

   Exemplo:

   GET /api/empresas/1/logo

   IMPORTANTE:

   NÃO colocar:
   auth
   somenteSuperAdmin

   Essa rota precisa ser pública porque a tela de ponto
   da empresa precisa mostrar a logo.
========================================================= */

router.get(
  "/:id/logo",

  visualizarLogoEmpresa
);

/* =========================================================
   VISUALIZAR FUNDO

   GET:
   /api/empresas/:id/fundo

   Exemplo:

   GET /api/empresas/1/fundo

   Também precisa ser pública.
========================================================= */

router.get(
  "/:id/fundo",

  visualizarFundoEmpresa
);

/* =========================================================
   TRATAMENTO DOS ERROS DO MULTER
========================================================= */

router.use(
  (
    err,
    req,
    res,
    next
  ) => {
    /* =====================================================
       ERROS DO MULTER
    ===================================================== */

    if (
      err instanceof
      multer.MulterError
    ) {
      console.error(
        "❌ Erro Multer:",
        err
      );

      /* ===================================================
         ARQUIVO MUITO GRANDE
      =================================================== */

      if (
        err.code ===
        "LIMIT_FILE_SIZE"
      ) {
        return res
          .status(400)
          .json({
            error:
              "A imagem deve possuir no máximo 10MB.",
          });
      }

      /* ===================================================
         MUITOS ARQUIVOS
      =================================================== */

      if (
        err.code ===
        "LIMIT_FILE_COUNT"
      ) {
        return res
          .status(400)
          .json({
            error:
              "Envie apenas uma imagem por vez.",
          });
      }

      /* ===================================================
         CAMPO INCORRETO
      =================================================== */

      if (
        err.code ===
        "LIMIT_UNEXPECTED_FILE"
      ) {
        return res
          .status(400)
          .json({
            error:
              'Campo de arquivo inválido. Utilize o campo "arquivo".',
          });
      }

      return res
        .status(400)
        .json({
          error:
            err.message ||
            "Erro ao enviar imagem.",
        });
    }

    /* =====================================================
       TIPO DE ARQUIVO INVÁLIDO
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
       OUTROS ERROS

       Passamos para o tratamento global do server.js.
    ===================================================== */

    return next(
      err
    );
  }
);

/* =========================================================
   EXPORT
========================================================= */

module.exports =
  router;