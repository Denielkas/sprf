const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const {
  salvarAtestado,
  removerAtestado,
  visualizarAtestado,
} = require("../controllers/atestado.controller");

const {
  auth,
} = require("../middlewares/auth");


const router = express.Router();


/* =========================================================
   PASTA DE UPLOADS
========================================================= */

const PASTA_UPLOADS =
  process.env.UPLOADS_DIR ||
  path.join(
    __dirname,
    "../../uploads"
  );


if (
  !fs.existsSync(
    PASTA_UPLOADS
  )
) {
  fs.mkdirSync(
    PASTA_UPLOADS,
    {
      recursive: true,
    }
  );
}


/* =========================================================
   CONFIGURAÇÃO DO MULTER
========================================================= */

const storage =
  multer.diskStorage({
    destination: (
      req,
      file,
      cb
    ) => {
      cb(
        null,
        PASTA_UPLOADS
      );
    },


    filename: (
      req,
      file,
      cb
    ) => {
      /*
        Não usamos o nome original enviado
        pelo usuário como nome físico.
      */

      const extensao =
        path.extname(
          file.originalname
        ).toLowerCase();


      const nomeArquivo =
        `atestado-${Date.now()}-${Math.round(
          Math.random() *
            1e9
        )}${extensao}`;


      cb(
        null,
        nomeArquivo
      );
    },
  });


/* =========================================================
   FILTRO DE ARQUIVOS
========================================================= */

const fileFilter = (
  req,
  file,
  cb
) => {
  const extensao =
    path.extname(
      file.originalname
    ).toLowerCase();


  /*
    Conferimos MIME + extensão.
  */

  const mimePermitido =
    file.mimetype ===
      "application/pdf" ||
    file.mimetype ===
      "application/x-pdf";


  const extensaoPermitida =
    extensao === ".pdf";


  if (
    !mimePermitido ||
    !extensaoPermitida
  ) {
    return cb(
      new Error(
        "Somente arquivos PDF são permitidos."
      )
    );
  }


  return cb(
    null,
    true
  );
};


/* =========================================================
   UPLOAD
========================================================= */

const upload =
  multer({
    storage,

    fileFilter,

    limits: {
      fileSize:
        10 * 1024 * 1024,

      files: 1,
    },
  });


/* =========================================================
   SALVAR ATESTADO

   POST /api/atestado
========================================================= */

router.post(
  "/",
  auth,
  upload.single("arquivo"),
  salvarAtestado
);


/* =========================================================
   REMOVER ATESTADO

   DELETE /api/atestado

   Body:
   {
     "funcionario_id": 10,
     "data": "23/08/2026"
   }

   SUPER_ADMIN também envia empresa_id.
========================================================= */

router.delete(
  "/",
  auth,
  removerAtestado
);


/* =========================================================
   VISUALIZAR PDF PROTEGIDO

   GET /api/atestado/:id/arquivo

   ADMIN_EMPRESA:
   empresa vem do token.

   SUPER_ADMIN:
   ?empresa_id=1
========================================================= */

router.get(
  "/:id/arquivo",
  auth,
  visualizarAtestado
);


module.exports = router;