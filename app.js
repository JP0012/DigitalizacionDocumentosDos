"use strict";


/* ============================================================
   DOCUSCAN
   Escáner documental automático
============================================================ */


/* ============================================================
   CONFIGURACIÓN
============================================================ */

const CONFIG = {

    // Tiempo que el documento debe permanecer estable.
    STABILITY_TIME: 3000,

    // Intervalo de análisis de cámara.
    ANALYSIS_INTERVAL: 120,

    // Área mínima del documento respecto al frame.
    MIN_DOCUMENT_AREA_RATIO: 0.12,

    // Aproximación del contorno.
    APPROX_EPSILON: 0.02,

    // Cuánto puede cambiar la posición antes de considerar
    // que el documento se movió.
    POSITION_TOLERANCE: 0.025,

    // Cuánto puede cambiar el tamaño.
    SIZE_TOLERANCE: 0.035,

    // Relación aproximada permitida.
    MIN_ASPECT_RATIO: 0.55,
    MAX_ASPECT_RATIO: 2.0,

    // Resolución máxima de procesamiento.
    MAX_PROCESSING_WIDTH: 1800,

    // Calidad JPEG.
    JPEG_QUALITY: 0.92
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

    detectedDocument: null,

    previousDocument: null,

    stableSince: null,

    stabilityProgress: 0,

    autoCaptureLocked: false,

    currentRawCanvas: null,

    currentScanCanvas: null,

    currentGrayCanvas: null,

    currentOriginalCanvas: null,

    selectedFilter: "scan",

    pages: [],

    analyzing: false,

    lastAnalysisTime: 0

};


/* ============================================================
   ELEMENTOS DOM
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
   INICIO
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

                    const filter =
                        button.dataset.filter;

                    selectFilter(filter);

                }
            );

        });


    window.addEventListener(
        "beforeunload",
        stopCamera
    );
}


/* ============================================================
   OPEN CV
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
   CÁMARA
============================================================ */

async function startCamera() {

    try {

        if (
            !navigator.mediaDevices ||
            !navigator.mediaDevices.getUserMedia
        ) {

            showToast(
                "Tu navegador no permite utilizar la cámara.",
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
            await navigator.mediaDevices
                .getUserMedia(constraints);


        video.srcObject =
            state.cameraStream;


        await video.play();


        state.cameraRunning = true;

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
            await navigator.mediaDevices
                .getUserMedia({

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

                    },

                    audio: false

                });


        video.srcObject =
            state.cameraStream;

        await video.play();

        state.cameraRunning = true;

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
            .forEach(track => track.stop());

        state.cameraStream = null;
    }

    state.cameraRunning = false;
}


/* ============================================================
   LOOP DE ANÁLISIS
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
        resultSection.classList.contains("hidden") === false ||
        gallerySection.classList.contains("hidden") === false
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


    state.analyzing = true;


    try {

        const width =
            video.videoWidth;

        const height =
            video.videoHeight;


        if (!width || !height) {

            return;
        }


        const canvas =
            document.createElement("canvas");

        const scale =
            Math.min(
                1,
                1000 / width
            );


        canvas.width =
            Math.round(width * scale);

        canvas.height =
            Math.round(height * scale);


        const ctx =
            canvas.getContext("2d", {
                willReadFrequently: true
            });


        ctx.drawImage(
            video,
            0,
            0,
            canvas.width,
            canvas.height
        );


        const frame =
            cv.imread(canvas);


        const documentCorners =
            detectDocument(frame);


        frame.delete();


        if (documentCorners) {

            state.detectedDocument =
                normalizeCorners(
                    documentCorners,
                    canvas.width,
                    canvas.height
                );


            drawDetection(
                state.detectedDocument,
                canvas.width,
                canvas.height
            );


            handleDocumentStability(
                state.detectedDocument
            );

        } else {

            state.detectedDocument =
                null;

            drawDetection(
                null,
                canvas.width,
                canvas.height
            );

            resetStability();

            updateDetectionUI(false);

        }


    } catch (error) {

        console.error(
            "Error analizando cámara:",
            error
        );

    } finally {

        state.analyzing = false;
    }
}


/* ============================================================
   DETECCIÓN DOCUMENTAL
============================================================ */

function detectDocument(src) {

    let gray = null;
    let blurred = null;
    let edges = null;
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


        cv.cvtColor(
            src,
            gray,
            cv.COLOR_RGBA2GRAY
        );


        cv.GaussianBlur(
            gray,
            blurred,
            new cv.Size(5, 5),
            0
        );


        cv.Canny(
            blurred,
            edges,
            60,
            180
        );


        const kernel =
            cv.Mat.ones(
                5,
                5,
                cv.CV_8U
            );


        cv.dilate(
            edges,
            edges,
            kernel
        );


        cv.findContours(
            edges,
            contours,
            hierarchy,
            cv.RETR_LIST,
            cv.CHAIN_APPROX_SIMPLE
        );


        let bestContour = null;
        let bestArea = 0;


        const imageArea =
            src.cols * src.rows;


        for (
            let i = 0;
            i < contours.size();
            i++
        ) {

            const contour =
                contours.get(i);


            const area =
                cv.contourArea(contour);


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
                CONFIG.APPROX_EPSILON *
                perimeter,
                true
            );


            if (
                approx.rows === 4 &&
                cv.isContourConvex(approx)
            ) {

                const points =
                    extractPoints(
                        approx
                    );


                if (
                    points &&
                    validQuadrilateral(
                        points,
                        src.cols,
                        src.rows
                    ) &&
                    area > bestArea
                ) {

                    bestArea = area;

                    if (bestContour) {
                        bestContour.delete();
                    }

                    bestContour =
                        approx.clone();

                }

            }


            approx.delete();
            contour.delete();

        }


        if (!bestContour) {

            return null;
        }


        const result =
            extractPoints(
                bestContour
            );


        bestContour.delete();

        return result;


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
        if (contours) contours.delete();
        if (hierarchy) hierarchy.delete();
    }
}


/* ============================================================
   EXTRAER PUNTOS
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

            x: mat.data32S[i * 2],

            y: mat.data32S[i * 2 + 1]

        });

    }


    return orderCorners(points);
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
            p => p.x + p.y
        );

    const differences =
        points.map(
            p => p.x - p.y
        );


    const topLeft =
        points[
            sums.indexOf(
                Math.min(...sums)
            )
        ];

    const bottomRight =
        points[
            sums.indexOf(
                Math.max(...sums)
            )
        ];

    const topRight =
        points[
            differences.indexOf(
                Math.max(...differences)
            )
        ];

    const bottomLeft =
        points[
            differences.indexOf(
                Math.min(...differences)
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
   VALIDAR CUADRILÁTERO
============================================================ */

function validQuadrilateral(
    points,
    width,
    height
) {

    if (!points) {
        return false;
    }


    const area =
        Math.abs(
            polygonArea(points)
        );


    const imageArea =
        width * height;


    if (
        area <
        imageArea *
        CONFIG.MIN_DOCUMENT_AREA_RATIO
    ) {

        return false;
    }


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
        ) / 2;


    const averageHeight =
        (
            leftHeight +
            rightHeight
        ) / 2;


    if (
        averageWidth <= 0 ||
        averageHeight <= 0
    ) {

        return false;
    }


    const ratio =
        averageWidth /
        averageHeight;


    return (
        ratio >=
        CONFIG.MIN_ASPECT_RATIO &&
        ratio <=
        CONFIG.MAX_ASPECT_RATIO
    );
}


/* ============================================================
   ÁREA POLÍGONO
============================================================ */

function polygonArea(points) {

    let area = 0;


    for (
        let i = 0;
        i < points.length;
        i++
    ) {

        const j =
            (i + 1) %
            points.length;


        area +=
            points[i].x *
            points[j].y -
            points[j].x *
            points[i].y;
    }


    return area / 2;
}


/* ============================================================
   DISTANCIA
============================================================ */

function distance(a, b) {

    return Math.sqrt(

        Math.pow(
            b.x - a.x,
            2
        ) +

        Math.pow(
            b.y - a.y,
            2
        )

    );
}


/* ============================================================
   NORMALIZAR COORDENADAS
============================================================ */

function normalizeCorners(
    corners,
    width,
    height
) {

    return corners.map(
        point => ({

            x: point.x / width,

            y: point.y / height

        })
    );
}


/* ============================================================
   COMPARAR DOCUMENTO
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


    const currentWidth =
        distance(
            current[0],
            current[1]
        );


    const previousWidth =
        distance(
            previous[0],
            previous[1]
        );


    const currentHeight =
        distance(
            current[0],
            current[3]
        );


    const previousHeight =
        distance(
            previous[0],
            previous[3]
        );


    if (
        Math.abs(
            currentWidth -
            previousWidth
        ) >
        CONFIG.SIZE_TOLERANCE
    ) {

        return false;
    }


    if (
        Math.abs(
            currentHeight -
            previousHeight
        ) >
        CONFIG.SIZE_TOLERANCE
    ) {

        return false;
    }


    return true;
}


/* ============================================================
   ESTABILIDAD
============================================================ */

function handleDocumentStability(
    corners
) {

    updateDetectionUI(true);


    if (
        state.autoCaptureLocked
    ) {

        return;
    }


    if (
        !state.previousDocument
    ) {

        state.previousDocument =
            corners;

        state.stableSince =
            performance.now();

        return;
    }


    const stable =
        documentIsStable(
            corners,
            state.previousDocument
        );


    if (!stable) {

        state.previousDocument =
            corners;

        state.stableSince =
            performance.now();

        updateStability(
            0
        );

        return;
    }


    const now =
        performance.now();


    if (!state.stableSince) {

        state.stableSince =
            now;
    }


    const elapsed =
        now -
        state.stableSince;


    const progress =
        Math.min(
            1,
            elapsed /
            CONFIG.STABILITY_TIME
        );


    updateStability(
        progress
    );


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
   ACTUALIZAR ESTABILIDAD
============================================================ */

function updateStability(
    progress
) {

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
        circumference -
        circumference * progress;


    if (
        progress > 0 &&
        progress < 1
    ) {

        stabilityIndicator
            .classList
            .remove("hidden");


        countdownNumber.textContent =
            Math.max(
                1,
                Math.ceil(
                    (
                        1 -
                        progress
                    ) * 3
                )
            );


        cameraStatus.className =
            "status-pill stable";

        cameraStatus.innerHTML =
            `<span class="status-dot"></span>
             Documento estable`;

    } else if (progress >= 1) {

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

    updateStability(0);

    cameraStatus.className =
        "status-pill waiting";

    cameraStatus.innerHTML =
        `<span class="status-dot"></span>
         Buscando documento`;
}


/* ============================================================
   UI DETECCIÓN
============================================================ */

function updateDetectionUI(
    detected
) {

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
            "Mantén la cámara quieta para capturarlo automáticamente.";

        cameraStatus.className =
            "status-pill detected";

        cameraStatus.innerHTML =
            `<span class="status-dot"></span>
             Documento detectado`;

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
            "La cámara analizará automáticamente los bordes.";

        cameraStatus.className =
            "status-pill waiting";

        cameraStatus.innerHTML =
            `<span class="status-dot"></span>
             Buscando documento`;
    }
}


/* ============================================================
   DIBUJAR DETECCIÓN
============================================================ */

function drawDetection(
    corners,
    width,
    height
) {

    const canvas =
        overlayCanvas;

    const rect =
        video.getBoundingClientRect();


    const scaleX =
        rect.width /
        width;

    const scaleY =
        rect.height /
        height;


    canvas.width =
        rect.width;

    canvas.height =
        rect.height;


    const ctx =
        canvas.getContext("2d");


    ctx.clearRect(
        0,
        0,
        canvas.width,
        canvas.height
    );


    if (!corners) {

        return;
    }


    ctx.beginPath();


    corners.forEach(
        (point, index) => {

            const x =
                point.x *
                width *
                scaleX;

            const y =
                point.y *
                height *
                scaleY;


            if (index === 0) {

                ctx.moveTo(
                    x,
                    y
                );

            } else {

                ctx.lineTo(
                    x,
                    y
                );

            }

        }
    );


    ctx.closePath();


    ctx.strokeStyle =
        "#22c55e";

    ctx.lineWidth =
        3;

    ctx.shadowColor =
        "rgba(34,197,94,.5)";

    ctx.shadowBlur =
        8;

    ctx.stroke();


    ctx.shadowBlur = 0;


    corners.forEach(
        point => {

            const x =
                point.x *
                width *
                scaleX;

            const y =
                point.y *
                height *
                scaleY;


            ctx.beginPath();

            ctx.arc(
                x,
                y,
                5,
                0,
                Math.PI * 2
            );

            ctx.fillStyle =
                "#22c55e";

            ctx.fill();

        }
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
            "Primero coloca un documento frente a la cámara.",
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

async function captureDocument(
    corners
) {

    if (
        state.processing
    ) {

        return;
    }


    state.processing =
        true;


    try {

        showLoading(
            "Capturando documento..."
        );


        playCaptureFlash();


        const sourceCanvas =
            createVideoCanvas();


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


        const scanCanvas =
            perspectiveTransform(
                sourceCanvas,
                absoluteCorners
            );


        state.currentRawCanvas =
            sourceCanvas;

        state.currentScanCanvas =
            scanCanvas;

        state.currentOriginalCanvas =
            scanCanvas;


        state.currentGrayCanvas =
            applyGrayFilter(
                scanCanvas
            );


        const enhancedCanvas =
            applyScannerFilter(
                scanCanvas
            );


        state.currentScanCanvas =
            enhancedCanvas;


        state.selectedFilter =
            "scan";


        showResult(
            enhancedCanvas
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
                width * scale
            );

        targetHeight =
            Math.round(
                height * scale
            );
    }


    const canvas =
        document.createElement("canvas");


    canvas.width =
        targetWidth;

    canvas.height =
        targetHeight;


    const ctx =
        canvas.getContext("2d", {
            willReadFrequently: true
        });


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
        orderCorners(points);


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


    let width =
        Math.max(
            topWidth,
            bottomWidth
        );

    let height =
        Math.max(
            leftHeight,
            rightHeight
        );


    if (
        width > height * 1.4
    ) {

        // Documento horizontal.
        width =
            Math.max(
                topWidth,
                bottomWidth
            );

        height =
            Math.max(
                leftHeight,
                rightHeight
            );

    }


    width =
        Math.max(
            600,
            Math.round(width)
        );


    height =
        Math.max(
            800,
            Math.round(height)
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

                width,
                0,

                width,
                height,

                0,
                height

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
        cv.INTER_LINEAR,
        cv.BORDER_CONSTANT,
        new cv.Scalar(
            255,
            255,
            255,
            255
        )
    );


    const result =
        document.createElement("canvas");


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

function applyGrayFilter(
    sourceCanvas
) {

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
        document.createElement("canvas");


    cv.imshow(
        result,
        gray
    );


    src.delete();
    gray.delete();


    return result;
}


/* ============================================================
   FILTRO ESCÁNER
============================================================ */

function applyScannerFilter(
    sourceCanvas
) {

    const src =
        cv.imread(
            sourceCanvas
        );


    const gray =
        new cv.Mat();


    const normalized =
        new cv.Mat();


    const threshold =
        new cv.Mat();


    const denoised =
        new cv.Mat();


    // Convertir a escala de grises.
    cv.cvtColor(
        src,
        gray,
        cv.COLOR_RGBA2GRAY
    );


    // Suavizado ligero para reducir ruido.
    cv.GaussianBlur(
        gray,
        denoised,
        new cv.Size(3, 3),
        0
    );


    /*
        Adaptive threshold permite que una hoja
        con iluminación no completamente uniforme
        quede mucho más blanca.
    */

    cv.adaptiveThreshold(
        denoised,
        threshold,
        255,
        cv.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv.THRESH_BINARY,
        31,
        12
    );


    /*
        Pequeña operación morfológica para
        limpiar ruido.
    */

    const kernel =
        cv.Mat.ones(
            2,
            2,
            cv.CV_8U
        );


    cv.morphologyEx(
        threshold,
        normalized,
        cv.MORPH_OPEN,
        kernel
    );


    const result =
        document.createElement("canvas");


    cv.imshow(
        result,
        normalized
    );


    src.delete();
    gray.delete();
    denoised.delete();
    threshold.delete();
    normalized.delete();
    kernel.delete();


    return result;
}


/* ============================================================
   MOSTRAR RESULTADO
============================================================ */

function showResult(
    canvas
) {

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
   SELECCIONAR FILTRO
============================================================ */

function selectFilter(
    filter
) {

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

            break;
    }


    state.currentScanCanvas =
        canvas;


    previewImage.src =
        canvas.toDataURL(
            "image/jpeg",
            CONFIG.JPEG_QUALITY
        );


    document
        .querySelectorAll(".filter-button")
        .forEach(button => {

            button.classList.toggle(
                "active",
                button.dataset.filter ===
                filter
            );

        });
}


/* ============================================================
   GUARDAR PÁGINA
============================================================ */

function saveCurrentPage() {

    if (
        !state.currentScanCanvas
    ) {

        return;
    }


    const dataUrl =
        state.currentScanCanvas
            .toDataURL(
                "image/jpeg",
                CONFIG.JPEG_QUALITY
            );


    state.pages.push({

        id:
            Date.now(),

        image:
            dataUrl,

        width:
            state.currentScanCanvas.width,

        height:
            state.currentScanCanvas.height,

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
   VOLVER A TOMAR
============================================================ */

function retakeDocument() {

    resultSection
        .classList
        .add("hidden");


    cameraSection
        .classList
        .remove("hidden");


    state.currentRawCanvas =
        null;

    state.currentScanCanvas =
        null;

    state.currentGrayCanvas =
        null;

    state.currentOriginalCanvas =
        null;


    resetStability();

    showToast(
        "Listo para volver a escanear",
        "✓"
    );
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


    resetStability();

    state.autoCaptureLocked =
        false;
}


/* ============================================================
   GALERÍA
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
                document.createElement("div");

            card.className =
                "page-card";


            card.innerHTML = `

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
                    data-id="${page.id}"
                    title="Eliminar página"
                >
                    ×
                </button>

                <div class="page-card-footer">

                    <span>
                        Documento
                    </span>

                    <span>
                        ${page.filter === "scan"
                            ? "Escáner"
                            : page.filter === "gray"
                                ? "Gris"
                                : "Original"}
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

function deletePage(
    id
) {

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
   VOLVER A CÁMARA
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


        const firstPage =
            state.pages[0];


        const firstImage =
            await loadImage(
                firstPage.image
            );


        const orientation =
            firstImage.width >
            firstImage.height
                ? "landscape"
                : "portrait";


        const pdf =
            new jsPDF({

                orientation,

                unit: "mm",

                format: "a4"

            });


        for (
            let i = 0;
            i < state.pages.length;
            i++
        ) {

            if (i > 0) {

                const image =
                    await loadImage(
                        state.pages[i].image
                    );


                const pageOrientation =
                    image.width >
                    image.height
                        ? "landscape"
                        : "portrait";


                /*
                    jsPDF permite trabajar con una
                    página estándar. Para mantener
                    consistencia utilizaremos A4.
                */

                pdf.addPage(
                    "a4",
                    pageOrientation
                );
            }


            const image =
                await loadImage(
                    state.pages[i].image
                );


            const pageWidth =
                pdf.internal.pageSize.getWidth();


            const pageHeight =
                pdf.internal.pageSize.getHeight();


            const margin =
                8;


            const maxWidth =
                pageWidth -
                margin * 2;


            const maxHeight =
                pageHeight -
                margin * 2;


            const ratio =
                Math.min(
                    maxWidth /
                    image.width,

                    maxHeight /
                    image.height
                );


            const width =
                image.width *
                ratio;


            const height =
                image.height *
                ratio;


            const x =
                (
                    pageWidth -
                    width
                ) / 2;


            const y =
                (
                    pageHeight -
                    height
                ) / 2;


            pdf.addImage(

                image,

                "JPEG",

                x,
                y,

                width,
                height,

                undefined,

                "FAST"

            );

        }


        const date =
            new Date();


        const fileName =
            `documento_${formatDate(date)}.pdf`;


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

function loadImage(
    src
) {

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
   FECHA
============================================================ */

function formatDate(
    date
) {

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
   FLASH
============================================================ */

function playCaptureFlash() {

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

function showLoading(
    message
) {

    loadingText.textContent =
        message;

    loadingOverlay
        .classList
        .remove("hidden");
}


function hideLoading() {

    loadingOverlay
        .classList
        .add("hidden");
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


    document.getElementById(
        "toastIcon"
    ).textContent =
        icon;


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