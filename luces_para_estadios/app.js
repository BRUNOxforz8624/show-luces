let audioContext = null;
let luzEncendida = false;
let linternaLista = false;
let videoStream = null;
let videoEl = null;
const ESTADO_TXT = document.getElementById('estado');
const BTN_CONECTAR = document.getElementById('btn-conectar');

async function iniciarCamara(conLinterna) {
    if (videoStream) {
        videoStream.getTracks().forEach(t => t.stop());
    }
    try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const backCam = devices.find(d => d.kind === 'videoinput' && /back|environment|trasera/i.test(d.label));
        const constraints = { video: { torch: conLinterna } };
        if (backCam) {
            constraints.video.deviceId = { exact: backCam.deviceId };
        } else {
            constraints.video.facingMode = 'environment';
        }
        videoStream = await navigator.mediaDevices.getUserMedia(constraints);
        if (!videoEl) {
            videoEl = document.createElement('video');
            videoEl.setAttribute('playsinline', '');
            videoEl.muted = true;
            videoEl.style.display = 'none';
            document.body.appendChild(videoEl);
        }
        videoEl.srcObject = videoStream;
        await videoEl.play();
        return true;
    } catch (_) {
        return false;
    }
}

BTN_CONECTAR.addEventListener('click', async () => {
    BTN_CONECTAR.disabled = true;
    BTN_CONECTAR.innerText = "CONECTANDO...";
    ESTADO_TXT.innerText = "Inicializando...";

    const linternaEl = document.createElement('div');
    linternaEl.style.marginTop = '5px';
    linternaEl.style.color = '#888';
    linternaEl.style.fontSize = '14px';
    document.body.appendChild(linternaEl);

    // 1. Iniciar cámara y probar linterna
    try {
        const ok = await iniciarCamara(true);
        linternaLista = ok;
        if (linternaLista) {
            await iniciarCamara(false); // apagar linterna
        }
        linternaEl.innerText = linternaLista ? "🔦 Linterna OK" : "⚠️ Sin linterna (solo pantalla)";
    } catch (e) {
        console.warn("Sin cámara.", e);
        linternaEl.innerText = "⚠️ Sin cámara - solo pantalla";
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

                if (linternaLista) {
                    iniciarCamara(detectado);
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
