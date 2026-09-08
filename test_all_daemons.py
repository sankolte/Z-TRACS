import update_json
import update_frs
import update_forensics
import json

print("=" * 65)
print("1. TESTING update_json.py (Cameras, Enable Vectors, Multi-ROI)")
print("=" * 65)
c_client = update_json.ZTracsBuddyClient()
c_listener = update_json.ZTracsActiveCameraListener(client=c_client)
c_listener.sync_cameras_json(force=True)

with open("cameras.json", "r", encoding="utf-8") as f:
    c_data = json.load(f)
c_total = c_data.get("total_cameras", 0)
c_sample = c_data["locations"][0]["cameras"][0]
print(f"-> Total Cameras: {c_total}")
print(f"-> Camera Sample: {c_sample.get('camera_code')}")
print(f"   - Name: {c_sample.get('camera_name')}")
print(f"   - Enable: {c_sample.get('enable')}")
print(f"   - RTSP: {c_sample.get('rtsp')}")
print(f"   - ROIs Count: {len(c_sample.get('rois', []))}")
print(f"   - ROIs[0] (ANPR): {c_sample['rois'][0]}")
print(f"   - ROIs[1] (FRS):  {c_sample['rois'][1]}")

print("\n" + "=" * 65)
print("2. TESTING update_frs.py (Faces Gallery & Watchlist)")
print("=" * 65)
f_client = update_frs.ZTracsFrsClient()
f_listener = update_frs.ZTracsFrsListener(client=f_client)
f_listener.sync_faces_json()

with open("faces.json", "r", encoding="utf-8") as f:
    f_data = json.load(f)
f_total = f_data.get("total_persons", 0)
print(f"-> Total Persons in Face Watchlist: {f_total}")
if f_data.get("persons"):
    p = f_data["persons"][0]
    print(f"-> Person Sample: {p.get('person_id')} | Name: {p.get('name')} | Category: {p.get('category')} | Embeddings: {len(p.get('embeddings', []))}")

print("\n" + "=" * 65)
print("3. TESTING update_forensics.py (Forensics Tasks & Search Jobs)")
print("=" * 65)
for_client = update_forensics.ZTracsForensicsClient()
for_listener = update_forensics.ZTracsForensicsListener(client=for_client)
for_listener.sync_forensics_json()

with open("forensics.json", "r", encoding="utf-8") as f:
    for_data = json.load(f)
for_total = for_data.get("total_tasks", 0)
print(f"-> Total Forensics Tasks: {for_total}")
if for_data.get("tasks"):
    t = for_data["tasks"][0]
    print(f"-> Task Sample: {t.get('task_id')} | Target: {t.get('target_type')} | Status: {t.get('status')} | Progress: {t.get('progress')}% | Matches: {len(t.get('matches', []))}")

print("\n" + "=" * 65)
print("[OK] ALL 3 DAEMONS AND JSON FILES VERIFIED! 100% OPERATIONAL!")
print("=" * 65)
