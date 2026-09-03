"use strict";

/* ============================================================
   DOCUSCAN - APP.JS COMPLETO
============================================================ */


/* ============================================================
   CONFIGURACIÓN
============================================================ */

const CONFIG = {

    // Tiempo que el documento debe permanecer quieto
    // antes de realizar la captura automática.
    STABILITY_TIME: 3000,

    // Cada cuánto se analiza la cámara.
    ANALYSIS_INTERVAL: 120,

    // Área mínima que debe ocupar el documento.
    MIN_DOCUMENT_AREA_RATIO: 0.10,

    // Tolerancia para aproximar los bordes.
    APPROX_EPSILON: 0.025,

    // Movimiento máximo permitido entre análisis.
    POSITION_TOLERANCE: 0.025,

    // Cambio máximo permitido en tamaño.
    SIZE_TOLERANCE: 0.035,

    // Resolución máxima utilizada para procesamiento.
    MAX_PROCESSING_WIDTH: 1800,

    // Calidad JPEG.
    JPEG_QUALITY: 0.95
};


/* ============================================================
   ESTADO DE LA APLICACIÓN
============================================================ */

const state = {

    cameraStream: null,

    cameras: [],

    currentCameraIndex: 0,

    cameraRunning: false,

    opencvReady: false,

    processing: false,

    analyzing: false,

    detectedDocument: null,

    previousDocument: null,

    stableSince: null,

    stabilityProgress: 0,

    autoCaptureLocked: false,

    lastAnalysisTime: 0,

    currentRawCanvas: null,

    currentOriginalCanvas: null,

    currentGrayCanvas: null,

    currentScanCanvas: null,

    selectedFilter: "scan",

    pages: []
};


/* ============================================================
   ELEMENTOS DEL DOM
============================================================ */

const video = document.getElementById("video");

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

    btnCapture.addEventListener(
        "click",
        manualCapture
    );


    btnCameraSwitch.addEventListener(
        "click",
        switchCamera
    );


    btnGallery.addEventListener(
        "click",
        showGallery
    );


    btnGalleryBottom.addEventListener(
        "click",
        showGallery
    );


    btnCloseGallery.addEventListener(
        "click",
        showCamera
    );


    btnCloseResult.addEventListener(
        "click",
        showCamera
    );


    btnRetake.addEventListener(
        "click",
        retakeDocument
    );


    btnAddPage.addEventListener(
        "click",
        addAnotherPage
    );


    btnSavePage.addEventListener(
        "click",
        saveCurrentPage
    );


    btnGeneratePDF.addEventListener(
        "click",
        generatePDF
    );


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

            } else {

                setTimeout(
                    check,
                    100
                );

            }

        };

        check();

    });
}


/* ============================================================
   INICIAR CÁMARA
============================================================ */

async function startCamera() {

    try {

        if (
            !navigator.mediaDevices ||
            !navigator.mediaDevices.getUserMedia
        ) {

            showToast(
                "Tu navegador no permite usar la cámara.",
                "!"
            );

            return;
        }


        stopCamera();


        const constraints = {

            audio: false,

            video: {

                width: {
                    ideal: 1920
                },

                height: {
                    ideal: 1080
                },

                facingMode: {
                    ideal: "environment"
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
            await navigator.mediaDevices
                .enumerateDevices();


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
            await navigator.mediaDevices
                .getUserMedia({

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

    if (state.cameraStream) {

        state.cameraStream
            .getTracks()
            .forEach(track => {

                track.stop();

            });


        state.cameraStream =
            null;

    }


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

        state.processing ||

        !resultSection.classList.contains("hidden") ||

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

        !state.opencvReady ||

        video.readyState <
        HTMLMediaElement.HAVE_CURRENT_DATA

    ) {

        return;

    }


    if (state.analyzing) {

        return;

    }


    state.analyzing =
        true;


    try {

        const width =
            video.videoWidth;

        const height =
            video.videoHeight;


        if (

            !width ||

            !height

        ) {

            return;

        }


        /*
        Reducimos la resolución únicamente
        para detectar más rápido.
        */

        const canvas =
            document.createElement(
                "canvas"
            );


        const maxWidth =
            1000;


        const scale =
            Math.min(
                1,
                maxWidth / width
            );


        canvas.width =
            Math.round(
                width * scale
            );


        canvas.height =
            Math.round(
                height * scale
            );


        const ctx =
            canvas.getContext(
                "2d",
                {
                    willReadFrequently: true
                }
            );


        ctx.drawImage(

            video,

            0,

            0,

            canvas.width,

            canvas.height

        );


        const frame =
            cv.imread(
                canvas
            );


        const documentCorners =
            detectDocument(
                frame
            );


        frame.delete();


        if (documentCorners) {

            state.detectedDocument =
                normalizeCorners(

                    documentCorners,

                    canvas.width,

                    canvas.height

                );


            drawDetection(
                state.detectedDocument
            );


            handleDocumentStability(
                state.detectedDocument
            );


        } else {

            state.detectedDocument =
                null;


            clearDetection();


            resetStability();


            updateDetectionUI(
                false
            );

        }


    } catch (error) {

        console.error(
            "Error analizando cámara:",
            error
        );

    } finally {

        state.analyzing =
            false;

    }
}


/* ============================================================
   DETECCIÓN MEJORADA DEL DOCUMENTO
============================================================ */

function detectDocument(src) {

    let gray = null;
    let blurred = null;
    let edges = null;
    let threshold = null;
    let combined = null;
    let contours = null;
    let hierarchy = null;
    let kernel = null;

    try {

        gray =
            new cv.Mat();

        blurred =
            new cv.Mat();

        edges =
            new cv.Mat();

        threshold =
            new cv.Mat();

        combined =
            new cv.Mat();

        contours =
            new cv.MatVector();

        hierarchy =
            new cv.Mat();


        /*
        ESCALA DE GRISES
        */

        cv.cvtColor(

            src,

            gray,

            cv.COLOR_RGBA2GRAY

        );


        /*
        FILTRO BILATERAL

        Reduce ruido manteniendo bordes.
        */

        cv.bilateralFilter(

            gray,

            blurred,

            7,

            75,

            75

        );


        /*
        DETECTAR BORDES
        */

        cv.Canny(

            blurred,

            edges,

            40,

            140

        );


        /*
        DETECTAR DIFERENCIAS DE ILUMINACIÓN
        */

        cv.adaptiveThreshold(

            blurred,

            threshold,

            255,

            cv.ADAPTIVE_THRESH_GAUSSIAN_C,

            cv.THRESH_BINARY,

            31,

            8

        );


        /*
        COMBINAR LOS DOS MÉTODOS
        */

        cv.bitwise_or(

            edges,

            threshold,

            combined

        );


        /*
        CONECTAR BORDES INTERRUMPIDOS
        */

        kernel =
            cv.getStructuringElement(

                cv.MORPH_RECT,

                new cv.Size(
                    5,
                    5
                )

            );


        cv.morphologyEx(

            combined,

            combined,

            cv.MORPH_CLOSE,

            kernel

        );


        cv.dilate(

            combined,

            combined,

            kernel

        );


        /*
        BUSCAR CONTORNOS
        */

        cv.findContours(

            combined,

            contours,

            hierarchy,

            cv.RETR_LIST,

            cv.CHAIN_APPROX_SIMPLE

        );


        const imageArea =
            src.cols *
            src.rows;


        let bestPoints =
            null;


        let bestScore =
            0;


        /*
        ANALIZAR TODOS LOS CONTORNOS
        */

        for (

            let i = 0;

            i < contours.size();

            i++

        ) {

            const contour =
                contours.get(i);


            const area =
                cv.contourArea(
                    contour
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


            /*
            Aproximar el contorno.
            */

            cv.approxPolyDP(

                contour,

                approx,

                perimeter *
                CONFIG.APPROX_EPSILON,

                true

            );


            /*
            Necesitamos 4 esquinas.
            */

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


                if (points) {

                    const ordered =
                        orderCorners(
                            points
                        );


                    const quadArea =
                        Math.abs(

                            polygonArea(
                                ordered
                            )

                        );


                    if (

                        quadArea >

                        imageArea *
                        CONFIG.MIN_DOCUMENT_AREA_RATIO

                    ) {

                        const score =
                            calculateDocumentScore(

                                ordered,

                                quadArea,

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


                            bestPoints =
                                ordered;

                        }

                    }

                }

            }


            approx.delete();

            contour.delete();

        }


        return bestPoints;


    } catch (error) {

        console.error(
            "Error detectando documento:",
            error
        );


        return null;


    } finally {

        if (gray) gray.delete();

        if (blurred) blurred.delete();

        if (edges) edges.delete();

        if (threshold) threshold.delete();

        if (combined) combined.delete();

        if (contours) contours.delete();

        if (hierarchy) hierarchy.delete();

        if (kernel) kernel.delete();

    }
}


/* ============================================================
   CALCULAR PUNTUACIÓN DEL DOCUMENTO
============================================================ */

function calculateDocumentScore(

    points,

    area,

    imageArea,

    imageWidth,

    imageHeight

) {

    /*
    Tamaño respecto a la imagen.
    */

    const areaRatio =
        area /
        imageArea;


    /*
    Dimensiones.
    */

    const topWidth =
        distance(
            points[0],
            points[1]
        );


    const bottomWidth =
        distance(
            points[3],
            points[2]
        );


    const leftHeight =
        distance(
            points[0],
            points[3]
        );


    const rightHeight =
        distance(
            points[1],
            points[2]
        );


    const averageWidth =

        (
            topWidth +
            bottomWidth
        )

        / 2;


    const averageHeight =

        (
            leftHeight +
            rightHeight
        )

        / 2;


    if (

        averageWidth <= 0 ||

        averageHeight <= 0

    ) {

        return 0;

    }


    /*
    Proporción del documento.
    */

    let ratio =
        averageWidth /
        averageHeight;


    if (ratio < 1) {

        ratio =
            1 / ratio;

    }


    /*
    Carta ≈ 1.294
    A4 ≈ 1.414

    Utilizamos un valor intermedio.
    */

    const expectedRatio =
        1.35;


    const ratioDifference =
        Math.abs(

            ratio -

            expectedRatio

        );


    /*
    Puntuación por tamaño.
    */

    const sizeScore =

        Math.min(

            areaRatio /
            0.75,

            1

        );


    /*
    Puntuación por proporción.
    */

    const ratioScore =

        Math.max(

            0,

            1 -

            ratioDifference /
            0.8

        );


    /*
    Centro del documento.
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


    const maxDistance =

        Math.sqrt(

            imageCenterX *
            imageCenterX

            +

            imageCenterY *
            imageCenterY

        );


    const centerScore =

        1 -

        Math.min(

            centerDistance /
            maxDistance,

            1

        );


    /*
    PUNTUACIÓN FINAL
    */

    return (

        sizeScore *
        0.55

    )

    +

    (

        ratioScore *
        0.30

    )

    +

    (

        centerScore *
        0.15

    );
}


/* ============================================================
   EXTRAER LOS PUNTOS DEL CONTORNO
============================================================ */

function extractPoints(mat) {

    if (

        !mat ||

        mat.rows !== 4

    ) {

        return null;

    }


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


    return orderCorners(
        points
    );
}


/* ============================================================
   ORDENAR ESQUINAS
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


    return [

        topLeft,

        topRight,

        bottomRight,

        bottomLeft

    ];
}


/* ============================================================
   ÁREA DEL POLÍGONO
============================================================ */

function polygonArea(points) {

    let area =
        0;


    for (

        let i = 0;

        i < points.length;

        i++

    ) {

        const j =

            (

                i + 1

            )

            %

            points.length;


        area +=

            points[i].x *
            points[j].y

            -

            points[j].x *
            points[i].y;

    }


    return area / 2;
}


/* ============================================================
   DISTANCIA ENTRE DOS PUNTOS
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


/* ============================================================
   NORMALIZAR PUNTOS
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
   COMPARAR ESTABILIDAD
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
   CONTROLAR ESTABILIDAD
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


        updateStability(
            0
        );


        return;

    }


    /*
    Comparar posición actual con anterior.
    */

    const stable =

        documentIsStable(

            corners,

            state.previousDocument

        );


    /*
    Si se movió, reiniciar.
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
    IMPORTANTE:

    El contador empieza únicamente
    cuando ya detectamos que el documento
    permanece estable.
    */

    if (

        state.stableSince === null

    ) {

        state.stableSince =
            performance.now();

    }


    const elapsed =

        performance.now()

        -

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
    Después de 3 segundos.
    */

    if (

        progress >= 1

    ) {

        state.autoCaptureLocked =
            true;


        captureDocument(
            corners
        );

    }


    state.previousDocument =
        corners;
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


    stabilityBar.style.width =

        `${percentage}%`;


    stabilityPercent.textContent =

        `${percentage}%`;


    const circumference =
        276.46;


    progressCircle.style.strokeDashoffset =

        circumference

        -

        circumference *
        progress;


    if (

        progress > 0 &&

        progress < 1

    ) {

        stabilityIndicator
            .classList
            .remove("hidden");


        const remainingSeconds =

            Math.max(

                1,

                Math.ceil(

                    (

                        CONFIG.STABILITY_TIME

                        -

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


        cameraStatus.className =

            "status-pill stable";


        cameraStatus.innerHTML =

            `
            <span class="status-dot"></span>
            Documento estable
            `;


    } else if (

        progress >= 1

    ) {

        countdownNumber.textContent =
            "✓";


    } else {

        stabilityIndicator
            .classList
            .add("hidden");

    }
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


    updateStability(
        0
    );


    cameraStatus.className =
        "status-pill waiting";


    cameraStatus.innerHTML =

        `
        <span class="status-dot"></span>
        Buscando documento
        `;
}


/* ============================================================
   INTERFAZ DE DETECCIÓN
============================================================ */

function updateDetectionUI(detected) {

    if (detected) {

        scannerFrame
            .classList
            .add("detected");


        cameraMessage
            .classList
            .add("hidden");


        detectionIcon.textContent =
            "✓";


        detectionTitle.textContent =
            "Documento detectado";


        detectionDescription.textContent =
            "Mantén la cámara quieta durante 3 segundos.";


        if (

            state.stabilityProgress === 0

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

        scannerFrame
            .classList
            .remove("detected");


        cameraMessage
            .classList
            .remove("hidden");


        detectionIcon.textContent =
            "○";


        detectionTitle.textContent =
            "Esperando documento";


        detectionDescription.textContent =
            "Coloca la hoja dentro del área visible.";


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
   DIBUJAR LÍNEAS VERDES
============================================================ */

function drawDetection(corners) {

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


    const ctx =
        overlayCanvas.getContext(
            "2d"
        );


    ctx.clearRect(

        0,

        0,

        overlayCanvas.width,

        overlayCanvas.height

    );


    if (!corners) {

        return;

    }


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
    Línea verde.
    */

    ctx.beginPath();


    ctx.moveTo(

        points[0].x,

        points[0].y

    );


    for (

        let i = 1;

        i < points.length;

        i++

    ) {

        ctx.lineTo(

            points[i].x,

            points[i].y

        );

    }


    ctx.closePath();


    ctx.strokeStyle =
        "#22c55e";


    ctx.lineWidth =
        4;


    ctx.shadowColor =
        "rgba(34,197,94,.8)";


    ctx.shadowBlur =
        10;


    ctx.stroke();


    ctx.shadowBlur =
        0;


    /*
    Dibujar puntos.
    */

    points.forEach(point => {

        ctx.beginPath();


        ctx.arc(

            point.x,

            point.y,

            6,

            0,

            Math.PI * 2

        );


        ctx.fillStyle =
            "#22c55e";


        ctx.fill();

    });

}


/* ============================================================
   LIMPIAR DETECCIÓN
============================================================ */

function clearDetection() {

    const ctx =
        overlayCanvas.getContext(
            "2d"
        );


    ctx.clearRect(

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

            "No se detectó correctamente el documento.",

            "!"

        );

        return;

    }


    state.autoCaptureLocked =
        true;


    captureDocument(
        state.detectedDocument
    );
}


/* ============================================================
   CAPTURAR DOCUMENTO
============================================================ */

async function captureDocument(corners) {

    if (

        state.processing

    ) {

        return;

    }


    state.processing =
        true;


    try {

        showLoading(
            "Procesando documento..."
        );


        playCaptureFlash();


        /*
        Capturar video completo.
        */

        const sourceCanvas =
            createVideoCanvas();


        /*
        Convertir esquinas normalizadas
        a coordenadas reales.
        */

        const absoluteCorners =

            corners.map(

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
        Corregir perspectiva.
        */

        const correctedCanvas =
            perspectiveTransform(

                sourceCanvas,

                absoluteCorners

            );


        /*
        Guardar original corregido.
        */

        state.currentRawCanvas =
            sourceCanvas;


        state.currentOriginalCanvas =
            correctedCanvas;


        /*
        Crear versión gris.
        */

        state.currentGrayCanvas =
            applyGrayFilter(

                correctedCanvas

            );


        /*
        Crear versión escáner.
        */

        state.currentScanCanvas =
            applyScannerFilter(

                correctedCanvas

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

            "No se pudo procesar el documento.",

            "!"

        );


        resetStability();


    } finally {

        state.processing =
            false;

    }
}


/* ============================================================
   CREAR CANVAS DEL VIDEO
============================================================ */

function createVideoCanvas() {

    const width =
        video.videoWidth;


    const height =
        video.videoHeight;


    let targetWidth =
        width;


    let targetHeight =
        height;


    if (

        width >

        CONFIG.MAX_PROCESSING_WIDTH

    ) {

        const scale =

            CONFIG.MAX_PROCESSING_WIDTH /

            width;


        targetWidth =

            Math.round(

                width *
                scale

            );


        targetHeight =

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
        targetWidth;


    canvas.height =
        targetHeight;


    const ctx =
        canvas.getContext(

            "2d",

            {

                willReadFrequently: true

            }

        );


    ctx.drawImage(

        video,

        0,

        0,

        targetWidth,

        targetHeight

    );


    return canvas;
}


/* ============================================================
   CORRECCIÓN DE PERSPECTIVA
============================================================ */

function perspectiveTransform(

    sourceCanvas,

    points

) {

    const ordered =
        orderCorners(
            points
        );


    /*
    Calcular ancho.
    */

    const topWidth =
        distance(

            ordered[0],

            ordered[1]

        );


    const bottomWidth =
        distance(

            ordered[3],

            ordered[2]

        );


    const documentWidth =
        Math.max(

            topWidth,

            bottomWidth

        );


    /*
    Calcular alto.
    */

    const leftHeight =
        distance(

            ordered[0],

            ordered[3]

        );


    const rightHeight =
        distance(

            ordered[1],

            ordered[2]

        );


    const documentHeight =
        Math.max(

            leftHeight,

            rightHeight

        );


    /*
    Tamaño final basado exactamente
    en el documento detectado.
    */

    let width =
        Math.round(
            documentWidth
        );


    let height =
        Math.round(
            documentHeight
        );


    width =
        Math.max(
            width,
            300
        );


    height =
        Math.max(
            height,
            300
        );


    const src =
        cv.imread(
            sourceCanvas
        );


    const dst =
        new cv.Mat();


    const srcPoints =
        cv.matFromArray(

            4,

            1,

            cv.CV_32FC2,

            [

                ordered[0].x,

                ordered[0].y,


                ordered[1].x,

                ordered[1].y,


                ordered[2].x,

                ordered[2].y,


                ordered[3].x,

                ordered[3].y

            ]

        );


    const dstPoints =
        cv.matFromArray(

            4,

            1,

            cv.CV_32FC2,

            [

                0,

                0,


                width - 1,

                0,


                width - 1,

                height - 1,


                0,

                height - 1

            ]

        );


    const matrix =
        cv.getPerspectiveTransform(

            srcPoints,

            dstPoints

        );


    cv.warpPerspective(

        src,

        dst,

        matrix,

        new cv.Size(

            width,

            height

        ),

        cv.INTER_CUBIC,

        cv.BORDER_REPLICATE

    );


    const result =
        document.createElement(
            "canvas"
        );


    result.width =
        width;


    result.height =
        height;


    cv.imshow(

        result,

        dst

    );


    src.delete();

    dst.delete();

    srcPoints.delete();

    dstPoints.delete();

    matrix.delete();


    return result;
}


/* ============================================================
   FILTRO GRIS
============================================================ */

function applyGrayFilter(sourceCanvas) {

    const src =
        cv.imread(
            sourceCanvas
        );


    const gray =
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


    src.delete();

    gray.delete();


    return result;
}


/* ============================================================
   FILTRO TIPO ESCÁNER
============================================================ */

function applyScannerFilter(sourceCanvas) {

    const src =
        cv.imread(
            sourceCanvas
        );


    const gray =
        new cv.Mat();


    const background =
        new cv.Mat();


    const normalized =
        new cv.Mat();


    const binary =
        new cv.Mat();


    /*
    Convertir a gris.
    */

    cv.cvtColor(

        src,

        gray,

        cv.COLOR_RGBA2GRAY

    );


    /*
    Detectar iluminación del fondo.

    Esto ayuda a eliminar sombras.
    */

    cv.GaussianBlur(

        gray,

        background,

        new cv.Size(

            0,

            0

        ),

        25

    );


    /*
    Normalizar iluminación.

    Hoja más blanca.
    */

    cv.divide(

        gray,

        background,

        normalized,

        255

    );


    /*
    Mejorar contraste.
    */

    cv.normalize(

        normalized,

        normalized,

        0,

        255,

        cv.NORM_MINMAX

    );


    /*
    Crear efecto tipo escáner.
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


    src.delete();

    gray.delete();

    background.delete();

    normalized.delete();

    binary.delete();


    return result;
}


/* ============================================================
   MOSTRAR RESULTADO
============================================================ */

function showResult(canvas) {

    previewImage.src =

        canvas.toDataURL(

            "image/jpeg",

            CONFIG.JPEG_QUALITY

        );


    cameraSection
        .classList
        .add("hidden");


    gallerySection
        .classList
        .add("hidden");


    resultSection
        .classList
        .remove("hidden");


    updateFilterButtons();
}


/* ============================================================
   CAMBIAR FILTRO
============================================================ */

function selectFilter(filter) {

    if (

        !state.currentOriginalCanvas

    ) {

        return;

    }


    state.selectedFilter =
        filter;


    let canvas;


    switch (filter) {

        case "original":

            canvas =
                state.currentOriginalCanvas;

            break;


        case "gray":

            canvas =
                state.currentGrayCanvas;

            break;


        case "scan":

        default:

            canvas =
                applyScannerFilter(

                    state.currentOriginalCanvas

                );

            state.currentScanCanvas =
                canvas;

            break;

    }


    previewImage.src =

        canvas.toDataURL(

            "image/jpeg",

            CONFIG.JPEG_QUALITY

        );


    updateFilterButtons();
}


/* ============================================================
   ACTUALIZAR BOTONES DE FILTRO
============================================================ */

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
   OBTENER CANVAS DEL FILTRO ACTUAL
============================================================ */

function getCurrentCanvas() {

    switch (
        state.selectedFilter
    ) {

        case "original":

            return (
                state.currentOriginalCanvas
            );


        case "gray":

            return (
                state.currentGrayCanvas
            );


        case "scan":

        default:

            return (
                state.currentScanCanvas
            );

    }
}


/* ============================================================
   GUARDAR PÁGINA
============================================================ */

function saveCurrentPage() {

    const currentCanvas =
        getCurrentCanvas();


    if (!currentCanvas) {

        return;

    }


    const dataUrl =

        currentCanvas.toDataURL(

            "image/jpeg",

            CONFIG.JPEG_QUALITY

        );


    state.pages.push({

        id:

            Date.now()

            +

            Math.random(),


        image:
            dataUrl,


        width:
            currentCanvas.width,


        height:
            currentCanvas.height,


        filter:
            state.selectedFilter,


        created:
            new Date()

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

    resultSection
        .classList
        .add("hidden");


    cameraSection
        .classList
        .remove("hidden");


    clearCurrentDocument();


    resetStability();


    showToast(

        "Listo para volver a escanear",

        "✓"

    );
}


/* ============================================================
   LIMPIAR DOCUMENTO ACTUAL
============================================================ */

function clearCurrentDocument() {

    state.currentRawCanvas =
        null;


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
   AGREGAR OTRA PÁGINA
============================================================ */

function addAnotherPage() {

    resultSection
        .classList
        .add("hidden");


    gallerySection
        .classList
        .add("hidden");


    cameraSection
        .classList
        .remove("hidden");


    clearCurrentDocument();


    resetStability();


    state.autoCaptureLocked =
        false;
}


/* ============================================================
   MOSTRAR GALERÍA
============================================================ */

function showGallery() {

    cameraSection
        .classList
        .add("hidden");


    resultSection
        .classList
        .add("hidden");


    gallerySection
        .classList
        .remove("hidden");


    updateGallery();
}


/* ============================================================
   MOSTRAR CÁMARA
============================================================ */

function showCamera() {

    gallerySection
        .classList
        .add("hidden");


    resultSection
        .classList
        .add("hidden");


    cameraSection
        .classList
        .remove("hidden");


    resetStability();
}


/* ============================================================
   ACTUALIZAR GALERÍA
============================================================ */

function updateGallery() {

    pageCount.textContent =
        state.pages.length;


    pagesGrid.innerHTML =
        "";


    if (

        state.pages.length === 0

    ) {

        emptyGallery
            .classList
            .remove("hidden");


        pdfActions
            .classList
            .add("hidden");


        return;

    }


    emptyGallery
        .classList
        .add("hidden");


    pdfActions
        .classList
        .remove("hidden");


    summaryPages.textContent =

        state.pages.length === 1

            ? "1 página"

            : `${state.pages.length} páginas`;


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


        /*
        Crear PDF inicialmente A4 vertical.
        */

        const pdf =
            new jsPDF({

                orientation:
                    "portrait",

                unit:
                    "mm",

                format:
                    "a4",

                compress:
                    true

            });


        for (

            let i = 0;

            i < state.pages.length;

            i++

        ) {

            const image =

                await loadImage(

                    state.pages[i].image

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
            Primera página.
            */

            if (i === 0) {

                /*
                Si la primera página es horizontal,
                cambiamos la página inicial.
                */

                if (

                    orientation ===
                    "landscape"

                ) {

                    pdf.deletePage(
                        1
                    );


                    pdf.addPage(

                        "a4",

                        "landscape"

                    );

                }

            } else {

                /*
                Crear una nueva página
                respetando orientación.
                */

                pdf.addPage(

                    "a4",

                    orientation

                );

            }


            /*
            Dimensiones reales del PDF.
            */

            const pageWidth =

                pdf.internal
                    .pageSize
                    .getWidth();


            const pageHeight =

                pdf.internal
                    .pageSize
                    .getHeight();


            /*
            Margen extremadamente pequeño.

            Esto permite que el documento
            ocupe casi toda la hoja PDF.
            */

            const margin =
                2;


            const availableWidth =

                pageWidth -

                (
                    margin * 2
                );


            const availableHeight =

                pageHeight -

                (
                    margin * 2
                );


            /*
            Proporción de la imagen.
            */

            const imageRatio =

                image.width /

                image.height;


            /*
            Proporción del PDF.
            */

            const pageRatio =

                availableWidth /

                availableHeight;


            let drawWidth;
            let drawHeight;
            let x;
            let y;


            /*
            =====================================================
            AJUSTE TIPO COVER
            =====================================================

            La imagen llena la página.

            Ya no se verá pequeña.

            Si hay una pequeña diferencia de
            proporción, solamente sobresaldrá
            ligeramente y jsPDF mostrará
            únicamente el área correspondiente
            a la hoja.
            */

            if (

                imageRatio >

                pageRatio

            ) {

                /*
                Imagen más ancha.
                */

                drawHeight =
                    availableHeight;


                drawWidth =

                    image.width *

                    (

                        drawHeight /

                        image.height

                    );


                x =

                    (

                        pageWidth -

                        drawWidth

                    )

                    / 2;


                y =
                    margin;

            } else {

                /*
                Imagen más alta.
                */

                drawWidth =
                    availableWidth;


                drawHeight =

                    image.height *

                    (

                        drawWidth /

                        image.width

                    );


                x =
                    margin;


                y =

                    (

                        pageHeight -

                        drawHeight

                    )

                    / 2;

            }


            /*
            Agregar la imagen.
            */

            pdf.addImage(

                image,

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

        const date =
            new Date();


        const fileName =

            `documento_${

                formatDate(
                    date
                )

            }.pdf`;


        /*
        Guardar PDF.
        */

        pdf.save(
            fileName
        );


        hideLoading();


        showToast(

            "PDF generado correctamente",

            "✓"

        );


    } catch (error) {

        console.error(
            error
        );


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
   FORMATEAR FECHA
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


    return

        `${year}-${month}-${day}_${hour}-${minute}`;
}


/* ============================================================
   FLASH DE CAPTURA
============================================================ */

function playCaptureFlash() {

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
   MOSTRAR LOADING
============================================================ */

function showLoading(message) {

    loadingText.textContent =
        message;


    loadingOverlay
        .classList
        .remove(
            "hidden"
        );
}


/* ============================================================
   OCULTAR LOADING
============================================================ */

function hideLoading() {

    loadingOverlay
        .classList
        .add(
            "hidden"
        );
}


/* ============================================================
   TOAST
============================================================ */

let toastTimeout;


function showToast(

    message,

    icon = "✓"

) {

    clearTimeout(
        toastTimeout
    );


    toastMessage.textContent =
        message;


    document
        .getElementById(
            "toastIcon"
        )

        .textContent =
            icon;


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