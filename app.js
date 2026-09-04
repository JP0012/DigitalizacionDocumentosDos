"use strict";

/* ============================================================
   DOCUMENT SCANNER - APP.JS
============================================================ */


/* ============================================================
   CONFIGURACIÓN
============================================================ */

const CONFIG = {

    // Tiempo que el documento debe permanecer quieto.
    STABILITY_TIME: 3000,

    // Cada cuánto se analiza la cámara.
    ANALYSIS_INTERVAL: 140,

    // Cantidad de detecciones consecutivas necesarias
    // antes de considerar que realmente hay un documento.
    REQUIRED_CONSECUTIVE_DETECTIONS: 4,

    // Área mínima del documento respecto a la imagen.
    MIN_DOCUMENT_AREA_RATIO: 0.15,

    // Área máxima. Evita detectar prácticamente toda la cámara
    // como si fuera un documento.
    MAX_DOCUMENT_AREA_RATIO: 0.95,

    // Tamaño máximo utilizado para detección.
    DETECTION_MAX_WIDTH: 900,

    // Tamaño máximo para procesar la captura final.
    MAX_PROCESSING_WIDTH: 2200,

    // Movimiento máximo permitido.
    POSITION_TOLERANCE: 0.012,

    // Aproximación del contorno.
    APPROX_EPSILON: 0.02,

    // Calidad JPEG.
    JPEG_QUALITY: 0.96,

    // Margen del PDF.
    PDF_MARGIN: 3,

    // Máximo ángulo permitido para considerar
    // una esquina aproximadamente rectangular.
    MAX_CORNER_COSINE: 0.45,

    // Diferencia máxima entre lados opuestos.
    MAX_OPPOSITE_SIDE_RATIO: 2.2,

    // Proporciones permitidas para un documento.
    MIN_ASPECT_RATIO: 0.45,
    MAX_ASPECT_RATIO: 2.20
};


/* ============================================================
   ESTADO GENERAL
============================================================ */

const state = {

    cameraStream: null,

    cameras: [],

    currentCameraIndex: 0,

    cameraRunning: false,

    opencvReady: false,

    processing: false,

    analyzing: false,

    lastAnalysisTime: 0,


    // Documento detectado actualmente.
    detectedDocument: null,


    // Documento validado durante varias detecciones.
    candidateDocument: null,


    // Número de detecciones consecutivas.
    consecutiveDetections: 0,


    // Documento usado para medir estabilidad.
    previousDocument: null,


    // Momento en que comenzó la estabilidad real.
    stableSince: null,


    stabilityProgress: 0,

    autoCaptureLocked: false,


    // Documento capturado.
    currentOriginalCanvas: null,

    currentGrayCanvas: null,

    currentScanCanvas: null,

    selectedFilter: "scan",


    // Páginas guardadas.
    pages: []
};


/* ============================================================
   ELEMENTOS DEL DOM
============================================================ */

const video =
    document.getElementById("video");

const overlayCanvas =
    document.getElementById("overlayCanvas");

const cameraSection =
    document.getElementById("cameraSection");

const resultSection =
    document.getElementById("resultSection");

const gallerySection =
    document.getElementById("gallerySection");

const previewImage =
    document.getElementById("previewImage");

const scannerFrame =
    document.getElementById("scannerFrame");

const cameraMessage =
    document.getElementById("cameraMessage");

const cameraStatus =
    document.getElementById("cameraStatus");

const detectionIcon =
    document.getElementById("detectionIcon");

const detectionTitle =
    document.getElementById("detectionTitle");

const detectionDescription =
    document.getElementById("detectionDescription");

const stabilityBar =
    document.getElementById("stabilityBar");

const stabilityPercent =
    document.getElementById("stabilityPercent");

const stabilityIndicator =
    document.getElementById("stabilityIndicator");

const progressCircle =
    document.getElementById("progressCircle");

const countdownNumber =
    document.getElementById("countdownNumber");

const captureFlash =
    document.getElementById("captureFlash");

const pageCount =
    document.getElementById("pageCount");

const pagesGrid =
    document.getElementById("pagesGrid");

const emptyGallery =
    document.getElementById("emptyGallery");

const pdfActions =
    document.getElementById("pdfActions");

const summaryPages =
    document.getElementById("summaryPages");

const toast =
    document.getElementById("toast");

const toastMessage =
    document.getElementById("toastMessage");

const loadingOverlay =
    document.getElementById("loadingOverlay");

const loadingText =
    document.getElementById("loadingText");


/* ============================================================
   BOTONES
============================================================ */

const btnCapture =
    document.getElementById("btnCapture");

const btnCameraSwitch =
    document.getElementById("btnCameraSwitch");

const btnGallery =
    document.getElementById("btnGallery");

const btnGalleryBottom =
    document.getElementById("btnGalleryBottom");

const btnCloseGallery =
    document.getElementById("btnCloseGallery");

const btnCloseResult =
    document.getElementById("btnCloseResult");

const btnRetake =
    document.getElementById("btnRetake");

const btnAddPage =
    document.getElementById("btnAddPage");

const btnSavePage =
    document.getElementById("btnSavePage");

const btnGeneratePDF =
    document.getElementById("btnGeneratePDF");


/* ============================================================
   INICIALIZAR
============================================================ */

document.addEventListener(
    "DOMContentLoaded",
    initialize
);


async function initialize() {

    setupEvents();

    resetDetection();

    updateGallery();

    await waitForOpenCV();

    await startCamera();

    startAnalysisLoop();
}


/* ============================================================
   EVENTOS
============================================================ */

function setupEvents() {

    if (btnCapture) {

        btnCapture.addEventListener(
            "click",
            manualCapture
        );
    }


    if (btnCameraSwitch) {

        btnCameraSwitch.addEventListener(
            "click",
            switchCamera
        );
    }


    if (btnGallery) {

        btnGallery.addEventListener(
            "click",
            showGallery
        );
    }


    if (btnGalleryBottom) {

        btnGalleryBottom.addEventListener(
            "click",
            showGallery
        );
    }


    if (btnCloseGallery) {

        btnCloseGallery.addEventListener(
            "click",
            showCamera
        );
    }


    if (btnCloseResult) {

        btnCloseResult.addEventListener(
            "click",
            showCamera
        );
    }


    if (btnRetake) {

        btnRetake.addEventListener(
            "click",
            retakeDocument
        );
    }


    if (btnAddPage) {

        btnAddPage.addEventListener(
            "click",
            addAnotherPage
        );
    }


    if (btnSavePage) {

        btnSavePage.addEventListener(
            "click",
            saveCurrentPage
        );
    }


    if (btnGeneratePDF) {

        btnGeneratePDF.addEventListener(
            "click",
            generatePDF
        );
    }


    document
        .querySelectorAll(".filter-button")
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    selectFilter(
                        button.dataset.filter
                    );
                }
            );
        });


    window.addEventListener(
        "resize",
        () => {

            if (state.detectedDocument) {

                drawDetection(
                    state.detectedDocument
                );
            }
        }
    );


    window.addEventListener(
        "beforeunload",
        stopCamera
    );
}


/* ============================================================
   ESPERAR OPENCV
============================================================ */

function waitForOpenCV() {

    return new Promise(resolve => {

        const check = () => {

            if (
                typeof cv !== "undefined" &&
                cv.Mat
            ) {

                state.opencvReady = true;

                resolve();

                return;
            }

            setTimeout(
                check,
                100
            );
        };

        check();
    });
}


/* ============================================================
   INICIAR CÁMARA
============================================================ */

async function startCamera() {

    try {

        stopCamera();


        state.cameraStream =
            await navigator.mediaDevices.getUserMedia({

                audio: false,

                video: {

                    facingMode: {
                        ideal: "environment"
                    },

                    width: {
                        ideal: 1920
                    },

                    height: {
                        ideal: 1080
                    }
                }
            });


        video.srcObject =
            state.cameraStream;


        await video.play();


        state.cameraRunning =
            true;


        await loadCameras();


        resetDetection();


        showToast(
            "Cámara lista",
            "✓"
        );

    } catch (error) {

        console.error(error);

        showToast(
            "No se pudo acceder a la cámara.",
            "!"
        );
    }
}


/* ============================================================
   OBTENER CÁMARAS
============================================================ */

async function loadCameras() {

    try {

        const devices =
            await navigator.mediaDevices.enumerateDevices();


        state.cameras =
            devices.filter(
                device =>
                    device.kind === "videoinput"
            );

    } catch (error) {

        console.error(error);
    }
}


/* ============================================================
   CAMBIAR CÁMARA
============================================================ */

async function switchCamera() {

    if (
        state.cameras.length < 2
    ) {

        showToast(
            "No hay otra cámara disponible.",
            "!"
        );

        return;
    }


    state.currentCameraIndex++;


    if (
        state.currentCameraIndex >=
        state.cameras.length
    ) {

        state.currentCameraIndex = 0;
    }


    stopCamera();


    try {

        const deviceId =
            state.cameras[
                state.currentCameraIndex
            ].deviceId;


        state.cameraStream =
            await navigator.mediaDevices.getUserMedia({

                audio: false,

                video: {

                    deviceId: {
                        exact: deviceId
                    },

                    width: {
                        ideal: 1920
                    },

                    height: {
                        ideal: 1080
                    }
                }
            });


        video.srcObject =
            state.cameraStream;


        await video.play();


        state.cameraRunning =
            true;


        resetDetection();


        showToast(
            "Cámara cambiada",
            "✓"
        );

    } catch (error) {

        console.error(error);

        showToast(
            "No se pudo cambiar la cámara.",
            "!"
        );
    }
}


/* ============================================================
   DETENER CÁMARA
============================================================ */

function stopCamera() {

    if (!state.cameraStream) {

        return;
    }


    state.cameraStream
        .getTracks()
        .forEach(track => {

            track.stop();
        });


    state.cameraStream =
        null;


    state.cameraRunning =
        false;
}


/* ============================================================
   LOOP DE DETECCIÓN
============================================================ */

function startAnalysisLoop() {

    requestAnimationFrame(
        analysisLoop
    );
}


function analysisLoop(timestamp) {

    requestAnimationFrame(
        analysisLoop
    );


    if (
        !state.cameraRunning ||
        !state.opencvReady ||
        state.processing ||
        state.analyzing
    ) {

        return;
    }


    if (
        resultSection &&
        !resultSection.classList.contains("hidden")
    ) {

        return;
    }


    if (
        gallerySection &&
        !gallerySection.classList.contains("hidden")
    ) {

        return;
    }


    if (
        timestamp -
        state.lastAnalysisTime <
        CONFIG.ANALYSIS_INTERVAL
    ) {

        return;
    }


    state.lastAnalysisTime =
        timestamp;


    analyzeCameraFrame();
}


/* ============================================================
   ANALIZAR FRAME
============================================================ */

function analyzeCameraFrame() {

    if (
        !video ||
        video.readyState <
        HTMLMediaElement.HAVE_CURRENT_DATA ||
        !video.videoWidth ||
        !video.videoHeight
    ) {

        return;
    }


    state.analyzing =
        true;


    let src = null;


    try {

        const originalWidth =
            video.videoWidth;

        const originalHeight =
            video.videoHeight;


        const scale =
            Math.min(

                1,

                CONFIG.DETECTION_MAX_WIDTH /
                originalWidth
            );


        const width =
            Math.round(
                originalWidth * scale
            );


        const height =
            Math.round(
                originalHeight * scale
            );


        const canvas =
            document.createElement("canvas");


        canvas.width =
            width;

        canvas.height =
            height;


        const context =
            canvas.getContext(

                "2d",

                {
                    willReadFrequently: true
                }
            );


        context.drawImage(

            video,

            0,
            0,

            width,
            height
        );


        src =
            cv.imread(canvas);


        const corners =
            detectDocument(src);


        if (corners) {

            const normalizedCorners =
                normalizeCorners(

                    corners,

                    width,

                    height
                );


            processDetectedDocument(
                normalizedCorners
            );

        } else {

            processNoDocument();
        }

    } catch (error) {

        console.error(
            "Error analizando cámara:",
            error
        );

        processNoDocument();

    } finally {

        if (src) {

            src.delete();
        }


        state.analyzing =
            false;
    }
}


/* ============================================================
   DETECCIÓN DEL DOCUMENTO

   AQUÍ ESTÁ LA PARTE PRINCIPAL CORREGIDA.
============================================================ */

function detectDocument(src) {

    let gray = null;
    let blurred = null;
    let edges = null;
    let kernel = null;
    let contours = null;
    let hierarchy = null;


    try {

        gray =
            new cv.Mat();

        blurred =
            new cv.Mat();

        edges =
            new cv.Mat();

        contours =
            new cv.MatVector();

        hierarchy =
            new cv.Mat();


        /* -----------------------------
           ESCALA DE GRISES
        ----------------------------- */

        cv.cvtColor(

            src,

            gray,

            cv.COLOR_RGBA2GRAY
        );


        /* -----------------------------
           REDUCIR RUIDO
        ----------------------------- */

        cv.GaussianBlur(

            gray,

            blurred,

            new cv.Size(5, 5),

            0
        );


        /* -----------------------------
           DETECTAR BORDES
        ----------------------------- */

        cv.Canny(

            blurred,

            edges,

            60,

            160
        );


        /* -----------------------------
           CONECTAR BORDES
        ----------------------------- */

        kernel =
            cv.getStructuringElement(

                cv.MORPH_RECT,

                new cv.Size(3, 3)
            );


        cv.morphologyEx(

            edges,

            edges,

            cv.MORPH_CLOSE,

            kernel
        );


        /* -----------------------------
           BUSCAR CONTORNOS
        ----------------------------- */

        cv.findContours(

            edges,

            contours,

            hierarchy,

            cv.RETR_LIST,

            cv.CHAIN_APPROX_SIMPLE
        );


        const imageArea =
            src.cols *
            src.rows;


        let bestDocument =
            null;

        let bestScore =
            0;


        for (

            let i = 0;

            i < contours.size();

            i++

        ) {

            const contour =
                contours.get(i);


            const contourArea =
                Math.abs(

                    cv.contourArea(
                        contour
                    )
                );


            /* ---------------------------------
               1. IGNORAR OBJETOS MUY PEQUEÑOS
            --------------------------------- */

            if (

                contourArea <

                imageArea *
                CONFIG.MIN_DOCUMENT_AREA_RATIO

            ) {

                contour.delete();

                continue;
            }


            /* ---------------------------------
               2. IGNORAR OBJETOS DEMASIADO
                  GRANDES
            --------------------------------- */

            if (

                contourArea >

                imageArea *
                CONFIG.MAX_DOCUMENT_AREA_RATIO

            ) {

                contour.delete();

                continue;
            }


            const perimeter =
                cv.arcLength(

                    contour,

                    true
                );


            const approx =
                new cv.Mat();


            cv.approxPolyDP(

                contour,

                approx,

                perimeter *
                CONFIG.APPROX_EPSILON,

                true
            );


            /* ---------------------------------
               DEBE TENER EXACTAMENTE
               CUATRO ESQUINAS
            --------------------------------- */

            if (

                approx.rows === 4 &&

                cv.isContourConvex(
                    approx
                )

            ) {

                const points =
                    extractPoints(
                        approx
                    );


                if (

                    points &&

                    points.length === 4

                ) {

                    const ordered =
                        orderCorners(
                            points
                        );


                    /*
                    VALIDACIÓN ESTRICTA
                    */

                    if (

                        isValidDocumentShape(

                            ordered,

                            imageArea

                        )

                    ) {

                        const score =
                            calculateDocumentScore(

                                ordered,

                                contourArea,

                                imageArea,

                                src.cols,

                                src.rows
                            );


                        if (

                            score >

                            bestScore

                        ) {

                            bestScore =
                                score;

                            bestDocument =
                                ordered;
                        }
                    }
                }
            }


            approx.delete();

            contour.delete();
        }


        /*
        Si la puntuación no es suficiente,
        NO es documento.
        */

        if (

            bestScore < 0.50

        ) {

            return null;
        }


        return bestDocument;

    } catch (error) {

        console.error(
            "Error detectando documento:",
            error
        );

        return null;

    } finally {

        if (gray) {
            gray.delete();
        }

        if (blurred) {
            blurred.delete();
        }

        if (edges) {
            edges.delete();
        }

        if (kernel) {
            kernel.delete();
        }

        if (contours) {
            contours.delete();
        }

        if (hierarchy) {
            hierarchy.delete();
        }
    }
}


/* ============================================================
   VALIDACIÓN ESTRICTA DEL DOCUMENTO
============================================================ */

function isValidDocumentShape(

    points,

    imageArea

) {

    if (

        !points ||

        points.length !== 4

    ) {

        return false;
    }


    /*
    ÁREA DEL CUADRILÁTERO
    */

    const area =
        Math.abs(

            polygonArea(
                points
            )
        );


    const areaRatio =
        area /
        imageArea;


    if (

        areaRatio <

        CONFIG.MIN_DOCUMENT_AREA_RATIO

    ) {

        return false;
    }


    if (

        areaRatio >

        CONFIG.MAX_DOCUMENT_AREA_RATIO

    ) {

        return false;
    }


    /*
    DISTANCIAS
    */

    const top =
        distance(

            points[0],

            points[1]
        );


    const right =
        distance(

            points[1],

            points[2]
        );


    const bottom =
        distance(

            points[2],

            points[3]
        );


    const left =
        distance(

            points[3],

            points[0]
        );


    /*
    Ningún lado puede ser demasiado pequeño.
    */

    if (

        top < 40 ||

        right < 40 ||

        bottom < 40 ||

        left < 40

    ) {

        return false;
    }


    /*
    RELACIÓN DE ASPECTO
    */

    const averageWidth =
        (top + bottom) / 2;


    const averageHeight =
        (left + right) / 2;


    let aspectRatio =
        averageWidth /
        averageHeight;


    /*
    Permitimos vertical y horizontal.
    */

    if (

        aspectRatio <

        CONFIG.MIN_ASPECT_RATIO ||

        aspectRatio >

        CONFIG.MAX_ASPECT_RATIO

    ) {

        return false;
    }


    /*
    LADOS OPUESTOS NO DEBEN SER
    EXAGERADAMENTE DIFERENTES.
    */

    const horizontalDifference =
        Math.max(

            top,

            bottom

        )

        /

        Math.min(

            top,

            bottom
        );


    const verticalDifference =
        Math.max(

            left,

            right

        )

        /

        Math.min(

            left,

            right
        );


    if (

        horizontalDifference >

        CONFIG.MAX_OPPOSITE_SIDE_RATIO

    ) {

        return false;
    }


    if (

        verticalDifference >

        CONFIG.MAX_OPPOSITE_SIDE_RATIO

    ) {

        return false;
    }


    /*
    VALIDAR LOS CUATRO ÁNGULOS.
    */

    for (

        let i = 0;

        i < 4;

        i++

    ) {

        const previous =
            points[
                (i + 3) % 4
            ];


        const current =
            points[i];


        const next =
            points[
                (i + 1) % 4
            ];


        const cosine =
            calculateAngleCosine(

                previous,

                current,

                next
            );


        /*
        Un ángulo de 90 grados
        tiene coseno cercano a 0.
        */

        if (

            Math.abs(cosine) >

            CONFIG.MAX_CORNER_COSINE

        ) {

            return false;
        }
    }


    /*
    SI LLEGÓ AQUÍ:

    LA FORMA ES SUFICIENTEMENTE
    PARECIDA A UN DOCUMENTO.
    */

    return true;
}


/* ============================================================
   CALCULAR ÁNGULO
============================================================ */

function calculateAngleCosine(

    pointA,

    pointB,

    pointC

) {

    const vector1 = {

        x:
            pointA.x -
            pointB.x,

        y:
            pointA.y -
            pointB.y
    };


    const vector2 = {

        x:
            pointC.x -
            pointB.x,

        y:
            pointC.y -
            pointB.y
    };


    const dotProduct =

        (

            vector1.x *

            vector2.x

        )

        +

        (

            vector1.y *

            vector2.y

        );


    const length1 =
        Math.sqrt(

            vector1.x *
            vector1.x

            +

            vector1.y *
            vector1.y
        );


    const length2 =
        Math.sqrt(

            vector2.x *
            vector2.x

            +

            vector2.y *
            vector2.y
        );


    if (

        length1 === 0 ||

        length2 === 0

    ) {

        return 1;
    }


    return (

        dotProduct /

        (

            length1 *
            length2

        )
    );
}


/* ============================================================
   EXTRAER PUNTOS
============================================================ */

function extractPoints(mat) {

    const points = [];


    for (

        let i = 0;

        i < 4;

        i++

    ) {

        points.push({

            x:
                mat.data32S[
                    i * 2
                ],

            y:
                mat.data32S[
                    i * 2 + 1
                ]
        });
    }


    return points;
}


/* ============================================================
   ORDENAR ESQUINAS

   0 = SUPERIOR IZQUIERDA
   1 = SUPERIOR DERECHA
   2 = INFERIOR DERECHA
   3 = INFERIOR IZQUIERDA
============================================================ */

function orderCorners(points) {

    if (

        !points ||

        points.length !== 4

    ) {

        return null;
    }


    const sums =
        points.map(

            point =>

                point.x +
                point.y

        );


    const differences =
        points.map(

            point =>

                point.x -
                point.y

        );


    const topLeft =
        points[
            sums.indexOf(

                Math.min(
                    ...sums
                )
            )
        ];


    const bottomRight =
        points[
            sums.indexOf(

                Math.max(
                    ...sums
                )
            )
        ];


    /*
    x - y:

    Mayor = superior derecha
    Menor = inferior izquierda
    */

    const topRight =
        points[
            differences.indexOf(

                Math.max(
                    ...differences
                )
            )
        ];


    const bottomLeft =
        points[
            differences.indexOf(

                Math.min(
                    ...differences
                )
            )
        ];


    /*
    Confirmar que no se repitan puntos.
    */

    const unique =
        new Set(

            [

                topLeft,

                topRight,

                bottomRight,

                bottomLeft

            ]

            .map(

                point =>

                    `${point.x}-${point.y}`
            )
        );


    if (

        unique.size !== 4

    ) {

        return orderCornersByCenter(
            points
        );
    }


    return [

        topLeft,

        topRight,

        bottomRight,

        bottomLeft

    ];
}


/* ============================================================
   ORDENAMIENTO ALTERNATIVO
============================================================ */

function orderCornersByCenter(points) {

    const center = {

        x:

            points.reduce(

                (sum, point) =>

                    sum + point.x,

                0

            ) / 4,


        y:

            points.reduce(

                (sum, point) =>

                    sum + point.y,

                0

            ) / 4
    };


    const sorted =
        [...points].sort(

            (a, b) => {

                const angleA =
                    Math.atan2(

                        a.y -
                        center.y,

                        a.x -
                        center.x
                    );


                const angleB =
                    Math.atan2(

                        b.y -
                        center.y,

                        b.x -
                        center.x
                    );


                return (

                    angleA -
                    angleB
                );
            }
        );


    /*
    Rotar para comenzar
    desde superior izquierda.
    */

    let startIndex = 0;

    let minSum =
        Infinity;


    sorted.forEach(

        (point, index) => {

            const sum =
                point.x +
                point.y;


            if (

                sum <

                minSum

            ) {

                minSum =
                    sum;

                startIndex =
                    index;
            }
        }
    );


    const rotated = [

        ...sorted.slice(
            startIndex
        ),

        ...sorted.slice(
            0,
            startIndex
        )
    ];


    /*
    Determinar dirección.
    */

    if (

        rotated[1].x <

        rotated[3].x

    ) {

        return [

            rotated[0],

            rotated[3],

            rotated[2],

            rotated[1]
        ];
    }


    return rotated;
}


/* ============================================================
   PUNTUACIÓN DEL DOCUMENTO
============================================================ */

function calculateDocumentScore(

    points,

    area,

    imageArea,

    imageWidth,

    imageHeight

) {

    const areaRatio =
        area /
        imageArea;


    const top =
        distance(
            points[0],
            points[1]
        );


    const right =
        distance(
            points[1],
            points[2]
        );


    const bottom =
        distance(
            points[2],
            points[3]
        );


    const left =
        distance(
            points[3],
            points[0]
        );


    const width =
        (top + bottom) / 2;


    const height =
        (left + right) / 2;


    let aspect =
        width /
        height;


    if (

        aspect < 1

    ) {

        aspect =
            1 /
            aspect;
    }


    /*
    Las hojas normalmente tienen una
    relación cercana a 1.29 - 1.55.
    */

    let aspectScore;


    if (

        aspect >= 1.20 &&

        aspect <= 1.65

    ) {

        aspectScore =
            1;

    } else {

        aspectScore =
            Math.max(

                0,

                1 -

                Math.abs(

                    aspect -
                    1.40

                ) / 1.0
            );
    }


    /*
    Tamaño.
    */

    const sizeScore =
        Math.min(

            areaRatio /
            0.60,

            1
        );


    /*
    Centro.
    */

    const centerX =

        (

            points[0].x +

            points[1].x +

            points[2].x +

            points[3].x

        )

        / 4;


    const centerY =

        (

            points[0].y +

            points[1].y +

            points[2].y +

            points[3].y

        )

        / 4;


    const imageCenterX =
        imageWidth / 2;


    const imageCenterY =
        imageHeight / 2;


    const centerDistance =
        Math.sqrt(

            Math.pow(

                centerX -
                imageCenterX,

                2

            )

            +

            Math.pow(

                centerY -
                imageCenterY,

                2
            )
        );


    const maximumDistance =
        Math.sqrt(

            Math.pow(
                imageCenterX,
                2
            )

            +

            Math.pow(
                imageCenterY,
                2
            )
        );


    const centerScore =
        Math.max(

            0,

            1 -

            (

                centerDistance /

                maximumDistance
            )
        );


    return (

        sizeScore *
        0.55

    )

    +

    (

        aspectScore *
        0.30

    )

    +

    (

        centerScore *
        0.15

    );
}


/* ============================================================
   PROCESAR DOCUMENTO DETECTADO

   NO EMPIEZA EL ESCANEO AQUÍ.

   PRIMERO NECESITA VARIAS DETECCIONES
   CONSECUTIVAS.
============================================================ */

function processDetectedDocument(corners) {

    /*
    Si todavía no existe candidato,
    guardamos el primero.
    */

    if (

        !state.candidateDocument

    ) {

        state.candidateDocument =
            corners;


        state.consecutiveDetections =
            1;


        state.detectedDocument =
            null;


        clearDetection();

        updateSearchingUI();

        return;
    }


    /*
    Comprobar si sigue siendo
    el mismo objeto.
    */

    if (

        documentsAreSimilar(

            corners,

            state.candidateDocument

        )

    ) {

        state.consecutiveDetections++;

    } else {

        /*
        Encontró algo diferente.

        Reiniciamos validación.
        */

        state.candidateDocument =
            corners;


        state.consecutiveDetections =
            1;


        state.detectedDocument =
            null;


        resetStabilityOnly();

        clearDetection();

        updateSearchingUI();

        return;
    }


    /*
    TODAVÍA NO CONSIDERAMOS QUE SEA DOCUMENTO.
    */

    if (

        state.consecutiveDetections <

        CONFIG.REQUIRED_CONSECUTIVE_DETECTIONS

    ) {

        state.detectedDocument =
            null;


        clearDetection();

        updateSearchingUI();

        return;
    }


    /*
    AHORA SÍ:

    Tenemos varias detecciones consecutivas.

    Se muestra el contorno verde.
    */

    state.detectedDocument =
        corners;


    drawDetection(
        corners
    );


    updateDocumentDetectedUI();


    /*
    AHORA se verifica la estabilidad
    de los 3 segundos.
    */

    handleDocumentStability(
        corners
    );


    state.candidateDocument =
        corners;
}


/* ============================================================
   NO SE DETECTÓ DOCUMENTO
============================================================ */

function processNoDocument() {

    state.detectedDocument =
        null;


    state.candidateDocument =
        null;


    state.consecutiveDetections =
        0;


    resetStabilityOnly();


    clearDetection();


    updateSearchingUI();
}


/* ============================================================
   COMPARAR DOCUMENTOS
============================================================ */

function documentsAreSimilar(

    documentA,

    documentB

) {

    if (

        !documentA ||

        !documentB

    ) {

        return false;
    }


    let totalMovement =
        0;


    for (

        let i = 0;

        i < 4;

        i++

    ) {

        const dx =
            documentA[i].x -

            documentB[i].x;


        const dy =
            documentA[i].y -

            documentB[i].y;


        totalMovement +=

            Math.sqrt(

                dx * dx +

                dy * dy
            );
    }


    const averageMovement =
        totalMovement /
        4;


    /*
    Para detección consecutiva
    permitimos una pequeña variación.
    */

    return (

        averageMovement <

        0.035
    );
}


/* ============================================================
   ESTABILIDAD
============================================================ */

function handleDocumentStability(corners) {

    if (

        state.autoCaptureLocked

    ) {

        return;
    }


    /*
    Primera detección validada.
    */

    if (

        !state.previousDocument

    ) {

        state.previousDocument =
            corners;


        state.stableSince =
            null;


        updateStability(
            0
        );

        return;
    }


    const stable =
        documentIsStable(

            corners,

            state.previousDocument
        );


    /*
    SI SE MOVIÓ:

    EL CONTADOR DE 3 SEGUNDOS
    SE REINICIA.
    */

    if (!stable) {

        state.previousDocument =
            corners;


        state.stableSince =
            null;


        updateStability(
            0
        );

        return;
    }


    /*
    SOLO CUANDO ESTÁ QUIETO
    EMPIEZAN LOS 3 SEGUNDOS.
    */

    if (

        state.stableSince === null

    ) {

        state.stableSince =
            performance.now();
    }


    const elapsed =

        performance.now() -

        state.stableSince;


    const progress =

        Math.min(

            elapsed /

            CONFIG.STABILITY_TIME,

            1
        );


    updateStability(
        progress
    );


    /*
    3 SEGUNDOS COMPLETOS.
    */

    if (

        progress >= 1 &&

        !state.autoCaptureLocked

    ) {

        state.autoCaptureLocked =
            true;


        /*
        Capturar EXACTAMENTE
        las esquinas actuales.
        */

        const finalCorners =
            corners.map(

                point => ({

                    x:
                        point.x,

                    y:
                        point.y
                })
            );


        captureDocument(
            finalCorners
        );
    }


    state.previousDocument =
        corners;
}


/* ============================================================
   DOCUMENTO ESTABLE
============================================================ */

function documentIsStable(

    current,

    previous

) {

    if (

        !current ||

        !previous

    ) {

        return false;
    }


    for (

        let i = 0;

        i < 4;

        i++

    ) {

        const dx =

            Math.abs(

                current[i].x -

                previous[i].x

            );


        const dy =

            Math.abs(

                current[i].y -

                previous[i].y

            );


        if (

            dx >

            CONFIG.POSITION_TOLERANCE ||

            dy >

            CONFIG.POSITION_TOLERANCE

        ) {

            return false;
        }
    }


    return true;
}


/* ============================================================
   RESETEAR DETECCIÓN COMPLETA
============================================================ */

function resetDetection() {

    state.detectedDocument =
        null;

    state.candidateDocument =
        null;

    state.consecutiveDetections =
        0;

    state.previousDocument =
        null;

    state.stableSince =
        null;

    state.stabilityProgress =
        0;

    state.autoCaptureLocked =
        false;


    clearDetection();

    updateStability(0);

    updateSearchingUI();
}


/* ============================================================
   RESETEAR SOLO ESTABILIDAD
============================================================ */

function resetStabilityOnly() {

    state.previousDocument =
        null;

    state.stableSince =
        null;

    state.stabilityProgress =
        0;

    state.autoCaptureLocked =
        false;


    updateStability(0);
}


/* ============================================================
   INTERFAZ BUSCANDO
============================================================ */

function updateSearchingUI() {

    if (scannerFrame) {

        scannerFrame
            .classList
            .remove(
                "detected"
            );
    }


    if (cameraMessage) {

        cameraMessage
            .classList
            .remove(
                "hidden"
            );
    }


    if (detectionIcon) {

        detectionIcon.textContent =
            "○";
    }


    if (detectionTitle) {

        detectionTitle.textContent =
            "Buscando documento";
    }


    if (detectionDescription) {

        detectionDescription.textContent =
            "Coloca una hoja completa frente a la cámara.";
    }


    if (cameraStatus) {

        cameraStatus.className =
            "status-pill waiting";


        cameraStatus.innerHTML =

            `
            <span class="status-dot"></span>
            Buscando documento
            `;
    }
}


/* ============================================================
   INTERFAZ DOCUMENTO DETECTADO
============================================================ */

function updateDocumentDetectedUI() {

    if (scannerFrame) {

        scannerFrame
            .classList
            .add(
                "detected"
            );
    }


    if (cameraMessage) {

        cameraMessage
            .classList
            .add(
                "hidden"
            );
    }


    if (detectionIcon) {

        detectionIcon.textContent =
            "✓";
    }


    if (detectionTitle) {

        detectionTitle.textContent =
            "Documento detectado";
    }


    if (detectionDescription) {

        detectionDescription.textContent =
            "Mantén el documento quieto.";
    }
}


/* ============================================================
   PROGRESO DE ESTABILIDAD
============================================================ */

function updateStability(progress) {

    state.stabilityProgress =
        progress;


    const percentage =
        Math.round(
            progress * 100
        );


    if (stabilityBar) {

        stabilityBar.style.width =
            `${percentage}%`;
    }


    if (stabilityPercent) {

        stabilityPercent.textContent =
            `${percentage}%`;
    }


    if (progressCircle) {

        const circumference =
            276.46;


        progressCircle.style.strokeDashoffset =

            circumference -

            (

                circumference *

                progress
            );
    }


    /*
    ESTÁ CONTANDO.
    */

    if (

        progress > 0 &&

        progress < 1

    ) {

        if (stabilityIndicator) {

            stabilityIndicator
                .classList
                .remove(
                    "hidden"
                );
        }


        if (countdownNumber) {

            const remaining =

                Math.max(

                    1,

                    Math.ceil(

                        (

                            CONFIG.STABILITY_TIME -

                            (

                                progress *

                                CONFIG.STABILITY_TIME

                            )

                        )

                        / 1000
                    )
                );


            countdownNumber.textContent =
                remaining;
        }


        if (cameraStatus) {

            cameraStatus.className =
                "status-pill stable";


            cameraStatus.innerHTML =

                `
                <span class="status-dot"></span>
                Documento estable
                `;
        }
    }

    else if (

        progress >= 1

    ) {

        if (countdownNumber) {

            countdownNumber.textContent =
                "✓";
        }
    }

    else {

        if (stabilityIndicator) {

            stabilityIndicator
                .classList
                .add(
                    "hidden"
                );
        }


        if (

            state.detectedDocument &&

            cameraStatus

        ) {

            cameraStatus.className =
                "status-pill detected";


            cameraStatus.innerHTML =

                `
                <span class="status-dot"></span>
                Documento detectado
                `;
        }
    }
}


/* ============================================================
   NORMALIZAR ESQUINAS
============================================================ */

function normalizeCorners(

    corners,

    width,

    height

) {

    return corners.map(

        point => ({

            x:
                point.x /
                width,

            y:
                point.y /
                height
        })
    );
}


/* ============================================================
   DIBUJAR DETECCIÓN VERDE
============================================================ */

function drawDetection(corners) {

    if (

        !overlayCanvas ||

        !video ||

        !corners

    ) {

        return;
    }


    const rect =
        video.getBoundingClientRect();


    overlayCanvas.width =
        Math.round(
            rect.width
        );


    overlayCanvas.height =
        Math.round(
            rect.height
        );


    const context =
        overlayCanvas.getContext(
            "2d"
        );


    context.clearRect(

        0,

        0,

        overlayCanvas.width,

        overlayCanvas.height
    );


    const points =
        corners.map(

            point => ({

                x:

                    point.x *

                    overlayCanvas.width,


                y:

                    point.y *

                    overlayCanvas.height
            })
        );


    context.beginPath();


    context.moveTo(

        points[0].x,

        points[0].y
    );


    for (

        let i = 1;

        i < 4;

        i++

    ) {

        context.lineTo(

            points[i].x,

            points[i].y
        );
    }


    context.closePath();


    context.strokeStyle =
        "#22c55e";


    context.lineWidth =
        4;


    context.shadowColor =
        "rgba(34, 197, 94, 0.8)";


    context.shadowBlur =
        10;


    context.stroke();


    context.shadowBlur =
        0;


    points.forEach(

        point => {

            context.beginPath();

            context.arc(

                point.x,

                point.y,

                7,

                0,

                Math.PI * 2
            );


            context.fillStyle =
                "#22c55e";


            context.fill();
        }
    );
}


/* ============================================================
   LIMPIAR DETECCIÓN
============================================================ */

function clearDetection() {

    if (!overlayCanvas) {

        return;
    }


    const context =
        overlayCanvas.getContext(
            "2d"
        );


    context.clearRect(

        0,

        0,

        overlayCanvas.width,

        overlayCanvas.height
    );
}


/* ============================================================
   CAPTURA MANUAL
============================================================ */

function manualCapture() {

    /*
    IMPORTANTE:

    No se permite capturar
    si no existe un documento validado.
    */

    if (

        !state.detectedDocument

    ) {

        showToast(

            "Espera a que se detecten correctamente las cuatro esquinas del documento.",

            "!"
        );

        return;
    }


    if (

        state.processing

    ) {

        return;
    }


    state.autoCaptureLocked =
        true;


    const corners =

        state.detectedDocument.map(

            point => ({

                x:
                    point.x,

                y:
                    point.y
            })
        );


    captureDocument(
        corners
    );
}


/* ============================================================
   CAPTURAR DOCUMENTO
============================================================ */

async function captureDocument(normalizedCorners) {

    if (

        state.processing

    ) {

        return;
    }


    /*
    Seguridad extra.

    Si por alguna razón no hay
    cuatro esquinas válidas,
    NO capturamos.
    */

    if (

        !normalizedCorners ||

        normalizedCorners.length !== 4

    ) {

        state.autoCaptureLocked =
            false;

        return;
    }


    state.processing =
        true;


    try {

        showLoading(
            "Escaneando documento..."
        );


        playCaptureFlash();


        /*
        Captura de la cámara.
        */

        const sourceCanvas =
            createVideoCanvas();


        /*
        Convertir las esquinas normalizadas
        al tamaño REAL de la imagen.
        */

        const absoluteCorners =

            normalizedCorners.map(

                point => ({

                    x:

                        point.x *

                        sourceCanvas.width,


                    y:

                        point.y *

                        sourceCanvas.height
                })
            );


        /*
        CORREGIR PERSPECTIVA.

        SOLO EL ÁREA DENTRO DE LAS
        CUATRO ESQUINAS.
        */

        const documentCanvas =
            perspectiveTransform(

                sourceCanvas,

                absoluteCorners
            );


        if (

            !documentCanvas ||

            documentCanvas.width < 100 ||

            documentCanvas.height < 100

        ) {

            throw new Error(
                "Documento inválido."
            );
        }


        /*
        Guardamos únicamente
        el documento recortado.
        */

        state.currentOriginalCanvas =
            documentCanvas;


        state.currentGrayCanvas =
            applyGrayFilter(
                documentCanvas
            );


        state.currentScanCanvas =
            applyScannerFilter(
                documentCanvas
            );


        state.selectedFilter =
            "scan";


        showResult(

            state.currentScanCanvas
        );


        hideLoading();

    } catch (error) {

        console.error(error);


        hideLoading();


        showToast(

            "No se pudo escanear el documento.",

            "!"
        );


        resetDetection();

    } finally {

        state.processing =
            false;
    }
}


/* ============================================================
   CREAR CANVAS DESDE VIDEO
============================================================ */

function createVideoCanvas() {

    const originalWidth =
        video.videoWidth;


    const originalHeight =
        video.videoHeight;


    let width =
        originalWidth;


    let height =
        originalHeight;


    if (

        width >

        CONFIG.MAX_PROCESSING_WIDTH

    ) {

        const scale =

            CONFIG.MAX_PROCESSING_WIDTH /

            width;


        width =
            Math.round(

                width *
                scale
            );


        height =
            Math.round(

                height *
                scale
            );
    }


    const canvas =
        document.createElement(
            "canvas"
        );


    canvas.width =
        width;


    canvas.height =
        height;


    const context =
        canvas.getContext(

            "2d",

            {

                willReadFrequently:
                    true
            }
        );


    context.drawImage(

        video,

        0,

        0,

        width,

        height
    );


    return canvas;
}


/* ============================================================
   TRANSFORMACIÓN DE PERSPECTIVA

   SOLO USA LAS CUATRO ESQUINAS.
============================================================ */

function perspectiveTransform(

    sourceCanvas,

    detectedCorners

) {

    let src = null;

    let dst = null;

    let sourcePoints = null;

    let destinationPoints = null;

    let matrix = null;


    try {

        const points =
            orderCorners(
                detectedCorners
            );


        if (

            !points ||

            points.length !== 4

        ) {

            throw new Error(
                "Esquinas inválidas."
            );
        }


        const top =
            distance(

                points[0],

                points[1]
            );


        const right =
            distance(

                points[1],

                points[2]
            );


        const bottom =
            distance(

                points[2],

                points[3]
            );


        const left =
            distance(

                points[3],

                points[0]
            );


        const documentWidth =
            Math.round(

                Math.max(

                    top,

                    bottom
                )
            );


        const documentHeight =
            Math.round(

                Math.max(

                    left,

                    right
                )
            );


        if (

            documentWidth < 100 ||

            documentHeight < 100

        ) {

            throw new Error(
                "Documento demasiado pequeño."
            );
        }


        src =
            cv.imread(
                sourceCanvas
            );


        dst =
            new cv.Mat();


        /*
        ORIGEN:

        LAS CUATRO ESQUINAS DETECTADAS.
        */

        sourcePoints =
            cv.matFromArray(

                4,

                1,

                cv.CV_32FC2,

                [

                    points[0].x,
                    points[0].y,

                    points[1].x,
                    points[1].y,

                    points[2].x,
                    points[2].y,

                    points[3].x,
                    points[3].y
                ]
            );


        /*
        DESTINO:

        RECTÁNGULO COMPLETO.
        */

        destinationPoints =
            cv.matFromArray(

                4,

                1,

                cv.CV_32FC2,

                [

                    0,
                    0,

                    documentWidth - 1,
                    0,

                    documentWidth - 1,
                    documentHeight - 1,

                    0,
                    documentHeight - 1
                ]
            );


        matrix =
            cv.getPerspectiveTransform(

                sourcePoints,

                destinationPoints
            );


        cv.warpPerspective(

            src,

            dst,

            matrix,

            new cv.Size(

                documentWidth,

                documentHeight
            ),

            cv.INTER_CUBIC,

            cv.BORDER_REPLICATE
        );


        const result =
            document.createElement(
                "canvas"
            );


        result.width =
            documentWidth;


        result.height =
            documentHeight;


        cv.imshow(

            result,

            dst
        );


        return result;

    } finally {

        if (src) {
            src.delete();
        }

        if (dst) {
            dst.delete();
        }

        if (sourcePoints) {
            sourcePoints.delete();
        }

        if (destinationPoints) {
            destinationPoints.delete();
        }

        if (matrix) {
            matrix.delete();
        }
    }
}


/* ============================================================
   FILTRO GRIS
============================================================ */

function applyGrayFilter(sourceCanvas) {

    let src = null;

    let gray = null;


    try {

        src =
            cv.imread(
                sourceCanvas
            );


        gray =
            new cv.Mat();


        cv.cvtColor(

            src,

            gray,

            cv.COLOR_RGBA2GRAY
        );


        const result =
            document.createElement(
                "canvas"
            );


        result.width =
            gray.cols;


        result.height =
            gray.rows;


        cv.imshow(

            result,

            gray
        );


        return result;

    } finally {

        if (src) {
            src.delete();
        }

        if (gray) {
            gray.delete();
        }
    }
}


/* ============================================================
   FILTRO ESCÁNER
============================================================ */

function applyScannerFilter(sourceCanvas) {

    let src = null;

    let gray = null;

    let normalized = null;

    let binary = null;


    try {

        src =
            cv.imread(
                sourceCanvas
            );


        gray =
            new cv.Mat();


        normalized =
            new cv.Mat();


        binary =
            new cv.Mat();


        cv.cvtColor(

            src,

            gray,

            cv.COLOR_RGBA2GRAY
        );


        /*
        Mejorar contraste.
        */

        cv.normalize(

            gray,

            normalized,

            0,

            255,

            cv.NORM_MINMAX
        );


        /*
        Efecto tipo CamScanner:

        Fondo blanco
        Texto oscuro.
        */

        cv.adaptiveThreshold(

            normalized,

            binary,

            255,

            cv.ADAPTIVE_THRESH_GAUSSIAN_C,

            cv.THRESH_BINARY,

            35,

            8
        );


        const result =
            document.createElement(
                "canvas"
            );


        result.width =
            binary.cols;


        result.height =
            binary.rows;


        cv.imshow(

            result,

            binary
        );


        return result;

    } finally {

        if (src) {
            src.delete();
        }

        if (gray) {
            gray.delete();
        }

        if (normalized) {
            normalized.delete();
        }

        if (binary) {
            binary.delete();
        }
    }
}


/* ============================================================
   MOSTRAR RESULTADO
============================================================ */

function showResult(canvas) {

    if (!canvas) {

        return;
    }


    previewImage.src =
        canvas.toDataURL(

            "image/jpeg",

            CONFIG.JPEG_QUALITY
        );


    if (cameraSection) {

        cameraSection
            .classList
            .add("hidden");
    }


    if (gallerySection) {

        gallerySection
            .classList
            .add("hidden");
    }


    if (resultSection) {

        resultSection
            .classList
            .remove("hidden");
    }


    updateFilterButtons();
}


/* ============================================================
   FILTROS
============================================================ */

function selectFilter(filter) {

    state.selectedFilter =
        filter;


    const canvas =
        getCurrentCanvas();


    if (!canvas) {

        return;
    }


    previewImage.src =
        canvas.toDataURL(

            "image/jpeg",

            CONFIG.JPEG_QUALITY
        );


    updateFilterButtons();
}


function getCurrentCanvas() {

    if (

        state.selectedFilter ===
        "original"

    ) {

        return state.currentOriginalCanvas;
    }


    if (

        state.selectedFilter ===
        "gray"

    ) {

        return state.currentGrayCanvas;
    }


    return state.currentScanCanvas;
}


function updateFilterButtons() {

    document
        .querySelectorAll(
            ".filter-button"
        )

        .forEach(button => {

            button.classList.toggle(

                "active",

                button.dataset.filter ===

                state.selectedFilter
            );
        });
}


/* ============================================================
   GUARDAR PÁGINA
============================================================ */

function saveCurrentPage() {

    const canvas =
        getCurrentCanvas();


    if (!canvas) {

        return;
    }


    state.pages.push({

        id:

            Date.now()

            +

            Math.random(),


        image:

            canvas.toDataURL(

                "image/jpeg",

                CONFIG.JPEG_QUALITY
            ),


        width:
            canvas.width,


        height:
            canvas.height,


        filter:
            state.selectedFilter
    });


    updateGallery();


    showToast(

        `Página ${state.pages.length} guardada`,

        "✓"
    );


    addAnotherPage();
}


/* ============================================================
   VOLVER A TOMAR FOTO
============================================================ */

function retakeDocument() {

    clearCurrentDocument();


    if (resultSection) {

        resultSection
            .classList
            .add("hidden");
    }


    if (cameraSection) {

        cameraSection
            .classList
            .remove("hidden");
    }


    resetDetection();
}


/* ============================================================
   LIMPIAR DOCUMENTO
============================================================ */

function clearCurrentDocument() {

    state.currentOriginalCanvas =
        null;

    state.currentGrayCanvas =
        null;

    state.currentScanCanvas =
        null;

    state.selectedFilter =
        "scan";
}


/* ============================================================
   NUEVA PÁGINA
============================================================ */

function addAnotherPage() {

    clearCurrentDocument();


    if (resultSection) {

        resultSection
            .classList
            .add("hidden");
    }


    if (gallerySection) {

        gallerySection
            .classList
            .add("hidden");
    }


    if (cameraSection) {

        cameraSection
            .classList
            .remove("hidden");
    }


    resetDetection();
}


/* ============================================================
   GALERÍA
============================================================ */

function showGallery() {

    if (cameraSection) {

        cameraSection
            .classList
            .add("hidden");
    }


    if (resultSection) {

        resultSection
            .classList
            .add("hidden");
    }


    if (gallerySection) {

        gallerySection
            .classList
            .remove("hidden");
    }


    updateGallery();
}


function showCamera() {

    if (gallerySection) {

        gallerySection
            .classList
            .add("hidden");
    }


    if (resultSection) {

        resultSection
            .classList
            .add("hidden");
    }


    if (cameraSection) {

        cameraSection
            .classList
            .remove("hidden");
    }


    resetDetection();
}


/* ============================================================
   ACTUALIZAR GALERÍA
============================================================ */

function updateGallery() {

    if (pageCount) {

        pageCount.textContent =
            state.pages.length;
    }


    if (!pagesGrid) {

        return;
    }


    pagesGrid.innerHTML =
        "";


    if (

        state.pages.length === 0

    ) {

        if (emptyGallery) {

            emptyGallery
                .classList
                .remove("hidden");
        }


        if (pdfActions) {

            pdfActions
                .classList
                .add("hidden");
        }


        return;
    }


    if (emptyGallery) {

        emptyGallery
            .classList
            .add("hidden");
    }


    if (pdfActions) {

        pdfActions
            .classList
            .remove("hidden");
    }


    if (summaryPages) {

        summaryPages.textContent =

            state.pages.length === 1

                ? "1 página"

                : `${state.pages.length} páginas`;
    }


    state.pages.forEach(

        (page, index) => {

            const card =
                document.createElement(
                    "div"
                );


            card.className =
                "page-card";


            card.innerHTML =

                `
                <div class="page-image-container">

                    <img
                        src="${page.image}"
                        alt="Página ${index + 1}"
                    >

                </div>

                <span class="page-number">

                    Página ${index + 1}

                </span>

                <button
                    class="delete-page"
                    type="button"
                >
                    ×
                </button>

                <div class="page-card-footer">

                    <span>
                        Documento
                    </span>

                    <span>

                        ${
                            page.filter === "scan"
                                ? "Escáner"
                                : page.filter === "gray"
                                    ? "Gris"
                                    : "Original"
                        }

                    </span>

                </div>
                `;


            card
                .querySelector(
                    ".delete-page"
                )

                .addEventListener(

                    "click",

                    () => {

                        deletePage(
                            page.id
                        );
                    }
                );


            pagesGrid.appendChild(
                card
            );
        }
    );
}


/* ============================================================
   ELIMINAR PÁGINA
============================================================ */

function deletePage(id) {

    state.pages =
        state.pages.filter(

            page =>

                page.id !== id
        );


    updateGallery();


    showToast(
        "Página eliminada",
        "✓"
    );
}


/* ============================================================
   GENERAR PDF
============================================================ */

async function generatePDF() {

    if (

        state.pages.length === 0

    ) {

        showToast(

            "No hay páginas para generar el PDF.",

            "!"
        );

        return;
    }


    try {

        showLoading(
            "Generando PDF..."
        );


        const {

            jsPDF

        } =
            window.jspdf;


        let pdf = null;


        for (

            let i = 0;

            i < state.pages.length;

            i++

        ) {

            const page =
                state.pages[i];


            const image =
                await loadImage(
                    page.image
                );


            /*
            Determinar orientación según
            el documento capturado.
            */

            const orientation =

                image.width >

                image.height

                    ? "landscape"

                    : "portrait";


            if (

                i === 0

            ) {

                pdf =
                    new jsPDF({

                        orientation:
                            orientation,

                        unit:
                            "mm",

                        format:
                            "a4",

                        compress:
                            true
                    });

            } else {

                pdf.addPage(

                    "a4",

                    orientation
                );
            }


            const pageWidth =
                pdf.internal
                    .pageSize
                    .getWidth();


            const pageHeight =
                pdf.internal
                    .pageSize
                    .getHeight();


            const margin =
                CONFIG.PDF_MARGIN;


            const availableWidth =

                pageWidth -

                margin * 2;


            const availableHeight =

                pageHeight -

                margin * 2;


            const imageRatio =

                image.width /

                image.height;


            const availableRatio =

                availableWidth /

                availableHeight;


            let drawWidth;
            let drawHeight;


            /*
            AJUSTE CONTAIN:

            La imagen ocupa el máximo espacio posible
            sin deformarse ni recortarse.
            */

            if (

                imageRatio >

                availableRatio

            ) {

                drawWidth =
                    availableWidth;


                drawHeight =

                    drawWidth /

                    imageRatio;

            } else {

                drawHeight =
                    availableHeight;


                drawWidth =

                    drawHeight *

                    imageRatio;
            }


            const x =

                (

                    pageWidth -

                    drawWidth

                )

                / 2;


            const y =

                (

                    pageHeight -

                    drawHeight

                )

                / 2;


            /*
            IMPORTANTE:

            page.image ya es únicamente
            el documento recortado.

            Nunca la cámara completa.
            */

            pdf.addImage(

                page.image,

                "JPEG",

                x,

                y,

                drawWidth,

                drawHeight,

                undefined,

                "FAST"
            );
        }


        const filename =

            `documento_${formatDate(
                new Date()
            )}.pdf`;


        pdf.save(
            filename
        );


        hideLoading();


        showToast(

            "PDF generado correctamente",

            "✓"
        );

    } catch (error) {

        console.error(error);


        hideLoading();


        showToast(

            "No se pudo generar el PDF.",

            "!"
        );
    }
}


/* ============================================================
   CARGAR IMAGEN
============================================================ */

function loadImage(src) {

    return new Promise(

        (resolve, reject) => {

            const image =
                new Image();


            image.onload =
                () => resolve(
                    image
                );


            image.onerror =
                reject;


            image.src =
                src;
        }
    );
}


/* ============================================================
   FUNCIONES MATEMÁTICAS
============================================================ */

function distance(a, b) {

    return Math.sqrt(

        Math.pow(

            b.x -
            a.x,

            2

        )

        +

        Math.pow(

            b.y -
            a.y,

            2
        )
    );
}


function polygonArea(points) {

    let area =
        0;


    for (

        let i = 0;

        i < points.length;

        i++

    ) {

        const next =

            (

                i + 1

            )

            %

            points.length;


        area +=

            points[i].x *

            points[next].y

            -

            points[next].x *

            points[i].y;
    }


    return area / 2;
}


/* ============================================================
   FECHA
============================================================ */

function formatDate(date) {

    const year =
        date.getFullYear();


    const month =
        String(

            date.getMonth() + 1

        )

        .padStart(
            2,
            "0"
        );


    const day =
        String(

            date.getDate()

        )

        .padStart(
            2,
            "0"
        );


    const hour =
        String(

            date.getHours()

        )

        .padStart(
            2,
            "0"
        );


    const minute =
        String(

            date.getMinutes()

        )

        .padStart(
            2,
            "0"
        );


    return `${year}-${month}-${day}_${hour}-${minute}`;
}


/* ============================================================
   FLASH
============================================================ */

function playCaptureFlash() {

    if (!captureFlash) {

        return;
    }


    captureFlash
        .classList
        .remove(
            "active"
        );


    void captureFlash.offsetWidth;


    captureFlash
        .classList
        .add(
            "active"
        );
}


/* ============================================================
   LOADING
============================================================ */

function showLoading(message) {

    if (loadingText) {

        loadingText.textContent =
            message;
    }


    if (loadingOverlay) {

        loadingOverlay
            .classList
            .remove(
                "hidden"
            );
    }
}


function hideLoading() {

    if (loadingOverlay) {

        loadingOverlay
            .classList
            .add(
                "hidden"
            );
    }
}


/* ============================================================
   TOAST
============================================================ */

let toastTimeout;


function showToast(

    message,

    icon = "✓"

) {

    if (!toast) {

        return;
    }


    clearTimeout(
        toastTimeout
    );


    if (toastMessage) {

        toastMessage.textContent =
            message;
    }


    const toastIcon =
        document.getElementById(
            "toastIcon"
        );


    if (toastIcon) {

        toastIcon.textContent =
            icon;
    }


    toast
        .classList
        .add(
            "show"
        );


    toastTimeout =
        setTimeout(

            () => {

                toast
                    .classList
                    .remove(
                        "show"
                    );

            },

            2500
        );
}