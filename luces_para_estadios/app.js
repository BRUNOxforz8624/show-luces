let track = null;
let audioContext = null;
let luzEncendida = false;
let linternaFunciona = false;
const ESTADO_TXT = document.getElementById('estado');
const BTN_CONECTAR = document.getElementById('btn-conectar');

async function intentarLinterna(encendido) {
    if (!track) return false;
    for (const modo of [{ advanced: [{ torch: encendido }] }, { torch: encendido }]) {
        try {
            await track.applyConstraints(modo);
            return true;
        } catch (_) {}
    }
    return false;
}

BTN_CONECTAR.addEventListener('click', async () => {
    BTN_CONECTAR.disabled = true;
    BTN_CONECTAR.innerText = "CONECTANDO...";
    ESTADO_TXT.innerText = "Inicializando cámara...";

    const linternaEl = document.createElement('div');
    linternaEl.style.marginTop = '5px';
    linternaEl.style.color = '#888';
    linternaEl.style.fontSize = '14px';
    document.body.appendChild(linternaEl);

    // 1. Cámara trasera y linterna
    try {
        const videoStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: "environment" } }
        });
        track = videoStream.getVideoTracks()[0];
        linternaFunciona = await intentarLinterna(true);
        await intentarLinterna(false);
        linternaEl.innerText = linternaFunciona ? "🔦 Linterna OK" : "⚠️ Sin linterna (solo pantalla)";
    } catch (e) {
        console.warn("Sin cámara trasera. Solo efecto pantalla.");
        linternaEl.innerText = "⚠️ Sin cámara trasera - solo pantalla";
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

        const indice = Math.round((FRECUENCIA * analyser.fftSize) / audioContext.sampleRate);
        const inicio = Math.max(0, indice - 2);
        const fin = Math.min(dataArray.length - 1, indice + 2);

        const nivelEl = document.createElement('div');
        nivelEl.style.marginTop = '5px';
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
            nivelEl.innerText = `Nivel: ${maxV}/255`;

            if (detectado !== luzEncendida) {
                luzEncendida = detectado;

                document.body.style.backgroundColor = detectado ? "#fff" : "#111";
                document.body.style.transition = "background-color 0.05s";

                if (track && linternaFunciona) {
                    intentarLinterna(detectado);
                }

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
