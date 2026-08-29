import os
import base64

import face_recognition
import numpy as np

from io import BytesIO
from PIL import Image


# ==========================================================
# CONFIGURAÇÕES
# ==========================================================

FACE_MAX_WIDTH = int(
    os.getenv(
        "FACE_MAX_WIDTH",
        "480"
    )
)


# ==========================================================
# DECODIFICAR IMAGEM BASE64
# ==========================================================

def decode_image(base64_str):

    try:

        if not base64_str:
            raise ValueError(
                "Imagem base64 vazia."
            )

        # ==================================================
        # REMOVER PREFIXO DATA URL
        # ==================================================

        if "," in base64_str:

            _, encoded = base64_str.split(
                ",",
                1
            )

        else:

            encoded = base64_str


        # ==================================================
        # DECODIFICAR
        # ==================================================

        img_bytes = base64.b64decode(
            encoded
        )


        # ==================================================
        # ABRIR IMAGEM
        # ==================================================

        with Image.open(
            BytesIO(
                img_bytes
            )
        ) as img:

            # ==============================================
            # RGB
            # ==============================================

            img = img.convert(
                "RGB"
            )

            return np.asarray(
                img,
                dtype=np.uint8
            )

    except Exception as error:

        print(
            "❌ Erro ao decodificar imagem:",
            repr(error)
        )

        raise


# ==========================================================
# REDIMENSIONAR PARA RECONHECIMENTO
#
# Não precisamos processar uma imagem enorme.
#
# Exemplo:
#
# 1280px -> 480px
#
# Isso reduz bastante o trabalho do HOG.
# ==========================================================

def redimensionar_para_reconhecimento(
    image_np,
    max_width=None
):

    if image_np is None:
        return None

    if max_width is None:
        max_width = FACE_MAX_WIDTH

    altura, largura = image_np.shape[:2]

    if largura <= max_width:
        return image_np

    escala = (
        max_width /
        float(largura)
    )

    nova_altura = max(
        1,
        int(
            altura *
            escala
        )
    )

    imagem = Image.fromarray(
        image_np
    )

    imagem = imagem.resize(
        (
            max_width,
            nova_altura
        ),
        Image.Resampling.BILINEAR
    )

    return np.asarray(
        imagem,
        dtype=np.uint8
    )


# ==========================================================
# CONVERTER PARA JPEG
# ==========================================================

def imagem_para_jpeg_bytes(
    image_np
):

    try:

        imagem = Image.fromarray(
            image_np
        )

        imagem = imagem.convert(
            "RGB"
        )

        buffer = BytesIO()

        imagem.save(
            buffer,
            format="JPEG",
            quality=88,
            optimize=False
        )

        foto_bytes = buffer.getvalue()

        buffer.close()

        print(
            "📸 JPEG:",
            len(foto_bytes),
            "bytes"
        )

        return foto_bytes

    except Exception as error:

        print(
            "❌ Erro ao converter imagem:",
            repr(error)
        )

        raise


# ==========================================================
# GERAR EMBEDDING FACIAL
# ==========================================================

def get_face_embedding(
    image_np,
    reduzir=True
):

    if image_np is None:

        return None


    # ======================================================
    # REDUZIR IMAGEM
    # ======================================================

    if reduzir:

        imagem_processamento = (
            redimensionar_para_reconhecimento(
                image_np
            )
        )

    else:

        imagem_processamento = (
            image_np
        )


    # ======================================================
    # GARANTIR CONTIGUIDADE
    # ======================================================

    imagem_processamento = (
        np.ascontiguousarray(
            imagem_processamento,
            dtype=np.uint8
        )
    )


    # ======================================================
    # LOCALIZAR ROSTOS
    #
    # HOG é mais rápido na CPU que CNN.
    # ======================================================

    faces_locations = (
        face_recognition.face_locations(
            imagem_processamento,
            number_of_times_to_upsample=0,
            model="hog"
        )
    )


    # ======================================================
    # NENHUM ROSTO
    # ======================================================

    if not faces_locations:

        return None


    # ======================================================
    # ESCOLHER MAIOR ROSTO
    #
    # Se houver mais de uma pessoa na imagem,
    # usamos o maior rosto, que normalmente é
    # quem está centralizado na frente da câmera.
    # ======================================================

    def area_rosto(localizacao):

        top, right, bottom, left = (
            localizacao
        )

        largura = max(
            0,
            right - left
        )

        altura = max(
            0,
            bottom - top
        )

        return (
            largura *
            altura
        )


    melhor_rosto = max(
        faces_locations,
        key=area_rosto
    )


    # ======================================================
    # GERAR SOMENTE UM EMBEDDING
    #
    # Não precisamos gerar embeddings de todos os rostos.
    # ======================================================

    faces = (
        face_recognition.face_encodings(
            imagem_processamento,
            known_face_locations=[
                melhor_rosto
            ],
            num_jitters=1,
            model="small"
        )
    )


    if not faces:

        return None


    return np.asarray(
        faces[0],
        dtype=np.float64
    )


# ==========================================================
# COMPARAR DOIS EMBEDDINGS
# ==========================================================

def compare_embeddings(
    a,
    b,
    tolerance=None
):

    if tolerance is None:

        tolerance = float(
            os.getenv(
                "TOLERANCE",
                "0.45"
            )
        )

    a = np.asarray(
        a,
        dtype=np.float64
    )

    b = np.asarray(
        b,
        dtype=np.float64
    )

    dist = float(
        np.linalg.norm(
            a - b
        )
    )

    return (
        dist <= tolerance
    )