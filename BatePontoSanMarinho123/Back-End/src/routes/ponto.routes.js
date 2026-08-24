const express = require("express");

const router = express.Router();

const pontoController = require("../controllers/ponto.controller");

const {
  auth,
} = require("../middlewares/auth");

/* =====================================================
   ROTAS PÚBLICAS
   Usadas na tela onde o funcionário bate/consulta ponto.

   A empresa é identificada por empresa_id.
===================================================== */

/* STATUS DAS BATIDAS */
router.get(
  "/status-batidas/:funcionario_id",
  pontoController.statusBatidas
);

/* Mantida por compatibilidade */
router.get(
  "/status/:funcionario_id",
  pontoController.statusBatidas
);

/* BATER AUTOMATICAMENTE */
router.post(
  "/auto",
  pontoController.auto
);

/* BATER PELOS BOTÕES */
router.post(
  "/bater",
  pontoController.bater
);

/* BUSCAR FUNCIONÁRIO PELO CPF */
router.get(
  "/cpf/:cpf",
  pontoController.buscarPorCPF
);


/* =====================================================
   ROTAS ADMINISTRATIVAS
   Somente usuário autenticado.
===================================================== */

/* INSERIR PONTO MANUAL */
router.post(
  "/manual",
  auth,
  pontoController.inserirManual
);

/* AJUSTAR PONTO PELO RELATÓRIO */
router.put(
  "/ajustar",
  auth,
  pontoController.ajustar
);

/* LIMPAR BATIDAS DO DIA */
router.delete(
  "/limpar-dia",
  auth,
  pontoController.limparBatidasDoDia
);

/* LANÇAR HORÁRIO PADRÃO DO MÊS */
router.post(
  "/lancar-padrao-mes",
  auth,
  pontoController.lancarHorarioPadraoMes
);

module.exports = router;