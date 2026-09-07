import requests, urllib3
urllib3.disable_warnings()
s = requests.Session()
h = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36",
    "Referer": "https://live.corp8.cloud/",
    "Origin": "https://live.corp8.cloud"
}
s.headers.update(h)
p = s.get("https://live.corp8.cloud/camera/1", timeout=6, verify=False)
print("Camera page:", p.status_code, "cookies:", list(s.cookies.keys()))
r = s.get("https://live.corp8.cloud/live/stream/1/video1_stream.m3u8", timeout=6, verify=False)
print("Sub-manifest:", r.status_code)
print(r.text[:400])
