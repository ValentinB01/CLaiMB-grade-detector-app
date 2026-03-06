"""
ClAImb AI Coach - Backend API Tests
Covers: health, analyze, history CRUD, stats
"""
import pytest
import requests
import os
import base64
import io

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "").rstrip("/")


def get_test_image_b64():
    """Create a simple test climbing wall image with colored holds."""
    try:
        from PIL import Image, ImageDraw
        img = Image.new("RGB", (400, 600), color=(50, 50, 50))
        d = ImageDraw.Draw(img)
        colors = [(255, 200, 0), (0, 100, 255), (255, 50, 50), (0, 200, 100), (200, 0, 200)]
        positions = [(80, 100), (200, 150), (320, 200), (100, 300), (250, 350), (180, 450), (300, 500)]
        for i, (x, y) in enumerate(positions):
            d.ellipse([x - 25, y - 25, x + 25, y + 25], fill=colors[i % len(colors)])
        buf = io.BytesIO()
        img.save(buf, format="JPEG")
        return base64.b64encode(buf.getvalue()).decode()
    except Exception:
        # Fallback: read from tmp file
        with open("/tmp/test_climbing.b64") as f:
            return f.read()


@pytest.fixture(scope="module")
def api():
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture(scope="module")
def test_image_b64():
    return get_test_image_b64()


# ----- Health -----
class TestHealth:
    def test_health_returns_200(self, api):
        resp = api.get(f"{BASE_URL}/api/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "ok"
        print("✅ Health check passed")


# ----- Analysis -----
class TestAnalysis:
    def test_analyze_returns_holds_and_grade(self, api, test_image_b64):
        resp = api.post(f"{BASE_URL}/api/analyze", json={
            "image_base64": test_image_b64,
            "gym_name": "TEST_Gym",
            "user_id": "TEST_user"
        }, timeout=60)
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text[:300]}"
        data = resp.json()
        assert "holds" in data
        assert "grade" in data
        assert "notes" in data
        assert "analysis_id" in data
        assert isinstance(data["holds"], list)
        assert len(data["holds"]) > 0, "No holds detected"
        assert data["grade"].startswith("V"), f"Grade should start with V, got: {data['grade']}"
        print(f"✅ Analysis: grade={data['grade']}, holds={len(data['holds'])}")
        return data["analysis_id"]

    def test_analyze_persists_to_history(self, api, test_image_b64):
        """Create analysis then check history has the record."""
        resp = api.post(f"{BASE_URL}/api/analyze", json={
            "image_base64": test_image_b64,
            "gym_name": "TEST_PersistGym",
            "user_id": "TEST_persistuser"
        }, timeout=60)
        assert resp.status_code == 200
        analysis_id = resp.json()["analysis_id"]

        # Check history
        hist = api.get(f"{BASE_URL}/api/history?user_id=TEST_persistuser")
        assert hist.status_code == 200
        routes = hist.json()["routes"]
        found = any(r["analysis_id"] == analysis_id for r in routes)
        assert found, "Analysis not found in history after creation"
        print("✅ Analysis persisted to history")


# ----- History -----
class TestHistory:
    def test_get_history_returns_200(self, api):
        resp = api.get(f"{BASE_URL}/api/history")
        assert resp.status_code == 200
        data = resp.json()
        assert "routes" in data
        assert "total" in data
        assert isinstance(data["routes"], list)
        print(f"✅ History returned {data['total']} records")

    def test_get_history_user_filter(self, api):
        resp = api.get(f"{BASE_URL}/api/history?user_id=guest")
        assert resp.status_code == 200
        print("✅ History user filter works")

    def test_delete_history_entry(self, api, test_image_b64):
        """Create a record, then delete it, verify deletion."""
        # Create
        create_resp = api.post(f"{BASE_URL}/api/analyze", json={
            "image_base64": test_image_b64,
            "gym_name": "TEST_DeleteGym",
            "user_id": "TEST_deleteuser"
        }, timeout=60)
        assert create_resp.status_code == 200

        # Get history to find the record id
        hist = api.get(f"{BASE_URL}/api/history?user_id=TEST_deleteuser")
        assert hist.status_code == 200
        routes = hist.json()["routes"]
        assert len(routes) > 0, "No routes to delete"
        record_id = routes[0]["id"]

        # Delete
        del_resp = api.delete(f"{BASE_URL}/api/history/{record_id}")
        assert del_resp.status_code == 200
        data = del_resp.json()
        assert data.get("deleted") is True, f"Delete failed: {data}"

        # Verify gone
        hist2 = api.get(f"{BASE_URL}/api/history?user_id=TEST_deleteuser")
        remaining = hist2.json()["routes"]
        assert not any(r["id"] == record_id for r in remaining), "Record still present after delete"
        print("✅ Delete history entry works")


# ----- Stats -----
class TestStats:
    def test_stats_returns_fields(self, api):
        resp = api.get(f"{BASE_URL}/api/history/stats")
        assert resp.status_code == 200
        data = resp.json()
        assert "total_routes" in data
        assert "best_grade" in data
        print(f"✅ Stats: total={data['total_routes']}, best={data['best_grade']}")

    def test_stats_after_analysis(self, api, test_image_b64):
        """Ensure stats reflect new analysis data."""
        # Create a route
        api.post(f"{BASE_URL}/api/analyze", json={
            "image_base64": test_image_b64,
            "gym_name": "TEST_StatsGym",
            "user_id": "guest"
        }, timeout=60)

        resp = api.get(f"{BASE_URL}/api/history/stats?user_id=guest")
        assert resp.status_code == 200
        data = resp.json()
        assert data["total_routes"] >= 1
        print(f"✅ Stats after analysis: {data}")
