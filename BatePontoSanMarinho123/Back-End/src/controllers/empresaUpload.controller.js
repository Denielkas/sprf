const pool = require("../database/pool");
const path = require("path");
const fs = require("fs");

/* =========================================================
   PASTA
========================================================= */

const PASTA_EMPRESAS =
  process.env.UPLOADS_DIR
    ? path.join(process.env.UPLOADS_DIR, "empresas")
    : path.join(__dirname, "../../uploads/empresas");

/* =========================================================
   GARANTIR COLUNAS
========================================================= */

async function garantirColunasImagens() {
  await pool.query(`
    ALTER TABLE empresas
    ADD COLUMN IF NOT EXISTS logo_arquivo TEXT;
  `);

  await pool.query(`
    ALTER TABLE empresas
    ADD COLUMN IF NOT EXISTS fundo_arquivo TEXT;
  `);
}

/* =========================================================
   VERIFICAR EMPRESA
========================================================= */

async function buscarEmpresa(id) {
  const { rows } = await pool.query(
    `
    SELECT
      id,
      nome,
      nome_fantasia,
      logo_arquivo,
      fundo_arquivo
    FROM empresas
    WHERE id = $1
    LIMIT 1
    `,
    [id]
  );

  return rows[0] || null;
}

/* =========================================================
   EXCLUIR ARQUIVO ANTIGO
========================================================= */

function excluirArquivo(nomeArquivo) {
  if (!nomeArquivo) {
    return;
  }

  const nomeSeguro = path.basename(nomeArquivo);

  const caminho = path.join(
    PASTA_EMPRESAS,
    nomeSeguro
  );

  try {
    if (fs.existsSync(caminho)) {
      fs.unlinkSync(caminho);
    }
  } catch (err) {
    console.error(
      "Erro ao excluir imagem antiga:",
      err
    );
  }
}

/* =========================================================
   EXCLUIR ARQUIVO RECÉM-ENVIADO EM CASO DE ERRO
========================================================= */

function excluirUploadAtual(req) {
  if (!req.file?.filename) {
    return;
  }

  excluirArquivo(req.file.filename);
}

/* =========================================================
   UPLOAD LOGO
========================================================= */

async function uploadLogoEmpresa(req, res) {
  try {
    await garantirColunasImagens();

    const { id } = req.params;

    if (!req.file) {
      return res.status(400).json({
        error: "Selecione uma imagem para a logo.",
      });
    }

    const empresa = await buscarEmpresa(id);

    if (!empresa) {
      excluirUploadAtual(req);

      return res.status(404).json({
        error: "Empresa não encontrada.",
      });
    }

    const arquivoAntigo =
      empresa.logo_arquivo;

    const { rows } = await pool.query(
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
        logo_arquivo,
        fundo_arquivo
      `,
      [
        req.file.filename,
        id,
      ]
    );

    if (
      arquivoAntigo &&
      arquivoAntigo !== req.file.filename
    ) {
      excluirArquivo(arquivoAntigo);
    }

    return res.json({
      ok: true,

      message:
        "Logo atualizada com sucesso.",

      empresa: rows[0],

      logo_url:
        `/api/empresas/${id}/logo`,
    });
  } catch (err) {
    excluirUploadAtual(req);

    console.error(
      "Erro ao enviar logo:",
      err
    );

    return res.status(500).json({
      error:
        "Erro ao atualizar logo da empresa.",
    });
  }
}

/* =========================================================
   UPLOAD FUNDO
========================================================= */

async function uploadFundoEmpresa(req, res) {
  try {
    await garantirColunasImagens();

    const { id } = req.params;

    if (!req.file) {
      return res.status(400).json({
        error:
          "Selecione uma imagem de fundo.",
      });
    }

    const empresa = await buscarEmpresa(id);

    if (!empresa) {
      excluirUploadAtual(req);

      return res.status(404).json({
        error: "Empresa não encontrada.",
      });
    }

    const arquivoAntigo =
      empresa.fundo_arquivo;

    const { rows } = await pool.query(
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
        logo_arquivo,
        fundo_arquivo
      `,
      [
        req.file.filename,
        id,
      ]
    );

    if (
      arquivoAntigo &&
      arquivoAntigo !== req.file.filename
    ) {
      excluirArquivo(arquivoAntigo);
    }

    return res.json({
      ok: true,

      message:
        "Imagem de fundo atualizada com sucesso.",

      empresa: rows[0],

      fundo_url:
        `/api/empresas/${id}/fundo`,
    });
  } catch (err) {
    excluirUploadAtual(req);

    console.error(
      "Erro ao enviar fundo:",
      err
    );

    return res.status(500).json({
      error:
        "Erro ao atualizar imagem de fundo.",
    });
  }
}

/* =========================================================
   VISUALIZAR LOGO
========================================================= */

async function visualizarLogoEmpresa(req, res) {
  try {
    await garantirColunasImagens();

    const empresa =
      await buscarEmpresa(
        req.params.id
      );

    if (!empresa) {
      return res.status(404).json({
        error:
          "Empresa não encontrada.",
      });
    }

    if (!empresa.logo_arquivo) {
      return res.status(404).json({
        error:
          "Esta empresa não possui logo.",
      });
    }

    const nomeSeguro =
      path.basename(
        empresa.logo_arquivo
      );

    const arquivo = path.join(
      PASTA_EMPRESAS,
      nomeSeguro
    );

    if (!fs.existsSync(arquivo)) {
      return res.status(404).json({
        error:
          "Arquivo da logo não encontrado.",
      });
    }

    return res.sendFile(arquivo);
  } catch (err) {
    console.error(
      "Erro ao visualizar logo:",
      err
    );

    return res.status(500).json({
      error:
        "Erro ao carregar logo.",
    });
  }
}

/* =========================================================
   VISUALIZAR FUNDO
========================================================= */

async function visualizarFundoEmpresa(req, res) {
  try {
    await garantirColunasImagens();

    const empresa =
      await buscarEmpresa(
        req.params.id
      );

    if (!empresa) {
      return res.status(404).json({
        error:
          "Empresa não encontrada.",
      });
    }

    if (!empresa.fundo_arquivo) {
      return res.status(404).json({
        error:
          "Esta empresa não possui imagem de fundo.",
      });
    }

    const nomeSeguro =
      path.basename(
        empresa.fundo_arquivo
      );

    const arquivo = path.join(
      PASTA_EMPRESAS,
      nomeSeguro
    );

    if (!fs.existsSync(arquivo)) {
      return res.status(404).json({
        error:
          "Arquivo de fundo não encontrado.",
      });
    }

    return res.sendFile(arquivo);
  } catch (err) {
    console.error(
      "Erro ao visualizar fundo:",
      err
    );

    return res.status(500).json({
      error:
        "Erro ao carregar imagem de fundo.",
    });
  }
}

module.exports = {
  uploadLogoEmpresa,
  uploadFundoEmpresa,
  visualizarLogoEmpresa,
  visualizarFundoEmpresa,
};