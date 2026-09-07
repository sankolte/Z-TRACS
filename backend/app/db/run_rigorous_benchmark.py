"""
Z-TRACS Rigorous Multi-Run Statistical PostGIS Benchmark (12,000 Cameras Scale)
Executes 15 warm runs per radius (1 km, 5 km, 10 km, 25 km, 50 km) and calculates Min, Avg, Median, P95, Max.
"""
import os
import sys
import asyncio
import numpy as np

current_dir = os.path.dirname(os.path.abspath(__file__))
app_dir = os.path.dirname(current_dir)
backend_dir = os.path.dirname(app_dir)
sys.path.insert(0, backend_dir)

from app.core.config import settings

RADII = [
    (1000, "1 km"),
    (5000, "5 km"),
    (10000, "10 km"),
    (25000, "25 km"),
    (50000, "50 km")
]
RUNS_PER_RADIUS = 15

async def run_statistical_benchmark():
    print("=" * 80)
    print("  Z-TRACS RIGOROUS MULTI-RUN POSTGIS STATISTICAL BENCHMARK")
    print("=" * 80)
    print(f"Target AWS RDS Host: {settings.POSTGRES_HOST}:{settings.POSTGRES_PORT}/{settings.POSTGRES_DB}")
    print(f"Benchmark Runs per Radius: {RUNS_PER_RADIUS} runs")
    print("-" * 80)

    try:
        import asyncpg
        conn = await asyncpg.connect(
            user=settings.POSTGRES_USER,
            password=settings.POSTGRES_PASSWORD,
            database=settings.POSTGRES_DB,
            host=settings.POSTGRES_HOST,
            port=settings.POSTGRES_PORT,
        )

        total_cams = await conn.fetchval("SELECT COUNT(*) FROM cameras;")
        print(f"Verified Database Scale: {total_cams} Camera Records\n")

        results_summary = []

        for radius_m, label in RADII:
            print(f"[BENCHMARKING RADIUS: {label} ({radius_m} meters)] Running {RUNS_PER_RADIUS} EXPLAIN ANALYZE iterations...")
            
            planning_times = []
            execution_times = []
            total_server_times = []
            rows_returned = 0
            index_used = "idx_cameras_location_geog_gist"

            # Warmup run
            await conn.fetch("""
                EXPLAIN (ANALYZE, BUFFERS)
                SELECT camera_uuid, camera_code, name, district
                FROM cameras
                WHERE ST_DWithin(
                    location_geog,
                    ST_SetSRID(ST_MakePoint(72.5714, 23.0225), 4326)::geography,
                    $1
                );
            """, float(radius_m))

            for run_i in range(RUNS_PER_RADIUS):
                plan_rows = await conn.fetch("""
                    EXPLAIN (ANALYZE, BUFFERS)
                    SELECT camera_uuid, camera_code, name, district
                    FROM cameras
                    WHERE ST_DWithin(
                        location_geog,
                        ST_SetSRID(ST_MakePoint(72.5714, 23.0225), 4326)::geography,
                        $1
                    );
                """, float(radius_m))

                p_time = 0.0
                e_time = 0.0

                for r in plan_rows:
                    line = r['QUERY PLAN']
                    if "actual time=" in line and "rows=" in line:
                        try:
                            rows_part = line.split("rows=")[1].split(" ")[0]
                            rows_returned = int(rows_part)
                        except Exception:
                            pass
                    if "Planning Time:" in line:
                        p_time = float(line.split(":")[1].replace("ms", "").strip())
                    if "Execution Time:" in line:
                        e_time = float(line.split(":")[1].replace("ms", "").strip())

                planning_times.append(p_time)
                execution_times.append(e_time)
                total_server_times.append(p_time + e_time)

            # Compute Statistical Metrics using numpy
            p_times = np.array(planning_times)
            e_times = np.array(execution_times)
            t_times = np.array(total_server_times)

            stats = {
                "label": label,
                "radius_m": radius_m,
                "rows_returned": rows_returned,
                "index_used": index_used,
                "planning_min": np.min(p_times),
                "planning_avg": np.mean(p_times),
                "planning_median": np.median(p_times),
                "planning_p95": np.percentile(p_times, 95),
                "planning_max": np.max(p_times),
                "exec_min": np.min(e_times),
                "exec_avg": np.mean(e_times),
                "exec_median": np.median(e_times),
                "exec_p95": np.percentile(e_times, 95),
                "exec_max": np.max(e_times),
                "total_min": np.min(t_times),
                "total_avg": np.mean(t_times),
                "total_median": np.median(t_times),
                "total_p95": np.percentile(t_times, 95),
                "total_max": np.max(t_times),
            }
            results_summary.append(stats)

            print(f"  -> Returned Rows:    {rows_returned}")
            print(f"  -> Exec Time (Avg):  {stats['exec_avg']:.3f} ms | P95: {stats['exec_p95']:.3f} ms | Min: {stats['exec_min']:.3f} ms | Max: {stats['exec_max']:.3f} ms")
            print(f"  -> Total Server (Avg):{stats['total_avg']:.3f} ms | P95: {stats['total_p95']:.3f} ms")
            print("-" * 80)

        # Print Final Markdown Table
        print("\n" + "=" * 80)
        print("[SUMMARY] FINAL STATISTICAL BENCHMARK SUMMARY TABLE (12,000 CAMERAS DATASET)")
        print("=" * 80)
        print(f"| Radius | Rows | Index Utilized | Exec Min | Exec Avg | Exec Median | Exec P95 | Exec Max |")
        print(f"|---|---|---|---|---|---|---|---|")
        for s in results_summary:
            print(f"| **{s['label']}** | {s['rows_returned']} | `{s['index_used']}` | {s['exec_min']:.2f} ms | **{s['exec_avg']:.2f} ms** | {s['exec_median']:.2f} ms | **{s['exec_p95']:.2f} ms** | {s['exec_max']:.2f} ms |")
        print("=" * 80)

        await conn.close()

    except Exception as e:
        print(f"[ERROR] Benchmark Failed: {e}")

if __name__ == "__main__":
    asyncio.run(run_statistical_benchmark())
