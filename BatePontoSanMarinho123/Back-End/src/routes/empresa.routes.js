const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const router = express.Router();

/* =========================================================
   CONTROLLER
========================================================= */

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

/* =========================================================
   MIDDLEWARES
========================================================= */

const {
  auth,
  somenteSuperAdmin,
} = require("../middlewares/auth");

/* =========================================================
   PASTA DE UPLOAD DAS EMPRESAS
========================================================= */

const PASTA_EMPRESAS = process.env.UPLOADS_DIR
  ? path.join(
      process.env.UPLOADS_DIR,
      "empresas"
    )
  : path.join(
      __dirname,
      "../../uploads/empresas"
    );

/* =========================================================
   GARANTIR QUE A PASTA EXISTA
========================================================= */

if (!fs.existsSync(PASTA_EMPRESAS)) {
  fs.mkdirSync(PASTA_EMPRESAS, {
    recursive: true,
  });
}

/* =========================================================
   CONFIGURAÇÃO DO STORAGE
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
    const extensao = path
      .extname(file.originalname)
      .toLowerCase();

    let tipo = "imagem";

    if (file.fieldname === "logo") {
      tipo = "logo";
    }

    if (file.fieldname === "fundo") {
      tipo = "fundo";
    }

    const empresaId =
      req.params.id || "empresa";

    const nomeArquivo = [
      tipo,
      "empresa",
      empresaId,
      Date.now(),
      Math.round(
        Math.random() * 1e9
      ),
    ].join("-");

    cb(
      null,
      `${nomeArquivo}${extensao}`
    );
  },
});

/* =========================================================
   FILTRO DOS ARQUIVOS

   Permitidos:
   JPG
   JPEG
   PNG
   WEBP
========================================================= */

const fileFilter = (
  req,
  file,
  cb
) => {
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

  const extensaoValida =
    extensoesPermitidas.includes(
      extensao
    );

  const mimeValido =
    mimesPermitidos.includes(
      file.mimetype
    );

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

  return cb(
    null,
    true
  );
};

/* =========================================================
   MULTER

   Máximo:
   10 MB por arquivo
   2 arquivos por requisição
========================================================= */

const uploadEmpresa = multer({
  storage,

  fileFilter,

  limits: {
    fileSize:
      10 * 1024 * 1024,

    files: 2,
  },
});

/* =========================================================
   CONFIGURAÇÃO DOS CAMPOS

   Front deve enviar:

   logo
   fundo
========================================================= */

const uploadImagensEmpresa =
  uploadEmpresa.fields([
    {
      name: "logo",
      maxCount: 1,
    },
    {
      name: "fundo",
      maxCount: 1,
    },
  ]);

/* =========================================================
   MIDDLEWARE PARA TRATAR ERROS DO MULTER
========================================================= */

function processarUploadImagens(
  req,
  res,
  next
) {
  uploadImagensEmpresa(
    req,
    res,
    (err) => {
      if (!err) {
        return next();
      }

      console.error(
        "Erro no upload da empresa:",
        err
      );

      /* ===============================================
         ERROS DO MULTER
      =============================================== */

      if (
        err instanceof
        multer.MulterError
      ) {
        if (
          err.code ===
          "LIMIT_FILE_SIZE"
        ) {
          return res
            .status(400)
            .json({
              error:
                "A imagem ultrapassa o limite de 10 MB.",
            });
        }

        if (
          err.code ===
          "LIMIT_FILE_COUNT"
        ) {
          return res
            .status(400)
            .json({
              error:
                "Envie no máximo uma logo e uma imagem de fundo.",
            });
        }

        if (
          err.code ===
          "LIMIT_UNEXPECTED_FILE"
        ) {
          return res
            .status(400)
            .json({
              error:
                'Campo de arquivo inválido. Utilize "logo" e/ou "fundo".',
            });
        }

        return res
          .status(400)
          .json({
            error:
              err.message ||
              "Erro no upload da imagem.",
          });
      }

      /* ===============================================
         ERROS DO FILTRO
      =============================================== */

      return res
        .status(400)
        .json({
          error:
            err.message ||
            "Arquivo inválido.",
        });
    }
  );
}

/* =========================================================
   REMOVER ARQUIVO

   Utilizado caso aconteça algum erro depois que
   o Multer já salvou a imagem.
========================================================= */

function removerArquivo(
  arquivo
) {
  if (!arquivo?.path) {
    return;
  }

  try {
    if (
      fs.existsSync(
        arquivo.path
      )
    ) {
      fs.unlinkSync(
        arquivo.path
      );
    }
  } catch (err) {
    console.error(
      "Erro ao remover arquivo:",
      err
    );
  }
}

/* =========================================================
   REMOVER ARQUIVOS DO UPLOAD
========================================================= */

function removerArquivosUpload(
  req
) {
  const logo =
    req.files?.logo?.[0];

  const fundo =
    req.files?.fundo?.[0];

  removerArquivo(logo);
  removerArquivo(fundo);
}

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
   UPLOAD DA IDENTIDADE VISUAL

   POST /api/empresas/:id/imagens

   multipart/form-data

   Campos aceitos:

   logo
   fundo

   Pode enviar:
   - somente logo
   - somente fundo
   - logo + fundo
========================================================= */

router.post(
  "/:id/imagens",

  auth,

  somenteSuperAdmin,

  processarUploadImagens,

  async (
    req,
    res
  ) => {
    try {
      const empresaId =
        Number(req.params.id);

      /* ===============================================
         VALIDAR ID
      =============================================== */

      if (
        !Number.isInteger(
          empresaId
        ) ||
        empresaId <= 0
      ) {
        removerArquivosUpload(
          req
        );

        return res
          .status(400)
          .json({
            error:
              "ID da empresa inválido.",
          });
      }

      /* ===============================================
         PEGAR ARQUIVOS
      =============================================== */

      const logo =
        req.files?.logo?.[0] ||
        null;

      const fundo =
        req.files?.fundo?.[0] ||
        null;

      /* ===============================================
         PRECISA TER PELO MENOS UMA IMAGEM
      =============================================== */

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

      /* ===============================================
         MONTAR URL DA LOGO
      =============================================== */

      const logoUrl = logo
        ? `/uploads/empresas/${logo.filename}`
        : undefined;

      /* ===============================================
         MONTAR URL DO FUNDO
      =============================================== */

      const fundoUrl = fundo
        ? `/uploads/empresas/${fundo.filename}`
        : undefined;

      /* ===============================================
         PREPARAR BODY PARA atualizarEmpresa()

         IMPORTANTE:
         somente adicionamos a propriedade quando
         realmente foi enviada uma nova imagem.

         Assim uma atualização de logo não apaga
         o fundo e vice-versa.
      =============================================== */

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

      /* ===============================================
         CHAMAR CONTROLLER
      =============================================== */

      return atualizarEmpresa(
        req,
        res
      );
    } catch (err) {
      console.error(
        "Erro ao enviar imagens da empresa:",
        err
      );

      /* ===============================================
         EVITAR ARQUIVOS ÓRFÃOS EM CASO DE ERRO
      =============================================== */

      removerArquivosUpload(
        req
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
   BUSCAR EMPRESA POR ID

   IMPORTANTE:
   deixar /:id depois das rotas específicas.

   GET /api/empresas/:id
========================================================= */

router.get(
  "/:id",
  auth,
  somenteSuperAdmin,
  buscarEmpresaPorId
);

/* =========================================================
   EXPORT
========================================================= */

module.exports = router;