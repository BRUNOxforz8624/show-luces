import numpy as np
import sounddevice as sd
import http.server
import socketserver
import threading
import socket
import webbrowser
import os
import sys
import time
import qrcode
import base64
from io import BytesIO

PORT = 8080
FRECUENCIA = 18000
TASA = 44100
MODO_TEST = False
DIR = os.path.dirname(os.path.abspath(__file__))
QR_FILE = os.path.join(DIR, "_qr_show.html")

def get_local_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("8.8.8.8", 80))
        return s.getsockname()[0]
    except:
        return "127.0.0.1"
    finally:
        s.close()

def generar_qr_html(url):
    qr = qrcode.QRCode(box_size=10, border=4)
    qr.add_data(url)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    buf = BytesIO()
    img.save(buf, format="PNG")
    b64 = base64.b64encode(buf.getvalue()).decode()
    return f"""<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><title>Show de Luces</title>
<style>
  body{{background:#111;color:#fff;font-family:Arial,sans-serif;text-align:center;padding:30px}}
  img{{width:300px;height:300px;border:4px solid #00ff66;border-radius:16px}}
  h1{{color:#00ff66}} a{{color:#00ff66}}
</style></head>
<body>
<h1>SHOW DE LUCES</h1>
<p>Escanea el c&oacute;digo QR desde tu tel&eacute;fono:</p>
<img src="data:image/png;base64,{b64}" alt="QR">
<p><a href="{url}">{url}</a></p>
<p style="color:#888">Misma red WiFi</p>
</body></html>"""

def pulso(duracion):
    t = np.linspace(0, duracion, int(TASA * duracion), endpoint=False)
    onda = np.sin(2 * np.pi * FRECUENCIA * t)
    sd.play(onda, TASA)
    sd.wait()

def start_server(httpd):
    print(f"Servidor local: http://{IP}:{PORT}")
    httpd.serve_forever()

# Leer argumentos
qr_url = None
i = 1
while i < len(sys.argv):
    if sys.argv[i] == "--qr-url" and i + 1 < len(sys.argv):
        qr_url = sys.argv[i + 1]
        i += 1
    elif sys.argv[i] == "--freq" and i + 1 < len(sys.argv):
        FRECUENCIA = int(sys.argv[i + 1])
        i += 1
    elif sys.argv[i] == "--test":
        MODO_TEST = True
    i += 1

IP = get_local_ip()

if qr_url:
    URL = qr_url
    print(f"QR con URL personalizada: {URL}")
else:
    URL = f"http://{IP}:{PORT}"
    os.chdir(DIR)
    handler = http.server.SimpleHTTPRequestHandler
    httpd = socketserver.TCPServer(("", PORT), handler)
    threading.Thread(target=start_server, args=(httpd,), daemon=True).start()
    time.sleep(0.5)

if not MODO_TEST:
    qr_html = generar_qr_html(URL)
    with open(QR_FILE, "w", encoding="utf-8") as f:
        f.write(qr_html)
    webbrowser.open(f"file://{QR_FILE}")

print("=== SHOW DE LUCES - ESTADIO ===")
print(f"Frecuencia: {FRECUENCIA} Hz")

if MODO_TEST:
    print("MODO TEST: Sonido continuo por 5 segundos.")
    print("En tu telefono deberias ver 'SEÑAL DETECTADA'.\n")
    time.sleep(1)
    pulso(5.0)
    print("\nTest completado.")
    sys.exit(0)

if qr_url:
    print(f"QR generado con: {qr_url}")
else:
    print(f"Abrí una pagina con el QR. Escanealo con tu telefono para unirte.")
print("Presiona Ctrl+C para detener todo.\n")
time.sleep(2)

try:
    while True:
        print("[STROBE]")
        for _ in range(3):
            pulso(0.1)
            time.sleep(0.1)
        time.sleep(0.5)

        print("[OLA]")
        pulso(0.5)
        time.sleep(0.8)

        print("[DOBLE]")
        pulso(0.15)
        time.sleep(0.15)
        pulso(0.15)
        time.sleep(0.6)

        print("[LATIDO]")
        pulso(0.3)
        time.sleep(0.2)
        pulso(0.3)
        time.sleep(1.0)
except KeyboardInterrupt:
    print("\nDeteniendo...")
finally:
    if not qr_url and 'httpd' in locals():
        httpd.shutdown()
    if os.path.exists(QR_FILE):
        os.remove(QR_FILE)
    print("Show finalizado.")
