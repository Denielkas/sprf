const express = require("express");
const multer = require("multer");
const path = require("path");

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
} = require(
  "../controllers/empresaUpload.controller"
);


/* =========================================================
   STORAGE DO MULTER

   IMPORTANTE:

   Antes utilizávamos:

   multer.diskStorage()

   Isso fazia as imagens serem salvas fisicamente em:

   Back-End/uploads/empresas


   AGORA UTILIZAMOS:

   multer.memoryStorage()

   A imagem fica temporariamente na memória e estará
   disponível em:

   req.file.buffer

   Depois o controller salva esse Buffer diretamente
   no PostgreSQL utilizando BYTEA.

   Nenhum arquivo será criado dentro do projeto.
========================================================= */

const storage =
  multer.memoryStorage();


/* =========================================================
   FILTRO DE IMAGENS
========================================================= */

const fileFilter = (
  req,
  file,
  cb
) => {
  try {
    /* =====================================================
       EXTENSÃO
    ===================================================== */

    const extensao =
      path
        .extname(
          file.originalname
        )
        .toLowerCase();


    /* =====================================================
       EXTENSÕES PERMITIDAS
    ===================================================== */

    const extensoesPermitidas = [
      ".jpg",
      ".jpeg",
      ".png",
      ".webp",
    ];


    /* =====================================================
       MIME TYPES PERMITIDOS
    ===================================================== */

    const mimesPermitidos = [
      "image/jpeg",
      "image/png",
      "image/webp",
    ];


    /* =====================================================
       VALIDAR
    ===================================================== */

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
    /* =====================================================
       MEMORY STORAGE

       A imagem NÃO será salva no disco.

       Ela ficará em:

       req.file.buffer
    ===================================================== */

    storage,

    fileFilter,

    limits: {
      /* ===================================================
         TAMANHO MÁXIMO

         10 MB por imagem.
      =================================================== */

      fileSize:
        10 *
        1024 *
        1024,


      /* ===================================================
         UMA IMAGEM POR ROTA
      =================================================== */

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

   A imagem será recebida em memória e enviada pelo
   controller diretamente para o PostgreSQL.
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


   Essa rota precisa continuar pública porque a tela
   de ponto precisa conseguir carregar a logo da empresa.

   Agora a imagem será buscada diretamente no PostgreSQL.
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

   Também continua pública.

   A imagem será buscada diretamente no PostgreSQL.
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


      /* ===================================================
         OUTROS ERROS DO MULTER
      =================================================== */

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

       Passa para o tratamento global do server.js.
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