let audioContext = null;
let luzEncendida = false;
let linternaOk = false;
let camId = null;
let videoStream = null;
let videoTrack = null;
let videoEl = null;
const ESTADO_TXT = document.getElementById('estado');
const BTN_CONECTAR = document.getElementById('btn-conectar');

async function encenderLinterna(on) {
    if (!linternaOk) return;

    // Método 1: applyConstraints directo
    if (videoTrack && videoTrack.readyState === 'live') {
        try {
            await videoTrack.applyConstraints({ torch: on });
            return;
        } catch (_) {}
        try {
            await videoTrack.applyConstraints({ advanced: [{ torch: on }] });
            return;
        } catch (_) {}
    }

    // Método 2: reiniciar cámara con torch
    try {
        if (videoStream) videoStream.getTracks().forEach(t => t.stop());
        const c = { video: { torch: on } };
        if (camId) c.video.deviceId = { exact: camId };
        videoStream = await navigator.mediaDevices.getUserMedia(c);
        videoTrack = videoStream.getVideoTracks()[0];
        videoEl.srcObject = videoStream;
        await videoEl.play();
    } catch (_) {
        linternaOk = false;
    }
}

BTN_CONECTAR.addEventListener('click', async () => {
    BTN_CONECTAR.disabled = true;
    BTN_CONECTAR.innerText = "CONECTANDO...";
    ESTADO_TXT.innerText = "Inicializando...";

    const infoEl = document.createElement('div');
    infoEl.style.marginTop = '5px';
    infoEl.style.color = '#888';
    infoEl.style.fontSize = '14px';
    document.body.appendChild(infoEl);

    // 1. Cámara
    try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const bc = devices.find(d => d.kind === 'videoinput' && /back|environment|trasera/i.test(d.label));
        if (bc) camId = bc.deviceId;

        videoEl = document.createElement('video');
        videoEl.setAttribute('playsinline', '');
        videoEl.muted = true;
        videoEl.style.display = 'none';
        document.body.appendChild(videoEl);

        const c = { video: {} };
        if (camId) c.video.deviceId = { exact: camId };
        else c.video.facingMode = 'environment';
        videoStream = await navigator.mediaDevices.getUserMedia(c);
        videoTrack = videoStream.getVideoTracks()[0];
        videoEl.srcObject = videoStream;
        await videoEl.play();

        // Probar si la linterna funciona (método 1)
        try {
            await videoTrack.applyConstraints({ torch: true });
            await videoTrack.applyConstraints({ torch: false });
            linternaOk = true;
        } catch (_) {
            // Probar método 2
            try {
                let s = await navigator.mediaDevices.getUserMedia({ video: { deviceId: { exact: camId }, torch: true } });
                s.getTracks().forEach(t => t.stop());
                linternaOk = true;
            } catch (_2) {
                linternaOk = false;
            }
        }

        infoEl.innerText = linternaOk ? "🔦 Linterna OK" : "⚠️ Sin linterna (solo pantalla)";
    } catch (e) {
        console.warn("Error cámara:", e);
        infoEl.innerText = "⚠️ Sin cámara - solo pantalla";
    }

    // 2. Audio
    try {
        const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        if (audioContext.state === 'suspended') await audioContext.resume();

        const source = audioContext.createMediaStreamSource(audioStream);
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 2048;
        source.connect(analyser);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        const FRECUENCIA = parseInt(new URLSearchParams(location.search).get('freq')) || 18000;
        const UMBRAL = 50;
        const idx = Math.round((FRECUENCIA * analyser.fftSize) / audioContext.sampleRate);
        const inicio = Math.max(0, idx - 2);
        const fin = Math.min(dataArray.length - 1, idx + 2);

        const nivelEl = document.createElement('div');
        nivelEl.style.marginTop = '5px';
        nivelEl.style.color = '#888';
        nivelEl.style.fontSize = '14px';
        document.body.appendChild(nivelEl);

        function analizar() {
            analyser.getByteFrequencyData(dataArray);
            let maxV = 0;
            for (let i = inicio; i <= fin; i++) if (dataArray[i] > maxV) maxV = dataArray[i];
            const detectado = maxV > UMBRAL;
            nivelEl.innerText = `Nivel: ${maxV}/255`;

            if (detectado !== luzEncendida) {
                luzEncendida = detectado;
                document.body.style.backgroundColor = detectado ? "#fff" : "#111";
                document.body.style.transition = "background-color 0.05s";
                ESTADO_TXT.innerText = detectado ? "✦ SEÑAL DETECTADA ✦" : "✅ Escuchando...";

                if (linternaOk) {
                    // No esperar, lanzar en segundo plano
                    encenderLinterna(detectado);
                }
            }
            requestAnimationFrame(analizar);
        }

        ESTADO_TXT.innerText = "✅ Escuchando...";
        analizar();
    } catch (e) {
        ESTADO_TXT.innerText = "❌ Error al acceder al micrófono.";
        console.error(e);
    }
});