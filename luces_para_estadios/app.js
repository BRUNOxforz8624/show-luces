let track = null;
let audioContext = null;
let luzEncendida = false;
let soportaTorch = false;
const ESTADO_TXT = document.getElementById('estado');
const BTN_CONECTAR = document.getElementById('btn-conectar');

BTN_CONECTAR.addEventListener('click', async () => {
    BTN_CONECTAR.disabled = true;
    BTN_CONECTAR.innerText = "CONECTANDO...";
    ESTADO_TXT.innerText = "Inicializando cámara...";

    // 1. Cámara trasera y linterna
    try {
        const videoStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { exact: "environment" } }
        });
        track = videoStream.getVideoTracks()[0];
        const caps = track.getCapabilities();
        soportaTorch = caps.torch || false;
        ESTADO_TXT.innerText = soportaTorch
            ? "Linterna lista. Escuchando..."
            : "Sin linterna (solo pantalla). Escuchando...";
    } catch (e) {
        console.warn("Sin cámara trasera. Solo efecto pantalla.");
        ESTADO_TXT.innerText = "Modo pantalla. Escuchando...";
    }

    // 2. Audio
    try {
        const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        if (audioContext.state === 'suspended') {
            await audioContext.resume();
        }

        const source = audioContext.createMediaStreamSource(audioStream);
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 2048;
        source.connect(analyser);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);

        // Frecuencia objetivo: 18,000 Hz
        const FRECUENCIA = 18000;
        const indice = Math.round((FRECUENCIA * analyser.fftSize) / audioContext.sampleRate);

        let frameId;
        function analizar() {
            analyser.getByteFrequencyData(dataArray);
            const v = dataArray[indice];
            const detectado = v > 140;

            if (detectado !== luzEncendida) {
                luzEncendida = detectado;
                aplicarLuz(detectado);
            }

            frameId = requestAnimationFrame(analizar);
        }

        ESTADO_TXT.innerText = "✅ Esperando señal ultrasónica...";
        analizar();

    } catch (e) {
        ESTADO_TXT.innerText = "❌ Error al acceder al micrófono.";
        console.error(e);
    }
});

async function aplicarLuz(encendido) {
    document.body.style.backgroundColor = encendido ? "#ffffff" : "#111";
    document.body.style.transition = "background-color 0.05s";

    if (track && soportaTorch) {
        try {
            await track.applyConstraints({
                advanced: [{ torch: encendido }]
            });
        } catch (_) { }
    }
}
