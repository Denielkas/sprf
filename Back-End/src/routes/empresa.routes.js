const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const router = express.Router();

const {
  listarEmpresas,
  buscarEmpresaPorId,
  criarEmpresa,
  atualizarEmpresa,
  alterarStatusEmpresa,
  adicionarCnpj,
  atualizarCnpj,
  removerCnpj,
} = require("../controllers/empresa.controller");

const {
  auth,
  somenteSuperAdmin,
} = require("../middlewares/auth");


/* =========================================================
   PASTA DE UPLOAD DAS EMPRESAS
========================================================= */

const PASTA_EMPRESAS =
  process.env.UPLOADS_DIR
    ? path.join(
        process.env.UPLOADS_DIR,
        "empresas"
      )
    : path.join(
        __dirname,
        "../../uploads/empresas"
      );


if (!fs.existsSync(PASTA_EMPRESAS)) {
  fs.mkdirSync(
    PASTA_EMPRESAS,
    {
      recursive: true,
    }
  );
}


/* =========================================================
   CONFIGURAÇÃO DO MULTER
========================================================= */

const storage = multer.diskStorage({
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

  filename: (
    req,
    file,
    cb
  ) => {
    const extensao =
      path
        .extname(file.originalname)
        .toLowerCase();

    const tipo =
      file.fieldname === "logo"
        ? "logo"
        : "fundo";

    const empresaId =
      req.params.id || "nova";

    const nomeArquivo =
      `${tipo}-empresa-${empresaId}-${Date.now()}-${Math.round(
        Math.random() * 1e9
      )}${extensao}`;

    cb(
      null,
      nomeArquivo
    );
  },
});


/* =========================================================
   FILTRO DAS IMAGENS
========================================================= */

const fileFilter = (
  req,
  file,
  cb
) => {
  const extensao =
    path
      .extname(file.originalname)
      .toLowerCase();

  const extensoesPermitidas = [
    ".jpg",
    ".jpeg",
    ".png",
    ".webp",
  ];

  const mimesPermitidos = [
    "image/jpeg",
    "image/png",
    "image/webp",
  ];

  if (
    !extensoesPermitidas.includes(
      extensao
    ) ||
    !mimesPermitidos.includes(
      file.mimetype
    )
  ) {
    return cb(
      new Error(
        "Somente imagens JPG, JPEG, PNG ou WEBP são permitidas."
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

const uploadEmpresa =
  multer({
    storage,

    fileFilter,

    limits: {
      fileSize:
        10 * 1024 * 1024,

      files: 2,
    },
  });


/* =========================================================
   TODAS AS ROTAS ABAIXO SÃO EXCLUSIVAS DO SUPER ADMIN
========================================================= */


/* =========================================================
   LISTAR EMPRESAS

   GET /api/empresas
========================================================= */

router.get(
  "/",
  auth,
  somenteSuperAdmin,
  listarEmpresas
);


/* =========================================================
   BUSCAR UMA EMPRESA

   GET /api/empresas/:id
========================================================= */

router.get(
  "/:id",
  auth,
  somenteSuperAdmin,
  buscarEmpresaPorId
);


/* =========================================================
   CADASTRAR EMPRESA

   POST /api/empresas
========================================================= */

router.post(
  "/",
  auth,
  somenteSuperAdmin,
  criarEmpresa
);


/* =========================================================
   ATUALIZAR EMPRESA

   PUT /api/empresas/:id
========================================================= */

router.put(
  "/:id",
  auth,
  somenteSuperAdmin,
  atualizarEmpresa
);


/* =========================================================
   UPLOAD DA IDENTIDADE VISUAL

   POST /api/empresas/:id/imagens

   multipart/form-data

   Campos:

   logo  = arquivo da logo
   fundo = imagem de fundo

   Pode enviar:
   - somente logo
   - somente fundo
   - os dois
========================================================= */

router.post(
  "/:id/imagens",

  auth,

  somenteSuperAdmin,

  uploadEmpresa.fields([
    {
      name: "logo",
      maxCount: 1,
    },
    {
      name: "fundo",
      maxCount: 1,
    },
  ]),

  async (req, res) => {
    try {
      const {
        id,
      } = req.params;

      const logo =
        req.files?.logo?.[0] ||
        null;

      const fundo =
        req.files?.fundo?.[0] ||
        null;


      /* -----------------------------------------
         PRECISA ENVIAR PELO MENOS UMA IMAGEM
      ----------------------------------------- */

      if (
        !logo &&
        !fundo
      ) {
        return res
          .status(400)
          .json({
            error:
              "Envie uma logo ou uma imagem de fundo.",
          });
      }


      /* -----------------------------------------
         MONTAR URLs
      ----------------------------------------- */

      const logoUrl =
        logo
          ? `/uploads/empresas/${logo.filename}`
          : undefined;

      const fundoUrl =
        fundo
          ? `/uploads/empresas/${fundo.filename}`
          : undefined;


      /* -----------------------------------------
         SIMULAR REQUISIÇÃO PARA CONTROLLER
      ----------------------------------------- */

      req.body = {
        ...req.body,
      };

      if (logoUrl) {
        req.body.logo_url =
          logoUrl;
      }

      if (fundoUrl) {
        req.body.fundo_url =
          fundoUrl;
      }


      /* -----------------------------------------
         ATUALIZAR EMPRESA
      ----------------------------------------- */

      return atualizarEmpresa(
        req,
        res
      );
    } catch (err) {
      console.error(
        "Erro ao enviar imagens da empresa:",
        err
      );

      return res
        .status(500)
        .json({
          error:
            "Erro ao enviar imagens da empresa.",
        });
    }
  }
);


/* =========================================================
   ATIVAR / DESATIVAR EMPRESA

   PATCH /api/empresas/:id/status
========================================================= */

router.patch(
  "/:id/status",
  auth,
  somenteSuperAdmin,
  alterarStatusEmpresa
);


/* =========================================================
   ADICIONAR CNPJ

   POST /api/empresas/:id/cnpjs
========================================================= */

router.post(
  "/:id/cnpjs",
  auth,
  somenteSuperAdmin,
  adicionarCnpj
);


/* =========================================================
   ATUALIZAR CNPJ

   PUT /api/empresas/:id/cnpjs/:cnpjId
========================================================= */

router.put(
  "/:id/cnpjs/:cnpjId",
  auth,
  somenteSuperAdmin,
  atualizarCnpj
);


/* =========================================================
   REMOVER CNPJ

   DELETE /api/empresas/:id/cnpjs/:cnpjId
========================================================= */

router.delete(
  "/:id/cnpjs/:cnpjId",
  auth,
  somenteSuperAdmin,
  removerCnpj
);


module.exports = router;