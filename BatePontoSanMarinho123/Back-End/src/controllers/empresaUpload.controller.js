const pool = require("../database/pool");

/* =========================================================
   GARANTIR COLUNAS DE IMAGENS NO BANCO

   As imagens serão armazenadas diretamente no PostgreSQL.

   BYTEA:
   guarda os bytes da imagem.

   MIMETYPE:
   guarda o tipo:
   image/png
   image/jpeg
   image/webp
========================================================= */

async function garantirColunasImagens() {
  /* =======================================================
     GARANTIR TABELA EMPRESAS
  ======================================================= */

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

      logo_dados BYTEA,

      logo_mimetype VARCHAR(100),

      fundo_dados BYTEA,

      fundo_mimetype VARCHAR(100),

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
     GARANTIR COLUNAS NOVAS

     IMPORTANTE:

     Se a tabela empresas já existir, CREATE TABLE IF NOT
     EXISTS não adiciona novas colunas.

     Por isso utilizamos ALTER TABLE.
  ======================================================= */

  await pool.query(`
    ALTER TABLE empresas
    ADD COLUMN IF NOT EXISTS logo_dados BYTEA;
  `);

  await pool.query(`
    ALTER TABLE empresas
    ADD COLUMN IF NOT EXISTS logo_mimetype VARCHAR(100);
  `);

  await pool.query(`
    ALTER TABLE empresas
    ADD COLUMN IF NOT EXISTS fundo_dados BYTEA;
  `);

  await pool.query(`
    ALTER TABLE empresas
    ADD COLUMN IF NOT EXISTS fundo_mimetype VARCHAR(100);
  `);

  /* =======================================================
     MANTER COLUNAS ANTIGAS

     Mantemos essas colunas por compatibilidade com partes
     antigas do sistema.

     Elas não serão mais utilizadas para armazenar a imagem.
  ======================================================= */

  await pool.query(`
    ALTER TABLE empresas
    ADD COLUMN IF NOT EXISTS logo_arquivo TEXT;
  `);

  await pool.query(`
    ALTER TABLE empresas
    ADD COLUMN IF NOT EXISTS fundo_arquivo TEXT;
  `);

  await pool.query(`
    ALTER TABLE empresas
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP
    NOT NULL DEFAULT NOW();
  `);
}


/* =========================================================
   VALIDAR ID DA EMPRESA
========================================================= */

function validarEmpresaId(id) {
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

  return empresaId;
}


/* =========================================================
   BUSCAR EMPRESA

   Não retornamos logo_dados/fundo_dados aqui porque podem
   ser arquivos grandes.

   Para verificar se existe imagem utilizamos:

   logo_dados IS NOT NULL
   fundo_dados IS NOT NULL
========================================================= */

async function buscarEmpresa(id) {
  const empresaId =
    validarEmpresaId(id);

  if (!empresaId) {
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

      cor_primaria,
      cor_secundaria,

      logo_arquivo,
      fundo_arquivo,

      logo_mimetype,
      fundo_mimetype,

      (
        logo_dados IS NOT NULL
      ) AS possui_logo,

      (
        fundo_dados IS NOT NULL
      ) AS possui_fundo,

      ativo,
      created_at,
      updated_at

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
   VALIDAR IMAGEM RECEBIDA
========================================================= */

function validarImagem(file) {
  if (!file) {
    return {
      valido: false,
      erro:
        "Nenhuma imagem foi enviada.",
    };
  }

  /* =======================================================
     MEMORY STORAGE

     Quando utilizamos multer.memoryStorage(), a imagem fica
     disponível em:

     file.buffer
  ======================================================= */

  if (
    !file.buffer ||
    !Buffer.isBuffer(
      file.buffer
    ) ||
    file.buffer.length === 0
  ) {
    return {
      valido: false,
      erro:
        "Não foi possível ler os dados da imagem.",
    };
  }

  /* =======================================================
     MIME TYPES PERMITIDOS
  ======================================================= */

  const tiposPermitidos = [
    "image/jpeg",
    "image/png",
    "image/webp",
  ];

  if (
    !tiposPermitidos.includes(
      file.mimetype
    )
  ) {
    return {
      valido: false,
      erro:
        "Somente imagens JPG, JPEG, PNG ou WEBP são permitidas.",
    };
  }

  /* =======================================================
     LIMITE EXTRA DE SEGURANÇA

     O Multer também deverá possuir limite de 10 MB.
  ======================================================= */

  const limite =
    10 *
    1024 *
    1024;

  if (
    file.buffer.length >
    limite
  ) {
    return {
      valido: false,
      erro:
        "A imagem deve possuir no máximo 10MB.",
    };
  }

  return {
    valido: true,
  };
}


/* =========================================================
   UPLOAD DA LOGO

   POST:
   /api/empresas/:id/logo

   multipart/form-data

   campo:
   arquivo
========================================================= */

async function uploadLogoEmpresa(
  req,
  res
) {
  try {
    /* =====================================================
       GARANTIR ESTRUTURA DO BANCO
    ===================================================== */

    await garantirColunasImagens();

    /* =====================================================
       EMPRESA
    ===================================================== */

    const empresaId =
      validarEmpresaId(
        req.params.id
      );

    if (!empresaId) {
      return res
        .status(400)
        .json({
          error:
            "ID da empresa inválido.",
        });
    }

    /* =====================================================
       VALIDAR IMAGEM
    ===================================================== */

    const validacao =
      validarImagem(
        req.file
      );

    if (
      !validacao.valido
    ) {
      return res
        .status(400)
        .json({
          error:
            validacao.erro,
        });
    }

    /* =====================================================
       VERIFICAR EMPRESA
    ===================================================== */

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
      "=========================================="
    );

    console.log(
      "📤 UPLOAD LOGO EMPRESA"
    );

    console.log(
      "Empresa:",
      empresaId
    );

    console.log(
      "Tipo:",
      req.file.mimetype
    );

    console.log(
      "Tamanho:",
      req.file.buffer.length,
      "bytes"
    );

    console.log(
      "=========================================="
    );

    /* =====================================================
       SALVAR DIRETAMENTE NO POSTGRESQL

       req.file.buffer = bytes da imagem
       req.file.mimetype = image/png, image/jpeg etc.
    ===================================================== */

    const {
      rows,
    } = await pool.query(
      `
      UPDATE empresas

      SET
        logo_dados = $1,
        logo_mimetype = $2,

        logo_arquivo = NULL,

        updated_at = NOW()

      WHERE id = $3

      RETURNING
        id,
        nome,
        nome_fantasia,
        cor_primaria,
        cor_secundaria,
        logo_mimetype,
        fundo_mimetype,

        (
          logo_dados IS NOT NULL
        ) AS possui_logo,

        (
          fundo_dados IS NOT NULL
        ) AS possui_fundo,

        ativo,
        updated_at
      `,
      [
        req.file.buffer,
        req.file.mimetype,
        empresaId,
      ]
    );

    /* =====================================================
       URLs

       Continuamos utilizando as mesmas URLs.

       Dessa forma o frontend não precisa saber que agora
       a imagem está dentro do PostgreSQL.
    ===================================================== */

    const logoUrl =
      `/api/empresas/${empresaId}/logo`;

    const fundoUrl =
      rows[0].possui_fundo
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
    console.error(
      "=========================================="
    );

    console.error(
      "❌ ERRO AO ENVIAR LOGO"
    );

    console.error(
      error
    );

    console.error(
      "=========================================="
    );

    return res
      .status(500)
      .json({
        error:
          "Erro ao atualizar logo da empresa.",

        detalhe:
          error.message,
      });
  }
}


/* =========================================================
   UPLOAD DO FUNDO

   POST:
   /api/empresas/:id/fundo

   multipart/form-data

   campo:
   arquivo
========================================================= */

async function uploadFundoEmpresa(
  req,
  res
) {
  try {
    /* =====================================================
       GARANTIR ESTRUTURA
    ===================================================== */

    await garantirColunasImagens();

    /* =====================================================
       EMPRESA
    ===================================================== */

    const empresaId =
      validarEmpresaId(
        req.params.id
      );

    if (!empresaId) {
      return res
        .status(400)
        .json({
          error:
            "ID da empresa inválido.",
        });
    }

    /* =====================================================
       VALIDAR IMAGEM
    ===================================================== */

    const validacao =
      validarImagem(
        req.file
      );

    if (
      !validacao.valido
    ) {
      return res
        .status(400)
        .json({
          error:
            validacao.erro,
        });
    }

    /* =====================================================
       VERIFICAR EMPRESA
    ===================================================== */

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
      "=========================================="
    );

    console.log(
      "📤 UPLOAD FUNDO EMPRESA"
    );

    console.log(
      "Empresa:",
      empresaId
    );

    console.log(
      "Tipo:",
      req.file.mimetype
    );

    console.log(
      "Tamanho:",
      req.file.buffer.length,
      "bytes"
    );

    console.log(
      "=========================================="
    );

    /* =====================================================
       SALVAR NO POSTGRESQL
    ===================================================== */

    const {
      rows,
    } = await pool.query(
      `
      UPDATE empresas

      SET
        fundo_dados = $1,
        fundo_mimetype = $2,

        fundo_arquivo = NULL,

        updated_at = NOW()

      WHERE id = $3

      RETURNING
        id,
        nome,
        nome_fantasia,
        cor_primaria,
        cor_secundaria,
        logo_mimetype,
        fundo_mimetype,

        (
          logo_dados IS NOT NULL
        ) AS possui_logo,

        (
          fundo_dados IS NOT NULL
        ) AS possui_fundo,

        ativo,
        updated_at
      `,
      [
        req.file.buffer,
        req.file.mimetype,
        empresaId,
      ]
    );

    /* =====================================================
       URLs
    ===================================================== */

    const logoUrl =
      rows[0].possui_logo
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
    console.error(
      "=========================================="
    );

    console.error(
      "❌ ERRO AO ENVIAR FUNDO"
    );

    console.error(
      error
    );

    console.error(
      "=========================================="
    );

    return res
      .status(500)
      .json({
        error:
          "Erro ao atualizar imagem de fundo da empresa.",

        detalhe:
          error.message,
      });
  }
}


/* =========================================================
   BUSCAR IMAGEM DO BANCO

   Esta função é utilizada pelas rotas públicas:

   GET /api/empresas/:id/logo
   GET /api/empresas/:id/fundo
========================================================= */

async function buscarImagemBanco(
  empresaId,
  tipo
) {
  /* =======================================================
     LOGO
  ======================================================= */

  if (
    tipo === "logo"
  ) {
    const {
      rows,
    } = await pool.query(
      `
      SELECT
        logo_dados AS dados,
        logo_mimetype AS mimetype

      FROM empresas

      WHERE id = $1

      LIMIT 1
      `,
      [
        empresaId,
      ]
    );

    if (
      rows.length === 0
    ) {
      return {
        empresaExiste: false,
        dados: null,
        mimetype: null,
      };
    }

    return {
      empresaExiste: true,
      dados:
        rows[0].dados,

      mimetype:
        rows[0].mimetype,
    };
  }

  /* =======================================================
     FUNDO
  ======================================================= */

  const {
    rows,
  } = await pool.query(
    `
    SELECT
      fundo_dados AS dados,
      fundo_mimetype AS mimetype

    FROM empresas

    WHERE id = $1

    LIMIT 1
    `,
    [
      empresaId,
    ]
  );

  if (
    rows.length === 0
  ) {
    return {
      empresaExiste: false,
      dados: null,
      mimetype: null,
    };
  }

  return {
    empresaExiste: true,

    dados:
      rows[0].dados,

    mimetype:
      rows[0].mimetype,
  };
}


/* =========================================================
   ENVIAR IMAGEM DO POSTGRESQL
========================================================= */

function enviarImagem(
  res,
  imagem,
  tipo
) {
  /* =======================================================
     SEM IMAGEM
  ======================================================= */

  if (
    !imagem?.dados
  ) {
    return res
      .status(404)
      .json({
        error:
          `Esta empresa não possui ${tipo}.`,
      });
  }

  /* =======================================================
     CONTENT TYPE

     Exemplo:
     image/png
     image/jpeg
     image/webp
  ======================================================= */

  res.setHeader(
    "Content-Type",
    imagem.mimetype ||
      "application/octet-stream"
  );

  /* =======================================================
     CACHE

     Durante desenvolvimento deixamos sem cache para que
     alterações na imagem apareçam imediatamente.
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
     TAMANHO
  ======================================================= */

  res.setHeader(
    "Content-Length",
    imagem.dados.length
  );

  /* =======================================================
     ENVIAR BUFFER
  ======================================================= */

  return res.send(
    imagem.dados
  );
}


/* =========================================================
   VISUALIZAR LOGO

   GET:
   /api/empresas/:id/logo

   ROTA PÚBLICA
========================================================= */

async function visualizarLogoEmpresa(
  req,
  res
) {
  try {
    await garantirColunasImagens();

    const empresaId =
      validarEmpresaId(
        req.params.id
      );

    if (!empresaId) {
      return res
        .status(400)
        .json({
          error:
            "ID da empresa inválido.",
        });
    }

    /* =====================================================
       BUSCAR LOGO NO POSTGRESQL
    ===================================================== */

    const imagem =
      await buscarImagemBanco(
        empresaId,
        "logo"
      );

    if (
      !imagem.empresaExiste
    ) {
      return res
        .status(404)
        .json({
          error:
            "Empresa não encontrada.",
        });
    }

    console.log(
      "🖼 Carregando logo do banco:",
      empresaId
    );

    return enviarImagem(
      res,
      imagem,
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

        detalhe:
          error.message,
      });
  }
}


/* =========================================================
   VISUALIZAR FUNDO

   GET:
   /api/empresas/:id/fundo

   ROTA PÚBLICA
========================================================= */

async function visualizarFundoEmpresa(
  req,
  res
) {
  try {
    await garantirColunasImagens();

    const empresaId =
      validarEmpresaId(
        req.params.id
      );

    if (!empresaId) {
      return res
        .status(400)
        .json({
          error:
            "ID da empresa inválido.",
        });
    }

    /* =====================================================
       BUSCAR FUNDO NO POSTGRESQL
    ===================================================== */

    const imagem =
      await buscarImagemBanco(
        empresaId,
        "fundo"
      );

    if (
      !imagem.empresaExiste
    ) {
      return res
        .status(404)
        .json({
          error:
            "Empresa não encontrada.",
        });
    }

    console.log(
      "🌄 Carregando fundo do banco:",
      empresaId
    );

    return enviarImagem(
      res,
      imagem,
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

        detalhe:
          error.message,
      });
  }
}


/* =========================================================
   EXPORTS
========================================================= */

module.exports = {
  garantirColunasImagens,

  uploadLogoEmpresa,

  uploadFundoEmpresa,

  visualizarLogoEmpresa,

  visualizarFundoEmpresa,
};