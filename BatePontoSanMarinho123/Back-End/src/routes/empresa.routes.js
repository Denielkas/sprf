const express = require("express");
const multer = require("multer");
const path = require("path");

const router = express.Router();


/* =========================================================
   CONTROLLER DAS EMPRESAS
========================================================= */

const {
  listarEmpresas,
  buscarEmpresaPorId,
  criarEmpresa,
  atualizarEmpresa,
  alterarStatusEmpresa,

  excluirEmpresa,

  adicionarCnpj,
  atualizarCnpj,
  removerCnpj,
} = require(
  "../controllers/empresa.controller"
);


/* =========================================================
   CONTROLLER DAS IMAGENS

   Agora logo e fundo são armazenados diretamente
   no PostgreSQL.
========================================================= */

const {
  uploadLogoEmpresa,
  uploadFundoEmpresa,
} = require(
  "../controllers/empresaUpload.controller"
);


/* =========================================================
   MIDDLEWARES
========================================================= */

const {
  auth,
  somenteSuperAdmin,
} = require(
  "../middlewares/auth"
);


/* =========================================================
   STORAGE EM MEMÓRIA

   IMPORTANTE:

   Não utilizamos mais:

   multer.diskStorage()

   Não criamos mais arquivos em:

   Back-End/uploads/empresas


   Agora:

   multer.memoryStorage()

   disponibiliza a imagem em:

   file.buffer

   e o controller salva diretamente no PostgreSQL.
========================================================= */

const storage =
  multer.memoryStorage();


/* =========================================================
   FILTRO DOS ARQUIVOS
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
       VALIDAR EXTENSÃO
    ===================================================== */

    const extensaoValida =
      extensoesPermitidas.includes(
        extensao
      );


    /* =====================================================
       VALIDAR MIME
    ===================================================== */

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
   MULTER
========================================================= */

const uploadEmpresa =
  multer({
    storage,

    fileFilter,

    limits: {
      /* ===================================================
         10 MB POR IMAGEM
      =================================================== */

      fileSize:
        10 *
        1024 *
        1024,


      /* ===================================================
         LOGO + FUNDO
      =================================================== */

      files: 2,
    },
  });


/* =========================================================
   CAMPOS DA IDENTIDADE VISUAL

   Mantemos exatamente os campos que seu frontend
   já utiliza:

   logo
   fundo
========================================================= */

const uploadImagensEmpresa =
  uploadEmpresa.fields([
    {
      name:
        "logo",

      maxCount:
        1,
    },

    {
      name:
        "fundo",

      maxCount:
        1,
    },
  ]);


/* =========================================================
   PROCESSAR UPLOAD

   Tratamos os erros aqui para não deixar o Multer
   retornar erros confusos para o frontend.
========================================================= */

function processarUploadImagens(
  req,
  res,
  next
) {
  uploadImagensEmpresa(
    req,
    res,
    (
      err
    ) => {
      /* ===================================================
         SEM ERRO
      =================================================== */

      if (!err) {
        return next();
      }


      console.error(
        "❌ Erro no upload da empresa:",
        err
      );


      /* ===================================================
         ERROS DO MULTER
      =================================================== */

      if (
        err instanceof
        multer.MulterError
      ) {
        /* =================================================
           ARQUIVO MUITO GRANDE
        ================================================= */

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


        /* =================================================
           MUITOS ARQUIVOS
        ================================================= */

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


        /* =================================================
           CAMPO INCORRETO
        ================================================= */

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


        /* =================================================
           OUTRO ERRO DO MULTER
        ================================================= */

        return res
          .status(400)
          .json({
            error:
              err.message ||
              "Erro no upload da imagem.",
          });
      }


      /* ===================================================
         OUTRO ERRO
      =================================================== */

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
   FUNÇÃO AUXILIAR

   Executa os controllers de imagem sem encerrar
   diretamente a resposta HTTP.

   Isso é necessário porque a rota /imagens pode receber
   logo e fundo ao mesmo tempo.
========================================================= */

async function salvarLogoNoBanco(
  empresaId,
  arquivo
) {
  return new Promise(
    (
      resolve,
      reject
    ) => {
      const reqFake = {
        params: {
          id:
            String(
              empresaId
            ),
        },

        file:
          arquivo,
      };


      const resFake = {
        statusCode:
          200,

        status(
          codigo
        ) {
          this.statusCode =
            codigo;

          return this;
        },

        json(
          dados
        ) {
          if (
            this.statusCode >=
            400
          ) {
            return reject(
              new Error(
                dados?.error ||
                "Erro ao salvar logo."
              )
            );
          }

          return resolve(
            dados
          );
        },
      };


      Promise.resolve(
        uploadLogoEmpresa(
          reqFake,
          resFake
        )
      ).catch(
        reject
      );
    }
  );
}


async function salvarFundoNoBanco(
  empresaId,
  arquivo
) {
  return new Promise(
    (
      resolve,
      reject
    ) => {
      const reqFake = {
        params: {
          id:
            String(
              empresaId
            ),
        },

        file:
          arquivo,
      };


      const resFake = {
        statusCode:
          200,

        status(
          codigo
        ) {
          this.statusCode =
            codigo;

          return this;
        },

        json(
          dados
        ) {
          if (
            this.statusCode >=
            400
          ) {
            return reject(
              new Error(
                dados?.error ||
                "Erro ao salvar fundo."
              )
            );
          }

          return resolve(
            dados
          );
        },
      };


      Promise.resolve(
        uploadFundoEmpresa(
          reqFake,
          resFake
        )
      ).catch(
        reject
      );
    }
  );
}


/* =========================================================
   LISTAR EMPRESAS

   GET:
   /api/empresas
========================================================= */

router.get(
  "/",

  auth,

  somenteSuperAdmin,

  listarEmpresas
);


/* =========================================================
   CADASTRAR EMPRESA

   POST:
   /api/empresas
========================================================= */

router.post(
  "/",

  auth,

  somenteSuperAdmin,

  criarEmpresa
);


/* =========================================================
   UPLOAD DA IDENTIDADE VISUAL

   POST:
   /api/empresas/:id/imagens

   multipart/form-data

   Campos:

   logo
   fundo


   IMPORTANTE:

   Agora nenhuma imagem é gravada em disco.

   As imagens são recebidas em memória e salvas
   diretamente no PostgreSQL.
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
      /* ===================================================
         EMPRESA
      =================================================== */

      const empresaId =
        Number(
          req.params.id
        );


      if (
        !Number.isInteger(
          empresaId
        ) ||
        empresaId <= 0
      ) {
        return res
          .status(400)
          .json({
            error:
              "ID da empresa inválido.",
          });
      }


      /* ===================================================
         ARQUIVOS RECEBIDOS
      =================================================== */

      const logo =
        req.files?.logo?.[0] ||
        null;


      const fundo =
        req.files?.fundo?.[0] ||
        null;


      /* ===================================================
         PRECISA TER PELO MENOS UMA IMAGEM
      =================================================== */

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


      /* ===================================================
         RESULTADOS
      =================================================== */

      let resultadoLogo =
        null;

      let resultadoFundo =
        null;


      /* ===================================================
         SALVAR LOGO NO POSTGRESQL
      =================================================== */

      if (logo) {
        resultadoLogo =
          await salvarLogoNoBanco(
            empresaId,
            logo
          );
      }


      /* ===================================================
         SALVAR FUNDO NO POSTGRESQL
      =================================================== */

      if (fundo) {
        resultadoFundo =
          await salvarFundoNoBanco(
            empresaId,
            fundo
          );
      }


      /* ===================================================
         URLs

         Continuam iguais.

         Isso evita precisar alterar o frontend.
      =================================================== */

      const logoUrl =
        resultadoLogo?.logo_url ||
        resultadoFundo?.logo_url ||
        null;


      const fundoUrl =
        resultadoFundo?.fundo_url ||
        resultadoLogo?.fundo_url ||
        null;


      /* ===================================================
         RESPOSTA
      =================================================== */

      return res.json({
        ok: true,

        message:
          logo && fundo
            ? "Logo e imagem de fundo atualizadas com sucesso."
            : logo
              ? "Logo atualizada com sucesso."
              : "Imagem de fundo atualizada com sucesso.",

        logo_url:
          logoUrl,

        fundo_url:
          fundoUrl,

        empresa:
          resultadoFundo?.empresa ||
          resultadoLogo?.empresa ||
          null,
      });

    } catch (err) {
      console.error(
        "❌ Erro ao enviar imagens da empresa:",
        err
      );


      return res
        .status(500)
        .json({
          error:
            "Erro ao enviar imagens da empresa.",

          detalhe:
            err.message,
        });
    }
  }
);


/* =========================================================
   ATIVAR / DESATIVAR

   PATCH:
   /api/empresas/:id/status
========================================================= */

router.patch(
  "/:id/status",

  auth,

  somenteSuperAdmin,

  alterarStatusEmpresa
);


/* =========================================================
   ADICIONAR CNPJ

   POST:
   /api/empresas/:id/cnpjs
========================================================= */

router.post(
  "/:id/cnpjs",

  auth,

  somenteSuperAdmin,

  adicionarCnpj
);


/* =========================================================
   ATUALIZAR CNPJ

   PUT:
   /api/empresas/:id/cnpjs/:cnpjId
========================================================= */

router.put(
  "/:id/cnpjs/:cnpjId",

  auth,

  somenteSuperAdmin,

  atualizarCnpj
);


/* =========================================================
   REMOVER CNPJ

   DELETE:
   /api/empresas/:id/cnpjs/:cnpjId
========================================================= */

router.delete(
  "/:id/cnpjs/:cnpjId",

  auth,

  somenteSuperAdmin,

  removerCnpj
);


/* =========================================================
   ATUALIZAR EMPRESA

   PUT:
   /api/empresas/:id
========================================================= */

router.put(
  "/:id",

  auth,

  somenteSuperAdmin,

  atualizarEmpresa
);


/* =========================================================
   EXCLUIR EMPRESA

   DELETE:
   /api/empresas/:id
========================================================= */

router.delete(
  "/:id",

  auth,

  somenteSuperAdmin,

  excluirEmpresa
);


/* =========================================================
   BUSCAR EMPRESA POR ID

   GET:
   /api/empresas/:id
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

module.exports =
  router;