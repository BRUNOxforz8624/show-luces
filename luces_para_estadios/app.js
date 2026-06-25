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

        const FRECUENCIA = parseInt(new URLSearchParams(location.search).get('freq')) || 18000;
        const UMBRAL = 50;

        // Buscar en un rango de bins alrededor de la frecuencia
        const indice = Math.round((FRECUENCIA * analyser.fftSize) / audioContext.sampleRate);
        const inicio = Math.max(0, indice - 2);
        const fin = Math.min(dataArray.length - 1, indice + 2);

        const nivelEl = document.createElement('div');
        nivelEl.style.marginTop = '10px';
        nivelEl.style.color = '#888';
        nivelEl.style.fontSize = '14px';
        document.body.appendChild(nivelEl);

        let frameId;
        function analizar() {
            analyser.getByteFrequencyData(dataArray);

            let maxV = 0;
            for (let i = inicio; i <= fin; i++) {
                if (dataArray[i] > maxV) maxV = dataArray[i];
            }

            const detectado = maxV > UMBRAL;
            nivelEl.innerText = `Nivel: ${maxV}/255 (umbral ${UMBRAL})`;

            if (detectado !== luzEncendida) {
                luzEncendida = detectado;
                aplicarLuz(detectado);
                ESTADO_TXT.innerText = detectado
                    ? "✦ SEÑAL DETECTADA ✦"
                    : "✅ Escuchando...";
            }

            frameId = requestAnimationFrame(analizar);
        }

        ESTADO_TXT.innerText = "✅ Escuchando...";
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
