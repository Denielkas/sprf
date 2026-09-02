import { api } from "./api";

import {
  listarPontosPendentes,
  removerPontoOffline,
} from "./offlinePonto";


let sincronizando = false;


/* =========================================================
   SINCRONIZAR PONTOS PENDENTES
========================================================= */

export async function sincronizarPontosOffline() {
  /*
    Evita duas sincronizações simultâneas.
  */

  if (sincronizando) {
    return {
      ok: false,
      motivo:
        "sincronizacao_em_andamento",
    };
  }


  /*
    navigator.onLine é apenas uma indicação.

    A confirmação real será a resposta
    do backend.
  */

  if (!navigator.onLine) {
    return {
      ok: false,
      motivo:
        "offline",
    };
  }


  sincronizando =
    true;


  try {
    const pontos =
      await listarPontosPendentes();


    if (!pontos.length) {
      return {
        ok: true,
        sincronizados: 0,
      };
    }


    /*
      Não enviamos empresa_id como fonte
      de autorização.

      O backend usa o JWT.

      empresa_id continua existindo no
      IndexedDB apenas para organização
      local do terminal.
    */

    const payload = {
      pontos:
        pontos.map(
          (ponto) => ({
            offline_uuid:
              ponto.offline_uuid,

            funcionario_id:
              ponto.funcionario_id,

            tipo:
              ponto.tipo,

            horario_dispositivo:
              ponto.horario_dispositivo,
          })
        ),
    };


    const { data } =
      await api.post(
        "/ponto/sincronizar-offline",
        payload
      );


    const resultados =
      Array.isArray(
        data?.resultados
      )
        ? data.resultados
        : [];


    /* =====================================================
       APAGAR SOMENTE O QUE O SERVIDOR CONFIRMOU

       Se foi:
       sincronizado
       ou
       ja_sincronizado

       pode sair da fila.

       Rejeitados permanecem para podermos
       tratar/visualizar posteriormente.
    ===================================================== */

    for (
      const resultado
      of resultados
    ) {
      if (
        resultado.status ===
          "sincronizado" ||
        resultado.status ===
          "ja_sincronizado"
      ) {
        await removerPontoOffline(
          resultado.offline_uuid
        );
      }
    }


    return {
      ok: true,

      ...data,
    };

  } catch (error) {
    console.error(
      "Erro ao sincronizar pontos offline:",
      error
    );


    return {
      ok: false,

      motivo:
        "erro_rede",

      error,
    };

  } finally {
    sincronizando =
      false;
  }
}