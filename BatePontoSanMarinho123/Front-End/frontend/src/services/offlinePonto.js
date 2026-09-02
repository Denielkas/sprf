/* =========================================================
   BANCO LOCAL DO TERMINAL DE PONTO

   IndexedDB:
   - funciona sem internet
   - persiste mesmo atualizando/fechando a página
   - armazena temporariamente batidas pendentes
========================================================= */

const DB_NAME = "dek_ponto_offline";
const DB_VERSION = 1;

const STORE_PONTOS = "pontos_pendentes";
const STORE_ESTADOS = "estados_funcionarios";


/* =========================================================
   ABRIR BANCO
========================================================= */

function abrirBanco() {
  return new Promise((resolve, reject) => {
    const request =
      indexedDB.open(
        DB_NAME,
        DB_VERSION
      );

    request.onupgradeneeded =
      (event) => {
        const db =
          event.target.result;

        /* =====================================
           PONTOS PENDENTES
        ===================================== */

        if (
          !db.objectStoreNames.contains(
            STORE_PONTOS
          )
        ) {
          const store =
            db.createObjectStore(
              STORE_PONTOS,
              {
                keyPath:
                  "offline_uuid",
              }
            );

          store.createIndex(
            "funcionario_id",
            "funcionario_id",
            {
              unique: false,
            }
          );

          store.createIndex(
            "status",
            "status",
            {
              unique: false,
            }
          );

          store.createIndex(
            "horario_dispositivo",
            "horario_dispositivo",
            {
              unique: false,
            }
          );
        }


        /* =====================================
           ESTADO LOCAL DO FUNCIONÁRIO
        ===================================== */

        if (
          !db.objectStoreNames.contains(
            STORE_ESTADOS
          )
        ) {
          db.createObjectStore(
            STORE_ESTADOS,
            {
              keyPath:
                "chave",
            }
          );
        }
      };


    request.onsuccess =
      () => {
        resolve(
          request.result
        );
      };


    request.onerror =
      () => {
        reject(
          request.error
        );
      };
  });
}


/* =========================================================
   GERAR UUID
========================================================= */

function gerarUUID() {
  if (
    typeof crypto !==
      "undefined" &&
    typeof crypto.randomUUID ===
      "function"
  ) {
    return crypto.randomUUID();
  }

  /*
    Fallback para navegadores antigos.
  */

  return (
    "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx"
  ).replace(
    /[xy]/g,
    (caractere) => {
      const random =
        Math.floor(
          Math.random() * 16
        );

      const valor =
        caractere === "x"
          ? random
          : (
              random & 0x3
            ) | 0x8;

      return valor.toString(16);
    }
  );
}


/* =========================================================
   CHAVE DO ESTADO

   Incluímos empresa + funcionário para impedir
   colisão entre empresas.
========================================================= */

function chaveEstado(
  empresaId,
  funcionarioId
) {
  return (
    `${Number(empresaId)}:` +
    `${Number(funcionarioId)}`
  );
}


/* =========================================================
   SALVAR PONTO OFFLINE
========================================================= */

export async function salvarPontoOffline({
  empresa_id,
  funcionario_id,
  funcionario_nome,
  tipo,
}) {
  const db =
    await abrirBanco();

  const ponto = {
    offline_uuid:
      gerarUUID(),

    empresa_id:
      Number(
        empresa_id
      ),

    funcionario_id:
      Number(
        funcionario_id
      ),

    funcionario_nome:
      funcionario_nome ||
      null,

    tipo,

    /*
      Guardamos com offset do dispositivo.

      Exemplo:
      2026-09-02T08:31:10.000-03:00
    */

    horario_dispositivo:
      criarDataHoraLocalISO(),

    status:
      "pendente",

    criado_em:
      new Date().toISOString(),
  };


  return new Promise(
    (resolve, reject) => {
      const transaction =
        db.transaction(
          STORE_PONTOS,
          "readwrite"
        );

      const store =
        transaction.objectStore(
          STORE_PONTOS
        );

      const request =
        store.add(
          ponto
        );


      request.onsuccess =
        () => {
          resolve(
            ponto
          );
        };


      request.onerror =
        () => {
          reject(
            request.error
          );
        };


      transaction.oncomplete =
        () => {
          db.close();
        };
    }
  );
}


/* =========================================================
   DATA/HORA LOCAL COM OFFSET

   NÃO usamos simplesmente toISOString(),
   porque toISOString() transforma para UTC.

   Queremos preservar o horário e offset
   que existiam no terminal.
========================================================= */

function criarDataHoraLocalISO() {
  const agora =
    new Date();


  const pad =
    (valor) =>
      String(valor).padStart(
        2,
        "0"
      );


  const ano =
    agora.getFullYear();

  const mes =
    pad(
      agora.getMonth() + 1
    );

  const dia =
    pad(
      agora.getDate()
    );

  const hora =
    pad(
      agora.getHours()
    );

  const minuto =
    pad(
      agora.getMinutes()
    );

  const segundo =
    pad(
      agora.getSeconds()
    );


  /*
    getTimezoneOffset:

    Brasil normalmente retorna +180.

    Para ISO precisamos -03:00.
  */

  const offsetMinutos =
    -agora.getTimezoneOffset();


  const sinal =
    offsetMinutos >= 0
      ? "+"
      : "-";


  const absoluto =
    Math.abs(
      offsetMinutos
    );


  const offsetHoras =
    pad(
      Math.floor(
        absoluto / 60
      )
    );


  const offsetRestante =
    pad(
      absoluto % 60
    );


  return (
    `${ano}-${mes}-${dia}` +
    `T${hora}:${minuto}:${segundo}` +
    `${sinal}${offsetHoras}:${offsetRestante}`
  );
}


/* =========================================================
   LISTAR PONTOS PENDENTES
========================================================= */

export async function listarPontosPendentes() {
  const db =
    await abrirBanco();


  return new Promise(
    (resolve, reject) => {
      const transaction =
        db.transaction(
          STORE_PONTOS,
          "readonly"
        );

      const store =
        transaction.objectStore(
          STORE_PONTOS
        );

      const request =
        store.getAll();


      request.onsuccess =
        () => {
          const pontos =
            (
              request.result ||
              []
            )
              .filter(
                (ponto) =>
                  ponto.status ===
                  "pendente"
              )
              .sort(
                (a, b) =>
                  new Date(
                    a.horario_dispositivo
                  ).getTime() -
                  new Date(
                    b.horario_dispositivo
                  ).getTime()
              );


          resolve(
            pontos
          );
        };


      request.onerror =
        () => {
          reject(
            request.error
          );
        };


      transaction.oncomplete =
        () => {
          db.close();
        };
    }
  );
}


/* =========================================================
   CONTAR PENDENTES
========================================================= */

export async function contarPontosPendentes() {
  const pontos =
    await listarPontosPendentes();

  return pontos.length;
}


/* =========================================================
   REMOVER PONTO JÁ SINCRONIZADO
========================================================= */

export async function removerPontoOffline(
  offlineUuid
) {
  const db =
    await abrirBanco();


  return new Promise(
    (resolve, reject) => {
      const transaction =
        db.transaction(
          STORE_PONTOS,
          "readwrite"
        );

      const store =
        transaction.objectStore(
          STORE_PONTOS
        );


      const request =
        store.delete(
          offlineUuid
        );


      request.onsuccess =
        () => {
          resolve(true);
        };


      request.onerror =
        () => {
          reject(
            request.error
          );
        };


      transaction.oncomplete =
        () => {
          db.close();
        };
    }
  );
}


/* =========================================================
   SALVAR ESTADO LOCAL DO FUNCIONÁRIO

   Isso será usado para liberar corretamente:

   Entrada
   Intervalo
   Retorno
   Saída

   mesmo quando não houver internet.
========================================================= */

export async function salvarEstadoFuncionario({
  empresa_id,
  funcionario_id,
  ultima_batida,
  permissoes,
}) {
  const db =
    await abrirBanco();


  const registro = {
    chave:
      chaveEstado(
        empresa_id,
        funcionario_id
      ),

    empresa_id:
      Number(
        empresa_id
      ),

    funcionario_id:
      Number(
        funcionario_id
      ),

    ultima_batida:
      ultima_batida ||
      null,

    permissoes:
      permissoes || null,

    atualizado_em:
      new Date().toISOString(),
  };


  return new Promise(
    (resolve, reject) => {
      const transaction =
        db.transaction(
          STORE_ESTADOS,
          "readwrite"
        );

      const store =
        transaction.objectStore(
          STORE_ESTADOS
        );


      const request =
        store.put(
          registro
        );


      request.onsuccess =
        () => {
          resolve(
            registro
          );
        };


      request.onerror =
        () => {
          reject(
            request.error
          );
        };


      transaction.oncomplete =
        () => {
          db.close();
        };
    }
  );
}


/* =========================================================
   BUSCAR ESTADO LOCAL
========================================================= */

export async function buscarEstadoFuncionario(
  empresaId,
  funcionarioId
) {
  const db =
    await abrirBanco();


  return new Promise(
    (resolve, reject) => {
      const transaction =
        db.transaction(
          STORE_ESTADOS,
          "readonly"
        );

      const store =
        transaction.objectStore(
          STORE_ESTADOS
        );


      const request =
        store.get(
          chaveEstado(
            empresaId,
            funcionarioId
          )
        );


      request.onsuccess =
        () => {
          resolve(
            request.result ||
            null
          );
        };


      request.onerror =
        () => {
          reject(
            request.error
          );
        };


      transaction.oncomplete =
        () => {
          db.close();
        };
    }
  );
}


/* =========================================================
   CALCULAR PRÓXIMAS PERMISSÕES LOCALMENTE
========================================================= */

export function calcularPermissoesLocais(
  ultimaBatida
) {
  const permissoes = {
    entrada: false,
    intervalo_inicio: false,
    intervalo_fim: false,
    saida: false,
  };


  if (!ultimaBatida) {
    permissoes.entrada =
      true;

    return permissoes;
  }


  switch (ultimaBatida) {
    case "entrada":
      permissoes.intervalo_inicio =
        true;

      permissoes.saida =
        true;

      break;


    case "intervalo_inicio":
      permissoes.intervalo_fim =
        true;

      break;


    case "intervalo_fim":
      permissoes.intervalo_inicio =
        true;

      permissoes.saida =
        true;

      break;


    case "saida":
      permissoes.entrada =
        true;

      break;


    default:
      permissoes.entrada =
        true;
  }


  return permissoes;
}


/* =========================================================
   ATUALIZAR ESTADO DEPOIS DA BATIDA OFFLINE
========================================================= */

export async function atualizarEstadoAposBatidaOffline({
  empresa_id,
  funcionario_id,
  tipo,
}) {
  const permissoes =
    calcularPermissoesLocais(
      tipo
    );


  return salvarEstadoFuncionario({
    empresa_id,

    funcionario_id,

    ultima_batida:
      tipo,

    permissoes,
  });
}