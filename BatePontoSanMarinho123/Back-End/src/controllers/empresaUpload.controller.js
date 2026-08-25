const pool = require("../database/pool");
const path = require("path");
const fs = require("fs");

/* =========================================================
   PASTA DE UPLOADS

   PRECISA SER EXATAMENTE A MESMA REGRA DO server.js
========================================================= */

const UPLOADS_DIR =
  process.env.UPLOADS_DIR
    ? path.resolve(
        process.env.UPLOADS_DIR
      )
    : path.resolve(
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
  "🖼 Controller imagens empresas:",
  PASTA_EMPRESAS
);

/* =========================================================
   GARANTIR COLUNAS
========================================================= */

async function garantirColunasImagens() {
  /*
    Primeiro garantimos que a tabela existe.

    Normalmente ela já existe, mas isso evita erro durante
    inicialização/migração de banco antigo.
  */

  await pool.query(`
    CREATE TABLE IF NOT EXISTS empresas (
      id BIGSERIAL PRIMARY KEY,

      nome VARCHAR(150)
      NOT NULL,

      nome_fantasia VARCHAR(150),

      cor_primaria VARCHAR(30)
      DEFAULT '#0d6efd',

      cor_secundaria VARCHAR(30)
      DEFAULT '#084298',

      logo_arquivo TEXT,

      fundo_arquivo TEXT,

      ativo BOOLEAN
      NOT NULL
      DEFAULT true,

      created_at TIMESTAMP
      NOT NULL
      DEFAULT NOW(),

      updated_at TIMESTAMP
      NOT NULL
      DEFAULT NOW()
    );
  `);

  /* =======================================================
     LOGO
  ======================================================= */

  await pool.query(`
    ALTER TABLE empresas
    ADD COLUMN IF NOT EXISTS logo_arquivo TEXT;
  `);

  /* =======================================================
     FUNDO
  ======================================================= */

  await pool.query(`
    ALTER TABLE empresas
    ADD COLUMN IF NOT EXISTS fundo_arquivo TEXT;
  `);

  /* =======================================================
     UPDATED_AT
  ======================================================= */

  await pool.query(`
    ALTER TABLE empresas
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP
    NOT NULL DEFAULT NOW();
  `);
}

/* =========================================================
   BUSCAR EMPRESA
========================================================= */

async function buscarEmpresa(
  id
) {
  const empresaId =
    Number(id);

  if (
    !Number.isInteger(
      empresaId
    ) ||
    empresaId <= 0
  ) {
    return null;
  }

  const {
    rows,
  } = await pool.query(
    `
    SELECT
      id,
      nome,
      nome_fantasia,
      logo_arquivo,
      fundo_arquivo,
      cor_primaria,
      cor_secundaria,
      ativo

    FROM empresas

    WHERE id = $1

    LIMIT 1
    `,
    [
      empresaId,
    ]
  );

  return (
    rows[0] ||
    null
  );
}

/* =========================================================
   PEGAR SOMENTE NOME DO ARQUIVO

   Evita salvar ou acessar caminhos externos.
========================================================= */

function nomeSeguroArquivo(
  nomeArquivo
) {
  if (!nomeArquivo) {
    return null;
  }

  return path.basename(
    String(
      nomeArquivo
    )
  );
}

/* =========================================================
   MONTAR CAMINHO DO ARQUIVO
========================================================= */

function caminhoArquivo(
  nomeArquivo
) {
  const nomeSeguro =
    nomeSeguroArquivo(
      nomeArquivo
    );

  if (!nomeSeguro) {
    return null;
  }

  return path.join(
    PASTA_EMPRESAS,
    nomeSeguro
  );
}

/* =========================================================
   EXCLUIR ARQUIVO
========================================================= */

function excluirArquivo(
  nomeArquivo
) {
  if (!nomeArquivo) {
    return;
  }

  const arquivo =
    caminhoArquivo(
      nomeArquivo
    );

  if (!arquivo) {
    return;
  }

  try {
    if (
      fs.existsSync(
        arquivo
      )
    ) {
      fs.unlinkSync(
        arquivo
      );

      console.log(
        "🗑 Imagem antiga removida:",
        arquivo
      );
    }
  } catch (error) {
    console.error(
      "Erro ao excluir imagem antiga:",
      error
    );
  }
}

/* =========================================================
   EXCLUIR UPLOAD ATUAL

   Utilizado caso alguma coisa dê errado depois que o
   Multer já salvou o arquivo.
========================================================= */

function excluirUploadAtual(
  req
) {
  if (
    !req.file?.filename
  ) {
    return;
  }

  excluirArquivo(
    req.file.filename
  );
}

/* =========================================================
   UPLOAD DA LOGO
========================================================= */

async function uploadLogoEmpresa(
  req,
  res
) {
  try {
    await garantirColunasImagens();

    const empresaId =
      Number(
        req.params.id
      );

    /* =====================================================
       VALIDAR ID
    ===================================================== */

    if (
      !Number.isInteger(
        empresaId
      ) ||
      empresaId <= 0
    ) {
      excluirUploadAtual(
        req
      );

      return res
        .status(400)
        .json({
          error:
            "ID da empresa inválido.",
        });
    }

    /* =====================================================
       VALIDAR ARQUIVO
    ===================================================== */

    if (!req.file) {
      return res
        .status(400)
        .json({
          error:
            "Selecione uma imagem para a logo.",
        });
    }

    console.log(
      "📤 Upload logo empresa:",
      empresaId
    );

    console.log(
      "📄 Arquivo recebido:",
      req.file.filename
    );

    console.log(
      "📁 Caminho recebido:",
      req.file.path
    );

    /* =====================================================
       BUSCAR EMPRESA
    ===================================================== */

    const empresa =
      await buscarEmpresa(
        empresaId
      );

    if (!empresa) {
      excluirUploadAtual(
        req
      );

      return res
        .status(404)
        .json({
          error:
            "Empresa não encontrada.",
        });
    }

    const arquivoAntigo =
      empresa.logo_arquivo;

    /* =====================================================
       SALVAR NO BANCO

       IMPORTANTE:
       salvamos somente filename.

       Exemplo:
       empresa-1-logo-123456.png
    ===================================================== */

    const {
      rows,
    } = await pool.query(
      `
      UPDATE empresas

      SET
        logo_arquivo = $1,
        updated_at = NOW()

      WHERE id = $2

      RETURNING
        id,
        nome,
        nome_fantasia,
        cor_primaria,
        cor_secundaria,
        logo_arquivo,
        fundo_arquivo,
        ativo,
        updated_at
      `,
      [
        req.file.filename,
        empresaId,
      ]
    );

    /* =====================================================
       EXCLUIR LOGO ANTIGA
    ===================================================== */

    if (
      arquivoAntigo &&
      arquivoAntigo !==
        req.file.filename
    ) {
      excluirArquivo(
        arquivoAntigo
      );
    }

    /* =====================================================
       URLs
    ===================================================== */

    const logoUrl =
      `/api/empresas/${empresaId}/logo`;

    const fundoUrl =
      rows[0].fundo_arquivo
        ? `/api/empresas/${empresaId}/fundo`
        : null;

    /* =====================================================
       RESPOSTA
    ===================================================== */

    return res.json({
      ok: true,

      message:
        "Logo atualizada com sucesso.",

      logo_url:
        logoUrl,

      fundo_url:
        fundoUrl,

      empresa: {
        ...rows[0],

        logo_url:
          logoUrl,

        fundo_url:
          fundoUrl,
      },
    });

  } catch (error) {
    excluirUploadAtual(
      req
    );

    console.error(
      "❌ Erro ao enviar logo:",
      error
    );

    return res
      .status(500)
      .json({
        error:
          "Erro ao atualizar logo da empresa.",
      });
  }
}

/* =========================================================
   UPLOAD DO FUNDO
========================================================= */

async function uploadFundoEmpresa(
  req,
  res
) {
  try {
    await garantirColunasImagens();

    const empresaId =
      Number(
        req.params.id
      );

    /* =====================================================
       VALIDAR ID
    ===================================================== */

    if (
      !Number.isInteger(
        empresaId
      ) ||
      empresaId <= 0
    ) {
      excluirUploadAtual(
        req
      );

      return res
        .status(400)
        .json({
          error:
            "ID da empresa inválido.",
        });
    }

    /* =====================================================
       VALIDAR ARQUIVO
    ===================================================== */

    if (!req.file) {
      return res
        .status(400)
        .json({
          error:
            "Selecione uma imagem de fundo.",
        });
    }

    console.log(
      "📤 Upload fundo empresa:",
      empresaId
    );

    console.log(
      "📄 Arquivo recebido:",
      req.file.filename
    );

    console.log(
      "📁 Caminho recebido:",
      req.file.path
    );

    /* =====================================================
       BUSCAR EMPRESA
    ===================================================== */

    const empresa =
      await buscarEmpresa(
        empresaId
      );

    if (!empresa) {
      excluirUploadAtual(
        req
      );

      return res
        .status(404)
        .json({
          error:
            "Empresa não encontrada.",
        });
    }

    const arquivoAntigo =
      empresa.fundo_arquivo;

    /* =====================================================
       SALVAR NO BANCO
    ===================================================== */

    const {
      rows,
    } = await pool.query(
      `
      UPDATE empresas

      SET
        fundo_arquivo = $1,
        updated_at = NOW()

      WHERE id = $2

      RETURNING
        id,
        nome,
        nome_fantasia,
        cor_primaria,
        cor_secundaria,
        logo_arquivo,
        fundo_arquivo,
        ativo,
        updated_at
      `,
      [
        req.file.filename,
        empresaId,
      ]
    );

    /* =====================================================
       EXCLUIR FUNDO ANTIGO
    ===================================================== */

    if (
      arquivoAntigo &&
      arquivoAntigo !==
        req.file.filename
    ) {
      excluirArquivo(
        arquivoAntigo
      );
    }

    /* =====================================================
       URLs
    ===================================================== */

    const logoUrl =
      rows[0].logo_arquivo
        ? `/api/empresas/${empresaId}/logo`
        : null;

    const fundoUrl =
      `/api/empresas/${empresaId}/fundo`;

    /* =====================================================
       RESPOSTA
    ===================================================== */

    return res.json({
      ok: true,

      message:
        "Imagem de fundo atualizada com sucesso.",

      logo_url:
        logoUrl,

      fundo_url:
        fundoUrl,

      empresa: {
        ...rows[0],

        logo_url:
          logoUrl,

        fundo_url:
          fundoUrl,
      },
    });

  } catch (error) {
    excluirUploadAtual(
      req
    );

    console.error(
      "❌ Erro ao enviar fundo:",
      error
    );

    return res
      .status(500)
      .json({
        error:
          "Erro ao atualizar imagem de fundo da empresa.",
      });
  }
}

/* =========================================================
   ENVIAR IMAGEM

   Função compartilhada por logo e fundo.
========================================================= */

function enviarImagem(
  res,
  nomeArquivo,
  tipo
) {
  if (!nomeArquivo) {
    return res
      .status(404)
      .json({
        error:
          `Esta empresa não possui ${tipo}.`,
      });
  }

  const arquivo =
    caminhoArquivo(
      nomeArquivo
    );

  console.log(
    `🔎 Procurando ${tipo}:`,
    arquivo
  );

  if (
    !arquivo ||
    !fs.existsSync(
      arquivo
    )
  ) {
    console.error(
      `❌ ${tipo} não encontrado no disco:`,
      arquivo
    );

    return res
      .status(404)
      .json({
        error:
          `Arquivo de ${tipo} não encontrado.`,

        arquivo:
          nomeSeguroArquivo(
            nomeArquivo
          ),
      });
  }

  /* =======================================================
     CACHE

     no-cache facilita enquanto estamos desenvolvendo e
     trocando as imagens das empresas.
  ======================================================= */

  res.setHeader(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, proxy-revalidate"
  );

  res.setHeader(
    "Pragma",
    "no-cache"
  );

  res.setHeader(
    "Expires",
    "0"
  );

  /* =======================================================
     SENDFILE
  ======================================================= */

  return res.sendFile(
    arquivo,
    (error) => {
      if (
        error &&
        !res.headersSent
      ) {
        console.error(
          `Erro ao enviar ${tipo}:`,
          error
        );

        return res
          .status(500)
          .json({
            error:
              `Erro ao carregar ${tipo}.`,
          });
      }
    }
  );
}

/* =========================================================
   VISUALIZAR LOGO

   GET /api/empresas/:id/logo
========================================================= */

async function visualizarLogoEmpresa(
  req,
  res
) {
  try {
    await garantirColunasImagens();

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

    const empresa =
      await buscarEmpresa(
        empresaId
      );

    if (!empresa) {
      return res
        .status(404)
        .json({
          error:
            "Empresa não encontrada.",
        });
    }

    console.log(
      "🖼 Logo cadastrada no banco:",
      empresa.logo_arquivo
    );

    return enviarImagem(
      res,
      empresa.logo_arquivo,
      "logo"
    );

  } catch (error) {
    console.error(
      "❌ Erro ao visualizar logo:",
      error
    );

    return res
      .status(500)
      .json({
        error:
          "Erro ao carregar logo.",
      });
  }
}

/* =========================================================
   VISUALIZAR FUNDO

   GET /api/empresas/:id/fundo
========================================================= */

async function visualizarFundoEmpresa(
  req,
  res
) {
  try {
    await garantirColunasImagens();

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

    const empresa =
      await buscarEmpresa(
        empresaId
      );

    if (!empresa) {
      return res
        .status(404)
        .json({
          error:
            "Empresa não encontrada.",
        });
    }

    console.log(
      "🌄 Fundo cadastrado no banco:",
      empresa.fundo_arquivo
    );

    return enviarImagem(
      res,
      empresa.fundo_arquivo,
      "imagem de fundo"
    );

  } catch (error) {
    console.error(
      "❌ Erro ao visualizar fundo:",
      error
    );

    return res
      .status(500)
      .json({
        error:
          "Erro ao carregar imagem de fundo.",
      });
  }
}

/* =========================================================
   EXPORTS
========================================================= */

module.exports = {
  uploadLogoEmpresa,
  uploadFundoEmpresa,
  visualizarLogoEmpresa,
  visualizarFundoEmpresa,
};