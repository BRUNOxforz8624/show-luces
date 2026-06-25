import numpy as np
import sounddevice as sd
import time

FRECUENCIA = 18000
TASA = 44100

def pulso(duracion):
    t = np.linspace(0, duracion, int(TASA * duracion), endpoint=False)
    onda = np.sin(2 * np.pi * FRECUENCIA * t)
    sd.play(onda, TASA)
    sd.wait()

print("=== SHOW DE LUCES - ESTADIO ===")
print("Enviando señales a los teléfonos...\n")

try:
    while True:
        # --- EFECTO 1: STROBE (parpadeo rápido) ---
        print("[STROBE]")
        for _ in range(3):
            pulso(0.1)
            time.sleep(0.1)

        time.sleep(0.5)

        # --- EFECTO 2: OLA (encendido prolongado) ---
        print("[OLA]")
        pulso(0.5)
        time.sleep(0.8)

        # --- EFECTO 3: DOBLE RÁFAGA ---
        print("[DOBLE]")
        pulso(0.15)
        time.sleep(0.15)
        pulso(0.15)
        time.sleep(0.6)

        # --- EFECTO 4: LATIDO ---
        print("[LATIDO]")
        pulso(0.3)
        time.sleep(0.2)
        pulso(0.3)
        time.sleep(1.0)

except KeyboardInterrupt:
    print("\nShow finalizado.")
