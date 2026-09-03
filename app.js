"use strict";

/* ============================================================
   DOCUSCAN - APP.JS
   ESCANEO DE DOCUMENTOS
============================================================ */


/* ============================================================
   CONFIGURACIÓN
============================================================ */

const CONFIG = {

    // El documento debe permanecer quieto este tiempo
    // antes de realizar la captura automática.
    STABILITY_TIME: 3000,

    // Frecuencia del análisis de la cámara.
    ANALYSIS_INTERVAL: 120,

    // Área mínima que debe ocupar un documento detectado.
    MIN_DOCUMENT_AREA_RATIO: 0.10,

    // Aproximación de contornos.
    APPROX_EPSILON: 0.025,

    // Movimiento máximo permitido para considerar
    // que el documento continúa estable.
    POSITION_TOLERANCE: 0.018,

    // Resolución máxima para procesar la captura final.
    MAX_PROCESSING_WIDTH: 2200,

    // Resolución utilizada únicamente para detectar.
    DETECTION_MAX_WIDTH: 1000,

    // Calidad de las imágenes guardadas.
    JPEG_QUALITY: 0.96,

    // Margen del PDF.
    PDF_MARGIN: 3
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

    // Esquinas detectadas normalizadas entre 0 y 1.
    detectedDocument: null,

    previousDocument: null,

    stableSince: null,

    stabilityProgress: 0,

    autoCaptureLocked: false,

    lastAnalysisTime: 0,

    currentOriginalCanvas: null,

    currentGrayCanvas: null,

    currentScanCanvas: null,

    selectedFilter: "scan",

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
   INICIALIZACIÓN
============================================================ */

document.addEventListener(
    "DOMContentLoaded",
    initialize
);


async function initialize() {

    setupEvents();

    resetStability();

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


        const constraints = {

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

        };


        state.cameraStream =
            await navigator.mediaDevices.getUserMedia(
                constraints
            );


        video.srcObject =
            state.cameraStream;


        await video.play();


        state.cameraRunning =
            true;


        await loadCameras();


        resetStability();


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
   CARGAR CÁMARAS
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


        resetStability();


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
   LOOP PRINCIPAL DE DETECCIÓN
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
        state.processing ||
        !state.opencvReady
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
   ANALIZAR IMAGEN DE LA CÁMARA
============================================================ */

function analyzeCameraFrame() {

    if (
        state.analyzing ||
        !video ||
        video.readyState <
        HTMLMediaElement.HAVE_CURRENT_DATA
    ) {

        return;
    }


    if (
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


        const detectionWidth =
            Math.round(
                originalWidth * scale
            );


        const detectionHeight =
            Math.round(
                originalHeight * scale
            );


        const canvas =
            document.createElement("canvas");


        canvas.width =
            detectionWidth;


        canvas.height =
            detectionHeight;


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

            detectionWidth,
            detectionHeight

        );


        src =
            cv.imread(canvas);


        const corners =
            detectDocument(src);


        if (corners) {

            const normalizedCorners =
                normalizeCorners(
                    corners,
                    detectionWidth,
                    detectionHeight
                );


            /*
            Validamos que las esquinas sean válidas.
            */

            if (
                isValidQuadrilateral(
                    normalizedCorners
                )
            ) {

                state.detectedDocument =
                    normalizedCorners;


                drawDetection(
                    normalizedCorners
                );


                handleDocumentStability(
                    normalizedCorners
                );

            } else {

                documentNotDetected();
            }

        } else {

            documentNotDetected();
        }

    } catch (error) {

        console.error(
            "Error analizando cámara:",
            error
        );

    } finally {

        if (src) {

            src.delete();
        }

        state.analyzing =
            false;
    }
}


/* ============================================================
   CUANDO NO HAY DOCUMENTO DETECTADO
============================================================ */

function documentNotDetected() {

    state.detectedDocument =
        null;


    clearDetection();


    resetStability();


    updateDetectionUI(
        false
    );
}


/* ============================================================
   DETECCIÓN DEL DOCUMENTO
============================================================ */

function detectDocument(src) {

    let gray = null;
    let blur = null;
    let edges = null;
    let kernel = null;
    let contours = null;
    let hierarchy = null;

    try {

        gray =
            new cv.Mat();

        blur =
            new cv.Mat();

        edges =
            new cv.Mat();

        contours =
            new cv.MatVector();

        hierarchy =
            new cv.Mat();


        /*
        1. ESCALA DE GRISES
        */

        cv.cvtColor(

            src,

            gray,

            cv.COLOR_RGBA2GRAY
        );


        /*
        2. REDUCIR RUIDO SIN DESTRUIR BORDES
        */

        cv.GaussianBlur(

            gray,

            blur,

            new cv.Size(5, 5),

            0
        );


        /*
        3. DETECTAR BORDES
        */

        cv.Canny(

            blur,

            edges,

            45,

            130
        );


        /*
        4. CONECTAR BORDES
        */

        kernel =
            cv.getStructuringElement(

                cv.MORPH_RECT,

                new cv.Size(5, 5)
            );


        cv.morphologyEx(

            edges,

            edges,

            cv.MORPH_CLOSE,

            kernel
        );


        cv.dilate(

            edges,

            edges,

            kernel
        );


        /*
        5. BUSCAR CONTORNOS
        */

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


            const area =
                Math.abs(
                    cv.contourArea(contour)
                );


            /*
            Ignorar objetos pequeños.
            */

            if (
                area <
                imageArea *
                CONFIG.MIN_DOCUMENT_AREA_RATIO
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


            if (
                approx.rows === 4 &&
                cv.isContourConvex(approx)
            ) {

                const points =
                    extractPoints(approx);


                if (
                    points &&
                    isValidQuadrilateral(points)
                ) {

                    const ordered =
                        orderCorners(points);


                    const documentArea =
                        Math.abs(
                            polygonArea(ordered)
                        );


                    /*
                    Confirmar que realmente ocupa
                    suficiente espacio.
                    */

                    if (
                        documentArea >
                        imageArea *
                        CONFIG.MIN_DOCUMENT_AREA_RATIO
                    ) {

                        const score =
                            calculateDocumentScore(

                                ordered,

                                documentArea,

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

        if (blur) {
            blur.delete();
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
   EXTRAER PUNTOS DE OPENCV
============================================================ */

function extractPoints(mat) {

    if (
        !mat ||
        mat.rows !== 4
    ) {

        return null;
    }


    const points = [];


    /*
    approxPolyDP devuelve puntos en data32S
    en formato:
    x0, y0, x1, y1...
    */

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
   ORDENAR LAS CUATRO ESQUINAS

   Resultado:
   0 = Superior izquierda
   1 = Superior derecha
   2 = Inferior derecha
   3 = Inferior izquierda
============================================================ */

function orderCorners(points) {

    if (
        !points ||
        points.length !== 4
    ) {

        return null;
    }


    /*
    Calculamos el centro del cuadrilátero.
    */

    const center = {

        x:
            points.reduce(
                (total, point) =>
                    total + point.x,
                0
            ) / 4,

        y:
            points.reduce(
                (total, point) =>
                    total + point.y,
                0
            ) / 4
    };


    /*
    Ordenamos alrededor del centro.
    */

    const sorted =
        [...points].sort(

            (a, b) => {

                const angleA =
                    Math.atan2(

                        a.y - center.y,

                        a.x - center.x
                    );


                const angleB =
                    Math.atan2(

                        b.y - center.y,

                        b.x - center.x
                    );


                return (
                    angleA -
                    angleB
                );
            }
        );


    /*
    Encontrar el punto superior izquierdo:
    el que tenga menor x + y.
    */

    let topLeftIndex = 0;

    let minimumSum =
        Infinity;


    sorted.forEach(

        (point, index) => {

            const sum =
                point.x +
                point.y;


            if (
                sum <
                minimumSum
            ) {

                minimumSum =
                    sum;

                topLeftIndex =
                    index;
            }
        }
    );


    /*
    Rotamos para comenzar siempre
    desde superior izquierda.
    */

    const rotated = [

        ...sorted.slice(topLeftIndex),

        ...sorted.slice(0, topLeftIndex)

    ];


    /*
    Dependiendo del sentido de giro,
    determinamos cuál es superior derecha.
    */

    const candidate1 =
        rotated[1];

    const candidate2 =
        rotated[3];


    const result = [
        rotated[0],
        candidate1,
        rotated[2],
        candidate2
    ];


    /*
    Aseguramos:

    [0] Superior izquierda
    [1] Superior derecha
    [2] Inferior derecha
    [3] Inferior izquierda
    */

    if (
        result[1].y >
        result[3].y
    ) {

        return [

            result[0],

            result[3],

            result[2],

            result[1]

        ];
    }


    return result;
}


/* ============================================================
   VALIDAR CUADRILÁTERO
============================================================ */

function isValidQuadrilateral(points) {

    if (
        !points ||
        points.length !== 4
    ) {

        return false;
    }


    const ordered =
        orderCorners(points);


    if (!ordered) {

        return false;
    }


    const area =
        Math.abs(
            polygonArea(ordered)
        );


    if (
        area <= 0
    ) {

        return false;
    }


    /*
    Ninguna esquina debe ser exactamente igual.
    */

    for (
        let i = 0;
        i < 4;
        i++
    ) {

        for (
            let j = i + 1;
            j < 4;
            j++
        ) {

            const d =
                distance(
                    ordered[i],
                    ordered[j]
                );


            if (
                d < 10
            ) {

                return false;
            }
        }
    }


    return true;
}


/* ============================================================
   CALCULAR ÁREA
============================================================ */

function polygonArea(points) {

    let area = 0;


    for (
        let i = 0;
        i < points.length;
        i++
    ) {

        const next =
            (i + 1) %
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
   CALCULAR DISTANCIA
============================================================ */

function distance(a, b) {

    return Math.sqrt(

        Math.pow(
            b.x - a.x,
            2
        )

        +

        Math.pow(
            b.y - a.y,
            2
        )
    );
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


    /*
    Medidas del cuadrilátero.
    */

    const top =
        distance(
            points[0],
            points[1]
        );


    const bottom =
        distance(
            points[3],
            points[2]
        );


    const left =
        distance(
            points[0],
            points[3]
        );


    const right =
        distance(
            points[1],
            points[2]
        );


    const width =
        (top + bottom) / 2;


    const height =
        (left + right) / 2;


    if (
        width <= 0 ||
        height <= 0
    ) {

        return 0;
    }


    /*
    Relación de aspecto.
    */

    let ratio =
        width / height;


    if (
        ratio < 1
    ) {

        ratio =
            1 / ratio;
    }


    /*
    Los documentos más comunes:
    Carta = 1.294
    A4 = 1.414
    Oficio aproximadamente similar.
    */

    const expectedRatio =
        1.35;


    const ratioDifference =
        Math.abs(
            ratio -
            expectedRatio
        );


    const ratioScore =
        Math.max(

            0,

            1 -

            ratioDifference /
            0.85
        );


    /*
    El tamaño es importante.
    */

    const sizeScore =
        Math.min(

            areaRatio /
            0.70,

            1
        );


    /*
    Centro aproximado.
    */

    const centerX =
        points.reduce(
            (total, point) =>
                total + point.x,
            0
        ) / 4;


    const centerY =
        points.reduce(
            (total, point) =>
                total + point.y,
            0
        ) / 4;


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


    const maxDistance =
        Math.sqrt(

            imageCenterX *
            imageCenterX

            +

            imageCenterY *
            imageCenterY
        );


    const centerScore =
        Math.max(

            0,

            1 -

            (
                centerDistance /
                maxDistance
            )
        );


    /*
    Puntuación final.
    */

    return (

        sizeScore *
        0.60

    )

    +

    (

        ratioScore *
        0.25

    )

    +

    (

        centerScore *
        0.15

    );
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
                point.x / width,

            y:
                point.y / height

        })
    );
}


/* ============================================================
   ESTABILIDAD DEL DOCUMENTO
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

        const movementX =
            Math.abs(

                current[i].x -
                previous[i].x
            );


        const movementY =
            Math.abs(

                current[i].y -
                previous[i].y
            );


        if (
            movementX >
            CONFIG.POSITION_TOLERANCE ||

            movementY >
            CONFIG.POSITION_TOLERANCE
        ) {

            return false;
        }
    }


    return true;
}


/* ============================================================
   CONTROL DE ESTABILIDAD
============================================================ */

function handleDocumentStability(corners) {

    updateDetectionUI(
        true
    );


    if (
        state.autoCaptureLocked
    ) {

        return;
    }


    /*
    Primera detección.
    */

    if (
        !state.previousDocument
    ) {

        state.previousDocument =
            corners;


        state.stableSince =
            null;


        updateStability(0);

        return;
    }


    const stable =
        documentIsStable(

            corners,

            state.previousDocument
        );


    /*
    Si se mueve, el contador se reinicia.
    */

    if (!stable) {

        state.previousDocument =
            corners;


        state.stableSince =
            null;


        updateStability(0);

        return;
    }


    /*
    Solo aquí comienzan los 3 segundos.
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


    if (
        progress >= 1 &&
        !state.autoCaptureLocked
    ) {

        state.autoCaptureLocked =
            true;


        /*
        IMPORTANTE:

        Pasamos EXACTAMENTE las esquinas
        que están siendo mostradas en verde.
        */

        captureDocument(
            [...corners]
        );
    }


    state.previousDocument =
        corners;
}


/* ============================================================
   REINICIAR ESTABILIDAD
============================================================ */

function resetStability() {

    state.previousDocument =
        null;


    state.stableSince =
        null;


    state.stabilityProgress =
        0;


    state.autoCaptureLocked =
        false;


    updateStability(0);


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
   ACTUALIZAR INDICADOR DE ESTABILIDAD
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


    if (
        progress > 0 &&
        progress < 1
    ) {

        if (stabilityIndicator) {

            stabilityIndicator
                .classList
                .remove("hidden");
        }


        if (countdownNumber) {

            const remainingSeconds =
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
                remainingSeconds;
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
                .add("hidden");
        }
    }
}


/* ============================================================
   INTERFAZ DE DETECCIÓN
============================================================ */

function updateDetectionUI(detected) {

    if (detected) {

        if (scannerFrame) {

            scannerFrame
                .classList
                .add("detected");
        }


        if (cameraMessage) {

            cameraMessage
                .classList
                .add("hidden");
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
                "Mantén el documento quieto durante 3 segundos.";
        }


        if (
            state.stabilityProgress === 0 &&
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

    } else {

        if (scannerFrame) {

            scannerFrame
                .classList
                .remove("detected");
        }


        if (cameraMessage) {

            cameraMessage
                .classList
                .remove("hidden");
        }


        if (detectionIcon) {

            detectionIcon.textContent =
                "○";
        }


        if (detectionTitle) {

            detectionTitle.textContent =
                "Esperando documento";
        }


        if (detectionDescription) {

            detectionDescription.textContent =
                "Coloca la hoja dentro de la cámara.";
        }
    }
}


/* ============================================================
   DIBUJAR ESQUINAS VERDES
============================================================ */

function drawDetection(corners) {

    if (
        !overlayCanvas ||
        !video ||
        !corners
    ) {

        return;
    }


    const videoRect =
        video.getBoundingClientRect();


    /*
    El canvas visual debe coincidir exactamente
    con el tamaño visual del video.
    */

    overlayCanvas.width =
        Math.round(
            videoRect.width
        );


    overlayCanvas.height =
        Math.round(
            videoRect.height
        );


    const context =
        overlayCanvas.getContext("2d");


    context.clearRect(

        0,
        0,

        overlayCanvas.width,
        overlayCanvas.height
    );


    /*
    Convertir coordenadas normalizadas
    a coordenadas visuales.
    */

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


    /*
    Dibujar contorno.
    */

    context.beginPath();


    context.moveTo(

        points[0].x,

        points[0].y
    );


    for (
        let i = 1;
        i < points.length;
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
        "rgba(34,197,94,0.85)";


    context.shadowBlur =
        10;


    context.stroke();


    context.shadowBlur =
        0;


    /*
    Dibujar las cuatro esquinas.
    */

    points.forEach(point => {

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
    });
}


/* ============================================================
   LIMPIAR DETECCIÓN
============================================================ */

function clearDetection() {

    if (!overlayCanvas) {

        return;
    }


    const context =
        overlayCanvas.getContext("2d");


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

    if (
        state.processing
    ) {

        return;
    }


    if (
        !state.detectedDocument
    ) {

        showToast(

            "Primero espera a que se detecten las cuatro esquinas.",

            "!"
        );

        return;
    }


    state.autoCaptureLocked =
        true;


    /*
    Copia de las esquinas actuales.
    */

    const corners =
        state.detectedDocument.map(
            point => ({

                x: point.x,

                y: point.y
            })
        );


    captureDocument(
        corners
    );
}


/* ============================================================
   CAPTURAR DOCUMENTO

   IMPORTANTE:
   AQUÍ SE RECORTA SOLAMENTE EL ÁREA
   ENTRE LAS CUATRO ESQUINAS DETECTADAS.
============================================================ */

async function captureDocument(normalizedCorners) {

    if (
        state.processing
    ) {

        return;
    }


    state.processing =
        true;


    try {

        showLoading(
            "Recortando documento..."
        );


        playCaptureFlash();


        /*
        Capturamos la imagen completa de la cámara
        ÚNICAMENTE como fuente temporal.
        */

        const sourceCanvas =
            createVideoCanvas();


        /*
        Convertimos las coordenadas normalizadas
        directamente al tamaño REAL de la captura.
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
        MUY IMPORTANTE:

        Aquí se realiza el recorte y corrección.

        El resultado NO contiene toda la cámara.

        Solamente contiene el documento que está
        dentro de las cuatro esquinas.
        */

        const documentCanvas =
            perspectiveTransform(

                sourceCanvas,

                absoluteCorners
            );


        /*
        Verificación.
        */

        if (
            !documentCanvas ||
            documentCanvas.width < 50 ||
            documentCanvas.height < 50
        ) {

            throw new Error(
                "No se pudo recortar el documento."
            );
        }


        state.currentOriginalCanvas =
            documentCanvas;


        /*
        Crear versiones del documento YA RECORTADO.
        */

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

            "No se pudo recortar el documento correctamente.",

            "!"
        );


        state.autoCaptureLocked =
            false;


        resetStability();

    } finally {

        state.processing =
            false;
    }
}


/* ============================================================
   CREAR IMAGEN DE LA CÁMARA
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


    /*
    Reducimos únicamente si la resolución es demasiado
    grande, manteniendo la proporción.
    */

    if (
        originalWidth >
        CONFIG.MAX_PROCESSING_WIDTH
    ) {

        const scale =
            CONFIG.MAX_PROCESSING_WIDTH /
            originalWidth;


        width =
            Math.round(
                originalWidth * scale
            );


        height =
            Math.round(
                originalHeight * scale
            );
    }


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


    return canvas;
}


/* ============================================================
   CORRECCIÓN DE PERSPECTIVA Y RECORTE

   ESTA ES LA PARTE PRINCIPAL DEL ARREGLO.

   SOLO SE TRANSFORMA EL ÁREA ENTRE LAS
   CUATRO ESQUINAS DETECTADAS.
============================================================ */

function perspectiveTransform(

    sourceCanvas,

    detectedCorners

) {

    let src = null;
    let dst = null;
    let sourcePoints = null;
    let destinationPoints = null;
    let transformMatrix = null;

    try {

        /*
        Ordenamos nuevamente para asegurar
        que OpenCV reciba los puntos correctos.
        */

        const points =
            orderCorners(
                detectedCorners
            );


        if (
            !points ||
            points.length !== 4
        ) {

            throw new Error(
                "Las esquinas del documento no son válidas."
            );
        }


        /*
        ESQUINAS:

        0 = superior izquierda
        1 = superior derecha
        2 = inferior derecha
        3 = inferior izquierda
        */


        /*
        CALCULAR EL ANCHO DEL DOCUMENTO.
        */

        const widthTop =
            distance(

                points[0],

                points[1]
            );


        const widthBottom =
            distance(

                points[3],

                points[2]
            );


        /*
        CALCULAR EL ALTO DEL DOCUMENTO.
        */

        const heightLeft =
            distance(

                points[0],

                points[3]
            );


        const heightRight =
            distance(

                points[1],

                points[2]
            );


        /*
        El tamaño final se basa únicamente
        en la distancia entre las esquinas.
        */

        let documentWidth =
            Math.round(

                Math.max(

                    widthTop,

                    widthBottom
                )
            );


        let documentHeight =
            Math.round(

                Math.max(

                    heightLeft,

                    heightRight
                )
            );


        /*
        Protección contra valores inválidos.
        */

        if (
            documentWidth < 100 ||
            documentHeight < 100
        ) {

            throw new Error(
                "El área detectada es demasiado pequeña."
            );
        }


        /*
        Crear imagen OpenCV.
        */

        src =
            cv.imread(
                sourceCanvas
            );


        dst =
            new cv.Mat();


        /*
        PUNTOS DE ORIGEN:

        EXACTAMENTE LAS ESQUINAS VERDES.
        */

        sourcePoints =
            cv.matFromArray(

                4,

                1,

                cv.CV_32FC2,

                [

                    // Superior izquierda
                    points[0].x,
                    points[0].y,

                    // Superior derecha
                    points[1].x,
                    points[1].y,

                    // Inferior derecha
                    points[2].x,
                    points[2].y,

                    // Inferior izquierda
                    points[3].x,
                    points[3].y
                ]
            );


        /*
        PUNTOS DE DESTINO.

        Convertimos únicamente ese cuadrilátero
        en un rectángulo.
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


        /*
        Crear transformación de perspectiva.
        */

        transformMatrix =
            cv.getPerspectiveTransform(

                sourcePoints,

                destinationPoints
            );


        /*
        TRANSFORMACIÓN.

        El tamaño de salida es exactamente
        el tamaño calculado entre las esquinas.

        Por eso NO puede incluir toda la cámara.
        */

        cv.warpPerspective(

            src,

            dst,

            transformMatrix,

            new cv.Size(

                documentWidth,

                documentHeight
            ),

            cv.INTER_CUBIC,

            cv.BORDER_REPLICATE
        );


        /*
        Crear canvas final.
        */

        const resultCanvas =
            document.createElement("canvas");


        resultCanvas.width =
            documentWidth;


        resultCanvas.height =
            documentHeight;


        cv.imshow(

            resultCanvas,

            dst
        );


        return resultCanvas;

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

        if (transformMatrix) {
            transformMatrix.delete();
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
            document.createElement("canvas");


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

   Hoja blanca y texto oscuro.
============================================================ */

function applyScannerFilter(sourceCanvas) {

    let src = null;
    let gray = null;
    let background = null;
    let normalized = null;
    let binary = null;

    try {

        src =
            cv.imread(
                sourceCanvas
            );


        gray =
            new cv.Mat();

        background =
            new cv.Mat();

        normalized =
            new cv.Mat();

        binary =
            new cv.Mat();


        /*
        Escala de grises.
        */

        cv.cvtColor(

            src,

            gray,

            cv.COLOR_RGBA2GRAY
        );


        /*
        Suavizar iluminación.
        */

        cv.GaussianBlur(

            gray,

            background,

            new cv.Size(0, 0),

            25
        );


        /*
        Eliminar sombras.
        */

        cv.divide(

            gray,

            background,

            normalized,

            255
        );


        /*
        Normalizar contraste.
        */

        cv.normalize(

            normalized,

            normalized,

            0,

            255,

            cv.NORM_MINMAX
        );


        /*
        Efecto de escáner.
        */

        cv.adaptiveThreshold(

            normalized,

            binary,

            255,

            cv.ADAPTIVE_THRESH_GAUSSIAN_C,

            cv.THRESH_BINARY,

            41,

            9
        );


        const result =
            document.createElement("canvas");


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

        if (background) {
            background.delete();
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
   SELECCIONAR FILTRO
============================================================ */

function selectFilter(filter) {

    if (
        !state.currentOriginalCanvas
    ) {

        return;
    }


    state.selectedFilter =
        filter;


    let canvas =
        null;


    if (
        filter === "original"
    ) {

        canvas =
            state.currentOriginalCanvas;
    }

    else if (
        filter === "gray"
    ) {

        canvas =
            state.currentGrayCanvas;
    }

    else {

        canvas =
            state.currentScanCanvas;
    }


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


/* ============================================================
   ACTUALIZAR FILTROS
============================================================ */

function updateFilterButtons() {

    document
        .querySelectorAll(".filter-button")
        .forEach(button => {

            button.classList.toggle(

                "active",

                button.dataset.filter ===
                state.selectedFilter
            );

        });
}


/* ============================================================
   OBTENER CANVAS ACTUAL
============================================================ */

function getCurrentCanvas() {

    switch (
        state.selectedFilter
    ) {

        case "original":

            return state.currentOriginalCanvas;


        case "gray":

            return state.currentGrayCanvas;


        case "scan":

        default:

            return state.currentScanCanvas;
    }
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


    const image =
        canvas.toDataURL(

            "image/jpeg",

            CONFIG.JPEG_QUALITY
        );


    state.pages.push({

        id:

            Date.now()

            +

            Math.random(),

        image: image,

        width: canvas.width,

        height: canvas.height,

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
   VOLVER A TOMAR DOCUMENTO
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


    resetStability();
}


/* ============================================================
   LIMPIAR DOCUMENTO ACTUAL
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
   AGREGAR NUEVA PÁGINA
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


    resetStability();
}


/* ============================================================
   MOSTRAR GALERÍA
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


/* ============================================================
   MOSTRAR CÁMARA
============================================================ */

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


    resetStability();
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
                document.createElement("div");


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
                    title="Eliminar página"
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


            const deleteButton =
                card.querySelector(
                    ".delete-page"
                );


            deleteButton.addEventListener(

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

   IMPORTANTE:

   EL PDF LLENA LA HOJA.

   PERO LA IMAGEN YA VIENE RECORTADA
   AL DOCUMENTO.

   NO SE UTILIZA NUNCA LA CÁMARA COMPLETA.
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
            Determinar orientación.
            */

            const orientation =

                image.width >
                image.height

                    ? "landscape"

                    : "portrait";


            /*
            Crear PDF.
            */

            if (i === 0) {

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


            /*
            Tamaño actual de la hoja PDF.
            */

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
                (margin * 2);


            const availableHeight =
                pageHeight -
                (margin * 2);


            /*
            ====================================================
            AJUSTAR LA IMAGEN A LA HOJA

            Usamos "CONTAIN", no "COVER".

            Esto significa:

            ✓ La imagen ocupa el máximo espacio posible.
            ✓ Mantiene la proporción.
            ✓ No se recorta nuevamente.
            ✓ No aparece el fondo de la cámara.
            ====================================================
            */

            const imageRatio =
                image.width /
                image.height;


            const availableRatio =
                availableWidth /
                availableHeight;


            let drawWidth;
            let drawHeight;


            if (
                imageRatio >
                availableRatio
            ) {

                /*
                La imagen es relativamente más ancha.
                */

                drawWidth =
                    availableWidth;


                drawHeight =
                    drawWidth /
                    imageRatio;

            } else {

                /*
                La imagen es relativamente más alta.
                */

                drawHeight =
                    availableHeight;


                drawWidth =
                    drawHeight *
                    imageRatio;
            }


            /*
            Centrar la imagen.
            */

            const x =
                (
                    pageWidth -
                    drawWidth
                ) / 2;


            const y =
                (
                    pageHeight -
                    drawHeight
                ) / 2;


            /*
            Agregar únicamente el documento recortado.
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


        /*
        Nombre del archivo.
        */

        const fileName =
            `documento_${formatDate(new Date())}.pdf`;


        pdf.save(
            fileName
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
                () => resolve(image);


            image.onerror =
                reject;


            image.src =
                src;
        }
    );
}


/* ============================================================
   FORMATEAR FECHA
============================================================ */

function formatDate(date) {

    const year =
        date.getFullYear();


    const month =
        String(
            date.getMonth() + 1
        ).padStart(
            2,
            "0"
        );


    const day =
        String(
            date.getDate()
        ).padStart(
            2,
            "0"
        );


    const hour =
        String(
            date.getHours()
        ).padStart(
            2,
            "0"
        );


    const minute =
        String(
            date.getMinutes()
        ).padStart(
            2,
            "0"
        );


    return `${year}-${month}-${day}_${hour}-${minute}`;
}


/* ============================================================
   FLASH DE CAPTURA
============================================================ */

function playCaptureFlash() {

    if (!captureFlash) {

        return;
    }


    captureFlash
        .classList
        .remove("active");


    void captureFlash.offsetWidth;


    captureFlash
        .classList
        .add("active");
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
            .remove("hidden");
    }
}


function hideLoading() {

    if (loadingOverlay) {

        loadingOverlay
            .classList
            .add("hidden");
    }
}


/* ============================================================
   NOTIFICACIONES
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
        .add("show");


    toastTimeout =
        setTimeout(

            () => {

                toast
                    .classList
                    .remove("show");

            },

            2500
        );
}