const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const {
  auth,
  somenteSuperAdmin,
} = require("../middlewares/auth");

const {
  uploadLogoEmpresa,
  uploadFundoEmpresa,
  visualizarLogoEmpresa,
  visualizarFundoEmpresa,
} = require("../controllers/empresaUpload.controller");

const router = express.Router();

/* =========================================================
   PASTA BASE
========================================================= */

const PASTA_EMPRESAS =
  process.env.UPLOADS_DIR
    ? path.join(process.env.UPLOADS_DIR, "empresas")
    : path.join(__dirname, "../../uploads/empresas");

if (!fs.existsSync(PASTA_EMPRESAS)) {
  fs.mkdirSync(PASTA_EMPRESAS, {
    recursive: true,
  });
}

/* =========================================================
   STORAGE
========================================================= */

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, PASTA_EMPRESAS);
  },

  filename: (req, file, cb) => {
    const extensao = path
      .extname(file.originalname)
      .toLowerCase();

    const empresaId = req.params.id;

    const tipo =
      req.path.includes("/logo")
        ? "logo"
        : "fundo";

    const nomeArquivo =
      `empresa-${empresaId}-${tipo}-${Date.now()}${extensao}`;

    cb(null, nomeArquivo);
  },
});

/* =========================================================
   FILTRO DE IMAGEM
========================================================= */

const fileFilter = (req, file, cb) => {
  const extensao = path
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
    !extensoesPermitidas.includes(extensao) ||
    !mimesPermitidos.includes(file.mimetype)
  ) {
    return cb(
      new Error(
        "Somente imagens JPG, JPEG, PNG ou WEBP são permitidas."
      )
    );
  }

  cb(null, true);
};

/* =========================================================
   MULTER
========================================================= */

const upload = multer({
  storage,
  fileFilter,

  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 1,
  },
});

/* =========================================================
   LOGO

   POST /api/empresas/:id/logo
========================================================= */

router.post(
  "/:id/logo",
  auth,
  somenteSuperAdmin,
  upload.single("arquivo"),
  uploadLogoEmpresa
);

/* =========================================================
   FUNDO

   POST /api/empresas/:id/fundo
========================================================= */

router.post(
  "/:id/fundo",
  auth,
  somenteSuperAdmin,
  upload.single("arquivo"),
  uploadFundoEmpresa
);

/* =========================================================
   VISUALIZAR LOGO

   Essa rota é pública porque a logo também será usada
   na tela pública de ponto.
========================================================= */

router.get(
  "/:id/logo",
  visualizarLogoEmpresa
);

/* =========================================================
   VISUALIZAR FUNDO
========================================================= */

router.get(
  "/:id/fundo",
  visualizarFundoEmpresa
);

module.exports = router;